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
      // Ad contains scripts - render HTML first, then execute scripts
      const temp = document.createElement('div')
      temp.innerHTML = adCode

      // Move all non-script content (preserves divs, iframes, comments via cloneNode)
      Array.from(temp.childNodes).forEach((node) => {
        if (node.nodeName === 'SCRIPT') return
        wrapper.appendChild(node.cloneNode(true))
      })

      // Execute script tags (innerHTML doesn't run them)
      const scripts = temp.querySelectorAll('script')
      scripts.forEach((script) => {
        const newScript = document.createElement('script')
        // Copy all attributes
        Array.from(script.attributes).forEach((attr) => {
          try {
            newScript.setAttribute(attr.name, attr.value)
          } catch { /* ignore invalid attrs */ }
        })
        if (script.src) {
          newScript.src = script.src
        } else if (script.textContent) {
          newScript.textContent = script.textContent
        }
        newScript.async = false
        wrapper.appendChild(newScript)
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
