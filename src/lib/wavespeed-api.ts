import { db } from '@/lib/db'

const WAVESPEED_BASE_URL = 'https://api.wavespeed.ai'

interface WavespeedCreateInput {
  model: string
  prompt?: string
  negativePrompt?: string
  aspectRatio?: string
  duration?: number
  imageInput?: string[]
  images?: string[] // For GPT Image 2 Edit (array of image URLs)
  cfgScale?: number
  sound?: boolean
  shotType?: string
  endImage?: string
  quality?: string // GPT Image 2: low, medium, high
  resolution?: string // GPT Image 2: 1k, 2k, 4k
  webhookUrl?: string
}

/**
 * Get all active WaveSpeed API keys
 */
async function getWavespeedKeys(): Promise<{ id: string; key: string; name: string | null }[]> {
  const apiKeys = await db.apiKey.findMany({
    where: { isActive: true, provider: 'WAVESPEED' },
    orderBy: { createdAt: 'asc' },
  })
  return apiKeys.map((k) => ({ id: k.id, key: k.key, name: k.name }))
}

/**
 * Fetch webhook secret for a specific WaveSpeed API key
 * GET https://api.wavespeed.ai/api/v3/webhook/secret
 */
export async function fetchWebhookSecret(apiKey: string): Promise<string | null> {
  try {
    const response = await fetch(`${WAVESPEED_BASE_URL}/api/v3/webhook/secret`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })
    if (!response.ok) {
      console.warn(`[WaveSpeed] Failed to fetch webhook secret: ${response.status}`)
      return null
    }
    const data = await response.json()
    // Response: { code: 200, data: { secret: "whsec_..." } }
    const secret = data?.data?.secret || data?.secret || data?.data
    if (typeof secret === 'string' && secret.length > 0) {
      return secret
    }
    console.warn(`[WaveSpeed] Unexpected webhook secret response format:`, JSON.stringify(data).substring(0, 200))
    return null
  } catch (err) {
    console.error('[WaveSpeed] Error fetching webhook secret:', err)
    return null
  }
}

/**
 * Fetch webhook secrets for all active WaveSpeed keys (with cache)
 */
const webhookSecretCache: Map<string, { secret: string; fetchedAt: number }> = new Map()
const WEBHOOK_SECRET_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function fetchAllWebhookSecrets(): Promise<string[]> {
  const keys = await getWavespeedKeys()
  if (keys.length === 0) return []

  const secrets: string[] = []
  for (const apiKey of keys) {
    // Check cache
    const cached = webhookSecretCache.get(apiKey.key)
    if (cached && Date.now() - cached.fetchedAt < WEBHOOK_SECRET_CACHE_TTL) {
      secrets.push(cached.secret)
      continue
    }

    // Fetch fresh
    const secret = await fetchWebhookSecret(apiKey.key)
    if (secret) {
      webhookSecretCache.set(apiKey.key, { secret, fetchedAt: Date.now() })
      secrets.push(secret)
    }
  }

  return secrets
}

/**
 * Check if a WaveSpeed error means key has no credits (should try next key)
 */
function isRetryableError(errorMsg: string): boolean {
  const lower = errorMsg.toLowerCase()
  return (
    lower.includes('402') ||
    lower.includes('insufficient') ||
    lower.includes('rate limit') ||
    lower.includes('429') ||
    lower.includes('quota') ||
    lower.includes('credit') ||
    lower.includes('balance') ||
    lower.includes('no balance') ||
    lower.includes('no credit') ||
    lower.includes('out of credit') ||
    lower.includes('out of balance') ||
    lower.includes('payment required') ||
    lower.includes('funds')
  )
}

/**
 * Create a generation task on WaveSpeed.AI with automatic key failover
 *
 * WaveSpeed API format:
 * POST https://api.wavespeed.ai/api/v3/{model}?webhook=https://your-domain/callback
 * Authorization: Bearer {api_key}
 * Body: { prompt, negative_prompt, aspect_ratio, duration, ... }
 * Response: { data: { id: "...", status: "pending" } }
 */
