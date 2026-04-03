import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, AuthError } from '@/lib/auth'
import { createTask, createVeoTask } from '@/lib/kie-api'
import { getDefaultPricing } from '@/app/api/admin/pricing/route'

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request)

    // Check if user is banned
    const user = await db.user.findUnique({
      where: { id: session.userId },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 401 }
      )
    }

    if (user.isBanned) {
      return NextResponse.json(
        { success: false, error: 'Your account has been suspended' },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { modelId, prompt, aspectRatio, imageSize, rotation, type, imageInput, outputFormat, mode, duration, nFrames, removeWatermark, enableTranslation, watermark } = body || {}

    if (!modelId) {
      return NextResponse.json(
        { success: false, error: 'modelId is required' },
        { status: 400 }
      )
    }

    // Validate model exists and is active (include pricing)
    const model = await db.aiModel.findUnique({
      where: { modelId: modelId },
      include: { pricing: true },
    })

    if (!model) {
      return NextResponse.json(
        { success: false, error: 'Model not found' },
        { status: 400 }
      )
    }

    if (!model.isActive) {
      return NextResponse.json(
        { success: false, error: 'This model is currently unavailable' },
        { status: 400 }
      )
    }

    // Prompt is optional only for grok image-to-video
    const isImageToVideoOptionalPrompt = model.modelId === 'grok-imagine/image-to-video'
    if (!prompt?.trim() && !isImageToVideoOptionalPrompt) {
      return NextResponse.json(
        { success: false, error: 'Prompt is required' },
        { status: 400 }
      )
    }

    // Calculate cost based on model pricing
    const cost = calculateCost(model, { imageSize, duration, nFrames })
    const totalCredits = user.dailyCredits + user.paidCredits

    if (totalCredits < cost) {
      return NextResponse.json(
        { success: false, error: `Insufficient credits. You need ${cost} credits but have ${totalCredits}.` },
        { status: 400 }
      )
    }

    // Deduct credit (prefer free credits first)
    let newDailyCredits = user.dailyCredits
    let newPaidCredits = user.paidCredits

    if (user.dailyCredits >= cost) {
      newDailyCredits -= cost
    } else {
      const remaining = cost - user.dailyCredits
      newDailyCredits = 0
      newPaidCredits -= remaining
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        dailyCredits: newDailyCredits,
        paidCredits: newPaidCredits,
      },
    })

    // Call KIE.AI API - Veo uses a different endpoint
    let taskResult: { taskId: string; apiKeyId: string }

    if (model.modelId === 'veo3_fast') {
      // Veo 3.1 Fast - uses /api/v1/veo/generate endpoint
      taskResult = await createVeoTask({
        prompt: prompt.trim(),
        model: 'veo3_fast',
        imageUrls: imageInput && imageInput.length > 0 ? imageInput : undefined,
        aspect_ratio: aspectRatio || '16:9',
        enableTranslation: enableTranslation !== false,
        watermark: watermark || undefined,
      })
    } else {
      // Standard KIE.AI models - uses /api/v1/jobs/createTask endpoint
      const taskInput: Parameters<typeof createTask>[1] = {
        prompt: prompt.trim(),
        nsfw_checker: true,
      }

      if (aspectRatio) {
        taskInput.aspect_ratio = aspectRatio
      }

      if (imageInput && Array.isArray(imageInput) && imageInput.length > 0) {
        if (model.modelId.includes('image-to-image') || model.modelId.includes('image-to-video')) {
          taskInput.image_urls = imageInput
        } else {
          taskInput.image_input = imageInput
        }
      }

      if (imageSize && imageSize !== 'Auto') {
        taskInput.resolution = imageSize
      }
      if (outputFormat) {
        taskInput.output_format = outputFormat
      }
      if (mode) {
        taskInput.mode = mode
      }
      if (duration) {
        taskInput.duration = duration
      }
      if (nFrames) {
        taskInput.n_frames = nFrames
      }
      if (removeWatermark !== undefined) {
        taskInput.remove_watermark = removeWatermark
      }
      if (model.modelId.startsWith('sora-2')) {
        taskInput.upload_method = 's3'
      }

      taskResult = await createTask(model.modelId, taskInput)
    }

    // Save generation to DB
    const generation = await db.generation.create({
      data: {
        userId: user.id,
        modelId: model.id,
        prompt: prompt.trim(),
        aspectRatio: aspectRatio || '1:1',
        imageSize: imageSize || '1K',
        rotation: rotation || 0,
        status: 'PROCESSING',
        taskId: taskResult.taskId,
        type: type || model.type || 'IMAGE',
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        taskId: taskResult.taskId,
        generationId: generation.id,
        status: generation.status,
        cost,
      },
    })
  } catch (error) {
    console.error('Create generation error:', error)

    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create generation' },
      { status: 500 }
    )
  }
}

// Helper: Calculate cost based on model pricing configuration
function calculateCost(
  model: { modelId: string; type: string; pricing: { pricingJson: string } | null },
  options: { imageSize?: string; duration?: number; nFrames?: string }
): number {
  const defaultCost = 1

  try {
    // Use stored pricing or fall back to defaults
    let pricingConfig: any
    if (model.pricing) {
      pricingConfig = JSON.parse(model.pricing.pricingJson)
    } else {
      pricingConfig = getDefaultPricing(model.type, model.modelId)
    }

    const format = pricingConfig.format
    const tiers = pricingConfig.tiers

    if (!tiers) return defaultCost

    if (format === 'resolution') {
      // Image models: key is resolution (Auto, 1K, 2K, 4K)
      const res = options.imageSize || '1K'
      return Math.max(1, parseInt(String(tiers[res])) || defaultCost)
    }

    if (format === 'duration_resolution') {
      // Video models (Grok): key is duration × resolution
      const dur = String(options.duration || 6)
      const res = options.imageSize || '480p'
      const durationTiers = tiers[dur]
      if (durationTiers && typeof durationTiers === 'object') {
        return Math.max(1, parseInt(String(durationTiers[res])) || defaultCost)
      }
      return defaultCost
    }

    if (format === 'frames') {
      // Sora2 models: key is frame count
      const frames = options.nFrames || '10'
      return Math.max(1, parseInt(String(tiers[frames])) || defaultCost)
    }

    if (format === 'flat') {
      // Veo models: single flat price
      return Math.max(1, parseInt(String(tiers.default)) || defaultCost)
    }

    return defaultCost
  } catch {
    return defaultCost
  }
}
