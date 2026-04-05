'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Trash2, Edit3, Upload, FileCheck, X, Eye, EyeOff, Loader2, FileText, Download, ExternalLink, FolderOpen } from 'lucide-react'
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

interface VerifyFile {
  fileName: string
  size: number
  modifiedAt: string
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(isoStr: string): string {
  if (!isoStr) return 'Unknown'
  try {
    const date = new Date(isoStr)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return 'Unknown'
  }
}

export function AdsAdminTab() {
  const [ads, setAds] = useState<AdSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAd, setEditingAd] = useState<AdSlot | null>(null)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [verifyFiles, setVerifyFiles] = useState<VerifyFile[]>([])

  // File view dialog
  const [viewFileOpen, setViewFileOpen] = useState(false)
  const [viewFileContent, setViewFileContent] = useState('')
  const [viewFileName, setViewFileName] = useState('')
  const [viewFileSize, setViewFileSize] = useState(0)
  const [viewLoading, setViewLoading] = useState(false)

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
      if (data.success) {
        setVerifyFiles(
          (data.data || []).map((f: string | { fileName: string; size: number; modifiedAt: string }) =>
            typeof f === 'string' ? { fileName: f, size: 0, modifiedAt: '' } : f
          )
        )
      }
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    fetchAds()
    fetchVerifyFiles()
  }, [fetchAds, fetchVerifyFiles])

  // Refresh verify files when dialogs open/close
  useEffect(() => {
    if (uploadDialogOpen) fetchVerifyFiles()
  }, [uploadDialogOpen, fetchVerifyFiles])

  useEffect(() => {
    if (!viewFileOpen) fetchVerifyFiles()
  }, [viewFileOpen, fetchVerifyFiles])

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

  const handleViewFile = async (fileName: string) => {
    setViewFileName(fileName)
    setViewLoading(true)
    setViewFileOpen(true)
    try {
      const res = await fetch(`/api/admin/ads/verify-file?file=${encodeURIComponent(fileName)}&action=view`)
      const data = await res.json()
      if (data.success) {
        setViewFileContent(data.data.content || '(Empty file)')
        setViewFileSize(data.data.size || 0)
      } else {
        setViewFileContent(`Error: ${data.error || 'Could not read file'}`)
      }
    } catch {
      setViewFileContent('Error: Network error')
    } finally {
      setViewLoading(false)
    }
  }

  const handleDeleteFile = async (fileName: string) => {
    if (!confirm(`Delete "${fileName}"?\n\nThis file will be permanently removed.`)) return
    try {
      const res = await fetch(`/api/admin/ads/verify-file?file=${encodeURIComponent(fileName)}&action=delete`, { method: 'GET' })
      const data = await res.json()
      if (data.success) {
        toast.success(`"${fileName}" deleted successfully`)
        fetchVerifyFiles()
      } else {
        toast.error(data.error || 'Failed to delete file')
      }
    } catch {
      toast.error('Failed to delete file')
    }
  }

  const landingAds = ads.filter((a) => a.position === 'landing' || a.position === 'both')
  const generateAds = ads.filter((a) => a.position === 'generate' || a.position === 'both')

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
                <Upload className="size-3.5" />
                Upload File
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
                  <Label>Ad Code (Script / HTML / Div)</Label>
                  <Textarea
                    placeholder={`<iframe src="https://example.com/ad" width="728" height="90"></iframe>\n\n<div id="slot"><script src="https://example.com/ad.js" async></script></div>\n\n<script>\n  atOptions = { key: '...', format: 'iframe', height: 60, width: 468 };\n</script>\n<script src="https://example.com/invoke.js"></script>`}
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    className="min-h-[120px] font-mono text-xs resize-none overflow-y-auto"
                  />
                  <p className="text-xs text-muted-foreground">
                    Supports: iframes, scripts (AdSense, A-Ads, ZerAds, LinkSlot, etc.), HTML div banners, fetch-based ads, and any combination.
                  </p>
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
            Multiple ads rotate every 5 seconds. Supports ad scripts (AdSense, PropellerAds, etc.) and HTML/Div banners.
            Upload verification files (ads.txt, etc.) for ad company approval.
          </p>
        </CardContent>
      </Card>

      {/* Verification Files Card */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileCheck className="size-4 text-emerald-400" />
            Verification Files
            <Badge variant="secondary" className="text-xs">{verifyFiles.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {verifyFiles.length === 0 ? (
            <div className="py-8 text-center">
              <FolderOpen className="size-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No verification files uploaded</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Upload files like ads.txt, googleads.html, bing-siteauth.xml for ad company approval
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 gap-1.5"
                onClick={() => setUploadDialogOpen(true)}
              >
                <Upload className="size-3.5" />
                Upload First File
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {verifyFiles.map((file) => (
                <div
                  key={file.fileName}
                  className="flex items-center justify-between bg-white/[0.03] rounded-lg p-3 gap-3 group"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="size-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <FileText className="size-4 text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{file.fileName}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        {file.size > 0 && <span>{formatFileSize(file.size)}</span>}
                        {file.modifiedAt && <span>{formatDate(file.modifiedAt)}</span>}
                        <span className="text-emerald-400/70">/api/public/verify/{file.fileName}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleViewFile(file.fileName)}
                      className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                      title="View content"
                    >
                      <Eye className="size-3.5 text-blue-400" />
                    </button>
                    <a
                      href={`/api/public/verify/${file.fileName}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg hover:bg-white/5 transition-colors inline-flex"
                      title="Open in new tab"
                    >
                      <ExternalLink className="size-3.5 text-muted-foreground" />
                    </a>
                    <button
                      onClick={() => handleDeleteFile(file.fileName)}
                      className="p-2 rounded-lg hover:bg-destructive/10 transition-colors"
                      title="Delete file"
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* View File Dialog */}
      <Dialog open={viewFileOpen} onOpenChange={setViewFileOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-4 text-emerald-400" />
              {viewFileName}
              {viewFileSize > 0 && (
                <Badge variant="outline" className="text-xs font-normal">{formatFileSize(viewFileSize)}</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex gap-2 mb-3">
            <a
              href={`/api/public/verify/${viewFileName}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex"
            >
              <Button variant="outline" size="sm" className="gap-1.5">
                <ExternalLink className="size-3.5" />
                Open Live URL
              </Button>
            </a>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive hover:text-destructive"
              onClick={() => {
                setViewFileOpen(false)
                handleDeleteFile(viewFileName)
              }}
            >
              <Trash2 className="size-3.5" />
              Delete File
            </Button>
          </div>
          <div className="flex-1 overflow-auto rounded-lg border border-white/10 bg-black/20">
            {viewLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <pre className="p-4 text-xs text-muted-foreground font-mono whitespace-pre-wrap break-all leading-relaxed">
                {viewFileContent}
              </pre>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
