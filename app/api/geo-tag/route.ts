// app/api/geo-tag/route.ts

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserFromReq } from '@/lib/auth'

export async function GET(req: Request) {
  const user = await getUserFromReq(req)
  if (!user) return new Response('Unauthorized', { status: 401 })

  // Only inbound or supervisor can post geo tags
  if (!user.roles || !(user.roles.includes('inbound') || user.roles.includes('supervisor'))) {
    return new Response('Forbidden', { status: 403 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('geo_tag')
    .select(`
      *,
      inbound_scan (
        id,
        qty_actual,
        status
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
    .from('geo_tag')
    .insert([
      {
        inbound_scan_id: body.inbound_scan_id,
        latitude: body.latitude,
        longitude: body.longitude,
        timestamp: new Date(),
        accuracy: body.accuracy
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
    message: 'Geo Tag berhasil dibuat',
    data
  })
}