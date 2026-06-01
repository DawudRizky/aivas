import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encryptQrPayload } from '@/lib/qrCrypto'
import { getAuthenticatedUser } from '@/lib/auth'

export async function GET(req: Request) {
  const user = await getAuthenticatedUser(req)
  if (!user) return new Response('Unauthorized', { status: 401 })

  const url = new URL(req.url)
  const deliveryOrderIdParam = url.searchParams.get('delivery_order_id')
  const deliveryOrderId = deliveryOrderIdParam ? Number(deliveryOrderIdParam) : null

  const supabase = await createClient()
  let query = supabase
    .from('qr_code')
    .select(`
      *,
      item (
        id,
        name,
        sku
      ),
      purchase_order (
        id,
        po_number,
        vendor_id
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
        )
      ),
      delivery_order (
        id,
        do_number,
        vendor_id
      )
    `)
    .order('delivery_order_id', { ascending: false })
    .order('box_number', { ascending: true })
    .order('id', { ascending: true })

  if (deliveryOrderId && Number.isFinite(deliveryOrderId) && deliveryOrderId > 0) {
    query = query.eq('delivery_order_id', deliveryOrderId)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }

  if (user.roles?.includes('vendor')) {
    if (!user.vendor_id) {
      return NextResponse.json({ error: 'vendor_id wajib ada untuk akun vendor' }, { status: 403 })
    }

    return NextResponse.json(
      (data || []).filter((qr: any) => {
        const purchaseOrderVendorId = qr?.purchase_order?.vendor_id
        const deliveryOrderVendorId = qr?.delivery_order?.vendor_id
        return Number(purchaseOrderVendorId) === Number(user.vendor_id) || Number(deliveryOrderVendorId) === Number(user.vendor_id)
      })
    )
  }

  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const user = await getAuthenticatedUser(req)
  if (!user) return new Response('Unauthorized', { status: 401 })

  const body = await req.json()

  // Only ppic or supervisor can generate QR codes
  if (!user.roles || !(user.roles.includes('ppic') || user.roles.includes('supervisor'))) {
    return new Response('Forbidden', { status: 403 })
  }

  const supabase = await createClient()
  const deliveryOrderItemId = Number(body.delivery_order_item_id || 0)

  let deliveryOrderItemQuery = supabase
    .from('delivery_order_item')
    .select(`
      id,
      box_number,
      quantity,
      item_id,
      delivery_order_id,
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
    `)

  if (Number.isFinite(deliveryOrderItemId) && deliveryOrderItemId > 0) {
    deliveryOrderItemQuery = deliveryOrderItemQuery.eq('id', deliveryOrderItemId)
  } else if (body.delivery_order_id && body.item_id) {
    deliveryOrderItemQuery = deliveryOrderItemQuery
      .eq('delivery_order_id', body.delivery_order_id)
      .eq('item_id', body.item_id)
  } else {
    return NextResponse.json({ error: 'delivery_order_item_id wajib ada' }, { status: 400 })
  }

  const { data: deliveryOrderItem, error: deliveryOrderItemError } = await deliveryOrderItemQuery.maybeSingle()

  if (deliveryOrderItemError) {
    return NextResponse.json({ error: deliveryOrderItemError.message }, { status: 500 })
  }

  if (!deliveryOrderItem) {
    return NextResponse.json({ error: 'delivery_order_item tidak ditemukan' }, { status: 404 })
  }

  const deliveryOrderRecord = Array.isArray((deliveryOrderItem as any).delivery_order)
    ? (deliveryOrderItem as any).delivery_order[0]
    : (deliveryOrderItem as any).delivery_order

  const generatedCode = encryptQrPayload({
    delivery_order_item_id: Number(deliveryOrderItem.id),
  })

  const { data, error } = await supabase
    .from('qr_code')
    .insert([
      {
        code: generatedCode,
        generated_at: new Date(),
        status: 'generated',
        printed_by: user.id,
        delivery_order_item_id: deliveryOrderItem.id,
        box_number: deliveryOrderItem.box_number,
        quantity: deliveryOrderItem.quantity,
        item_id: deliveryOrderItem.item_id,
        purchase_order_id: deliveryOrderRecord?.purchase_order?.[0]?.id,
        delivery_order_id: deliveryOrderItem.delivery_order_id
      }
    ])
    .select()

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    message: 'QR Code berhasil dibuat',
    data
  })
}