export async function createWavespeedTask(
  input: WavespeedCreateInput
): Promise<{ taskId: string; apiKeyId: string }> {
  const allKeys = await getWavespeedKeys()

  if (allKeys.length === 0) {
    throw new Error('No active WaveSpeed API keys available. Please add a WaveSpeed API key in the admin panel.')
  }

  const body: Record<string, unknown> = {}

  if (input.prompt) body.prompt = input.prompt
  if (input.negativePrompt) body.negative_prompt = input.negativePrompt
  if (input.aspectRatio) body.aspect_ratio = input.aspectRatio
  if (input.duration) body.duration = input.duration
  if (input.imageInput && input.imageInput.length > 0) {
    body.image = input.imageInput[0]
  }
  // GPT Image 2 Edit uses 'images' array
  if (input.images && input.images.length > 0) {
    body.images = input.images
  }
  if (input.cfgScale !== undefined) body.cfg_scale = input.cfgScale
  if (input.sound !== undefined) body.sound = input.sound
  // Only send shot_type for 'customize' — 'intelligent' is the API default, do not send it
  if (input.shotType && input.shotType !== 'intelligent') body.shot_type = input.shotType
  if (input.endImage) body.end_image = input.endImage
  // GPT Image 2 params
  if (input.quality) body.quality = input.quality
  if (input.resolution) body.resolution = input.resolution
  // Kling models require element_list and multi_prompt
  if (input.model.includes('kling')) {
    body.element_list = []
    body.multi_prompt = []
  }

  // Webhook URL goes in QUERY PARAMETER per WaveSpeed docs:
  // POST /api/v3/{model}?webhook=https://your-domain/callback
  const webhookParam = input.webhookUrl ? `?webhook=${encodeURIComponent(input.webhookUrl)}` : ''

  // Try each key with automatic failover
  let lastError: string = ''
  for (const apiKey of allKeys) {
    try {
      console.log(`[WaveSpeed] Trying key: ${apiKey.name || apiKey.id.substring(0, 8)}... model=${input.model}`)
      console.log(`[WaveSpeed] URL: ${WAVESPEED_BASE_URL}/api/v3/${input.model}${webhookParam}`)
      console.log(`[WaveSpeed] Body fields: ${Object.keys(body).join(', ')}`)

      const response = await fetch(`${WAVESPEED_BASE_URL}/api/v3/${input.model}${webhookParam}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          Authorization: `Bearer ${apiKey.key}`,
        },
        body: JSON.stringify(body),
      })

      // Read raw text first for better error diagnostics
      const responseText = await response.text()
      console.log(`[WaveSpeed] Response (${response.status}):`, responseText.substring(0, 500))

      let data: Record<string, unknown>
      try {
        data = JSON.parse(responseText)
      } catch {
        lastError = `HTTP ${response.status} - Invalid JSON: ${responseText.substring(0, 200)}`
        console.error(`[WaveSpeed] JSON parse error for model=${input.model}:`, responseText.substring(0, 200))
        continue
      }

      // WaveSpeed returns { data: { id: "...", status: "pending" } }
      const taskData = data.data as Record<string, unknown> | undefined
      const taskId = taskData?.id as string | undefined
      const taskStatus = taskData?.status as string | undefined

      if (taskId && (taskStatus === 'created' || taskStatus === 'pending' || taskStatus === 'completed')) {
        console.log(`[WaveSpeed] ✓ Task created: ${taskId} with key: ${apiKey.name || apiKey.id.substring(0, 8)}...`)

        await db.apiKey.update({
          where: { id: apiKey.id },
          data: {
            usageCount: { increment: 1 },
            lastUsedAt: new Date().toISOString(),
          },
        })

        return {
          taskId,
          apiKeyId: apiKey.id,
        }
      }

      // Build comprehensive error message
      const topCode = data.code as number | undefined
      const topMsg = data.message as string | undefined
      const topErr = data.error as string | undefined
      const innerCode = taskData?.code as number | undefined
      const innerMsg = taskData?.message as string | undefined
      const innerErr = taskData?.error as string | undefined
      const httpStatus = response.status

      const allErrorParts = [
        httpStatus === 402 ? 'HTTP 402 payment required' : '',
        httpStatus === 429 ? 'HTTP 429 rate limit' : '',
        topCode === 402 ? 'code 402' : '',
        topCode === 429 ? 'code 429' : '',
        innerCode === 402 ? 'code 402' : '',
        innerCode === 429 ? 'code 429' : '',
        topMsg || '',
        topErr || '',
        innerMsg || '',
        innerErr || '',
      ].filter(Boolean).join(' | ')

      lastError = allErrorParts || `HTTP ${httpStatus} status=${taskData?.status || '?'}`

      console.log(`[WaveSpeed] ✗ Key "${apiKey.name || apiKey.id.substring(0, 8)}..." failed: ${lastError}`)

      if (isRetryableError(lastError)) {
        console.warn(`[WaveSpeed] ⚠ Key "${apiKey.name || apiKey.id.substring(0, 8)}..." failed: ${lastError}. Trying next key...`)
        continue
      }

      // Non-retryable error, stop
      break
    } catch (fetchError) {
      lastError = fetchError instanceof Error ? fetchError.message : String(fetchError)
      console.warn(`[WaveSpeed] ⚠ Key ${apiKey.name || apiKey.id.substring(0, 8)}... error: ${lastError}. Trying next key...`)
      continue
    }
  }

  throw new Error(`All WaveSpeed API keys failed. Last error: ${lastError}`)
}

/**
 * Check WaveSpeed task status
 *
 * GET https://api.wavespeed.ai/api/v3/predictions/{requestId}/result
 * Response: { data: { id, status: "pending"|"completed"|"failed", outputs: [...] } }
 */
export async function checkWavespeedTaskStatus(
  taskId: string,
  apiKey: string
): Promise<{ state: string; status: string; resultJson: string | null; result: unknown }> {
  const response = await fetch(
    `${WAVESPEED_BASE_URL}/api/v3/predictions/${encodeURIComponent(taskId)}/result`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`WaveSpeed API error (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  const taskData = data.data as Record<string, unknown> | undefined
  const status = (taskData?.status || data.status || 'pending') as string
  const outputs = (taskData?.outputs || data.outputs) as unknown[] | undefined
  console.log(`[WaveSpeed] Task ${taskId} status: ${status}`)

  const state = status === 'completed' ? 'SUCCEED'
    : status === 'failed' ? 'FAILED'
    : 'RUNNING'

  const resultJson = outputs && outputs.length > 0
    ? JSON.stringify(outputs)
    : null

  return {
    state,
    status,
    resultJson,
    result: outputs || null,
  }
}

/**
 * Extract result URL from WaveSpeed task result
 * WaveSpeed returns { outputs: ["url1", "url2"] }
 */
export function extractWavespeedResultUrl(result: unknown): string | null {
  if (!result) return null
  if (Array.isArray(result) && result.length > 0) {
    return typeof result[0] === 'string' ? result[0] : null
  }
  return null
}
