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

export function AdBanner({ position, showAds }: AdBannerProps) {
  const [ads, setAds] = useState<AdData[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

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

    // Clear previous content
    container.innerHTML = ''

    const currentAd = ads[currentIndex]
    if (!currentAd) return

    const adCode = currentAd.adCode

    // Create wrapper - minimal styling to not interfere with ad content
    const wrapper = document.createElement('div')
    wrapper.setAttribute('data-ad-id', currentAd.id)
    wrapper.style.width = '100%'
    wrapper.style.maxWidth = '100%'
    wrapper.style.overflow = 'visible'
    container.appendChild(wrapper)

    // Check if ad contains <script> tags
    const hasScripts = /<script[\s>]/i.test(adCode)

    if (!hasScripts) {
      // Pure HTML/Div/Iframe ad - render directly (preserves comments, structure, iframes)
      wrapper.innerHTML = adCode
    } else {
      // Ad contains scripts - render ALL HTML first (preserves structure, nesting, iframes)
      // innerHTML injects script elements but they are INERT (not executed)
      wrapper.innerHTML = adCode

      // Replace each inert script element with a live one IN THE SAME POSITION
      // This preserves DOM structure (scripts stay inside their parent divs)
      const inertScripts = wrapper.querySelectorAll('script')
      inertScripts.forEach((inertScript) => {
        const liveScript = document.createElement('script')
        // Copy all attributes
        Array.from(inertScript.attributes).forEach((attr) => {
          try {
            liveScript.setAttribute(attr.name, attr.value)
          } catch { /* ignore invalid attrs */ }
        })
        if (inertScript.src) {
          liveScript.src = inertScript.src
        } else if (inertScript.textContent) {
          liveScript.textContent = inertScript.textContent
        }
        liveScript.async = false
        // Replace inert script with live one in the exact same DOM position
        inertScript.parentNode?.replaceChild(liveScript, inertScript)
      })
    }

    return () => {
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
