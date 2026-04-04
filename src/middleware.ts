import { NextRequest, NextResponse } from 'next/server'

/**
 * Middleware: Serves verification files from database at root URL
 * 
 * When ad companies request: https://yourdomain.com/zerads.txt
 * It internally rewrites to: /api/public/verify/zerads.txt
 * The URL stays as /zerads.txt in the browser (no redirect)
 */

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only intercept root-level files with verification extensions
  const segments = pathname.split('/').filter(Boolean)
  const isRootLevel = segments.length === 1

  if (!isRootLevel) return NextResponse.next()

  const fileName = segments[0]
  const ext = fileName.split('.').pop()?.toLowerCase() || ''

  // Only handle known verification file extensions
  if (!['txt', 'html', 'xml', 'json'].includes(ext)) {
    return NextResponse.next()
  }

  // Rewrite to API route (internal rewrite, URL stays the same)
  const rewriteUrl = request.nextUrl.clone()
  rewriteUrl.pathname = `/api/public/verify/${fileName}`
  return NextResponse.rewrite(rewriteUrl)
}

// Only match root-level files with these extensions
export const config = {
  matcher: [
    '/:fileName(txt)',
    '/:fileName(html)',
    '/:fileName(xml)',
    '/:fileName(json)',
  ],
}
