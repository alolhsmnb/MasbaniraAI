import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/public/cost-preview?modelId=xxx&imageSize=1K&duration=6&nFrames=10
// Returns the credit cost for a specific combination of options
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const modelId = searchParams.get('modelId')
    const imageSize = searchParams.get('imageSize')
    const duration = searchParams.get('duration')
    const nFrames = searchParams.get('nFrames')

    if (!modelId) {
      return NextResponse.json(
        { success: false, error: 'modelId is required' },
        { status: 400 }
      )
    }

    const model = await db.aiModel.findUnique({
      where: { modelId },
      include: { pricing: true },
    })

    if (!model || !model.isActive) {
      return NextResponse.json(
        { success: false, error: 'Model not found or inactive' },
        { status: 404 }
      )
    }

    const cost = calculateCost(model, {
      imageSize: imageSize || undefined,
      duration: duration ? parseInt(duration) : undefined,
      nFrames: nFrames || undefined,
    })

    return NextResponse.json({ success: true, data: { cost, modelId: model.modelId } })
  } catch (error) {
    console.error('Cost preview error:', error)
    return NextResponse.json({ success: true, data: { cost: 1 } })
  }
}

function calculateCost(
  model: { modelId: string; type: string; pricing: { pricingJson: string } | null },
  options: { imageSize?: string; duration?: number; nFrames?: string }
): number {
  const defaultCost = 1
  if (!model.pricing) return defaultCost

  try {
    const pricingConfig = JSON.parse(model.pricing.pricingJson)
    const format = pricingConfig.format
    const tiers = pricingConfig.tiers

    if (!tiers) return defaultCost

    if (format === 'resolution') {
      const res = options.imageSize || '1K'
      return Math.max(1, parseInt(String(tiers[res])) || defaultCost)
    }

    if (format === 'duration_resolution') {
      const dur = String(options.duration || 6)
      const res = options.imageSize || '480p'
      const durationTiers = tiers[dur]
      if (durationTiers && typeof durationTiers === 'object') {
        return Math.max(1, parseInt(String(durationTiers[res])) || defaultCost)
      }
      return defaultCost
    }

    if (format === 'frames') {
      const frames = options.nFrames || '10'
      return Math.max(1, parseInt(String(tiers[frames])) || defaultCost)
    }

    if (format === 'flat') {
      return Math.max(1, parseInt(String(tiers.default)) || defaultCost)
    }

    return defaultCost
  } catch {
    return defaultCost
  }
}
