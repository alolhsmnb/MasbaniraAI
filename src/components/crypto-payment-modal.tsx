'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { QRCode, QRCodeFromBase64 } from '@/components/qr-code'
import { useAppStore } from '@/store/app-store'
import {
  Copy,
  Check,
  ArrowLeft,
  ArrowRight,
  Clock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  Coins,
  Sparkles,
  Star,
  Zap,
} from 'lucide-react'

// ─── Cryptocurrency color map ────────────────────────────────
const CRYPTO_COLORS: Record<string, string> = {
  btc: '#F7931A',
  eth: '#627EEA',
  ltc: '#BFBBBB',
  bch: '#8DC351',
  usdt: '#26A17B',
  bnb: '#F3BA2F',
  trx: '#FF0013',
  matic: '#8247E5',
}

const CRYPTO_DISPLAY_NAMES: Record<string, string> = {
  btc: 'Bitcoin',
  eth: 'Ethereum',
  ltc: 'Litecoin',
  bch: 'Bitcoin Cash',
  usdt: 'Tether',
  bnb: 'BNB',
  trx: 'TRON',
  matic: 'Polygon',
}

function getTickerDisplay(ticker: string): { name: string; symbol: string; color: string } {
  const t = ticker.toLowerCase()
  const parts = t.split('/')
  const baseTicker = parts[parts.length - 1] || t

  return {
    name: (CRYPTO_DISPLAY_NAMES[baseTicker] || baseTicker.toUpperCase()),
    symbol: ticker.toUpperCase(),
    color: CRYPTO_COLORS[baseTicker] || '#6B7280',
  }
}

// ─── Types ───────────────────────────────────────────────────
interface CryptoCurrency {
  ticker: string
  name: string
  coin: string
  network: string | null
  priceUSD: number | null
  minimumPaymentUSD: number
  fees: { rate: number; miner: number } | null
}

interface Plan {
  id: string
  name: string
  price: number
  credits: number
  features: string[]
  isActive: boolean
}

interface OrderData {
  orderId: string
  addressIn: string
  amountCoin: number
  ticker: string
  coinName: string
  paymentUri: string | null
  qrCodeBase64: string | null
  amountUSD: number
  credits: number
  requiredConf: number
  expiresAt: string
}

interface OrderStatus {
  status: string
  confirmations: number
  requiredConf: number
  txidIn: string | null
  valueCoin: number | null
}

export interface CryptoPaymentModalProps {
  open: boolean
  onClose: () => void
  planId?: string
  planName?: string
  amountUSD?: number
  credits?: number
}

// ─── Countdown Timer ─────────────────────────────────────────
function CountdownTimer({ targetDate, onExpired }: { targetDate: string; onExpired: () => void }) {
  const [timeLeft, setTimeLeft] = useState({ minutes: 0, seconds: 0 })

  useEffect(() => {
    const calculate = () => {
      const diff = new Date(targetDate).getTime() - Date.now()
      if (diff <= 0) {
        setTimeLeft({ minutes: 0, seconds: 0 })
        onExpired()
        return
      }
      setTimeLeft({
        minutes: Math.floor(diff / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      })
    }

    calculate()
    const interval = setInterval(calculate, 1000)
    return () => clearInterval(interval)
  }, [targetDate, onExpired])

  const isLow = timeLeft.minutes < 5

  return (
    <div className={`flex items-center gap-2 text-sm font-mono ${isLow ? 'text-red-400 animate-pulse' : 'text-foreground'}`}>
      <Clock className={`size-4 ${isLow ? 'text-red-400' : 'text-muted-foreground'}`} />
      <span>
        {String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
      </span>
    </div>
  )
}

// ─── Status Indicator ────────────────────────────────────────
const STATUS_STEPS = ['PENDING', 'CONFIRMING', 'PAID'] as const
const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Waiting for Payment',
  CONFIRMING: 'Confirming',
  PAID: 'Payment Confirmed',
  EXPIRED: 'Order Expired',
  FAILED: 'Payment Failed',
}

function StatusIndicator({ status, confirmations = 0, requiredConf = 3 }: { status: string; confirmations?: number; requiredConf?: number }) {
  const currentIndex = STATUS_STEPS.indexOf(status as typeof STATUS_STEPS[number])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        {STATUS_STEPS.map((step, i) => (
          <div key={step} className="flex items-center gap-1.5">
            <div
              className={`size-2.5 rounded-full transition-all duration-500 ${
                i <= currentIndex
                  ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                  : 'bg-white/10'
              }`}
            />
            <span className={`text-xs ${i <= currentIndex ? 'text-emerald-400' : 'text-muted-foreground'}`}>
              {i === 0 ? 'Pending' : i === 1 ? 'Detected' : 'Confirmed'}
            </span>
          </div>
        ))}
      </div>
      {status === 'CONFIRMING' && (
        <p className="text-xs text-muted-foreground text-center">
          {confirmations}/{requiredConf} confirmations
        </p>
      )}
      {(status === 'EXPIRED' || status === 'FAILED') && (
        <p className="text-xs text-red-400 text-center">{STATUS_LABELS[status]}</p>
      )}
    </div>
  )
}

