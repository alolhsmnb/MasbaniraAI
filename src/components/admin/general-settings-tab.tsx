'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '@/store/app-store'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Save, Loader2, ImageIcon } from 'lucide-react'

export function GeneralSettingsTab() {
  const { settings } = useAppStore()
  const [form, setForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (settings) {
      setForm({
        site_name: settings.site_name || 'PixelForge AI',
        site_description: settings.site_description || '',
        daily_free_credits: settings.daily_free_credits || '10',
        cost_per_generation: settings.cost_per_generation || '1',
        logo_url: settings.logo_url || '',
        imgbb_api_key: settings.imgbb_api_key || '',
      })
      setLoading(false)
    } else {
      // Fetch settings
      const fetchSettings = async () => {
        try {
          const res = await fetch('/api/admin/settings')
          if (res.ok) {
            const data = await res.json()
            if (data.success && data.data) {
              setForm({
                site_name: data.data.site_name || 'PixelForge AI',
                site_description: data.data.site_description || '',
                daily_free_credits: data.data.daily_free_credits || '10',
                cost_per_generation: data.data.cost_per_generation || '1',
                logo_url: data.data.logo_url || '',
                imgbb_api_key: data.data.imgbb_api_key || '',
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
    }
  }, [settings])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: form }),
      })
      const data = await res.json()
      if (data.success) {
        // Update Zustand store so changes reflect immediately
        useAppStore.getState().setSettings(form)
        toast.success('Settings saved successfully')
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
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="space-y-2">
        <Label>Site Name</Label>
        <Input
          value={form.site_name || ''}
          onChange={(e) => setForm({ ...form, site_name: e.target.value })}
          placeholder="PixelForge AI"
        />
      </div>
      <div className="space-y-2">
        <Label>Site Description</Label>
        <Textarea
          value={form.site_description || ''}
          onChange={(e) => setForm({ ...form, site_description: e.target.value })}
          placeholder="Describe your platform..."
          rows={3}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Daily Free Credits</Label>
          <Input
            type="number"
            value={form.daily_free_credits || ''}
            onChange={(e) => setForm({ ...form, daily_free_credits: e.target.value })}
            placeholder="10"
          />
        </div>
        <div className="space-y-2">
          <Label>Cost per Generation</Label>
          <Input
            type="number"
            value={form.cost_per_generation || ''}
            onChange={(e) => setForm({ ...form, cost_per_generation: e.target.value })}
            placeholder="1"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Logo URL</Label>
        <Input
          value={form.logo_url || ''}
          onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
          placeholder="https://example.com/logo.png"
        />
        <p className="text-xs text-muted-foreground">URL to your site logo image</p>
        {form.logo_url && (
          <div className="mt-3">
            <p className="text-xs text-muted-foreground mb-2">Preview:</p>
            <img
              src={form.logo_url}
              alt="Logo preview"
              className="h-12 rounded-lg object-contain bg-white/5 p-2"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          </div>
        )}
      </div>
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <ImageIcon className="size-4" />
          ImgBB API Key
        </Label>
        <Input
          type="password"
          value={form.imgbb_api_key || ''}
          onChange={(e) => setForm({ ...form, imgbb_api_key: e.target.value })}
          placeholder="Enter your ImgBB API key..."
        />
        <p className="text-xs text-muted-foreground">
          Used for uploading reference images. Images auto-delete after 10 minutes to save storage.
          Get your key at{' '}
          <a href="https://api.imgbb.com/" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">
            api.imgbb.com
          </a>
        </p>
      </div>
      <Button
        onClick={handleSave}
        disabled={saving}
        className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 gap-2"
      >
        {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        Save Settings
      </Button>
    </div>
  )
}
