'use client'

import { useState } from 'react'
import { useAppStore } from '@/store/app-store'
import { GoogleLoginButton } from '@/components/auth/google-login-button'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Menu,
  Plus,
  Zap,
  Clock,
  Settings,
  LogOut,
  User,
  CreditCard,
  Sparkles,
} from 'lucide-react'
import { CryptoPaymentModal } from '@/components/crypto-payment-modal'

export function Navbar() {
  const { user, isAuthenticated, credits, settings, setView, setAdminTab, logout } = useAppStore()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const siteName = settings?.site_name || 'PixelForge AI'

  const isAdmin = user?.role === 'ADMIN'

  const navItems = [
    { label: 'Generate', icon: Sparkles, view: 'generate' as const, requiresAuth: true },
    { label: 'History', icon: Clock, view: 'history' as const, requiresAuth: true },
  ]

  const handleNavClick = (view: 'generate' | 'history' | 'admin') => {
    setView(view)
    setMobileOpen(false)
  }

  const handleLogout = () => {
    logout()
    setMobileOpen(false)
  }

  return (
    <nav className="sticky top-0 z-50 glass-card border-t-0 rounded-t-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Left: Logo */}
          <button
            onClick={() => handleNavClick(isAuthenticated ? 'generate' : 'landing')}
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
          >
            {settings?.logo_url ? (
              <img
                src={settings.logo_url}
                alt={siteName}
                className="size-9 rounded-xl object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none'
                  ;(e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden')
                }}
              />
            ) : null}
            <div className={settings?.logo_url ? 'hidden' : ''}>
              <div className="size-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Zap className="size-5 text-white" />
              </div>
            </div>
            <span className="text-lg font-bold gradient-text hidden sm:inline">
              {siteName}
            </span>
          </button>

          {/* Right: Desktop nav */}
          <div className="hidden md:flex items-center gap-2">
            {!isAuthenticated ? (
              <GoogleLoginButton />
            ) : (
              <>
                {navItems
                  .filter((item) => item.requiresAuth)
                  .map((item) => (
                    <Button
                      key={item.view}
                      variant="ghost"
                      size="sm"
                      onClick={() => handleNavClick(item.view)}
                      className="text-muted-foreground hover:text-foreground gap-2"
                    >
                      <item.icon className="size-4" />
                      {item.label}
                    </Button>
                  ))}

                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleNavClick('admin')}
                    className="text-emerald-400 hover:text-emerald-300 gap-2 font-medium"
                  >
                    <Settings className="size-4" />
                    Admin
                  </Button>
                )}

                {/* Credits badge */}
                {credits && (
                  <Badge
                    variant="outline"
                    className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 gap-1.5 px-3 py-1"
                  >
                    <CreditCard className="size-3" />
                    {credits.dailyCredits}+{credits.paidCredits} credits
                  </Badge>
                )}

                {/* Buy Credits button */}
                <Button
                  size="sm"
                  onClick={() => setPaymentOpen(true)}
                  className="gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
                >
                  <Plus className="size-3.5" />
                  <span className="hidden sm:inline">Buy Credits</span>
                </Button>

                {/* User avatar dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="focus:outline-none">
                      <Avatar className="size-8 border border-white/10 cursor-pointer hover:border-white/20 transition-colors">
                        <AvatarImage src={user?.avatar || undefined} alt={user?.name} />
                        <AvatarFallback className="bg-emerald-500/20 text-emerald-400 text-xs font-semibold">
                          {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="px-3 py-2">
                      <p className="text-sm font-medium">{user?.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="gap-2 cursor-pointer">
                      <User className="size-4" />
                      Profile
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleLogout}
                      className="gap-2 cursor-pointer text-red-400 focus:text-red-400"
                    >
                      <LogOut className="size-4" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>

          {/* Right: Mobile menu button */}
          <div className="md:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <SheetHeader>
                  <SheetTitle className="gradient-text">{siteName}</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-1 mt-4">
                  {!isAuthenticated ? (
                    <div className="flex flex-col gap-3 px-1">
                      <GoogleLoginButton className="w-full" />
                    </div>
                  ) : (
                    <>
                      {/* User info */}
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 mb-2">
                        <Avatar className="size-10 border border-white/10">
                          <AvatarImage src={user?.avatar || undefined} alt={user?.name} />
                          <AvatarFallback className="bg-emerald-500/20 text-emerald-400 font-semibold">
                            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{user?.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                        </div>
                      </div>

                      {credits && (
                        <div className="px-3 mb-2">
                          <Badge
                            variant="outline"
                            className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 gap-1.5 px-3 py-1 w-full justify-center"
                          >
                            <CreditCard className="size-3" />
                            {credits.dailyCredits}+{credits.paidCredits} credits
                          </Badge>
                        </div>
                      )}

                      {/* Buy Credits button */}
                      <Button
                        size="sm"
                        onClick={() => setPaymentOpen(true)}
                        className="w-full gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
                      >
                        <Plus className="size-4" />
                        Buy Credits
                      </Button>

                      <div className="h-px bg-white/10 my-1" />

                      {navItems
                        .filter((item) => item.requiresAuth)
                        .map((item) => (
                          <Button
                            key={item.view}
                            variant="ghost"
                            className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
                            onClick={() => handleNavClick(item.view)}
                          >
                            <item.icon className="size-4" />
                            {item.label}
                          </Button>
                        ))}

                      {isAdmin && (
                        <>
                          <div className="h-px bg-white/10 my-1" />
                          <Button
                            variant="ghost"
                            className="w-full justify-start gap-3 text-emerald-400 font-medium"
                            onClick={() => handleNavClick('admin')}
                          >
                            <Settings className="size-4" />
                            Admin Panel
                          </Button>
                        </>
                      )}

                      <div className="h-px bg-white/10 my-1" />
                      <Button
                        variant="ghost"
                        className="w-full justify-start gap-3 text-red-400 hover:text-red-300"
                        onClick={handleLogout}
                      >
                        <LogOut className="size-4" />
                        Logout
                      </Button>
                    </>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
      {/* Crypto Payment Modal */}
      <CryptoPaymentModal
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
      />
    </nav>
  )
}
