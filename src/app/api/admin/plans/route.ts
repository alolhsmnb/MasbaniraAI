import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, AuthError } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)

    const plans = await db.plan.findMany({
      orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }],
    })

    return NextResponse.json({
      success: true,
      data: plans,
    })
  } catch (error) {
    console.error('Get plans error:', error)

    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to get plans' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)

    const body = await request.json()
    const { id, name, price, credits, features, isActive, sortOrder } = body || {}

    if (!name || price === undefined || credits === undefined) {
      return NextResponse.json(
        { success: false, error: 'name, price, and credits are required' },
        { status: 400 }
      )
    }

    // Parse features as JSON string if it's an array
    const featuresStr = Array.isArray(features)
      ? JSON.stringify(features)
      : typeof features === 'string'
        ? features
        : '[]'

    if (id) {
      // Update existing plan
      const plan = await db.plan.update({
        where: { id },
        data: {
          name,
          price: parseFloat(String(price)),
          credits: parseInt(String(credits), 10),
          features: featuresStr,
          isActive: isActive !== false,
          sortOrder: sortOrder || 0,
        },
      })
      return NextResponse.json({ success: true, data: plan })
    } else {
      // Create new plan
      const plan = await db.plan.create({
        data: {
          name,
          price: parseFloat(String(price)),
          credits: parseInt(String(credits), 10),
          features: featuresStr,
          isActive: isActive !== false,
          sortOrder: sortOrder || 0,
        },
      })
      return NextResponse.json({ success: true, data: plan })
    }
  } catch (error) {
    console.error('Save plan error:', error)

    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to save plan' },
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

    await db.plan.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      data: { message: 'Plan deleted successfully' },
    })
  } catch (error) {
    console.error('Delete plan error:', error)

    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to delete plan' },
      { status: 500 }
    )
  }
}
