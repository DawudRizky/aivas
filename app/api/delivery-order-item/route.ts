import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserFromReq } from '@/lib/auth'

export async function GET(req: Request) {
  const user = await getUserFromReq(req)
  if (!user) return new Response('Unauthorized', { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('delivery_order_item')
    .select(`
      *,
      delivery_order (
        id,
        do_number
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

  // Only ppic or supervisor may add delivery order items
  if (!user.roles || !(user.roles.includes('ppic') || user.roles.includes('supervisor'))) {
    return new Response('Forbidden', { status: 403 })
  }

  const body = await req.json()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('delivery_order_item')
    .insert([
      {
        delivery_order_id: body.delivery_order_id,
        box_number: body.box_number,
        item_id: body.item_id,
        quantity: body.quantity
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
    message: 'Delivery Order Item berhasil ditambahkan',
    data
  })
}