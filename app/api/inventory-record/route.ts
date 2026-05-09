import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserFromReq } from '@/lib/auth'

export async function GET(req: Request) {
  const user = await getUserFromReq(req)
  if (!user) return new Response('Unauthorized', { status: 401 })

  // Only ppic, inbound or supervisor may create inventory records
  if (!user.roles || !(user.roles.includes('ppic') || user.roles.includes('inbound') || user.roles.includes('supervisor'))) {
    return new Response('Forbidden', { status: 403 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('inventory_record')
    .select(`
      *,
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

  const body = await req.json()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('inventory_record')
    .insert([
      {
        item_id: body.item_id,
        quantity: body.quantity,
        reserved_qty: body.reserved_qty || 0,
        location: body.location,
        last_updated: new Date(),
        last_counted_at: new Date()
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
    message: 'Inventory Record berhasil dibuat',
    data
  })
}