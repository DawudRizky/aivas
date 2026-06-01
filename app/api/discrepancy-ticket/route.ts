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
        status,
        scanned_at,
        qr_code (
          id,
          box_number,
          quantity,
          delivery_order (
            id,
            do_number,
            vendor (
              id,
              name
            )
          ),
          item (
            id,
            name,
            sku,
            unit
          )
        )
      ),
      users (
        id,
        name
      )
    `)
    .order('created_at', { ascending: false })

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

export async function PATCH(req: Request) {
  const user = await getUserFromReq(req)
  if (!user) return new Response('Unauthorized', { status: 401 })
  if (!user.roles || !(user.roles.includes('supervisor') || user.roles.includes('admin'))) {
    return new Response('Forbidden', { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const ticketId = Number(body.id)
  if (!Number.isFinite(ticketId) || ticketId <= 0) {
    return NextResponse.json({ error: 'id tiket wajib valid' }, { status: 400 })
  }

  const nextStatus = String(body.status || '').toLowerCase()
  const allowedStatus = new Set(['open', 'returned', 'recount'])
  if (!allowedStatus.has(nextStatus)) {
    return NextResponse.json({ error: 'status harus open, returned, atau recount' }, { status: 400 })
  }

  const supabase = await createClient()
  const historyLine = `[${new Date().toISOString()}] ${user.name || `user-${user.id}`}: set status ${nextStatus}${body.notes ? ` | ${body.notes}` : ''}`

  const { data: existing, error: existingError } = await supabase
    .from('discrepancy_ticket')
    .select('id, history, inbound_scan_id')
    .eq('id', ticketId)
    .maybeSingle()

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 })
  }
  if (!existing) {
    return NextResponse.json({ error: 'Tiket tidak ditemukan' }, { status: 404 })
  }

  const mergedHistory = [existing.history, historyLine].filter(Boolean).join('\n')
  const patchPayload: Record<string, unknown> = {
    status: nextStatus,
    history: mergedHistory,
  }

  if (typeof body.notes === 'string') patchPayload.notes = body.notes
  if (nextStatus === 'open' && typeof body.reopen_reason === 'string') {
    patchPayload.reopen_reason = body.reopen_reason
  }

  const { data, error } = await supabase
    .from('discrepancy_ticket')
    .update(patchPayload)
    .eq('id', ticketId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Relay supervisor decision to inbound by syncing inbound_scan.status
  if (existing.inbound_scan_id) {
    const { error: inboundUpdateError } = await supabase
      .from('inbound_scan')
      .update({ status: nextStatus })
      .eq('id', existing.inbound_scan_id)

    if (inboundUpdateError) {
      return NextResponse.json({ error: inboundUpdateError.message }, { status: 500 })
    }
  }

  return NextResponse.json({
    message: 'Discrepancy ticket berhasil diperbarui',
    data,
  })
}
