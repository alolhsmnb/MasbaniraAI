'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, BellOff, X, Loader2, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PushAdData {
  id: string
  adCode: string
}

interface PushNotificationBannerProps {
  showAds: boolean
}

// Sequential script injection (same as AdBanner)
async function injectScriptsSequentially(
  wrapper: HTMLElement,
  inertScripts: HTMLScriptElement[]
): Promise<void> {
  for (const inertScript of inertScripts) {
    const liveScript = document.createElement('script')
    Array.from(inertScript.attributes).forEach((attr) => {
      try {
        liveScript.setAttribute(attr.name, attr.value)
      } catch {
        // ignore
      }
    })
    if (inertScript.src) {
      liveScript.src = inertScript.src
      liveScript.async = false
      inertScript.parentNode?.replaceChild(liveScript, inertScript)
      await new Promise<void>((resolve) => {
        liveScript.onload = () => resolve()
        liveScript.onerror = () => resolve()
      })
    } else {
      liveScript.textContent = inertScript.textContent || ''
      inertScript.parentNode?.replaceChild(liveScript, inertScript)
      await new Promise<void>((r) => setTimeout(r, 0))
    }
  }
}

const DISMISSED_KEY = 'push_notif_dismissed'
const DISMISSED_DURATION = 24 * 60 * 60 * 1000 // 24 hours

export function PushNotificationBanner({ showAds }: PushNotificationBannerProps) {
  const [ads, setAds] = useState<PushAdData[]>([])
  const [visible, setVisible] = useState(false)
  const [permissionState, setPermissionState] = useState<NotificationPermission | 'unsupported' | 'unknown'>('unknown')
  const [loading, setLoading] = useState(false)
  const [scriptsInjected, setScriptsInjected] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Check if recently dismissed
  const isRecentlyDismissed = useCallback(() => {
    try {
      const dismissed = localStorage.getItem(DISMISSED_KEY)
      if (!dismissed) return false
      return Date.now() - parseInt(dismissed) < DISMISSED_DURATION
    } catch {
      return false
    }
  }, [])

  // Fetch push ads
  useEffect(() => {
    if (!showAds) return

    const fetchAds = async () => {
      try {
        const res = await fetch('/api/public/ads')
        const data = await res.json()
        if (data.success && data.data?.push) {
          setAds(data.data.push)
        }
      } catch {
        // silent
      }
    }

    fetchAds()
  }, [showAds])

  // Check notification support and permission
  useEffect(() => {
    if (!showAds || ads.length === 0) return

    if (isRecentlyDismissed()) return

    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermissionState('unsupported')
      return
    }

    setPermissionState(Notification.permission)
  }, [showAds, ads.length, isRecentlyDismissed])

  // Show banner after delay (only if not already granted, not denied, and has ads)
  useEffect(() => {
    if (!showAds || ads.length === 0 || isRecentlyDismissed()) return

    if (permissionState === 'default') {
      const timer = setTimeout(() => setVisible(true), 3000) // Show after 3s
      return () => clearTimeout(timer)
    }

    // If permission granted, just inject scripts silently (no banner needed)
    if (permissionState === 'granted' && !scriptsInjected) {
      injectAllAds()
    }
  }, [showAds, ads, permissionState, isRecentlyDismissed, scriptsInjected])

  // Inject all push ad scripts into hidden container
  const injectAllAds = useCallback(async () => {
    if (ads.length === 0) return
    const container = containerRef.current
    if (!container) return

    for (const ad of ads) {
      const wrapper = document.createElement('div')
      wrapper.setAttribute('data-push-ad-id', ad.id)
      wrapper.style.display = 'none'
      container.appendChild(wrapper)

      const hasScripts = /<script[\s>]/i.test(ad.adCode)
      wrapper.innerHTML = ad.adCode

      if (hasScripts) {
        const inertScripts = Array.from(wrapper.querySelectorAll('script'))
        await injectScriptsSequentially(wrapper, inertScripts).catch(() => {})
      }
    }

    setScriptsInjected(true)
  }, [ads])

  const handleAllow = async () => {
    setLoading(true)
    try {
      if ('Notification' in window) {
        const permission = await Notification.requestPermission()
        setPermissionState(permission)
        if (permission === 'granted') {
          // Inject push ad scripts
          await injectAllAds()
          new Notification('🔔 Notifications Enabled!', {
            body: 'You will now receive updates and offers.',
            icon: '/favicon.ico',
          })
        }
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
      setVisible(false)
    }
  }

  const handleDismiss = () => {
    setVisible(false)
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()))
    } catch {
      // silent
    }
    // Still inject scripts in background (some push networks work even without permission)
    if (!scriptsInjected) {
      injectAllAds()
    }
  }

  // Don't render anything if no ads or not showing
  if (!showAds || ads.length === 0) return null

  return (
    <>
      {/* Hidden container for push ad scripts */}
      <div ref={containerRef} className="hidden" />

      {/* Push notification permission banner */}
      <AnimatePresence>
        {visible && permissionState === 'default' && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-[380px] z-50"
          >
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] p-4 shadow-2xl shadow-black/40 backdrop-blur-xl">
              {/* Close button */}
              <button
                onClick={handleDismiss}
                className="absolute top-3 right-3 size-6 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>

              <div className="flex items-start gap-3">
                {/* Bell icon */}
                <div className="size-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
                  <Bell className="size-5 text-white" />
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-foreground mb-0.5">
                    Stay Updated! 🔔
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Get notified about new features, updates, and special offers. No spam, unsubscribe anytime.
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 mt-3">
                <Button
                  onClick={handleAllow}
                  disabled={loading}
                  size="sm"
                  className="flex-1 gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/20"
                >
                  {loading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Bell className="size-3.5" />
                  )}
                  {loading ? 'Enabling...' : 'Allow Notifications'}
                </Button>
                <Button
                  onClick={handleDismiss}
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Not Now
                </Button>
              </div>

              {/* Trust indicator */}
              <div className="flex items-center gap-1.5 mt-2 justify-center">
                <Shield className="size-3 text-muted-foreground/50" />
                <span className="text-[10px] text-muted-foreground/50">
                  We respect your privacy. No data collected.
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
