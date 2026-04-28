import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, AuthError } from '@/lib/auth'

/**
 * Fetch WaveSpeed webhook secret for a specific API key
 * GET /api/admin/api-keys/webhook-secret?keyId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth(request)

    const keyId = request.nextUrl.searchParams.get('keyId')
    if (!keyId) {
      return NextResponse.json({ success: false, error: 'keyId is required' }, { status: 400 })
    }

    const apiKey = await db.apiKey.findUnique({ where: { id: keyId } })

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API key not found' }, { status: 404 })
    }

    if (apiKey.provider !== 'WAVESPEED') {
      return NextResponse.json({ success: false, error: 'Webhook secret is only available for WaveSpeed keys' }, { status: 400 })
    }

    const response = await fetch('https://api.wavespeed.ai/api/v3/webhook/secret', {
      headers: { Authorization: `Bearer ${apiKey.key}` },
    })

    if (!response.ok) {
      const text = await response.text()
      console.error(`[WebhookSecret] WaveSpeed API error for key ${keyId}:`, text)
      return NextResponse.json({ success: false, error: `WaveSpeed API error: ${text}` }, { status: 500 })
    }

    const data = await response.json() as Record<string, unknown>
    const secretData = data.data as Record<string, unknown> | undefined
    const secret = String(secretData?.secret || data.secret || '')

    if (!secret) {
      console.error('[WebhookSecret] No secret in WaveSpeed response:', JSON.stringify(data))
      return NextResponse.json({ success: false, error: 'No secret in WaveSpeed response' }, { status: 500 })
    }

    await db.siteSetting.upsert({
      where: { key: 'wavespeed_webhook_secret' },
      update: { value: secret },
      create: { key: 'wavespeed_webhook_secret', value: secret },
    })

    const masked = secret.length > 12 ? secret.substring(0, 12) + '...' : '***'

    console.log(`[WebhookSecret] ✓ Fetched and saved webhook secret for key ${apiKey.name || keyId}`)

    return NextResponse.json({
      success: true,
      message: 'Webhook secret fetched and saved',
      secretPreview: masked,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode })
    }
    console.error('[WebhookSecret] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch webhook secret' }, { status: 500 })
  }
}
