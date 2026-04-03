'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Clock,
  Image as ImageIcon,
  Video,
  Download,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  AlertCircle,
  Loader2,
} from 'lucide-react'

interface HistoryItem {
  id: string
  status: string
  resultUrl: string | null
  prompt: string
  modelId: string
  modelName?: string
  type: string
  aspectRatio: string
  imageSize: string
  createdAt: string
}

const PAGE_SIZE = 12

export function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'IMAGE' | 'VIDEO'>('all')
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null)

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
      const res = await fetch(`/api/generate/history?${params}`)
      if (res.status === 401) {
        toast.error('Please sign in to view history')
        setLoading(false)
        return
      }
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          let filtered = data.data?.items || []
          if (filter !== 'all') {
            filtered = filtered.filter((item: HistoryItem) => item.type === filter)
          }
          setItems(filtered)
          setTotal(data.data?.total || 0)
        }
      }
    } catch {
      toast.error('Failed to load history')
    } finally {
      setLoading(false)
    }
  }, [page, filter])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateStr
    }
  }

  const handleDownload = (url: string, type: string) => {
    const a = document.createElement('a')
    a.href = url
    a.download = `pixelforge-${Date.now()}.${type === 'VIDEO' ? 'mp4' : 'png'}`
    a.click()
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Clock className="size-6 text-emerald-400" />
              Generation History
            </h1>
            {!loading && <p className="text-sm text-muted-foreground mt-1">{total} total generations</p>}
          </div>

          {/* Filter Tabs */}
          <Tabs
            value={filter}
            onValueChange={(v) => {
              setFilter(v as 'all' | 'IMAGE' | 'VIDEO')
              setPage(1)
            }}
          >
            <TabsList>
              <TabsTrigger value="all" className="gap-1.5">
                All
              </TabsTrigger>
              <TabsTrigger value="IMAGE" className="gap-1.5">
                <ImageIcon className="size-3.5" />
                Images
              </TabsTrigger>
              <TabsTrigger value="VIDEO" className="gap-1.5">
                <Video className="size-3.5" />
                Videos
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="glass-card overflow-hidden">
                <Skeleton className="aspect-square w-full" />
                <div className="p-3 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="glass-card p-12 text-center max-w-md mx-auto">
            <div className="size-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="size-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No generations yet</h3>
            <p className="text-muted-foreground text-sm">Start creating to see your history here!</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <AnimatePresence mode="popLayout">
                {items.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3 }}
                    className="glass-card overflow-hidden group cursor-pointer hover:glow-sm transition-all duration-300"
                    onClick={() => setSelectedItem(item)}
                  >
                    <div className="aspect-square relative bg-black/20 overflow-hidden">
                      {item.status === 'COMPLETED' && item.resultUrl ? (
                        item.type === 'VIDEO' ? (
                          <video
                            src={item.resultUrl}
                            className="w-full h-full object-cover"
                            muted
                            preload="metadata"
                          />
                        ) : (
                          <img
                            src={item.resultUrl}
                            alt={item.prompt}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        )
                      ) : item.status === 'FAILED' ? (
                        <div className="w-full h-full flex items-center justify-center">
                          <AlertCircle className="size-8 text-red-400" />
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Loader2 className="size-6 text-muted-foreground animate-spin" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <ExternalLink className="size-5 text-white" />
                      </div>
                      <div className="absolute top-2 right-2">
                        <Badge
                          variant={
                            item.status === 'COMPLETED'
                              ? 'default'
                              : item.status === 'FAILED'
                                ? 'destructive'
                                : 'secondary'
                          }
                          className="text-xs"
                        >
                          {item.status === 'COMPLETED'
                            ? item.type === 'VIDEO'
                              ? 'Video'
                              : 'Image'
                            : item.status === 'FAILED'
                              ? 'Failed'
                              : 'Processing'}
                        </Badge>
                      </div>
                    </div>
                    <div className="p-3">
                      <p className="text-sm truncate mb-1">{item.prompt}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="size-4" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground px-4">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            )}
          </>
        )}

        {/* Detail Dialog */}
        <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-thin">
            {selectedItem && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    Generation Details
                    <Badge
                      variant={selectedItem.status === 'COMPLETED' ? 'default' : 'destructive'}
                    >
                      {selectedItem.status}
                    </Badge>
                  </DialogTitle>
                  <DialogDescription className="sr-only">Details of this generation</DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  {/* Result */}
                  {selectedItem.status === 'COMPLETED' && selectedItem.resultUrl && (
                    <div className="rounded-xl overflow-hidden bg-black/20">
                      {selectedItem.type === 'VIDEO' ? (
                        <video
                          src={selectedItem.resultUrl}
                          controls
                          className="w-full max-h-[400px] object-contain"
                        />
                      ) : (
                        <img
                          src={selectedItem.resultUrl}
                          alt={selectedItem.prompt}
                          className="w-full max-h-[400px] object-contain"
                        />
                      )}
                    </div>
                  )}

                  {/* Prompt */}
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Prompt</h4>
                    <p className="text-sm">{selectedItem.prompt}</p>
                  </div>

                  {/* Details grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Model</h4>
                      <p className="text-sm">{selectedItem.modelName || selectedItem.modelId}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Type</h4>
                      <p className="text-sm">{selectedItem.type}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Aspect Ratio</h4>
                      <p className="text-sm">{selectedItem.aspectRatio}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Image Size</h4>
                      <p className="text-sm">{selectedItem.imageSize}</p>
                    </div>
                    <div className="col-span-2">
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Created</h4>
                      <p className="text-sm">{formatDate(selectedItem.createdAt)}</p>
                    </div>
                  </div>

                  {/* Download button */}
                  {selectedItem.status === 'COMPLETED' && selectedItem.resultUrl && (
                    <Button
                      className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 gap-2"
                      onClick={() => handleDownload(selectedItem.resultUrl!, selectedItem.type)}
                    >
                      <Download className="size-4" />
                      Download {selectedItem.type === 'VIDEO' ? 'Video' : 'Image'}
                    </Button>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </motion.div>
    </div>
  )
}
