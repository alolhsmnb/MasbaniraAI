import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Simple cache: 30 seconds
interface CachedAds {
  landing: { id: string; adCode: string; position: string }[]
  generate: { id: string; adCode: string; position: string }[]
  push: { id: string; adCode: string; position: string }[]
  timestamp: number
}

let cachedAds: CachedAds | null = null
const CACHE_TTL = 30_000

export async function GET() {
  try {
    const now = Date.now()

    if (cachedAds && now - cachedAds.timestamp < CACHE_TTL) {
      return NextResponse.json({ success: true, data: cachedAds })
    }

    const ads = await db.adSlot.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        adCode: true,
        position: true,
      },
    })

    const landing = ads.filter((a) => a.position === 'landing' || a.position === 'both')
    const generate = ads.filter((a) => a.position === 'generate' || a.position === 'both')
    const push = ads.filter((a) => a.position === 'push' || a.position === 'both')

    cachedAds = { landing, generate, push, timestamp: now }

    return NextResponse.json({ success: true, data: { landing, generate, push } })
  } catch (error) {
    console.error('Get public ads error:', error)
    return NextResponse.json({ success: true, data: { landing: [], generate: [], push: [] } })
  }
}
