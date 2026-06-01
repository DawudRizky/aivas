import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserFromReq } from '@/lib/auth'

export async function GET(req: Request) {
  const user = await getUserFromReq(req)
  if (!user) return new Response('Unauthorized', { status: 401 })

  // Allow inbound, supervisor, and admin to read inbound scan history
  if (!user.roles || !(user.roles.includes('inbound') || user.roles.includes('supervisor') || user.roles.includes('admin'))) {
    return new Response('Forbidden', { status: 403 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('inbound_scan')
    .select(`
      *,
      qr_code (
        id,
        code,
        box_number,
        quantity,
        delivery_order (
          do_number
        ),
        item (
          id,
          sku,
          name
        )
      ),
      users (
        id,
        name
      )
    `)
    .order('scanned_at', { ascending: false })

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

  const status = body.qty_actual > 0 ? 'received' : 'pending'

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('inbound_scan')
    .insert([
      {
        qr_code_id: body.qr_code_id,
        scanned_at: new Date(),
        scanned_by: user.id,
        qty_actual: body.qty_actual,
        status: status,
        location: body.location,
        device_id: body.device_id,
        notes: body.notes || null
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
    message: 'Inbound Scan berhasil dibuat',
    data
  })
}
