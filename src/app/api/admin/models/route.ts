import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, AuthError } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)

    const models = await db.aiModel.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json({
      success: true,
      data: models,
    })
  } catch (error) {
    console.error('Get models error:', error)

    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to get models' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)

    const body = await request.json()
    const { modelId, name, type, isActive, sortOrder } = body || {}

    if (!modelId || !name) {
      return NextResponse.json(
        { success: false, error: 'modelId and name are required' },
        { status: 400 }
      )
    }

    const existing = await db.aiModel.findUnique({
      where: { modelId },
    })

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'A model with this modelId already exists' },
        { status: 409 }
      )
    }

    const model = await db.aiModel.create({
      data: {
        modelId,
        name,
        type: type || 'IMAGE',
        isActive: isActive !== false,
        sortOrder: sortOrder || 0,
      },
    })

    return NextResponse.json({
      success: true,
      data: model,
    })
  } catch (error) {
    console.error('Create model error:', error)

    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to create model' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin(request)

    const body = await request.json()
    const { modelId, name, type, isActive, sortOrder } = body || {}

    if (!modelId) {
      return NextResponse.json(
        { success: false, error: 'modelId is required' },
        { status: 400 }
      )
    }

    const existing = await db.aiModel.findUnique({
      where: { modelId },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Model not found' },
        { status: 404 }
      )
    }

    const model = await db.aiModel.update({
      where: { modelId },
      data: {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        ...(isActive !== undefined && { isActive }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    })

    return NextResponse.json({
      success: true,
      data: model,
    })
  } catch (error) {
    console.error('Update model error:', error)

    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to update model' },
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

    const generationCount = await db.generation.count({
      where: { modelId: id },
    })

    if (generationCount > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete model with existing generations. Deactivate it instead.' },
        { status: 400 }
      )
    }

    await db.aiModel.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      data: { message: 'Model deleted successfully' },
    })
  } catch (error) {
    console.error('Delete model error:', error)

    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to delete model' },
      { status: 500 }
    )
  }
}
