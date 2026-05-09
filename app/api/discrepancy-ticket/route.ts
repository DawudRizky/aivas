import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserFromReq } from '@/lib/auth'

export async function GET(req: Request) {
  const user = await getUserFromReq(req)
  if (!user) return new Response('Unauthorized', { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('discrepancy_ticket')
    .select(`
      *,
      inbound_scan (
        id,
        qty_actual,
        status
      ),
      users (
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
  // Only inbound or supervisor can create discrepancy tickets
  if (!user.roles || !(user.roles.includes('inbound') || user.roles.includes('supervisor'))) {
    return new Response('Forbidden', { status: 403 })
  }
  const payload = await req.json()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('discrepancy_ticket')
    .insert([
      {
        inbound_scan_id: payload.inbound_scan_id,
        status: 'open',
        created_at: new Date(),
        assigned_to: payload.assigned_to,
        notes: payload.notes,
        severity: payload.severity || 'medium',
        history: 'Ticket created automatically',
        reopen_reason: null
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
    message: 'Discrepancy Ticket berhasil dibuat',
    data
  })
}