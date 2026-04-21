'use client'

/**
 * Socket.io client for real-time generation events.
 *
 * Connects to the generation-events mini-service and provides
 * reactive state for generation completion/failure notifications.
 *
 * Usage:
 *   const { onCompleted, onFailed, isConnected } = useGenerationSocket()
 *
 *   onCompleted((data) => { ... })
 *   onFailed((data) => { ... })
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import { io, Socket } from 'socket.io-client'

interface GenerationCompletedData {
  taskId: string
  resultUrl: string
  modelId: string
  type: string
}

interface GenerationFailedData {
  taskId: string
  errorMessage: string
  modelId: string
  refunded: boolean
}

export function useGenerationSocket(userId: string | null | undefined) {
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const completedListenersRef = useRef<Set<(data: GenerationCompletedData) => void>>(new Set())
  const failedListenersRef = useRef<Set<(data: GenerationFailedData) => void>>(new Set())
  const isConnectedRef = useRef(false)

  // Register a listener for generation completion events
  const onCompleted = useCallback((listener: (data: GenerationCompletedData) => void) => {
    completedListenersRef.current.add(listener)
    return () => { completedListenersRef.current.delete(listener) }
  }, [])

  // Register a listener for generation failure events
  const onFailed = useCallback((listener: (data: GenerationFailedData) => void) => {
    failedListenersRef.current.add(listener)
    return () => { failedListenersRef.current.delete(listener) }
  }, [])

  useEffect(() => {
    if (!userId) {
      // Disconnect if userId becomes null (logged out)
      const existing = socketRef.current
      if (existing) {
        existing.disconnect()
        socketRef.current = null
        isConnectedRef.current = false
        // Defer setState to avoid lint warning about setState in effect body
        setTimeout(() => setIsConnected(false), 0)
      }
      return
    }

    // Only connect if not already connected (or if userId changed)
    const existing = socketRef.current
    if (existing?.connected && existing.data?.userId === userId) {
      return
    }

    // Clean up previous connection
    if (existing) {
      existing.disconnect()
    }

    console.log(`[Socket] Connecting to generation events service...`)

    const socket = io('/?XTransformPort=3005', {
      transports: ['websocket', 'polling'],
      timeout: 5000,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
    })

    socket.on('connect', () => {
      console.log(`[Socket] Connected: ${socket.id}`)
      isConnectedRef.current = true
      setIsConnected(true)
      // Register with userId
      socket.emit('register', userId)
    })

    socket.on('registered', (data) => {
      console.log(`[Socket] Registered:`, data)
    })

    socket.on('generation:completed', (data: GenerationCompletedData) => {
      console.log(`[Socket] Generation completed: taskId=${data.taskId}`)
      completedListenersRef.current.forEach(listener => {
        try { listener(data) } catch (err) { console.error('[Socket] Listener error:', err) }
      })
    })

    socket.on('generation:failed', (data: GenerationFailedData) => {
      console.log(`[Socket] Generation failed: taskId=${data.taskId}`)
      failedListenersRef.current.forEach(listener => {
        try { listener(data) } catch (err) { console.error('[Socket] Listener error:', err) }
      })
    })

    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Disconnected: ${reason}`)
      isConnectedRef.current = false
      setIsConnected(false)
    })

    socket.on('connect_error', (err) => {
      console.warn(`[Socket] Connection error: ${err.message}`)
      isConnectedRef.current = false
      setIsConnected(false)
    })

    socket.data = { userId }
    socketRef.current = socket

    return () => {
      socket.disconnect()
      socketRef.current = null
      isConnectedRef.current = false
      setIsConnected(false)
    }
  }, [userId])

  return { isConnected, onCompleted, onFailed }
}
