/**
 * CryptAPI.io Service Library
 *
 * Integrates with CryptAPI.io for cryptocurrency payment processing.
 * No API key needed - just uses wallet addresses.
 *
 * Ticker format:
 * - Native: btc, eth, ltc, bch, trx
 * - Tokens: erc20/usdt, bep20/usdt, trc20/usdt, polygon_usdt, etc.
 */

import crypto from 'crypto'

const CRYPTAPI_BASE_URL = 'https://api.cryptapi.io'

// CryptAPI public key for webhook signature verification (RSA SHA256)
// This should be set via environment variable in production
export const CRYPTAPI_PUBLIC_KEY = process.env.CRYPTAPI_PUBLIC_KEY || ''

// Required block confirmations per ticker (configurable)
export const REQUIRED_CONFIRMATIONS: Record<string, number> = {
  btc: 3,
  bch: 3,
  eth: 12,
  ltc: 6,
  trx: 20,
  // Tokens default to 6
}

/** Get required confirmations for a ticker */
export function getRequiredConfirmations(ticker: string): number {
  // Check exact ticker match first
  if (REQUIRED_CONFIRMATIONS[ticker]) {
    return REQUIRED_CONFIRMATIONS[ticker]
  }
  // Check base coin (e.g., "erc20/usdt" -> check "eth")
  const baseTicker = ticker.split('/')[0].replace(/^(erc20|bep20|trc20)$/, {
    erc20: 'eth',
    bep20: 'eth',
    trc20: 'trx',
    polygon: 'eth',
  }[ticker.split('/')[0]] || '')
  return REQUIRED_CONFIRMATIONS[baseTicker] || 6
}

/** CryptAPI create payment response */
interface CreatePaymentResponse {
  address_in: string
  address_out: string
  callback_url: string
  destination_tag?: number | null
  payment_uri?: string
  qrcode_url?: string
  minimum_transaction_coin?: number
  priority?: string
  status: string
}

/**
 * Create a payment address via CryptAPI
 * Generates a unique address for the user to send funds to.
 */
export async function createPaymentAddress(
  ticker: string,
  callbackUrl: string,
  walletAddress: string,
): Promise<CreatePaymentResponse> {
  const params = new URLSearchParams({
    callback: callbackUrl,
    address: walletAddress,
    pending: '1',     // Also notify on pending payments
    convert: '1',     // Auto-convert to fiat value in callbacks
    post: '1',        // Use POST for callbacks
    json: '1',        // Return JSON
  })

  // Note: CryptAPI /create endpoint does NOT accept a value parameter.
  // Use convertUSDToCrypto() separately to get the crypto amount.

  const url = `${CRYPTAPI_BASE_URL}/${ticker}/create/?${params.toString()}`

  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`CryptAPI create error (${response.status}): ${errorText}`)
  }

  const data = await response.json()

  if (data.error) {
    throw new Error(`CryptAPI create error: ${data.error}`)
  }

  return data as CreatePaymentResponse
}

/** CryptAPI QR code response */
interface QRCodeResponse {
  status: string
  qr_code: string  // base64-encoded PNG image
  payment_uri: string  // e.g. "bitcoin:address?amount=0.1"
}

/**
 * Get a QR code for a payment address via CryptAPI.
 *
 * Endpoint: GET /{ticker}/qrcode/?address=...&value=...&size=...
 * Returns JSON: { status: "success", qr_code: "base64...", payment_uri: "bitcoin:..." }
 *
 * The qr_code field is a base64-encoded PNG. Use as:
 *   <img src="data:image/png;base64,{qr_code}" />
 */
export async function getQRCode(
  ticker: string,
  address: string,
  value: number
): Promise<{ qrCodeBase64: string; paymentUri: string }> {
  const params = new URLSearchParams({
    address,
    value: value.toString(),
    size: '256',
  })

  const url = `${CRYPTAPI_BASE_URL}/${ticker}/qrcode/?${params.toString()}`

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`CryptAPI QR code error (${response.status})`)
  }

  // CryptAPI returns JSON with qr_code (base64) and payment_uri
  const data = (await response.json()) as QRCodeResponse

  if (data.status !== 'success' || !data.qr_code) {
    throw new Error(`CryptAPI QR code generation failed: ${JSON.stringify(data)}`)
  }

  return {
    qrCodeBase64: `data:image/png;base64,${data.qr_code}`,
    paymentUri: data.payment_uri || '',
  }
}

