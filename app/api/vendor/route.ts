import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserFromReq } from '@/lib/auth'

export async function GET(req: Request) {
  const user = await getUserFromReq(req)
  if (!user) return new Response('Unauthorized', { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vendor')
    .select('*')

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

  // Only IT can create vendors
  if (!user.roles || !user.roles.includes('it')) {
    return new Response('Forbidden', { status: 403 })
  }

  const body = await req.json()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vendor')
    .insert([
      {
        name: body.name,
        contact_info: body.contact_info,
        address: body.address,
        phone: body.phone,
        status: body.status || 'active'
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
    message: 'Vendor berhasil dibuat',
    data
  })
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
    return NextResponse.json({ error: 'id vendor wajib valid' }, { status: 400 })
  }

  const payload: Record<string, unknown> = {}
  if (typeof body.name === 'string') payload.name = body.name
  if (typeof body.contact_info === 'string') payload.contact_info = body.contact_info
  if (typeof body.address === 'string') payload.address = body.address
  if (typeof body.phone === 'string') payload.phone = body.phone
  if (typeof body.status === 'string') payload.status = body.status

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vendor')
    .update(payload)
    .eq('id', id)
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ message: 'Vendor berhasil diperbarui', data })
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
    return NextResponse.json({ error: 'id vendor wajib valid' }, { status: 400 })
  }

  const supabase = await createClient()
  const { error } = await supabase.from('vendor').delete().eq('id', id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ message: 'Vendor berhasil dihapus' })
}
