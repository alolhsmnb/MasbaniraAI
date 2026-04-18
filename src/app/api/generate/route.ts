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

    if (model.modelId.startsWith('veo3')) {
      // Veo 3.1 (Quality / Fast / Lite) - uses /api/v1/veo/generate endpoint
      console.log(`[Generate] Veo model detected: ${model.modelId}, imageSize=${imageSize}, aspectRatio=${aspectRatio}, enableTranslation=${enableTranslation}`)
      taskResult = await createVeoTask({
        prompt: prompt.trim(),
        model: model.modelId,
        imageUrls: imageInput && imageInput.length > 0 ? imageInput : undefined,
        aspect_ratio: aspectRatio || '16:9',
        resolution: imageSize || undefined,
        enableTranslation: enableTranslation !== false,
        watermark: watermark || undefined,
      })
    } else if (model.modelId === 'bytedance/seedance-2-fast') {
      // Seedance 2 Fast - specific input format
      const taskInput: Parameters<typeof createTask>[1] = {
        prompt: prompt.trim(),
        web_search: false,
        generate_audio: true,
        resolution: '480p',
        duration: 5,
      }

      if (aspectRatio && aspectRatio !== 'auto') {
        taskInput.aspect_ratio = aspectRatio
      }

      // Seedance uses first_frame_url for single image, reference_image_urls for multiple
      if (imageInput && Array.isArray(imageInput) && imageInput.length > 0) {
        if (imageInput.length === 1) {
          taskInput.first_frame_url = imageInput[0]
        } else {
          taskInput.reference_image_urls = imageInput
        }
      }

      taskResult = await createTask(model.modelId, taskInput)
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

    // Save generation to DB with cost
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
        cost,
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

    const errorMessage = error instanceof Error ? error.message : 'Failed to create generation'

    // Refund credits if task creation failed after deduction
    try {
      if (typeof cost === 'number' && cost > 0) {
        await refundCredits(user.id, cost)
        console.log(`[Refund] Refunded ${cost} credits to user ${user.id} (creation failed)`)
      }
    } catch (refundErr) {
      console.error('[Refund] Failed to refund credits after creation error:', refundErr)
    }

    // Extract code and msg from the error string (format: "code=430 msg=Some error")
    const codeMatch = errorMessage.match(/code=(\d+)/)
    const msgMatch = errorMessage.match(/msg=(.+?)(?:\.?\s*$)/)
    const apiCode = codeMatch ? parseInt(codeMatch[1]) : null
    const apiMsg = msgMatch ? msgMatch[1].trim() : null

    // Parse known API error codes to provide user-friendly messages
    let userMessage = errorMessage
    let userTitle = 'Generation Failed'

    // Map by error code first (more reliable)
    if (apiCode) {
      switch (apiCode) {
        case 401:
          userTitle = 'Authentication Error'
          userMessage = 'The API authentication failed. Please contact the administrator.'
          break
        case 402:
          userTitle = 'Insufficient Credits'
          userMessage = 'The API does not have enough credits. Please contact the administrator.'
          break
        case 404:
          userTitle = 'Not Found'
          userMessage = 'The requested resource was not found. Please try again later.'
          break
        case 422:
          userTitle = 'Invalid Parameters'
          userMessage = 'The request parameters were invalid. Check your prompt, image, and settings, then try again.'
          break
        case 429:
          userTitle = 'Rate Limited'
          userMessage = 'Too many requests. Please wait a moment and try again.'
          break
        case 430:
          userTitle = 'Inappropriate Content'
          userMessage = 'Your prompt contains content that was flagged as inappropriate. Please modify your prompt and try again.'
          break
        case 455:
          userTitle = 'Service Unavailable'
          userMessage = 'The service is currently under maintenance. Please try again later.'
          break
        case 500:
          userTitle = 'Server Error'
          userMessage = 'An unexpected error occurred. Please try again later.'
          break
        case 501:
          userTitle = 'Generation Failed'
          userMessage = 'The content generation task failed. Try a different prompt or settings.'
          break
        case 505:
          userTitle = 'Feature Disabled'
          userMessage = 'This feature is currently disabled. Please contact the administrator.'
          break
        default:
          // Unknown code - use the API message if available
          if (apiMsg) {
            userMessage = apiMsg.length > 300 ? apiMsg.substring(0, 300) + '...' : apiMsg
          }
          break
      }
    } else if (errorMessage.includes('No active API keys')) {
      userTitle = 'Service Unavailable'
      userMessage = 'No API keys configured. Please contact the administrator.'
    }

    // Add refund info to message for provider errors
    if (apiCode) {
      userMessage += ' Credits have been refunded.'
    } else if (errorMessage.includes('No active API keys') || errorMessage.includes('API keys failed')) {
      userMessage += ' Credits have been refunded.'
    }

    return NextResponse.json(
      { success: false, error: userMessage, errorTitle: userTitle },
      { status: 500 }
    )
  }
}

// Helper: Refund credits to a user (add to paidCredits)
async function refundCredits(userId: string, amount: number) {
  await db.user.update({
    where: { id: userId },
    data: { paidCredits: { increment: amount } },
  })
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
