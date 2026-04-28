import { NextRequest, NextResponse, after } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, AuthError } from '@/lib/auth'
import { createTask, createVeoTask } from '@/lib/kie-api'
import { createWavespeedTask, checkWavespeedTaskStatus, extractWavespeedResultUrl } from '@/lib/wavespeed-api'
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
    const { modelId, prompt, aspectRatio, imageSize, rotation, type, imageInput, outputFormat, mode, duration, nFrames, removeWatermark, enableTranslation, watermark, seedanceFirstFrameUrl, seedanceLastFrameUrl, seedanceReferenceImageUrls, seedanceReferenceVideoUrls, seedanceReferenceAudioUrls, seedanceResolution, seedanceGenerateAudio, seedanceWebSearch, negativePrompt, klingCfgScale, klingSound, klingShotType } = body || {}

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

    // Prompt is optional only for image-to-video models
    const isImageToVideoOptionalPrompt = model.modelId === 'grok-imagine/image-to-video' || model.modelId === 'kwaivgi/kling-v3.0-std/image-to-video'
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

    // Call the correct provider API based on model's provider
    let taskResult: { taskId: string; apiKeyId: string }
    const modelProvider = model.provider || 'KIE'

    if (modelProvider === 'WAVESPEED') {
      // WaveSpeed.AI provider (Kling models)
      const isKlingImg2Vid = model.modelId === 'kwaivgi/kling-v3.0-std/image-to-video'
      // Build webhook URL dynamically from request headers
      const host = request.headers.get('host') || ''
      const protocol = request.headers.get('x-forwarded-proto') || 'https'
      const webhookUrl = host ? `${protocol}://${host}/api/generate/callback` : undefined
      console.log(`[Generate] WaveSpeed webhook URL: ${webhookUrl || '(not set)'}`)

      taskResult = await createWavespeedTask({
        model: model.modelId,
        prompt: prompt.trim() || undefined,
        negativePrompt: negativePrompt || undefined,
        aspectRatio: isKlingImg2Vid ? undefined : aspectRatio,
        duration: duration ? parseInt(String(duration)) : undefined,
        imageInput: isKlingImg2Vid && imageInput && imageInput.length > 0 ? imageInput : undefined,
        cfgScale: klingCfgScale !== undefined ? klingCfgScale : undefined,
        sound: klingSound !== undefined ? klingSound : undefined,
        shotType: klingShotType || undefined,
        webhookUrl,
      })
    } else if (model.modelId.startsWith('veo3')) {
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
      // Seedance 2 Fast - full feature support per API docs
      const taskInput: Parameters<typeof createTask>[1] = {
        prompt: prompt.trim(),
        web_search: seedanceWebSearch === true,
        generate_audio: seedanceGenerateAudio === true,
        resolution: '480p',
        duration: 5,
      }

      // Aspect ratio (Seedance supports: 1:1, 4:3, 3:4, 16:9, 9:16, 21:9, adaptive)
      if (aspectRatio) {
        taskInput.aspect_ratio = aspectRatio
      }

      // Frame URLs (from frontend image assignment)
 if (seedanceFirstFrameUrl) {
        taskInput.first_frame_url = seedanceFirstFrameUrl
      }
      if (seedanceLastFrameUrl) {
        taskInput.last_frame_url = seedanceLastFrameUrl
      }

      // Reference image URLs (3rd+ images)
      if (seedanceReferenceImageUrls && Array.isArray(seedanceReferenceImageUrls) && seedanceReferenceImageUrls.length > 0) {
        taskInput.reference_image_urls = seedanceReferenceImageUrls
      }

      // Fallback: if old-style imageInput is provided without explicit frame URLs
      if (!seedanceFirstFrameUrl && imageInput && Array.isArray(imageInput) && imageInput.length > 0) {
        if (imageInput.length === 1) {
          taskInput.first_frame_url = imageInput[0]
        } else if (imageInput.length === 2) {
          taskInput.first_frame_url = imageInput[0]
          taskInput.last_frame_url = imageInput[1]
        } else {
          taskInput.first_frame_url = imageInput[0]
          taskInput.last_frame_url = imageInput[1]
          taskInput.reference_image_urls = imageInput.slice(2)
        }
      }

      // Reference video URLs (max 3)
      if (seedanceReferenceVideoUrls && Array.isArray(seedanceReferenceVideoUrls) && seedanceReferenceVideoUrls.length > 0) {
        taskInput.reference_video_urls = seedanceReferenceVideoUrls.slice(0, 3)
      }

      // Reference audio URLs (max 3)
      if (seedanceReferenceAudioUrls && Array.isArray(seedanceReferenceAudioUrls) && seedanceReferenceAudioUrls.length > 0) {
        taskInput.reference_audio_urls = seedanceReferenceAudioUrls.slice(0, 3)
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
        if (model.modelId === 'gpt-image-2-image-to-image') {
          taskInput.input_urls = imageInput
        } else if (model.modelId.includes('image-to-image') || model.modelId.includes('image-to-video')) {
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

    // WaveSpeed fallback: after() runs server-side AFTER response is sent.
    // No client polling. If webhook didn't arrive, check once via API.
    if (modelProvider === 'WAVESPEED') {
      const fallbackTaskId = taskResult.taskId
      const fallbackGenId = generation.id
      const fallbackUserId = user.id
      const fallbackCost = cost
      // Dynamic wait based on video duration
      const videoDuration = duration ? parseInt(String(duration)) : 5
      const waitMs = Math.max(90_000, videoDuration * 20_000)
      after(async () => {
        try {
          console.log(`[WaveSpeed Fallback] Waiting ${waitMs / 1000}s for task ${fallbackTaskId} (video=${videoDuration}s)`)
          await new Promise(r => setTimeout(r, waitMs))
          const gen = await db.generation.findUnique({ where: { id: fallbackGenId } })
          if (!gen || gen.status !== 'PROCESSING') {
            console.log(`[WaveSpeed Fallback] Task ${fallbackTaskId} already ${gen?.status || 'gone'}, skip`)
            return
          }
          const keys = await db.apiKey.findMany({ where: { isActive: true, provider: 'WAVESPEED' }, orderBy: { createdAt: 'asc' } })
          if (keys.length === 0) {
            console.warn(`[WaveSpeed Fallback] No active keys, skip`)
            return
          }
          console.log(`[WaveSpeed Fallback] Checking task ${fallbackTaskId}...`)
          const result = await checkWavespeedTaskStatus(fallbackTaskId, keys[0].key)
          if (result.state === 'SUCCEED') {
            const url = extractWavespeedResultUrl(result.result)
            await db.generation.update({
              where: { id: fallbackGenId },
              data: { status: 'COMPLETED', resultUrl: url || result.resultJson || '' },
            })
            console.log(`[WaveSpeed Fallback] ✓ Task ${fallbackTaskId} completed, url=${url || '(none)'}`)
          } else if (result.state === 'FAILED') {
            if (fallbackCost > 0) {
              try { await db.user.update({ where: { id: fallbackUserId }, data: { paidCredits: { increment: fallbackCost } } }) } catch { /* ignore */ }
            }
            await db.generation.update({
              where: { id: fallbackGenId },
              data: { status: 'FAILED', resultUrl: 'Generation failed at provider' },
            })
            console.log(`[WaveSpeed Fallback] ✗ Task ${fallbackTaskId} failed, refunded ${fallbackCost} credits`)
          } else {
            console.log(`[WaveSpeed Fallback] Task ${fallbackTaskId} still running (${result.status})`)
          }
        } catch (err) {
          console.error(`[WaveSpeed Fallback] Error for task ${fallbackTaskId}:`, err)
        }
      })
    }

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