// ─── Step Indicator ──────────────────────────────────────────
function StepIndicator({ currentStep, totalSteps, labels }: { currentStep: number; totalSteps: number; labels: string[] }) {
  return (
    <div className="flex items-center justify-center gap-1 mb-6">
      {Array.from({ length: totalSteps }).map((_, i) => {
        const stepNum = i + 1
        return (
          <div key={stepNum} className="flex items-center gap-1.5">
            <div
              className={`flex items-center justify-center size-8 rounded-full text-sm font-medium transition-all duration-300 ${
                currentStep >= stepNum
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/20'
                  : 'bg-white/5 text-muted-foreground border border-white/10'
              }`}
            >
              {currentStep > stepNum ? (
                <CheckCircle2 className="size-4" />
              ) : (
                stepNum
              )}
            </div>
            <span className={`text-xs hidden sm:inline ${currentStep >= stepNum ? 'text-foreground' : 'text-muted-foreground'}`}>
              {labels[i]}
            </span>
            {i < totalSteps - 1 && (
              <div className={`w-6 h-0.5 ${currentStep > stepNum ? 'bg-emerald-500/50' : 'bg-white/10'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Crypto Icon ─────────────────────────────────────────────
function CryptoIcon({ ticker, size = 40 }: { ticker: string; size?: number }) {
  const { symbol, color } = getTickerDisplay(ticker)
  const displaySymbol = symbol.split('/').pop() || symbol

  return (
    <div
      className="rounded-full flex items-center justify-center font-bold text-white shrink-0"
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        fontSize: size * 0.3,
      }}
    >
      {displaySymbol.charAt(0)}
    </div>
  )
}

// ─── Copy Button ─────────────────────────────────────────────
function CopyButton({ text, className = '' }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('Copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy')
    }
  }

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all hover:bg-white/5 ${className}`}
    >
      {copied ? (
        <>
          <Check className="size-3.5 text-emerald-400" />
          <span className="text-emerald-400">Copied</span>
        </>
      ) : (
        <>
          <Copy className="size-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Copy</span>
        </>
      )}
    </button>
  )
}

// ─── Plan Card ───────────────────────────────────────────────
function PlanCard({
  plan,
  isSelected,
  isPopular,
  onSelect,
}: {
  plan: Plan
  isSelected: boolean
  isPopular: boolean
  onSelect: () => void
}) {
  return (
    <motion.button
      onClick={onSelect}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`relative flex flex-col p-4 rounded-xl border transition-all duration-200 text-left w-full ${
        isSelected
          ? 'border-emerald-500/50 bg-emerald-500/10 shadow-lg shadow-emerald-500/10'
          : 'border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]'
      }`}
    >
      {isPopular && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
          <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0 text-[10px] px-2">
            <Star className="size-2.5 mr-1" />
            Popular
          </Badge>
        </div>
      )}
      {isSelected && (
        <div className="absolute top-3 right-3">
          <CheckCircle2 className="size-5 text-emerald-400" />
        </div>
      )}
      <div className="flex items-center gap-2 mb-3">
        {isPopular ? (
          <Sparkles className="size-4 text-emerald-400" />
        ) : (
          <Zap className="size-4 text-muted-foreground" />
        )}
        <span className="text-sm font-semibold">{plan.name}</span>
      </div>
      <div className="flex items-baseline gap-1 mb-2">
        <span className="text-2xl font-bold gradient-text">${plan.price.toFixed(2)}</span>
        <span className="text-xs text-muted-foreground">USD</span>
      </div>
      <div className="flex items-center gap-1 mb-3">
        <Coins className="size-3.5 text-emerald-400" />
        <span className="text-sm font-medium text-emerald-400">{plan.credits.toLocaleString()}</span>
        <span className="text-xs text-muted-foreground">credits</span>
      </div>
      <div className="space-y-1.5">
        {plan.features.slice(0, 3).map((feature, i) => (
          <div key={i} className="flex items-center gap-2">
            <Check className="size-3 text-emerald-400 shrink-0" />
            <span className="text-[11px] text-muted-foreground">{feature}</span>
          </div>
        ))}
        {plan.features.length > 3 && (
          <span className="text-[10px] text-muted-foreground">+{plan.features.length - 3} more</span>
        )}
      </div>
    </motion.button>
  )
}

// ─── Main Modal ──────────────────────────────────────────────
export function CryptoPaymentModal({
  open,
  onClose,
  planId: propPlanId,
  planName: propPlanName,
  amountUSD: propAmountUSD,
  credits: propCredits,
}: CryptoPaymentModalProps) {
  const { setCredits } = useAppStore()

  // Plan selection state
  const [plans, setPlans] = useState<Plan[]>([])
  const [loadingPlans, setLoadingPlans] = useState(true)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)

  // Currency selection state
  const [currencies, setCurrencies] = useState<CryptoCurrency[]>([])
  const [loadingCurrencies, setLoadingCurrencies] = useState(false)
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null)

  // Order state
  const [orderData, setOrderData] = useState<OrderData | null>(null)
  const [orderStatus, setOrderStatus] = useState<OrderStatus | null>(null)
  const [creatingOrder, setCreatingOrder] = useState(false)
  const [checkingStatus, setCheckingStatus] = useState(false)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  const effectivePlanName = propPlanName || selectedPlan?.name || ''
  const hasPresetPlan = !!(propPlanId && propAmountUSD && propCredits)
  const [step, setStep] = useState(hasPresetPlan ? 2 : 1)
  const totalSteps = hasPresetPlan ? 3 : 4
  const stepLabels = hasPresetPlan
    ? ['Currency', 'Payment', 'Complete']
    : ['Plan', 'Currency', 'Payment', 'Complete']

  // Effective values
  const effectivePlanId = propPlanId || selectedPlanId || undefined
  const effectiveAmount = propAmountUSD || selectedPlan?.price || 0
  const effectiveCredits = propCredits || selectedPlan?.credits || 0

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setStep(hasPresetPlan ? 2 : 1)
      setSelectedPlanId(null)
      setSelectedPlan(null)
      setSelectedTicker(null)
      setOrderData(null)
      setOrderStatus(null)
      setCreatingOrder(false)

      // Fetch plans (unless preset)
      if (!hasPresetPlan) {
        fetchPlans()
      }
      // Always fetch currencies
      fetchCurrencies()
    } else {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [open, hasPresetPlan])

  // ─── Fetch plans ─────────────────────────────────────────
  const fetchPlans = async () => {
    setLoadingPlans(true)
    try {
      const res = await fetch('/api/public/plans')
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setPlans(data.data || [])
        }
      }
    } catch {
      toast.error('Failed to load plans')
    } finally {
      setLoadingPlans(false)
    }
  }

  // ─── Fetch currencies ───────────────────────────────────
  const fetchCurrencies = async () => {
    setLoadingCurrencies(true)
    try {
      const res = await fetch('/api/crypto/currencies')
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setCurrencies(data.data || [])
        }
      }
    } catch {
      // silent
    } finally {
      setLoadingCurrencies(false)
    }
  }

  // ─── Handle plan selection ──────────────────────────────
  const handleSelectPlan = (plan: Plan) => {
    setSelectedPlanId(plan.id)
    setSelectedPlan(plan)
  }

  // ─── Proceed from plan step ─────────────────────────────
  const handleProceedToCurrency = () => {
    if (!selectedPlanId) return
    setStep(2)
  }

  // ─── Create order ───────────────────────────────────────
  const handleCreateOrder = async () => {
    if (!selectedTicker) return

    setCreatingOrder(true)
    try {
      const body: Record<string, string | number> = {
        ticker: selectedTicker,
      }
      if (effectivePlanId) body.planId = effectivePlanId
      if (effectiveAmount > 0) body.amountUSD = effectiveAmount
      if (effectiveCredits > 0) body.credits = effectiveCredits

      const res = await fetch('/api/crypto/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (data.success && data.data) {
        setOrderData(data.data)
        setOrderStatus({
          status: 'PENDING',
          confirmations: 0,
          requiredConf: data.data.requiredConf,
          txidIn: null,
          valueCoin: data.data.amountCoin,
        })
        setStep(hasPresetPlan ? 2 : 3)
      } else {
        toast.error(data.error || 'Failed to create payment order')
      }
    } catch {
      toast.error('Failed to create payment order. Please try again.')
    } finally {
      setCreatingOrder(false)
    }
  }

  // ─── Poll order status ──────────────────────────────────
  const checkOrderStatus = useCallback(async () => {
    if (!orderData) return
    setCheckingStatus(true)
    try {
      const res = await fetch(`/api/crypto/check-order/${orderData.orderId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.data) {
          const newStatus: OrderStatus = {
            status: data.data.status,
            confirmations: data.data.confirmations,
            requiredConf: data.data.requiredConf,
            txidIn: data.data.txidIn,
            valueCoin: data.data.valueCoin,
          }
          setOrderStatus(newStatus)

          const paymentStep = hasPresetPlan ? 2 : 3

          if (data.data.status === 'PAID') {
            if (pollRef.current) clearInterval(pollRef.current)
            try {
              const creditsRes = await fetch('/api/user/credits')
              if (creditsRes.ok) {
                const creditsData = await creditsRes.json()
                if (creditsData.success) setCredits(creditsData.data)
              }
            } catch { /* silent */ }
            setTimeout(() => setStep(paymentStep + 1), 1500)
          } else if (data.data.status === 'EXPIRED' || data.data.status === 'FAILED') {
            if (pollRef.current) clearInterval(pollRef.current)
          }
        }
      }
    } catch {
      // Continue polling on error
    } finally {
      setCheckingStatus(false)
    }
  }, [orderData, setCredits, hasPresetPlan])

  const paymentStep = hasPresetPlan ? 2 : 3

  useEffect(() => {
    if (step === paymentStep && orderData && orderStatus) {
      checkOrderStatus()
      pollRef.current = setInterval(checkOrderStatus, 5000)
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [step, orderData, checkOrderStatus, paymentStep])

  // ─── Handle expiry ──────────────────────────────────────
  const handleExpired = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    if (orderStatus) {
      setOrderStatus({ ...orderStatus, status: 'EXPIRED' })
    }
  }, [orderStatus])

  // ─── Back to currency selection ─────────────────────────
  const handleBackToCurrencies = () => {
    if (pollRef.current) clearInterval(pollRef.current)
    setOrderData(null)
    setOrderStatus(null)
    setStep(hasPresetPlan ? 2 : 2)
    setSelectedTicker(null)
  }

  // ─── Back to plan selection ─────────────────────────────
  const handleBackToPlans = () => {
    setSelectedTicker(null)
    setStep(1)
  }

  // ─── Selected currency info ─────────────────────────────
  const selectedDisplay = selectedTicker ? getTickerDisplay(selectedTicker) : null
  const selectedCurrency = currencies.find(c => c.ticker === selectedTicker)

  // Estimate crypto amount from price data
  const estimatedCryptoAmount = useMemo(() => {
    if (!selectedCurrency?.priceUSD || effectiveAmount <= 0) return null
    return effectiveAmount / selectedCurrency.priceUSD
  }, [selectedCurrency, effectiveAmount])

  // Popular plan index (second plan or middle)
  const popularIndex = plans.length > 2 ? 1 : 0

  // Currency step number
  const currencyStep = hasPresetPlan ? 1 : 2

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto p-0 bg-background/95 backdrop-blur-xl border-white/10">
        {/* Close button on first step */}
        {(step === 1 && !hasPresetPlan) && (
          <div className="absolute top-4 right-4 z-10">
            <button
              onClick={onClose}
              className="size-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        <div className="p-4 sm:p-6">
          <StepIndicator currentStep={step} totalSteps={totalSteps} labels={stepLabels} />

          <AnimatePresence mode="wait">

            {/* ═══════════════════════════════════════════════════
                STEP 1: Select Plan (only when no preset plan)
                ═══════════════════════════════════════════════════ */}
            {!hasPresetPlan && step === 1 && (
              <motion.div
                key="step1-plan"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                <DialogHeader className="mb-4">
                  <DialogTitle className="text-xl">Choose a Plan</DialogTitle>
                  <p className="text-sm text-muted-foreground">
                    Select a plan or enter a custom amount to buy credits
                  </p>
                </DialogHeader>

                {loadingPlans ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-52 rounded-xl" />
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                      {plans.map((plan, i) => (
                        <PlanCard
                          key={plan.id}
                          plan={plan}
                          isSelected={selectedPlanId === plan.id}
                          isPopular={i === popularIndex}
                          onSelect={() => handleSelectPlan(plan)}
                        />
                      ))}
                    </div>

                    {/* Continue button */}
                    <Button
                      className="w-full mt-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold h-11"
                      disabled={!selectedPlanId}
                      onClick={handleProceedToCurrency}
                    >
                      Continue
                      <ArrowRight className="size-4 ml-2" />
                    </Button>
                  </>
                )}
              </motion.div>
            )}

            {/* ═══════════════════════════════════════════════════
                STEP 2 (or 1 with preset): Select Currency
                ═══════════════════════════════════════════════════ */}
            {step === currencyStep && (
              <motion.div
                key={`step-currency`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                {/* Back button */}
                {!hasPresetPlan && (
                  <button
                    onClick={handleBackToPlans}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
                  >
                    <ArrowLeft className="size-4" />
                    Back to Plans
                  </button>
                )}

                <DialogHeader className="mb-4">
                  <DialogTitle className="text-xl">
                    Select Payment Method
                  </DialogTitle>
                  <p className="text-sm text-muted-foreground">
                    {effectiveAmount > 0
                      ? `${effectivePlanName} — $${effectiveAmount.toFixed(2)} USD (${effectiveCredits} credits)`
                      : 'Choose a cryptocurrency to pay with'}
                  </p>
                </DialogHeader>

                {loadingCurrencies ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <Skeleton key={i} className="h-24 rounded-xl" />
                    ))}
                  </div>
                ) : currencies.length === 0 ? (
                  <div className="text-center py-12">
                    <AlertCircle className="size-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">
                      No payment methods available. Please contact support.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                      {currencies.map((currency) => {
                        const display = getTickerDisplay(currency.ticker)
                        const isSelected = selectedTicker === currency.ticker

                        return (
                          <motion.button
                            key={currency.ticker}
                            onClick={() => setSelectedTicker(currency.ticker)}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-200 text-left ${
                              isSelected
                                ? 'border-emerald-500/50 bg-emerald-500/10 shadow-lg shadow-emerald-500/10'
                                : 'border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]'
                            }`}
                          >
                            {isSelected && (
                              <div className="absolute top-2 right-2">
                                <CheckCircle2 className="size-4 text-emerald-400" />
                              </div>
                            )}
                            <CryptoIcon ticker={currency.ticker} size={36} />
                            <div className="text-center min-w-0 w-full">
                              <p className="text-sm font-medium truncate">{display.name}</p>
                              <p className="text-xs text-muted-foreground">{display.symbol}</p>
                            </div>
                          </motion.button>
                        )
                      })}
                    </div>

                    {/* Amount summary */}
                    <div className="glass-card p-4 space-y-3 mb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                            <Coins className="size-5 text-emerald-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {effectiveCredits} credits
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {effectivePlanName || 'Custom purchase'}
                            </p>
                          </div>
                        </div>
                        <p className="text-lg font-bold gradient-text">${effectiveAmount.toFixed(2)}</p>
                      </div>
                      {selectedTicker && estimatedCryptoAmount !== null && (
                        <div className="pt-3 border-t border-white/10">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Estimated crypto amount</span>
                            <span className="text-sm font-bold font-mono text-foreground">
                              {estimatedCryptoAmount.toFixed(8)} {selectedDisplay?.symbol}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Based on current exchange rate. Final amount calculated at payment time.
                          </p>
                        </div>
                      )}
                      {selectedTicker && estimatedCryptoAmount === null && (
                        <div className="pt-3 border-t border-white/10">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="size-3 animate-spin" />
                            Loading exchange rate...
                          </div>
                        </div>
                      )}
                    </div>

                    <Button
                      className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold h-11"
                      disabled={!selectedTicker || creatingOrder}
                      onClick={handleCreateOrder}
                    >
                      {creatingOrder ? (
                        <>
                          <Loader2 className="size-4 animate-spin mr-2" />
                          Creating Order...
                        </>
                      ) : (
                        <>
                          Continue with{' '}
                          {selectedDisplay ? selectedDisplay.symbol : 'Crypto'}
                          <ArrowRight className="size-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </>
                )}
              </motion.div>
            )}

            {/* ═══════════════════════════════════════════════════
                STEP 3 (or 2 with preset): Payment Details
                ═══════════════════════════════════════════════════ */}
            {step === paymentStep && orderData && orderStatus && (
              <motion.div
                key={`step-payment`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={handleBackToCurrencies}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="size-4" />
                    Back
                  </button>
                  <CountdownTimer
                    targetDate={orderData.expiresAt}
                    onExpired={handleExpired}
                  />
                </div>

                <DialogHeader className="mb-4">
                  <DialogTitle className="text-xl">
                    Send Payment
                  </DialogTitle>
                  <p className="text-sm text-muted-foreground">
                    Send exactly <span className="text-foreground font-medium">{(orderData.amountCoin ?? 0).toFixed(8)} {orderData.ticker.toUpperCase()}</span> to the address below
                  </p>
                </DialogHeader>

                {/* Status indicator */}
                <div className="glass-card p-4 mb-4">
                  <StatusIndicator
                    status={orderStatus.status}
                    confirmations={orderStatus.confirmations}
                    requiredConf={orderStatus.requiredConf}
                  />
                </div>

                {/* QR Code */}
                <div className="flex justify-center mb-4">
                  <div className="p-3 rounded-2xl bg-white">
                    {orderData.qrCodeBase64 ? (
                      <QRCodeFromBase64 data={orderData.qrCodeBase64} size={200} />
                    ) : (
                      <QRCode value={orderData.paymentUri || orderData.addressIn} size={200} />
                    )}
                  </div>
                </div>

                {/* Amount + Address */}
                <div className="space-y-3 mb-4">
                  <div className="glass-card p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">Amount</span>
                      <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-400">
                        {orderData.amountUSD.toFixed(2)} USD
                      </Badge>
                    </div>
                    <p className="text-lg font-bold font-mono">{(orderData.amountCoin ?? 0).toFixed(8)} {orderData.ticker.toUpperCase()}</p>
                  </div>

                  <div className="glass-card p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">Payment Address</span>
                      <CopyButton text={orderData.addressIn} />
                    </div>
                    <p className="text-xs font-mono break-all text-muted-foreground leading-relaxed">
                      {orderData.addressIn}
                    </p>
                  </div>

                  {orderData.paymentUri && (
                    <div className="glass-card p-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">Payment URI</span>
                        <CopyButton text={orderData.paymentUri} />
                      </div>
                      <p className="text-xs font-mono break-all text-muted-foreground leading-relaxed">
                        {orderData.paymentUri}
                      </p>
                    </div>
                  )}
                </div>

                {/* Order info */}
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                  <span>Order: {orderData.orderId}</span>
                  <span>{orderData.credits} credits</span>
                </div>

                {/* Checking indicator */}
                {checkingStatus && (
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" />
                    Checking status...
                  </div>
                )}

                {/* Expired / Failed actions */}
                {(orderStatus.status === 'EXPIRED' || orderStatus.status === 'FAILED') && (
                  <div className="mt-3">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handleBackToCurrencies}
                    >
                      Try Again
                    </Button>
                  </div>
                )}
              </motion.div>
            )}

            {/* ═══════════════════════════════════════════════════
                STEP 4 (or 3 with preset): Success
                ═══════════════════════════════════════════════════ */}
            {step === (hasPresetPlan ? 3 : 4) && (
              <motion.div
                key="step-success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="text-center py-6"
              >
                {/* Success animation */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
                  className="mb-6"
                >
                  <div className="relative inline-flex">
                    <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
                    <div className="relative size-20 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                      <CheckCircle2 className="size-10 text-white" />
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <h2 className="text-2xl font-bold mb-2">Payment Confirmed!</h2>
                  <p className="text-muted-foreground mb-1">
                    {effectiveCredits > 0
                      ? `${effectiveCredits} credits have been added to your account`
                      : 'Your credits have been added to your account'}
                  </p>
                  {orderData && (
                    <p className="text-xs text-muted-foreground mb-6">
                      Order: {orderData.orderId}
                    </p>
                  )}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                >
                  <Button
                    className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold px-8"
                    onClick={onClose}
                  >
                    Start Creating
                  </Button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  )
}
