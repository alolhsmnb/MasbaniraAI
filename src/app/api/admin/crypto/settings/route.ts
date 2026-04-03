import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, AuthError } from '@/lib/auth'

/**
 * GET /api/admin/crypto/settings
 *
 * Returns all cryptocurrency settings stored in CryptoSetting table.
 * Admin-only endpoint.
 *
 * Returns:
 *   - All settings as key-value pairs
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)

    const settings = await db.cryptoSetting.findMany({
      orderBy: { key: 'asc' },
    })

    // Convert array to key-value object
    const settingsMap: Record<string, string> = {}
    for (const setting of settings) {
      settingsMap[setting.key] = setting.value
    }

    return NextResponse.json({
      success: true,
      data: settingsMap,
    })
  } catch (error) {
    console.error('Get crypto settings error:', error)

    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to get crypto settings' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/crypto/settings
 *
 * Save/update cryptocurrency settings.
 * Admin-only endpoint.
 *
 * Body:
 *   - settings: Object with key-value pairs to upsert
 *     Common keys:
 *       - cryptapi_base_url: Base API URL (default: https://api.cryptapi.io)
 *       - webhook_url: Webhook callback base URL
 *       - cryptapi_public_key: RSA public key for webhook verification
 *       - order_expiry_minutes: Order expiration time (default: 30)
 *       - min_payment_usd: Minimum payment amount in USD
 *       - max_payment_usd: Maximum payment amount in USD
 *       - auto_confirm: Whether to auto-confirm payments (default: true)
 *
 * Returns:
 *   - Updated settings
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)

    const body = await request.json()
    const { settings } = body || {}

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json(
        { success: false, error: 'settings object is required' },
        { status: 400 }
      )
    }

    // Upsert each setting
    const upsertPromises = Object.entries(settings).map(([key, value]) => {
      return db.cryptoSetting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      })
    })

    await Promise.all(upsertPromises)

    // Return all settings after update
    const allSettings = await db.cryptoSetting.findMany({
      orderBy: { key: 'asc' },
    })

    const settingsMap: Record<string, string> = {}
    for (const setting of allSettings) {
      settingsMap[setting.key] = setting.value
    }

    return NextResponse.json({
      success: true,
      data: settingsMap,
    })
  } catch (error) {
    console.error('Save crypto settings error:', error)

    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to save crypto settings' },
      { status: 500 }
    )
  }
}
