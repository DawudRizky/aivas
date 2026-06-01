import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createClient } from '@/lib/supabase/server'
import { getUserFromReq } from '@/lib/auth'

function sanitizeUserRow(row: any) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    last_login: row.last_login,
    is_active: row.is_active,
    vendor_id: row.vendor_id,
    vendor: row.vendor || null,
  }
}

export async function GET(req: Request) {
  const user = await getUserFromReq(req)
  if (!user) return new Response('Unauthorized', { status: 401 })
  if (!user.roles || !user.roles.includes('it')) {
    return new Response('Forbidden', { status: 403 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, role, last_login, is_active, vendor_id, vendor(id,name)')
    .order('id', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(Array.isArray(data) ? data.map(sanitizeUserRow) : [])
}

export async function POST(req: Request) {
  const user = await getUserFromReq(req)
  if (!user) return new Response('Unauthorized', { status: 401 })
  if (!user.roles || !user.roles.includes('it')) {
    return new Response('Forbidden', { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  if (!body.email || !body.password || !body.role) {
    return NextResponse.json({ error: 'email, role, dan password wajib diisi' }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(String(body.password), 10)
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('users')
    .insert([
      {
        name: body.name || null,
        email: body.email,
        role: body.role,
        password_hash: passwordHash,
        is_active: body.is_active === undefined ? true : Boolean(body.is_active),
        vendor_id: body.vendor_id ? Number(body.vendor_id) : null,
      },
    ])
    .select('id, name, email, role, last_login, is_active, vendor_id, vendor(id,name)')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ message: 'User berhasil dibuat', data: data?.map(sanitizeUserRow) || [] })
}

export async function PATCH(req: Request) {
  const user = await getUserFromReq(req)
  if (!user) return new Response('Unauthorized', { status: 401 })
  if (!user.roles || !user.roles.includes('it')) {
    return new Response('Forbidden', { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const id = Number(body.id)
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: 'id user wajib valid' }, { status: 400 })
  }

  const payload: Record<string, unknown> = {}
  if (typeof body.name === 'string') payload.name = body.name
  if (typeof body.email === 'string') payload.email = body.email
  if (typeof body.role === 'string') payload.role = body.role
  if (typeof body.is_active === 'boolean') payload.is_active = body.is_active
  if (body.vendor_id !== undefined) payload.vendor_id = body.vendor_id ? Number(body.vendor_id) : null
  if (typeof body.password === 'string' && body.password.trim()) {
    payload.password_hash = await bcrypt.hash(String(body.password), 10)
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('users')
    .update(payload)
    .eq('id', id)
    .select('id, name, email, role, last_login, is_active, vendor_id, vendor(id,name)')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ message: 'User berhasil diperbarui', data: data?.map(sanitizeUserRow) || [] })
}

export async function DELETE(req: Request) {
  const user = await getUserFromReq(req)
  if (!user) return new Response('Unauthorized', { status: 401 })
  if (!user.roles || !user.roles.includes('it')) {
    return new Response('Forbidden', { status: 403 })
  }

  const url = new URL(req.url)
  const id = Number(url.searchParams.get('id'))
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: 'id user wajib valid' }, { status: 400 })
  }

  const supabase = await createClient()
  const { error } = await supabase.from('users').delete().eq('id', id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ message: 'User berhasil dihapus' })
}
