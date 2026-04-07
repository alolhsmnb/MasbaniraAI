'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useAppStore } from '@/store/app-store'
import { GoogleLoginButton } from '@/components/auth/google-login-button'
import { AdBanner } from '@/components/ad-banner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Palette,
  Zap,
  Monitor,
  Shield,
  Coins,
  Smartphone,
  ArrowRight,
  Star,
  Check,
  Sparkles,
  Mail,
  ExternalLink,
} from 'lucide-react'

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: 'easeOut' },
  }),
}

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}

interface Model {
  id: string
  modelId: string
  name: string
  type: string
  isActive: boolean
}

interface Plan {
  id: string
  name: string
  price: number
  credits: number
  features: string[]
  isActive: boolean
}

const features = [
  {
    icon: Palette,
    title: 'Multiple AI Models',
    description: 'Choose from various cutting-edge AI models for your creative needs',
  },
  {
    icon: Zap,
    title: 'Lightning Fast',
    description: 'Generate content in seconds, not minutes. No more waiting around',
  },
  {
    icon: Monitor,
    title: 'HD Quality',
    description: 'Support for 1K, 2K, and 4K resolution outputs',
  },
  {
    icon: Shield,
    title: 'Secure & Private',
    description: 'Your creations are safe and private. We respect your privacy',
  },
  {
    icon: Coins,
    title: 'Free Credits',
    description: 'Start creating with 10 free daily credits. No credit card needed',
  },
  {
    icon: Smartphone,
    title: 'Responsive Design',
    description: 'Create on any device, anywhere. Mobile, tablet, or desktop',
  },
]

