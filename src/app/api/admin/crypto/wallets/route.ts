import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, AuthError } from '@/lib/auth'

/**
 * GET /api/admin/crypto/wallets - List all wallets
 * POST /api/admin/crypto/wallets - Add/update wallet (upsert by ticker)
 * DELETE /api/admin/crypto/wallets?id=xxx - Delete wallet
 */

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)

    const wallets = await db.cryptoWallet.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: wallets })
  } catch (error) {
    console.error('Get wallets error:', error)
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode })
    }
    return NextResponse.json({ success: false, error: 'Failed to get wallets' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)

    const body = await request.json()
    const { ticker, address, isActive, minimumPaymentUSD } = body || {}

    if (!ticker || !address) {
      return NextResponse.json(
        { success: false, error: 'Ticker and address are required' },
        { status: 400 }
      )
    }

    const normalizedTicker = ticker.toLowerCase().trim()
    const normalizedAddress = address.trim()

    if (!normalizedAddress) {
      return NextResponse.json(
        { success: false, error: 'Address cannot be empty' },
        { status: 400 }
      )
    }

    // Parse minimum payment (default $5)
    const minPayment = typeof minimumPaymentUSD === 'number'
      ? Math.max(0, minimumPaymentUSD)
      : 5.0

    // Upsert wallet by ticker (unique constraint)
    const wallet = await db.cryptoWallet.upsert({
      where: { ticker: normalizedTicker },
      update: {
        address: normalizedAddress,
        isActive: isActive !== false,
        minimumPaymentUSD: minPayment,
      },
      create: {
        ticker: normalizedTicker,
        address: normalizedAddress,
        isActive: isActive !== false,
        minimumPaymentUSD: minPayment,
      },
    })

    return NextResponse.json({ success: true, data: wallet })
  } catch (error) {
    console.error('Save wallet error:', error)
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode })
    }
    return NextResponse.json({ success: false, error: 'Failed to save wallet' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin(request)

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID is required' },
        { status: 400 }
      )
    }

    const wallet = await db.cryptoWallet.findUnique({ where: { id } })

    if (!wallet) {
      return NextResponse.json(
        { success: false, error: 'Wallet not found' },
        { status: 404 }
      )
    }

    // Prevent delete if there are active orders
    const activeOrders = await db.cryptoOrder.count({
      where: {
        ticker: wallet.ticker,
        status: { in: ['PENDING', 'CONFIRMING'] },
      },
    })

    if (activeOrders > 0) {
      return NextResponse.json(
        { success: false, error: `Cannot delete: ${activeOrders} active order(s) for ${wallet.ticker}` },
        { status: 400 }
      )
    }

    await db.cryptoWallet.delete({ where: { id } })

    return NextResponse.json({
      success: true,
      data: { message: `Wallet (${wallet.ticker}) deleted` },
    })
  } catch (error) {
    console.error('Delete wallet error:', error)
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode })
    }
    return NextResponse.json({ success: false, error: 'Failed to delete wallet' }, { status: 500 })
  }
}
