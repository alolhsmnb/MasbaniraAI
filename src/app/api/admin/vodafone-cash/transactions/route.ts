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

    if (action === 'create') {
      // Manually create a new transaction (for when SMS is not received)
      const { fromNumber, amount, senderName, trxId: customTrxId, targetUserId, targetCredits } = await request.json()

      if (!fromNumber || !amount) {
        return NextResponse.json(
          { success: false, error: 'Phone number and amount are required' },
          { status: 400 }
        )
      }

      // Check for duplicate trxId
      const trxIdValue = customTrxId || `manual_${Date.now()}`
      const existingTrx = await db.vodafoneCashTransaction.findUnique({
        where: { trxId: trxIdValue },
      })
      if (existingTrx) {
        return NextResponse.json({ success: false, error: 'Transaction ID already exists' }, { status: 409 })
      }

      // Get settings
      const creditsPerEgpSetting = await db.siteSetting.findUnique({ where: { key: 'vodafone_credits_per_egp' } })
      const creditsPerEgp = parseFloat(creditsPerEgpSetting?.value || '1')

      const creditsToAdd = targetCredits || Math.max(1, Math.round(parseFloat(amount) * creditsPerEgp))

      // If targetUserId is provided, directly complete the transaction
      if (targetUserId) {
        const targetUser = await db.user.findUnique({ where: { id: targetUserId } })
        if (!targetUser) {
          return NextResponse.json({ success: false, error: 'Target user not found' }, { status: 404 })
        }

        const [updatedUser] = await db.$transaction([
          db.user.update({
            where: { id: targetUserId },
            data: { paidCredits: { increment: creditsToAdd } },
          }),
          db.vodafoneCashTransaction.create({
            data: {
              trxId: trxIdValue,
              sender: senderName || fromNumber,
              message: 'Manual transaction created by admin',
              fromNumber: String(fromNumber).replace(/^(\+20|02|20)/, '').trim(),
              amountEGP: parseFloat(amount),
              creditsAdded: creditsToAdd,
              status: 'COMPLETED',
              userId: targetUserId,
              processedAt: new Date(),
            },
          }),
        ])

        return NextResponse.json({
          success: true,
          message: `Manual transaction created: ${creditsToAdd} credits added to ${targetUser.email}`,
          data: { newPaidCredits: updatedUser.paidCredits },
        })
      }

      // No target user - create as RECEIVED
      const transaction = await db.vodafoneCashTransaction.create({
        data: {
          trxId: trxIdValue,
          sender: senderName || fromNumber,
          message: 'Manual transaction created by admin',
          fromNumber: String(fromNumber).replace(/^(\+20|02|20)/, '').trim(),
          amountEGP: parseFloat(amount),
          status: 'RECEIVED',
        },
      })

      // Try to auto-match by phone number
      const normalizedNumber = String(fromNumber).replace(/^(\+20|02|20)/, '').trim()
      const matchedUser = await db.user.findUnique({ where: { vodafoneCashNumber: normalizedNumber } })

      if (matchedUser && !matchedUser.isBanned) {
        const [updatedUser] = await db.$transaction([
          db.user.update({
            where: { id: matchedUser.id },
            data: { paidCredits: { increment: creditsToAdd } },
          }),
          db.vodafoneCashTransaction.update({
            where: { id: transaction.id },
            data: {
              userId: matchedUser.id,
              creditsAdded: creditsToAdd,
              status: 'COMPLETED',
              processedAt: new Date(),
            },
          }),
        ])

        return NextResponse.json({
          success: true,
          message: `Transaction auto-matched: ${creditsToAdd} credits added to ${matchedUser.email}`,
          data: { newPaidCredits: updatedUser.paidCredits },
        })
      }

      return NextResponse.json({
        success: true,
        message: 'Transaction created (no matching user found)',
        data: { trxId: trxIdValue, status: 'RECEIVED' },
      })
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('[VodafoneCash Admin] Error processing action:', error)
    return NextResponse.json({ success: false, error: 'Failed to process action' }, { status: 500 })
  }
}
