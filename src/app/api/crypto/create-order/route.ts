import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, AuthError } from '@/lib/auth'
import {
  createPaymentAddress,
  getQRCode,
  convertUSDToCrypto,
  getRequiredConfirmations,
} from '@/lib/cryptapi'

/**
 * POST /api/crypto/create-order
 *
 * Creates a new cryptocurrency payment order.
 *
 * Body:
 *   - planId (optional): Plan to purchase - determines price and credits
 *   - ticker (required): Cryptocurrency ticker (e.g., btc, eth, erc20/usdt)
 *   - amountUSD (optional): Custom USD amount (used when no planId)
 *   - credits (optional): Credits to purchase (used when no planId)
 *
 * Returns:
 *   - orderId: Unique order identifier
 *   - addressIn: Payment address to send funds
 *   - amountCoin: Amount of crypto to send
 *   - ticker: Cryptocurrency ticker
 *   - paymentUri: Payment URI for wallet apps
 *   - qrCodeBase64: QR code as base64 image
 *   - expiresAt: Order expiration timestamp
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request)

    const body = await request.json()
    const { planId, ticker, amountUSD, credits } = body || {}

    if (!ticker) {
      return NextResponse.json(
        { success: false, error: 'ticker is required' },
        { status: 400 }
      )
    }

    // Check if wallet exists and is active for this ticker
    const wallet = await db.cryptoWallet.findUnique({
      where: { ticker: ticker.toLowerCase() },
    })

    if (!wallet || !wallet.isActive) {
      return NextResponse.json(
        { success: false, error: `Payment via ${ticker} is not available` },
        { status: 400 }
      )
    }

    // Determine amount and credits
    let priceUSD = amountUSD ? parseFloat(String(amountUSD)) : 0
    let orderCredits = credits ? parseInt(String(credits), 10) : 0

    if (planId) {
      // Look up plan price and credits
      const plan = await db.plan.findUnique({
        where: { id: planId },
      })

      if (!plan || !plan.isActive) {
        return NextResponse.json(
          { success: false, error: 'Plan not found or inactive' },
          { status: 400 }
        )
      }

      priceUSD = plan.price
      orderCredits = plan.credits
    } else if (!priceUSD || !orderCredits) {
      return NextResponse.json(
        { success: false, error: 'Either planId or both amountUSD and credits are required' },
        { status: 400 }
      )
    }

    if (priceUSD <= 0) {
      return NextResponse.json(
        { success: false, error: 'Amount must be greater than zero' },
        { status: 400 }
      )
    }

    // Check minimum payment for this currency
    const minPayment = wallet.minimumPaymentUSD || 5
    if (priceUSD < minPayment) {
      return NextResponse.json(
        { success: false, error: `Minimum payment for ${ticker} is $${minPayment.toFixed(2)}` },
        { status: 400 }
      )
    }

    // Convert USD to crypto amount
    let amountCoin: number
    try {
      const conversion = await convertUSDToCrypto(ticker.toLowerCase(), priceUSD)
      amountCoin = conversion.value_coin
    } catch (error) {
      console.error('Crypto conversion error:', error)
      return NextResponse.json(
        { success: false, error: `Failed to get exchange rate for ${ticker}` },
        { status: 502 }
      )
    }

    // Generate unique order ID
    const orderId = `CO-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

    // Read base_url from crypto settings for callback URL (fallback to NEXTAUTH_URL then localhost)
    const baseUrlSetting = await db.cryptoSetting.findUnique({
      where: { key: 'base_url' },
    })
    const baseUrl = (baseUrlSetting?.value || process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/+$/, '')

    // Generate callback URL for this order
    const callbackUrl = `${baseUrl}/api/crypto/webhook?orderId=${orderId}`

    // Read order expiry from settings (default: 30 minutes)
    const expirySetting = await db.cryptoSetting.findUnique({
      where: { key: 'order_expiry_minutes' },
    })
    const expiryMinutes = expirySetting ? parseInt(expirySetting.value, 10) : 30
    const expiryMs = (isNaN(expiryMinutes) || expiryMinutes < 1) ? 30 : expiryMinutes

    // Create payment address via CryptAPI (just creates the address, no amount)
    let paymentResult
    try {
      paymentResult = await createPaymentAddress(
        ticker.toLowerCase(),
        callbackUrl,
        wallet.address,
      )
    } catch (error) {
      console.error('CryptAPI create error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to create payment address. Please try again later.' },
        { status: 502 }
      )
    }

    // Get QR code for the payment using the amountCoin from convert
    let qrCodeBase64: string | null = null
    let paymentUri: string | null = null
    try {
      const qrResult = await getQRCode(
        ticker.toLowerCase(),
        paymentResult.address_in,
        amountCoin
      )
      qrCodeBase64 = qrResult.qrCodeBase64
      paymentUri = qrResult.paymentUri || null
    } catch (error) {
      console.error('QR code generation error:', error)
      // Non-critical, continue without QR
    }

    // Determine required confirmations
    const requiredConf = getRequiredConfirmations(ticker.toLowerCase())

    // Create the order in DB - use amountCoin from convertUSDToCrypto (NOT from create)
    const order = await db.cryptoOrder.create({
      data: {
        orderId,
        userId: session.userId,
        planId: planId || null,
        amountUSD: priceUSD,
        credits: orderCredits,
        ticker: ticker.toLowerCase(),
        coinName: ticker.toUpperCase(),
        addressIn: paymentResult.address_in,
        addressOut: paymentResult.address_out,
        callbackUrl,
        paymentUri: paymentUri,
        valueCoin: amountCoin,
        requiredConf,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + expiryMs * 60 * 1000),
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        orderId: order.orderId,
        addressIn: order.addressIn,
        amountCoin: order.valueCoin,
        ticker: order.ticker,
        coinName: order.coinName,
        paymentUri: order.paymentUri,
        qrCodeBase64,
        amountUSD: order.amountUSD,
        credits: order.credits,
        requiredConf,
        expiresAt: order.expiresAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('Create crypto order error:', error)

    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to create payment order' },
      { status: 500 }
    )
  }
}
