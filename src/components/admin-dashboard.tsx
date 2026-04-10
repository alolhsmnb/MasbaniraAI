'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/store/app-store'
import {
  Settings,
  Users,
  Box,
  Key,
  CreditCard,
  Shield,
  Wallet,
  Megaphone,
  Share2,
  Phone,
} from 'lucide-react'
import { GeneralSettingsTab } from '@/components/admin/general-settings-tab'
import { UsersTab } from '@/components/admin/users-tab'
import { ModelsTab } from '@/components/admin/models-tab'
import { ApiKeysTab } from '@/components/admin/api-keys-tab'
import { PlansTab } from '@/components/admin/plans-tab'
import { GoogleAuthTab } from '@/components/admin/google-auth-tab'
import { CryptoAdminTab } from '@/components/admin/crypto-admin-tab'
import { AdsAdminTab } from '@/components/admin/ads-admin-tab'
import { SocialLinksTab } from '@/components/admin/social-links-tab'
import { VodafoneCashAdminTab } from '@/components/admin/vodafone-cash-admin-tab'

// ============================================================
// Main Admin Dashboard
// ============================================================
const adminTabs = [
  { value: 'general', label: 'General', icon: Settings },
  { value: 'users', label: 'Users', icon: Users },
  { value: 'models', label: 'Models', icon: Box },
  { value: 'api-keys', label: 'API Keys', icon: Key },
  { value: 'plans', label: 'Plans', icon: CreditCard },
  { value: 'google-auth', label: 'Google Auth', icon: Shield },
  { value: 'crypto', label: 'Crypto Payments', icon: Wallet },
  { value: 'ads', label: 'Ads', icon: Megaphone },
  { value: 'social', label: 'Social Links', icon: Share2 },
  { value: 'vodafone-cash', label: 'Vodafone Cash', icon: Phone },
] as const

export function AdminDashboard() {
  const { adminTab, setAdminTab } = useAppStore()

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="size-6 text-emerald-400" />
            Admin Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your platform settings, users, models, and more
          </p>
        </div>

        {/* Tabs */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar tabs for desktop, horizontal for mobile */}
          <div className="lg:w-56 shrink-0">
            <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible scrollbar-thin pb-2 lg:pb-0">
              {adminTabs.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setAdminTab(tab.value as any)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors w-full text-left ${
                    adminTab === tab.value
                      ? 'bg-emerald-500/10 text-emerald-400 font-medium border border-emerald-500/20'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                  }`}
                >
                  <tab.icon className="size-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="glass-card p-4 sm:p-6 min-w-0 flex-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={adminTab}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                {adminTab === 'general' && <GeneralSettingsTab />}
                {adminTab === 'users' && <UsersTab />}
                {adminTab === 'models' && <ModelsTab />}
                {adminTab === 'api-keys' && <ApiKeysTab />}
                {adminTab === 'plans' && <PlansTab />}
                {adminTab === 'google-auth' && <GoogleAuthTab />}
                {adminTab === 'crypto' && <CryptoAdminTab />}
                {adminTab === 'ads' && <AdsAdminTab />}
                {adminTab === 'social' && <SocialLinksTab />}
                {adminTab === 'vodafone-cash' && <VodafoneCashAdminTab />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
