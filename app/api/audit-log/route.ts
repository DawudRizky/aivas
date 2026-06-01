import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserFromReq } from '@/lib/auth'

export async function GET(req: Request) {
  const user = await getUserFromReq(req)
  if (!user) return new Response('Unauthorized', { status: 401 })

  // restrict audit log creation to supervisor
  if (!user.roles || !user.roles.includes('supervisor')) {
    return new Response('Forbidden', { status: 403 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('audit_log')
    .select(`
      *,
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
  const body = await req.json()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('audit_log')
    .insert([
      {
        entity_type: body.entity_type,
        entity_id: body.entity_id,
        action: body.action,
        details: body.details,
        performed_by: user.id,
        ip_address: body.ip_address || '127.0.0.1',
        timestamp: new Date()
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
    message: 'Audit Log berhasil dibuat',
    data
  })
}