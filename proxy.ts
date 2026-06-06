import { updateSession } from "@/lib/supabase/proxy";
import { type NextRequest, NextResponse } from "next/server";
import { getUserFromReq } from "./lib/auth";

const ROLE_FOR_PREFIX: Record<string, string> = {
  '/admin': 'admin',
  '/it': 'it',
  '/ppic': 'ppic',
  '/vendor': 'vendor',
  '/inbound': 'inbound',
  '/supervisor': 'supervisor'
}

const HOME_FOR_ROLE: Record<string, string> = {
  admin: '/admin',
  it: '/it',
  ppic: '/ppic',
  vendor: '/vendor',
  inbound: '/inbound',
  supervisor: '/supervisor'
}

export async function proxy(request: NextRequest) {
  // Enforce role-based access for protected prefixes
  try {
    const url = new URL(request.url)
    const pathname = url.pathname
    if (pathname === '/login') {
      const user = await getUserFromReq(request)
      const role = user?.roles?.find((value: string) => HOME_FOR_ROLE[value])

      if (role) {
        return NextResponse.redirect(new URL(HOME_FOR_ROLE[role], request.url))
      }
    }

    const match = Object.keys(ROLE_FOR_PREFIX).find(p => pathname === p || pathname.startsWith(p + '/'))
    if (match) {
      const user = await getUserFromReq(request)
      if (!user) {
        const loginUrl = new URL('/login', request.url)
        return NextResponse.redirect(loginUrl)
      }
      const requiredRole = ROLE_FOR_PREFIX[match]
      if (!user.roles || !user.roles.includes(requiredRole)) {
        return new Response('Forbidden', { status: 403 })
      }
    }
  } catch {
    return new Response('Forbidden', { status: 403 })
  }

  // continue existing proxy/session behavior
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
