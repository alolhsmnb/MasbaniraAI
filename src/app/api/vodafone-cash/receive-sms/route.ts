import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Simple in-memory rate limiter to prevent spam
const recentTrx = new Map<string, number>()
const RATE_LIMIT_MS = 60000 // 1 minute

interface SmsPayload {
  sender: string
  message: string
  amount: number
  trx_id: string
  from_number: string
  received_at: string
}

export async function POST(request: NextRequest) {
  // Log every request immediately for debugging
  console.log('[VodafoneCash] 📩 Received webhook request')

  try {
    const body: SmsPayload = await request.json()
    const { sender, message, amount, trx_id, from_number } = body

    console.log(`[VodafoneCash] Payload: sender=${sender}, from=${from_number}, amount=${amount}, trxId=${trx_id}`)

    // Validate required fields
    if (!trx_id || !from_number || !amount || !sender) {
      console.log('[VodafoneCash] ❌ Missing required fields')
      return NextResponse.json(
        { success: false, error: 'Missing required fields', details: { trx_id, from_number, amount, sender } },
        { status: 400 }
      )
    }

    // Rate limit: prevent duplicate rapid-fire requests
    const now = Date.now()
    const lastProcessed = recentTrx.get(trx_id)
    if (lastProcessed && (now - lastProcessed) < RATE_LIMIT_MS) {
      console.log(`[VodafoneCash] ⏱ Rate limited for trxId: ${trx_id}`)
      return NextResponse.json({
        success: true,
        message: 'Transaction already being processed',
        data: { trxId: trx_id, status: 'DUPLICATE_RATE_LIMIT' },
      })
    }
    recentTrx.set(trx_id, now)

    // Clean old entries (keep last 10 minutes)
    for (const [key, time] of recentTrx.entries()) {
      if (now - time > 600000) recentTrx.delete(key)
    }

    // Normalize the phone number (remove leading +20 or 02 or 20, keep 11 digits)
    const normalizedNumber = from_number.replace(/^(\+20|02|20)/, '').trim()
    console.log(`[VodafoneCash] Normalized number: ${normalizedNumber}`)

    // Check for duplicate transaction
    const existing = await db.vodafoneCashTransaction.findUnique({
      where: { trxId: trx_id },
    })

    if (existing) {
      console.log(`[VodafoneCash] ✅ Duplicate: trxId=${trx_id} already exists with status=${existing.status}`)
      return NextResponse.json({
        success: true,
        message: 'Transaction already processed',
        data: { trxId: trx_id, status: existing.status },
      })
    }

    // Get settings in a single query (optimized)
    const settings = await db.siteSetting.findMany({
      where: {
        key: {
          in: ['vodafone_merchant_number', 'vodafone_credits_per_egp', 'vodafone_webhook_secret', 'vodafone_min_amount_egp'],
        },
      },
    })

    const settingsMap: Record<string, string> = {}
    settings.forEach((s) => { settingsMap[s.key] = s.value })

    const creditsPerEgp = parseFloat(settingsMap.vodafone_credits_per_egp || '1')
    const webhookSecret = settingsMap.vodafone_webhook_secret || ''
    const minAmountEGP = parseFloat(settingsMap.vodafone_min_amount_egp || '0')

    // Check minimum amount (0 means no minimum)
    if (minAmountEGP > 0 && amount < minAmountEGP) {
      // Still record the transaction as rejected so admin can see it
      await db.vodafoneCashTransaction.create({
        data: {
          trxId: trx_id,
          sender: sender,
          message: message || '',
          fromNumber: normalizedNumber,
          amountEGP: amount,
          rawSms: JSON.stringify(body),
          status: 'REJECTED',
        },
      })
      console.log(`[VodafoneCash] 🚫 Amount ${amount} EGP below minimum ${minAmountEGP} EGP`)
      return NextResponse.json({
        success: true,
        message: `Amount ${amount} EGP is below minimum ${minAmountEGP} EGP`,
        data: { trxId: trx_id, status: 'REJECTED', reason: 'below_minimum' },
      })
    }

    // Verify webhook secret if configured
    if (webhookSecret) {
      const authHeader = request.headers.get('authorization')
      if (authHeader !== `Bearer ${webhookSecret}`) {
        console.log('[VodafoneCash] ❌ Webhook auth failed - secret mismatch')
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        )
      }
    }

    // Create transaction record immediately
    const transaction = await db.vodafoneCashTransaction.create({
      data: {
        trxId: trx_id,
        sender: sender,
        message: message || '',
        fromNumber: normalizedNumber,
        amountEGP: amount,
        rawSms: JSON.stringify(body),
        status: 'RECEIVED',
      },
    })

    console.log(`[VodafoneCash] 💾 Transaction created: id=${transaction.id}, from=${normalizedNumber}, amount=${amount}`)

    // Find user by Vodafone Cash number
    const user = await db.user.findUnique({
      where: { vodafoneCashNumber: normalizedNumber },
    })

    if (!user) {
      console.log(`[VodafoneCash] ⚠ No registered user for number: ${normalizedNumber}`)
      return NextResponse.json({
        success: true,
        message: 'Transaction received but no matching user found',
        data: {
          trxId: trx_id,
          fromNumber: normalizedNumber,
          amount: amount,
          status: 'RECEIVED',
          matchedUser: false,
        },
      })
    }

    if (user.isBanned) {
      await db.vodafoneCashTransaction.update({
        where: { id: transaction.id },
        data: { status: 'REJECTED', userId: user.id },
      })
      console.log(`[VodafoneCash] 🚫 User banned: ${user.email}`)
      return NextResponse.json({
        success: true,
        message: 'Transaction rejected - user is banned',
        data: { trxId: trx_id, status: 'REJECTED' },
      })
    }

    // Calculate credits
    const creditsToAdd = Math.max(1, Math.round(amount * creditsPerEgp))
    console.log(`[VodafoneCash] 💰 Adding ${creditsToAdd} credits to ${user.email} (${normalizedNumber})`)

    // Update user credits and transaction in a single transaction
    const [updatedUser] = await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: { paidCredits: { increment: creditsToAdd } },
      }),
      db.vodafoneCashTransaction.update({
        where: { id: transaction.id },
        data: {
          userId: user.id,
          creditsAdded: creditsToAdd,
          status: 'COMPLETED',
          processedAt: new Date(),
        },
      }),
    ])

    console.log(
      `[VodafoneCash] ✅ SUCCESS: +${creditsToAdd} credits to ${user.email} (${normalizedNumber}), trxId: ${trx_id}, amount: ${amount} EGP, new balance: ${updatedUser.paidCredits}`
    )

    return NextResponse.json({
      success: true,
      message: 'Transaction processed successfully',
      data: {
        trxId: trx_id,
        fromNumber: normalizedNumber,
        amount: amount,
        creditsAdded: creditsToAdd,
        status: 'COMPLETED',
        matchedUser: true,
        userEmail: user.email,
        userNewPaidCredits: updatedUser.paidCredits,
      },
    })
  } catch (error: any) {
    console.error('[VodafoneCash] ❌ Error processing SMS:', error)

    // Handle unique constraint violation (duplicate trx_id)
    if (error?.code === 'P2002') {
      return NextResponse.json({
        success: true,
        message: 'Transaction already exists',
        data: { status: 'DUPLICATE' },
      })
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
