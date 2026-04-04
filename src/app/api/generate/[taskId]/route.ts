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
          let errorCode: number | undefined
          const rawResult = taskStatus.resultJson || taskStatus.result
          if (typeof rawResult === 'string') {
            try {
              const parsed = JSON.parse(rawResult)
              errorCode = parsed.code || parsed.error_code || parsed.status || undefined
              errorMessage = parsed.msg || parsed.error || parsed.message || parsed.reason || parsed.errorMsg || undefined
            } catch {
              // If it's not JSON, use the raw string if it looks like an error
              if (rawResult.length > 0 && rawResult.length < 500) {
                errorMessage = rawResult
              }
            }
          } else if (rawResult && typeof rawResult === 'object') {
            const obj = rawResult as Record<string, unknown>
            errorCode = obj.code || obj.error_code || obj.status as number | undefined
            errorMessage = (obj.msg || obj.error || obj.message || obj.reason || obj.errorMsg || undefined) as string | undefined
          }

          // Also check the top-level taskStatus for code/msg (KIE.AI may put them there)
          if (!errorMessage && (taskStatus as any).msg) {
            errorMessage = (taskStatus as any).msg as string
          }
          if (!errorCode && (taskStatus as any).code) {
            errorCode = (taskStatus as any).code as number
          }

          // Map common failure reasons to user-friendly messages
          let userTitle = 'Generation Failed'
          let userMessage = 'Something went wrong during generation. Please try a different prompt or settings.'

          // First, try mapping by error code (from KIE.AI API)
          if (errorCode) {
            switch (errorCode) {
              case 401:
                userTitle = 'Authentication Error'
                userMessage = 'The API authentication failed. Please contact the administrator.'
                break
              case 402:
                userTitle = 'Service Unavailable'
                userMessage = 'The service has insufficient credits. Please contact the administrator.'
                break
              case 422:
                userTitle = 'Invalid Parameters'
                userMessage = 'The request parameters were invalid. Check your prompt, image, and settings, then try again.'
                break
              case 429:
                userTitle = 'Rate Limited'
                userMessage = 'Too many requests. Please wait a moment and try again.'
                break
              case 430:
                userTitle = 'Inappropriate Content'
                userMessage = 'Your prompt or image was flagged by the safety filter. Please modify your content and try again.'
                break
              case 455:
                userTitle = 'Service Unavailable'
                userMessage = 'The AI service is currently under maintenance. Please try again later.'
                break
              case 500:
                userTitle = 'Server Error'
                userMessage = 'An unexpected server error occurred. Please try again later.'
                break
              case 501:
                userTitle = 'Generation Failed'
                userMessage = 'The content generation task failed. Try a different prompt, image, or settings.'
                break
              case 505:
                userTitle = 'Feature Disabled'
                userMessage = 'This feature is currently disabled. Please contact the administrator.'
                break
              default:
                // Unknown code - fall through to text-based mapping
                break
            }
          }

          // If no code matched, try mapping by error message text
          if (errorMessage && userTitle === 'Generation Failed' && userMessage === 'Something went wrong during generation. Please try a different prompt or settings.') {
            const lower = errorMessage.toLowerCase()
            if (lower.includes('nsfw') || lower.includes('inappropriate') || lower.includes('content policy') || lower.includes('safety') || lower.includes('code=430')) {
              userTitle = 'Inappropriate Content'
              userMessage = 'Your prompt or image was flagged by the safety filter. Please modify your content and try again.'
            } else if (lower.includes('timeout') || lower.includes('timed out')) {
              userTitle = 'Timeout'
              userMessage = 'The generation took too long and timed out. Please try again with simpler settings.'
            } else if (lower.includes('invalid') || lower.includes('validation') || lower.includes('code=422')) {
              userTitle = 'Invalid Input'
              userMessage = 'The input parameters were invalid. Please check your prompt, image, and settings.'
            } else if (lower.includes('rate') || lower.includes('too many') || lower.includes('busy') || lower.includes('code=429')) {
              userTitle = 'Rate Limited'
              userMessage = 'The service is currently busy. Please wait a moment and try again.'
            } else if (lower.includes('credit') || lower.includes('insufficient') || lower.includes('balance') || lower.includes('code=402')) {
              userTitle = 'Service Unavailable'
              userMessage = 'The service is temporarily unavailable due to resource limits. Please contact support.'
            } else if (lower.includes('maintenance') || lower.includes('unavailable') || lower.includes('code=455')) {
              userTitle = 'Service Unavailable'
              userMessage = 'The AI service is currently under maintenance. Please try again later.'
            } else if (lower.includes('unauthorized') || lower.includes('auth') || lower.includes('code=401')) {
              userTitle = 'Authentication Error'
              userMessage = 'The API authentication failed. Please contact the administrator.'
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

          // Refund credits to user if the generation had a cost
          let refunded = false
          if (generation.cost && generation.cost > 0) {
            try {
              await db.user.update({
                where: { id: generation.userId },
                data: { paidCredits: { increment: generation.cost } },
              })
              refunded = true
              console.log(`[Refund] Refunded ${generation.cost} credits to user ${generation.userId} (task ${taskId} failed)`)
            } catch (refundErr) {
              console.error('[Refund] Failed to refund credits:', refundErr)
            }
          }

          // Append refund info to message
          const finalMessage = refunded ? userMessage + ' Credits have been refunded.' : userMessage

          return NextResponse.json({
            success: true,
            data: {
              ...updated,
              model: generation.model,
              errorTitle: userTitle,
              errorMessage: finalMessage,
              refunded,
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
