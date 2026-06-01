import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserFromReq } from '@/lib/auth'

const STORAGE_BUCKET = 'inbound-evidence'

function parseDataUrl(dataUrl: string) {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(String(dataUrl || ''))
  if (!match) return null
  return {
    mimeType: match[1] || 'image/jpeg',
    buffer: Buffer.from(match[2], 'base64'),
  }
}

function buildEvidenceFilePath(inboundScanId: number, index: number, mimeType: string) {
  const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg'
  const fileName = `${Date.now()}-${index}-${crypto.randomUUID()}.${ext}`
  return `inbound/complete/${inboundScanId}/${fileName}`
}

/**
 * Complete inbound scan with all evidence
 * POST /api/inbound-scan/complete
 * 
 * Body: {
 *   qr_code_id: number
 *   delivery_order_item_id: number
 *   qty_actual: number
 *   location: string
 *   device_id: string
 *   notes?: string
 *   evidences: Array<{
 *     photo_base64: string (data:image/jpeg;base64,...)
 *     qty_in_photo: number
 *     timestamp: string (ISO)
 *     latitude?: number
 *     longitude?: number
 *     accuracy?: number
 *   }>
 * }
 */
export async function POST(req: Request) {
  const user = await getUserFromReq(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only inbound users or supervisor may create inbound scans
  if (!user.roles || !(user.roles.includes('inbound') || user.roles.includes('supervisor') || user.roles.includes('admin'))) {
    return NextResponse.json({ error: 'Forbidden - requires inbound, supervisor, or admin role' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const {
      qr_code_id,
      delivery_order_item_id,
      qty_actual,
      location,
      device_id,
      notes,
      mode,
      reject_reason,
      evidences = []
    } = body

    // Validate required fields
    if (!qr_code_id || !delivery_order_item_id || qty_actual === undefined) {
      return NextResponse.json(
        { error: 'qr_code_id, delivery_order_item_id, dan qty_actual wajib diisi' },
        { status: 400 }
      )
    }

    if (!Array.isArray(evidences) || evidences.length === 0) {
      return NextResponse.json(
        { error: 'Minimal 1 bukti foto diperlukan' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const finishedAt = new Date().toISOString()
    const isRejectMode = String(mode || '').toLowerCase() === 'reject'

    // Resolve expected qty from delivery order item
    const { data: deliveryOrderItem, error: doiError } = await supabase
      .from('delivery_order_item')
      .select('quantity, item_id')
      .eq('id', delivery_order_item_id)
      .single()

    if (doiError || !deliveryOrderItem) {
      return NextResponse.json(
        { error: doiError?.message || 'Delivery order item tidak ditemukan' },
        { status: 400 }
      )
    }

    const expectedQty = Number(deliveryOrderItem.quantity || 0)
    const actualQty = Number(qty_actual || 0)
    const isMatch = !isRejectMode && actualQty === expectedQty
    const inboundStatus = isMatch ? 'match' : 'hold'

    // 1. Create inbound_scan record
    const { data: inboundScan, error: scanError } = await supabase
      .from('inbound_scan')
      .insert([
        {
          qr_code_id,
          scanned_at: finishedAt,
          scanned_by: user.id,
          qty_actual: actualQty,
          status: inboundStatus,
          location: location || 'WAREHOUSE',
          device_id: device_id || 'UNKNOWN',
          notes: isRejectMode ? `REJECT: ${reject_reason || notes || ''}` : (notes || null)
        }
      ])
      .select()
      .single()

    if (scanError || !inboundScan) {
      console.error('Error creating inbound_scan:', scanError)
      return NextResponse.json(
        { error: scanError?.message || 'Gagal membuat inbound scan' },
        { status: 500 }
      )
    }

    const inboundScanId = inboundScan.id

    // 2. Upload photos and create photo_evidence records
    const photoResults = []
    const geoResults = []
    
    for (let i = 0; i < evidences.length; i++) {
      const evidence = evidences[i]
      
      if (!evidence.photo_base64) {
        console.log(`Evidence ${i} has no photo_base64, skipping`)
        continue
      }

      try {
        const parsedDataUrl = parseDataUrl(evidence.photo_base64)
        if (!parsedDataUrl) {
          console.error(`Evidence ${i} has invalid data URL`)
          continue
        }

        const mimeType = parsedDataUrl.mimeType
        const storagePath = buildEvidenceFilePath(inboundScanId, i, mimeType)

        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(storagePath, parsedDataUrl.buffer, {
            contentType: mimeType,
            upsert: true,
          })

        if (uploadError) {
          console.error(`Error uploading evidence ${i}:`, uploadError)
          continue
        }

        console.log(`Creating photo_evidence ${i} for inbound_scan_id ${inboundScanId}`)

        // Create photo_evidence record
        const { data: photoEvidence, error: photoError } = await supabase
          .from('photo_evidence')
          .insert([
            {
              inbound_scan_id: inboundScanId,
              url: storagePath,
              timestamp: evidence.timestamp || finishedAt,
              mime_type: mimeType,
              thumbnail_url: storagePath
            }
          ])
          .select()
          .single()

        if (photoError) {
          console.error(`Error creating photo_evidence ${i}:`, photoError)
          continue
        }

        console.log(`Photo evidence ${i} created successfully:`, photoEvidence.id)
        photoResults.push(photoEvidence)

        // 3. Create geo_tag if location data exists
        if (evidence.latitude && evidence.longitude) {
          console.log(`Creating geo_tag ${i} for inbound_scan_id ${inboundScanId}`)
          
          const { data: geoTag, error: geoError } = await supabase
            .from('geo_tag')
            .insert([
              {
                inbound_scan_id: inboundScanId,
                latitude: evidence.latitude,
                longitude: evidence.longitude,
                timestamp: evidence.timestamp || finishedAt,
                accuracy: evidence.accuracy || null
              }
            ])
            .select()
            .single()

          if (geoError) {
            console.error(`Error creating geo_tag ${i}:`, geoError)
          } else {
            console.log(`Geo tag ${i} created successfully:`, geoTag.id)
            geoResults.push(geoTag)
          }
        }
      } catch (err) {
        console.error(`Error processing evidence ${i}:`, err)
      }
    }

    // Resolve item_id from qr_code first (requested source of truth for inventory linkage)
    const { data: qrCodeRow } = await supabase
      .from('qr_code')
      .select('item_id')
      .eq('id', qr_code_id)
      .maybeSingle()

    const resolvedItemId = Number(qrCodeRow?.item_id || deliveryOrderItem.item_id || 0)

    // 4. Update inventory when MATCH only
    let inventoryRecord = null
    if (isMatch) {
      const itemId = resolvedItemId
      if (itemId) {
        const targetLocation = location || 'WAREHOUSE'
        const { data: existingRows, error: existingRowsError } = await supabase
          .from('inventory_record')
          .select('id, quantity, location')
          .eq('item_id', itemId)
          .order('id', { ascending: true })

        if (existingRowsError) {
          return NextResponse.json({ error: existingRowsError.message }, { status: 500 })
        }

        const existingRecord = Array.isArray(existingRows) && existingRows.length > 0
          ? existingRows[0]
          : null

        const nextQuantity = Number(existingRecord?.quantity || 0) + actualQty
        const payload = {
          item_id: itemId,
          quantity: nextQuantity,
          reserved_qty: 0,
          location: existingRecord?.location || targetLocation,
          last_updated: finishedAt,
          last_counted_at: finishedAt,
        }

        const inventoryResult = existingRecord
          ? await supabase.from('inventory_record').update(payload).eq('id', existingRecord.id).select().single()
          : await supabase.from('inventory_record').insert([payload]).select().single()

        if (inventoryResult.error) {
          return NextResponse.json({ error: inventoryResult.error.message }, { status: 500 })
        }
        inventoryRecord = inventoryResult.data || null
      }
    }

    // 5. Create discrepancy ticket when HOLD or REJECT
    let discrepancyTicket = null
    if (!isMatch) {
      const discrepancyAmount = Math.abs(expectedQty - actualQty)
      const discrepancyType = isRejectMode
        ? 'reject'
        : (actualQty < expectedQty ? 'shortage' : 'overage')
      const notesText = isRejectMode
        ? `REJECT: ${reject_reason || notes || 'Tanpa alasan'}`
        : `${discrepancyType.toUpperCase()}: Expected ${expectedQty}, actual ${actualQty}. Difference: ${discrepancyAmount}.`

      const { data: ticket, error: ticketError } = await supabase
        .from('discrepancy_ticket')
        .insert([
          {
            inbound_scan_id: inboundScanId,
            status: 'open',
            created_at: finishedAt,
            assigned_to: null,
            notes: notesText,
            severity: isRejectMode ? 'high' : (discrepancyAmount > 10 ? 'high' : 'medium'),
            history: null,
            reopen_reason: null
          }
        ])
        .select()
        .single()

      if (ticketError) {
        console.error('Error creating discrepancy ticket:', ticketError)
      } else {
        discrepancyTicket = ticket
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Inbound scan berhasil diselesaikan',
      data: {
        inbound_scan: inboundScan,
        status: inboundStatus,
        expected_qty: expectedQty,
        actual_qty: actualQty,
        photo_count: photoResults.length,
        photos: photoResults,
        geo_count: geoResults.length,
        inventory_record: inventoryRecord,
        discrepancy_ticket: discrepancyTicket
      }
    })
  } catch (error) {
    console.error('Error in complete inbound scan:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
