'use client'

import { useEffect, useRef } from 'react'

interface PushNotificationBannerProps {
  showAds: boolean
}

interface PushAdData {
  id: string
  adCode: string
}

/**
 * Push Notification & In-Page Push Ad Injector
 *
 * Fetches push ad scripts from the database and injects them directly
 * into document.body as real <script> elements. The ad network (Monetag,
 * PropellerAds, etc.) handles its own permission prompt, subscription,
 * and notification delivery.
 *
 * This component renders nothing — it only injects scripts into the DOM.
 */
export function PushNotificationBanner({ showAds }: PushNotificationBannerProps) {
  const injectedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!showAds) return

    const loadAndInject = async () => {
      try {
        const res = await fetch('/api/public/push-ads')
        const json = await res.json()

        if (!json.success || !Array.isArray(json.data) || json.data.length === 0) {
          return
        }

        const ads: PushAdData[] = json.data

        for (const ad of ads) {
          if (injectedRef.current.has(ad.id)) continue

          // Parse the ad code to extract script content
          // Monetag format: <script>(function(s){...})(...)</script>
          const scriptMatch = ad.adCode.match(/^<script[^>]*>([\s\S]*)<\/script>$/i)

          if (scriptMatch) {
            // Create a real script element and inject into body
            const script = document.createElement('script')
            script.id = `push-ad-${ad.id}`
            script.textContent = scriptMatch[1].trim()
            document.body.appendChild(script)
          } else {
            // For non-wrapped code, execute directly
            const script = document.createElement('script')
            script.id = `push-ad-${ad.id}`
            script.textContent = ad.adCode.trim()
            document.body.appendChild(script)
          }

          injectedRef.current.add(ad.id)
        }
      } catch (err) {
        console.error('Push ad injection error:', err)
      }
    }

    // Delay injection slightly to ensure page is ready
    const timer = setTimeout(loadAndInject, 1000)
    return () => clearTimeout(timer)
  }, [showAds])

  return null
}
