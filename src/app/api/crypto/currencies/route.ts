import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAllCoinInfo } from '@/lib/cryptapi'

/**
 * GET /api/crypto/currencies
 *
 * Public endpoint that returns all available cryptocurrency payment options.
 * No authentication required - this is used for the pricing/payment page.
 *
 * Returns:
 *   - List of active wallets with their ticker, address, and current prices
 *   - Coin info from CryptAPI (name, network, fees)
 *   - Current USD price if available
 */
export async function GET(request: NextRequest) {
  try {
    // Get all active wallets from DB
    const wallets = await db.cryptoWallet.findMany({
      where: { isActive: true },
      orderBy: { ticker: 'asc' },
    })

    if (wallets.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      })
    }

    // Try to get current prices from CryptAPI
    let coinInfoMap: Record<string, {
      name?: string
      coin?: string
      network?: string
      priceUSD?: number
      fees?: { rate: number; miner: number }
    }> = {}

    try {
      const allInfo = await getAllCoinInfo()

      // Map CryptAPI response to our wallet tickers
      for (const [tickerKey, info] of Object.entries(allInfo)) {
        const infoData = info as {
          ticker?: string
          name?: string
          coin?: string
          network?: string
          enabled?: boolean
          price?: { USD?: number }
          fees?: { rate: number; miner: number }
        }

        coinInfoMap[tickerKey] = {
          name: infoData.name || infoData.coin,
          coin: infoData.coin,
          network: infoData.network,
          priceUSD: infoData.price?.USD,
          fees: infoData.fees ? {
            rate: infoData.fees.rate,
            miner: infoData.fees.miner,
          } : undefined,
        }
      }
    } catch (error) {
      console.error('Failed to fetch coin info from CryptAPI:', error)
      // Continue with wallet data without prices
    }

    // Build the response
    const currencies = wallets.map((wallet) => {
      const info = coinInfoMap[wallet.ticker] || {}
      return {
        ticker: wallet.ticker,
        name: info.name || wallet.ticker.toUpperCase(),
        coin: info.coin || wallet.ticker,
        network: info.network || null,
        priceUSD: info.priceUSD || null,
        minimumPaymentUSD: wallet.minimumPaymentUSD || 5,
        fees: info.fees || null,
      }
    })

    return NextResponse.json({
      success: true,
      data: currencies,
    })
  } catch (error) {
    console.error('Get currencies error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get available currencies' },
      { status: 500 }
    )
  }
}