export function LandingPage() {
  const { settings, credits, isAuthenticated } = useAppStore()
  const [models, setModels] = useState<Model[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)

  // Show ads only to non-authenticated users or users with 0 paid credits
  const showAds = !isAuthenticated || (credits?.paidCredits ?? 0) <= 0

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [modelsRes, plansRes] = await Promise.allSettled([
          fetch('/api/public/models'),
          fetch('/api/public/plans'),
        ])

        if (modelsRes.status === 'fulfilled' && modelsRes.value.ok) {
          const data = await modelsRes.value.json()
          if (data.success) setModels(data.data || [])
        }
        if (plansRes.status === 'fulfilled' && plansRes.value.ok) {
          const data = await plansRes.value.json()
          if (data.success) setPlans(data.data || [])
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const siteName = settings?.site_name || 'PixelForge AI'
  const siteDescription =
    settings?.site_description ||
    'Professional AI-powered platform for generating stunning images and videos with cutting-edge models.'

  // Parse social links and support email from settings
  const socialLinks = (() => {
    try {
      const raw = settings?.social_links
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })()
  const visibleLinks = Array.isArray(socialLinks) ? socialLinks.filter((l: any) => l.isVisible) : []
  const supportEmail = settings?.support_email || ''

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 sm:py-32 px-4">
        {/* Animated background gradient */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-48 sm:w-80 h-48 sm:h-80 bg-teal-500/10 rounded-full blur-3xl animate-pulse [animation-delay:1s]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 sm:w-[600px] h-72 sm:h-[600px] bg-emerald-500/5 rounded-full blur-3xl" />
        </div>

        <motion.div
          className="max-w-4xl mx-auto text-center"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >
          <motion.div variants={fadeIn} custom={0}>
            <Badge
              variant="outline"
              className="mb-6 border-emerald-500/30 bg-emerald-500/10 text-emerald-400 px-4 py-1.5 text-sm"
            >
              <Sparkles className="size-3.5 mr-1.5" />
              AI-Powered Creative Platform
            </Badge>
          </motion.div>

          <motion.h1
            className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6"
            variants={fadeIn}
            custom={1}
          >
            Create Stunning{' '}
            <span className="gradient-text">Images & Videos</span>{' '}
            with AI
          </motion.h1>

          <motion.p
            className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10"
            variants={fadeIn}
            custom={2}
          >
            {siteDescription}
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
            variants={fadeIn}
            custom={3}
          >
            <GoogleLoginButton />
            <Button
              variant="ghost"
              size="lg"
              className="text-muted-foreground gap-2"
              onClick={() => {
                document.getElementById('features-section')?.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              Learn more
              <ArrowRight className="size-4" />
            </Button>
          </motion.div>

          {/* Stats */}
          <motion.div
            className="grid grid-cols-3 gap-4 sm:gap-8 max-w-lg mx-auto mt-16"
            variants={fadeIn}
            custom={4}
          >
            {[
              { value: '10+', label: 'AI Models' },
              { value: '4K', label: 'Max Quality' },
              { value: 'Free', label: 'To Start' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl sm:text-3xl font-bold gradient-text">{stat.value}</div>
                <div className="text-xs sm:text-sm text-muted-foreground mt-1">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* Ad Banner - After Hero */}
      {showAds && (
        <div className="max-w-4xl mx-auto px-4 mb-4 overflow-hidden">
          <AdBanner position="landing" showAds={showAds} />
        </div>
      )}

      {/* Features Section */}
      <section id="features-section" className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <motion.div
            className="text-center mb-12"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={staggerContainer}
          >
            <motion.h2 className="text-3xl sm:text-4xl font-bold mb-4" variants={fadeIn} custom={0}>
              Why Choose <span className="gradient-text">{siteName}</span>
            </motion.h2>
            <motion.p className="text-muted-foreground text-lg max-w-2xl mx-auto" variants={fadeIn} custom={1}>
              Everything you need to create amazing AI-generated content
            </motion.p>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={staggerContainer}
          >
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                variants={fadeIn}
                custom={i}
                className="glass-card p-6 group hover:glow-md transition-all duration-300 cursor-default"
              >
                <div className="size-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4 group-hover:bg-emerald-500/20 transition-colors">
                  <feature.icon className="size-6 text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Models Section */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <motion.div
            className="text-center mb-12"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={staggerContainer}
          >
            <motion.h2 className="text-3xl sm:text-4xl font-bold mb-4" variants={fadeIn} custom={0}>
              Supported <span className="gradient-text">AI Models</span>
            </motion.h2>
            <motion.p className="text-muted-foreground text-lg" variants={fadeIn} custom={1}>
              Choose from a variety of powerful AI models
            </motion.p>
          </motion.div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 rounded-2xl" />
              ))}
            </div>
          ) : models.length > 0 ? (
            <motion.div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-100px' }}
              variants={staggerContainer}
            >
              {models
                .filter((m) => m.isActive)
                .map((model, i) => (
                  <motion.div
                    key={model.id}
                    variants={fadeIn}
                    custom={i}
                    className="glass-card p-6 hover:glow-sm transition-all duration-300"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <Badge variant="secondary" className="text-xs">
                        {model.type === 'IMAGE' ? 'Image' : 'Video'}
                      </Badge>
                      <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-xs">
                        Active
                      </Badge>
                    </div>
                    <h3 className="text-lg font-semibold mb-1">{model.name}</h3>
                    <p className="text-muted-foreground text-sm">Model ID: {model.modelId}</p>
                  </motion.div>
                ))}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="glass-card p-12 text-center max-w-md mx-auto"
            >
              <div className="size-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="size-8 text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Models Coming Soon</h3>
              <p className="text-muted-foreground text-sm">
                We&apos;re adding new AI models regularly. Sign up to be the first to know!
              </p>
            </motion.div>
          )}
        </div>
      </section>

      {/* Ad Banner - Before Pricing */}
      {showAds && (
        <div className="max-w-4xl mx-auto px-4 mb-4 overflow-hidden">
          <AdBanner position="landing" showAds={showAds} />
        </div>
      )}

      {/* Pricing Section */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div
            className="text-center mb-12"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={staggerContainer}
          >
            <motion.h2 className="text-3xl sm:text-4xl font-bold mb-4" variants={fadeIn} custom={0}>
              Choose Your <span className="gradient-text">Plan</span>
            </motion.h2>
            <motion.p className="text-muted-foreground text-lg" variants={fadeIn} custom={1}>
              Simple pricing. No hidden fees. Cancel anytime.
            </motion.p>
          </motion.div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-80 rounded-2xl" />
              ))}
            </div>
          ) : plans.length > 0 ? (
            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-100px' }}
              variants={staggerContainer}
            >
              {plans
                .filter((p) => p.isActive)
                .sort((a, b) => a.price - b.price)
                .map((plan, i) => {
                  const isRecommended = plan.price > 0 && i === plans.filter((p) => p.isActive).sort((a, b) => a.price - b.price).findIndex((p) => p.price > 0)
                  return (
                    <motion.div
                      key={plan.id}
                      variants={fadeIn}
                      custom={i}
                      className={`relative glass-card p-6 flex flex-col ${isRecommended ? 'glow-lg border-emerald-500/30' : ''}`}
                    >
                      {isRecommended && (
                        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0">
                          <Star className="size-3 mr-1" />
                          Recommended
                        </Badge>
                      )}
                      <div className="mb-6">
                        <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-bold gradient-text">
                            {plan.price === 0 ? 'Free' : `$${plan.price}`}
                          </span>
                          {plan.price > 0 && <span className="text-muted-foreground text-sm">/month</span>}
                        </div>
                      </div>
                      <div className="space-y-3 mb-8 flex-1">
                        <div className="text-sm text-emerald-400 font-medium">
                          {plan.credits} credits
                          {plan.price === 0 ? '/day' : ' per month'}
                        </div>
                        {(plan.features || []).map((feature, fi) => (
                          <div key={fi} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <Check className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                            <span>{feature}</span>
                          </div>
                        ))}
                      </div>
                      <Button
                        className={`w-full ${isRecommended ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600' : ''}`}
                        variant={isRecommended ? 'default' : 'outline'}
                        size="lg"
                        onClick={() => {
                          window.location.href = '/api/auth/google'
                        }}
                      >
                        {plan.price === 0 ? 'Get Started Free' : 'Get Started'}
                      </Button>
                    </motion.div>
                  )
                })}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto"
            >
              {/* Default Free Plan */}
              <div className="glass-card p-6 flex flex-col">
                <div className="mb-6">
                  <h3 className="text-xl font-bold mb-2">Free</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold gradient-text">$0</span>
                  </div>
                </div>
                <div className="space-y-3 mb-8 flex-1">
                  <div className="text-sm text-emerald-400 font-medium">10 credits/day</div>
                  {['Basic AI models', 'Standard quality', 'Community support'].map((f) => (
                    <div key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
                <GoogleLoginButton className="w-full" />
              </div>

              {/* Default Pro Plan */}
              <div className="relative glass-card p-6 flex flex-col glow-lg border-emerald-500/30">
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0">
                  <Star className="size-3 mr-1" />
                  Recommended
                </Badge>
                <div className="mb-6">
                  <h3 className="text-xl font-bold mb-2">Pro</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold gradient-text">$9.99</span>
                    <span className="text-muted-foreground text-sm">/month</span>
                  </div>
                </div>
                <div className="space-y-3 mb-8 flex-1">
                  <div className="text-sm text-emerald-400 font-medium">500 credits/month</div>
                  {[
                    'All AI models',
                    'Up to 4K quality',
                    'Priority processing',
                    'Priority support',
                    'Commercial license',
                  ].map((f) => (
                    <div key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
                <Button
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
                  size="lg"
                  onClick={() => {
                    window.location.href = '/api/auth/google'
                  }}
                >
                  Get Started
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto">
          <motion.div
            className="glass-card p-8 sm:p-12 text-center glow-md"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            <motion.h2 className="text-2xl sm:text-3xl font-bold mb-4" variants={fadeIn} custom={0}>
              Ready to Start <span className="gradient-text">Creating</span>?
            </motion.h2>
            <motion.p className="text-muted-foreground mb-8 max-w-lg mx-auto" variants={fadeIn} custom={1}>
              Join thousands of creators using {siteName} to bring their ideas to life. Get started for free today.
            </motion.p>
            <motion.div variants={fadeIn} custom={2}>
              <GoogleLoginButton />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-white/5 py-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-col items-center gap-6">
          {/* Top row: Logo + Copyright */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full">
            <div className="flex items-center gap-2">
              {settings?.logo_url ? (
                <img
                  src={settings.logo_url}
                  alt={siteName}
                  className="size-7 rounded-lg object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none'
                    ;(e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden')
                  }}
                />
              ) : null}
              <div className={settings?.logo_url ? 'hidden' : ''}>
                <div className="size-7 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                  <Zap className="size-4 text-white" />
                </div>
              </div>
              <span className="text-sm font-semibold gradient-text">{siteName}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} {siteName}. All rights reserved.
            </p>
          </div>

          {/* Social Links */}
          {visibleLinks.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap justify-center">
              {visibleLinks.map((link: any) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-white/5 border border-white/5 hover:border-white/10 transition-all"
                  title={link.label}
                >
                  {link.platform === 'facebook' && (
                    <svg className="size-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  )}
                  {link.platform === 'twitter' && (
                    <svg className="size-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  )}
                  {link.platform === 'x' && (
                    <svg className="size-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  )}
                  {link.platform === 'instagram' && (
                    <svg className="size-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                  )}
                  {link.platform === 'youtube' && (
                    <svg className="size-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                  )}
                  {link.platform === 'telegram' && (
                    <svg className="size-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                  )}
                  {link.platform === 'whatsapp' && (
                    <svg className="size-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  )}
                  {link.platform === 'tiktok' && (
                    <svg className="size-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
                  )}
                  {link.platform === 'discord' && (
                    <svg className="size-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
                  )}
                  {link.platform === 'reddit' && (
                    <svg className="size-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 01-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 01.042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 014.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 01.14-.197.35.35 0 01.238-.042l2.906.617a1.214 1.214 0 011.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 00-.231.094.33.33 0 000 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 000-.462.341.341 0 00-.462 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 00-.205-.095z"/></svg>
                  )}
                  {link.platform === 'linkedin' && (
                    <svg className="size-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                  )}
                  {link.platform === 'github' && (
                    <svg className="size-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
                  )}
                  {link.platform === 'snapchat' && (
                    <svg className="size-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.017 24c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641 0 12.017 0z"/></svg>
                  )}
                  {link.platform === 'pinterest' && (
                    <svg className="size-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.017 24c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641 0 12.017 0z"/></svg>
                  )}
                  {link.platform === 'twitch' && (
                    <svg className="size-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>
                  )}
                  {link.platform === 'threads' && (
                    <svg className="size-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.6-2.045 1.09-1.243 1.754-2.858 1.974-4.804h-6.52v-2.116h8.717l-.037.378c-.238 2.394-1.087 4.707-2.632 6.313C17.793 23.198 15.44 24 12.186 24z"/></svg>
                  )}
                  {link.platform === 'custom' && (
                    <ExternalLink className="size-3.5" />
                  )}
                  <span className="text-xs">{link.label}</span>
                </a>
              ))}
            </div>
          )}

          {/* Support Email */}
          {supportEmail && (
            <a
              href={`mailto:${supportEmail}`}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Mail className="size-3.5" />
              {supportEmail}
            </a>
          )}
        </div>
      </footer>
    </div>
  )
}
