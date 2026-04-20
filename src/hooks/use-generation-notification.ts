'use client'

import { useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAppStore } from '@/store/app-store'
import { toast } from 'sonner'

interface GenerationUpdate {
  taskId: string
  status: string
  resultUrl?: string | null
  errorTitle?: string | null
  errorMessage?: string | null
}

interface UseGenerationNotificationOptions {
  activeTaskId: string | null
  onCompleted: (taskId: string, resultUrl: string) => void
  onFailed: (taskId: string, errorTitle: string, errorMessage: string) => void
}

export function useGenerationNotification({
  activeTaskId,
  onCompleted,
  onFailed,
}: UseGenerationNotificationOptions) {
  const socketRef = useRef<Socket | null>(null)
  const { user } = useAppStore()
  const callbacksRef = useRef({ onCompleted, onFailed })
  useEffect(() => {
    callbacksRef.current = { onCompleted, onFailed }
  }, [onCompleted, onFailed])

  // Refresh credits and history after completion/failure
  const refreshState = useCallback(async () => {
    try {
      const creditsRes = await fetch('/api/user/credits')
      if (creditsRes.ok) {
        const creditsData = await creditsRes.json()
        if (creditsData.success) {
          useAppStore.getState().setCredits(creditsData.data)
        }
      }
    } catch { /* silent */ }
    try {
      const histRes = await fetch('/api/generate/history?page=1&limit=4')
      if (histRes.ok) {
        const histData = await histRes.json()
        if (histData.success) {
          // We can't directly set recentGenerations from here, but the parent can re-fetch
        }
      }
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    if (!user?.id) return

    // Connect to notification service
    const socket = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      console.log('[WS] Connected to notification service')
      // Register with userId
      socket.emit('register', user.id)
    })

    socket.on('disconnect', () => {
      console.log('[WS] Disconnected from notification service')
    })

    socket.on('generation-update', (data: GenerationUpdate) => {
      console.log('[WS] Received generation update:', data.taskId, data.status)

      // Only process if this is the active task
      if (data.taskId !== activeTaskId) return

      if (data.status === 'COMPLETED' && data.resultUrl) {
        callbacksRef.current.onCompleted(data.taskId, data.resultUrl)
        refreshState()
      } else if (data.status === 'FAILED') {
        callbacksRef.current.onFailed(
          data.taskId,
          data.errorTitle || 'Generation Failed',
          data.errorMessage || 'Something went wrong. Please try again.'
        )
        refreshState()
      }
    })

    // Cleanup on unmount
    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [user?.id, activeTaskId, refreshState])

  return { socket: socketRef }
}
