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

  // Only supervisor can create vendors
  if (!user.roles || !user.roles.includes('supervisor')) {
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