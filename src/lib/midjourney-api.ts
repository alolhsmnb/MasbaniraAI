import { getAllActiveApiKeys, isRetryableError } from '@/lib/kie-api'
import { db } from '@/lib/db'

const KIE_BASE_URL = 'https://api.kie.ai/api/v1'

export interface MjGenerateInput {
  taskType: 'mj_txt2img' | 'mj_img2img' | 'mj_video' | 'mj_style_reference' | 'mj_omni_reference'
  prompt: string
  speed?: 'relaxed' | 'fast' | 'turbo'
  fileUrls?: string[]
  aspectRatio?: string
  version?: string
  variety?: number
  stylization?: number
  weirdness?: number
  waterMark?: string
}

export interface MjUpscaleInput {
  taskId: string
  imageIndex: number
  waterMark?: string
}

export interface MjVaryInput {
  taskId: string
  imageIndex: number
  waterMark?: string
}

interface MjTaskResponse {
  code: number | string
  msg: string
  data: {
    taskId: string
  }
}

export interface MjTaskStatus {
  taskId: string
  taskType: string
  paramJson: string
  completeTime: string | null
  resultInfoJson: Record<string, unknown> | string | null
  successFlag: number | string | boolean | null
  createTime: string
  errorCode: number | string | null
  errorMessage: string | null
}

/**
 * Create a Midjourney generation task with automatic key failover
 */
export async function createMjTask(
  input: MjGenerateInput
): Promise<{ taskId: string; apiKeyId: string }> {
  const allKeys = await getAllActiveApiKeys()

  if (allKeys.length === 0) {
    throw new Error('No active API keys available')
  }

  const body: Record<string, unknown> = {
    taskType: input.taskType,
    prompt: input.prompt,
  }

  if (input.speed) body.speed = input.speed
  if (input.fileUrls && input.fileUrls.length > 0) body.fileUrls = input.fileUrls
  if (input.aspectRatio) body.aspectRatio = input.aspectRatio
  if (input.version) body.version = input.version
  if (input.variety !== undefined) body.variety = input.variety
  if (input.stylization !== undefined) body.stylization = input.stylization
  if (input.weirdness !== undefined) body.weirdness = input.weirdness
  if (input.waterMark) body.waterMark = input.waterMark

  const baseUrl = process.env.NEXTAUTH_URL
  if (baseUrl) {
    body.callBackUrl = `${baseUrl}/api/generate/callback`
  }

  let lastError = ''
  for (const apiKey of allKeys) {
    try {
      console.log(`[Midjourney] Trying key: ${apiKey.name || apiKey.id.substring(0, 8)}...`)

      const response = await fetch(`${KIE_BASE_URL}/mj/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.key}`,
        },
        body: JSON.stringify(body),
      })

      const data: MjTaskResponse = await response.json()

      if (Number(data.code) === 200 && data.data?.taskId) {
        console.log(`[Midjourney] ✓ Task created: ${data.data.taskId} with key: ${apiKey.name || apiKey.id.substring(0, 8)}...`)

        await db.apiKey.update({
          where: { id: apiKey.id },
          data: {
            usageCount: { increment: 1 },
            lastUsedAt: new Date().toISOString(),
          },
        })

        return { taskId: data.data.taskId, apiKeyId: apiKey.id }
      }

      lastError = `code=${data.code} msg=${data.msg || ''}`

      if (isRetryableError(lastError)) {
        console.warn(`[Midjourney] ⚠ Key failed: ${lastError}. Trying next...`)
        continue
      }
      break
    } catch (fetchError) {
      lastError = fetchError instanceof Error ? fetchError.message : String(fetchError)
      console.warn(`[Midjourney] ⚠ Key error: ${lastError}. Trying next...`)
      continue
    }
  }

  throw new Error(`All API keys failed for Midjourney. Last error: ${lastError}`)
}

/**
 * Check Midjourney task status
 * 
 * API: GET /api/v1/mj/record-info?taskId={taskId}
 * Response: { code: 200, data: { successFlag, resultInfoJson: { resultUrls: [{ resultUrl }] } } }
 * 
 * successFlag: 0=Generating, 1=Success, 2=Failed, 3=Generation Failed
 */
