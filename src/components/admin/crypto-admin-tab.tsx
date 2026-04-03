'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Plus,
  Trash2,
  Wallet,
  Settings,
  ShoppingCart,
  BarChart3,
  Copy,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  Loader2,
  TrendingUp,
  DollarSign,
  Percent,
  Clock,
  Check,
  AlertCircle,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────
interface Wallet {
  id: string
  ticker: string
  address: string
  minimumPaymentUSD: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface CryptoSettings {
  [key: string]: string
}

interface Order {
  id: string
  orderId: string
  userId: string
  user: { id: string; email: string; name: string | null }
  planId: string | null
  plan: { id: string; name: string; price: number; credits: number } | null
  amountUSD: number
  credits: number
  ticker: string
  coinName: string
  addressIn: string
  txidIn: string | null
  valueCoin: number | null
  confirmations: number
  requiredConf: number
  status: string
  expiresAt: string
  paidAt: string | null
  createdAt: string
  updatedAt: string
}

interface Stats {
  period: string
  totalRevenue: number
  paidOrders: number
  totalOrders: number
  pendingOrders: number
  ordersByStatus: Record<string, { count: number; revenue: number }>
  revenueByCurrency: Record<string, { count: number; revenueUSD: number; volumeCoin: number }>
  totalCreditsGranted: number
  recentOrders: Order[]
}

// ─── Status Badge ────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; variant: 'default' | 'destructive' | 'outline' | 'secondary'; className: string }> = {
    PENDING: { label: 'Pending', variant: 'outline', className: 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10' },
    CONFIRMING: { label: 'Confirming', variant: 'outline', className: 'border-blue-500/30 text-blue-400 bg-blue-500/10' },
    PAID: { label: 'Paid', variant: 'default', className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    EXPIRED: { label: 'Expired', variant: 'destructive', className: '' },
    UNDERPAID: { label: 'Underpaid', variant: 'destructive', className: '' },
    MANUAL_REVIEW: { label: 'Review', variant: 'secondary', className: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
    FAILED: { label: 'Failed', variant: 'destructive', className: '' },
  }

  const c = config[status] || { label: status, variant: 'outline' as const, className: '' }

  return (
    <Badge variant={c.variant} className={`text-xs ${c.className}`}>
      {c.label}
    </Badge>
  )
}

// ─── Mask Address ────────────────────────────────────────────
function maskAddress(address: string): string {
  if (!address || address.length < 12) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

// ─── Format Date ─────────────────────────────────────────────
function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

// ─── Format Currency ─────────────────────────────────────────
function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount)
}

// ─── Main Component ──────────────────────────────────────────
export function CryptoAdminTab() {
  const [activeTab, setActiveTab] = useState('stats')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm text-muted-foreground">Cryptocurrency Payment Management</h3>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-white/5 border border-white/5 p-1 rounded-lg">
          <TabsTrigger value="stats" className="gap-1.5 data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400">
            <BarChart3 className="size-3.5" />
            <span className="hidden sm:inline">Statistics</span>
          </TabsTrigger>
          <TabsTrigger value="orders" className="gap-1.5 data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400">
            <ShoppingCart className="size-3.5" />
            <span className="hidden sm:inline">Orders</span>
          </TabsTrigger>
          <TabsTrigger value="wallets" className="gap-1.5 data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400">
            <Wallet className="size-3.5" />
            <span className="hidden sm:inline">Wallets</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5 data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400">
            <Settings className="size-3.5" />
            <span className="hidden sm:inline">Settings</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stats">
          <StatsSection />
        </TabsContent>
        <TabsContent value="orders">
          <OrdersSection />
        </TabsContent>
        <TabsContent value="wallets">
          <WalletsSection />
        </TabsContent>
        <TabsContent value="settings">
          <SettingsSection />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// STATISTICS SECTION
// ═══════════════════════════════════════════════════════════════
function StatsSection() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('all')

  const fetchStats = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/crypto/stats?period=${period}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success) setStats(data.data)
      }
    } catch {
      toast.error('Failed to load statistics')
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const successRate = stats
    ? stats.totalOrders > 0
      ? ((stats.paidOrders / stats.totalOrders) * 100).toFixed(1)
      : '0'
    : '0'

  const periodOptions = [
    { value: '24h', label: '24h' },
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: 'all', label: 'All Time' },
  ]

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Period:</span>
          <div className="flex gap-1">
            {periodOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPeriod(opt.value)}
                className={`px-2.5 py-1 rounded-md text-xs transition-all ${
                  period === opt.value
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchStats}
          disabled={loading}
          className="gap-1.5"
        >
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : stats ? (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0 }}
              className="glass-card p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="size-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <DollarSign className="size-4 text-emerald-400" />
                </div>
                <span className="text-xs text-muted-foreground">Total Revenue</span>
              </div>
              <p className="text-xl font-bold gradient-text">{formatUSD(stats.totalRevenue)}</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="glass-card p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="size-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <ShoppingCart className="size-4 text-blue-400" />
                </div>
                <span className="text-xs text-muted-foreground">Total Orders</span>
              </div>
              <p className="text-xl font-bold">{stats.totalOrders}</p>
              {stats.pendingOrders > 0 && (
                <p className="text-[10px] text-yellow-400 mt-1">{stats.pendingOrders} pending</p>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-card p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="size-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Percent className="size-4 text-purple-400" />
                </div>
                <span className="text-xs text-muted-foreground">Success Rate</span>
              </div>
              <p className="text-xl font-bold">{successRate}%</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="glass-card p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="size-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <TrendingUp className="size-4 text-orange-400" />
                </div>
                <span className="text-xs text-muted-foreground">Credits Granted</span>
              </div>
              <p className="text-xl font-bold">{stats.totalCreditsGranted.toLocaleString()}</p>
            </motion.div>
          </div>

          {/* Revenue by currency + Recent orders */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Revenue by currency */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-card p-4"
            >
              <h4 className="text-sm font-medium mb-3">Revenue by Currency</h4>
              {Object.keys(stats.revenueByCurrency).length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No revenue data yet</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {Object.entries(stats.revenueByCurrency)
                    .sort((a, b) => b[1].revenueUSD - a[1].revenueUSD)
                    .map(([ticker, data]) => {
                      const maxRevenue = Math.max(
                        ...Object.values(stats.revenueByCurrency).map((d) => d.revenueUSD)
                      )
                      const barWidth = maxRevenue > 0 ? (data.revenueUSD / maxRevenue) * 100 : 0

                      return (
                        <div key={ticker} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium uppercase">{ticker}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-muted-foreground">{data.count} orders</span>
                              <span className="font-medium text-emerald-400">{formatUSD(data.revenueUSD)}</span>
                            </div>
                          </div>
                          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${barWidth}%` }}
                              transition={{ duration: 0.6, ease: 'easeOut' }}
                              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                            />
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
            </motion.div>

            {/* Recent orders */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="glass-card overflow-hidden"
            >
              <h4 className="text-sm font-medium p-4 pb-0 mb-3">Recent Orders</h4>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Order</TableHead>
                      <TableHead className="text-xs">User</TableHead>
                      <TableHead className="text-xs text-right">Amount</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.recentOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-6 text-xs text-muted-foreground">
                          No orders yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      stats.recentOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="text-xs font-mono">{order.orderId.slice(0, 12)}...</TableCell>
                          <TableCell className="text-xs">{order.user?.email || 'Unknown'}</TableCell>
                          <TableCell className="text-xs text-right">{formatUSD(order.amountUSD)}</TableCell>
                          <TableCell>
                            <StatusBadge status={order.status} />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </motion.div>
          </div>

          {/* Orders by status chart */}
          {Object.keys(stats.ordersByStatus).length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass-card p-4"
            >
              <h4 className="text-sm font-medium mb-4">Orders by Status</h4>
              <div className="flex flex-wrap gap-3">
                {Object.entries(stats.ordersByStatus).map(([status, data]) => {
                  const barHeight = Math.max(20, Math.min(80, (data.count / stats.totalOrders) * 100))
                  return (
                    <div key={status} className="flex flex-col items-center gap-1">
                      <span className="text-xs font-medium">{data.count}</span>
                      <div
                        className="w-10 rounded-t-md transition-all"
                        style={{
                          height: `${barHeight}px`,
                          backgroundColor:
                            status === 'PAID'
                              ? '#10b981'
                              : status === 'PENDING'
                              ? '#f59e0b'
                              : status === 'CONFIRMING'
                              ? '#3b82f6'
                              : '#ef4444',
                          opacity: 0.7,
                        }}
                      />
                      <StatusBadge status={status} />
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )}
        </>
      ) : (
        <div className="glass-card p-8 text-center">
          <AlertCircle className="size-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Failed to load statistics</p>
          <Button variant="outline" size="sm" onClick={fetchStats} className="mt-2">
            Retry
          </Button>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// ORDERS SECTION
// ═══════════════════════════════════════════════════════════════
function OrdersSection() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const limit = 15

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) })
      if (statusFilter !== 'all') params.set('status', statusFilter)

      const res = await fetch(`/api/admin/crypto/orders?${params}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setOrders(data.data || [])
          setTotal(data.pagination?.total || 0)
        }
      }
    } catch {
      toast.error('Failed to load orders')
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  const totalPages = Math.ceil(total / limit)

  const statusFilters = [
    { value: 'all', label: 'All' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'CONFIRMING', label: 'Confirming' },
    { value: 'PAID', label: 'Paid' },
    { value: 'EXPIRED', label: 'Expired' },
    { value: 'FAILED', label: 'Failed' },
  ]

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1 overflow-x-auto">
          {statusFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => { setStatusFilter(f.value); setPage(1) }}
              className={`px-3 py-1.5 rounded-lg text-xs transition-all whitespace-nowrap ${
                statusFilter === f.value
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={fetchOrders} disabled={loading} className="gap-1.5">
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Orders table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Order ID</TableHead>
                <TableHead className="text-xs">User</TableHead>
                <TableHead className="text-xs">Currency</TableHead>
                <TableHead className="text-xs text-right">Amount (USD)</TableHead>
                <TableHead className="text-xs text-right">Amount (Crypto)</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs text-center">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-xs text-muted-foreground">
                    No orders found
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((order) => (
                  <React.Fragment key={order.id}>
                    <TableRow>
                      <TableCell className="text-xs font-mono">
                        <button
                          onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                          className="hover:text-emerald-400 transition-colors text-left"
                        >
                          {order.orderId.slice(0, 18)}...
                        </button>
                      </TableCell>
                      <TableCell className="text-xs">{order.user?.email || 'Unknown'}</TableCell>
                      <TableCell className="text-xs uppercase">{order.ticker}</TableCell>
                      <TableCell className="text-xs text-right font-medium">{formatUSD(order.amountUSD)}</TableCell>
                      <TableCell className="text-xs text-right font-mono">
                        {order.valueCoin ? order.valueCoin.toFixed(6) : '-'}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={order.status} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</TableCell>
                      <TableCell className="text-center">
                        <button
                          onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                          className="size-7 rounded-md inline-flex items-center justify-center hover:bg-white/5 transition-colors text-muted-foreground hover:text-foreground"
                        >
                          <Eye className="size-3.5" />
                        </button>
                      </TableCell>
                    </TableRow>

                    {/* Expanded details */}
                    {expandedOrder === order.id && (
                      <TableRow key={`${order.id}-expanded`}>
                        <TableCell colSpan={8} className="bg-white/[0.02]">
                          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                            <div>
                              <span className="text-muted-foreground block mb-1">Full Order ID</span>
                              <div className="flex items-center gap-1">
                                <span className="font-mono">{order.orderId}</span>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(order.orderId)
                                    toast.success('Copied')
                                  }}
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  <Copy className="size-3" />
                                </button>
                              </div>
                            </div>
                            <div>
                              <span className="text-muted-foreground block mb-1">Plan</span>
                              <span>{order.plan?.name || 'Custom purchase'}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block mb-1">Credits</span>
                              <span>{order.credits}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block mb-1">Payment Address</span>
                              <div className="flex items-center gap-1">
                                <span className="font-mono break-all">{order.addressIn}</span>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(order.addressIn)
                                    toast.success('Copied')
                                  }}
                                  className="text-muted-foreground hover:text-foreground shrink-0"
                                >
                                  <Copy className="size-3" />
                                </button>
                              </div>
                            </div>
                            <div>
                              <span className="text-muted-foreground block mb-1">TXID</span>
                              <span className="font-mono">
                                {order.txidIn ? (
                                  <span className="flex items-center gap-1 break-all">
                                    {order.txidIn.length > 20 ? order.txidIn.slice(0, 20) + '...' : order.txidIn}
                                    <button
                                      onClick={() => {
                                        navigator.clipboard.writeText(order.txidIn)
                                        toast.success('Copied')
                                      }}
                                      className="text-muted-foreground hover:text-foreground"
                                    >
                                      <Copy className="size-3" />
                                    </button>
                                  </span>
                                ) : (
                                  '-'
                                )}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block mb-1">Confirmations</span>
                              <span>
                                {order.confirmations} / {order.requiredConf}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block mb-1">Expires</span>
                              <span>{formatDate(order.expiresAt)}</span>
                            </div>
                            {order.paidAt && (
                              <div>
                                <span className="text-muted-foreground block mb-1">Paid At</span>
                                <span>{formatDate(order.paidAt)}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="gap-1"
          >
            <ChevronLeft className="size-3.5" />
            Prev
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages} ({total} orders)
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="gap-1"
          >
            Next
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// WALLETS SECTION
// ═══════════════════════════════════════════════════════════════
function WalletsSection() {
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editWallet, setEditWallet] = useState<Wallet | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    ticker: '',
    address: '',
    minimumPaymentUSD: '5',
  })
  const [editForm, setEditForm] = useState({
    address: '',
    minimumPaymentUSD: '5',
  })

  const fetchWallets = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/crypto/wallets')
      if (res.ok) {
        const data = await res.json()
        if (data.success) setWallets(data.data || [])
      }
    } catch {
      toast.error('Failed to load wallets')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWallets()
  }, [fetchWallets])

  const handleAdd = async () => {
    if (!form.ticker.trim() || !form.address.trim()) {
      toast.error('Ticker and address are required')
      return
    }
    const minPayment = parseFloat(form.minimumPaymentUSD) || 5
    setSaving(true)
    try {
      const res = await fetch('/api/admin/crypto/wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: form.ticker.trim(),
          address: form.address.trim(),
          minimumPaymentUSD: minPayment,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Wallet saved successfully')
        setAddOpen(false)
        setForm({ ticker: '', address: '', minimumPaymentUSD: '5' })
        fetchWallets()
      } else {
        toast.error(data.error || 'Failed to save wallet')
      }
    } catch (err) {
      console.error('Save wallet error:', err)
      toast.error('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (wallet: Wallet) => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/crypto/wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: wallet.ticker,
          address: wallet.address,
          isActive: !wallet.isActive,
          minimumPaymentUSD: wallet.minimumPaymentUSD,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`Wallet ${!wallet.isActive ? 'activated' : 'deactivated'}`)
        fetchWallets()
      } else {
        toast.error(data.error || 'Failed to update wallet')
      }
    } catch (err) {
      console.error('Toggle wallet error:', err)
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  const openEditDialog = (wallet: Wallet) => {
    setEditWallet(wallet)
    setEditForm({
      address: wallet.address,
      minimumPaymentUSD: String(wallet.minimumPaymentUSD || 5),
    })
    setEditOpen(true)
  }

  const handleEdit = async () => {
    if (!editWallet) return
    if (!editForm.address.trim()) {
      toast.error('Address is required')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/crypto/wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: editWallet.ticker,
          address: editForm.address.trim(),
          isActive: editWallet.isActive,
          minimumPaymentUSD: parseFloat(editForm.minimumPaymentUSD) || 5,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Wallet updated successfully')
        setEditOpen(false)
        setEditWallet(null)
        fetchWallets()
      } else {
        toast.error(data.error || 'Failed to update wallet')
      }
    } catch (err) {
      console.error('Edit wallet error:', err)
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/crypto/wallets?id=${deleteId}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        toast.success('Wallet deleted')
        fetchWallets()
      } else {
        toast.error(data.error || 'Failed to delete wallet')
      }
    } catch {
      toast.error('Failed to delete wallet')
    } finally {
      setDeleteId(null)
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm text-muted-foreground">{wallets.length} wallet(s)</h3>
        <Button
          size="sm"
          onClick={() => setAddOpen(true)}
          className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 gap-2"
        >
          <Plus className="size-4" />
          Add Wallet
        </Button>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Ticker</TableHead>
                <TableHead className="text-xs">Address</TableHead>
                <TableHead className="text-xs">Min. Payment</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : wallets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-xs text-muted-foreground">
                    No wallets configured. Click &quot;Add Wallet&quot; to add one.
                  </TableCell>
                </TableRow>
              ) : (
                wallets.map((wallet) => (
                  <TableRow key={wallet.id}>
                    <TableCell className="font-medium text-xs uppercase">{wallet.ticker}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">
                          {maskAddress(wallet.address)}
                        </span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(wallet.address)
                            toast.success('Address copied')
                          }}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Copy className="size-3" />
                        </button>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-medium text-emerald-400">
                      ${formatUSD(wallet.minimumPaymentUSD || 5)}
                    </TableCell>
                    <TableCell>
                      <button onClick={() => handleToggleActive(wallet)}>
                        <Badge variant={wallet.isActive ? 'default' : 'destructive'}>
                          {wallet.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-foreground"
                          onClick={() => openEditDialog(wallet)}
                          title="Edit wallet"
                        >
                          <Settings className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-red-400 hover:text-red-300"
                          onClick={() => setDeleteId(wallet.id)}
                          title="Delete wallet"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Add Wallet Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Wallet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Ticker *</Label>
              <Input
                value={form.ticker}
                onChange={(e) => setForm({ ...form, ticker: e.target.value })}
                placeholder="e.g., btc, eth, erc20/usdt, trc20/usdt"
              />
              <p className="text-[10px] text-muted-foreground">
                Use format: btc, eth, ltc for native coins; erc20/usdt, bep20/usdt, trc20/usdt for tokens
              </p>
            </div>
            <div className="space-y-2">
              <Label>Wallet Address *</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Your wallet address to receive payments"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>Minimum Payment (USD)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">$</span>
                <Input
                  type="number"
                  min={1}
                  step={0.01}
                  value={form.minimumPaymentUSD}
                  onChange={(e) => setForm({ ...form, minimumPaymentUSD: e.target.value })}
                  placeholder="5.00"
                  className="pl-7"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Minimum USD amount accepted for payments with this currency
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAdd}
                disabled={saving || !form.ticker.trim() || !form.address.trim()}
                className="bg-gradient-to-r from-emerald-500 to-teal-500 gap-2"
              >
                {saving && <Loader2 className="size-4 animate-spin" />}
                Save Wallet
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Wallet Dialog */}
      <Dialog open={editOpen} onOpenChange={(v) => { if (!v) setEditOpen(false) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Wallet — {editWallet?.ticker.toUpperCase()}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Ticker</Label>
              <Input
                value={editWallet?.ticker || ''}
                disabled
                className="font-mono text-sm bg-white/[0.02] text-muted-foreground"
              />
              <p className="text-[10px] text-muted-foreground">
                Ticker cannot be changed. Delete and recreate to use a different ticker.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Wallet Address *</Label>
              <Input
                value={editForm.address}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                placeholder="Your wallet address"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>Minimum Payment (USD)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">$</span>
                <Input
                  type="number"
                  min={1}
                  step={0.01}
                  value={editForm.minimumPaymentUSD}
                  onChange={(e) => setEditForm({ ...editForm, minimumPaymentUSD: e.target.value })}
                  className="pl-7"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Minimum USD amount accepted for payments with this currency
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleEdit}
                disabled={saving || !editForm.address.trim()}
                className="bg-gradient-to-r from-emerald-500 to-teal-500 gap-2"
              >
                {saving && <Loader2 className="size-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Wallet</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this wallet? This will disable payments via this cryptocurrency.
              Wallets with active pending orders cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              onClick={handleDelete}
              disabled={saving}
              variant="destructive"
              className="gap-2"
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// SETTINGS SECTION
// ═══════════════════════════════════════════════════════════════
function SettingsSection() {
  const [settings, setSettings] = useState<CryptoSettings>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<CryptoSettings>({})

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/crypto/settings')
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setSettings(data.data || {})
          setForm(data.data || {})
        }
      }
    } catch {
      toast.error('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/crypto/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: form }),
      })
      const data = await res.json()
      if (data.success) {
        setSettings(data.data || {})
        toast.success('Settings saved successfully')
      } else {
        toast.error(data.error || 'Failed to save settings')
      }
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const baseUrl = form.base_url || process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const webhookUrl = `${baseUrl}/api/crypto/webhook`

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Payment Settings */}
      <div className="glass-card p-4 space-y-4">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Settings className="size-4 text-emerald-400" />
          Payment Settings
        </h4>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Base URL</Label>
            <Input
              value={form.base_url || ''}
              onChange={(e) => setForm({ ...form, base_url: e.target.value })}
              placeholder="https://yourdomain.com"
              className="font-mono text-sm"
            />
            <p className="text-[10px] text-muted-foreground">
              Used for generating callback URLs. Must be publicly accessible.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Webhook URL (auto-generated)</Label>
            <div className="flex items-center gap-2">
              <Input
                value={webhookUrl}
                readOnly
                className="font-mono text-xs bg-white/[0.02]"
              />
              <Button
                variant="outline"
                size="icon"
                className="shrink-0 size-9"
                onClick={() => {
                  navigator.clipboard.writeText(webhookUrl)
                  toast.success('Webhook URL copied')
                }}
              >
                <Copy className="size-3.5" />
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Configure this URL in your CryptAPI dashboard or it is sent automatically with each payment creation.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Order Expiry (minutes)</Label>
              <Input
                type="number"
                value={form.order_expiry_minutes || '30'}
                onChange={(e) => setForm({ ...form, order_expiry_minutes: e.target.value })}
                min="5"
                max="120"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Min Payment (USD)</Label>
              <Input
                type="number"
                value={form.min_payment_usd || '1'}
                onChange={(e) => setForm({ ...form, min_payment_usd: e.target.value })}
                min="0.01"
                step="0.01"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5">
            <div>
              <span className="text-xs text-foreground block">Test Mode</span>
              <span className="text-[10px] text-muted-foreground">
                When enabled, payments are simulated (no real crypto required)
              </span>
            </div>
            <Switch
              checked={form.test_mode === 'true'}
              onCheckedChange={(v) => setForm({ ...form, test_mode: v ? 'true' : 'false' })}
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 gap-2"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="size-4" />
              Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
