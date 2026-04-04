'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/store/app-store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sparkles,
  Image as ImageIcon,
  Video,
  Download,
  RefreshCw,
  Loader2,
  AlertCircle,
  Wand2,
  Settings2,
  Clock,
  ChevronDown,
  Upload,
  X,
  ImagePlus,
} from 'lucide-react'
import { CryptoPaymentModal } from '@/components/crypto-payment-modal'
import { AdBanner } from '@/components/ad-banner'

interface Model {
  id: string
  modelId: string
  name: string
  type: string
  isActive: boolean
  supportsImageInput?: boolean
  pricing?: {
    format: string
    tiers: Record<string, any>
  } | null
}

interface GenerationResult {
  id: string
  status: string
  resultUrl: string | null
  prompt: string
  modelId: string
  type: string
  aspectRatio: string
  imageSize: string
  createdAt: string
}

const ASPECT_RATIOS = ['auto', '1:1', '1:4', '1:8', '2:3', '3:2', '3:4', '4:1', '4:3', '4:5', '5:4', '8:1', '9:16', '16:9', '21:9']
const IMAGE_SIZES = ['Auto', '1K', '2K', '4K']
const VIDEO_RESOLUTIONS = ['480p', '720p']
const ROTATIONS = ['0', '90', '180', '270']
const OUTPUT_FORMATS = ['png', 'jpg']
const VIDEO_MODES = ['fun', 'normal', 'spicy']
const SORA2_ASPECT_RATIOS = ['landscape', 'portrait']
const SORA2_FRAMES = ['10', '15']

// Models that support image input (optional)
const IMAGE_INPUT_MODELS = ['nano-banana-pro', 'nano-banana-2', 'veo3_fast']
// Models that require image input
const IMAGE_REQUIRED_MODELS = ['grok-imagine/image-to-image', 'grok-imagine/image-to-video', 'sora-2-image-to-video']
// Video models
const VIDEO_MODELS = ['grok-imagine/text-to-video', 'grok-imagine/image-to-video', 'sora-2-text-to-video', 'sora-2-image-to-video', 'veo3_fast']
// Sora2 models (use n_frames instead of duration, portrait/landscape instead of ratios)
const SORA2_MODELS = ['sora-2-text-to-video', 'sora-2-image-to-video']
const VEO_MODELS = ['veo3_fast']
const VEO_ASPECT_RATIOS = ['16:9', '9:16', 'Auto']

