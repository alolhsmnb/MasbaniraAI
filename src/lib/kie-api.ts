import { db } from '@/lib/db'

const KIE_BASE_URL = 'https://api.kie.ai/api/v1'

// In-memory round-robin index for key rotation
let currentKeyIndex = 0

export interface CreateTaskInput {
  prompt: string
  aspect_ratio?: string
  resolution?: string
  output_format?: string
  image_input?: string[]
  image_urls?: string[]
  mode?: string
  duration?: number | string
  n_frames?: string
  remove_watermark?: boolean
  upload_method?: string
  nsfw_checker?: boolean
  // Seedance-specific fields
  web_search?: boolean
  generate_audio?: boolean
  first_frame_url?: string
  last_frame_url?: string
  reference_image_urls?: string[]
  reference_video_urls?: string[]
  reference_audio_urls?: string[]
}

export interface VeoCreateInput {
  prompt: string
  model: string
  imageUrls?: string[]
  generationType?: string
  aspect_ratio?: string
  resolution?: string
  enableTranslation?: boolean
  watermark?: string
}

interface CreateTaskResponse {
  code: number
  msg: string
  data: {
    taskId: string
  }
}

export interface TaskStatusResult {
  state?: string
  status?: string
  resultJson?: string
  result?: string | string[] | Record<string, unknown> | null
  [key: string]: unknown
}

interface TaskStatusResponse {
  code: number
  msg?: string
  data: TaskStatusResult
}

/**
 * Get all active API keys (for retry logic)
 */
export async function getAllActiveApiKeys(): Promise<{ id: string; key: string; name: string | null }[]> {
  const apiKeys = await db.apiKey.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  })
  return apiKeys.map((k) => ({ id: k.id, key: k.key, name: k.name }))
}

/**
 * Get the next active API key using round-robin rotation
 */
export async function getNextApiKey(): Promise<{ id: string; key: string; name: string | null } | null> {
  const apiKeys = await getAllActiveApiKeys()

  if (apiKeys.length === 0) return null

  const idx = currentKeyIndex % apiKeys.length
  currentKeyIndex = (idx + 1) % apiKeys.length
  return apiKeys[idx]
}

/**
 * Check if an API error is retryable (insufficient credits, rate limit)
 */
function isRetryableError(errorMsg: string): boolean {
  const lower = errorMsg.toLowerCase()
  return (
    lower.includes('402') ||
    lower.includes('insufficient credits') ||
    lower.includes('rate limit') ||
    lower.includes('429') ||
    lower.includes('quota') ||
    lower.includes('credit')
  )
}

/**
 * Create a new generation task on KIE.AI with automatic key failover
 */
