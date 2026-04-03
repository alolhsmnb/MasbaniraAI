import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, AuthError } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request)

    // Get fresh user data
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        dailyCredits: true,
        paidCredits: true,
        lastCreditReset: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 401 }
      )
    }

    // Check if credits need refreshing (more than 24h since last reset)
    const now = new Date()
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    let lastReset: Date | null = null

    if (user.lastCreditReset) {
      lastReset = new Date(user.lastCreditReset)
    }

    let dailyCredits = user.dailyCredits
    let paidCredits = user.paidCredits

    if (!lastReset || lastReset < twentyFourHoursAgo) {
      // Get daily free credits setting
      const setting = await db.siteSetting.findUnique({
        where: { key: 'daily_free_credits' },
      })
      const dailyFreeAmount = setting ? parseInt(setting.value, 10) : 10

      // Add daily credits on top of existing (don't replace)
      const updated = await db.user.update({
        where: { id: user.id },
        data: {
          dailyCredits: dailyFreeAmount,
          lastCreditReset: now.toISOString(),
        },
      })

      dailyCredits = updated.dailyCredits
      paidCredits = updated.paidCredits
    }

    return NextResponse.json({
      success: true,
      data: {
        dailyCredits,
        paidCredits,
        totalCredits: dailyCredits + paidCredits,
      },
    })
  } catch (error) {
    console.error('Get credits error:', error)

    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to get credits' },
      { status: 500 }
    )
  }
}
