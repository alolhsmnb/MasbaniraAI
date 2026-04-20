// In-process event emitter for generation task completion notifications.
// Works within the Next.js server process — no separate service needed.
// The callback route emits events here, and the SSE route listens & forwards to clients.

type Listener = (data: GenerationEvent) => void

export interface GenerationEvent {
  userId: string
  taskId: string
  status: 'COMPLETED' | 'FAILED'
  resultUrl?: string | null
  errorTitle?: string | null
  errorMessage?: string | null
}

class GenerationEventEmitter {
  private listeners: Map<string, Set<Listener>> = new Map()

  /** Subscribe to events for a specific userId. Returns an unsubscribe function. */
  subscribe(userId: string, listener: Listener): () => void {
    if (!this.listeners.has(userId)) {
      this.listeners.set(userId, new Set())
    }
    this.listeners.get(userId)!.add(listener)

    return () => {
      const set = this.listeners.get(userId)
      if (set) {
        set.delete(listener)
        if (set.size === 0) {
          this.listeners.delete(userId)
        }
      }
    }
  }

  /** Emit a generation event to all listeners for the given userId. */
  emit(event: GenerationEvent): void {
    const set = this.listeners.get(event.userId)
    if (set) {
      for (const listener of set) {
        try {
          listener(event)
        } catch (err) {
          console.error('[GenerationEvents] Listener error:', err)
        }
      }
    }
  }
}

// Singleton — shared across all requests in the same server process
export const generationEvents = new GenerationEventEmitter()
