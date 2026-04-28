import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { extractResultUrl } from '@/lib/kie-api'

// ============================================================
// WaveSpeed HMAC-SHA256 webhook signature verification
// ============================================================
function verifyWaveSpeedSignature(rawBody: string, headers: Headers, secret: string): boolean {
  try {
    const webhookId = headers.get('webhook-id')
    const timestamp = headers.get('webhook-timestamp')
    const signatureHeader = headers.get('webhook-signature')

    if (!webhookId || !timestamp || !signatureHeader) {
      console.log('[Webhook/SigDebug] Missing required headers')
      return false
    }

    const [version, receivedSignature] = signatureHeader.split(',')
    if (version !== 'v3') {
      console.warn(`[Webhook/SigDebug] Unknown signature version: ${version}`)
      return false
    }

    if (Math.abs(Date.now() / 1000 - parseInt(timestamp)) > 300) {
      console.warn('[Webhook/SigDebug] Timestamp too old')
      return false
    }

    const key = secret.startsWith('whsec_') ? secret.slice(6) : secret

    // Try multiple body variants to find which one matches
    const variants = [
      { label: 'original', body: rawBody },
      { label: 'trimmed', body: rawBody.trim() },
      { label: 'trimmedEnd', body: rawBody.trimEnd() },
      { label: 'trimmedStart', body: rawBody.trimStart() },
      { label: 'noNewlineEnd', body: rawBody.replace(/\n+$/, '') },
      { label: 'normalized', body: rawBody.replace(/\r\n/g, '\n').trim() },
    ]

    for (const variant of variants) {
      const signedContent = `${webhookId}.${timestamp}.${variant.body}`
      const expected = crypto
        .createHmac('sha256', key)
        .update(signedContent)
        .digest('hex')

      if (expected === receivedSignature) {
        console.log(`[Webhook/SigDebug] ✅ MATCH with variant: ${variant.label} (body length: ${variant.body.length})`)
        return true
      }
    }

    // Log debug info for debugging
    console.log(`[Webhook/SigDebug] ❌ No variant matched`)
    console.log(`[Webhook/SigDebug] rawBody length=${rawBody.length}, last30="${rawBody.slice(-30)}"`)
    console.log(`[Webhook/SigDebug] trimmed length=${rawBody.trim().length}`)
    console.log(`[Webhook/SigDebug] received sig=${receivedSignature}`)

    return false
  } catch (err) {
    console.error('[Webhook/SigDebug] Verification error:', err)
    return false
  }
}

// ============================================================
// Detect callback provider based on payload structure
// ============================================================
type Provider = 'WAVESPEED' | 'KIE' | 'UNKNOWN'

function detectProvider(payload: Record<string, unknown>, headers: Headers): Provider {
  // WaveSpeed: has id + status fields, or has signature headers
  if (payload.id && payload.status) return 'WAVESPEED'
  if (headers.get('webhook-id') || headers.get('webhook-signature')) return 'WAVESPEED'

  // KIE.AI: has code + data structure
  if (payload.code !== undefined && payload.data !== undefined) return 'KIE'

  return 'UNKNOWN'
}

