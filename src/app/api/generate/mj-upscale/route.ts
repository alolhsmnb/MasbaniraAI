import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, AuthError } from '@/lib/auth'
import { createMjUpscale } from '@/lib/midjourney-api'
import { getDefaultPricing } from '@/app/api/admin/pricing/route'

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request)
    const body = await request.json()
    const { parentTaskId, imageIndex } = body || {}

    if (!parentTaskId || imageIndex === undefined) {
      return NextResponse.json(
        { success: false, error: 'parentTaskId and imageIndex are required' },
        { status: 400 }
      )
    }

    // Find the original generation
    const parentGeneration = await db.generation.findFirst({
      where: { taskId: parentTaskId },
    })

    if (!parentGeneration) {
      return NextResponse.json({ success: false, error: 'Original generation not found' }, { status: 404 })
    }

    if (parentGeneration.userId !== session.userId && session.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    const user = await db.user.findUnique({ where: { id: session.userId } })
    if (!user || user.isBanned) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    // Cost for upscale (use same model pricing)
    const model = await db.aiModel.findFirst({
      where: { id: parentGeneration.modelId },
      include: { pricing: true },
    })
    const cost = 1 // Fixed cost for upscale/vary
    const totalCredits = user.dailyCredits + user.paidCredits
    if (totalCredits < cost) {
      return NextResponse.json({ success: false, error: `Insufficient credits. You need ${cost} credits.` }, { status: 400 })
    }

    // Deduct credits
    let newDailyCredits = user.dailyCredits
    let newPaidCredits = user.paidCredits
    if (user.dailyCredits >= cost) { newDailyCredits -= cost } else { newDailyCredits = 0; newPaidCredits -= (cost - user.dailyCredits) }
    await db.user.update({ where: { id: user.id }, data: { dailyCredits: newDailyCredits, paidCredits: newPaidCredits } })

    // Create upscale task
    const result = await createMjUpscale({ taskId: parentTaskId, imageIndex })

    // Save new generation record
    const generation = await db.generation.create({
      data: {
        userId: user.id,
        modelId: parentGeneration.modelId,
        prompt: parentGeneration.prompt + ' [UPSCALE #' + (imageIndex + 1) + ']',
        aspectRatio: parentGeneration.aspectRatio,
        imageSize: parentGeneration.imageSize,
        status: 'PROCESSING',
        taskId: result.taskId,
        type: 'IMAGE',
        cost,
      },
    })

    return NextResponse.json({
      success: true,
      data: { taskId: result.taskId, generationId: generation.id, status: 'PROCESSING', cost },
    })
  } catch (error) {
    console.error('MJ Upscale error:', error)
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode })
    }
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed to upscale' }, { status: 500 })
  }
}
