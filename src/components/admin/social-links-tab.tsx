'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Trash2, Edit3, Save, X, Loader2, Mail, Eye, EyeOff, Globe, GripVertical } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface SocialLink {
  id: string
  platform: string
  url: string
  label: string
  isVisible: boolean
  sortOrder: number
}

const PLATFORMS = [
  { value: 'facebook', label: 'Facebook', icon: 'fb' },
  { value: 'twitter', label: 'Twitter / X', icon: 'X' },
  { value: 'instagram', label: 'Instagram', icon: 'IG' },
  { value: 'youtube', label: 'YouTube', icon: 'YT' },
  { value: 'telegram', label: 'Telegram', icon: 'TG' },
  { value: 'whatsapp', label: 'WhatsApp', icon: 'WA' },
  { value: 'tiktok', label: 'TikTok', icon: 'TT' },
  { value: 'discord', label: 'Discord', icon: 'DC' },
  { value: 'reddit', label: 'Reddit', icon: 'RD' },
  { value: 'linkedin', label: 'LinkedIn', icon: 'LI' },
  { value: 'github', label: 'GitHub', icon: 'GH' },
  { value: 'snapchat', label: 'Snapchat', icon: 'SC' },
  { value: 'pinterest', label: 'Pinterest', icon: 'PI' },
  { value: 'twitch', label: 'Twitch', icon: 'TW' },
  { value: 'x', label: 'X (Twitter)', icon: 'X' },
  { value: 'threads', label: 'Threads', icon: 'TH' },
  { value: 'custom', label: 'Custom Link', icon: '🔗' },
]

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

