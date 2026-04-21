import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { extractResultUrl, isTaskCompleted, isTaskFailed } from '@/lib/kie-api'

/**
 * Generic callback endpoint for all KIE.AI models.
 * KIE.AI POSTs task results here when generation completes.
 *
 * URL format: /api/callback/{model-slug}
 * The slug is informational - actual task lookup is via taskId.
 *
 * Flow:
 * 1. KIE.AI sends callback with taskId + result
 * 2. We update the Generation record in DB
 * 3. Supabase Realtime detects the DB change
 * 4. Client receives the update instantly (no polling, no extra services)
 *
 * Expected payload from KIE.AI:
 * {
 *   taskId: string,
 *   state: "success" | "succeed" | "failed",
 *   resultJson: '{"resultUrls":["https://..."]}',
 *   ...
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const body = await request.json()

    console.log(`[Callback/${slug}] Received:`, JSON.stringify(body).substring(0, 2000))

    // Extract taskId - could be at top level or nested in data
    const taskId = body.taskId || body.data?.taskId || body.id

    if (!taskId) {
      console.error(`[Callback/${slug}] No taskId found`)
      return NextResponse.json(
        { success: true, message: 'No taskId found' },
        { status: 200 }
      )
    }

    // Find the generation record
    const generation = await db.generation.findFirst({
      where: { taskId },
      include: {
        model: {
          select: { modelId: true, name: true },
        },
      },
    })

    if (!generation) {
      console.error(`[Callback/${slug}] No generation found for taskId: ${taskId}`)
      return NextResponse.json(
        { success: true, message: 'Generation not found' },
        { status: 200 }
      )
    }

    // Skip if already completed or failed
    if (generation.status === 'COMPLETED' || generation.status === 'FAILED') {
      console.log(`[Callback/${slug}] Task ${taskId} already ${generation.status}, skipping`)
      return NextResponse.json({ success: true, message: 'Already processed' })
    }

    // Determine status
    const callbackData = body.data || body
    const callbackCode = body.code || callbackData.code
    const stateOrStatus = callbackData.state || callbackData.status || body.state || body.status || ''

    // Veo-style callback: uses "code" at top level
    const isVeoCallback = !!callbackCode && !stateOrStatus
    let isCompleted = false
    let isFailed = false

    if (isVeoCallback) {
      isCompleted = callbackCode === 200
      isFailed = callbackCode >= 400 && callbackCode !== 200
    } else {
      const statusCheck = { state: stateOrStatus, status: stateOrStatus }
      isCompleted = isTaskCompleted(statusCheck)
      isFailed = isTaskFailed(statusCheck)
    }

    if (isCompleted) {
      // Extract result URL
      let resultData = callbackData.resultJson || callbackData.result || body.resultJson || body.result || body.output || callbackData.output

      // Veo-specific: extract from data.info.resultUrls
      if (callbackData.info) {
        const info = callbackData.info
        if (info.resultUrls) resultData = info.resultUrls
        else if (info.originUrls) resultData = info.originUrls
      }

      if (!resultData) resultData = callbackData

      console.log(`[Callback/${slug}] Task ${taskId} completed. Extracting URL...`)

      const resultUrl = extractResultUrl(resultData)

      if (resultUrl) {
        console.log(`[Callback/${slug}] URL extracted: ${resultUrl.substring(0, 150)}...`)
        // Update DB → Supabase Realtime pushes to client automatically
        await db.generation.update({
          where: { id: generation.id },
          data: { status: 'COMPLETED', resultUrl },
        })
      } else {
        // Regex fallback - prioritize video URLs
        const rawStr = JSON.stringify(resultData)
        const videoUrlMatch = rawStr.match(/https?:\/\/[^\s"'<>\]}]+?\.(mp4|webm|mov)(\?[^\s"'<>\]}]*)?/i)
        const urlMatch = videoUrlMatch || rawStr.match(/https?:\/\/[^\s"'<>\]}]+?\.(png|jpg|jpeg|gif|webp|bmp)(\?[^\s"'<>\]}]*)?/i) || rawStr.match(/https?:\/\/[^\s"'<>]+/)

        if (urlMatch) {
          console.log(`[Callback/${slug}] Regex fallback URL: ${urlMatch[0].substring(0, 150)}...`)
          await db.generation.update({
            where: { id: generation.id },
            data: { status: 'COMPLETED', resultUrl: urlMatch[0] },
          })
        } else {
          const jsonResult = typeof resultData === 'string' ? resultData : JSON.stringify(resultData)
          console.log(`[Callback/${slug}] No URL extracted. Raw:`, jsonResult.substring(0, 500))
          await db.generation.update({
            where: { id: generation.id },
            data: { status: 'COMPLETED', resultUrl: jsonResult },
          })
        }
      }
    } else if (isFailed) {
      const errorMsg = callbackData.failMsg || callbackData.error || callbackData.msg ||
        body.failMsg || body.error || body.msg || 'Generation failed'

      console.error(`[Callback/${slug}] Task ${taskId} failed:`, errorMsg)

      const errorStr = typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg)

      await db.generation.update({
        where: { id: generation.id },
        data: { status: 'FAILED', resultUrl: errorStr },
      })

      // Refund credits
      if (generation.cost && generation.cost > 0) {
        try {
          await db.user.update({
            where: { id: generation.userId },
            data: { paidCredits: { increment: generation.cost } },
          })
          console.log(`[Callback/${slug}] Refunded ${generation.cost} credits to user ${generation.userId}`)
        } catch (refundErr) {
          console.error(`[Callback/${slug}] Refund failed:`, refundErr)
        }
      }
    } else {
      console.log(`[Callback/${slug}] Task ${taskId} state: ${stateOrStatus}, keeping as PROCESSING`)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(`[Callback] Error:`, error)
    return NextResponse.json(
      { success: true, message: 'Callback received but processing failed' },
      { status: 200 }
    )
  }
}

// Also support GET for testing
export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'Callback endpoint is active' })
}
