import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { safeResolve } from '@/lib/safePath'

function getContentType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.pdf') return 'application/pdf'
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.gif') return 'image/gif'
  if (ext === '.txt') return 'text/plain; charset=utf-8'
  if (ext === '.json') return 'application/json; charset=utf-8'
  return 'application/octet-stream'
}

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
    const type = getContentType(filePath)

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
