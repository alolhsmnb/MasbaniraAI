import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  
  return NextResponse.json({
    request_url: request.url,
    protocol: url.protocol,
    hostname: url.hostname,
    host: url.host,
    port: url.port,
    origin: url.origin,
    finalRedirectUri: `${url.protocol}//${url.hostname}/api/auth/google/callback`,
    allHeaders: Object.fromEntries(request.headers.entries()),
  })
}
