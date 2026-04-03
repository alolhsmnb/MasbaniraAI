import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, AuthError } from '@/lib/auth'
import { getLogsUrl } from '@/lib/cryptapi'

/**
 * GET /api/crypto/check-order/[orderId]
 *
 * Checks the status of a cryptocurrency payment order.
 * Users can only check their own orders.
 * Also polls CryptAPI logs endpoint for the latest status.
 *
 * Returns:
 *   - Order details including current status
 *   - Updated status from CryptAPI (if available)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const session = await requireAuth(request)
    const { orderId } = await params

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'orderId is required' },
        { status: 400 }
      )
    }

    // Look up the order (user can only check their own orders)
    const order = await db.cryptoOrder.findUnique({
      where: { orderId },
      include: {
        plan: {
          select: { id: true, name: true, price: true, credits: true },
        },
      },
    })

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      )
    }

    // Ensure user owns this order
    if (order.userId !== session.userId) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      )
    }

    // Check if order has expired
    const isExpired = order.status === 'PENDING' && new Date() > order.expiresAt
    if (isExpired) {
      await db.cryptoOrder.update({
        where: { orderId },
        data: { status: 'EXPIRED' },
      })
      order.status = 'EXPIRED'
    }

    // Poll CryptAPI for the latest status if order is still pending
    let cryptApiStatus: { pending: boolean; confirmations: number; txid: string | null; value_coin: number | null } | null = null
    if (order.status === 'PENDING' || order.status === 'CONFIRMING') {
      try {
        const logsUrl = getLogsUrl(order.ticker, order.callbackUrl)
        const logsResponse = await fetch(logsUrl, {
          headers: { Accept: 'application/json' },
        })

        if (logsResponse.ok) {
          const logsData = await logsResponse.json()

          // CryptAPI /logs/ returns an object with a "callbacks" array, NOT a direct array
          // Response: { address_in: "...", callbacks: [ { txid_in, confirmations, pending, value_coin, result, ... } ] }
          let callbacks: Array<Record<string, unknown>> = []

          if (logsData && Array.isArray(logsData.callbacks)) {
            callbacks = logsData.callbacks
          } else if (Array.isArray(logsData)) {
            callbacks = logsData
          }

          if (callbacks.length > 0) {
            // Get the latest callback event
            const latestEvent = callbacks[callbacks.length - 1]
            const isPending = latestEvent.pending === 1 || latestEvent.pending === '1'
            const numConf = parseInt(String(latestEvent.confirmations || 0), 10)
            const numValueCoin = parseFloat(String(latestEvent.value_coin || 0))
            const result = String(latestEvent.result || '')

            cryptApiStatus = {
              pending: isPending,
              confirmations: numConf,
              txid: (latestEvent.txid_in as string) || null,
              value_coin: numValueCoin,
            }

            // Determine new status based on CryptAPI data
            let newStatus: string | null = null
            if (numConf > 0) {
              if (result === 'done' || (!isPending && numConf >= order.requiredConf)) {
                // Fully confirmed: result=done means webhook got *ok* response
                newStatus = 'PAID'
              } else {
                // Still being confirmed (pending TX or not enough confirmations)
                newStatus = 'CONFIRMING'
              }
            }

            // Update order in DB
            if (newStatus && newStatus !== order.status) {
              const updateData: Record<string, unknown> = {
                confirmations: numConf,
                status: newStatus,
                txidIn: (latestEvent.txid_in as string) || order.txidIn,
                uuid: (latestEvent.uuid as string) || order.uuid,
                webhookRaw: JSON.stringify(latestEvent),
              }

              if (newStatus === 'PAID' && !order.paidAt) {
                updateData.paidAt = new Date()
                updateData.valueCoin = numValueCoin || order.valueCoin
              }

              const updatedOrder = await db.cryptoOrder.update({
                where: { orderId },
                data: updateData,
              })

              // Credit user if payment just got confirmed
              if (newStatus === 'PAID' && order.status !== 'PAID') {
                try {
                  await db.$transaction(async (tx) => {
                    await tx.cryptoOrder.update({
                      where: { id: updatedOrder.id },
                      data: { status: 'PAID', paidAt: updateData.paidAt as Date },
                    })
                    await tx.user.update({
                      where: { id: updatedOrder.userId },
                      data: { paidCredits: { increment: updatedOrder.credits } },
                    })
                  })
                  console.log(`[check-order] Payment confirmed via poll: Order ${order.orderId}, Credits: ${updatedOrder.credits}, Conf: ${numConf}`)
                } catch (error) {
                  console.error('[check-order] Failed to credit user:', error)
                  await db.cryptoOrder.update({
                    where: { orderId },
                    data: { status: 'MANUAL_REVIEW' },
                  })
                }
              }

              // Refresh order data after update
              order.status = newStatus
              order.confirmations = numConf
              order.txidIn = (latestEvent.txid_in as string) || order.txidIn
            } else if (numConf > order.confirmations) {
              // Just update confirmations count
              await db.cryptoOrder.update({
                where: { orderId },
                data: { confirmations: numConf },
              })
              order.confirmations = numConf
            }
          }
        }
      } catch (error) {
        console.error('CryptAPI logs poll error:', error)
        // Non-critical, continue with DB status
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        orderId: order.orderId,
        status: order.status,
        ticker: order.ticker,
        coinName: order.coinName,
        amountUSD: order.amountUSD,
        credits: order.credits,
        addressIn: order.addressIn,
        paymentUri: order.paymentUri,
        valueCoin: order.valueCoin,
        confirmations: order.confirmations,
        requiredConf: order.requiredConf,
        txidIn: order.txidIn,
        paidAt: order.paidAt,
        expiresAt: order.expiresAt.toISOString(),
        createdAt: order.createdAt.toISOString(),
        plan: order.plan || null,
        cryptApiStatus,
      },
    })
  } catch (error) {
    console.error('Check crypto order error:', error)

    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to check order status' },
      { status: 500 }
    )
  }
}