export async function checkMjTaskStatus(
  taskId: string,
  apiKey: string
): Promise<MjTaskStatus> {
  const url = `${KIE_BASE_URL}/mj/record-info?taskId=${encodeURIComponent(taskId)}`

  console.log(`[MJ Poll] Checking status for taskId=${taskId} with key=${apiKey.substring(0, 8)}...`)

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Midjourney API error (${response.status}): ${errorText}`)
  }

  const raw = await response.json()
  
  // Log the FULL raw response for debugging
  console.log(`[MJ Poll] RAW response for taskId=${taskId}:`, JSON.stringify(raw, null, 2).substring(0, 3000))

  // Handle response format: { code, msg, data: { ... } }
  const code = Number(raw.code)

  if (code !== 200) {
    console.error(`[MJ Poll] API returned error: code=${raw.code} msg=${raw.msg}`)
    throw new Error(`Midjourney API error: code=${raw.code} msg=${raw.msg}`)
  }

  // data.data might not exist in some edge cases
  if (!raw.data || typeof raw.data !== 'object') {
    console.error(`[MJ Poll] Invalid data:`, JSON.stringify(raw).substring(0, 500))
    throw new Error(`Midjourney API returned invalid data: ${JSON.stringify(raw).substring(0, 300)}`)
  }

  // Parse resultInfoJson if it's a string
  let resultInfoJson = raw.data.resultInfoJson
  if (typeof resultInfoJson === 'string') {
    try {
      resultInfoJson = JSON.parse(resultInfoJson)
      console.log(`[MJ Poll] Parsed resultInfoJson from string`)
    } catch {
      console.warn(`[MJ Poll] Failed to parse resultInfoJson string:`, resultInfoJson?.substring(0, 200))
    }
  }

  // Extract successFlag - normalize to number
  let successFlag = raw.data.successFlag
  if (typeof successFlag === 'string') {
    successFlag = Number(successFlag)
  }

  const status: MjTaskStatus = {
    taskId: raw.data.taskId || taskId,
    taskType: raw.data.taskType || 'unknown',
    paramJson: raw.data.paramJson || '',
    completeTime: raw.data.completeTime || null,
    resultInfoJson: resultInfoJson || null,
    successFlag,
    createTime: raw.data.createTime || '',
    errorCode: raw.data.errorCode ?? null,
    errorMessage: raw.data.errorMessage ?? null,
  }

  console.log(`[MJ Poll] Parsed status: taskId=${status.taskId}, successFlag=${status.successFlag} (${typeof successFlag}), hasResultInfo=${!!status.resultInfoJson}, completeTime=${status.completeTime}`)

  return status
}

/**
 * Extract all result URLs from Midjourney task status.
 * 
 * Handles multiple response formats:
 * 1. record-info: resultInfoJson.resultUrls[{resultUrl: "..."}]
 * 2. callback: data.resultUrls["url1", "url2", ...]
 * 3. Fallback: regex scan for image URLs in raw response
 */
export function extractMjResultUrls(taskStatus: MjTaskStatus | Record<string, unknown>): string[] {
  const urls: string[] = []
  const status = taskStatus as Record<string, unknown>

  console.log(`[MJ Extract] Starting URL extraction from taskStatus...`)

  // ─── Method 1: Direct resultUrls array (callback format) ───
  if (Array.isArray(status.resultUrls)) {
    console.log(`[MJ Extract] Found resultUrls array with ${status.resultUrls.length} items (callback format)`)
    for (const item of status.resultUrls) {
      if (typeof item === 'string' && item.startsWith('http')) {
        urls.push(item)
      } else if (item && typeof item === 'object' && (item as Record<string, unknown>).resultUrl) {
        const u = String((item as Record<string, unknown>).resultUrl)
        if (u.startsWith('http')) urls.push(u)
      }
    }
  }

  // ─── Method 2: resultInfoJson.resultUrls (record-info format) ───
  const resultInfoJson = status.resultInfoJson
  if (resultInfoJson && typeof resultInfoJson === 'object' && !Array.isArray(resultInfoJson)) {
    const infoObj = resultInfoJson as Record<string, unknown>
    const resultUrlsArr = infoObj.resultUrls
    if (Array.isArray(resultUrlsArr)) {
      console.log(`[MJ Extract] Found resultInfoJson.resultUrls with ${resultUrlsArr.length} items (record-info format)`)
      for (const item of resultUrlsArr) {
        if (typeof item === 'string' && item.startsWith('http')) {
          urls.push(item)
        } else if (item && typeof item === 'object' && (item as Record<string, unknown>).resultUrl) {
          const u = String((item as Record<string, unknown>).resultUrl)
          if (u.startsWith('http')) {
            urls.push(u)
            console.log(`[MJ Extract] Extracted URL from resultUrl object: ${u.substring(0, 80)}...`)
          }
        }
      }
    }
  }

  // ─── Method 3: Try parsing resultInfoJson as string first ───
  if (urls.length === 0 && typeof resultInfoJson === 'string') {
    try {
      const parsed = JSON.parse(resultInfoJson)
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.resultUrls)) {
        console.log(`[MJ Extract] Parsed resultInfoJson string, found ${parsed.resultUrls.length} URLs`)
        for (const item of parsed.resultUrls) {
          if (typeof item === 'string' && item.startsWith('http')) {
            urls.push(item)
          } else if (item && typeof item === 'object' && item.resultUrl) {
            const u = String(item.resultUrl)
            if (u.startsWith('http')) urls.push(u)
          }
        }
      }
    } catch {
      // Not valid JSON string
    }
  }

  // ─── Method 4: Regex fallback - scan entire response for URLs ───
  if (urls.length === 0) {
    const rawStr = JSON.stringify(status)
    console.log(`[MJ Extract] No URLs found yet, scanning raw string (${rawStr.length} chars) for URLs...`)
    const urlMatches = rawStr.match(/https?:\/\/[^\s"'<>\\\]}]+\.(?:png|jpg|jpeg|gif|webp|bmp)/gi)
    if (urlMatches) {
      console.log(`[MJ Extract] Regex found ${urlMatches.length} URLs`)
      urls.push(...urlMatches)
    }
  }

  console.log(`[MJ Extract] Total URLs extracted: ${urls.length}`)
  if (urls.length > 0) {
    urls.forEach((u, i) => console.log(`[MJ Extract] URL[${i}]: ${u.substring(0, 100)}...`))
  }

  return [...new Set(urls)] // deduplicate
}

/**
 * Check if Midjourney task is completed (successFlag === 1)
 */
export function isMjTaskCompleted(status: MjTaskStatus): boolean {
  const flag = status.successFlag
  if (flag === null || flag === undefined) return false
  const numFlag = typeof flag === 'number' ? flag : Number(flag)
  return numFlag === 1
}

/**
 * Check if Midjourney task has failed (successFlag === 2 or 3)
 */
export function isMjTaskFailed(status: MjTaskStatus): boolean {
  const flag = status.successFlag
  if (flag === null || flag === undefined) return false
  const numFlag = typeof flag === 'number' ? flag : Number(flag)
  return numFlag === 2 || numFlag === 3
}

/**
 * Create an upscale task for a specific Midjourney image
 * API: POST /api/v1/mj/generateUpscale { taskId, imageIndex (0-3) }
 */
export async function createMjUpscale(
  input: MjUpscaleInput
): Promise<{ taskId: string; apiKeyId: string }> {
  const allKeys = await getAllActiveApiKeys()
  if (allKeys.length === 0) throw new Error('No active API keys available')

  const body: Record<string, unknown> = {
    taskId: input.taskId,
    imageIndex: input.imageIndex,
  }
  if (input.waterMark) body.waterMark = input.waterMark

  const baseUrl = process.env.NEXTAUTH_URL
  if (baseUrl) body.callBackUrl = `${baseUrl}/api/generate/callback`

  let lastError = ''
  for (const apiKey of allKeys) {
    try {
      const response = await fetch(`${KIE_BASE_URL}/mj/generateUpscale`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.key}`,
        },
        body: JSON.stringify(body),
      })

      const data: MjTaskResponse = await response.json()

      if (Number(data.code) === 200 && data.data?.taskId) {
        await db.apiKey.update({
          where: { id: apiKey.id },
          data: { usageCount: { increment: 1 }, lastUsedAt: new Date().toISOString() },
        })
        return { taskId: data.data.taskId, apiKeyId: apiKey.id }
      }

      lastError = `code=${data.code} msg=${data.msg || ''}`
      if (isRetryableError(lastError)) continue
      break
    } catch (fetchError) {
      lastError = fetchError instanceof Error ? fetchError.message : String(fetchError)
      continue
    }
  }

  throw new Error(`All API keys failed for MJ Upscale. Last error: ${lastError}`)
}

