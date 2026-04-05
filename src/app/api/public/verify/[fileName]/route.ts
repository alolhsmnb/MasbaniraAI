import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// This route serves verification files from the database
// Files are accessible at /api/public/verify/<filename>
// e.g. /api/public/verify/zerads.txt -> serves zerads.txt content

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileName: string }> }
) {
  try {
    const { fileName } = await params

    // Security: only allow safe filenames
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '')
    if (!safeName || safeName !== fileName) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
    }

    const file = await db.verificationFile.findUnique({
      where: { fileName: safeName },
    })

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Determine content type based on extension
    const ext = safeName.split('.').pop()?.toLowerCase() || ''
    const contentTypes: Record<string, string> = {
      txt: 'text/plain',
      html: 'text/html',
      xml: 'application/xml',
      json: 'application/json',
    }
    const contentType = contentTypes[ext] || 'text/plain'

    return new NextResponse(file.content, {
      status: 200,
      headers: {
        'Content-Type': `${contentType}; charset=utf-8`,
        'Cache-Control': 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('Serve verify file error:', error)
    return NextResponse.json({ error: 'Failed to serve file' }, { status: 500 })
  }
}
