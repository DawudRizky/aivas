// app/api/delivery-order/route.ts

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserFromReq } from '@/lib/auth'

export async function GET(req: Request) {
  const user = await getUserFromReq(req)
  if (!user) return new Response('Unauthorized', { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('delivery_order')
    .select(`
      *,
      vendor (
        id,
        name
      ),
      purchase_order (
        id,
        po_number
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

  const body = await req.json()
  // Only vendor or supervisor can create delivery orders
  if (!user.roles || !(user.roles.includes('vendor') || user.roles.includes('supervisor'))) {
    return new Response('Forbidden', { status: 403 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('delivery_order')
    .insert([
      {
        do_number: body.do_number,
        purchase_order_id: body.purchase_order_id,
        vendor_id: body.vendor_id,
        status: body.status || 'shipped',
        shipped_at: new Date(),
        carrier: body.carrier,
        tracking_number: body.tracking_number
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
    message: 'Delivery Order berhasil dibuat',
    data
  })
}