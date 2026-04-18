import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createSession } from '@/lib/auth'

// Prevent Next.js caching for this dynamic route
export const dynamic = 'force-dynamic'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'

async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<{
  access_token: string
  id_token: string
  expires_in: number
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth is not configured.')
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    console.error('Token exchange error:', errorData)
    throw new Error(`Failed to exchange code: ${response.status}`)
  }

  return response.json()
}

async function getGoogleUserInfo(accessToken: string): Promise<{
  id: string
  email: string
  name: string
  picture: string
  verified_email: boolean
}> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch user info: ${response.status}`)
  }

  return response.json()
}

async function checkAndRefreshCredits(user: {
  id: string
  dailyCredits: number
  paidCredits: number
  lastCreditReset: string
}): Promise<{ dailyCredits: number; paidCredits: number }> {
  const now = new Date()
  let lastReset: Date | null = null

  if (user.lastCreditReset) {
    lastReset = new Date(user.lastCreditReset)
  }

  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  if (!lastReset || lastReset < twentyFourHoursAgo) {
    const setting = await db.siteSetting.findUnique({
      where: { key: 'daily_free_credits' },
    })
    const dailyCredits = setting ? parseInt(setting.value, 10) : 10

    const updated = await db.user.update({
      where: { id: user.id },
      data: {
        dailyCredits: dailyCredits,
        lastCreditReset: now.toISOString(),
      },
    })

    return { dailyCredits: updated.dailyCredits, paidCredits: updated.paidCredits }
  }

  return { dailyCredits: user.dailyCredits, paidCredits: user.paidCredits }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const state = searchParams.get('state')

    const origin = state && state.startsWith('http') ? state.split('|')[0] : (process.env.NEXTAUTH_URL || '/')
    // Extract return URL from state (format: "origin|/path?query#hash")
    let returnTo = '/'
    if (state && state.includes('|')) {
      const parts = state.split('|')
      if (parts[1]) returnTo = parts[1]
    }
    const redirectUri = `${origin}/api/auth/google/callback`

    if (error) {
      console.error('Google OAuth error:', error)
      return NextResponse.redirect(`${origin}/?error=${encodeURIComponent(error)}`)
    }

    if (!code) {
      return NextResponse.redirect(`${origin}/?error=no_code`)
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code, redirectUri)

    // Get user info
    const userInfo = await getGoogleUserInfo(tokens.access_token)

    if (!userInfo.email || !userInfo.verified_email) {
      return NextResponse.redirect(`${origin}/?error=unverified_email`)
    }

    // Create or update user
    const existingUser = await db.user.findUnique({
      where: { email: userInfo.email },
    })

    let user

    if (existingUser) {
      user = await db.user.update({
        where: { id: existingUser.id },
        data: {
          name: userInfo.name || existingUser.name,
          avatar: userInfo.picture || existingUser.avatar,
          updatedAt: new Date(),
        },
      })
    } else {
      const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL
      const role = adminEmail && adminEmail.toLowerCase() === userInfo.email.toLowerCase()
        ? 'ADMIN'
        : 'USER'

      const setting = await db.siteSetting.findUnique({
        where: { key: 'daily_free_credits' },
      })
      const initialCredits = setting ? parseInt(setting.value, 10) : 10

      user = await db.user.create({
        data: {
          email: userInfo.email,
          name: userInfo.name,
          avatar: userInfo.picture,
          role,
          dailyCredits: initialCredits,
          paidCredits: 0,
          lastCreditReset: new Date().toISOString(),
        },
      })
    }

    if (existingUser) {
      await checkAndRefreshCredits(user)
    }

    // Generate temp token and store user data
    const crypto = await import('crypto')
    const tempToken = crypto.randomBytes(24).toString('hex')

    try {
      await db.siteSetting.create({
        data: {
          key: `temp_auth_${tempToken}`,
          value: JSON.stringify({
            id: user.id,
            email: user.email,
            name: user.name,
            avatar: user.avatar,
            role: user.role,
          }),
        },
      })
    } catch {
      await db.siteSetting.delete({ where: { key: `temp_auth_${tempToken}` } }).catch(() => {})
      await db.siteSetting.create({
        data: {
          key: `temp_auth_${tempToken}`,
          value: JSON.stringify({
            id: user.id,
            email: user.email,
            name: user.name,
            avatar: user.avatar,
            role: user.role,
          }),
        },
      })
    }

    console.log(`[Google OAuth] User logged in: ${user.email} (role: ${user.role})`)

    // Return HTML page that calls set-session with ABSOLUTE URL then redirects
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Signing in...</title></head><body>
<script>
(function(){
  fetch('${origin}/api/auth/set-session',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    credentials:'same-origin',
    body:JSON.stringify({tempToken:'${tempToken}'})
  }).then(function(r){return r.json()}).then(function(d){
    if(d.success){
      window.location.replace('${origin}${returnTo}');
    }else{
      console.error('set-session failed:',d.error);
      window.location.replace('${origin}/?error=session_failed');
    }
  }).catch(function(e){
    console.error('set-session error:',e);
    window.location.replace('${origin}/?error=session_error');
  });
})();
</script>
<noscript><meta http-equiv="refresh" content="0;url=${origin}${returnTo}"></noscript>
</body></html>`

    return new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (error) {
    console.error('Google OAuth callback error:', error)
    const fallback = process.env.NEXTAUTH_URL || '/'
    return NextResponse.redirect(
      `${fallback}/?error=${encodeURIComponent(error instanceof Error ? error.message : 'Authentication failed')}`
    )
  }
}
