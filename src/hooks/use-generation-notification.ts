'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '@/store/app-store'
import { supabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

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
  const channelRef = useRef<RealtimeChannel | null>(null)
  const { user } = useAppStore()
  const callbacksRef = useRef({ onCompleted, onFailed })
  useEffect(() => {
    callbacksRef.current = { onCompleted, onFailed }
  }, [onCompleted, onFailed])

  // Refresh credits after completion/failure
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
  }, [])

  useEffect(() => {
    if (!user?.id) return

    // Subscribe to realtime UPDATE changes on the Generation table
    // Filter by userId so we only get events for this user's generations
    const channel = supabase
      .channel('generation-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'Generation',
          filter: `userId=eq.${user.id}`,
        },
        (payload) => {
          const updated = payload.new as Record<string, any>
          const status = updated.status as string
          const taskId = updated.taskId as string | null
          const resultUrl = updated.resultUrl as string | null

          if (!taskId) return

          console.log('[Realtime] Generation update received:', taskId, status)

          // Only process if this is the currently active task
          if (taskId !== activeTaskId) return

          if (status === 'COMPLETED' && resultUrl) {
            callbacksRef.current.onCompleted(taskId, resultUrl)
            refreshState()
          } else if (status === 'FAILED') {
            callbacksRef.current.onFailed(
              taskId,
              'Generation Failed',
              typeof resultUrl === 'string' && !resultUrl.startsWith('http') ? resultUrl : 'Something went wrong. Please try again.'
            )
            refreshState()
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Subscribed to Generation updates for user', user.id)
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] Channel error')
        } else if (status === 'TIMED_OUT') {
          console.warn('[Realtime] Subscription timed out, retrying...')
        }
      })

    channelRef.current = channel

    // Cleanup on unmount
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [user?.id, activeTaskId, refreshState])

  return {}
}
