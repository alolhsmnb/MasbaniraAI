import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const plans = await db.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    })
    const formatted = plans.map(p => ({
      ...p,
      features: JSON.parse(p.features || '[]'),
    }))
    if (formatted.length === 0) {
      return NextResponse.json({ success: true, data: [
        { id: 'default-free', name: 'Free', price: 0, credits: 10, features: ['Basic AI models', 'Standard quality (1K)', '10 credits per day', 'Community support'], isActive: true, sortOrder: 0 },
        { id: 'default-pro', name: 'Pro', price: 9.99, credits: 500, features: ['All AI models', 'Up to 4K quality', '500 credits/month', 'Priority processing', 'Priority support', 'Commercial license'], isActive: true, sortOrder: 1 },
        { id: 'default-enterprise', name: 'Enterprise', price: 29.99, credits: 2000, features: ['All AI models', 'Up to 4K quality', '2000 credits/month', 'Fastest processing', 'Dedicated support', 'Commercial license', 'API access', 'Custom models'], isActive: true, sortOrder: 2 },
      ]})
    }
    return NextResponse.json({ success: true, data: formatted })
  } catch (error) {
    console.error('Get public plans error:', error)
    return NextResponse.json({ success: true, data: [] })
  }
}
