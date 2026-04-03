import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { extractResultUrl, isTaskCompleted, isTaskFailed } from '@/lib/kie-api'

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

    // Determine status - check both state and status fields
    const callbackData = body.data || body
    const stateOrStatus = callbackData.state || callbackData.status || body.state || body.status || ''

    // Use the same status checking logic as polling
    const statusCheck = { state: stateOrStatus, status: stateOrStatus }

    if (isTaskCompleted(statusCheck)) {
      // Extract result URL from callback payload
      // Standard models: resultJson field
      // Veo: data.info.resultUrls
      const resultData = callbackData.resultJson || callbackData.result || body.resultJson || body.result || body.output || callbackData.output || callbackData.info || callbackData

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
      } else {
        // Couldn't extract URL, save raw result
        const jsonResult = typeof resultData === 'string'
          ? resultData
          : JSON.stringify(resultData)

        console.log(`[Callback] No URL extracted, saving raw result (${jsonResult.length} chars)`)

        await db.generation.update({
          where: { id: generation.id },
          data: {
            status: 'COMPLETED',
            resultUrl: jsonResult,
          },
        })
      }
    } else if (isTaskFailed(statusCheck)) {
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
