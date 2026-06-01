import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserFromReq } from '@/lib/auth'
import { generateNextSku } from '@/lib/sku'

const sourceSelect = `
  *,
  item (
    id,
    sku,
    name,
    unit,
    description,
    unit_price,
    low_stock_threshold,
    weight,
    dimensions
  ),
  vendor (
    id,
    name,
    status
  )
`

export async function GET(req: Request) {
  const user = await getUserFromReq(req)
  if (!user) return new Response('Unauthorized', { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('item_vendor_source')
    .select(sourceSelect)
    .order('updated_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const user = await getUserFromReq(req)
  if (!user) return new Response('Unauthorized', { status: 401 })

  if (!user.roles || !(user.roles.includes('ppic') || user.roles.includes('supervisor'))) {
    return new Response('Forbidden', { status: 403 })
  }

  const body = await req.json()
  const supabase = await createClient()

  let itemId = body.item_id

  if (!itemId) {
    const itemPayload = body.item || {}
    const generatedSku = itemPayload.sku || await generateNextSku(supabase)
    const { data: createdItem, error: itemError } = await supabase
      .from('item')
      .insert([
        {
          sku: generatedSku,
          name: itemPayload.name,
          unit: itemPayload.unit,
          description: itemPayload.description,
          unit_price: itemPayload.unit_price,
          low_stock_threshold: itemPayload.low_stock_threshold ?? 10,
          weight: itemPayload.weight || null,
          dimensions: itemPayload.dimensions || null,
        }
      ])
      .select()
      .single()

    if (itemError) {
      return NextResponse.json({ error: itemError.message }, { status: 500 })
    }

    itemId = createdItem.id
  }

  const incomingSources = Array.isArray(body.sources)
    ? body.sources
    : body.source
      ? [body.source]
      : []

  if (incomingSources.length === 0) {
    return NextResponse.json({ error: 'Minimal satu vendor source wajib diisi' }, { status: 400 })
  }

  const upsertPayload = incomingSources.map((source: any) => ({
    item_id: itemId,
    vendor_id: Number(source.vendor_id),
    unit_price: Number(source.unit_price || 0),
    updated_at: new Date()
  }))

  const { error: sourceError } = await supabase
    .from('item_vendor_source')
    .upsert(upsertPayload, {
      onConflict: 'item_id,vendor_id'
    })

  if (sourceError) {
    return NextResponse.json({ error: sourceError.message }, { status: 500 })
  }

  const { data: sourceRows, error: sourceFetchError } = await supabase
    .from('item_vendor_source')
    .select(sourceSelect)
    .eq('item_id', itemId)
    .order('updated_at', { ascending: false })

  if (sourceFetchError) {
    return NextResponse.json({ error: sourceFetchError.message }, { status: 500 })
  }

  return NextResponse.json({
    message: 'Item dan vendor sources berhasil disimpan',
    data: sourceRows
  })
}

export async function PATCH(req: Request) {
  const user = await getUserFromReq(req)
  if (!user) return new Response('Unauthorized', { status: 401 })

  if (!user.roles || !(user.roles.includes('ppic') || user.roles.includes('supervisor'))) {
    return new Response('Forbidden', { status: 403 })
  }

  const body = await req.json()
  const supabase = await createClient()

  if (body.item_id && body.item) {
    const { error: itemError } = await supabase
      .from('item')
      .update({
        name: body.item.name,
        unit: body.item.unit,
        description: body.item.description,
        unit_price: body.item.unit_price,
        low_stock_threshold: body.item.low_stock_threshold ?? 10,
        weight: body.item.weight || null,
        dimensions: body.item.dimensions || null,
      })
      .eq('id', body.item_id)

    if (itemError) {
      return NextResponse.json({ error: itemError.message }, { status: 500 })
    }
  }

  if (body.item_id && Array.isArray(body.sources)) {
    const incomingSources: Array<{ item_id: number; vendor_id: number; unit_price: number; updated_at: Date }> = body.sources.map((source: any) => ({
      item_id: Number(body.item_id),
      vendor_id: Number(source.vendor_id),
      unit_price: Number(source.unit_price || 0),
      updated_at: new Date()
    }))

    const { error: sourceUpsertError } = await supabase
      .from('item_vendor_source')
      .upsert(incomingSources, { onConflict: 'item_id,vendor_id' })

    if (sourceUpsertError) {
      return NextResponse.json({ error: sourceUpsertError.message }, { status: 500 })
    }

    const vendorIds = incomingSources.map((row) => row.vendor_id)
    const deleteQuery = supabase.from('item_vendor_source').delete().eq('item_id', body.item_id)
    const { error: sourceDeleteError } = vendorIds.length > 0
      ? await deleteQuery.not('vendor_id', 'in', `(${vendorIds.join(',')})`)
      : await deleteQuery

    if (sourceDeleteError) {
      return NextResponse.json({ error: sourceDeleteError.message }, { status: 500 })
    }
  }

  const { data, error } = await supabase
    .from('item_vendor_source')
    .select(sourceSelect)
    .eq('item_id', body.item_id)
    .order('updated_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    message: 'Item dan vendor sources berhasil diperbarui',
    data
  })
}

export async function DELETE(req: Request) {
  const user = await getUserFromReq(req)
  if (!user) return new Response('Unauthorized', { status: 401 })

  if (!user.roles || !(user.roles.includes('ppic') || user.roles.includes('supervisor'))) {
    return new Response('Forbidden', { status: 403 })
  }

  const body = await req.json()
  const supabase = await createClient()

  if (body.source_id) {
    const { error } = await supabase
      .from('item_vendor_source')
      .delete()
      .eq('id', body.source_id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Vendor source berhasil dihapus' })
  }

  if (body.item_id) {
    const [poItems, doItems, qrs, inventories] = await Promise.all([
      supabase.from('purchase_order_item').select('id', { count: 'exact', head: true }).eq('item_id', body.item_id),
      supabase.from('delivery_order_item').select('id', { count: 'exact', head: true }).eq('item_id', body.item_id),
      supabase.from('qr_code').select('id', { count: 'exact', head: true }).eq('item_id', body.item_id),
      supabase.from('inventory_record').select('id', { count: 'exact', head: true }).eq('item_id', body.item_id)
    ])

    const referenceCount = Number(poItems.count || 0) + Number(doItems.count || 0) + Number(qrs.count || 0) + Number(inventories.count || 0)
    if (referenceCount > 0) {
      return NextResponse.json(
        { error: 'Item masih dipakai di transaksi atau inventory, tidak bisa dihapus' },
        { status: 409 }
      )
    }

    const { error: sourceDeleteError } = await supabase
      .from('item_vendor_source')
      .delete()
      .eq('item_id', body.item_id)

    if (sourceDeleteError) {
      return NextResponse.json({ error: sourceDeleteError.message }, { status: 500 })
    }

    const { error: itemDeleteError } = await supabase
      .from('item')
      .delete()
      .eq('id', body.item_id)

    if (itemDeleteError) {
      return NextResponse.json({ error: itemDeleteError.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Item berhasil dihapus' })
  }

  return NextResponse.json({ error: 'source_id atau item_id wajib diisi' }, { status: 400 })
}
