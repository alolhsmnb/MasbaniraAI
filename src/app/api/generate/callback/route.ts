import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

function verifyWebhook(rawBody: string, headers: Headers, secret: string): boolean {
  try {
    const webhookId = headers.get('webhook-id')
    const timestamp = headers.get('webhook-timestamp')
    const signatureHeader = headers.get('webhook-signature')

    if (!webhookId || !timestamp || !signatureHeader) {
      console.log('[Webhook] No signature headers — skipping verification')
      return true
    }

    const [version, receivedSignature] = signatureHeader.split(',')
    if (version !== 'v3') {
      console.warn(`[Webhook] Unknown signature version: ${version}`)
      return false
    }

    const signedContent = `${webhookId}.${timestamp}.${rawBody}`
    const key = secret.startsWith('whsec_') ? secret.slice(6) : secret
    const expectedSignature = crypto
      .createHmac('sha256', key)
      .update(signedContent)
      .digest('hex')

    if (Math.abs(Date.now() / 1000 - parseInt(timestamp)) > 300) {
      console.warn('[Webhook] Timestamp too old')
      return false
    }

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(receivedSignature)
    )
  } catch (err) {
    console.error('[Webhook] Verification error:', err)
    return false
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok' })
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    console.log('[Webhook] === RECEIVED ===', rawBody.substring(0, 500))

    const payload = JSON.parse(rawBody) as Record<string, unknown>

    // Try to verify signature if we have a stored secret
    try {
      const setting = await db.siteSetting.findUnique({ where: { key: 'wavespeed_webhook_secret' } })
      if (setting?.value) {
        const valid = verifyWebhook(rawBody, request.headers, setting.value)
        if (!valid) {
          console.warn('[Webhook] ❌ Invalid signature')
          return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
        }
        console.log('[Webhook] ✅ Signature verified')
      } else {
        console.log('[Webhook] No stored secret — skipping verification')
      }
    } catch {
      console.log('[Webhook] Could not verify signature (DB error), processing anyway')
    }

    const taskId = String(payload.id || '')
    const status = String(payload.status || '')
    const outputs = payload.outputs as unknown[] | undefined
    const error = String(payload.error || '')

    if (!taskId || !status) {
      console.warn('[Webhook] Missing id or status in payload')
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    console.log(`[Webhook] Task=${taskId} Status=${status} Outputs=${outputs?.length || 0}`)

    const generation = await db.generation.findFirst({ where: { taskId } })

    if (!generation) {
      console.warn(`[Webhook] No generation for taskId=${taskId}`)
      return NextResponse.json({ success: true })
    }

    if (generation.status === 'COMPLETED' || generation.status === 'FAILED') {
      console.log(`[Webhook] Task ${taskId} already ${generation.status}, skip`)
      return NextResponse.json({ success: true })
    }

    if (status === 'completed') {
      let resultUrl: string | null = null
      if (outputs && outputs.length > 0 && typeof outputs[0] === 'string') {
        resultUrl = outputs[0]
      }

      await db.generation.update({
        where: { id: generation.id },
        data: { status: 'COMPLETED', resultUrl: resultUrl || JSON.stringify(outputs || '') },
      })
      console.log(`[Webhook] ✓ COMPLETED taskId=${taskId} url=${resultUrl || '(none)'}`)
    } else if (status === 'failed') {
      if (generation.cost > 0) {
        try {
          await db.user.update({
            where: { id: generation.userId },
            data: { paidCredits: { increment: generation.cost } },
          })
          console.log(`[Webhook] Refunded ${generation.cost} credits to user ${generation.userId}`)
        } catch { /* ignore */ }
      }
      await db.generation.update({
        where: { id: generation.id },
        data: { status: 'FAILED', resultUrl: error || 'Generation failed' },
      })
      console.log(`[Webhook] ✗ FAILED taskId=${taskId} error=${error}`)
    } else {
      console.log(`[Webhook] Task ${taskId} intermediate status: ${status}`)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Webhook] ERROR:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
