'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface PushAdData {
  id: string
  adCode: string
}

interface PushNotificationBannerProps {
  showAds: boolean
}

/**
 * Push Notification Ad Injector
 *
 * This component does NOT show any custom UI. It simply fetches push
 * notification ad scripts from the database (e.g. Monetag, PropellerAds,
 * OneSignal, etc.) and injects them into the page. The ad network's own
 * script handles the entire push notification flow — permission prompts,
 * subscription management, and notification delivery.
 *
 * The user's site owner adds their real ad network scripts via the Admin
 * panel (position = "push"), and this component executes them silently.
 */

// Track injected script sources to avoid double-injection
const INJECTED_KEY = 'push_notif_injected_ids'

function getInjectedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(INJECTED_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set()
  }
}

function markInjected(id: string) {
  try {
    const ids = getInjectedIds()
    ids.add(id)
    localStorage.setItem(INJECTED_KEY, JSON.stringify([...ids]))
  } catch {
    // silent
  }
}

// Sequential script injection — same approach as AdBanner
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

export function PushNotificationBanner({ showAds }: PushNotificationBannerProps) {
  const [ads, setAds] = useState<PushAdData[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const injectedRef = useRef(false)

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

  // Inject all push ad scripts — let the ad network handle everything
  const injectAllAds = useCallback(async (adList: PushAdData[]) => {
    if (adList.length === 0) return
    const container = containerRef.current
    if (!container) return

    const alreadyInjected = getInjectedIds()

    for (const ad of adList) {
      // Skip if this ad was already injected in a previous session
      if (alreadyInjected.has(ad.id)) continue

      const wrapper = document.createElement('div')
      wrapper.setAttribute('data-push-ad-id', ad.id)
      container.appendChild(wrapper)

      const hasScripts = /<script[\s>]/i.test(ad.adCode)
      wrapper.innerHTML = ad.adCode

      if (hasScripts) {
        const inertScripts = Array.from(wrapper.querySelectorAll('script'))
        await injectScriptsSequentially(wrapper, inertScripts).catch(() => {})
      }

      // Mark as injected so we don't re-inject on next page load
      markInjected(ad.id)
    }

    injectedRef.current = true
  }, [])

  // Inject push ad scripts after a short delay (1.5s)
  useEffect(() => {
    if (!showAds || ads.length === 0 || injectedRef.current) return

    const timer = setTimeout(() => {
      injectAllAds(ads)
    }, 1500)

    return () => clearTimeout(timer)
  }, [showAds, ads, injectAllAds])

  // Don't render anything if no ads or not showing
  if (!showAds || ads.length === 0) return null

  return (
    // Container for push notification ad scripts — ad networks handle their own UI
    <div ref={containerRef} />
  )
}
