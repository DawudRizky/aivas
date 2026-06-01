import { NextResponse } from 'next/server'
// import { supabase } from '../../../lib/supabase'
import { createClient } from '@/lib/supabase/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    // console.log('LOGIN REQ BODY:', { body }) // temp log to check request body
    const { email, password } = body
    // console.log('LOOKUP EMAIL:', email) // temp log to check email being looked up
    if (!email || !password) {
      return NextResponse.json(
        {
          error: 'Email dan password wajib diisi'
        },
        {
          status: 400
        }
      )
    }

    const supabase = await createClient()
    // const debugRes = await supabase
    //   .from('users')
    //   .select('id,email,password_hash')
    //   .eq('email', email)
    //   .maybeSingle();
    // console.log('SUPABASE DEBUG:', JSON.stringify(debugRes, null, 2));
    // console.log('SUPABASE_URL env:', process.env.NEXT_PUBLIC_SUPABASE_URL);

    const { data: user, error } = await supabase
      .from('users')
      .select('*, vendor(id,name)')
      .eq('email', email)
      .single()

    if (error || !user) {
      return NextResponse.json(
        {
          error: 'User tidak ditemukan'
        },
        {
          status: 404
        }
      )
    }

    const isValidPassword = await bcrypt.compare(
      password,
      user.password_hash
    )

    if (!isValidPassword) {
      return NextResponse.json(
        {
          error: 'Password salah'
        },
        {
          status: 401
        }
      )
    }

    if (user.role === 'vendor' && (!user.vendor_id || !user.vendor)) {
      return NextResponse.json(
        {
          error: 'Akun vendor harus terhubung ke vendor_id'
        },
        {
          status: 403
        }
      )
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        vendor_id: user.vendor_id ?? null
      },
      process.env.JWT_SECRET!,
      {
        expiresIn: '1d'
      }
    )

    await supabase
      .from('users')
      .update({
        last_login: new Date()
      })
      .eq('id', user.id)

    const response = NextResponse.json({
      message: 'Login berhasil',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        vendor_id: user.vendor_id ?? null,
        vendor: user.vendor ?? null
      }
    })

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24,
      path: '/'
    })

    return response
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Terjadi kesalahan pada server'
      },
      {
        status: 500
      }
    )
  }
}