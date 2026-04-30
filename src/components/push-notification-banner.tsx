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
 * Push & In-Page Push Ad Injector
 *
 * This component fetches push/in-page push ad scripts from the database
 * (e.g. Monetag In-Page Push, PropellerAds, OneSignal, etc.) and injects
 * them into the page body. The ad network's own script handles everything —
 * permission prompts, floating widgets, popups, and notification delivery.
 *
 * Supports:
 * - Monetag In-Page Push (floating popup within the page)
 * - Monetag Browser Push Notifications
 * - PropellerAds, OneSignal, Notix, etc.
 */

export function PushNotificationBanner({ showAds }: PushNotificationBannerProps) {
  const [ads, setAds] = useState<PushAdData[]>([])
  const injectedRef = useRef<Set<string>>(new Set())

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

  // Inject a single ad script into the DOM
  const injectAd = useCallback((ad: PushAdData) => {
    if (injectedRef.current.has(ad.id)) return

    // Create a script element directly and append to body
    // This is the most reliable way to execute ad network scripts
    const script = document.createElement('script')
    script.setAttribute('data-push-ad-id', ad.id)

    // Check if the ad code is just a single <script>...</script> wrapper
    const match = ad.adCode.match(/^<script[^>]*>([\s\S]*)<\/script>$/i)
    if (match) {
      // Extract the inner code and execute it directly
      script.textContent = match[1].trim()
    } else {
      // For any other format, try to execute as-is
      script.textContent = ad.adCode.trim()
    }

    document.body.appendChild(script)

    // Also handle cases where the ad code contains multiple script tags
    // or HTML alongside scripts (use DocumentFragment approach)
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = ad.adCode
    const scripts = tempDiv.querySelectorAll('script')
    if (scripts.length > 1) {
      scripts.forEach((s, i) => {
        if (i === 0) return // first one already handled above
        const newScript = document.createElement('script')
        newScript.textContent = s.textContent || ''
        if (s.src) {
          newScript.src = s.src
          newScript.async = false
        }
        Array.from(s.attributes).forEach((attr) => {
          if (attr.name !== 'src') {
            try { newScript.setAttribute(attr.name, attr.value) } catch { /* ignore */ }
          }
        })
        document.body.appendChild(newScript)
      })
    }

    injectedRef.current.add(ad.id)
  }, [])

  // Inject all push ad scripts after a short delay
  useEffect(() => {
    if (!showAds || ads.length === 0) return

    const timer = setTimeout(() => {
      ads.forEach((ad) => {
        if (ad.isActive !== false) {
          injectAd(ad)
        }
      })
    }, 1500)

    return () => clearTimeout(timer)
  }, [showAds, ads, injectAd])

  // This component renders nothing — it only injects scripts into the DOM
  return null
}
