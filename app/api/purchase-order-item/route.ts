import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserFromReq } from '@/lib/auth'

export async function GET(req: Request) {
  const user = await getUserFromReq(req)
  if (!user) return new Response('Unauthorized', { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('purchase_order_item')
    .select(`
      *,
      purchase_order (
        id,
        po_number
      ),
      item (
        id,
        name,
        sku
      )
    `)

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const user = await getUserFromReq(req)
  if (!user) return new Response('Unauthorized', { status: 401 })

  // Only ppic or supervisor may add purchase order items
  if (!user.roles || !(user.roles.includes('ppic') || user.roles.includes('supervisor'))) {
    return new Response('Forbidden', { status: 403 })
  }

  const body = await req.json()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('purchase_order_item')
    .insert([
      {
        purchase_order_id: body.purchase_order_id,
        item_id: body.item_id,
        quantity_ordered: body.quantity_ordered,
        unit_price: body.unit_price,
        received_qty: 0
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
    message: 'Purchase Order Item berhasil ditambahkan',
    data
  })
}