import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createSession } from '@/lib/auth'

/**
 * POST /api/auth/email
 *
 * Email-based login (no password required for demo/dev).
 * Creates a new user if not exists, or logs in existing user.
 *
 * Body:
 *   - email (required): User email
 *   - name (optional): Display name (used only for new users)
 *
 * Returns:
 *   - success: boolean
 *   - user: { email, name, role, dailyCredits, paidCredits }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, name } = body || {}

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'A valid email address is required' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.trim().toLowerCase()

    // Find or create user
    const existingUser = await db.user.findUnique({
      where: { email: normalizedEmail },
    })

    let user

    if (existingUser) {
      // Update name if provided and empty
      if (name && !existingUser.name) {
        user = await db.user.update({
          where: { id: existingUser.id },
          data: { name: name.trim() },
        })
      } else {
        user = existingUser
      }

      // Check if user is banned
      if (user.isBanned) {
        return NextResponse.json(
          { success: false, error: 'This account has been suspended' },
          { status: 403 }
        )
      }

      // Refresh daily credits if needed
      const now = new Date()
      const lastReset = user.lastCreditReset ? new Date(user.lastCreditReset) : null
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

      if (!lastReset || lastReset < twentyFourHoursAgo) {
        const setting = await db.siteSetting.findUnique({
          where: { key: 'daily_free_credits' },
        })
        const dailyCredits = setting ? parseInt(setting.value, 10) : 10

        user = await db.user.update({
          where: { id: user.id },
          data: {
            dailyCredits: dailyCredits,
            lastCreditReset: now.toISOString(),
          },
        })
      }
    } else {
      // Check if this user should be admin
      const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL
      const role = adminEmail && adminEmail.toLowerCase() === normalizedEmail
        ? 'ADMIN'
        : 'USER'

      user = await db.user.create({
        data: {
          email: normalizedEmail,
          name: name?.trim() || normalizedEmail.split('@')[0],
          role,
          dailyCredits: 0,
          paidCredits: 0,
          lastCreditReset: new Date().toISOString(),
        },
      })
    }

    // Create session
    const setCookie = await createSession({
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      role: user.role,
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          email: user.email,
          name: user.name,
          role: user.role,
          dailyCredits: user.dailyCredits,
          paidCredits: user.paidCredits,
        },
      },
      {
        headers: { 'Set-Cookie': setCookie },
      }
    )
  } catch (error) {
    console.error('Email login error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to sign in. Please try again.' },
      { status: 500 }
    )
  }
}
