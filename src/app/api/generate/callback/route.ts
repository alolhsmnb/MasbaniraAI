import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { extractResultUrl, isTaskCompleted, isTaskFailed } from '@/lib/kie-api'

// Notify WebSocket service about generation update (fire-and-forget)
async function notifyClient(userId: string, taskId: string, status: string, resultUrl?: string | null, errorTitle?: string | null, errorMessage?: string | null) {
  try {
    const notifyUrl = process.env.NOTIFICATION_SERVICE_URL || `http://localhost:3003/notify`
    await fetch(notifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, taskId, status, resultUrl, errorTitle, errorMessage }),
    })
  } catch {
    // Notification service unavailable, silently ignore
  }
}

/**
 * KIE.AI Callback Webhook
 * 
 * KIE.AI POSTs task results here when generation completes.
 * 
 * Expected payload structure:
 * {
 *   taskId: string,
 *   state: "success" | "failed",
 *   resultJson: '{"resultUrls":["https://..."]}',  // JSON string
 *   ...other fields
 * }
 * 
 * Or via data wrapper:
 * {
 *   data: { taskId, state, resultJson, ... }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    console.log('[Callback] Received KIE.AI callback:', JSON.stringify(body).substring(0, 2000))

    // Extract taskId - could be at top level or nested in data
    const taskId = body.taskId || body.data?.taskId || body.id

    if (!taskId) {
      console.error('[Callback] No taskId found in callback body:', JSON.stringify(body).substring(0, 500))
      return NextResponse.json(
        { success: true, message: 'No taskId found' },
        { status: 200 }
      )
    }

    // Find the generation record
    const generation = await db.generation.findFirst({
      where: { taskId },
    })

    if (!generation) {
      console.error(`[Callback] No generation found for taskId: ${taskId}`)
      return NextResponse.json(
        { success: true, message: 'Generation not found' },
        { status: 200 }
      )
    }

    // Skip if already completed or failed
    if (generation.status === 'COMPLETED' || generation.status === 'FAILED') {
      console.log(`[Callback] Generation ${taskId} already ${generation.status}, skipping`)
      return NextResponse.json({ success: true, message: 'Already processed' })
    }

    // Determine status - check both state/status fields AND top-level code (Veo uses code)
    const callbackData = body.data || body
    const callbackCode = body.code || callbackData.code
    const stateOrStatus = callbackData.state || callbackData.status || body.state || body.status || ''

    // Veo-style callback: uses "code" at top level (200 = success, 501 = failed, etc.)
    const isVeoCallback = !!callbackCode && !stateOrStatus
    let isCompleted = false
    let isFailed = false

    if (isVeoCallback) {
      isCompleted = callbackCode === 200
      isFailed = callbackCode >= 400 && callbackCode !== 200
    } else {
      // Standard KIE.AI callback: uses state/status fields
      const statusCheck = { state: stateOrStatus, status: stateOrStatus }
      isCompleted = isTaskCompleted(statusCheck)
      isFailed = isTaskFailed(statusCheck)
    }

    if (isCompleted) {
      // Extract result URL from callback payload
      // Standard models: resultJson field
      // Veo: data.info.resultUrls (JSON string like '["url"]')
      let resultData = callbackData.resultJson || callbackData.result || body.resultJson || body.result || body.output || callbackData.output

      // Veo-specific: extract from data.info.resultUrls
      if (callbackData.info) {
        const info = callbackData.info
        // resultUrls can be a JSON string: '["https://..."]' or a direct URL
        if (info.resultUrls) {
          resultData = info.resultUrls
        } else if (info.originUrls) {
          resultData = info.originUrls
        }
      }

      // Fallback to callbackData if nothing found
      if (!resultData) {
        resultData = callbackData
      }

      console.log(`[Callback] Task ${taskId} completed. Extracting URL from result...`)

      const resultUrl = extractResultUrl(resultData)

      if (resultUrl) {
        console.log(`[Callback] Successfully extracted URL: ${resultUrl.substring(0, 150)}...`)

        await db.generation.update({
          where: { id: generation.id },
          data: {
            status: 'COMPLETED',
            resultUrl,
          },
        })

        // Notify frontend via WebSocket
        await notifyClient(generation.userId, taskId, 'COMPLETED', resultUrl)
      } else {
        // Try regex fallback to find any URL in the raw data
        const rawStr = JSON.stringify(resultData)
        const urlMatch = rawStr.match(/https?:\/\/[^\s"'<>]+\.(mp4|webm|mov|png|jpg|jpeg|gif|webp)/i)

        if (urlMatch) {
          console.log(`[Callback] Found URL via regex fallback: ${urlMatch[0].substring(0, 150)}...`)
          await db.generation.update({
            where: { id: generation.id },
            data: {
              status: 'COMPLETED',
              resultUrl: urlMatch[0],
            },
          })

          // Notify frontend via WebSocket
          await notifyClient(generation.userId, taskId, 'COMPLETED', urlMatch[0])
        } else {
          // Couldn't extract URL, save raw result
          const jsonResult = typeof resultData === 'string'
            ? resultData
            : JSON.stringify(resultData)

          console.log(`[Callback] No URL extracted, saving raw result (${jsonResult.length} chars). Raw:`, jsonResult.substring(0, 500))

          await db.generation.update({
            where: { id: generation.id },
            data: {
              status: 'COMPLETED',
              resultUrl: jsonResult,
            },
          })
        }
      }
    } else if (isFailed) {
      const errorMsg = callbackData.failMsg || callbackData.error || callbackData.msg ||
        body.failMsg || body.error || body.msg || 'Generation failed'

      console.error(`[Callback] Task ${taskId} failed:`, errorMsg)

      await db.generation.update({
        where: { id: generation.id },
        data: {
          status: 'FAILED',
          resultUrl: typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg),
        },
      })

      // Refund credits if the generation had a cost
      let wasRefunded = false
      if (generation.cost && generation.cost > 0) {
        try {
          await db.user.update({
            where: { id: generation.userId },
            data: { paidCredits: { increment: generation.cost } },
          })
          wasRefunded = true
          console.log(`[Callback Refund] Refunded ${generation.cost} credits to user ${generation.userId} (callback task ${taskId} failed)`)
        } catch (refundErr) {
          console.error('[Callback Refund] Failed to refund credits:', refundErr)
        }
      }

      // Notify frontend via WebSocket
      const failMessage = typeof errorMsg === 'string' ? errorMsg : 'Generation failed'
      await notifyClient(generation.userId, taskId, 'FAILED', null, 'Generation Failed', wasRefunded ? failMessage + ' Credits have been refunded.' : failMessage)
    } else {
      // Still processing
      console.log(`[Callback] Task ${taskId} state: ${stateOrStatus}, keeping as PROCESSING`)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Callback] Error processing callback:', error)
    // Always return 200 to KIE.AI so they don't retry
    return NextResponse.json(
      { success: true, message: 'Callback received but processing failed' },
      { status: 200 }
    )
  }
}
