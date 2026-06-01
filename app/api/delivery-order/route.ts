// app/api/delivery-order/route.ts

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { encryptQrPayload } from '@/lib/qrCrypto'

const aggregateQtyByItem = (items: Array<{ item_id?: number | null; quantity?: number | null }>) => {
  const summary = new Map<number, number>()

  items.forEach((item) => {
    const itemId = Number(item.item_id)
    const quantity = Number(item.quantity || 0)

    if (!Number.isFinite(itemId) || itemId <= 0 || !Number.isFinite(quantity) || quantity < 0) {
      return
    }

    summary.set(itemId, (summary.get(itemId) || 0) + quantity)
  })

  return summary
}

export async function GET(req: Request) {
  const user = await getAuthenticatedUser(req)
  if (!user) return new Response('Unauthorized', { status: 401 })

  const supabase = await createClient()
  let query = supabase
    .from('delivery_order')
    .select(`
      *,
      vendor (
        id,
        name
      ),
      purchase_order (
        id,
        po_number,
        vendor_id
      ),
      delivery_order_item (
        id,
        box_number,
        item_id,
        quantity,
        item (
          id,
          name,
          sku,
          unit
        )
      )
    `)

  if (user.roles?.includes('vendor')) {
    if (!user.vendor_id) {
      return NextResponse.json({ error: 'vendor_id wajib ada untuk akun vendor' }, { status: 403 })
    }

    query = query.eq('vendor_id', user.vendor_id)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const user = await getAuthenticatedUser(req)
  if (!user) return new Response('Unauthorized', { status: 401 })

  const body = await req.json()
  // Only vendor or supervisor can create delivery orders
  if (!user.roles || !(user.roles.includes('vendor') || user.roles.includes('supervisor'))) {
    return new Response('Forbidden', { status: 403 })
  }

  const supabase = await createClient()
  const { data: purchaseOrder, error: purchaseOrderError } = await supabase
    .from('purchase_order')
    .select('id, vendor_id, po_number')
    .eq('id', body.purchase_order_id)
    .maybeSingle()

  if (purchaseOrderError) {
    return NextResponse.json({ error: purchaseOrderError.message }, { status: 500 })
  }

  if (!purchaseOrder) {
    return NextResponse.json({ error: 'Purchase order tidak ditemukan' }, { status: 404 })
  }

  if (user.roles?.includes('vendor')) {
    if (!user.vendor_id) {
      return NextResponse.json({ error: 'vendor_id wajib ada untuk akun vendor' }, { status: 403 })
    }

    if (body.vendor_id && Number(body.vendor_id) !== Number(user.vendor_id)) {
      return NextResponse.json({ error: 'Vendor hanya dapat membuat data untuk vendor_id miliknya' }, { status: 403 })
    }

    if (!purchaseOrder || Number(purchaseOrder.vendor_id) !== Number(user.vendor_id)) {
      return NextResponse.json({ error: 'Purchase order tidak ditemukan untuk vendor ini' }, { status: 404 })
    }
  }

  const incomingItems: Array<{ box_number?: number; item_id: number; quantity: number }> = Array.isArray(body.items)
    ? body.items
    : []

  if (incomingItems.length === 0) {
    return NextResponse.json({ error: 'Delivery order wajib memiliki minimal 1 box item' }, { status: 400 })
  }

  const hasInvalidItemPayload = incomingItems.some((item) => {
    const itemId = Number(item.item_id)
    const quantity = Number(item.quantity)
    return !Number.isFinite(itemId) || itemId <= 0 || !Number.isFinite(quantity) || quantity <= 0
  })

  if (hasInvalidItemPayload) {
    return NextResponse.json({ error: 'Setiap box wajib memiliki item_id valid dan quantity > 0' }, { status: 400 })
  }

  const resolvedBoxNumbers = incomingItems.map((item, index) => {
    const boxNumber = Number(item.box_number)
    return Number.isFinite(boxNumber) && boxNumber > 0 ? boxNumber : index + 1
  })

  if (new Set(resolvedBoxNumbers).size !== resolvedBoxNumbers.length) {
    return NextResponse.json({ error: 'box_number harus unik dalam satu delivery order' }, { status: 400 })
  }

  const { data: purchaseOrderItems, error: purchaseOrderItemsError } = await supabase
    .from('purchase_order_item')
    .select('item_id, quantity_ordered')
    .eq('purchase_order_id', body.purchase_order_id)

  if (purchaseOrderItemsError) {
    return NextResponse.json({ error: purchaseOrderItemsError.message }, { status: 500 })
  }

  const poQtyByItem = aggregateQtyByItem(
    (purchaseOrderItems || []).map((item) => ({
      item_id: Number(item.item_id),
      quantity: Number(item.quantity_ordered),
    }))
  )

  const doQtyByItem = aggregateQtyByItem(
    incomingItems.map((item) => ({
      item_id: Number(item.item_id),
      quantity: Number(item.quantity),
    }))
  )

  if (poQtyByItem.size !== doQtyByItem.size) {
    return NextResponse.json({ error: 'Item DO harus sama dengan item pada PO' }, { status: 400 })
  }

  for (const [itemId, poQty] of poQtyByItem.entries()) {
    if (!doQtyByItem.has(itemId)) {
      return NextResponse.json({ error: 'Item DO harus sama dengan item pada PO' }, { status: 400 })
    }

    if (Number(doQtyByItem.get(itemId) || 0) !== Number(poQty || 0)) {
      return NextResponse.json({ error: 'Qty per item DO harus sama persis dengan PO' }, { status: 400 })
    }
  }

  const { data, error } = await supabase
    .from('delivery_order')
    .insert([
      {
        do_number: body.do_number,
        purchase_order_id: body.purchase_order_id,
        vendor_id: user.roles?.includes('vendor') ? user.vendor_id : body.vendor_id,
        status: body.status || 'shipped',
        shipped_at: new Date(),
        carrier: body.carrier,
        tracking_number: body.tracking_number
      }
    ])
    .select()

  const insertedDeliveryOrder = Array.isArray(data) ? data[0] : null

  if (!error && insertedDeliveryOrder) {
    if (incomingItems.length > 0) {
      const { error: itemError } = await supabase
        .from('delivery_order_item')
        .insert(
          incomingItems.map((item, index) => ({
            delivery_order_id: insertedDeliveryOrder.id,
            box_number: resolvedBoxNumbers[index],
            item_id: item.item_id,
            quantity: item.quantity,
          }))
        )

      if (itemError) {
        await supabase
          .from('delivery_order')
          .delete()
          .eq('id', insertedDeliveryOrder.id)

        return NextResponse.json(
          { error: itemError.message },
          { status: 500 }
        )
      }

      const { data: insertedDeliveryItems, error: insertedDeliveryItemsError } = await supabase
        .from('delivery_order_item')
        .select('id, box_number, item_id, quantity')
        .eq('delivery_order_id', insertedDeliveryOrder.id)
        .order('box_number', { ascending: true })

      if (insertedDeliveryItemsError) {
        await supabase
          .from('delivery_order_item')
          .delete()
          .eq('delivery_order_id', insertedDeliveryOrder.id)

        await supabase
          .from('delivery_order')
          .delete()
          .eq('id', insertedDeliveryOrder.id)

        return NextResponse.json({ error: insertedDeliveryItemsError.message }, { status: 500 })
      }

      const { error: qrError } = await supabase
        .from('qr_code')
        .insert(
          (insertedDeliveryItems || []).map((item) => ({
            code: encryptQrPayload({
              delivery_order_item_id: item.id,
            }),
            generated_at: new Date(),
            status: 'generated',
            printed_by: user.id,
            delivery_order_item_id: item.id,
            box_number: item.box_number,
            quantity: item.quantity,
            item_id: item.item_id,
            purchase_order_id: Number(body.purchase_order_id),
            delivery_order_id: insertedDeliveryOrder.id,
          }))
        )

      if (qrError) {
        await supabase
          .from('delivery_order_item')
          .delete()
          .eq('delivery_order_id', insertedDeliveryOrder.id)

        await supabase
          .from('delivery_order')
          .delete()
          .eq('id', insertedDeliveryOrder.id)

        return NextResponse.json(
          { error: qrError.message },
          { status: 500 }
        )
      }
    }
  }

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    message: 'Delivery Order berhasil dibuat',
    data
  })
}