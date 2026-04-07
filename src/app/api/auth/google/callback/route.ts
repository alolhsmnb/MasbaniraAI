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
    throw new Error('Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.')
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
    throw new Error(`Failed to exchange code for tokens: ${response.status}`)
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

  // Check if last reset was more than 24 hours ago
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  if (!lastReset || lastReset < twentyFourHoursAgo) {
    // Get daily free credits setting
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
    // state contains the origin URL passed by the client
    const state = searchParams.get('state')

    // Use state (origin from client) to build redirect_uri
    const origin = state && state.startsWith('http') ? state : (process.env.NEXTAUTH_URL || 'https://localhost')
    const redirectUri = `${origin}/api/auth/google/callback`

    if (error) {
      console.error('Google OAuth error:', error)
      return NextResponse.redirect(`${origin}/?error=${encodeURIComponent(error)}`)
    }

    if (!code) {
      return NextResponse.redirect(`${origin}/?error=no_code`)
    }

    // Exchange code for tokens using the dynamic redirect URI
    const tokens = await exchangeCodeForTokens(code, redirectUri)

    // Get user info
    const userInfo = await getGoogleUserInfo(tokens.access_token)

    if (!userInfo.email || !userInfo.verified_email) {
      return NextResponse.redirect(`${origin}/?error=unverified_email`)
    }

    // Create or update user in DB
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
      // Check if this user should be admin
      const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL
      const role = adminEmail && adminEmail.toLowerCase() === userInfo.email.toLowerCase()
        ? 'ADMIN'
        : 'USER'

      // Get daily free credits for new user welcome bonus
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

    // Check and refresh credits for existing users
    if (existingUser) {
      await checkAndRefreshCredits(user)
    }

    // Create session cookie directly on this response (no intermediate page)
    const setCookie = await createSession({
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      role: user.role,
    })

    console.log(`[Google OAuth] User logged in: ${user.email} (role: ${user.role})`)

    // Redirect to home with session cookie set directly
    return NextResponse.redirect(`${origin}/`, {
      headers: {
        'Set-Cookie': setCookie,
      },
    })
  } catch (error) {
    console.error('Google OAuth callback error:', error)
    const fallback = process.env.NEXTAUTH_URL || 'https://localhost'
    return NextResponse.redirect(
      `${fallback}/?error=${encodeURIComponent(error instanceof Error ? error.message : 'Authentication failed')}`
    )
  }
}
