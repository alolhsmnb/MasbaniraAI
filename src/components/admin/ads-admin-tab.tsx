'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Trash2, Edit3, Upload, FileCheck, X, Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from 'sonner'

interface AdSlot {
  id: string
  name: string
  provider: string
  adCode: string
  position: string
  isActive: boolean
  sortOrder: number
  createdAt: string
}

export function AdsAdminTab() {
  const [ads, setAds] = useState<AdSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAd, setEditingAd] = useState<AdSlot | null>(null)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [verifyFiles, setVerifyFiles] = useState<string[]>([])

  // Form state
  const [formName, setFormName] = useState('')
  const [formProvider, setFormProvider] = useState('custom')
  const [formCode, setFormCode] = useState('')
  const [formPosition, setFormPosition] = useState('landing')
  const [formActive, setFormActive] = useState(true)
  const [saving, setSaving] = useState(false)

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadName, setUploadName] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchAds = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ads')
      const data = await res.json()
      if (data.success) setAds(data.data)
    } catch {
      toast.error('Failed to load ads')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchVerifyFiles = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ads/verify-file')
      const data = await res.json()
      if (data.success) setVerifyFiles(data.data)
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    fetchAds()
    fetchVerifyFiles()
  }, [fetchAds, fetchVerifyFiles])

  // Fetch verify files when upload dialog opens
  useEffect(() => {
    if (uploadDialogOpen) {
      fetchVerifyFiles()
    }
  }, [uploadDialogOpen, fetchVerifyFiles])

  const resetForm = () => {
    setFormName('')
    setFormProvider('custom')
    setFormCode('')
    setFormPosition('landing')
    setFormActive(true)
    setEditingAd(null)
  }

  const openCreate = () => {
    resetForm()
    setDialogOpen(true)
  }

  const openEdit = (ad: AdSlot) => {
    setEditingAd(ad)
    setFormName(ad.name)
    setFormProvider(ad.provider)
    setFormCode(ad.adCode)
    setFormPosition(ad.position)
    setFormActive(ad.isActive)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formName.trim() || !formCode.trim()) {
      toast.error('Name and ad code are required')
      return
    }

    setSaving(true)
    try {
      const url = editingAd ? '/api/admin/ads' : '/api/admin/ads'
      const method = editingAd ? 'PUT' : 'POST'
      const body = {
        ...(editingAd && { id: editingAd.id }),
        name: formName,
        provider: formProvider,
        adCode: formCode,
        position: formPosition,
        isActive: formActive,
        sortOrder: 0,
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (data.success) {
        toast.success(editingAd ? 'Ad updated' : 'Ad created')
        setDialogOpen(false)
        resetForm()
        fetchAds()
      } else {
        toast.error(data.error || 'Failed to save')
      }
    } catch {
      toast.error('Failed to save ad')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return
    try {
      const res = await fetch(`/api/admin/ads/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        toast.success('Ad deleted')
        fetchAds()
      } else {
        toast.error(data.error || 'Failed to delete')
      }
    } catch {
      toast.error('Failed to delete ad')
    }
  }

  const handleToggle = async (ad: AdSlot) => {
    try {
      const res = await fetch('/api/admin/ads', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ad.id, isActive: !ad.isActive }),
      })
      const data = await res.json()
      if (data.success) fetchAds()
    } catch {
      toast.error('Failed to toggle ad')
    }
  }

  const handleUpload = async () => {
    if (!uploadFile) {
      toast.error('Please select a file first')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', uploadFile)
      if (uploadName.trim()) formData.append('fileName', uploadName.trim())

      const res = await fetch('/api/admin/ads/verify-file', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Upload failed' }))
        toast.error(data.error || `Server error (${res.status})`)
        return
      }

      const data = await res.json()
      if (data.success) {
        toast.success(`File "${data.data.fileName}" uploaded successfully!`)
        setUploadFile(null)
        setUploadName('')
        if (fileInputRef.current) fileInputRef.current.value = ''
        await fetchVerifyFiles()
      } else {
        toast.error(data.error || 'Upload failed')
      }
    } catch (err) {
      console.error('Upload error:', err)
      toast.error('Network error - Failed to upload file')
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteFile = async (fileName: string) => {
    if (!confirm(`Delete "${fileName}"?`)) return
    try {
      const res = await fetch(`/api/admin/ads/verify-file?file=${encodeURIComponent(fileName)}`, { method: 'GET' })
      const data = await res.json()
      if (data.success) {
        toast.success('File deleted')
        setVerifyFiles((prev) => prev.filter((f) => f !== fileName))
      }
    } catch {
      toast.error('Failed to delete file')
    }
  }

  const landingAds = ads.filter((a) => a.position === 'landing')
  const generateAds = ads.filter((a) => a.position === 'generate')

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass-card p-6 animate-pulse">
            <div className="h-6 bg-white/5 rounded w-48 mb-4" />
            <div className="h-20 bg-white/5 rounded" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Ad Management</h2>
          <p className="text-sm text-muted-foreground">Manage ad placements and verification files</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <FileCheck className="size-3.5" />
                Verify File
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Verification File</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>File</Label>
                  <div className="relative">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".html,.txt,.xml,.json"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null
                        setUploadFile(file)
                        if (file && !uploadName.trim()) {
                          setUploadName(file.name)
                        }
                      }}
                      className="w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer file:inline-flex file:h-9 file:items-center file:gap-1.5 border border-input rounded-md bg-background cursor-pointer"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Supported: .html, .txt, .xml, .json (max 100KB)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Custom File Name (optional)</Label>
                  <Input
                    placeholder="e.g. ads.txt"
                    value={uploadName}
                    onChange={(e) => setUploadName(e.target.value)}
                  />
                </div>

                {verifyFiles.length > 0 && (
                  <div className="space-y-2">
                    <Label>Existing Files</Label>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                      {verifyFiles.map((f) => (
                        <div key={f} className="flex items-center justify-between bg-muted/50 rounded px-3 py-1.5 text-sm">
                          <span className="text-muted-foreground font-mono text-xs">/{f}</span>
                          <button onClick={() => handleDeleteFile(f)} className="text-destructive hover:text-destructive/80">
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Button onClick={handleUpload} disabled={!uploadFile || uploading} className="w-full gap-2">
                  {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                  {uploading ? 'Uploading...' : 'Upload File'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm() }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5" onClick={openCreate}>
                <Plus className="size-3.5" />
                Add Ad
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingAd ? 'Edit Ad' : 'Add New Ad'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Ad Name</Label>
                  <Input placeholder="e.g. Google AdSense - Banner" value={formName} onChange={(e) => setFormName(e.target.value)} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Provider</Label>
                    <Select value={formProvider} onValueChange={setFormProvider}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="google">Google AdSense</SelectItem>
                        <SelectItem value="propeller">PropellerAds</SelectItem>
                        <SelectItem value="popads">PopAds</SelectItem>
                        <SelectItem value="adsterra">Adsterra</SelectItem>
                        <SelectItem value="media.net">Media.net</SelectItem>
                        <SelectItem value="taboola">Taboola</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Position</Label>
                    <Select value={formPosition} onValueChange={setFormPosition}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="landing">Landing Page</SelectItem>
                        <SelectItem value="generate">Generate Page</SelectItem>
                        <SelectItem value="both">Both Pages</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Ad Code (HTML/Script)</Label>
                  <Textarea
                    placeholder='<script async src="..."></script>\n<ins class="..."></ins>'
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    className="min-h-[120px] font-mono text-xs resize-none overflow-y-auto"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Active</Label>
                  <Switch checked={formActive} onCheckedChange={setFormActive} />
                </div>

                <Button onClick={handleSave} disabled={saving || !formName.trim() || !formCode.trim()} className="w-full gap-2">
                  {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                  {editingAd ? 'Update Ad' : 'Create Ad'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Info Banner */}
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="py-3 px-4">
          <p className="text-sm text-amber-200/80">
            <strong>How ads work:</strong> Ads only show to users with <code className="bg-amber-500/10 px-1.5 py-0.5 rounded text-xs">paidCredits = 0</code>. 
            Multiple ads rotate every 5 seconds. Upload verification files (ads.txt, etc.) for ad company approval.
          </p>
        </CardContent>
      </Card>

      {/* Landing Page Ads */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            Landing Page Ads
            <Badge variant="secondary" className="text-xs">{landingAds.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {landingAds.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No landing page ads yet</p>
          ) : (
            <div className="space-y-2">
              {landingAds.map((ad) => (
                <div key={ad.id} className="flex items-center justify-between bg-white/[0.03] rounded-lg p-3 gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium truncate">{ad.name}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{ad.provider}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate font-mono">{ad.adCode.substring(0, 80)}...</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => handleToggle(ad)} className="p-1.5 rounded hover:bg-white/5">
                      {ad.isActive ? <Eye className="size-3.5 text-emerald-400" /> : <EyeOff className="size-3.5 text-muted-foreground" />}
                    </button>
                    <button onClick={() => openEdit(ad)} className="p-1.5 rounded hover:bg-white/5">
                      <Edit3 className="size-3.5 text-blue-400" />
                    </button>
                    <button onClick={() => handleDelete(ad.id, ad.name)} className="p-1.5 rounded hover:bg-white/5">
                      <Trash2 className="size-3.5 text-destructive" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generate Page Ads */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            Generate Page Ads
            <Badge variant="secondary" className="text-xs">{generateAds.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {generateAds.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No generate page ads yet</p>
          ) : (
            <div className="space-y-2">
              {generateAds.map((ad) => (
                <div key={ad.id} className="flex items-center justify-between bg-white/[0.03] rounded-lg p-3 gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium truncate">{ad.name}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{ad.provider}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate font-mono">{ad.adCode.substring(0, 80)}...</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => handleToggle(ad)} className="p-1.5 rounded hover:bg-white/5">
                      {ad.isActive ? <Eye className="size-3.5 text-emerald-400" /> : <EyeOff className="size-3.5 text-muted-foreground" />}
                    </button>
                    <button onClick={() => openEdit(ad)} className="p-1.5 rounded hover:bg-white/5">
                      <Edit3 className="size-3.5 text-blue-400" />
                    </button>
                    <button onClick={() => handleDelete(ad.id, ad.name)} className="p-1.5 rounded hover:bg-white/5">
                      <Trash2 className="size-3.5 text-destructive" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
