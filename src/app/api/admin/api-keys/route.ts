import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, AuthError } from '@/lib/auth'

function maskApiKey(key: string): string {
  if (key.length <= 8) {
    return '****'
  }
  return '****' + key.slice(-4)
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)

    const keys = await db.apiKey.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        key: true,
        name: true,
        provider: true,
        usageCount: true,
        isActive: true,
        lastUsedAt: true,
        createdAt: true,
      },
    })

    // Mask the actual keys for security
    const maskedKeys = keys.map((k) => ({
      ...k,
      key: maskApiKey(k.key),
    }))

    return NextResponse.json({
      success: true,
      data: maskedKeys,
    })
  } catch (error) {
    console.error('Get API keys error:', error)

    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to get API keys' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)

    const body = await request.json()
    const { key, name, provider } = body || {}

    if (!key || !key.trim()) {
      return NextResponse.json(
        { success: false, error: 'API key is required' },
        { status: 400 }
      )
    }

    const trimmedKey = key.trim()

    // Check for duplicate key
    const existing = await db.apiKey.findUnique({
      where: { key: trimmedKey },
    })

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'This API key already exists' },
        { status: 409 }
      )
    }

    const apiKey = await db.apiKey.create({
      data: {
        key: trimmedKey,
        name: name || null,
        provider: provider || 'KIE',
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        ...apiKey,
        key: maskApiKey(apiKey.key),
      },
    })
  } catch (error) {
    console.error('Create API key error:', error)

    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to create API key' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin(request)

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id is required' },
        { status: 400 }
      )
    }

    await db.apiKey.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      data: { message: 'API key deleted successfully' },
    })
  } catch (error) {
    console.error('Delete API key error:', error)

    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to delete API key' },
      { status: 500 }
    )
  }
}
