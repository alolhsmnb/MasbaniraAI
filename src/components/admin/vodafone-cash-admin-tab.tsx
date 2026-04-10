'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Phone,
  Wallet,
  TrendingUp,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Loader2,
  RefreshCw,
  Save,
  Eye,
  Ban,
  Coins,
  AlertCircle,
} from 'lucide-react'

interface VcSettings {
  merchantNumber: string
  minAmountEGP: number
  creditsPerEgp: number
  isEnabled: boolean
  webhookSecret: string
}

interface VcStats {
  totalTransactions: number
  completedTransactions: number
  pendingTransactions: number
  totalCreditsAdded: number
  totalAmountEGP: number
  registeredUsers: number
}

interface Transaction {
  id: string
  trxId: string
  sender: string
  fromNumber: string
  amountEGP: number
  creditsAdded: number
  status: string
  createdAt: string
  processedAt: string | null
  user: {
    id: string
    email: string
    name: string | null
    avatar: string | null
  } | null
}

export function VodafoneCashAdminTab() {
  const [settings, setSettings] = useState<VcSettings | null>(null)
  const [stats, setStats] = useState<VcStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Settings form
  const [merchantNumber, setMerchantNumber] = useState('')
  const [minAmountEGP, setMinAmountEGP] = useState('50')
  const [creditsPerEgp, setCreditsPerEgp] = useState('1')
  const [isEnabled, setIsEnabled] = useState(true)
  const [webhookSecret, setWebhookSecret] = useState('')

  // Transactions
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [txLoading, setTxLoading] = useState(true)
  const [txPage, setTxPage] = useState(1)
  const [txTotal, setTxTotal] = useState(0)
  const [txStatus, setTxStatus] = useState('ALL')
  const [txSearch, setTxSearch] = useState('')

  // Manual assign
  const [assignModal, setAssignModal] = useState<string | null>(null)
  const [assignCredits, setAssignCredits] = useState('')
  const [assignUserId, setAssignUserId] = useState('')
  const [assigning, setAssigning] = useState(false)

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/vodafone-cash/settings')
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.data) {
          setSettings(data.data.settings)
          setStats(data.data.stats)
          setMerchantNumber(data.data.settings.merchantNumber)
          setMinAmountEGP(String(data.data.settings.minAmountEGP))
          setCreditsPerEgp(String(data.data.settings.creditsPerEgp))
          setIsEnabled(data.data.settings.isEnabled)
          setWebhookSecret(data.data.settings.webhookSecret)
        }
      }
    } catch {
      toast.error('Failed to load Vodafone Cash settings')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchTransactions = useCallback(async (page = 1, status = 'ALL', search = '') => {
    setTxLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '15', status, search })
      const res = await fetch(`/api/admin/vodafone-cash/transactions?${params}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.data) {
          setTransactions(data.data.items)
          setTxTotal(data.data.total)
          setTxPage(data.data.page)
        }
      }
    } catch {
      // silent
    } finally {
      setTxLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  useEffect(() => {
    fetchTransactions(txPage, txStatus, txSearch)
  }, [txPage, txStatus, txSearch, fetchTransactions])

  const handleSaveSettings = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/vodafone-cash/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantNumber,
          minAmountEGP: parseFloat(minAmountEGP),
          creditsPerEgp: parseFloat(creditsPerEgp),
          isEnabled,
          webhookSecret,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Settings saved successfully')
        fetchSettings()
      } else {
        toast.error(data.error || 'Failed to save settings')
      }
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleManualAssign = async (txId: string) => {
    if (!assignCredits || !assignUserId) {
      toast.error('Please enter user ID and credits')
      return
    }
    setAssigning(true)
    try {
      const res = await fetch('/api/admin/vodafone-cash/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: txId,
          action: 'assign',
          userId: assignUserId,
          credits: parseInt(assignCredits),
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(data.message)
        setAssignModal(null)
        setAssignCredits('')
        setAssignUserId('')
        fetchTransactions(txPage, txStatus, txSearch)
        fetchSettings()
      } else {
        toast.error(data.error || 'Failed to assign')
      }
    } catch {
      toast.error('Failed to assign transaction')
    } finally {
      setAssigning(false)
    }
  }

  const handleReject = async (txId: string) => {
    try {
      const res = await fetch('/api/admin/vodafone-cash/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: txId, action: 'reject' }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Transaction rejected')
        fetchTransactions(txPage, txStatus, txSearch)
        fetchSettings()
      } else {
        toast.error(data.error || 'Failed to reject')
      }
    } catch {
      toast.error('Failed to reject transaction')
    }
  }

  const statusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      case 'RECEIVED':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      case 'REJECTED':
        return 'bg-red-500/10 text-red-400 border-red-500/20'
      default:
        return 'bg-white/5 text-muted-foreground border-white/10'
    }
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle2 className="size-3.5" />
      case 'RECEIVED':
        return <Clock className="size-3.5" />
      case 'REJECTED':
        return <XCircle className="size-3.5" />
      default:
        return <AlertCircle className="size-3.5" />
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-60 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-red-500/10 flex items-center justify-center">
            <Phone className="size-5 text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Vodafone Cash Payments</h2>
            <p className="text-xs text-muted-foreground">Manage Vodafone Cash payment settings and transactions</p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => { fetchSettings(); fetchTransactions(txPage, txStatus, txSearch) }}
          className="gap-1.5"
        >
          <RefreshCw className="size-3.5" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="glass-card p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Total Transactions</p>
            <p className="text-lg font-bold">{stats.totalTransactions}</p>
          </div>
          <div className="glass-card p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Completed</p>
            <p className="text-lg font-bold text-emerald-400">{stats.completedTransactions}</p>
          </div>
          <div className="glass-card p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Pending</p>
            <p className="text-lg font-bold text-amber-400">{stats.pendingTransactions}</p>
          </div>
          <div className="glass-card p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Total EGP</p>
            <p className="text-lg font-bold">{stats.totalAmountEGP.toLocaleString()}</p>
          </div>
          <div className="glass-card p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Credits Added</p>
            <p className="text-lg font-bold text-emerald-400">{stats.totalCreditsAdded.toLocaleString()}</p>
          </div>
          <div className="glass-card p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Registered Users</p>
            <p className="text-lg font-bold">{stats.registeredUsers}</p>
          </div>
        </div>
      )}

      {/* Settings Section */}
      <div className="glass-card p-4 sm:p-6 space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Wallet className="size-4 text-red-400" />
          Settings
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10 sm:col-span-2">
            <div>
              <span className="text-sm font-medium">Enable Vodafone Cash</span>
              <p className="text-xs text-muted-foreground">Allow users to deposit via Vodafone Cash</p>
            </div>
            <button
              onClick={() => setIsEnabled(!isEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isEnabled ? 'bg-emerald-500' : 'bg-white/20'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                  isEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Merchant Number */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Merchant Number ( receiver )</Label>
            <Input
              value={merchantNumber}
              onChange={(e) => setMerchantNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
              placeholder="01012345678"
              className="font-mono"
              dir="ltr"
              maxLength={11}
            />
          </div>

          {/* Min Amount */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Minimum Amount (EGP)</Label>
            <Input
              type="number"
              value={minAmountEGP}
              onChange={(e) => setMinAmountEGP(e.target.value)}
              min="1"
            />
          </div>

          {/* Credits per EGP */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Credits per 1 EGP</Label>
            <Input
              type="number"
              value={creditsPerEgp}
              onChange={(e) => setCreditsPerEgp(e.target.value)}
              min="0.1"
              step="0.1"
            />
          </div>

          {/* Webhook Secret */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Webhook Secret (optional)</Label>
            <Input
              type="password"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder="Leave empty to disable auth"
            />
          </div>
        </div>

        <Button
          onClick={handleSaveSettings}
          disabled={saving}
          className="gap-2 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save Settings
        </Button>
      </div>

      {/* Transactions Section */}
      <div className="glass-card p-4 sm:p-6 space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <TrendingUp className="size-4 text-red-400" />
          Transactions
        </h3>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by number, trx ID, email..."
              value={txSearch}
              onChange={(e) => setTxSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={txStatus} onValueChange={setTxStatus}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="RECEIVED">Pending</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Transactions Table */}
        {txLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-8">
            <Phone className="size-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No transactions found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors"
              >
                {/* Status */}
                <Badge
                  variant="outline"
                  className={`shrink-0 gap-1 ${statusColor(tx.status)}`}
                >
                  {statusIcon(tx.status)}
                  <span className="text-[10px] hidden sm:inline">{tx.status}</span>
                </Badge>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium font-mono" dir="ltr">{tx.fromNumber}</span>
                    {tx.user && (
                      <span className="text-[10px] text-muted-foreground truncate">
                        ({tx.user.email})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>TX: {tx.trxId}</span>
                    <span>·</span>
                    <span>{new Date(tx.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                {/* Amount & Credits */}
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold">{tx.amountEGP} EGP</p>
                  {tx.creditsAdded > 0 && (
                    <p className="text-xs text-emerald-400">+{tx.creditsAdded} credits</p>
                  )}
                </div>

                {/* Actions for RECEIVED (no user match) */}
                {tx.status === 'RECEIVED' && (
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="size-8 p-0 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                      onClick={() => setAssignModal(tx.id)}
                      title="Manually assign credits"
                    >
                      <Coins className="size-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="size-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      onClick={() => handleReject(tx.id)}
                      title="Reject transaction"
                    >
                      <Ban className="size-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}

            {/* Pagination */}
            {txTotal > 15 && (
              <div className="flex items-center justify-between pt-3 border-t border-white/5">
                <p className="text-xs text-muted-foreground">
                  Showing {((txPage - 1) * 15) + 1}-{Math.min(txPage * 15, txTotal)} of {txTotal}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={txPage <= 1}
                    onClick={() => setTxPage(txPage - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={txPage * 15 >= txTotal}
                    onClick={() => setTxPage(txPage + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Manual Assign Modal */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-card p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-semibold">Manual Credit Assignment</h3>
            <p className="text-xs text-muted-foreground">
              This transaction doesn&apos;t have a matching user. You can manually assign credits to a user.
            </p>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">User ID</Label>
              <Input
                value={assignUserId}
                onChange={(e) => setAssignUserId(e.target.value)}
                placeholder="Enter user ID..."
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Credits to Add</Label>
              <Input
                type="number"
                value={assignCredits}
                onChange={(e) => setAssignCredits(e.target.value)}
                placeholder="Number of credits"
                min="1"
              />
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                variant="outline"
                onClick={() => { setAssignModal(null); setAssignCredits(''); setAssignUserId('') }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
                disabled={assigning || !assignCredits || !assignUserId}
                onClick={() => handleManualAssign(assignModal)}
              >
                {assigning ? <Loader2 className="size-4 animate-spin" /> : 'Assign Credits'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
