import { NextResponse } from 'next/server'
import { pdf, Document, Page, StyleSheet, Text, View, Image } from '@react-pdf/renderer'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/lib/auth'

const styles = StyleSheet.create({
  page: {
    width: '100%',
    height: '100%',
    padding: 24,
    backgroundColor: '#ffffff',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    height: '100%',
  },
  cell: {
    width: '50%',
    height: '33.3333%',
    padding: 8,
  },
  card: {
    width: '100%',
    height: '100%',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  qr: {
    width: 126,
    height: 126,
    objectFit: 'contain',
  },
  label: {
    marginTop: 10,
    fontSize: 10,
    lineHeight: 1.2,
    textAlign: 'center',
    color: '#0f172a',
    fontWeight: 400,
  },
  meta: {
    marginTop: 2,
    fontSize: 10,
    lineHeight: 1.2,
    textAlign: 'center',
    color: '#475569',
    fontWeight: 400,
  },
  header: {
    marginBottom: 12,
    fontSize: 12,
    color: '#0f172a',
    fontWeight: 700,
  },
})

const dedupeRows = (rows: any[] = []) => {
  const map = new Map<string, any>()

  rows.forEach((row) => {
    const deliveryOrderId = Number(row?.delivery_order_id || row?.delivery_order?.id || 0)
    const boxNumber = Number(row?.box_number || 0)

    if (!Number.isFinite(deliveryOrderId) || deliveryOrderId <= 0 || !Number.isFinite(boxNumber) || boxNumber <= 0) {
      return
    }

    const key = `${deliveryOrderId}:${boxNumber}`
    if (!map.has(key)) {
      map.set(key, row)
    }
  })

  return Array.from(map.values()).sort((left, right) => {
    const leftDo = Number(left?.delivery_order_id || left?.delivery_order?.id || 0)
    const rightDo = Number(right?.delivery_order_id || right?.delivery_order?.id || 0)
    if (leftDo !== rightDo) return rightDo - leftDo

    const leftBox = Number(left?.box_number || 0)
    const rightBox = Number(right?.box_number || 0)
    if (leftBox !== rightBox) return leftBox - rightBox

    return Number(left?.id || 0) - Number(right?.id || 0)
  })
}

const chunkBySize = <T,>(items: T[] = [], size = 6) => {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

const resolveBoxLabel = (row: any, fallbackIndex = 0) => {
  const boxNumber = Number(row?.box_number || fallbackIndex + 1)
  return `Box-${String(boxNumber).padStart(3, '0')}`
}

const resolveItemName = (row: any) => row?.item?.name || `Item ${row?.item_id || '-'}`

const resolveQuantity = (row: any) => Number(row?.quantity || 0)

export async function GET(req: Request) {
  const user = await getAuthenticatedUser(req)
  if (!user) return new Response('Unauthorized', { status: 401 })

  const url = new URL(req.url)
  const deliveryOrderIdParam = url.searchParams.get('delivery_order_id')
  const deliveryOrderId = deliveryOrderIdParam ? Number(deliveryOrderIdParam) : null

  if (!deliveryOrderId || !Number.isFinite(deliveryOrderId) || deliveryOrderId <= 0) {
    return NextResponse.json({ error: 'delivery_order_id wajib ada' }, { status: 400 })
  }

  const supabase = await createClient()
  let query = supabase
    .from('qr_code')
    .select(`
      *,
      delivery_order_item (
        id,
        box_number,
        quantity,
        item (
          id,
          name,
          sku,
          unit
        ),
        delivery_order (
          id,
          do_number,
          vendor_id,
          purchase_order (
            id,
            po_number,
            vendor_id
          )
        )
      ),
      item (
        id,
        name,
        sku,
        unit
      ),
      purchase_order (
        id,
        po_number,
        vendor_id
      ),
      delivery_order (
        id,
        do_number,
        vendor_id
      )
    `)
    .eq('delivery_order_id', deliveryOrderId)
    .order('box_number', { ascending: true })
    .order('id', { ascending: true })

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const allRows = Array.isArray(data) ? data : []
  const filteredRows = user.roles?.includes('vendor')
    ? allRows.filter((qr: any) => Number(qr?.purchase_order?.vendor_id) === Number(user.vendor_id) || Number(qr?.delivery_order?.vendor_id) === Number(user.vendor_id))
    : allRows

  if (filteredRows.length === 0) {
    return NextResponse.json({ error: 'QR untuk delivery order ini tidak ditemukan' }, { status: 404 })
  }

  const uniqueRows = dedupeRows(filteredRows)
  const pages = chunkBySize(uniqueRows, 6)

  const qrEntries = await Promise.all(
    uniqueRows.map(async (row) => {
      const dataUrl = await QRCode.toDataURL(String(row?.code || ''), {
        width: 260,
        margin: 1,
        errorCorrectionLevel: 'M',
      })

      return [String(row.id), dataUrl]
    })
  )

  const qrDataMap = new Map<string, string>(qrEntries as Array<[string, string]>)
  const deliveryOrderNumber = uniqueRows[0]?.delivery_order?.do_number || `DO-${deliveryOrderId}`

  const pdfDocument = (
    <Document>
      {pages.map((pageRows, pageIndex) => (
        <Page key={`page-${pageIndex}`} size="A4" orientation="portrait" style={styles.page}>
          <Text style={styles.header}>{deliveryOrderNumber}</Text>
          <View style={styles.grid}>
            {pageRows.map((row, index) => (
              <View key={row.id || `${row.code}-${index}`} style={styles.cell}>
                <View style={styles.card}>
                  <Image src={qrDataMap.get(String(row.id)) || ''} style={styles.qr} />
                  <Text style={styles.label}>{resolveBoxLabel(row, pageIndex * 6 + index)}</Text>
                  <Text style={styles.meta}>{resolveItemName(row)}</Text>
                  <Text style={styles.meta}>Qty: {resolveQuantity(row)}</Text>
                </View>
              </View>
            ))}
          </View>
        </Page>
      ))}
    </Document>
  )

  const pdfBuffer = await pdf(pdfDocument).toBuffer()

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${deliveryOrderNumber}-qr-document.pdf"`,
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}
