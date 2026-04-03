import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function getBaseUrl(request: NextRequest): string {
  // request.url contains the full URL as received by the server
  // This is the most reliable way to get the actual domain
  try {
    const url = new URL(request.url)
    // url.host = hostname:port, url.hostname = just hostname
    return `${url.protocol}//${url.hostname}`
  } catch {
    // Fallback to NEXTAUTH_URL
    return process.env.NEXTAUTH_URL || 'https://localhost'
  }
}

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID
    if (!clientId) {
      return NextResponse.json(
        { success: false, error: 'Google OAuth is not configured.' },
        { status: 500 }
      )
    }

    const baseUrl = getBaseUrl(request)
    const redirectUri = `${baseUrl}/api/auth/google/callback`

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
    })

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`

    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error('Google OAuth redirect error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to initiate Google OAuth' },
      { status: 500 }
    )
  }
}
