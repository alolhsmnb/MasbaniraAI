'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { Plus, Trash2, ShieldCheck, Loader2, KeyRound } from 'lucide-react'

export function ApiKeysTab() {
  const [keys, setKeys] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [fetchingSecretId, setFetchingSecretId] = useState<string | null>(null)
  const [form, setForm] = useState({ key: '', name: '', provider: 'KIE' })

  const fetchKeys = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/api-keys')
      if (res.ok) {
        const data = await res.json()
        if (data.success) setKeys(data.data || [])
      }
    } catch {
      toast.error('Failed to load API keys')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchKeys()
  }, [fetchKeys])

  const handleAdd = async () => {
    if (!form.key.trim() || !form.name.trim()) {
      toast.error('Please fill in all fields')
      return
    }
    try {
      const res = await fetch('/api/admin/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        toast.success('API key added successfully')
        setAddOpen(false)
        setForm({ key: '', name: '' })
        fetchKeys()
      } else {
        toast.error('Failed to add API key')
      }
    } catch {
      toast.error('Failed to add API key')
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      const res = await fetch(`/api/admin/api-keys?id=${deleteId}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('API key deleted')
        fetchKeys()
      } else {
        toast.error('Failed to delete API key')
      }
    } catch {
      toast.error('Failed to delete API key')
    } finally {
      setDeleteId(null)
    }
  }

  const PROVIDERS = [
    { value: 'KIE', label: 'KIE.AI' },
    { value: 'WAVESPEED', label: 'WaveSpeed.AI' },
  ]

  const handleFetchSecret = async (keyId: string) => {
    setFetchingSecretId(keyId)
    try {
      const res = await fetch(`/api/admin/api-keys/webhook-secret?keyId=${keyId}`)
      const data = await res.json()
      if (data.success) {
        toast.success(`Webhook secret saved: ${data.secretPreview}`)
      } else {
        toast.error(data.error || 'Failed to fetch webhook secret')
      }
    } catch {
      toast.error('Failed to fetch webhook secret')
    } finally {
      setFetchingSecretId(null)
    }
  }

  const maskKey = (key: string) => {
    if (key.length <= 8) return '••••••••'
    return key.substring(0, 4) + '••••••••' + key.substring(key.length - 4)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm text-muted-foreground">{keys.length} API keys</h3>
        <Button
          size="sm"
          onClick={() => setAddOpen(true)}
          className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 gap-2"
        >
          <Plus className="size-4" />
          Add Key
        </Button>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Key</TableHead>
                <TableHead className="text-center">Usage Count</TableHead>
                <TableHead className="text-center">Active</TableHead>
                <TableHead>Last Used</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : keys.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No API keys configured. Click &quot;Add Key&quot; to create one.
                  </TableCell>
                </TableRow>
              ) : (
                keys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell>
                      {key.provider === 'WAVESPEED'
                        ? <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">WaveSpeed</Badge>
                        : <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">KIE.AI</Badge>
                      }
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-white/5 px-2 py-1 rounded font-mono">
                        {maskKey(key.key || '')}
                      </code>
                    </TableCell>
                    <TableCell className="text-center">{key.usageCount || 0}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={key.isActive !== false ? 'default' : 'destructive'}>
                        {key.isActive !== false ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {key.lastUsed
                        ? new Date(key.lastUsed).toLocaleDateString()
                        : 'Never'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {key.provider === 'WAVESPEED' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-amber-500 border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-400 h-7 px-2 text-xs"
                            onClick={() => handleFetchSecret(key.id)}
                            disabled={fetchingSecretId === key.id}
                          >
                            {fetchingSecretId === key.id ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <KeyRound className="size-3.5" />
                            )}
                            {fetchingSecretId === key.id ? 'Fetching...' : 'Webhook Secret'}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-red-400 hover:text-red-300"
                          onClick={() => setDeleteId(key.id)}
                          title="Delete Key"
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

      {/* Add Key Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add API Key</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Provider *</Label>
              <Select
                value={form.provider}
                onValueChange={(val) => setForm({ ...form, provider: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Key Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Production Key"
              />
            </div>
            <div className="space-y-2">
              <Label>API Key *</Label>
              <Input
                value={form.key}
                onChange={(e) => setForm({ ...form, key: e.target.value })}
                placeholder="Enter your API key"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAdd}
                className="bg-gradient-to-r from-emerald-500 to-teal-500"
              >
                Add Key
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this API key? This action cannot be undone.
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
