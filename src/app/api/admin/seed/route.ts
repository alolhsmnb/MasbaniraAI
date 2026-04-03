import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, AuthError } from '@/lib/auth'

const DEFAULT_SETTINGS: Record<string, string> = {
  site_name: 'PixelForge AI',
  site_description: 'Professional AI-powered platform for generating stunning images and videos',
  daily_free_credits: '10',
  cost_per_generation: '1',
}

const DEFAULT_PLANS = [
  {
    name: 'Free',
    price: 0,
    credits: 0,
    features: JSON.stringify([
      '10 daily free credits',
      'Basic image generation',
      'Standard quality',
      'Community support',
    ]),
    isActive: true,
    sortOrder: 0,
  },
  {
    name: 'Starter',
    price: 9.99,
    credits: 100,
    features: JSON.stringify([
      '100 credits per month',
      'All image models',
      'HD quality',
      'Priority generation',
      'Email support',
    ]),
    isActive: true,
    sortOrder: 1,
  },
  {
    name: 'Pro',
    price: 29.99,
    credits: 500,
    features: JSON.stringify([
      '500 credits per month',
      'All image & video models',
      '4K quality',
      'Fastest generation',
      'Priority support',
      'API access',
    ]),
    isActive: true,
    sortOrder: 2,
  },
  {
    name: 'Enterprise',
    price: 99.99,
    credits: 2000,
    features: JSON.stringify([
      '2000 credits per month',
      'All models including new releases',
      'Maximum quality',
      'Dedicated resources',
      '24/7 priority support',
      'API access',
      'Custom model fine-tuning',
    ]),
    isActive: true,
    sortOrder: 3,
  },
]

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)

    const results: Record<string, number> = {
      settingsCreated: 0,
      settingsSkipped: 0,
      plansCreated: 0,
      plansSkipped: 0,
    }

    // Seed settings (only if not already present)
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      const existing = await db.siteSetting.findUnique({
        where: { key },
      })

      if (!existing) {
        await db.siteSetting.create({
          data: { key, value },
        })
        results.settingsCreated++
      } else {
        results.settingsSkipped++
      }
    }

    // Seed plans (only if not already present)
    for (const plan of DEFAULT_PLANS) {
      const existing = await db.plan.findFirst({
        where: { name: plan.name },
      })

      if (!existing) {
        await db.plan.create({
          data: plan,
        })
        results.plansCreated++
      } else {
        results.plansSkipped++
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        message: 'Seed completed',
        ...results,
      },
    })
  } catch (error) {
    console.error('Seed error:', error)

    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to seed data' },
      { status: 500 }
    )
  }
}
