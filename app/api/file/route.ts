import { NextResponse } from 'next/server'
import fs from 'fs'
import mime from 'mime'
import { safeResolve } from '@/lib/safePath'

// Secure file download example:
// GET /api/file?name=report.pdf
// Files must live in public/downloads and are resolved via safeResolve

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const name = url.searchParams.get('name')
    if (!name) return new Response('Missing file name', { status: 400 })

    const base = process.cwd() + '/public/downloads'
    let filePath: string
    try {
      filePath = safeResolve(base, name)
    } catch (err) {
      return new Response('Invalid file path', { status: 400 })
    }

    if (!fs.existsSync(filePath)) return new Response('Not found', { status: 404 })

    const file = fs.readFileSync(filePath)
    const type = mime.getType(filePath) || 'application/octet-stream'

    return new Response(file, {
      status: 200,
      headers: {
        'Content-Type': type,
        'Content-Length': String(file.length),
        'Content-Disposition': `attachment; filename="${encodeURIComponent(name)}"`
      }
    })
  } catch (err) {
    return new Response('Server error', { status: 500 })
  }
}
