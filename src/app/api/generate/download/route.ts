import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'

/**
 * Download proxy endpoint
 * Fetches the image/video from the external URL and serves it with
 * Content-Disposition: attachment to force browser download
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth(request)

    const { searchParams } = new URL(request.url)
    const url = searchParams.get('url')
    const filename = searchParams.get('filename') || `pixelforge-${Date.now()}.png`

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      )
    }

    // Validate URL
    try {
      new URL(url)
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid URL' },
        { status: 400 }
      )
    }

    // Fetch the file from external URL
    const response = await fetch(url, {
      redirect: 'follow',
    })

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: `Failed to fetch file (${response.status})` },
        { status: 502 }
      )
    }

    // Get content type
    const contentType = response.headers.get('content-type') || 'application/octet-stream'

    // Get file buffer
    const buffer = await response.arrayBuffer()

    // Return with Content-Disposition to force download
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.byteLength.toString(),
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      )
    }

    console.error('[Download] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to download file' },
      { status: 500 }
    )
  }
}
