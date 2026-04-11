'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface AdData {
  id: string
  adCode: string
  position: string
}

interface AdBannerProps {
  position: 'landing' | 'generate'
  showAds: boolean
}

/**
 * Sequentially inject scripts from ad code into a wrapper element.
 * External scripts (with src) are loaded in order — each must finish
 * before the next script runs. This ensures ad networks like Surfe.pro
 * that rely on a loader script (net.js) + inline push work correctly.
 */
async function injectScriptsSequentially(
  wrapper: HTMLElement,
  inertScripts: HTMLScriptElement[]
): Promise<void> {
  for (const inertScript of inertScripts) {
    const liveScript = document.createElement('script')

    // Copy all attributes
    Array.from(inertScript.attributes).forEach((attr) => {
      try {
        liveScript.setAttribute(attr.name, attr.value)
      } catch {
        // ignore invalid attrs
      }
    })

    if (inertScript.src) {
      // External script — wait for it to load before continuing
      liveScript.src = inertScript.src
      liveScript.async = false
      inertScript.parentNode?.replaceChild(liveScript, inertScript)

      await new Promise<void>((resolve) => {
        liveScript.onload = () => resolve()
        liveScript.onerror = () => resolve() // don't block on error
      })
    } else {
      // Inline script — execute immediately
      liveScript.textContent = inertScript.textContent || ''
      inertScript.parentNode?.replaceChild(liveScript, inertScript)
      // Small tick so the DOM update settles before the next iteration
      await new Promise<void>((r) => setTimeout(r, 0))
    }
  }
}

export function AdBanner({ position, showAds }: AdBannerProps) {
  const [ads, setAds] = useState<AdData[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef(false)

  // Fetch ads
  useEffect(() => {
    if (!showAds) return

    const fetchAds = async () => {
      try {
        const res = await fetch('/api/public/ads')
        const data = await res.json()
        if (data.success && data.data) {
          const relevant = [
            ...(data.data[position] || []),
            ...(data.data.both || []),
          ]
          setAds(relevant)
          setLoaded(true)
        }
      } catch {
        // silent
      }
    }

    fetchAds()
  }, [position, showAds])

  // Rotate every 5 seconds
  const rotate = useCallback(() => {
    setAds((prev) => {
      if (prev.length <= 1) return prev
      setCurrentIndex((i) => (i + 1) % prev.length)
      return prev
    })
  }, [])

  useEffect(() => {
    if (!showAds || ads.length <= 1) return

    const interval = setInterval(rotate, 5000)
    return () => clearInterval(interval)
  }, [showAds, ads.length, rotate])

  // Inject ad code into container
  useEffect(() => {
    if (!showAds || !loaded || ads.length === 0) return

    const container = containerRef.current
    if (!container) return

    abortRef.current = false

    const currentAd = ads[currentIndex]
    if (!currentAd) return

    const adCode = currentAd.adCode

    // Create wrapper
    const wrapper = document.createElement('div')
    wrapper.setAttribute('data-ad-id', currentAd.id)
    wrapper.style.width = '100%'
    wrapper.style.maxWidth = '100%'
    wrapper.style.overflow = 'visible'
    container.appendChild(wrapper)

    // Check if ad contains <script> tags
    const hasScripts = /<script[\s>]/i.test(adCode)

    if (!hasScripts) {
      // Pure HTML/Div/Iframe ad — render directly
      wrapper.innerHTML = adCode
    } else {
      // Ad contains scripts — render HTML first (scripts are INERT)
      wrapper.innerHTML = adCode

      // Collect all inert script elements
      const inertScripts = Array.from(wrapper.querySelectorAll('script'))

      // Inject scripts sequentially so external scripts load before inline ones
      injectScriptsSequentially(wrapper, inertScripts).catch(() => {
        // Silently handle injection errors
      })
    }

    return () => {
      abortRef.current = true
      if (container) container.innerHTML = ''
    }
  }, [showAds, loaded, ads, currentIndex])

  if (!showAds || !loaded || ads.length === 0) return null

  return (
    <div className="w-full">
      <div
        ref={containerRef}
        className="w-full"
      />

      {/* Ad indicator dots */}
      {ads.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-2">
          {ads.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                i === currentIndex
                  ? 'bg-emerald-400 w-4'
                  : 'bg-white/20 hover:bg-white/40'
              }`}
              aria-label={`Ad ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
