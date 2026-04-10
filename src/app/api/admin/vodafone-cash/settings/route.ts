import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Setting keys for Vodafone Cash
const VF_SETTINGS = [
  'vodafone_merchant_number',
  'vodafone_min_amount_egp',
  'vodafone_credits_per_egp',
  'vodafone_is_enabled',
  'vodafone_webhook_secret',
]

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

    const settings = await db.siteSetting.findMany({
      where: { key: { in: VF_SETTINGS } },
    })

    const settingsMap: Record<string, string> = {}
    settings.forEach((s) => {
      settingsMap[s.key] = s.value
    })

    // Get transaction stats
    const totalTx = await db.vodafoneCashTransaction.count()
    const completedTx = await db.vodafoneCashTransaction.count({
      where: { status: 'COMPLETED' },
    })
    const pendingTx = await db.vodafoneCashTransaction.count({
      where: { status: 'RECEIVED' },
    })
    const totalCreditsAdded = await db.vodafoneCashTransaction.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { creditsAdded: true },
    })
    const totalAmountEGP = await db.vodafoneCashTransaction.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { amountEGP: true },
    })
    const registeredUsers = await db.user.count({
      where: { vodafoneCashNumber: { not: null } },
    })

    return NextResponse.json({
      success: true,
      data: {
        settings: {
          merchantNumber: settingsMap.vodafone_merchant_number || '01012315593',
          minAmountEGP: parseFloat(settingsMap.vodafone_min_amount_egp || '50'),
          creditsPerEgp: parseFloat(settingsMap.vodafone_credits_per_egp || '1'),
          isEnabled: settingsMap.vodafone_is_enabled !== 'false',
          webhookSecret: settingsMap.vodafone_webhook_secret || '',
        },
        stats: {
          totalTransactions: totalTx,
          completedTransactions: completedTx,
          pendingTransactions: pendingTx,
          totalCreditsAdded: totalCreditsAdded._sum.creditsAdded || 0,
          totalAmountEGP: totalAmountEGP._sum.amountEGP || 0,
          registeredUsers,
        },
      },
    })
  } catch (error) {
    console.error('[VodafoneCash Admin] Error fetching settings:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch settings' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { merchantNumber, minAmountEGP, creditsPerEgp, isEnabled, webhookSecret } = body

    // Validate
    if (merchantNumber !== undefined) {
      const normalized = String(merchantNumber).replace(/^(\+20|02|20)/, '').trim()
      if (!/^01[0-9]{9}$/.test(normalized)) {
        return NextResponse.json({ success: false, error: 'Invalid merchant number' }, { status: 400 })
      }
    }

    if (minAmountEGP !== undefined && (parseFloat(minAmountEGP) < 0 || isNaN(parseFloat(minAmountEGP)))) {
      return NextResponse.json({ success: false, error: 'Invalid minimum amount' }, { status: 400 })
    }

    if (creditsPerEgp !== undefined && (parseFloat(creditsPerEgp) < 0 || isNaN(parseFloat(creditsPerEgp)))) {
      return NextResponse.json({ success: false, error: 'Invalid credits per EGP' }, { status: 400 })
    }

    // Upsert each setting
    const updates: Promise<any>[] = []

    if (merchantNumber !== undefined) {
      const normalized = String(merchantNumber).replace(/^(\+20|02|20)/, '').trim()
      updates.push(
        db.siteSetting.upsert({
          where: { key: 'vodafone_merchant_number' },
          update: { value: normalized },
          create: { key: 'vodafone_merchant_number', value: normalized },
        })
      )
    }

    if (minAmountEGP !== undefined) {
      updates.push(
        db.siteSetting.upsert({
          where: { key: 'vodafone_min_amount_egp' },
          update: { value: String(parseFloat(minAmountEGP)) },
          create: { key: 'vodafone_min_amount_egp', value: String(parseFloat(minAmountEGP)) },
        })
      )
    }

    if (creditsPerEgp !== undefined) {
      updates.push(
        db.siteSetting.upsert({
          where: { key: 'vodafone_credits_per_egp' },
          update: { value: String(parseFloat(creditsPerEgp)) },
          create: { key: 'vodafone_credits_per_egp', value: String(parseFloat(creditsPerEgp)) },
        })
      )
    }

    if (isEnabled !== undefined) {
      updates.push(
        db.siteSetting.upsert({
          where: { key: 'vodafone_is_enabled' },
          update: { value: isEnabled ? 'true' : 'false' },
          create: { key: 'vodafone_is_enabled', value: isEnabled ? 'true' : 'false' },
        })
      )
    }

    if (webhookSecret !== undefined) {
      updates.push(
        db.siteSetting.upsert({
          where: { key: 'vodafone_webhook_secret' },
          update: { value: String(webhookSecret) },
          create: { key: 'vodafone_webhook_secret', value: String(webhookSecret) },
        })
      )
    }

    await Promise.all(updates)

    return NextResponse.json({
      success: true,
      message: 'Settings saved successfully',
    })
  } catch (error) {
    console.error('[VodafoneCash Admin] Error saving settings:', error)
    return NextResponse.json({ success: false, error: 'Failed to save settings' }, { status: 500 })
  }
}
