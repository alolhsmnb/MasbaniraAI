'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Save, Loader2, Eye, EyeOff, Shield } from 'lucide-react'

export function GoogleAuthTab() {
  const [form, setForm] = useState({
    google_client_id: '',
    google_client_secret: '',
    google_redirect_uri: '',
    google_authorized_origins: '',
  })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showSecret, setShowSecret] = useState(false)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/admin/settings')
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.data) {
            const s = data.data
            setForm({
              google_client_id: s.google_client_id || '',
              google_client_secret: s.google_client_secret || '',
              google_redirect_uri: s.google_redirect_uri || `${window.location.origin}/api/auth/google/callback`,
              google_authorized_origins: s.google_authorized_origins || window.location.origin,
            })
          }
        }
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    fetchSettings()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      // Don't save redirect_uri - it's auto-generated from the request
      const { google_redirect_uri, ...settingsToSave } = form

      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: settingsToSave }),
      })

      const data = await res.json()
      if (data.success) {
        toast.success('Google Auth settings saved')
      } else {
        toast.error(data.error || 'Failed to save settings')
      }
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="glass-card p-4 border-amber-500/20 bg-amber-500/5">
        <div className="flex items-start gap-3">
          <Shield className="size-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-amber-400 mb-1">Important</h4>
            <p className="text-xs text-muted-foreground">
              Configure these settings in the Google Cloud Console. Make sure to add the redirect
              URI to your OAuth 2.0 client settings.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Google Client ID</Label>
        <Input
          value={form.google_client_id}
          onChange={(e) => setForm({ ...form, google_client_id: e.target.value })}
          placeholder="xxxx.apps.googleusercontent.com"
        />
      </div>

      <div className="space-y-2">
        <Label>Google Client Secret</Label>
        <div className="relative">
          <Input
            type={showSecret ? 'text' : 'password'}
            value={form.google_client_secret}
            onChange={(e) => setForm({ ...form, google_client_secret: e.target.value })}
            placeholder="GOCSPX-xxxx"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 size-7"
            onClick={() => setShowSecret(!showSecret)}
          >
            {showSecret ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Redirect URI</Label>
        <Input
          value={form.google_redirect_uri}
          readOnly
          className="bg-white/5 cursor-not-allowed"
        />
        <p className="text-xs text-muted-foreground">
          This is auto-generated. Add this to your Google Cloud Console OAuth settings.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Authorized JavaScript Origins</Label>
        <Textarea
          value={form.google_authorized_origins}
          onChange={(e) =>
            setForm({ ...form, google_authorized_origins: e.target.value })
          }
          placeholder={window.location.origin}
          rows={3}
        />
        <p className="text-xs text-muted-foreground">
          One origin per line. Add your domain(s) here.
        </p>
      </div>

      <Button
        onClick={handleSave}
        disabled={saving}
        className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 gap-2"
      >
        {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        Save Google Auth Settings
      </Button>
    </div>
  )
}
