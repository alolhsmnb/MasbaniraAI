/**
 * Global event emitter for server-side push notifications.
 * 
 * Works within a single Next.js process:
 * - SSE clients subscribe to task events
 * - Callback handler emits task completion
 * 
 * On Vercel (serverless), this falls back gracefully —
 * the client's "Check Status" button still works via DB.
 */

type Listener = (data: TaskEvent) => void

interface TaskEvent {
  taskId: string
  status: string
  resultUrl?: string | null
  errorTitle?: string
  errorMessage?: string
  refunded?: boolean
}

class TaskNotifier {
  private listeners: Map<string, Set<Listener>> = new Map()

  subscribe(taskId: string, listener: Listener): () => void {
    if (!this.listeners.has(taskId)) {
      this.listeners.set(taskId, new Set())
    }
    this.listeners.get(taskId)!.add(listener)

    // Return unsubscribe function
    return () => {
      const subs = this.listeners.get(taskId)
      if (subs) {
        subs.delete(listener)
        if (subs.size === 0) this.listeners.delete(taskId)
      }
    }
  }

  emit(event: TaskEvent): void {
    const subs = this.listeners.get(event.taskId)
    if (subs) {
      for (const listener of subs) {
        listener(event)
      }
      // Clean up after emitting
      this.listeners.delete(event.taskId)
    }
  }
}

// Singleton - survives hot reloads in dev
const globalForNotifier = globalThis as unknown as { taskNotifier?: TaskNotifier }
export const taskNotifier = globalForNotifier.taskNotifier || new TaskNotifier()
globalForNotifier.taskNotifier = taskNotifier
