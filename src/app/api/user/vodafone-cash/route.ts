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
      select: {
        id: true,
        vodafoneCashNumber: true,
      },
    })

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    // Get Vodafone Cash settings
    const settings = await db.siteSetting.findMany({
      where: {
        key: {
          in: ['vodafone_merchant_number', 'vodafone_min_amount_egp', 'vodafone_credits_per_egp', 'vodafone_is_enabled'],
        },
      },
    })

    const settingsMap: Record<string, string> = {}
    settings.forEach((s) => {
      settingsMap[s.key] = s.value
    })

    return NextResponse.json({
      success: true,
      data: {
        vodafoneCashNumber: user.vodafoneCashNumber,
        merchantNumber: settingsMap.vodafone_merchant_number || '01012315593',
        minAmountEGP: parseFloat(settingsMap.vodafone_min_amount_egp || '50'),
        creditsPerEgp: parseFloat(settingsMap.vodafone_credits_per_egp || '1'),
        isEnabled: settingsMap.vodafone_is_enabled !== 'false',
      },
    })
  } catch (error) {
    console.error('[VodafoneCash] Error fetching user settings:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch settings' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { phone } = await request.json()

    if (!phone || typeof phone !== 'string') {
      return NextResponse.json({ success: false, error: 'Phone number is required' }, { status: 400 })
    }

    // Normalize phone number
    const normalized = phone.replace(/^(\+20|02|20)/, '').trim()

    // Validate Egyptian phone number (11 digits starting with 01)
    if (!/^01[0-9]{9}$/.test(normalized)) {
      return NextResponse.json(
        { success: false, error: 'Invalid Egyptian phone number. Must be 11 digits starting with 01.' },
        { status: 400 }
      )
    }

    // Check if number is already used by another user
    const existingUser = await db.user.findFirst({
      where: {
        vodafoneCashNumber: normalized,
        id: { not: session.userId },
      },
    })

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'This phone number is already linked to another account.' },
        { status: 409 }
      )
    }

    // Save/update the number
    const user = await db.user.update({
      where: { id: session.userId },
      data: { vodafoneCashNumber: normalized },
      select: { id: true, vodafoneCashNumber: true },
    })

    return NextResponse.json({
      success: true,
      message: 'Vodafone Cash number saved successfully',
      data: { vodafoneCashNumber: user.vodafoneCashNumber },
    })
  } catch (error) {
    console.error('[VodafoneCash] Error saving phone:', error)

    if ((error as any)?.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'This phone number is already linked to another account.' },
        { status: 409 }
      )
    }

    return NextResponse.json({ success: false, error: 'Failed to save phone number' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    await db.user.update({
      where: { id: session.userId },
      data: { vodafoneCashNumber: null },
    })

    return NextResponse.json({
      success: true,
      message: 'Vodafone Cash number removed',
    })
  } catch (error) {
    console.error('[VodafoneCash] Error removing phone:', error)
    return NextResponse.json({ success: false, error: 'Failed to remove phone number' }, { status: 500 })
  }
}
