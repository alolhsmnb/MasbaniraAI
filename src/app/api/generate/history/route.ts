import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, AuthError } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request)

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const skip = (page - 1) * limit

    const [generations, total] = await Promise.all([
      db.generation.findMany({
        where: { userId: session.userId },
        include: {
          model: {
            select: { id: true, modelId: true, name: true, type: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.generation.count({
        where: { userId: session.userId },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        generations,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    console.error('Get generation history error:', error)

    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to get generation history' },
      { status: 500 }
    )
  }
}