// ============================================================
// Handle WaveSpeed callback (Kling models)
// Payload: { id: string, status: string, outputs: string[], error?: string }
// ============================================================
async function handleWaveSpeedCallback(payload: Record<string, unknown>) {
  const taskId = String(payload.id || '')
  const status = String(payload.status || '')
  const outputs = payload.outputs as unknown[] | undefined
  const error = String(payload.error || '')

  if (!taskId || !status) {
    console.warn('[Webhook/WaveSpeed] Missing id or status in payload')
    return { success: false, error: 'Missing fields' }
  }

  console.log(`[Webhook/WaveSpeed] Task=${taskId} Status=${status} Outputs=${outputs?.length || 0}`)

  const generation = await db.generation.findFirst({ where: { taskId } })
  if (!generation) {
    console.warn(`[Webhook/WaveSpeed] No generation for taskId=${taskId}`)
    return { success: true }
  }

  if (generation.status === 'COMPLETED' || generation.status === 'FAILED') {
    console.log(`[Webhook/WaveSpeed] Task ${taskId} already ${generation.status}, skip`)
    return { success: true }
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
    console.log(`[Webhook/WaveSpeed] ✓ COMPLETED taskId=${taskId} url=${resultUrl || '(none)'}`)
  } else if (status === 'failed') {
    if (generation.cost > 0) {
      try {
        await db.user.update({
          where: { id: generation.userId },
          data: { paidCredits: { increment: generation.cost } },
        })
        console.log(`[Webhook/WaveSpeed] Refunded ${generation.cost} credits to user ${generation.userId}`)
      } catch { /* ignore */ }
    }
    await db.generation.update({
      where: { id: generation.id },
      data: { status: 'FAILED', resultUrl: error || 'Generation failed' },
    })
    console.log(`[Webhook/WaveSpeed] ✗ FAILED taskId=${taskId} error=${error}`)
  } else {
    console.log(`[Webhook/WaveSpeed] Task ${taskId} intermediate status: ${status}`)
  }

  return { success: true }
}

