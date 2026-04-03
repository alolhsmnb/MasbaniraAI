import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getDefaultPricing } from '@/app/api/admin/pricing/route'

export async function GET() {
  try {
    const models = await db.aiModel.findMany({
      where: { isActive: true },
      include: { pricing: true },
      orderBy: { sortOrder: 'asc' },
    })

    const modelsWithPricing = models.map((model) => ({
      id: model.id,
      modelId: model.modelId,
      name: model.name,
      type: model.type,
      isActive: model.isActive,
      pricing: model.pricing
        ? JSON.parse(model.pricing.pricingJson)
        : getDefaultPricing(model.type, model.modelId),
    }))

    return NextResponse.json({ success: true, data: modelsWithPricing })
  } catch (error) {
    console.error('Get public models error:', error)
    return NextResponse.json({ success: true, data: [] })
  }
}
