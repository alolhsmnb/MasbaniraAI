import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, AuthError } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request)

    const { id } = await params

    const existing = await db.adSlot.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Ad not found' }, { status: 404 })
    }

    await db.adSlot.delete({ where: { id } })

    return NextResponse.json({ success: true, data: { message: 'Ad deleted' } })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode })
    }
    console.error('Delete ad error:', error)
    return NextResponse.json({ success: false, error: 'Failed to delete ad' }, { status: 500 })
  }
}
