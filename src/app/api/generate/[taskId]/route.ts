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

          const updated = await db.generation.update({
            where: { id: generation.id },
            data: {
              status: 'FAILED',
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
