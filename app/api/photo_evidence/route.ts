// app/api/photo-evidence/route.ts

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserFromReq } from '@/lib/auth'

const STORAGE_BUCKET = 'inbound-evidence'

export async function GET(req: Request) {
  const user = await getUserFromReq(req)
  if (!user) return new Response('Unauthorized', { status: 401 })

  // Only inbound or supervisor can upload photo evidence
  if (!user.roles || !(user.roles.includes('inbound') || user.roles.includes('supervisor') || user.roles.includes('admin'))) {
    return new Response('Forbidden', { status: 403 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('photo_evidence')
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

  const rows = Array.isArray(data) ? data : []
  const withSignedUrls = await Promise.all(rows.map(async (row: any) => {
    const rawUrl = String(row?.url || '')
    if (!rawUrl) return { ...row, signed_url: null }
    if (rawUrl.startsWith('http')) return { ...row, signed_url: rawUrl }

    const { data: signedData, error: signedError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(rawUrl, 60 * 60)

    if (signedError) {
      return { ...row, signed_url: null }
    }
    return { ...row, signed_url: signedData?.signedUrl || null }
  }))

  return NextResponse.json(withSignedUrls)
}

export async function POST(req: Request) {
  const user = await getUserFromReq(req)
  if (!user) return new Response('Unauthorized', { status: 401 })

  const body = await req.json()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('photo_evidence')
    .insert([
      {
        inbound_scan_id: body.inbound_scan_id,
        url: body.url,
        timestamp: new Date(),
        mime_type: body.mime_type,
        thumbnail_url: body.thumbnail_url
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
    message: 'Photo Evidence berhasil dibuat',
    data
  })
}
