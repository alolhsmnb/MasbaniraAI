'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Plus,
  Trash2,
  Save,
  Loader2,
  DollarSign,
} from 'lucide-react'

export function ModelsTab() {
  const [models, setModels] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState({
    modelId: '',
    name: '',
    type: 'IMAGE',
    isActive: true,
  })
  const [pricingModel, setPricingModel] = useState<any>(null)
  const [pricingForm, setPricingForm] = useState<any>(null)
  const [pricingLoading, setPricingLoading] = useState(false)
  const [pricingSaving, setPricingSaving] = useState(false)

  const fetchModels = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/models')
      if (res.ok) {
        const data = await res.json()
        if (data.success) setModels(data.data || [])
      }
    } catch {
      toast.error('Failed to load models')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchModels()
  }, [fetchModels])

  const handleAdd = async () => {
    if (!form.modelId.trim() || !form.name.trim()) {
      toast.error('Please fill in all required fields')
      return
    }
    try {
      const res = await fetch('/api/admin/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        toast.success('Model added successfully')
        setAddOpen(false)
        setForm({ modelId: '', name: '', type: 'IMAGE', isActive: true })
        fetchModels()
      } else {
        toast.error('Failed to add model')
      }
    } catch {
      toast.error('Failed to add model')
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      const res = await fetch(`/api/admin/models?id=${deleteId}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Model deleted')
        fetchModels()
      } else {
        toast.error('Failed to delete model')
      }
    } catch {
      toast.error('Failed to delete model')
    } finally {
      setDeleteId(null)
    }
  }

  const handleToggleActive = async (model: any) => {
    try {
      const res = await fetch('/api/admin/models', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: model.modelId,
          isActive: !model.isActive,
        }),
      })
      if (res.ok) {
        toast.success(model.isActive ? 'Model deactivated' : 'Model activated')
        fetchModels()
      }
    } catch {
      toast.error('Failed to update model')
    }
  }

  const getPricingFormType = (model: any) => {
    if (model.type === 'IMAGE') return 'resolution'
    if (model.modelId.startsWith('sora-2')) return 'frames'
    if (model.modelId.startsWith('veo3')) return 'flat'
    return 'duration_resolution'
  }

  const handleEditPricing = async (model: any) => {
    setPricingModel(model)
    setPricingLoading(true)
    setPricingForm(null)
    try {
      const res = await fetch(`/api/admin/pricing?modelId=${encodeURIComponent(model.modelId)}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.data?.pricing) {
          setPricingForm({
            format: data.data.pricing.format,
            tiers: { ...data.data.pricing.tiers },
          })
        }
      } else {
        toast.error('Failed to load pricing')
        setPricingModel(null)
      }
    } catch {
      toast.error('Failed to load pricing')
      setPricingModel(null)
    } finally {
      setPricingLoading(false)
    }
  }

  const handleSavePricing = async () => {
    if (!pricingModel || !pricingForm) return
    setPricingSaving(true)
    try {
      const res = await fetch('/api/admin/pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: pricingModel.modelId,
          pricing: pricingForm,
        }),
      })
      if (res.ok) {
        toast.success(`Pricing saved for ${pricingModel.name}`)
        setPricingModel(null)
        setPricingForm(null)
      } else {
        toast.error('Failed to save pricing')
      }
    } catch {
      toast.error('Failed to save pricing')
    } finally {
      setPricingSaving(false)
    }
  }

  const updateTierValue = (key: string, subKey: string | null, value: number) => {
    if (!pricingForm) return
    if (subKey) {
      setPricingForm({
        ...pricingForm,
        tiers: {
          ...pricingForm.tiers,
          [key]: {
            ...pricingForm.tiers[key],
            [subKey]: value,
          },
        },
      })
    } else {
      setPricingForm({
        ...pricingForm,
        tiers: {
          ...pricingForm.tiers,
          [key]: value,
        },
      })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm text-muted-foreground">{models.length} models</h3>
        <Button
          size="sm"
          onClick={() => setAddOpen(true)}
          className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 gap-2"
        >
          <Plus className="size-4" />
          Add Model
        </Button>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Model ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : models.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No models configured. Click &quot;Add Model&quot; to create one.
                  </TableCell>
                </TableRow>
              ) : (
                models.map((model) => (
                  <TableRow key={model.id}>
                    <TableCell className="font-medium">{model.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono">
                      {model.modelId}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{model.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={model.isActive}
                        onCheckedChange={() => handleToggleActive(model)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-emerald-400 hover:text-emerald-300"
                          onClick={() => handleEditPricing(model)}
                          title="Edit Pricing"
                        >
                          <DollarSign className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-red-400 hover:text-red-300"
                          onClick={() => setDeleteId(model.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pricing Editor Dialog */}
      <Dialog open={!!pricingModel} onOpenChange={(open) => { if (!open) { setPricingModel(null); setPricingForm(null) } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="size-5 text-emerald-400" />
              Pricing: {pricingModel?.name}
            </DialogTitle>
          </DialogHeader>

          {pricingLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-emerald-400" />
              <span className="ml-2 text-sm text-muted-foreground">Loading pricing...</span>
            </div>
          ) : pricingForm ? (
            <div className="space-y-4">
              {getPricingFormType(pricingModel) === 'resolution' && (
                /* IMAGE model - Resolution tiers */
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Credits per resolution tier</p>
                  <div className="glass-card p-3 space-y-2">
                    {Object.entries(pricingForm.tiers).map(([tier, value]) => (
                      <div key={tier} className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium w-16">{tier}</span>
                        <Input
                          type="number"
                          min={0}
                          value={value as number}
                          onChange={(e) => updateTierValue(tier, null, parseInt(e.target.value) || 0)}
                          className="w-24 text-right"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {getPricingFormType(pricingModel) === 'duration_resolution' && (
                /* VIDEO (Grok) model - Duration × Resolution matrix */
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Duration &times; Resolution credit matrix</p>
                  <div className="glass-card overflow-hidden">
                    <div className="max-h-64 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-20">Duration</TableHead>
                            <TableHead className="text-center">480p Credits</TableHead>
                            <TableHead className="text-center">720p Credits</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Object.entries(pricingForm.tiers).map(([duration, res]: [string, any]) => (
                            <TableRow key={duration}>
                              <TableCell className="font-medium">{duration}s</TableCell>
                              <TableCell className="text-center">
                                <Input
                                  type="number"
                                  min={0}
                                  value={res['480p'] || 0}
                                  onChange={(e) => updateTierValue(duration, '480p', parseInt(e.target.value) || 0)}
                                  className="w-20 mx-auto text-center"
                                />
                              </TableCell>
                              <TableCell className="text-center">
                                <Input
                                  type="number"
                                  min={0}
                                  value={res['720p'] || 0}
                                  onChange={(e) => updateTierValue(duration, '720p', parseInt(e.target.value) || 0)}
                                  className="w-20 mx-auto text-center"
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              )}

              {getPricingFormType(pricingModel) === 'frames' && (
                /* Sora2 model - Frame tiers */
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Credits per frame count</p>
                  <div className="glass-card p-3 space-y-2">
                    {Object.entries(pricingForm.tiers).map(([frames, value]) => (
                      <div key={frames} className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium w-20">{frames} frames</span>
                        <Input
                          type="number"
                          min={0}
                          value={value as number}
                          onChange={(e) => updateTierValue(frames, null, parseInt(e.target.value) || 0)}
                          className="w-24 text-right"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {getPricingFormType(pricingModel) === 'flat' && (
                /* Veo model - Flat pricing */
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Credits per generation</p>
                  <div className="glass-card p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium">Credits</span>
                      <Input
                        type="number"
                        min={0}
                        value={(pricingForm.tiers as Record<string, number>)['default'] || 0}
                        onChange={(e) => updateTierValue('default', null, parseInt(e.target.value) || 0)}
                        className="w-24 text-right"
                      />
                    </div>
                  </div>
                </div>
              )}

              <DialogFooter className="pt-2">
                <Button variant="outline" onClick={() => { setPricingModel(null); setPricingForm(null) }}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSavePricing}
                  disabled={pricingSaving}
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 gap-2"
                >
                  {pricingSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  Save Pricing
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              No pricing data available
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Model Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add AI Model</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Model ID *</Label>
              <Input
                value={form.modelId}
                onChange={(e) => setForm({ ...form, modelId: e.target.value })}
                placeholder="e.g., flux-pro, stable-diffusion-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Display Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Flux Pro v1.1"
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IMAGE">IMAGE</SelectItem>
                  <SelectItem value="VIDEO">VIDEO</SelectItem>
                  <SelectItem value="ALL">ALL</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm({ ...form, isActive: v })}
              />
              <Label>Active</Label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAdd}
                className="bg-gradient-to-r from-emerald-500 to-teal-500"
              >
                Add Model
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Model</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this model? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
