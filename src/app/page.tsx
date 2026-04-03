'use client'

import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAppStore } from '@/store/app-store'
import { Navbar } from '@/components/navbar'
import { LandingPage } from '@/components/landing-page'
import { GeneratePage } from '@/components/generate-page'
import { HistoryPage } from '@/components/history-page'
import { AdminDashboard } from '@/components/admin-dashboard'
import { Skeleton } from '@/components/ui/skeleton'

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

export default function Home() {
  const { currentView, isLoading, initialize } = useAppStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="h-16 glass-card border-t-0 rounded-t-none">
          <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Skeleton className="size-9 rounded-xl" />
              <Skeleton className="h-6 w-32" />
            </div>
            <Skeleton className="h-9 w-40" />
          </div>
        </div>
        <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
          <div className="space-y-6">
            <Skeleton className="h-12 w-64" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
              <div className="space-y-4">
                <Skeleton className="h-80 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            {currentView === 'landing' && <LandingPage />}
            {currentView === 'generate' && <GeneratePage />}
            {currentView === 'history' && <HistoryPage />}
            {currentView === 'admin' && <AdminDashboard />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
