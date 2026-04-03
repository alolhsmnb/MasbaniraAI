import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, AuthError } from '@/lib/auth'
import { checkTaskStatus, extractResultUrl, isTaskCompleted, isTaskFailed } from '@/lib/kie-api'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const session = await requireAuth(request)
    const { taskId } = await params

    if (!taskId) {
      return NextResponse.json(
        { success: false, error: 'taskId is required' },
        { status: 400 }
      )
    }

    // Look up generation by taskId
    const generation = await db.generation.findFirst({
      where: { taskId },
      include: {
        model: {
          select: { id: true, modelId: true, name: true, type: true },
        },
      },
    })

    if (!generation) {
      return NextResponse.json(
        { success: false, error: 'Generation not found' },
        { status: 404 }
      )
    }

    // Check ownership
    if (generation.userId !== session.userId && session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      )
    }

    // If already completed or failed, just return current state
    if (generation.status === 'COMPLETED' || generation.status === 'FAILED') {
      return NextResponse.json({
        success: true,
        data: {
          ...generation,
          model: generation.model,
        },
      })
    }

    // Still pending or processing - poll KIE.AI for status
    try {
      const apiKey = await db.apiKey.findFirst({
        where: { isActive: true },
      })

      if (apiKey) {
        const taskStatus = await checkTaskStatus(taskId, apiKey.key)

        console.log(`[Poll] taskId=${taskId} state=${taskStatus.state || taskStatus.status} resultJson=${!!taskStatus.resultJson}`)

        if (isTaskCompleted(taskStatus)) {
          // Extract URL - KIE.AI stores result in resultJson as JSON string
          const resultData = taskStatus.resultJson || taskStatus.result || taskStatus
          const resultUrl = extractResultUrl(resultData)

          console.log(`[Poll] Task completed! Extracted URL: ${resultUrl ? resultUrl.substring(0, 150) : 'null'}`)

          if (resultUrl) {
            const updated = await db.generation.update({
              where: { id: generation.id },
              data: {
                status: 'COMPLETED',
                resultUrl,
              },
            })

            return NextResponse.json({
              success: true,
              data: {
                ...updated,
                model: generation.model,
              },
            })
          } else {
            // Task completed but couldn't extract URL
            console.log(`[Poll] Task completed but no URL extracted. Raw data:`, JSON.stringify(resultData).substring(0, 500))

            const jsonResult = typeof resultData === 'string'
              ? resultData
              : JSON.stringify(resultData)

            const updated = await db.generation.update({
              where: { id: generation.id },
              data: {
                status: 'COMPLETED',
                resultUrl: jsonResult,
              },
            })

            return NextResponse.json({
              success: true,
              data: {
                ...updated,
                model: generation.model,
              },
            })
          }
        } else if (isTaskFailed(taskStatus)) {
          console.error(`[Poll] Task failed: taskId=${taskId}, state=${taskStatus.state}`)

          // Try to extract a specific error message from the KIE.AI response
          let errorMessage: string | undefined
          const rawResult = taskStatus.resultJson || taskStatus.result
          if (typeof rawResult === 'string') {
            try {
              const parsed = JSON.parse(rawResult)
              errorMessage = parsed.error || parsed.message || parsed.msg || parsed.reason || parsed.errorMsg || undefined
            } catch {
              // If it's not JSON, use the raw string if it looks like an error
              if (rawResult.length > 0 && rawResult.length < 500) {
                errorMessage = rawResult
              }
            }
          } else if (rawResult && typeof rawResult === 'object') {
            const obj = rawResult as Record<string, unknown>
            errorMessage = (obj.error || obj.message || obj.msg || obj.reason || obj.errorMsg || undefined) as string | undefined
          }

          // Map common failure reasons to user-friendly messages
          let userTitle = 'Generation Failed'
          let userMessage = 'Something went wrong during generation. Please try a different prompt or settings.'

          if (errorMessage) {
            const lower = errorMessage.toLowerCase()
            if (lower.includes('nsfw') || lower.includes('inappropriate') || lower.includes('content policy') || lower.includes('safety')) {
              userTitle = 'Inappropriate Content'
              userMessage = 'Your prompt or image was flagged by the safety filter. Please modify your content and try again.'
            } else if (lower.includes('timeout') || lower.includes('timed out')) {
              userTitle = 'Timeout'
              userMessage = 'The generation took too long and timed out. Please try again with simpler settings.'
            } else if (lower.includes('invalid') || lower.includes('validation')) {
              userTitle = 'Invalid Input'
              userMessage = 'The input parameters were invalid. Please check your prompt, image, and settings.'
            } else if (lower.includes('rate') || lower.includes('too many') || lower.includes('busy')) {
              userTitle = 'Rate Limited'
              userMessage = 'The service is currently busy. Please wait a moment and try again.'
            } else if (lower.includes('credit') || lower.includes('insufficient') || lower.includes('balance')) {
              userTitle = 'Service Unavailable'
              userMessage = 'The service is temporarily unavailable due to resource limits. Please contact support.'
            } else if (lower.includes('maintenance') || lower.includes('unavailable')) {
              userTitle = 'Service Unavailable'
              userMessage = 'The AI service is currently under maintenance. Please try again later.'
            } else {
              userTitle = 'Generation Failed'
              userMessage = errorMessage.length > 300 ? errorMessage.substring(0, 300) + '...' : errorMessage
            }
          }

          const updated = await db.generation.update({
            where: { id: generation.id },
            data: {
              status: 'FAILED',
              resultUrl: errorMessage || null, // Store error in resultUrl for history
            },
          })

          return NextResponse.json({
            success: true,
            data: {
              ...updated,
              model: generation.model,
              errorTitle: userTitle,
              errorMessage: userMessage,
            },
          })
        } else {
          // Still processing
          return NextResponse.json({
            success: true,
            data: {
              ...generation,
              apiStatus: taskStatus.state || taskStatus.status || 'processing',
            },
          })
        }
      }
    } catch (kieError) {
      console.error('[Poll] KIE.AI status check error:', kieError)
    }

    return NextResponse.json({
      success: true,
      data: generation,
    })
  } catch (error) {
    console.error('[Poll] Check generation status error:', error)

    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to check generation status' },
      { status: 500 }
    )
  }
}
