import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, AuthError } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)

    const settings = await db.siteSetting.findMany({
      orderBy: { key: 'asc' },
    })

    // Convert to key-value object
    const settingsMap: Record<string, string> = {}
    for (const setting of settings) {
      settingsMap[setting.key] = setting.value
    }

    return NextResponse.json({
      success: true,
      data: settingsMap,
    })
  } catch (error) {
    console.error('Get settings error:', error)

    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to get settings' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)

    const body = await request.json()
    const { settings } = body as { settings: Record<string, string> }

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json(
        { success: false, error: 'settings object is required' },
        { status: 400 }
      )
    }

    // Upsert each setting
    const updates = Object.entries(settings).map(([key, value]) =>
      db.siteSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    )

    await Promise.all(updates)

    return NextResponse.json({
      success: true,
      data: { message: 'Settings updated successfully' },
    })
  } catch (error) {
    console.error('Update settings error:', error)

    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to update settings' },
      { status: 500 }
    )
  }
}
