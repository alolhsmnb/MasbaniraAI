import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const settings = await db.siteSetting.findMany()
    const settingsMap: Record<string, string> = {}
    for (const s of settings) {
      settingsMap[s.key] = s.value
    }
    if (!settingsMap.site_name) settingsMap.site_name = 'PixelForge AI'
    if (!settingsMap.site_description) settingsMap.site_description = 'Professional AI-powered platform for generating stunning images and videos'
    if (!settingsMap.daily_free_credits) settingsMap.daily_free_credits = '10'
    if (!settingsMap.cost_per_generation) settingsMap.cost_per_generation = '1'
    if (!settingsMap.logo_url) settingsMap.logo_url = ''
    return NextResponse.json({ success: true, data: settingsMap })
  } catch (error) {
    console.error('Get public settings error:', error)
    return NextResponse.json({ success: true, data: {
      site_name: 'PixelForge AI',
      site_description: 'Professional AI-powered platform for generating stunning images and videos',
      daily_free_credits: '10',
      cost_per_generation: '1',
    }})
  }
}
