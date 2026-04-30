import { db } from '@/lib/db'
import Script from 'next/script'

/**
 * Server-side push notification ad loader.
 *
 * Reads active push ad scripts directly from the database and renders
 * them using next/script. This is the most reliable approach:
 * - No client-side API calls
 * - No caching issues
 * - Scripts execute after page hydration via next/script
 * - The ad network (Monetag, PropellerAds, etc.) handles its own UI
 */
async function getPushAds() {
  try {
    return await db.adSlot.findMany({
      where: {
        isActive: true,
        position: 'push',
      },
      select: {
        id: true,
        adCode: true,
      },
      orderBy: { sortOrder: 'asc' },
    })
  } catch (error) {
    console.error('PushAdsServerLoader error:', error)
    return []
  }
}

export async function PushAdsServerLoader() {
  const ads = await getPushAds()

  if (ads.length === 0) return null

  return (
    <>
      {ads.map((ad) => {
        // Extract script content from <script>...</script> wrapper if present
        const match = ad.adCode.match(/^<script[^>]*>([\s\S]*)<\/script>$/i)
        const scriptContent = match ? match[1].trim() : ad.adCode.trim()

        return (
          <Script
            key={ad.id}
            id={`push-ad-${ad.id}`}
            strategy="afterInteractive"
          >
            {scriptContent}
          </Script>
        )
      })}
    </>
  )
}
