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

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 sm:py-32 px-4">
        {/* Animated background gradient */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl animate-pulse [animation-delay:1s]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-3xl" />
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
        <div className="max-w-4xl mx-auto px-4 mb-4">
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
        <div className="max-w-4xl mx-auto px-4 mb-4">
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
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
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
      </footer>
    </div>
  )
}
