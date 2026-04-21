import { NextRequest } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { taskNotifier } from '@/lib/task-notifier'

/**
 * SSE endpoint for real-time task result push.
 * 
 * Client connects with: GET /api/generate/events?taskId=xxx
 * Server sends: event: task-result\ndata: {...}\n\n
 * Connection closes when result arrives or after 5 min timeout.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request)
    const taskId = request.nextUrl.searchParams.get('taskId')

    if (!taskId) {
      return new Response('taskId is required', { status: 400 })
    }

    const encoder = new TextEncoder()
    let closed = false

    const stream = new ReadableStream({
      start(controller) {
        // Send initial comment to establish connection
        controller.enqueue(encoder.encode(': connected\n\n'))

        // Subscribe to task events
        const unsubscribe = taskNotifier.subscribe(taskId, (event) => {
          if (closed) return
          controller.enqueue(
            encoder.encode(`event: task-result\ndata: ${JSON.stringify(event)}\n\n`)
          )
          // Close after sending result
          controller.close()
        })

        // Keep-alive ping every 15s
        const keepAlive = setInterval(() => {
          if (closed) {
            clearInterval(keepAlive)
            return
          }
          try {
            controller.enqueue(encoder.encode(': ping\n\n'))
          } catch {
            clearInterval(keepAlive)
          }
        }, 15000)

        // 5 minute timeout
        const timeout = setTimeout(() => {
          if (!closed) {
            controller.enqueue(
              encoder.encode(`event: timeout\ndata: ${JSON.stringify({ taskId, status: 'TIMEOUT' })}\n\n`)
            )
            controller.close()
          }
        }, 5 * 60 * 1000)

        // Clean up on close
        const originalClose = controller.close.bind(controller)
        controller.close = () => {
          if (!closed) {
            closed = true
            clearInterval(keepAlive)
            clearTimeout(timeout)
            unsubscribe()
          }
          return originalClose()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return new Response(error.message, { status: error.statusCode })
    }
    return new Response('SSE connection failed', { status: 500 })
  }
}
