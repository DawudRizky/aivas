import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserFromReq } from '@/lib/auth'

type EvidenceInput = {
  id?: string
  timestamp?: string
  photoDataUrl?: string
  mimeType?: string
  qtyValue?: number
  qtyText?: string
  item?: {
    id?: number | string
    name?: string
    code?: string
  }
  geoTag?: {
    latitude?: number
    longitude?: number
    accuracy?: number
  }
}

type BatchInput = {
  batchId?: string
  batchKey?: string
  qr_code_id?: number | null
  item_id?: number | null
  expected_qty?: number
  actual_qty?: number
  device_id?: string
  notes?: string
  severity?: string
  evidence?: EvidenceInput[]
}

const TEXT_LIMIT = 1000
const STORAGE_BUCKET = 'inbound-evidence'

function clampText(value: unknown, limit = TEXT_LIMIT) {
  const text = String(value ?? '')
  return text.length > limit ? text.slice(0, limit) : text
}

function parseDataUrl(dataUrl: string) {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(String(dataUrl || ''))
  if (!match) return null

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  }
}

function buildFileName(evidenceId?: string) {
  return `${evidenceId || crypto.randomUUID?.() || Date.now()}.jpg`
}

export async function POST(req: Request) {
  const user = await getUserFromReq(req)
  if (!user) return new Response('Unauthorized', { status: 401 })

  const body = await req.json().catch(() => ({})) as BatchInput
  const batchId = String(body.batchId || crypto.randomUUID?.() || Date.now())
  const evidenceList = Array.isArray(body.evidence) ? body.evidence : []

  if (evidenceList.length === 0) {
    return NextResponse.json({ error: 'Evidence wajib ada untuk sinkronisasi' }, { status: 400 })
  }

  const supabase = await createClient()
  const finishedAt = new Date().toISOString()
  const expectedQty = Number(body.expected_qty || 0)
  const actualQty = Number(body.actual_qty || 0)
  const matched = actualQty === expectedQty
  const location = matched ? 'permanent storage' : 'temporary storage'
  const deviceId = clampText(body.device_id || 'mobile-admin')
  const inboundNotes = clampText(body.notes || (matched
    ? `Inbound matched. Total evidence count: ${evidenceList.length}.`
    : `Discrepancy otomatis: expected ${expectedQty}, actual ${actualQty}.`))
  const qrCodeId = body.qr_code_id ? Number(body.qr_code_id) : null
  const itemId = body.item_id ? Number(body.item_id) : null

  const { data: inboundScan, error: inboundError } = await supabase
    .from('inbound_scan')
    .insert([
      {
        qr_code_id: qrCodeId,
        scanned_at: finishedAt,
        scanned_by: user.id,
        qty_actual: actualQty,
        status: matched ? 'received' : 'pending',
        location,
        device_id: deviceId,
        notes: inboundNotes,
      },
    ])
    .select()
    .single()

  if (inboundError) {
    return NextResponse.json({ error: inboundError.message }, { status: 500 })
  }

  const inboundScanId = inboundScan.id
  const uploadedEvidence = [] as Array<{ id: string; storagePath: string }>

  for (const evidence of evidenceList) {
    const parsedDataUrl = parseDataUrl(evidence.photoDataUrl || '')
    if (!parsedDataUrl) {
      return NextResponse.json({ error: 'Format foto evidence tidak valid' }, { status: 400 })
    }

    const evidenceId = String(evidence.id || crypto.randomUUID?.() || Date.now())
    const storagePath = `inbound/${batchId}/${buildFileName(evidenceId)}`

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, parsedDataUrl.buffer, {
        contentType: parsedDataUrl.mimeType || evidence.mimeType || 'image/jpeg',
        upsert: true,
      })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    uploadedEvidence.push({ id: evidenceId, storagePath })
  }

  const photoRows = evidenceList.map((evidence, index) => ({
    inbound_scan_id: inboundScanId,
    url: uploadedEvidence[index]?.storagePath,
    timestamp: evidence.timestamp || finishedAt,
    mime_type: evidence.mimeType || 'image/jpeg',
    thumbnail_url: uploadedEvidence[index]?.storagePath,
  }))

  const { error: photoError } = await supabase.from('photo_evidence').insert(photoRows)
  if (photoError) {
    return NextResponse.json({ error: photoError.message }, { status: 500 })
  }

  const geoRows = evidenceList
    .filter((entry) => entry.geoTag?.latitude !== undefined && entry.geoTag?.longitude !== undefined)
    .map((entry) => ({
      inbound_scan_id: inboundScanId,
      latitude: entry.geoTag?.latitude,
      longitude: entry.geoTag?.longitude,
      timestamp: entry.timestamp || finishedAt,
      accuracy: entry.geoTag?.accuracy || null,
    }))

  if (geoRows.length > 0) {
    const { error: geoError } = await supabase.from('geo_tag').insert(geoRows)
    if (geoError) {
      return NextResponse.json({ error: geoError.message }, { status: 500 })
    }
  }

  let inventoryRecord = null
  if (matched && itemId) {
    const { data: existingRecord, error: existingError } = await supabase
      .from('inventory_record')
      .select('id, quantity')
      .eq('item_id', itemId)
      .eq('location', location)
      .maybeSingle()

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 })
    }

    const nextQuantity = Number(existingRecord?.quantity || 0) + actualQty
    const payload = {
      item_id: itemId,
      quantity: nextQuantity,
      reserved_qty: 0,
      location,
      last_updated: finishedAt,
      last_counted_at: finishedAt,
    }

    const inventoryResult = existingRecord
      ? await supabase.from('inventory_record').update(payload).eq('id', existingRecord.id).select().single()
      : await supabase.from('inventory_record').insert([payload]).select().single()

    inventoryRecord = inventoryResult.data || null
    if (inventoryResult.error) {
      return NextResponse.json({ error: inventoryResult.error.message }, { status: 500 })
    }
  }

  let discrepancyTicket = null
  if (!matched) {
    const ticketResult = await supabase
      .from('discrepancy_ticket')
      .insert([
        {
          inbound_scan_id: inboundScanId,
          status: 'open',
          created_at: finishedAt,
          assigned_to: null,
          notes: clampText(body.notes || `Discrepancy otomatis: expected ${expectedQty}, actual ${actualQty}.`),
          severity: body.severity || 'medium',
          history: clampText('Ticket created automatically'),
          reopen_reason: null,
        },
      ])
      .select()
      .single()

    discrepancyTicket = ticketResult.data || null
    if (ticketResult.error) {
      return NextResponse.json({ error: ticketResult.error.message }, { status: 500 })
    }
  }

  return NextResponse.json({
    message: 'Inbound batch berhasil disinkronkan',
    data: {
      batchId,
      inboundScan,
      inventoryRecord,
      discrepancyTicket,
      uploadedEvidence,
      evidenceCount: evidenceList.length,
      matched,
      location,
    },
  })
}