/** CryptAPI convert response */
interface ConvertResponse {
  value_coin: string | number
  exchange_rate: string | number
  status: string
}

/**
 * Convert USD amount to cryptocurrency amount using CryptAPI.
 * Returns the crypto amount equivalent to the given USD amount.
 *
 * Endpoint: GET /{ticker}/convert/?value={usdAmount}&from=USD
 * Response: { value_coin: "0.01", exchange_rate: "47000", status: "success" }
 */
export async function convertUSDToCrypto(
  ticker: string,
  usdAmount: number
): Promise<{ value_coin: number; exchange_rate: number }> {
  const params = new URLSearchParams({
    value: usdAmount.toString(),
    from: 'USD',
  })

  const url = `${CRYPTAPI_BASE_URL}/${ticker}/convert/?${params.toString()}`

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`CryptAPI convert error (${response.status}): ${errorText}`)
  }

  const data = (await response.json()) as ConvertResponse

  if (data.error) {
    throw new Error(`CryptAPI convert error: ${data.error}`)
  }

  // CryptAPI returns value_coin and exchange_rate as strings
  const valueCoin = parseFloat(String(data.value_coin))
  const exchangeRate = parseFloat(String(data.exchange_rate))

  if (isNaN(valueCoin) || isNaN(exchangeRate)) {
    throw new Error(`CryptAPI convert: invalid numeric response (${JSON.stringify(data)})`)
  }

  return { value_coin: valueCoin, exchange_rate: exchangeRate }
}

/** Coin info with price data */
interface CoinInfo {
  ticker: string
  name: string
  coin: string
  network: string
  enabled: boolean
  fees: {
    rate: number
    miner: number
    partner: number
  }
  price?: {
    USD?: number
    EUR?: number
    [key: string]: number | undefined
  }
  options?: {
    [key: string]: any
  }
}

/**
 * Get info for a specific coin/ticker including prices
 */
export async function getCoinInfo(ticker: string): Promise<CoinInfo> {
  const params = new URLSearchParams({ prices: '1' })
  const url = `${CRYPTAPI_BASE_URL}/${ticker}/info/?${params.toString()}`

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`CryptAPI coin info error (${response.status})`)
  }

  return (await response.json()) as CoinInfo
}

/**
 * Get info for all supported coins
 */
export async function getAllCoinInfo(): Promise<Record<string, CoinInfo>> {
  const params = new URLSearchParams({ prices: '1' })
  const url = `${CRYPTAPI_BASE_URL}/info/?${params.toString()}`

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`CryptAPI all coins info error (${response.status})`)
  }

  return (await response.json()) as Record<string, CoinInfo>
}

/**
 * Verify a webhook signature from CryptAPI
 * Uses RSA SHA256 with the CryptAPI public key.
 *
 * CryptAPI sends the signature in the `x-ca-signature` header.
 * The payload is the raw request body.
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string
): boolean {
  if (!CRYPTAPI_PUBLIC_KEY) {
    // If no public key is configured, skip verification (dev mode)
    console.warn('CRYPTAPI_PUBLIC_KEY not set, skipping webhook verification')
    return true
  }

  try {
    const verifier = crypto.createVerify('RSA-SHA256')
    verifier.update(payload, 'utf8')
    return verifier.verify(CRYPTAPI_PUBLIC_KEY, signature, 'base64')
  } catch (error) {
    console.error('Webhook signature verification failed:', error)
    return false
  }
}

/**
 * Generate a unique callback URL for a given order ID
 * This URL will be registered with CryptAPI for payment notifications.
 */
export function getCallbackUrl(orderId: string): string {
  const baseUrl = process.env.NEXTAUTH_URL || process.env.APP_URL || 'http://localhost:3000'
  return `${baseUrl}/api/crypto/webhook?orderId=${orderId}`
}

/**
 * Get the CryptAPI logs URL for checking payment status
 * This polls the CryptAPI API to get the latest transaction status.
 */
export function getLogsUrl(
  ticker: string,
  callbackUrl: string
): string {
  const params = new URLSearchParams({
    callback: callbackUrl,
    json: '1',
  })
  return `${CRYPTAPI_BASE_URL}/${ticker}/logs/?${params.toString()}`
}
