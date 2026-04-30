import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Lightweight API to fetch push notification ad scripts.
 * Used by the client-side PushAdInjector to load Monetag/PropellerAds scripts.
 * No caching — always fetches fresh from DB.
 */
export async function GET() {
  try {
    const ads = await db.adSlot.findMany({
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

    return NextResponse.json({ success: true, data: ads })
  } catch (error) {
    console.error('Push ads API error:', error)
    return NextResponse.json({ success: true, data: [] })
  }
}
