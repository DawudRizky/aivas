import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { v4 as uuidv4 } from 'uuid'
import { getUserFromReq } from '@/lib/auth'

export async function GET(req: Request) {
  const user = await getUserFromReq(req)
  if (!user) return new Response('Unauthorized', { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase
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
        po_number
      ),
      delivery_order (
        id,
        do_number
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

  // Only ppic or supervisor can generate QR codes
  if (!user.roles || !(user.roles.includes('ppic') || user.roles.includes('supervisor'))) {
    return new Response('Forbidden', { status: 403 })
  }

  const generatedCode = `QR-${uuidv4()}`

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('qr_code')
    .insert([
      {
        code: generatedCode,
        generated_at: new Date(),
        status: 'generated',
        printed_by: user.id,
        item_id: body.item_id,
        purchase_order_id: body.purchase_order_id,
        delivery_order_id: body.delivery_order_id
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