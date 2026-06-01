import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserFromReq } from '@/lib/auth'

export async function GET(req: Request) {
  try {
    const payload: any = await getUserFromReq(req)
    if (!payload) return NextResponse.json({ user: null })

    const supabase = await createClient()
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, role, vendor_id, vendor(id,name)')
      .eq('id', payload.id)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ user })
  } catch (err) {
    return NextResponse.json({ user: null })
  }
}
