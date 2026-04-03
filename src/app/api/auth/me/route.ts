import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    console.log('[/api/auth/me] session:', session ? 'found' : 'null')

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch fresh user data from DB
    const { db } = await import('@/lib/db')
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        dailyCredits: true,
        paidCredits: true,
        isBanned: true,
        createdAt: true,
      },
    })

    console.log('[/api/auth/me] user:', user ? user.email : 'not found')

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      success: true,
      data: user,
    })
  } catch (error) {
    console.error('[/api/auth/me] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get session' },
      { status: 500 }
    )
  }
}
