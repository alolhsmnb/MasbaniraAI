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
          // Get ads for this position + "both"
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

  // Inject ad script into container
  useEffect(() => {
    if (!showAds || !loaded || ads.length === 0) return

    const container = containerRef.current
    if (!container) return

    // Clear previous content
    container.innerHTML = ''

    const currentAd = ads[currentIndex]
    if (!currentAd) return

    // Create a wrapper for the ad code
    const wrapper = document.createElement('div')
    wrapper.setAttribute('data-ad-id', currentAd.id)
    wrapper.style.width = '100%'
    wrapper.style.maxWidth = '100%'
    wrapper.style.minHeight = '90px'
    wrapper.style.overflow = 'hidden'

    // Use a combination of innerHTML for HTML + script execution
    const adCode = currentAd.adCode

    // Parse and execute scripts separately (innerHTML doesn't execute scripts)
    const temp = document.createElement('div')
    temp.innerHTML = adCode

    // Move non-script elements first
    Array.from(temp.childNodes).forEach((node) => {
      if (node.nodeName !== 'SCRIPT') {
        wrapper.appendChild(node.cloneNode(true))
      }
    })

    container.appendChild(wrapper)

    // Execute scripts
    const scripts = temp.querySelectorAll('script')
    scripts.forEach((script) => {
      const newScript = document.createElement('script')
      if (script.src) {
        newScript.src = script.src
        newScript.async = script.async
        newScript.defer = script.defer
      } else {
        newScript.textContent = script.textContent || ''
      }
      // Copy attributes
      Array.from(script.attributes).forEach((attr) => {
        if (attr.name !== 'src') {
          newScript.setAttribute(attr.name, attr.value)
        }
      })
      container.appendChild(newScript)
    })

    // Responsive scaling: use CSS zoom to actually shrink the layout box
    const scaleDown = () => {
      if (!wrapper) return
      const parentWidth = container.offsetWidth
      const adWidth = wrapper.scrollWidth

      if (adWidth > parentWidth && adWidth > 0) {
        const scale = parentWidth / adWidth
        // Use zoom property (better than transform - actually changes layout box)
        // Fallback to transform scale for browsers that don't support zoom
        if ('zoom' in document.documentElement.style) {
          wrapper.style.zoom = String(scale)
          wrapper.style.transform = ''
          wrapper.style.transformOrigin = ''
          wrapper.style.height = ''
        } else {
          wrapper.style.transform = `scale(${scale})`
          wrapper.style.transformOrigin = 'top left'
          wrapper.style.height = `${wrapper.scrollHeight * scale}px`
        }
      } else {
        wrapper.style.zoom = ''
        wrapper.style.transform = ''
        wrapper.style.transformOrigin = ''
        wrapper.style.height = ''
      }
    }

    // Run scaling after scripts load and periodically (ads may load async)
    const scaleTimer = setTimeout(scaleDown, 1000)
    const scaleTimer2 = setTimeout(scaleDown, 3000)
    const scaleTimer3 = setTimeout(scaleDown, 6000)
    const scaleInterval = setInterval(scaleDown, 5000)

    // Also observe resize
    const resizeObserver = new ResizeObserver(scaleDown)
    resizeObserver.observe(container)

    // Observe DOM changes in container (ad scripts add content dynamically)
    const mutationObserver = new MutationObserver(() => {
      requestAnimationFrame(scaleDown)
    })
    mutationObserver.observe(container, { childList: true, subtree: true })

    return () => {
      clearTimeout(scaleTimer)
      clearTimeout(scaleTimer2)
      clearTimeout(scaleTimer3)
      clearInterval(scaleInterval)
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      if (container) container.innerHTML = ''
    }
  }, [showAds, loaded, ads, currentIndex])

  if (!showAds || !loaded || ads.length === 0) return null

  return (
    <div className="w-full max-w-full overflow-hidden">
      <div
        ref={containerRef}
        className="w-full max-w-full overflow-hidden rounded-lg bg-white/[0.02] border border-white/[0.05]"
        style={{ minHeight: '90px' }}
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
