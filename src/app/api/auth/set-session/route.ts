import { NextRequest, NextResponse } from 'next/server'
import { createSession } from '@/lib/auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { tempToken } = await request.json()

    if (!tempToken) {
      return NextResponse.json({ success: false, error: 'Missing token' }, { status: 400 })
    }

    // Find user by temp token (stored in SiteSetting temporarily)
    const setting = await db.siteSetting.findUnique({
      where: { key: `temp_auth_${tempToken}` },
    })

    if (!setting) {
      return NextResponse.json({ success: false, error: 'Invalid or expired token' }, { status: 401 })
    }

    const userData = JSON.parse(setting.value) as {
      id: string
      email: string
      name: string | null
      avatar: string | null
      role: string
    }

    // Delete the temp token
    await db.siteSetting.delete({ where: { key: `temp_auth_${tempToken}` } })

    // Create session cookie
    const setCookie = await createSession({
      id: userData.id,
      email: userData.email,
      name: userData.name,
      avatar: userData.avatar,
      role: userData.role,
    })

    return NextResponse.json(
      { success: true, data: { message: 'Session created' } },
      {
        headers: { 'Set-Cookie': setCookie },
      }
    )
  } catch (error) {
    console.error('Set session error:', error)
    return NextResponse.json({ success: false, error: 'Failed to set session' }, { status: 500 })
  }
}
