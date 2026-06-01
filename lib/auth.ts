import jwt from 'jsonwebtoken'
import { createClient } from '@/lib/supabase/server'

const JWT_SECRET = process.env.JWT_SECRET || 'replace_this_with_env_secret'

type UserPayload = {
  id: string
  roles?: string[]
  [key: string]: any
}

export function verifyAccessToken(token?: string): UserPayload | null {
  if (!token) return null
  try {
    const payloadRaw = jwt.verify(token, JWT_SECRET) as any

    // Normalize role -> roles array for compatibility with existing token shape
    if (payloadRaw && !payloadRaw.roles && payloadRaw.role) {
      payloadRaw.roles = Array.isArray(payloadRaw.role) ? payloadRaw.role : [payloadRaw.role]
    }

    const payload = payloadRaw as UserPayload
    return payload
  } catch (e) {
    return null
  }
}

function parseCookies(cookieHeader?: string | null): Record<string, string> {
  const out: Record<string, string> = {}
  if (!cookieHeader) return out
  for (const part of cookieHeader.split(';')) {
    const [k, ...v] = part.trim().split('=')
    out[k] = decodeURIComponent(v.join('='))
  }
  return out
}

export async function getUserFromReq(req: Request | any) {
  // Try Authorization header
  const authHeader = req.headers?.get?.('authorization') || req.headers?.authorization || null
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    return verifyAccessToken(token)
  }

  // Try cookie header
  const cookieHeader = req.headers?.get?.('cookie') || req.headers?.cookie || null
  const cookies = parseCookies(cookieHeader)
  const token = cookies['access_token'] || cookies['token'] || null
  return verifyAccessToken(token ?? undefined)
}

export async function getAuthenticatedUser(req: Request | any) {
  const payload = await getUserFromReq(req)
  if (!payload) return null

  try {
    const supabase = await createClient()
    const { data: user } = await supabase
      .from('users')
      .select('id, name, email, role, vendor_id, vendor(id,name)')
      .eq('id', payload.id)
      .maybeSingle()

    if (!user) {
      return payload
    }

    return {
      ...payload,
      ...user,
      roles: payload.roles || (payload.role ? [payload.role] : user.role ? [user.role] : [])
    }
  } catch (error) {
    return payload
  }
}

export function requireAuth(user: UserPayload | null) {
  if (!user) {
    const err: any = new Error('Unauthorized')
    err.status = 401
    throw err
  }
}

export function requireRole(user: UserPayload | null, role: string) {
  requireAuth(user)
  if (!user?.roles || !user.roles.includes(role)) {
    const err: any = new Error('Forbidden')
    err.status = 403
    throw err
  }
}

export default { verifyAccessToken, getUserFromReq, getAuthenticatedUser, requireAuth, requireRole }
