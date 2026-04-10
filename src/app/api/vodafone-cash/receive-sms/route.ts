import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface SmsPayload {
  sender: string
  message: string
  amount: number
  trx_id: string
  from_number: string
  received_at: string
}

export async function POST(request: NextRequest) {
  try {
    const body: SmsPayload = await request.json()
    const { sender, message, amount, trx_id, from_number, received_at } = body

    // Validate required fields
    if (!trx_id || !from_number || !amount || !sender) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Normalize the phone number (remove leading +20 or 02, keep 11 digits)
    const normalizedNumber = from_number.replace(/^(\+20|02|20)/, '').trim()

    // Check for duplicate transaction
    const existing = await db.vodafoneCashTransaction.findUnique({
      where: { trxId: trx_id },
    })

    if (existing) {
      return NextResponse.json({
        success: true,
        message: 'Transaction already processed',
        data: { trxId: trx_id, status: existing.status },
      })
    }

    // Get Vodafone Cash settings from SiteSetting
    const merchantNumberSetting = await db.siteSetting.findUnique({
      where: { key: 'vodafone_merchant_number' },
    })
    const creditsPerEgpSetting = await db.siteSetting.findUnique({
      where: { key: 'vodafone_credits_per_egp' },
    })
    const minAmountSetting = await db.siteSetting.findUnique({
      where: { key: 'vodafone_min_amount_egp' },
    })
    const webhookSecretSetting = await db.siteSetting.findUnique({
      where: { key: 'vodafone_webhook_secret' },
    })

    const merchantNumber = merchantNumberSetting?.value || '01012315593'
    const creditsPerEgp = parseFloat(creditsPerEgpSetting?.value || '1')
    const minAmountEGP = parseFloat(minAmountSetting?.value || '50')
    const webhookSecret = webhookSecretSetting?.value || ''

    // Verify webhook secret if configured
    const authHeader = request.headers.get('authorization')
    if (webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Create transaction record
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

    // Find user by Vodafone Cash number
    const user = await db.user.findUnique({
      where: { vodafoneCashNumber: normalizedNumber },
    })

    if (!user) {
      // No matching user - keep as RECEIVED, admin can manually assign
      console.log(`[VodafoneCash] No user found for number: ${normalizedNumber}, trxId: ${trx_id}`)
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
      return NextResponse.json({
        success: true,
        message: 'Transaction rejected - user is banned',
        data: { trxId: trx_id, status: 'REJECTED' },
      })
    }

    // Calculate credits
    const creditsToAdd = Math.max(1, Math.round(amount * creditsPerEgp))

    // Update user credits and transaction
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
      `[VodafoneCash] Credits added: +${creditsToAdd} to user ${user.email} (${normalizedNumber}), trxId: ${trx_id}, amount: ${amount} EGP`
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
    console.error('[VodafoneCash] Error processing SMS:', error)

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
