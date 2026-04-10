import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { role: true },
    })

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status') || ''
    const search = searchParams.get('search') || ''

    const skip = (page - 1) * limit

    const where: Record<string, any> = {}
    if (status && status !== 'ALL') {
      where.status = status
    }
    if (search) {
      where.OR = [
        { fromNumber: { contains: search } },
        { trxId: { contains: search } },
        { user: { email: { contains: search } } },
        { user: { name: { contains: search } } },
      ]
    }

    const [transactions, total] = await Promise.all([
      db.vodafoneCashTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              avatar: true,
            },
          },
        },
      }),
      db.vodafoneCashTransaction.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        items: transactions,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('[VodafoneCash Admin] Error fetching transactions:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch transactions' }, { status: 500 })
  }
}

// Admin can manually assign a transaction to a user or add credits
export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const admin = await db.user.findUnique({
      where: { id: session.userId },
      select: { role: true },
    })

    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { transactionId, action, userId, credits } = await request.json()

    if (!transactionId || !action) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    const transaction = await db.vodafoneCashTransaction.findUnique({
      where: { id: transactionId },
    })

    if (!transaction) {
      return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 })
    }

    if (action === 'assign') {
      // Manually assign transaction to a user and add credits
      if (!userId || !credits) {
        return NextResponse.json(
          { success: false, error: 'userId and credits are required for manual assignment' },
          { status: 400 }
        )
      }

      const targetUser = await db.user.findUnique({
        where: { id: userId },
      })

      if (!targetUser) {
        return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
      }

      const creditsToAdd = Math.max(1, parseInt(credits))

      const [updatedUser] = await db.$transaction([
        db.user.update({
          where: { id: userId },
          data: { paidCredits: { increment: creditsToAdd } },
        }),
        db.vodafoneCashTransaction.update({
          where: { id: transactionId },
          data: {
            userId,
            creditsAdded: creditsToAdd,
            status: 'COMPLETED',
            processedAt: new Date(),
          },
        }),
      ])

      return NextResponse.json({
        success: true,
        message: `Transaction assigned and ${creditsToAdd} credits added to ${targetUser.email}`,
        data: { newPaidCredits: updatedUser.paidCredits },
      })
    }

    if (action === 'reject') {
      await db.vodafoneCashTransaction.update({
        where: { id: transactionId },
        data: { status: 'REJECTED', processedAt: new Date() },
      })

      return NextResponse.json({
        success: true,
        message: 'Transaction rejected',
      })
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('[VodafoneCash Admin] Error processing action:', error)
    return NextResponse.json({ success: false, error: 'Failed to process action' }, { status: 500 })
  }
}
