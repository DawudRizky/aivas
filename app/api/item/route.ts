// app/api/item/route.ts

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserFromReq } from '@/lib/auth'

export async function GET(req: Request) {
  const user = await getUserFromReq(req)
  if (!user) return new Response('Unauthorized', { status: 401 })
  // Public listing removed — require authentication to fetch items
  // (defense-in-depth: middleware will already block route prefixes)
  const supabase = await createClient()
  const { data, error } = await supabase.from('item').select('*')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(req: Request) {
  try {
    const user = await getUserFromReq(req)
    if (!user) return new Response('Unauthorized', { status: 401 })

    // Only ppic or supervisor can create items
    if (!user.roles || !(user.roles.includes('ppic') || user.roles.includes('supervisor'))) {
      return new Response('Forbidden', { status: 403 })
    }

    const body = await req.json()
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('item')
      .insert([
        {
          sku: body.sku,
          name: body.name,
          unit: body.unit,
          description: body.description,
          unit_price: body.unit_price,
          weight: body.weight,
          dimensions: body.dimensions,
          category: body.category
        }
      ])
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Item berhasil dibuat', data })
  } catch (err) {
    return new Response('Forbidden', { status: 403 })
  }
}