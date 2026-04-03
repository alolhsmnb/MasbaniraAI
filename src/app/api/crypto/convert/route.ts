import { NextRequest, NextResponse } from 'next/server'
import { convertUSDToCrypto } from '@/lib/cryptapi'

/**
 * POST /api/crypto/convert
 *
 * Converts a USD amount to cryptocurrency.
 * Public endpoint for price preview.
 *
 * Body:
 *   - ticker (required): Cryptocurrency ticker (e.g., btc, eth, erc20/usdt)
 *   - amountUSD (required): Amount in USD to convert
 *
 * Returns:
 *   - amountCoin: Amount in cryptocurrency
 *   - exchangeRate: 1 USD = ? crypto (if available)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ticker, amountUSD } = body || {}

    if (!ticker || !amountUSD) {
      return NextResponse.json(
        { success: false, error: 'ticker and amountUSD are required' },
        { status: 400 }
      )
    }

    const usdAmount = parseFloat(String(amountUSD))

    if (isNaN(usdAmount) || usdAmount <= 0) {
      return NextResponse.json(
        { success: false, error: 'amountUSD must be a positive number' },
        { status: 400 }
      )
    }

    // Call CryptAPI convert endpoint
    const result = await convertUSDToCrypto(ticker.toLowerCase(), usdAmount)

    // Calculate implied exchange rate (1 USD = ? crypto)
    const exchangeRate = usdAmount > 0 ? result.value_coin / usdAmount : 0

    return NextResponse.json({
      success: true,
      data: {
        amountCoin: result.value_coin,
        amountUSD: result.value_currency,
        ticker: result.ticker,
        exchangeRate,
      },
    })
  } catch (error) {
    console.error('Crypto convert error:', error)

    const message = error instanceof Error ? error.message : 'Failed to convert price'

    return NextResponse.json(
      { success: false, error: message },
      { status: 502 }
    )
  }
}
