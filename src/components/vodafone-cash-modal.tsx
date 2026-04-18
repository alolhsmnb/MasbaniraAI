'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CopyButton } from '@/components/crypto-payment-modal'
import { useAppStore } from '@/store/app-store'
import {
  Phone,
  Copy,
  Check,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Shield,
  Clock,
  ArrowLeft,
  Wallet,
  Trash2,
  Info,
  RefreshCw,
  Sparkles,
  PartyPopper,
} from 'lucide-react'

interface VcSettings {
  vodafoneCashNumber: string | null
  merchantNumber: string
  minAmountEGP: number
  creditsPerEgp: number
  isEnabled: boolean
}

export interface VodafoneCashModalProps {
  open: boolean
  onClose: () => void
}

export function VodafoneCashModal({ open, onClose }: VodafoneCashModalProps) {
  const { credits, setCredits } = useAppStore()

  const [settings, setSettings] = useState<VcSettings | null>(null)
  const [loading, setLoading] = useState(true)

  // Phone registration
  const [phone, setPhone] = useState('')
  const [savingPhone, setSavingPhone] = useState(false)
  const [registered, setRegistered] = useState(false)

  // View state: 'register' | 'deposit' | 'success'
  const [view, setView] = useState<'register' | 'deposit' | 'success'>('register')

  // Refreshing credits
  const [refreshing, setRefreshing] = useState(false)

  // Success state
  const [addedCredits, setAddedCredits] = useState(0)

  // Track previous paid credits to detect changes
  const prevPaidCreditsRef = useRef<number>(0)
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Start polling when modal opens on deposit view
  const startPolling = useCallback(() => {
    // Store current paidCredits as baseline
    prevPaidCreditsRef.current = credits?.paidCredits ?? 0

    // Clear any existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
    }

    // Poll every 5 seconds
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/user/credits')
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.data) {
            const newPaidCredits = data.data.paidCredits

            // Check if credits increased (payment detected!)
            if (newPaidCredits > prevPaidCreditsRef.current) {
              const diff = newPaidCredits - prevPaidCreditsRef.current
              setAddedCredits(diff)
              setCredits(data.data)
              prevPaidCreditsRef.current = newPaidCredits

              // Stop polling
              if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current)
                pollingIntervalRef.current = null
              }

              // Show success view
              setView('success')
            }
          }
        }
      } catch {
        // Silent poll failure
      }
    }, 5000)
  }, [credits?.paidCredits, setCredits])

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
  }, [])

  useEffect(() => {
    if (open) {
      fetchSettings()
      setView('register')
      setAddedCredits(0)
    } else {
      stopPolling()
    }

    return () => stopPolling()
  }, [open, stopPolling])

  // Start polling when view changes to deposit
  useEffect(() => {
    if (view === 'deposit' && open && registered) {
      startPolling()
    } else if (view === 'success') {
      stopPolling()
    }
  }, [view, open, registered, startPolling, stopPolling])

  const fetchSettings = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/user/vodafone-cash')
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.data) {
          setSettings(data.data)
          setRegistered(!!data.data.vodafoneCashNumber)
          if (data.data.vodafoneCashNumber) {
            setPhone(data.data.vodafoneCashNumber)
            setView('deposit')
          }
        }
      }
    } catch {
      toast.error('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const handleSavePhone = async () => {
    if (!phone.trim()) return

    setSavingPhone(true)
    try {
      const res = await fetch('/api/user/vodafone-cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() }),
      })

      const data = await res.json()
      if (data.success) {
        toast.success('Phone number saved!', {
          description: 'You can now deposit using Vodafone Cash.',
        })
        setRegistered(true)
        setView('deposit')
        setSettings((prev) => prev ? { ...prev, vodafoneCashNumber: phone.trim() } : prev)
      } else {
        toast.error(data.error || 'Failed to save phone number')
      }
    } catch {
      toast.error('Failed to save phone number')
    } finally {
      setSavingPhone(false)
    }
  }

  const handleRemovePhone = async () => {
    try {
      const res = await fetch('/api/user/vodafone-cash', { method: 'DELETE' })
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          toast.success('Phone number removed')
          setRegistered(false)
          setPhone('')
          setView('register')
          setSettings((prev) => prev ? { ...prev, vodafoneCashNumber: null } : prev)
        }
      }
    } catch {
      toast.error('Failed to remove phone number')
    }
  }

  const handleRefreshCredits = async () => {
    setRefreshing(true)
    try {
      const res = await fetch('/api/user/credits')
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.data) {
          setCredits(data.data)
          toast.success('Credits updated!')
        }
      }
    } catch {
      // silent
    } finally {
      setRefreshing(false)
    }
  }

  const handlePhoneChange = (value: string) => {
    // Only allow digits, max 11 chars, must start with 01
    const cleaned = value.replace(/\D/g, '')
    if (cleaned.length <= 11) {
      setPhone(cleaned)
    }
  }

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
        <DialogContent className="sm:max-w-md p-0 bg-background/95 backdrop-blur-xl border-white/10">
          <VisuallyHidden><DialogTitle>Vodafone Cash</DialogTitle></VisuallyHidden>
          <div className="p-6 space-y-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (!settings?.isEnabled) {
    return (
      <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
        <DialogContent className="sm:max-w-md p-0 bg-background/95 backdrop-blur-xl border-white/10">
          <VisuallyHidden><DialogTitle>Vodafone Cash Unavailable</DialogTitle></VisuallyHidden>
          <div className="p-6 text-center">
            <AlertCircle className="size-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Vodafone Cash Unavailable</h3>
            <p className="text-sm text-muted-foreground">
              Vodafone Cash payment is currently unavailable. Please try again later or use another payment method.
            </p>
            <Button className="mt-4" onClick={onClose} variant="outline">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md p-0 bg-background/95 backdrop-blur-xl border-white/10">
        <div className="p-5 sm:p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="size-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                <Wallet className="size-4 text-red-400" />
              </div>
              Vodafone Cash
            </DialogTitle>
          </DialogHeader>

          <AnimatePresence mode="wait">
            {/* ─── REGISTER PHONE VIEW ─── */}
            {view === 'register' && (
              <motion.div
                key="register"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                <div className="glass-card p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="size-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Info className="size-4 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-1">Link Your Vodafone Cash Number</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Before depositing, you must register your Vodafone Cash phone number.
                        When you transfer money, the system will automatically match your number
                        and add credits to your account.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Your Vodafone Cash Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      type="tel"
                      placeholder="01012345678"
                      value={phone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      className="pl-10 text-left dir-ltr font-mono"
                      dir="ltr"
                      maxLength={11}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Enter the 11-digit Egyptian number you use for Vodafone Cash
                  </p>
                </div>

                <Button
                  className="w-full bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-semibold h-11"
                  disabled={phone.length !== 11 || !/^01[0-9]{9}$/.test(phone) || savingPhone}
                  onClick={handleSavePhone}
                >
                  {savingPhone ? (
                    <>
                      <Loader2 className="size-4 animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="size-4 mr-2" />
                      Save Number
                    </>
                  )}
                </Button>
              </motion.div>
            )}

            {/* ─── DEPOSIT VIEW ─── */}
            {view === 'deposit' && (
              <motion.div
                key="deposit"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                {/* Registered number badge */}
                <div className="flex items-center justify-between glass-card p-3">
                  <div className="flex items-center gap-2">
                    <div className="size-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
                      <CheckCircle2 className="size-3.5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Your Number</p>
                      <p className="text-sm font-mono font-medium" dir="ltr">{phone}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleRemovePhone}
                    className="size-7 rounded-full flex items-center justify-center hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                    title="Remove number"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>

                {/* Transfer instructions */}
                <div className="glass-card p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Wallet className="size-4 text-red-400" />
                    <span className="text-sm font-semibold">Send Money To</span>
                  </div>

                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <p className="text-xs text-muted-foreground mb-1">Merchant Vodafone Cash Number</p>
                    <div className="flex items-center justify-between">
                      <p className="text-xl font-bold font-mono tracking-wide" dir="ltr">
                        {settings.merchantNumber}
                      </p>
                      <CopyButton text={settings.merchantNumber} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">How to deposit:</p>
                    <ol className="space-y-1.5">
                      {[
                        'Open Vodafone Cash app on your phone',
                        'Tap "Send Money" (إرسال أموال)',
                        `Enter the merchant number: ${settings.merchantNumber}`,
                        `Enter the amount (minimum ${settings.minAmountEGP} EGP)`,
                        'Confirm the transfer',
                        'Credits will be added automatically within seconds',
                      ].map((step, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <span className="size-5 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>

                {/* Exchange info */}
                <div className="glass-card p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Rate</span>
                    <span className="text-sm font-medium text-emerald-400">
                      {settings.creditsPerEgp} credit per 1 EGP
                    </span>
                  </div>
                  <Separator className="bg-white/5" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Minimum</span>
                    <span className="text-sm font-medium">
                      {settings.minAmountEGP} EGP ({settings.minAmountEGP * settings.creditsPerEgp} credits)
                    </span>
                  </div>
                </div>

                {/* Auto-match notice with live status */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                  <div className="relative">
                    <Shield className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="absolute -top-1 -right-1 size-2 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-emerald-400 mb-0.5">Automatic Detection Active</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Waiting for your transfer... Credits will appear here automatically.
                      Keep this window open after sending.
                    </p>
                  </div>
                </div>

                {/* Refresh credits */}
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={handleRefreshCredits}
                  disabled={refreshing}
                >
                  <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
                  {refreshing ? 'Checking...' : 'Refresh Credits'}
                </Button>
              </motion.div>
            )}

            {/* ─── SUCCESS VIEW ─── */}
            {view === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="space-y-5 py-2"
              >
                {/* Animated checkmark circle */}
                <div className="flex flex-col items-center justify-center space-y-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 15 }}
                    className="relative"
                  >
                    {/* Outer glow ring */}
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1.3, opacity: 0 }}
                      transition={{ delay: 0.3, duration: 1.5, repeat: 2 }}
                      className="absolute inset-0 rounded-full bg-emerald-500/20"
                      style={{ margin: '-8px' }}
                    />
                    {/* Main circle */}
                    <div className="relative size-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                      <motion.div
                        initial={{ scale: 0, rotate: -45 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ delay: 0.4, type: 'spring', stiffness: 300, damping: 12 }}
                      >
                        <svg
                          className="size-10 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <motion.path
                            d="M5 13l4 4L19 7"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ delay: 0.5, duration: 0.5, ease: 'easeOut' }}
                          />
                        </svg>
                      </motion.div>
                    </div>
                  </motion.div>

                  {/* Success text */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="text-center space-y-2"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <PartyPopper className="size-5 text-amber-400" />
                      <h3 className="text-xl font-bold text-emerald-400">Payment Successful!</h3>
                      <PartyPopper className="size-5 text-amber-400" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Your transfer has been confirmed and credits have been added.
                    </p>
                  </motion.div>

                  {/* Credits badge */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                    className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 w-full"
                  >
                    <div className="flex items-center justify-center gap-3">
                      <Sparkles className="size-5 text-emerald-400" />
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-0.5">Credits Added</p>
                        <p className="text-2xl font-bold text-emerald-400">
                          +{addedCredits}
                        </p>
                      </div>
                      <Sparkles className="size-5 text-emerald-400" />
                    </div>
                    <div className="mt-3 pt-3 border-t border-emerald-500/10 flex items-center justify-center gap-2">
                      <Wallet className="size-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        New Balance: <span className="font-semibold text-foreground">{credits?.totalCredits ?? 0} credits</span>
                      </span>
                    </div>
                  </motion.div>
                </div>

                {/* Action buttons */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.0 }}
                  className="space-y-2"
                >
                  <Button
                    className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold h-11"
                    onClick={onClose}
                  >
                    Start Creating
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => {
                      setAddedCredits(0)
                      prevPaidCreditsRef.current = credits?.paidCredits ?? 0
                      setView('deposit')
                    }}
                  >
                    <ArrowLeft className="size-4" />
                    Deposit More
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
