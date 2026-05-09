import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserFromReq } from '@/lib/auth'

export async function GET(req: Request) {
  const user = await getUserFromReq(req)
  if (!user) return new Response('Unauthorized', { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('purchase_order')
    .select(`
      *,
      vendor (
        id,
        name
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

  return NextResponse.json({
    message: 'Purchase Order berhasil dibuat',
    data
  })
}