export async function createTask(
  model: string,
  input: CreateTaskInput
): Promise<{ taskId: string; apiKeyId: string }> {
  const allKeys = await getAllActiveApiKeys()

  if (allKeys.length === 0) {
    throw new Error('No active API keys available')
  }

  const inputObj: Record<string, unknown> = {
    prompt: input.prompt,
  }

  if (input.aspect_ratio) {
    inputObj.aspect_ratio = input.aspect_ratio
  }
  if (input.resolution && input.resolution !== 'Auto') {
    inputObj.resolution = input.resolution
  }
  if (input.output_format) {
    inputObj.output_format = input.output_format
  }
  if (input.image_input && input.image_input.length > 0) {
    inputObj.image_input = input.image_input
  }
  if (input.image_urls && input.image_urls.length > 0) {
    inputObj.image_urls = input.image_urls
  }
  if (input.mode) {
    inputObj.mode = input.mode
  }
  if (input.duration) {
    inputObj.duration = input.duration
  }
  if (input.n_frames) {
    inputObj.n_frames = input.n_frames
  }
  if (input.remove_watermark !== undefined) {
    inputObj.remove_watermark = input.remove_watermark
  }
  if (input.upload_method) {
    inputObj.upload_method = input.upload_method
  }
  // Seedance-specific fields
  if (input.web_search !== undefined) {
    inputObj.web_search = input.web_search
  }
  if (input.generate_audio !== undefined) {
    inputObj.generate_audio = input.generate_audio
  }
  if (input.first_frame_url) {
    inputObj.first_frame_url = input.first_frame_url
  }
  if (input.last_frame_url) {
    inputObj.last_frame_url = input.last_frame_url
  }
  if (input.reference_image_urls && input.reference_image_urls.length > 0) {
    inputObj.reference_image_urls = input.reference_image_urls
  }
  if (input.reference_video_urls && input.reference_video_urls.length > 0) {
    inputObj.reference_video_urls = input.reference_video_urls
  }
  if (input.reference_audio_urls && input.reference_audio_urls.length > 0) {
    inputObj.reference_audio_urls = input.reference_audio_urls
  }

  const body: Record<string, unknown> = {
    model,
    input: inputObj,
  }

  const baseUrl = process.env.NEXTAUTH_URL?.replace(/[\r\n\s]+/g, '')
  if (baseUrl) {
    body.callBackUrl = `${baseUrl}/api/generate/callback`
  }

  // Try each key with automatic failover
  let lastError: string = ''
  for (const apiKey of allKeys) {
    try {
      console.log(`[KIE.AI] Trying key: ${apiKey.name || apiKey.id.substring(0, 8)}...`)

      const response = await fetch(`${KIE_BASE_URL}/jobs/createTask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.key}`,
        },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (data.code === 200 && data.data?.taskId) {
        console.log(`[KIE.AI] ✓ Task created with key: ${apiKey.name || apiKey.id.substring(0, 8)}...`)

        await db.apiKey.update({
          where: { id: apiKey.id },
          data: {
            usageCount: { increment: 1 },
            lastUsedAt: new Date().toISOString(),
          },
        })

        return {
          taskId: data.data.taskId,
          apiKeyId: apiKey.id,
        }
      }

      lastError = `code=${data.code} msg=${data.msg || ''}`

      // If retryable error (insufficient credits, rate limit), try next key
      if (isRetryableError(lastError)) {
        console.warn(`[KIE.AI] ⚠ Key ${apiKey.name || apiKey.id.substring(0, 8)}... failed: ${lastError}. Trying next key...`)
        continue
      }

      // Non-retryable error, stop
      break
    } catch (fetchError) {
      lastError = fetchError instanceof Error ? fetchError.message : String(fetchError)
      console.warn(`[KIE.AI] ⚠ Key ${apiKey.name || apiKey.id.substring(0, 8)}... error: ${lastError}. Trying next key...`)
      continue
    }
  }

  throw new Error(`All API keys failed. Last error: ${lastError}`)
}

/**
 * Check the status of a generation task using the recordInfo endpoint
 */