export function SocialLinksTab() {
  const [links, setLinks] = useState<SocialLink[]>([])
  const [supportEmail, setSupportEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Edit mode
  const [editingLink, setEditingLink] = useState<SocialLink | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [editForm, setEditForm] = useState({ platform: 'facebook', url: '', label: '' })
  const [editVisible, setEditVisible] = useState(true)

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings')
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.data) {
          try {
            const parsed = JSON.parse(data.data.social_links || '[]')
            setLinks(parsed)
          } catch {
            setLinks([])
          }
          setSupportEmail(data.data.support_email || '')
        }
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const settingsToSave = {
        social_links: JSON.stringify(links),
        support_email: supportEmail,
      }

      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: settingsToSave }),
      })
      const data = await res.json()
      if (data.success) {
        // Update Zustand store
        const current = useAppStore.getState().settings || {}
        useAppStore.getState().setSettings({
          ...current,
          social_links: JSON.stringify(links),
          support_email: supportEmail,
        })
        toast.success('Social links saved successfully')
      } else {
        toast.error(data.error || 'Failed to save')
      }
    } catch {
      toast.error('Failed to save social links')
    } finally {
      setSaving(false)
    }
  }

  const openAdd = () => {
    setEditingLink(null)
    setIsAdding(true)
    setEditForm({ platform: 'facebook', url: '', label: '' })
    setEditVisible(true)
  }

  const openEdit = (link: SocialLink) => {
    setEditingLink(link)
    setIsAdding(false)
    setEditForm({ platform: link.platform, url: link.url, label: link.label })
    setEditVisible(link.isVisible)
  }

  const cancelEdit = () => {
    setEditingLink(null)
    setIsAdding(false)
    setEditForm({ platform: 'facebook', url: '', label: '' })
    setEditVisible(true)
  }

  const saveLink = () => {
    if (!editForm.url.trim()) {
      toast.error('URL is required')
      return
    }

    const platformInfo = PLATFORMS.find(p => p.value === editForm.platform)
    const label = editForm.label.trim() || platformInfo?.label || editForm.platform

    if (isAdding) {
      const newLink: SocialLink = {
        id: generateId(),
        platform: editForm.platform,
        url: editForm.url.trim(),
        label,
        isVisible: editVisible,
        sortOrder: links.length,
      }
      setLinks(prev => [...prev, newLink])
      toast.success(`${label} link added`)
    } else if (editingLink) {
      setLinks(prev => prev.map(l =>
        l.id === editingLink.id
          ? { ...l, platform: editForm.platform, url: editForm.url.trim(), label, isVisible: editVisible }
          : l
      ))
      toast.success(`${label} link updated`)
    }
    cancelEdit()
  }

  const deleteLink = (id: string, label: string) => {
    if (!confirm(`Delete "${label}" link?`)) return
    setLinks(prev => prev.filter(l => l.id !== id))
    toast.success(`${label} link deleted`)
  }

  const toggleVisibility = (id: string) => {
    setLinks(prev => prev.map(l =>
      l.id === id ? { ...l, isVisible: !l.isVisible } : l
    ))
  }

  const moveLink = (index: number, direction: 'up' | 'down') => {
    const newLinks = [...links]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= newLinks.length) return
    ;[newLinks[index], newLinks[targetIndex]] = [newLinks[targetIndex], newLinks[index]]
    newLinks.forEach((l, i) => l.sortOrder = i)
    setLinks(newLinks)
  }

  const getPlatformIcon = (platform: string) => {
    const p = PLATFORMS.find(pl => pl.value === platform)
    return p?.icon || '🔗'
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Support Email */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="size-4 text-emerald-400" />
            Support Email
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Input
              type="email"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              placeholder="support@example.com"
            />
            <p className="text-xs text-muted-foreground">
              This email will be displayed in the footer as the contact/support email.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Social Links */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="size-4 text-emerald-400" />
              Social Media Links
              <Badge variant="secondary" className="text-xs">{links.length}</Badge>
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={openAdd}
              disabled={isAdding}
            >
              <Plus className="size-3.5" />
              Add Link
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add/Edit Form */}
          {(isAdding || editingLink) && (
            <div className="border border-white/10 rounded-xl p-4 space-y-3 bg-white/[0.02]">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">
                  {isAdding ? 'Add New Link' : `Edit: ${editingLink?.label}`}
                </h4>
                <button onClick={cancelEdit} className="p-1 rounded hover:bg-white/5">
                  <X className="size-4 text-muted-foreground" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Platform</Label>
                  <Select value={editForm.platform} onValueChange={(v) => setEditForm({ ...editForm, platform: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PLATFORMS.map(p => (
                        <SelectItem key={p.value} value={p.value}>
                          <span className="flex items-center gap-2">
                            <span className="inline-flex items-center justify-center size-5 rounded bg-white/10 text-[10px] font-bold">{p.icon}</span>
                            {p.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Label (optional)</Label>
                  <Input
                    value={editForm.label}
                    onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                    placeholder={PLATFORMS.find(p => p.value === editForm.platform)?.label || 'Display name'}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">URL</Label>
                <Input
                  value={editForm.url}
                  onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs">Visible</Label>
                <Switch checked={editVisible} onCheckedChange={setEditVisible} />
              </div>

              <div className="flex gap-2">
                <Button onClick={saveLink} size="sm" className="gap-1.5 flex-1">
                  <Save className="size-3.5" />
                  {isAdding ? 'Add Link' : 'Update Link'}
                </Button>
                <Button variant="outline" size="sm" onClick={cancelEdit}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Links List */}
          {links.length === 0 && !isAdding ? (
            <div className="py-8 text-center">
              <Globe className="size-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No social links added yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Add your social media profiles to display in the footer
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {links.map((link, index) => (
                <div
                  key={link.id}
                  className={`flex items-center justify-between bg-white/[0.03] rounded-lg p-3 gap-3 group transition-all ${
                    !link.isVisible ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => moveLink(index, 'up')}
                        disabled={index === 0}
                        className="text-muted-foreground/30 hover:text-muted-foreground disabled:opacity-20 p-0"
                      >
                        <GripVertical className="size-3 rotate-180" />
                      </button>
                      <button
                        onClick={() => moveLink(index, 'down')}
                        disabled={index === links.length - 1}
                        className="text-muted-foreground/30 hover:text-muted-foreground disabled:opacity-20 p-0"
                      >
                        <GripVertical className="size-3" />
                      </button>
                    </div>
                    <div className="size-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0 text-xs font-bold">
                      {getPlatformIcon(link.platform)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{link.label}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{link.platform}</Badge>
                        {!link.isVisible && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Hidden</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{link.url}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => toggleVisibility(link.id)} className="p-1.5 rounded hover:bg-white/5" title={link.isVisible ? 'Hide' : 'Show'}>
                      {link.isVisible
                        ? <Eye className="size-3.5 text-emerald-400" />
                        : <EyeOff className="size-3.5 text-muted-foreground" />
                      }
                    </button>
                    <button onClick={() => openEdit(link)} className="p-1.5 rounded hover:bg-white/5">
                      <Edit3 className="size-3.5 text-blue-400" />
                    </button>
                    <button onClick={() => deleteLink(link.id, link.label)} className="p-1.5 rounded hover:bg-destructive/10">
                      <Trash2 className="size-3.5 text-destructive" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <Button
        onClick={handleSave}
        disabled={saving}
        className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 gap-2"
      >
        {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        Save All Settings
      </Button>
    </div>
  )
}

// Need to import useAppStore
import { useAppStore } from '@/store/app-store'
