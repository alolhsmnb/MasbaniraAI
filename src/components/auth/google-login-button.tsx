'use client'

import { Button } from '@/components/ui/button'

export function GoogleLoginButton({ className = '' }: { className?: string }) {
  const handleLogin = () => {
    // Browser always knows the real domain - use window.location.origin
    const origin = window.location.origin
    const redirectUri = `${origin}/api/auth/google/callback`
    // Save the current page URL so we can redirect back after login
    const returnTo = window.location.pathname + window.location.search + window.location.hash
    
    // Fetch client_id, then build Google URL in browser
    fetch('/api/auth/google/config')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.clientId) {
          const params = new URLSearchParams({
            response_type: 'code',
            client_id: data.clientId,
            redirect_uri: redirectUri,
            scope: 'openid email profile',
            access_type: 'offline',
            prompt: 'consent',
            state: origin + '|' + returnTo, // Pass origin and return URL
          })
          window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
        }
      })
      .catch(err => console.error('Google OAuth error:', err))
  }

  return (
    <Button
      variant="outline"
      size="lg"
      onClick={handleLogin}
      className={`gap-3 bg-transparent text-white border-gray-400 hover:bg-white/10 hover:text-white font-medium h-11 px-6 ${className}`}
    >
      <svg className="size-5" viewBox="0 0 24 24">
        <path
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
          fill="#4285F4"
        />
        <path
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          fill="#34A853"
        />
        <path
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          fill="#FBBC05"
        />
        <path
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          fill="#EA4335"
        />
      </svg>
      Sign in with Google
    </Button>
  )
}
