import { create } from 'zustand'

interface User {
  id: string
  email: string
  name: string
  avatar: string | null
  role: string
}

interface Credits {
  dailyCredits: number
  paidCredits: number
  totalCredits: number
}

interface AppState {
  currentView: 'landing' | 'generate' | 'history' | 'admin'
  adminTab: 'general' | 'users' | 'models' | 'api-keys' | 'plans' | 'google-auth' | 'crypto' | 'ads' | 'social' | 'vodafone-cash'
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  credits: Credits | null
  settings: Record<string, string> | null

  setView: (view: AppState['currentView']) => void
  setAdminTab: (tab: AppState['adminTab']) => void
  setUser: (user: User | null) => void
  setCredits: (credits: Credits | null) => void
  setSettings: (settings: Record<string, string> | null) => void
  logout: () => void
  initialize: () => Promise<void>
}

export const useAppStore = create<AppState>((set, get) => ({
  currentView: 'landing',
  adminTab: 'general',
  user: null,
  isAuthenticated: false,
  isLoading: true,
  credits: null,
  settings: null,

  setView: (view) => set({ currentView: view }),
  setAdminTab: (tab) => set({ adminTab: tab }),
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setCredits: (credits) => set({ credits }),
  setSettings: (settings) => set({ settings }),

  logout: () => {
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    set({ user: null, isAuthenticated: false, credits: null, currentView: 'landing' })
  },

  initialize: async () => {
    set({ isLoading: true })

    try {
      const [userRes, settingsRes] = await Promise.allSettled([
        fetch('/api/auth/me'),
        fetch('/api/public/settings'),
      ])

      // Handle user auth
      if (userRes.status === 'fulfilled' && userRes.value.ok) {
        const userData = await userRes.value.json()
        if (userData.success && userData.data) {
          set({ user: userData.data, isAuthenticated: true })

          // Fetch credits only if authenticated
          try {
            const creditsRes = await fetch('/api/user/credits')
            if (creditsRes.ok) {
              const creditsData = await creditsRes.json()
              if (creditsData.success && creditsData.data) {
                set({ credits: creditsData.data })
              }
            }
          } catch {
            // Credits fetch failed silently
          }
        }
      }

      // Handle settings
      if (settingsRes.status === 'fulfilled' && settingsRes.value.ok) {
        const settingsData = await settingsRes.value.json()
        if (settingsData.success && settingsData.data) {
          set({ settings: settingsData.data })
        }
      }
    } catch {
      // Initialization failed silently
    } finally {
      const { isAuthenticated } = get()
      set({ isLoading: false, currentView: isAuthenticated ? 'generate' : 'landing' })
    }
  },
}))
