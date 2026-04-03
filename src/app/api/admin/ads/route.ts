import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, AuthError } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)

    const ads = await db.adSlot.findMany({
      orderBy: { sortOrder: 'asc' },
    })

    return NextResponse.json({ success: true, data: ads })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode })
    }
    console.error('List ads error:', error)
    return NextResponse.json({ success: false, error: 'Failed to list ads' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)

    const body = await request.json()
    const { name, provider, adCode, position, isActive, sortOrder } = body

    if (!name?.trim() || !adCode?.trim()) {
      return NextResponse.json({ success: false, error: 'Name and ad code are required' }, { status: 400 })
    }

    const ad = await db.adSlot.create({
      data: {
        name: name.trim(),
        provider: (provider || 'custom').trim(),
        adCode: adCode.trim(),
        position: position || 'landing',
        isActive: isActive !== false,
        sortOrder: sortOrder || 0,
      },
    })

    return NextResponse.json({ success: true, data: ad })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode })
    }
    console.error('Create ad error:', error)
    return NextResponse.json({ success: false, error: 'Failed to create ad' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin(request)

    const body = await request.json()
    const { id, name, provider, adCode, position, isActive, sortOrder } = body

    if (!id) {
      return NextResponse.json({ success: false, error: 'Ad ID is required' }, { status: 400 })
    }

    const existing = await db.adSlot.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Ad not found' }, { status: 404 })
    }

    const ad = await db.adSlot.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(provider !== undefined && { provider: provider.trim() }),
        ...(adCode !== undefined && { adCode: adCode.trim() }),
        ...(position !== undefined && { position }),
        ...(isActive !== undefined && { isActive }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    })

    return NextResponse.json({ success: true, data: ad })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode })
    }
    console.error('Update ad error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update ad' }, { status: 500 })
  }
}
