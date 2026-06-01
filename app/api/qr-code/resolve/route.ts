import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decryptQrPayload } from '@/lib/qrCrypto'
import { getAuthenticatedUser } from '@/lib/auth'

export async function GET(req: Request) {
  const user = await getAuthenticatedUser(req)
  if (!user) return new Response('Unauthorized', { status: 401 })

  const url = new URL(req.url)
  const token = url.searchParams.get('token')?.trim() || ''

  if (!token) {
    return NextResponse.json({ error: 'token wajib ada' }, { status: 400 })
  }

  const supabase = await createClient()
  let query = supabase
    .from('qr_code')
    .select(`
      id,
      code,
      generated_at,
      status,
      printed_by,
      delivery_order_item_id,
      box_number,
      quantity,
      item_id,
      purchase_order_id,
      delivery_order_id,
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
        vendor_id,
        purchase_order (
          id,
          po_number,
          vendor_id
        )
      ),
      delivery_order_item (
        id,
        box_number,
        quantity,
        delivery_order_id,
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
      )
    `)

  const decrypted = decryptQrPayload(token)
  if (decrypted?.delivery_order_item_id) {
    query = query.eq('delivery_order_item_id', decrypted.delivery_order_item_id)
  } else {
    query = query.eq('code', token)
  }

  const { data, error } = await query.maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: 'QR tidak ditemukan atau token tidak valid' }, { status: 404 })
  }

  const row = data as any
  const purchaseOrder = row.purchase_order || row.delivery_order?.purchase_order || row.delivery_order_item?.delivery_order?.purchase_order || null
  const deliveryOrder = row.delivery_order || row.delivery_order_item?.delivery_order || null
  const deliveryOrderItem = row.delivery_order_item || null
  const item = deliveryOrderItem?.item || row.item || null

  if (user.roles?.includes('vendor')) {
    if (!user.vendor_id) {
      return NextResponse.json({ error: 'vendor_id wajib ada untuk akun vendor' }, { status: 403 })
    }

    const vendorId = Number(user.vendor_id)
    const purchaseOrderVendorId = Number(purchaseOrder?.vendor_id || 0)
    const deliveryOrderVendorId = Number(deliveryOrder?.vendor_id || 0)
    if (purchaseOrderVendorId !== vendorId && deliveryOrderVendorId !== vendorId) {
      return NextResponse.json({ error: 'QR tidak ditemukan untuk vendor ini' }, { status: 404 })
    }
  }

  const boxNumber = Number(deliveryOrderItem?.box_number || row.box_number || 0)
  const quantity = Number(deliveryOrderItem?.quantity || row.quantity || 0)
  const deliveryOrderItemId = Number(deliveryOrderItem?.id || row.delivery_order_item_id || 0)

  return NextResponse.json({
    brand: 'AIVAS',
    uid: `DOI-${deliveryOrderItemId}`,
    rawValue: token,
    tokenType: decrypted ? 'encrypted' : 'legacy',
    deliveryOrderItemId,
    boxNumber,
    quantity,
    poNumber: purchaseOrder?.po_number || deliveryOrder?.purchase_order?.po_number || 'UNKNOWN',
    doNumber: deliveryOrder?.do_number || 'UNKNOWN',
    itemId: Number(item?.id || row.item_id || 0) || 'UNKNOWN',
    itemName: item?.name || 'UNKNOWN',
    itemSku: item?.sku || 'UNKNOWN',
    itemUnit: item?.unit || 'pcs',
    qrCode: {
      id: row.id,
      code: row.code,
      generated_at: row.generated_at,
      status: row.status,
      delivery_order_item_id: row.delivery_order_item_id,
    },
    purchaseOrder,
    deliveryOrder,
    deliveryOrderItem,
    item,
  })
}