/**
 * Create a vary task for a specific Midjourney image
 * API: POST /api/v1/mj/generateVary { taskId, imageIndex (1-4) }
 */
export async function createMjVary(
  input: MjVaryInput
): Promise<{ taskId: string; apiKeyId: string }> {
  const allKeys = await getAllActiveApiKeys()
  if (allKeys.length === 0) throw new Error('No active API keys available')

  const body: Record<string, unknown> = {
    taskId: input.taskId,
    imageIndex: input.imageIndex,
  }
  if (input.waterMark) body.waterMark = input.waterMark

  const baseUrl = process.env.NEXTAUTH_URL
  if (baseUrl) body.callBackUrl = `${baseUrl}/api/generate/callback`

  let lastError = ''
  for (const apiKey of allKeys) {
    try {
      const response = await fetch(`${KIE_BASE_URL}/mj/generateVary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.key}`,
        },
        body: JSON.stringify(body),
      })

      const data: MjTaskResponse = await response.json()

      if (Number(data.code) === 200 && data.data?.taskId) {
        await db.apiKey.update({
          where: { id: apiKey.id },
          data: { usageCount: { increment: 1 }, lastUsedAt: new Date().toISOString() },
        })
        return { taskId: data.data.taskId, apiKeyId: apiKey.id }
      }

      lastError = `code=${data.code} msg=${data.msg || ''}`
      if (isRetryableError(lastError)) continue
      break
    } catch (fetchError) {
      lastError = fetchError instanceof Error ? fetchError.message : String(fetchError)
      continue
    }
  }

  throw new Error(`All API keys failed for MJ Vary. Last error: ${lastError}`)
}