export function GeneratePage() {
  const { credits, setCredits } = useAppStore()
  const [models, setModels] = useState<Model[]>([])
  const [loading, setLoading] = useState(true)

  // Form state
  const [selectedModel, setSelectedModel] = useState('')
  const [genType, setGenType] = useState<'IMAGE' | 'VIDEO'>('IMAGE')
  const [prompt, setPrompt] = useState('')
  const [imageSize, setImageSize] = useState('1K')
  const [videoResolution, setVideoResolution] = useState('480p')
  const [aspectRatio, setAspectRatio] = useState('1:1')
  const [rotation, setRotation] = useState('0')
  const [outputFormat, setOutputFormat] = useState('png')
  const [videoMode, setVideoMode] = useState('normal')
  const [videoDuration, setVideoDuration] = useState(6)
  const [soraFrames, setSoraFrames] = useState('10')
  const [removeWatermark, setRemoveWatermark] = useState(true)
  const [enableTranslation, setEnableTranslation] = useState(true)

  // Image upload state
  const [uploadedImages, setUploadedImages] = useState<{ file: File; preview: string; url?: string }[]>([])
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [urlInput, setUrlInput] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [currentResult, setCurrentResult] = useState<GenerationResult | null>(null)
  const [generationError, setGenerationError] = useState<{ title: string; message: string } | null>(null)
  const [recentGenerations, setRecentGenerations] = useState<GenerationResult[]>([])

  // Payment modal state
  const [paymentOpen, setPaymentOpen] = useState(false)

  // Show ads only if user has 0 paid credits
  const showAds = (credits?.paidCredits ?? 0) <= 0

  // Settings collapsed
  const [settingsOpen, setSettingsOpen] = useState(false)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  // Compute current cost based on model pricing and options
  const currentCost = useMemo(() => {
    const model = models.find(m => m.modelId === selectedModel)
    if (!model?.pricing) return 1

    const { format, tiers } = model.pricing
    if (!tiers) return 1

    if (format === 'resolution') {
      const res = imageSize === 'Auto' ? 'Auto' : imageSize
      return Math.max(1, parseInt(String(tiers[res])) || 1)
    }
    if (format === 'duration_resolution') {
      const dur = String(videoDuration)
      const resTier = tiers[dur]
      if (resTier && typeof resTier === 'object') {
        return Math.max(1, parseInt(String(resTier[videoResolution])) || 1)
      }
      return 1
    }
    if (format === 'frames') {
      return Math.max(1, parseInt(String(tiers[soraFrames])) || 1)
    }
    if (format === 'flat') {
      return Math.max(1, parseInt(String(tiers.default)) || 1)
    }
    return 1
  }, [models, selectedModel, imageSize, videoDuration, videoResolution, soraFrames])

  // Check if current model supports/requires image input
  const currentModelSupportsImage = IMAGE_INPUT_MODELS.includes(selectedModel) || IMAGE_REQUIRED_MODELS.includes(selectedModel)
  const currentModelRequiresImage = IMAGE_REQUIRED_MODELS.includes(selectedModel)
  const isVideoModel = VIDEO_MODELS.includes(selectedModel)
  const currentModelIsImageToVideo = selectedModel === 'grok-imagine/image-to-video'
  const isSora2Model = SORA2_MODELS.includes(selectedModel)
  const isVeoModel = VEO_MODELS.includes(selectedModel)

  // Fetch models (re-fetch when page changes to reflect admin changes)
  const fetchModels = useCallback(async () => {
    try {
      const res = await fetch('/api/public/models')
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          const active = (data.data || []).filter((m: Model) => m.isActive)
          setModels(active)
          setSelectedModel((prev) => {
            // If current selected model is no longer active, reset to first available
            if (prev && !active.some((m: Model) => m.modelId === prev)) {
              return active.length > 0 ? active[0].modelId : ''
            }
            // Auto-select first model if none selected
            if (!prev && active.length > 0) {
              return active[0].modelId
            }
            return prev
          })
        }
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchModels()
  }, [])

  // Fetch recent generations
  useEffect(() => {
    const fetchRecent = async () => {
      try {
        const res = await fetch('/api/generate/history?page=1&limit=4')
        if (res.ok) {
          const data = await res.json()
          if (data.success) {
            setRecentGenerations(data.data?.items || [])
          }
        }
      } catch {
        // silent fail
      }
    }
    fetchRecent()
  }, [])

  // Upload images handler
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const remaining = 8 - uploadedImages.length - imageUrls.length
    if (remaining <= 0) {
      toast.error('Maximum 8 images allowed')
      return
    }

    const toUpload = files.slice(0, remaining)
    setIsUploading(true)

    try {
      const formData = new FormData()
      toUpload.forEach((file) => formData.append('images', file))

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (data.success && data.data?.urls) {
        const newImages = toUpload.map((file, i) => ({
          file,
          preview: URL.createObjectURL(file),
          url: data.data.urls[i],
        }))
        setUploadedImages((prev) => [...prev, ...newImages])
        toast.success(`${toUpload.length} image(s) uploaded`)
      } else {
        toast.error(data.error || 'Upload failed')
      }
    } catch {
      toast.error('Failed to upload images')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleAddUrl = () => {
    if (!urlInput.trim()) return
    if (imageUrls.length + uploadedImages.length >= 8) {
      toast.error('Maximum 8 images allowed')
      return
    }
    try {
      new URL(urlInput.trim())
      setImageUrls((prev) => [...prev, urlInput.trim()])
      setUrlInput('')
    } catch {
      toast.error('Please enter a valid URL')
    }
  }

  const removeImage = (index: number, type: 'file' | 'url') => {
    if (type === 'file') {
      setUploadedImages((prev) => {
        const item = prev[index]
        if (item) URL.revokeObjectURL(item.preview)
        return prev.filter((_, i) => i !== index)
      })
    } else {
      setImageUrls((prev) => prev.filter((_, i) => i !== index))
    }
  }

  // Polling logic
  const pollTask = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/generate/${id}`)
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.data) {
            const task = data.data
            setCurrentResult(task)
            if (task.status === 'COMPLETED') {
              setIsGenerating(false)
              setTaskId(null)
              toast.success('Generation complete!', {
                description: 'Your creation is ready to view and download.',
              })
              try {
                const creditsRes = await fetch('/api/user/credits')
                if (creditsRes.ok) {
                  const creditsData = await creditsRes.json()
                  if (creditsData.success) setCredits(creditsData.data)
                }
              } catch { /* silent */ }
              try {
                const histRes = await fetch('/api/generate/history?page=1&limit=4')
                if (histRes.ok) {
                  const histData = await histRes.json()
                  if (histData.success) setRecentGenerations(histData.data?.items || [])
                }
              } catch { /* silent */ }
              if (pollRef.current) clearInterval(pollRef.current)
              return
            }
            if (task.status === 'FAILED') {
              setIsGenerating(false)
              setTaskId(null)
              const errorTitle = (task as any).errorTitle || 'Generation Failed'
              const errorMessage = (task as any).errorMessage || 'Something went wrong during generation. The content may be inappropriate or there was a server issue. Please try a different prompt.'
              const wasRefunded = (task as any).refunded === true
              toast.error(errorTitle, { description: errorMessage, duration: wasRefunded ? 6000 : 4000 })
              setGenerationError({
                title: errorTitle,
                message: errorMessage,
              })
              // Refresh credits after refund
              if (wasRefunded) {
                try {
                  const creditsRes = await fetch('/api/user/credits')
                  if (creditsRes.ok) {
                    const creditsData = await creditsRes.json()
                    if (creditsData.success) setCredits(creditsData.data)
                  }
                } catch { /* silent */ }
              }
              if (pollRef.current) clearInterval(pollRef.current)
              return
            }
          }
        }
      } catch { /* continue polling */ }
    },
    [setCredits]
  )

  useEffect(() => {
    if (taskId && isGenerating) {
      pollRef.current = setInterval(() => pollTask(taskId), 3000)
      pollTask(taskId)
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [taskId, isGenerating, pollTask])

  const handleDownload = (url: string, type: string) => {
    const ext = type === 'VIDEO' ? 'mp4' : 'png'
    const filename = `pixelforge-${Date.now()}.${ext}`
    const downloadUrl = `/api/generate/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const handleGenerate = async () => {
    if (!selectedModel) {
      toast.error('Please select a model')
      return
    }
    if (!credits || credits.totalCredits < currentCost) {
      toast.error('Insufficient credits', {
        description: `You need at least ${currentCost} credit${currentCost > 1 ? 's' : ''} to generate.`,
      })
      return
    }
    // Prompt is optional for image-to-video
    if (!prompt.trim() && !currentModelIsImageToVideo) {
      toast.error('Please enter a prompt')
      return
    }
    // Check required image upload
    if (currentModelRequiresImage && uploadedImages.length === 0 && imageUrls.length === 0) {
      toast.error('Image required', {
        description: 'This model requires a reference image to generate.',
      })
      return
    }

    setIsGenerating(true)
    setCurrentResult(null)
    setTaskId(null)
    setGenerationError(null)

    // Collect all image URLs
    const allImageUrls = [
      ...uploadedImages.map((img) => img.url).filter(Boolean) as string[],
      ...imageUrls,
    ]

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: selectedModel,
          prompt: prompt.trim() || undefined,
          aspectRatio: isVeoModel ? (aspectRatio || '16:9') : isSora2Model ? (aspectRatio === 'portrait' || aspectRatio === 'landscape' ? aspectRatio : 'landscape') : aspectRatio,
          imageSize: isVideoModel && !isSora2Model && !isVeoModel ? videoResolution : (imageSize === 'Auto' ? 'AUTO' : imageSize),
          rotation: parseInt(rotation),
          type: isVideoModel ? 'VIDEO' : genType,
          imageInput: allImageUrls.length > 0 ? allImageUrls : undefined,
          outputFormat: !isVideoModel && currentModelSupportsImage ? outputFormat : undefined,
          mode: isVideoModel && !isSora2Model && !isVeoModel ? videoMode : undefined,
          duration: isVideoModel && !isSora2Model && !isVeoModel ? videoDuration : undefined,
          nFrames: isSora2Model ? soraFrames : undefined,
          removeWatermark: isSora2Model ? removeWatermark : undefined,
          enableTranslation: isVeoModel ? enableTranslation : undefined,
        }),
      })

      const data = await res.json()
      if (data.success && data.data) {
        setTaskId(data.data.taskId)
        toast.info('Generation started...', {
          description: 'This may take a few moments.',
        })
      } else {
        setIsGenerating(false)
        const errorMsg = data.error || 'Failed to start generation'
        const errorTitle = data.errorTitle || 'Generation Failed'
        toast.error(errorTitle)
        setGenerationError({
          title: errorTitle,
          message: errorMsg,
        })
      }
    } catch {
      setIsGenerating(false)
      toast.error('Network error. Please try again.')
      setGenerationError({
        title: 'Network Error',
        message: 'Could not reach the server. Please check your connection and try again.',
      })
    }
  }

  const filteredModels = models.filter(
    (m) => genType === 'ALL' || m.type === genType || m.type === 'ALL'
  )
  const activeModels = filteredModels.length > 0 ? filteredModels : models

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-60 w-full" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-80 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Left Column - Controls */}
        <div className="space-y-4">
          <div className="glass-card p-4 sm:p-6 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="size-5 text-emerald-400" />
              <h2 className="text-lg font-semibold">Create New</h2>
            </div>

            {models.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="size-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">
                  No AI models configured yet. Please ask an administrator to set up models.
                </p>
              </div>
            ) : (
              <>
                {/* Type selector */}
                <div className="flex gap-2">
                  <Button
                    variant={genType === 'IMAGE' ? 'default' : 'outline'}
                    size="sm"
                    className={`flex-1 gap-2 ${genType === 'IMAGE' ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : ''}`}
                    onClick={() => setGenType('IMAGE')}
                  >
                    <ImageIcon className="size-4" />
                    Image
                  </Button>
                  <Button
                    variant={genType === 'VIDEO' ? 'default' : 'outline'}
                    size="sm"
                    className={`flex-1 gap-2 ${genType === 'VIDEO' ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : ''}`}
                    onClick={() => setGenType('VIDEO')}
                  >
                    <Video className="size-4" />
                    Video
                  </Button>
                </div>

                {/* Model select */}
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">AI Model</Label>
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeModels.map((model) => (
                        <SelectItem key={model.modelId} value={model.modelId}>
                          <div className="flex items-center gap-2">
                            <span>{model.name}</span>
                            <Badge variant="outline" className="text-xs ml-1">
                              {model.type}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Prompt */}
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Prompt</Label>
                  <Textarea
                    placeholder="Describe what you want to create... Be specific for best results."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="h-[120px] resize-none overflow-y-auto"
                    maxLength={10000}
                  />
                  <div className="flex justify-end">
                    <span className="text-xs text-muted-foreground">{prompt.length}/10000</span>
                  </div>
                </div>

                {/* Image Upload Section - only for models that support it */}
                {currentModelSupportsImage && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <ImagePlus className="size-3.5" />
                        Reference Images
                        <Badge variant={currentModelRequiresImage ? "destructive" : "outline"} className="text-[10px] px-1.5 py-0">
                          {currentModelRequiresImage ? 'Required' : 'Optional'}
                        </Badge>
                      </Label>
                      <span className="text-xs text-muted-foreground">
                        {uploadedImages.length + imageUrls.length}/8
                      </span>
                    </div>

                    {/* Upload area */}
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-white/10 rounded-xl p-4 text-center cursor-pointer hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all group"
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        className="hidden"
                        onChange={handleFileSelect}
                      />
                      {isUploading ? (
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="size-4 animate-spin text-emerald-400" />
                          <span className="text-sm text-muted-foreground">Uploading...</span>
                        </div>
                      ) : (
                        <>
                          <Upload className="size-6 mx-auto text-muted-foreground group-hover:text-emerald-400 transition-colors" />
                          <p className="text-xs text-muted-foreground mt-2">
                            Click to upload images (JPEG, PNG, WebP · Max 30MB each)
                          </p>
                        </>
                      )}
                    </div>

                    {/* URL input */}
                    <div className="flex gap-2">
                      <input
                        type="url"
                        placeholder="Or paste an image URL..."
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()}
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-emerald-500/30"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAddUrl}
                        disabled={!urlInput.trim()}
                        className="shrink-0"
                      >
                        Add
                      </Button>
                    </div>

                    {/* Uploaded images preview */}
                    {(uploadedImages.length > 0 || imageUrls.length > 0) && (
                      <div className="grid grid-cols-4 gap-2">
                        {uploadedImages.map((img, i) => (
                          <div key={`file-${i}`} className="relative group aspect-square rounded-lg overflow-hidden border border-white/10">
                            <img src={img.preview} alt="" className="w-full h-full object-cover" />
                            <button
                              onClick={(e) => { e.stopPropagation(); removeImage(i, 'file') }}
                              className="absolute top-1 right-1 size-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                            >
                              <X className="size-3" />
                            </button>
                          </div>
                        ))}
                        {imageUrls.map((url, i) => (
                          <div key={`url-${i}`} className="relative group aspect-square rounded-lg overflow-hidden border border-white/10">
                            <img src={url} alt="" className="w-full h-full object-cover" />
                            <button
                              onClick={(e) => { e.stopPropagation(); removeImage(i, 'url') }}
                              className="absolute top-1 right-1 size-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                            >
                              <X className="size-3" />
                            </button>
                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-1">
                              <p className="text-[9px] text-white truncate">URL</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Advanced Settings */}
                <div className="border border-white/5 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setSettingsOpen(!settingsOpen)}
                    className="w-full flex items-center justify-between p-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Settings2 className="size-4" />
                      Advanced Settings
                    </div>
                    <ChevronDown
                      className={`size-4 transition-transform duration-200 ${settingsOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                  <AnimatePresence>
                    {settingsOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-3 pb-3 space-y-3">
                          {/* Video Mode (Grok only) */}
                          {isVideoModel && !isSora2Model && (
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">Motion Style</Label>
                              <div className="grid grid-cols-3 gap-2">
                                {VIDEO_MODES.map((m) => (
                                  <button
                                    key={m}
                                    onClick={() => setVideoMode(m)}
                                    className={`px-3 py-2 rounded-lg text-xs font-medium capitalize transition-all ${
                                      videoMode === m
                                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20'
                                        : 'bg-white/5 border border-white/10 text-muted-foreground hover:border-emerald-500/30 hover:text-foreground'
                                    }`}
                                  >
                                    {m === 'fun' ? '🎬 Fun' : m === 'normal' ? '✨ Normal' : '🔥 Spicy'}
                                  </button>
                                ))}
                              </div>
                              {videoMode === 'spicy' && currentModelIsImageToVideo && (
                                <p className="text-[11px] text-yellow-400/80">⚠️ Spicy mode is not available with external images</p>
                              )}
                            </div>
                          )}
                          {/* Video Duration (Grok only) */}
                          {isVideoModel && !isSora2Model && !isVeoModel && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs text-muted-foreground">Duration</Label>
                                <span className="text-xs font-medium text-emerald-400">{videoDuration}s</span>
                              </div>
                              <input
                                type="range"
                                min={6}
                                max={30}
                                step={1}
                                value={videoDuration}
                                onChange={(e) => setVideoDuration(parseInt(e.target.value))}
                                className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-emerald-500"
                              />
                              <div className="flex justify-between text-[10px] text-muted-foreground">
                                <span>6s</span>
                                <span>30s</span>
                              </div>
                            </div>
                          )}
                          {/* Sora2: Frames */}
                          {isSora2Model && (
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">Frames</Label>
                              <div className="grid grid-cols-2 gap-2">
                                {SORA2_FRAMES.map((f) => (
                                  <button
                                    key={f}
                                    onClick={() => setSoraFrames(f)}
                                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                      soraFrames === f
                                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20'
                                        : 'bg-white/5 border border-white/10 text-muted-foreground hover:border-emerald-500/30 hover:text-foreground'
                                    }`}
                                  >
                                    {f} frames
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* Sora2: Remove Watermark */}
                          {isSora2Model && (
                            <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">Remove Watermark</span>
                              </div>
                              <button
                                onClick={() => setRemoveWatermark(!removeWatermark)}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                  removeWatermark ? 'bg-emerald-500' : 'bg-white/20'
                                }`}
                              >
                                <span
                                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                                    removeWatermark ? 'translate-x-4' : 'translate-x-0.5'
                                  }`}
                                />
                              </button>
                            </div>
                          )}
                          {/* Video Resolution (Grok only) */}
                          {isVideoModel ? (
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">Resolution</Label>
                              <Select value={videoResolution} onValueChange={(val) => setVideoResolution(val)}>
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {VIDEO_RESOLUTIONS.map((res) => (
                                    <SelectItem key={res} value={res}>
                                      {res}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">Resolution</Label>
                              <Select value={imageSize} onValueChange={setImageSize}>
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {IMAGE_SIZES.map((size) => (
                                    <SelectItem key={size} value={size}>
                                      {size}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Aspect Ratio</Label>
                            <Select
                              value={
                                isVeoModel ? (aspectRatio || '16:9') :
                                isSora2Model ? (aspectRatio === 'portrait' || aspectRatio === 'landscape' ? aspectRatio : 'landscape') :
                                aspectRatio
                              }
                              onValueChange={(val) => setAspectRatio(val)}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {(isVeoModel
                                  ? VEO_ASPECT_RATIOS
                                  : isSora2Model ? SORA2_ASPECT_RATIOS : ASPECT_RATIOS
                                ).map((ratio) => (
                                  <SelectItem key={ratio} value={ratio}>
                                    {ratio === 'portrait' ? '📱 Portrait' : ratio === 'landscape' ? '🖥️ Landscape' : ratio === 'Auto' ? '🔄 Auto' : ratio}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {/* Veo: Enable Translation */}
                          {isVeoModel && (
                            <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                              <div>
                                <span className="text-xs text-muted-foreground block">Auto Translate</span>
                                <span className="text-[10px] text-muted-foreground/60">Translate prompt to English</span>
                              </div>
                              <button
                                onClick={() => setEnableTranslation(!enableTranslation)}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                  enableTranslation ? 'bg-emerald-500' : 'bg-white/20'
                                }`}
                              >
                                <span
                                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                                    enableTranslation ? 'translate-x-4' : 'translate-x-0.5'
                                  }`}
                                />
                              </button>
                            </div>
                          )}
                          {!isVideoModel && currentModelSupportsImage && (
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">Output Format</Label>
                              <Select value={outputFormat} onValueChange={setOutputFormat}>
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {OUTPUT_FORMATS.map((fmt) => (
                                    <SelectItem key={fmt} value={fmt}>
                                      {fmt.toUpperCase()}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          {!isVideoModel && (
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">Rotation</Label>
                              <Select value={rotation} onValueChange={setRotation}>
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {ROTATIONS.map((rot) => (
                                    <SelectItem key={rot} value={rot}>
                                      {rot}°
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Cost Indicator */}
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs text-muted-foreground">Estimated Cost</span>
                  <span className="text-sm font-semibold text-emerald-400">{currentCost} credit{currentCost !== 1 ? 's' : ''}</span>
                </div>

                {/* Generate Button */}
                <Button
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold h-12 text-base gap-2"
                  onClick={handleGenerate}
                  disabled={isGenerating || (!prompt.trim() && !currentModelIsImageToVideo) || !selectedModel || (credits?.totalCredits ?? 0) < currentCost || isUploading}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="size-5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="size-5" />
                      Generate{(credits?.totalCredits ?? 0) < currentCost ? ' (No Credits)' : ` (${currentCost} Credit${currentCost > 1 ? 's' : ''})`}
                    </>
                  )}
                </Button>

                {credits && credits.totalCredits < currentCost && (
                  <p className="text-center text-xs">
                    <span className="text-red-400">Insufficient credits. You need at least {currentCost} credit{currentCost !== 1 ? 's' : ''}. </span>
                    <button
                      onClick={() => setPaymentOpen(true)}
                      className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 font-medium transition-colors"
                    >
                      Buy Credits
                    </button>
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right Column - Results */}
        <div className="space-y-4">
          <div className="glass-card p-4 sm:p-6 min-h-[300px] flex items-center justify-center">
            {isGenerating ? (
              <motion.div
                className="text-center space-y-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="relative size-24 mx-auto">
                  <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
                  <div className="absolute inset-2 rounded-full bg-emerald-500/30 animate-pulse" />
                  <div className="absolute inset-4 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <Wand2 className="size-8 text-emerald-400 animate-pulse" />
                  </div>
                </div>
                <div>
                  <p className="font-medium">Generating your creation...</p>
                  <p className="text-sm text-muted-foreground mt-1">This may take a moment</p>
                </div>
                <div className="flex justify-center">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-2 h-2 rounded-full bg-emerald-400"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : currentResult?.status === 'COMPLETED' && currentResult.resultUrl ? (
              (() => {
                const isValidUrl = currentResult.resultUrl.startsWith('http://') || currentResult.resultUrl.startsWith('https://')
                return (
                  <motion.div
                    className="w-full space-y-4"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    {isValidUrl ? (
                      <>
                        <div className="relative group rounded-xl overflow-hidden bg-black/20">
                          {currentResult.type === 'VIDEO' ? (
                            <video
                              src={currentResult.resultUrl}
                              controls
                              className="w-full max-h-[400px] object-contain"
                            />
                          ) : (
                            <img
                              src={currentResult.resultUrl}
                              alt={currentResult.prompt}
                              className="w-full max-h-[400px] object-contain"
                            />
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">
                              {currentResult.type === 'VIDEO' ? 'Video' : 'Image'}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {currentResult.aspectRatio} &middot; {currentResult.imageSize}
                            </span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => handleDownload(currentResult.resultUrl!, currentResult.type)}
                          >
                            <Download className="size-4" />
                            Download
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{currentResult.prompt}</p>
                      </>
                    ) : (
                      <div className="text-center space-y-3">
                        <div className="size-16 rounded-2xl bg-yellow-500/10 flex items-center justify-center mx-auto">
                          <AlertCircle className="size-8 text-yellow-400" />
                        </div>
                        <div>
                          <p className="font-medium text-yellow-400">Generation Completed</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Image was generated but URL extraction failed. Check dev logs for raw result.
                          </p>
                          <pre className="mt-2 p-3 rounded-lg bg-black/30 text-xs text-muted-foreground max-h-32 overflow-auto text-left">
                            {currentResult.resultUrl.substring(0, 500)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )
              })()
            ) : currentResult?.status === 'FAILED' || generationError ? (
              <motion.div
                className="text-center space-y-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="size-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto">
                  <AlertCircle className="size-8 text-red-400" />
                </div>
                <div>
                  <p className="font-medium text-red-400">{generationError?.title || 'Generation Failed'}</p>
                  <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                    {generationError?.message || 'Something went wrong. Please try again.'}
                  </p>
                </div>
                {(currentResult as any)?.refunded && (
                  <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 mx-auto">
                    Credits Refunded
                  </Badge>
                )}
                <Button variant="outline" size="sm" className="gap-2" onClick={() => { setGenerationError(null); handleGenerate(); }}>
                  <RefreshCw className="size-4" />
                  Try Again
                </Button>
              </motion.div>
            ) : (
              <div className="text-center space-y-3">
                <div className="size-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto">
                  <Wand2 className="size-8 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-muted-foreground">Your creation will appear here</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Enter a prompt and click Generate
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Ad Banner - Between columns on mobile, below results on desktop */}
          <AdBanner position="generate" showAds={showAds} />

          {/* Recent Generations */}
          {recentGenerations.length > 0 && (
            <div className="glass-card p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="size-4 text-muted-foreground" />
                <h3 className="text-sm font-medium text-muted-foreground">Recent Generations</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {recentGenerations.slice(0, 4).map((gen) => (
                  <div
                    key={gen.id}
                    className="rounded-xl overflow-hidden bg-black/20 border border-white/5 group cursor-pointer hover:border-emerald-500/30 transition-colors"
                    onClick={() => {
                      if (gen.status === 'COMPLETED' && gen.resultUrl) {
                        setCurrentResult(gen)
                      }
                    }}
                  >
                    <div className="aspect-square relative">
                      {gen.resultUrl && gen.status === 'COMPLETED' ? (
                        gen.type === 'VIDEO' ? (
                          <video
                            src={gen.resultUrl}
                            className="w-full h-full object-cover"
                            muted
                          />
                        ) : (
                          <img
                            src={gen.resultUrl}
                            alt={gen.prompt}
                            className="w-full h-full object-cover"
                          />
                        )
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Skeleton className="w-full h-full" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <Download className="size-5 text-white" />
                      </div>
                    </div>
                    <div className="p-2">
                      <p className="text-xs text-muted-foreground truncate">{gen.prompt}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Crypto Payment Modal */}
      <CryptoPaymentModal
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
      />
    </div>
  )
}
