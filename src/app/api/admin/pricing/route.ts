import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, AuthError } from '@/lib/auth'

// GET /api/admin/pricing?modelId=xxx - Get pricing for a specific model
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)

    const { searchParams } = new URL(request.url)
    const modelId = searchParams.get('modelId')

    if (!modelId) {
      // Return all pricing
      const allPricing = await db.modelPricing.findMany({
        include: { aiModel: { select: { modelId: true, name: true, type: true } } },
      })
      return NextResponse.json({ success: true, data: allPricing })
    }

    // Get pricing for specific model
    const model = await db.aiModel.findUnique({
      where: { modelId },
    })

    if (!model) {
      return NextResponse.json(
        { success: false, error: 'Model not found' },
        { status: 404 }
      )
    }

    let pricing = await db.modelPricing.findUnique({
      where: { modelId: model.id },
    })

    // If no pricing exists, return default structure
    if (!pricing) {
      const defaultPricing = getDefaultPricing(model.type, model.modelId)
      return NextResponse.json({
        success: true,
        data: {
          modelId: model.modelId,
          modelType: model.type,
          pricing: defaultPricing,
          exists: false,
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        modelId: model.modelId,
        modelType: model.type,
        pricing: JSON.parse(pricing.pricingJson),
        exists: true,
      },
    })
  } catch (error) {
    console.error('Get pricing error:', error)
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      )
    }
    return NextResponse.json(
      { success: false, error: 'Failed to get pricing' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/pricing - Save pricing for a model
export async function PUT(request: NextRequest) {
  try {
    await requireAdmin(request)

    const body = await request.json()
    const { modelId, pricing } = body || {}

    if (!modelId || !pricing) {
      return NextResponse.json(
        { success: false, error: 'modelId and pricing are required' },
        { status: 400 }
      )
    }

    const model = await db.aiModel.findUnique({
      where: { modelId },
    })

    if (!model) {
      return NextResponse.json(
        { success: false, error: 'Model not found' },
        { status: 404 }
      )
    }

    const pricingJson = JSON.stringify(pricing)

    // Upsert pricing
    const result = await db.modelPricing.upsert({
      where: { modelId: model.id },
      update: { pricingJson },
      create: {
        modelId: model.id,
        pricingJson,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        modelId: model.modelId,
        pricing: JSON.parse(result.pricingJson),
      },
    })
  } catch (error) {
    console.error('Save pricing error:', error)
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      )
    }
    return NextResponse.json(
      { success: false, error: 'Failed to save pricing' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/pricing?modelId=xxx - Reset pricing to defaults (delete stored + return fresh defaults)
export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin(request)

    const { searchParams } = new URL(request.url)
    const modelId = searchParams.get('modelId')

    if (!modelId) {
      return NextResponse.json(
        { success: false, error: 'modelId is required' },
        { status: 400 }
      )
    }

    const model = await db.aiModel.findUnique({
      where: { modelId },
    })

    if (!model) {
      return NextResponse.json(
        { success: false, error: 'Model not found' },
        { status: 404 }
      )
    }

    // Delete existing pricing
    try {
      await db.modelPricing.deleteMany({
        where: { modelId: model.id },
      })
    } catch {
      // May not exist yet, ignore
    }

    // Return fresh defaults
    const defaultPricing = getDefaultPricing(model.type, model.modelId)

    return NextResponse.json({
      success: true,
      data: {
        modelId: model.modelId,
        modelType: model.type,
        pricing: defaultPricing,
      },
    })
  } catch (error) {
    console.error('Reset pricing error:', error)
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      )
    }
    return NextResponse.json(
      { success: false, error: 'Failed to reset pricing' },
      { status: 500 }
    )
  }
}

// Helper: Generate default pricing based on model type
export function getDefaultPricing(modelType: string, modelModelId: string) {
  // Sora2 models use frames instead of duration
  const isSora2 = modelModelId.startsWith('sora-2')
  // Veo models have flat pricing
  const isVeo = modelModelId.startsWith('veo3')
  // Seedance has fixed settings, uses flat pricing
  const isSeedance = modelModelId === 'bytedance/seedance-2-fast'
  // Kling models: pricing by duration only
  const isKling = modelModelId.startsWith('kwaivgi/kling')

  if (modelType === 'IMAGE') {
    return {
      format: 'resolution',
      tiers: {
        Auto: 1,
        '1K': 1,
        '2K': 2,
        '4K': 3,
      },
    }
  }

  if (isSora2) {
    return {
      format: 'frames',
      tiers: {
        '10': 10,
        '15': 15,
      },
    }
  }

  if (isVeo || isSeedance) {
    return {
      format: 'flat',
      tiers: {
        default: 10,
      },
    }
  }

  if (isKling) {
    // Kling: duration-based pricing (3-15 seconds)
    const klingTiers: Record<string, number> = {}
    for (let d = 3; d <= 15; d++) {
      klingTiers[String(d)] = Math.max(1, Math.round(d * 1.5))
    }
    return {
      format: 'duration',
      tiers: klingTiers,
    }
  }

  // Standard video models (Grok) - duration × resolution matrix
  const durations = ['6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30']
  const tiers: Record<string, Record<string, number>> = {}

  for (const dur of durations) {
    const d = parseInt(dur)
    tiers[dur] = {
      '480p': Math.max(1, Math.round(d * 0.8)),
      '720p': Math.max(1, Math.round(d * 1.2)),
    }
  }

  return {
    format: 'duration_resolution',
    tiers,
  }
}