export async function checkTaskStatus(
  taskId: string,
  apiKey: string
): Promise<TaskStatusResult> {
  const response = await fetch(
    `${KIE_BASE_URL}/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`KIE.AI API error (${response.status}): ${errorText}`)
  }

  const data = await response.json()

  // Log raw response for debugging
  console.log(`[KIE.AI] recordInfo response for ${taskId}:`, JSON.stringify(data).substring(0, 2000))

  if (data.code !== 200) {
    throw new Error(`KIE.AI API returned error: code=${data.code} msg=${data.msg}`)
  }

  const result = data.data || data
  
  // Log full task details for video models (Seedance, etc.) for debugging
  const taskState = (result as any).state || (result as any).status || 'unknown'
  console.log(`[KIE.AI] recordInfo task ${taskId}: state=${taskState}, hasResultJson=${!!(result as any).resultJson}, hasResult=${!!(result as any).result}`)
  
  return result
}

/**
 * Extract image URL from KIE.AI task result
 * 
 * KIE.AI returns results in `resultJson` field as a JSON string:
 * {"resultUrls":["https://tempfile.aiquickdraw.com/images/xxx.png"]}
 * 
 * It may also be a callback with different formats.
 */
export function extractResultUrl(result: unknown): string | null {
  if (!result) return null

  // If result is a direct URL string
  if (typeof result === 'string') {
    // First try to parse it as JSON (resultJson format)
    if (result.startsWith('{') || result.startsWith('[')) {
      try {
        const parsed = JSON.parse(result)
        return extractResultUrl(parsed)
      } catch {
        // Not valid JSON, check if it's a URL
      }
    }
    if (result.startsWith('http://') || result.startsWith('https://')) {
      return result
    }
    return null
  }

  // If result is an array
  if (Array.isArray(result)) {
    for (const item of result) {
      if (typeof item === 'string' && (item.startsWith('http://') || item.startsWith('https://'))) {
        return item
      }
      if (typeof item === 'object' && item !== null) {
        const url = extractFromObject(item as Record<string, unknown>)
        if (url) return url
      }
    }
  }

  // If result is an object
  if (typeof result === 'object' && result !== null && !Array.isArray(result)) {
    return extractFromObject(result as Record<string, unknown>)
  }

  return null
}

/**
 * Helper to extract URL from an object with various field names
 * Handles both image and video URL formats
 */
function extractFromObject(obj: Record<string, unknown>): string | null {
  // Direct URL fields (including video-specific ones)
  for (const field of ['url', 'image_url', 'output_url', 'file_url', 'video_url', 'videoUrl', 'mp4_url', 'mp4', 'download_url', 'result', 'image', 'src', 'link', 'originUrl', 'origin_url', 'video', 'audio_url', 'audioUrl']) {
    const val = obj[field]
    if (typeof val === 'string' && (val.startsWith('http://') || val.startsWith('https://'))) {
      return val
    }
  }

  // resultUrls array (KIE.AI specific format)
  if (Array.isArray(obj.resultUrls)) {
    for (const item of obj.resultUrls) {
      if (typeof item === 'string' && (item.startsWith('http://') || item.startsWith('https://'))) {
        return item
      }
      // Some APIs return objects with url field in resultUrls
      if (typeof item === 'object' && item !== null) {
        const url = extractFromObject(item as Record<string, unknown>)
        if (url) return url
      }
    }
  }

  // originUrls array (used by some KIE.AI models)
  if (Array.isArray(obj.originUrls)) {
    for (const item of obj.originUrls) {
      if (typeof item === 'string' && (item.startsWith('http://') || item.startsWith('https://'))) {
        return item
      }
    }
  }

  // videos array (used by Seedance and other video models)
  if (Array.isArray(obj.videos)) {
    for (const v of obj.videos) {
      if (typeof v === 'string' && (v.startsWith('http://') || v.startsWith('https://'))) return v
      if (typeof v === 'object' && v !== null) {
        const url = extractFromObject(v as Record<string, unknown>)
        if (url) return url
      }
    }
  }

  // Nested in images array
  if (Array.isArray(obj.images)) {
    for (const img of obj.images) {
      if (typeof img === 'string' && (img.startsWith('http://') || img.startsWith('https://'))) return img
      if (typeof img === 'object' && img !== null) {
        const imgObj = img as Record<string, unknown>
        for (const field of ['url', 'image_url', 'output_url', 'file_url', 'src', 'link']) {
          if (typeof imgObj[field] === 'string' && (imgObj[field] as string).startsWith('http')) {
            return imgObj[field] as string
          }
        }
      }
    }
  }

  // Nested in results array
  if (Array.isArray(obj.results)) {
    for (const r of obj.results) {
      if (typeof r === 'string' && (r.startsWith('http://') || r.startsWith('https://'))) return r
      if (typeof r === 'object' && r !== null) {
        const url = extractFromObject(r as Record<string, unknown>)
        if (url) return url
      }
    }
  }

  // Nested in data field
  if (obj.data && typeof obj.data === 'object' && obj.data !== null) {
    const url = extractFromObject(obj.data as Record<string, unknown>)
    if (url) return url
  }

  // resultJson field - parse it and extract
  if (typeof obj.resultJson === 'string') {
    try {
      const parsed = JSON.parse(obj.resultJson)
      return extractResultUrl(parsed)
    } catch {
      // Not valid JSON
    }
  }

  return null
}

/**
 * Check if task is completed based on various status formats
 * KIE.AI uses "state" field with value "success"
 */
export function isTaskCompleted(data: TaskStatusResult): boolean {
  // KIE.AI specific: "state" field with various values
  // Standard models use "success", newer models (Seedance, etc.) use "succeed"
  const state = (data.state || '').toString().toLowerCase()
  const status = (data.status || '').toString().toLowerCase()
  
  const completedStates = ['success', 'succeed', 'completed', 'done', 'finished', 'succeeded', 'complete']
  
  return completedStates.includes(state) || completedStates.includes(status)
}

/**
 * Check if task has failed
 */
export function isTaskFailed(data: TaskStatusResult): boolean {
  const state = (data.state || '').toString().toLowerCase()
  const status = (data.status || '').toString().toLowerCase()
  
  const failedStates = ['failed', 'failure', 'error', 'cancelled', 'canceled', 'aborted', 'abort', 'timeout', 'timedout']
  
  return failedStates.includes(state) || failedStates.includes(status)
}

/**
 * Get all API keys from the database (for admin use)
 */
export async function getAllApiKeys() {
  return db.apiKey.findMany({
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Create a Veo 3.1 video generation task
 * Uses a different endpoint: /api/v1/veo/generate (flat body, not nested input)
 */
export async function createVeoTask(
  input: VeoCreateInput
): Promise<{ taskId: string; apiKeyId: string }> {
  const allKeys = await getAllActiveApiKeys()

  if (allKeys.length === 0) {
    throw new Error('No active API keys available')
  }

  const body: Record<string, unknown> = {
    prompt: input.prompt,
    model: input.model,
    aspect_ratio: input.aspect_ratio || '16:9',
    enableTranslation: input.enableTranslation !== false,
  }

  if (input.imageUrls && input.imageUrls.length > 0) {
    body.imageUrls = input.imageUrls
    body.generationType = input.generationType || 'FIRST_AND_LAST_FRAMES_2_VIDEO'
  } else {
    body.generationType = 'TEXT_2_VIDEO'
  }

  if (input.resolution) {
    body.resolution = input.resolution
  }

  if (input.watermark) {
    body.watermark = input.watermark
  }

  const baseUrl = process.env.NEXTAUTH_URL?.replace(/[\r\n\s]+/g, '')
  if (baseUrl) {
    body.callBackUrl = `${baseUrl}/api/generate/callback`
  }

  // Log the full request body for debugging
  console.log(`[KIE.AI] Veo request body:`, JSON.stringify(body))

  // Try each key with automatic failover
  let lastError: string = ''
  for (const apiKey of allKeys) {
    try {
      console.log(`[KIE.AI] Veo trying key: ${apiKey.name || apiKey.id.substring(0, 8)}... model=${input.model}`)

      const response = await fetch(`${KIE_BASE_URL}/veo/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.key}`,
        },
        body: JSON.stringify(body),
      })

      const data = await response.json()
      console.log(`[KIE.AI] Veo response:`, JSON.stringify(data))

      if (data.code === 200 && data.data?.taskId) {
        console.log(`[KIE.AI] ✓ Veo task created with key: ${apiKey.name || apiKey.id.substring(0, 8)}...`)

        await db.apiKey.update({
          where: { id: apiKey.id },
          data: {
            usageCount: { increment: 1 },
            lastUsedAt: new Date().toISOString(),
          },
        })

        return {
          taskId: data.data.taskId,
          apiKeyId: apiKey.id,
        }
      }

      lastError = `code=${data.code} msg=${data.msg || ''}`

      // Log full Veo error for debugging
      console.error(`[KIE.AI] Veo API error:`, JSON.stringify(data))

      if (isRetryableError(lastError)) {
        console.warn(`[KIE.AI] ⚠ Key ${apiKey.name || apiKey.id.substring(0, 8)}... failed: ${lastError}. Trying next key...`)
        continue
      }

      break
    } catch (fetchError) {
      lastError = fetchError instanceof Error ? fetchError.message : String(fetchError)
      console.warn(`[KIE.AI] ⚠ Key ${apiKey.name || apiKey.id.substring(0, 8)}... error: ${lastError}. Trying next key...`)
      continue
    }
  }

  throw new Error(`All API keys failed. Last error: ${lastError}`)
}

/**
 * Check Veo task status using the Veo-specific videoDetails endpoint
 * (recordInfo does NOT work for Veo tasks)
 */
export async function checkVeoTaskStatus(
  taskId: string,
  apiKey: string
): Promise<TaskStatusResult> {
  const response = await fetch(
    `${KIE_BASE_URL}/veo/videoDetails?taskId=${encodeURIComponent(taskId)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`KIE.AI Veo API error (${response.status}): ${errorText}`)
  }

  const data = await response.json()

  // Log raw response for debugging
  console.log(`[KIE.AI] Veo videoDetails response for ${taskId}:`, JSON.stringify(data).substring(0, 2000))

  if (data.code !== 200) {
    throw new Error(`KIE.AI Veo API returned error: code=${data.code} msg=${data.msg}`)
  }

  const result = data.data || data

  // Veo response format:
  // { code: 200, data: { taskId, status, info: { resultUrls, resolution } } }
  // status: "pending" | "processing" | "completed" | "failed"
  const veoStatus = (result as any).status || ''

  // Map Veo status to standard TaskStatusResult format
  if (veoStatus === 'completed' || veoStatus === 'success') {
    const info = (result as any).info || {}
    const resultUrls = info.resultUrls
    // resultUrls can be a JSON string like '["url1","url2"]' or a string like '["url"]'
    let urlData = resultUrls
    if (typeof urlData === 'string') {
      try { urlData = JSON.parse(urlData) } catch { /* keep as string */ }
    }

    return {
      state: 'SUCCEED',
      status: 'completed',
      resultJson: typeof urlData === 'string' ? urlData : JSON.stringify(urlData),
      result: urlData,
    }
  } else if (veoStatus === 'failed') {
    return {
      state: 'FAILED',
      status: 'failed',
      resultJson: JSON.stringify({ code: 501, msg: 'Veo generation failed' }),
      result: null,
    }
  } else {
    // Still processing (pending, processing, etc.)
    return {
      state: 'RUNNING',
      status: veoStatus || 'processing',
      resultJson: null,
      result: null,
    }
  }
}
