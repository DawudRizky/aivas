import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/lib/auth'

export async function GET(req: Request) {
  const user = await getAuthenticatedUser(req)
  if (!user) return new Response('Unauthorized', { status: 401 })

  const url = new URL(req.url)
  const includeAllForVendor = url.searchParams.get('include_all') === '1'

  const supabase = await createClient()
  let query = supabase
    .from('purchase_order')
    .select(`
      *,
      vendor (
        id,
        name
      ),
      purchase_order_item (
        id,
        item_id,
        quantity_ordered,
        unit_price,
        received_qty,
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
    if (!includeAllForVendor) {
      query = query.in('status', ['submitted', 'rejected'])
    }
  }

  const { data, error } = await query
    .order('date', { ascending: false })
    .order('id', { ascending: false })

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
  // Only ppic or supervisor may create purchase orders
  if (!user.roles || !(user.roles.includes('ppic') || user.roles.includes('supervisor'))) {
    return new Response('Forbidden', { status: 403 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('purchase_order')
    .insert([
      {
        po_number: body.po_number,
        date: new Date(),
        status: 'submitted',
        created_by: user.id,
        vendor_id: body.vendor_id,
        received_by: body.received_by || null,
        total_amount: body.total_amount,
        currency: 'IDR'
      }
    ])
    .select()

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }

  const insertedOrder = Array.isArray(data) ? data[0] : null
  const incomingItems = Array.isArray(body.items) ? body.items : []

  if (insertedOrder && incomingItems.length > 0) {
    const { error: itemError } = await supabase
      .from('purchase_order_item')
      .insert(
        incomingItems.map((item: any) => ({
          purchase_order_id: insertedOrder.id,
          item_id: item.item_id,
          quantity_ordered: item.quantity_ordered,
          unit_price: item.unit_price,
          received_qty: 0,
        }))
      )

    if (itemError) {
      return NextResponse.json(
        { error: itemError.message },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({
    message: 'Purchase Order berhasil dibuat',
    data
  })
}

async function replacePurchaseOrderItems(supabase: Awaited<ReturnType<typeof createClient>>, purchaseOrderId: number, items: any[]) {
  const { error: deleteError } = await supabase
    .from('purchase_order_item')
    .delete()
    .eq('purchase_order_id', purchaseOrderId)

  if (deleteError) {
    return { error: deleteError }
  }

  if (items.length === 0) {
    return { error: null }
  }

  const { error: insertError } = await supabase
    .from('purchase_order_item')
    .insert(
      items.map((item) => ({
        purchase_order_id: purchaseOrderId,
        item_id: item.item_id,
        quantity_ordered: item.quantity_ordered,
        unit_price: item.unit_price,
        received_qty: 0,
      }))
    )

  if (insertError) {
    return { error: insertError }
  }

  return { error: null }
}

export async function PATCH(req: Request) {
  const user = await getAuthenticatedUser(req)
  if (!user) return new Response('Unauthorized', { status: 401 })

  const body = await req.json()
  if (!body.id) {
    return NextResponse.json({ error: 'id wajib diisi' }, { status: 400 })
  }

  const status = typeof body.status === 'string' ? body.status.toLowerCase() : ''
  const allowedVendorStatusUpdates = new Set(['rejected', 'acknowledged'])

  const supabase = await createClient()

  if (user.roles?.includes('vendor')) {
    if (!user.vendor_id) {
      return NextResponse.json({ error: 'vendor_id wajib ada untuk akun vendor' }, { status: 403 })
    }

    if (!allowedVendorStatusUpdates.has(status)) {
      return NextResponse.json({ error: 'Vendor hanya dapat reject atau acknowledge purchase order' }, { status: 403 })
    }

    const { data: existingOrder, error: existingOrderError } = await supabase
      .from('purchase_order')
      .select('id, vendor_id, status')
      .eq('id', body.id)
      .maybeSingle()

    if (existingOrderError) {
      return NextResponse.json({ error: existingOrderError.message }, { status: 500 })
    }

    if (!existingOrder || Number(existingOrder.vendor_id) !== Number(user.vendor_id)) {
      return NextResponse.json({ error: 'Purchase order tidak ditemukan untuk vendor ini' }, { status: 404 })
    }

    const { data, error } = await supabase
      .from('purchase_order')
      .update({
        status,
      })
      .eq('id', body.id)
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Purchase Order berhasil diperbarui',
      data,
    })
  }

  if (!user.roles || !(user.roles.includes('ppic') || user.roles.includes('supervisor'))) {
    return new Response('Forbidden', { status: 403 })
  }

  const items = Array.isArray(body.items) ? body.items : []

  const { data, error } = await supabase
    .from('purchase_order')
    .update({
      po_number: body.po_number,
      vendor_id: body.vendor_id,
      total_amount: body.total_amount,
      status: body.status || 'submitted',
      date: new Date(),
    })
    .eq('id', body.id)
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const insertedOrder = Array.isArray(data) ? data[0] : null
  if (!insertedOrder) {
    return NextResponse.json({ error: 'Purchase Order tidak ditemukan' }, { status: 404 })
  }

  const replacedItems = await replacePurchaseOrderItems(supabase, Number(insertedOrder.id), items)
  if (replacedItems.error) {
    return NextResponse.json({ error: replacedItems.error.message }, { status: 500 })
  }

  return NextResponse.json({
    message: 'Purchase Order berhasil diperbarui',
    data,
  })
}

export async function DELETE(req: Request) {
  const user = await getAuthenticatedUser(req)
  if (!user) return new Response('Unauthorized', { status: 401 })

  if (!user.roles || !(user.roles.includes('ppic') || user.roles.includes('supervisor'))) {
    return new Response('Forbidden', { status: 403 })
  }

  const body = await req.json()
  if (!body.id) {
    return NextResponse.json({ error: 'id wajib diisi' }, { status: 400 })
  }

  const supabase = await createClient()
  const { error: itemDeleteError } = await supabase
    .from('purchase_order_item')
    .delete()
    .eq('purchase_order_id', body.id)

  if (itemDeleteError) {
    return NextResponse.json({ error: itemDeleteError.message }, { status: 500 })
  }

  const { error: orderDeleteError } = await supabase
    .from('purchase_order')
    .delete()
    .eq('id', body.id)

  if (orderDeleteError) {
    return NextResponse.json({ error: orderDeleteError.message }, { status: 500 })
  }

  return NextResponse.json({ message: 'Purchase Order berhasil dihapus' })
}