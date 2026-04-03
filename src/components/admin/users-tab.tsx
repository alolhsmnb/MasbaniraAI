'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
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
  Search,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Ban,
  CheckCircle2,
} from 'lucide-react'

const PAGE_SIZE = 10

export function UsersTab() {
  const [users, setUsers] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [editUser, setEditUser] = useState<any>(null)
  const [editForm, setEditForm] = useState({ dailyCredits: '', paidCredits: '', role: 'USER' })

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
      const res = await fetch(`/api/admin/users?${params}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setUsers(data.data?.users || [])
          setTotal(data.data?.total || 0)
        }
      }
    } catch {
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const filteredUsers = search
    ? users.filter(
        (u) =>
          u.email?.toLowerCase().includes(search.toLowerCase()) ||
          u.name?.toLowerCase().includes(search.toLowerCase())
      )
    : users

  const handleEditOpen = (user: any) => {
    setEditUser(user)
    setEditForm({
      dailyCredits: String(user.dailyCredits || 0),
      paidCredits: String(user.paidCredits || 0),
      role: user.role || 'USER',
    })
  }

  const handleEditSave = async () => {
    if (!editUser) return
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editUser.id,
          dailyCredits: parseInt(editForm.dailyCredits),
          paidCredits: parseInt(editForm.paidCredits),
          role: editForm.role,
        }),
      })
      if (res.ok) {
        toast.success('User updated successfully')
        setEditUser(null)
        fetchUsers()
      } else {
        toast.error('Failed to update user')
      }
    } catch {
      toast.error('Failed to update user')
    }
  }

  const handleToggleBan = async (user: any) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, isBanned: !user.isBanned }),
      })
      if (res.ok) {
        toast.success(user.isBanned ? 'User unbanned' : 'User banned')
        fetchUsers()
      }
    } catch {
      toast.error('Failed to update user')
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-center">Daily Credits</TableHead>
                <TableHead className="text-center">Paid Credits</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'ADMIN' ? 'default' : 'outline'}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">{user.dailyCredits || 0}</TableCell>
                    <TableCell className="text-center">{user.paidCredits || 0}</TableCell>
                    <TableCell>
                      <Badge variant={user.isBanned ? 'destructive' : 'outline'}>
                        {user.isBanned ? 'Banned' : 'Active'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => handleEditOpen(user)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`size-8 ${user.isBanned ? 'text-emerald-400' : 'text-red-400'}`}
                          onClick={() => handleToggleBan(user)}
                        >
                          {user.isBanned ? (
                            <CheckCircle2 className="size-3.5" />
                          ) : (
                            <Ban className="size-3.5" />
                          )}
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            <ChevronLeft className="size-4" />
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
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          {editUser && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">{editUser.email}</p>
                <p className="text-xs text-muted-foreground">{editUser.name}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Daily Credits</Label>
                  <Input
                    type="number"
                    value={editForm.dailyCredits}
                    onChange={(e) =>
                      setEditForm({ ...editForm, dailyCredits: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Paid Credits</Label>
                  <Input
                    type="number"
                    value={editForm.paidCredits}
                    onChange={(e) =>
                      setEditForm({ ...editForm, paidCredits: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={editForm.role}
                  onValueChange={(v) => setEditForm({ ...editForm, role: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USER">USER</SelectItem>
                    <SelectItem value="ADMIN">ADMIN</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditUser(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleEditSave}
                  className="bg-gradient-to-r from-emerald-500 to-teal-500"
                >
                  Save
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