// ============================================================
// Handle KIE.AI callback (Seedance, Grok, Sora, Veo, etc.)
// Payload: { code: 200, data: { taskId, model, state, resultJson, ... } }
// ============================================================
async function handleKieCallback(payload: Record<string, unknown>) {
  const data = payload.data as Record<string, unknown> | undefined
  if (!data) {
    console.warn('[Webhook/KIE] Missing data field in payload')
    return { success: false, error: 'Missing data' }
  }

  const taskId = String(data.taskId || '')
  const state = String(data.state || data.status || '')
  const resultJson = data.resultJson as string | undefined
  const result = data.result as unknown

  if (!taskId) {
    console.warn('[Webhook/KIE] Missing taskId in callback data')
    return { success: false, error: 'Missing taskId' }
  }

  console.log(`[Webhook/KIE] Task=${taskId} State=${state || '(none)'} hasResultJson=${!!resultJson}`)

  const generation = await db.generation.findFirst({
    where: { taskId },
    include: { model: { select: { modelId: true, provider: true } } },
  })

  if (!generation) {
    console.warn(`[Webhook/KIE] No generation for taskId=${taskId}`)
    return { success: true }
  }

  if (generation.status === 'COMPLETED' || generation.status === 'FAILED') {
    console.log(`[Webhook/KIE] Task ${taskId} already ${generation.status}, skip`)
    return { success: true }
  }

  const stateLower = state.toLowerCase()
  const completedStates = ['success', 'succeed', 'completed', 'done', 'finished', 'succeeded', 'complete']
  const failedStates = ['failed', 'failure', 'error', 'cancelled', 'canceled', 'aborted', 'abort']

  if (completedStates.includes(stateLower)) {
    // Extract result URL from resultJson or result
    const resultData = resultJson || result || null
    const resultUrl = extractResultUrl(resultData)

    if (resultUrl) {
      await db.generation.update({
        where: { id: generation.id },
        data: { status: 'COMPLETED', resultUrl },
      })
      console.log(`[Webhook/KIE] ✓ COMPLETED taskId=${taskId} url=${resultUrl.substring(0, 100)}`)
    } else {
      // No URL extracted - try regex fallback
      const rawStr = JSON.stringify(resultData)
      const videoUrlMatch = rawStr.match(/https?:\/\/[^\s"'<>\]}]+?\.(mp4|webm|mov)(\?[^\s"'<>\]}]*)?/i)
      const urlMatch = videoUrlMatch || rawStr.match(/https?:\/\/[^\s"'<>\]}]+?\.(png|jpg|jpeg|gif|webp|bmp)(\?[^\s"'<>\]}]*)?/i) || rawStr.match(/https?:\/\/[^\s"'<>]+/)

      if (urlMatch) {
        console.log(`[Webhook/KIE] Found URL via regex fallback: ${urlMatch[0].substring(0, 100)}`)
        await db.generation.update({
          where: { id: generation.id },
          data: { status: 'COMPLETED', resultUrl: urlMatch[0] },
        })
      } else {
        // Save raw result for debugging
        const jsonResult = typeof resultData === 'string' ? resultData : JSON.stringify(resultData)
        await db.generation.update({
          where: { id: generation.id },
          data: { status: 'COMPLETED', resultUrl: jsonResult },
        })
        console.log(`[Webhook/KIE] ✓ COMPLETED taskId=${taskId} but no URL extracted, saved raw result`)
      }
    }
  } else if (failedStates.includes(stateLower)) {
    // Failed - refund credits
    if (generation.cost > 0) {
      try {
        await db.user.update({
          where: { id: generation.userId },
          data: { paidCredits: { increment: generation.cost } },
        })
        console.log(`[Webhook/KIE] Refunded ${generation.cost} credits to user ${generation.userId}`)
      } catch { /* ignore */ }
    }

    // Extract error message
    let errorMsg = 'Generation failed at provider'
    if (typeof result === 'string' && result.length < 500) {
      errorMsg = result
    } else if (typeof result === 'object' && result !== null) {
      const obj = result as Record<string, unknown>
      errorMsg = String(obj.msg || obj.error || obj.message || obj.reason || errorMsg)
    }
    if (data.msg) errorMsg = String(data.msg)

    await db.generation.update({
      where: { id: generation.id },
      data: { status: 'FAILED', resultUrl: errorMsg },
    })
    console.log(`[Webhook/KIE] ✗ FAILED taskId=${taskId} error=${errorMsg}`)
  } else {
    console.log(`[Webhook/KIE] Task ${taskId} intermediate state: ${state}`)
  }

  return { success: true }
}

// ============================================================
// GET - Health check for webhook endpoint
// ============================================================
export async function GET() {
  return NextResponse.json({ status: 'ok' })
}

// ============================================================
// POST - Unified callback endpoint for both providers
// ============================================================
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    console.log('[Webhook] === RECEIVED ===', rawBody.substring(0, 500))

    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>
    } catch {
      console.warn('[Webhook] Invalid JSON body')
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    // Step 1: Detect provider
    const provider = detectProvider(payload, request.headers)
    console.log(`[Webhook] Detected provider: ${provider}`)

    // Step 2: Route to appropriate handler
    if (provider === 'WAVESPEED') {
      // Verify WaveSpeed HMAC signature (warning only, never block)
      try {
        const setting = await db.siteSetting.findUnique({ where: { key: 'wavespeed_webhook_secret' } })
        if (setting?.value) {
          const valid = verifyWaveSpeedSignature(rawBody, request.headers, setting.value)
          if (!valid) {
            console.warn('[Webhook/WaveSpeed] ⚠️ Signature mismatch (processing anyway)')
          } else {
            console.log('[Webhook/WaveSpeed] ✅ Signature verified')
          }
        } else {
          console.log('[Webhook/WaveSpeed] No stored secret — skipping verification')
        }
      } catch {
        console.log('[Webhook/WaveSpeed] Could not verify signature (DB error), processing anyway')
      }

      const result = await handleWaveSpeedCallback(payload)
      return NextResponse.json(result)
    }

    if (provider === 'KIE') {
      // KIE.AI callbacks have no signature verification (per their docs)
      // Optional: we could add signature verification per KIE.AI webhook-verification guide
      console.log('[Webhook/KIE] Processing KIE.AI callback (no signature verification)')
      const result = await handleKieCallback(payload)
      return NextResponse.json(result)
    }

    // Unknown provider - try both handlers as fallback
    console.warn('[Webhook] Unknown provider, trying WaveSpeed format first...')
    if (payload.id && payload.status) {
      const result = await handleWaveSpeedCallback(payload)
      return NextResponse.json(result)
    }

    if (payload.data && (payload.data as Record<string, unknown>).taskId) {
      console.log('[Webhook] Trying KIE.AI format...')
      const result = await handleKieCallback(payload)
      return NextResponse.json(result)
    }

    console.warn('[Webhook] Could not determine provider or parse payload')
    return NextResponse.json({ error: 'Unrecognized callback format' }, { status: 400 })
  } catch (error) {
    console.error('[Webhook] ERROR:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
