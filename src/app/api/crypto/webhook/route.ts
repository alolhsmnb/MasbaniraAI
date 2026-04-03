import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyWebhookSignature } from '@/lib/cryptapi'

/**
 * POST/GET /api/crypto/webhook
 *
 * Webhook endpoint called by CryptAPI.io when a payment is received.
 *
 * CryptAPI sends either GET or POST requests with the following params:
 *   - uuid: Unique payment identifier
 *   - address_in: Deposit address (unique per order)
 *   - txid_in: Transaction ID on the blockchain
 *   - coin: Cryptocurrency ticker
 *   - pending: 1 if pending (unconfirmed), 0 if confirmed
 *   - value_coin: Amount received in crypto
 *   - value_forwarded_coin: Amount forwarded to our wallet
 *   - confirmations: Number of block confirmations
 *   - callback_url: The callback URL that was registered
 *
 * Webhook verification:
 *   - RSA SHA256 signature in `x-ca-signature` header
 *   - Respond with plain text `*ok*` (HTTP 200) to acknowledge
 *
 * Anti-fraud checks:
 *   - TXID must not have been used before
 *   - Amount must be >= required amount
 *   - Confirmations must meet the required threshold
 *   - address_in must match the order's deposit address
 */
export async function POST(request: NextRequest) {
  try {
    return await handleWebhook(request)
  } catch (error) {
    console.error('Crypto webhook POST error:', error)
    // Always respond with *ok* to prevent CryptAPI from retrying
    return new NextResponse('*ok*', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }
}

export async function GET(request: NextRequest) {
  try {
    return await handleWebhook(request)
  } catch (error) {
    console.error('Crypto webhook GET error:', error)
    // Always respond with *ok* to prevent CryptAPI from retrying
    return new NextResponse('*ok*', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }
}

async function handleWebhook(request: NextRequest): Promise<NextResponse> {
  // Verify webhook signature
  const signature = request.headers.get('x-ca-signature') || ''
  const rawBody = await getRawBody(request)

  if (signature && !verifyWebhookSignature(rawBody, signature)) {
    console.error('Crypto webhook: Invalid signature', { signature })
    // Still respond *ok* but log the suspicious attempt
    return new NextResponse('*ok*', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  // Extract parameters (CryptAPI sends as query params for GET, form data for POST)
  let params: Record<string, string | undefined>
  if (request.method === 'GET') {
    const url = new URL(request.url)
    params = Object.fromEntries(url.searchParams.entries())
  } else {
    // POST - could be form-encoded or JSON
    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const json = await request.json()
      params = json
    } else {
      const formData = await request.formData()
      params = Object.fromEntries(formData.entries()) as Record<string, string>
    }
  }

  const {
    uuid,
    address_in,
    txid_in,
    coin,
    pending,
    value_coin,
    value_forwarded_coin,
    confirmations,
    callback_url,
  } = params

  // Log all webhook data for auditing
  console.log('Crypto webhook received:', {
    uuid,
    address_in,
    txid_in,
    coin,
    pending,
    value_coin,
    value_forwarded_coin,
    confirmations,
    callback_url,
    method: request.method,
  })

  // Validate required fields
  if (!address_in || !txid_in || !coin) {
    console.error('Crypto webhook: Missing required fields', { address_in, txid_in, coin })
    return new NextResponse('*ok*', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  // Find the order by address_in or callback URL
  let order = await db.cryptoOrder.findFirst({
    where: { addressIn: address_in },
  })

  // Fallback: try finding by callback URL if passed in query params
  if (!order && callback_url) {
    const orderIdMatch = new URL(callback_url).searchParams.get('orderId')
    if (orderIdMatch) {
      order = await db.cryptoOrder.findUnique({
        where: { orderId: orderIdMatch },
      })
    }
  }

  // Fallback: try finding by orderId in our own query params
  if (!order) {
    const { searchParams } = new URL(request.url)
    const orderIdParam = searchParams.get('orderId')
    if (orderIdParam) {
      order = await db.cryptoOrder.findUnique({
        where: { orderId: orderIdParam },
      })
    }
  }

  if (!order) {
    console.error('Crypto webhook: Order not found for address_in', { address_in, txid_in })
    return new NextResponse('*ok*', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  // Parse numeric values
  const isPending = pending === '1' || pending === 1 || pending === true
  const numConfirmations = parseInt(String(confirmations || 0), 10)
  const numValueCoin = parseFloat(String(value_coin || 0))
  const numForwarded = parseFloat(String(value_forwarded_coin || 0))

  // Anti-fraud check: Verify TXID not used before (on a different order)
  if (txid_in) {
    const existingTx = await db.cryptoOrder.findFirst({
      where: {
        txidIn: txid_in,
        id: { not: order.id },
      },
    })
    if (existingTx) {
      console.error('Crypto webhook: TXID already used on another order', { txid_in, existingOrderId: existingTx.orderId })
      return new NextResponse('*ok*', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      })
    }
  }

  // Anti-fraud check: Verify address_in matches the order
  if (address_in !== order.addressIn) {
    console.error('Crypto webhook: Address mismatch', {
      expected: order.addressIn,
      received: address_in,
      orderId: order.orderId,
    })
    return new NextResponse('*ok*', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  // Store webhook raw data for auditing
  const webhookRaw = JSON.stringify(params)

  // Determine the new status
  let newStatus = order.status
  if (isPending && numConfirmations > 0) {
    newStatus = 'CONFIRMING'
  } else if (!isPending && numConfirmations >= order.requiredConf) {
    newStatus = 'PAID'
  }

  // Anti-fraud check: Verify amount is sufficient (only for final confirmation)
  if (newStatus === 'PAID') {
    const requiredAmount = order.valueCoin || 0
    // Allow 2% tolerance for crypto price fluctuations
    if (requiredAmount > 0 && numValueCoin < requiredAmount * 0.98) {
      console.error('Crypto webhook: Insufficient payment amount', {
        required: requiredAmount,
        received: numValueCoin,
        orderId: order.orderId,
      })
      newStatus = 'UNDERPAID'
    }
  }

  // Update the order
  const updateData: Record<string, unknown> = {
    uuid: uuid || order.uuid,
    txidIn: txid_in || order.txidIn,
    valueCoin: numValueCoin || order.valueCoin,
    valueForwarded: numForwarded || order.valueForwarded,
    confirmations: numConfirmations,
    webhookRaw,
    status: newStatus,
  }

  // Only set paidAt and txidOut if payment is confirmed
  if (newStatus === 'PAID' && !order.paidAt) {
    updateData.paidAt = new Date()
  }

  await db.cryptoOrder.update({
    where: { id: order.id },
    data: updateData,
  })

  // If payment is confirmed and order wasn't already paid, credit the user
  if (newStatus === 'PAID' && order.status !== 'PAID') {
    try {
      // Use a transaction to atomically update user credits and order status
      await db.$transaction(async (tx) => {
        // Update the order as PAID
        await tx.cryptoOrder.update({
          where: { id: order.id },
          data: {
            status: 'PAID',
            paidAt: new Date(),
          },
        })

        // Add credits to user's paidCredits
        await tx.user.update({
          where: { id: order.userId },
          data: {
            paidCredits: {
              increment: order.credits,
            },
          },
        })
      })

      console.log(`Crypto payment confirmed: Order ${order.orderId}, Credits: ${order.credits}, User: ${order.userId}`)
    } catch (error) {
      console.error('Failed to credit user for crypto payment:', error)
      // Payment was received but crediting failed - mark for manual review
      await db.cryptoOrder.update({
        where: { id: order.id },
        data: { status: 'MANUAL_REVIEW' },
      })
    }
  }

  // Always respond with *ok* to acknowledge the webhook
  return new NextResponse('*ok*', {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  })
}

/**
 * Get the raw body of the request for signature verification.
 * We need to read the body as text without parsing it.
 */
async function getRawBody(request: NextRequest): Promise<string> {
  try {
    // Clone the request to read the body
    const clone = request.clone()
    return await clone.text()
  } catch {
    return ''
  }
}
