import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, AuthError } from '@/lib/auth'
import { Prisma } from '@prisma/client'

/**
 * GET /api/admin/crypto/stats
 *
 * Returns cryptocurrency payment statistics for the admin dashboard.
 * Admin-only endpoint.
 *
 * Query params:
 *   - period (optional): Time period - '24h', '7d', '30d', 'all' (default: 'all')
 *
 * Returns:
 *   - totalRevenue: Total USD revenue from paid orders
 *   - totalOrders: Total number of orders
 *   - ordersByStatus: Count of orders grouped by status
 *   - revenueByCurrency: Revenue grouped by cryptocurrency ticker
 *   - recentOrders: Last 10 orders with user info
 *   - pendingOrders: Orders currently awaiting payment
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'all'

    // Build date filter based on period
    const dateFilter: Prisma.DateTimeNullableFilter | undefined = undefined
    let periodStart: Date | undefined

    switch (period) {
      case '24h':
        periodStart = new Date(Date.now() - 24 * 60 * 60 * 1000)
        break
      case '7d':
        periodStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        periodStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        break
    }

    const where: Prisma.CryptoOrderWhereInput = {}
    if (periodStart) {
      where.createdAt = { gte: periodStart }
    }

    // Run all queries in parallel for performance
    const [
      totalRevenueResult,
      totalOrders,
      ordersByStatus,
      revenueByCurrency,
      recentOrders,
      pendingOrders,
      totalCreditsGranted,
    ] = await Promise.all([
      // Total revenue from paid orders
      db.cryptoOrder.aggregate({
        where: { ...where, status: 'PAID' },
        _sum: { amountUSD: true },
        _count: true,
      }),

      // Total number of orders
      db.cryptoOrder.count({ where }),

      // Orders grouped by status
      db.cryptoOrder.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
        _sum: { amountUSD: true },
      }),

      // Revenue by currency
      db.cryptoOrder.groupBy({
        by: ['ticker'],
        where: { ...where, status: 'PAID' },
        _count: { id: true },
        _sum: { amountUSD: true, valueCoin: true },
      }),

      // Recent 10 orders
      db.cryptoOrder.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),

      // Currently pending orders count
      db.cryptoOrder.count({
        where: { ...where, status: 'PENDING' },
      }),

      // Total credits granted from paid orders
      db.cryptoOrder.aggregate({
        where: { ...where, status: 'PAID' },
        _sum: { credits: true },
      }),
    ])

    // Format orders by status into a clean object
    const statusMap: Record<string, { count: number; revenue: number }> = {}
    for (const item of ordersByStatus) {
      statusMap[item.status] = {
        count: item._count.id,
        revenue: item._sum.amountUSD || 0,
      }
    }

    // Format revenue by currency
    const currencyMap: Record<string, { count: number; revenueUSD: number; volumeCoin: number }> = {}
    for (const item of revenueByCurrency) {
      currencyMap[item.ticker] = {
        count: item._count.id,
        revenueUSD: item._sum.amountUSD || 0,
        volumeCoin: item._sum.valueCoin || 0,
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        period,
        totalRevenue: totalRevenueResult._sum.amountUSD || 0,
        paidOrders: totalRevenueResult._count,
        totalOrders,
        pendingOrders,
        ordersByStatus: statusMap,
        revenueByCurrency: currencyMap,
        totalCreditsGranted: totalCreditsGranted._sum.credits || 0,
        recentOrders,
      },
    })
  } catch (error) {
    console.error('Get crypto stats error:', error)

    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to get crypto stats' },
      { status: 500 }
    )
  }
}
