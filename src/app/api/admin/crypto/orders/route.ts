import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, AuthError } from '@/lib/auth'
import { Prisma } from '@prisma/client'

/**
 * GET /api/admin/crypto/orders
 *
 * List all cryptocurrency orders with optional filters.
 * Admin-only endpoint.
 *
 * Query params:
 *   - status (optional): Filter by status (PENDING, CONFIRMING, PAID, EXPIRED, UNDERPAID, MANUAL_REVIEW)
 *   - ticker (optional): Filter by cryptocurrency ticker
 *   - startDate (optional): Filter from date (ISO string)
 *   - endDate (optional): Filter to date (ISO string)
 *   - page (optional): Page number (default: 1)
 *   - limit (optional): Items per page (default: 20, max: 100)
 *
 * Returns:
 *   - Array of orders with user email
 *   - Pagination metadata
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const ticker = searchParams.get('ticker')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)

    // Build where clause
    const where: Prisma.CryptoOrderWhereInput = {}

    if (status) {
      where.status = status
    }

    if (ticker) {
      where.ticker = ticker.toLowerCase()
    }

    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        where.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate)
      }
    }

    // Get orders with user info
    const [orders, total] = await Promise.all([
      db.cryptoOrder.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
          plan: {
            select: { id: true, name: true, price: true, credits: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.cryptoOrder.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Get crypto orders error:', error)

    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to get orders' },
      { status: 500 }
    )
  }
}
