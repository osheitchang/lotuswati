'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  Plus,
  Upload,
  Download,
  MoreHorizontal,
  Trash2,
  Edit,
  Ban,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { contactsApi, conversationsApi } from '@/lib/api'
import { Contact } from '@/types'
import { useInboxStore } from '@/store/inboxStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { cn, formatDate, getInitials, getAvatarColor } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { toast } from '@/components/ui/use-toast'
import { ContactModal } from './ContactModal'

export function ContactTable() {
  const router = useRouter()
  const { selectConversation } = useInboxStore()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const limit = 20

  const loadContacts = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await contactsApi.list({ search, page, limit })
      const data = response.data
      setContacts(data.contacts || data || [])
      setTotal(data.total || (data.contacts || data || []).length)
    } catch {
      toast({ title: 'Failed to load contacts', variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }, [search, page])

  useEffect(() => {
    loadContacts()
  }, [page])

  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
    if (searchTimeout) clearTimeout(searchTimeout)
    const t = setTimeout(() => loadContacts(), 400)
    setSearchTimeout(t)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this contact?')) return
    try {
      await contactsApi.delete(id)
      toast({ title: 'Contact deleted' })
      loadContacts()
    } catch {
      toast({ title: 'Failed to delete', variant: 'destructive' })
    }
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.length} contacts?`)) return
    try {
      await contactsApi.bulkDelete(selectedIds)
      toast({ title: `${selectedIds.length} contacts deleted` })
      setSelectedIds([])
      loadContacts()
    } catch {
      toast({ title: 'Failed to delete', variant: 'destructive' })
    }
  }

  const handleStartConversation = async (contact: Contact) => {
    try {
      const response = await conversationsApi.create({ contactId: contact.id })
      const convo = response.data.conversation || response.data
      selectConversation(convo.id)
      router.push('/inbox')
    } catch (error: any) {
      const status = error.response?.status
      if (status === 409) {
        const existingId = error.response?.data?.conversationId
        if (existingId) {
          selectConversation(existingId)
          router.push('/inbox')
        } else {
          toast({ title: 'A conversation already exists for this contact', variant: 'destructive' })
        }
      } else {
        toast({
          title: 'Failed to start conversation',
          description: error.response?.data?.error || 'An error occurred',
          variant: 'destructive',
        })
      }
    }
  }

  const handleBlock = async (contact: Contact) => {
    try {
      await contactsApi.block(contact.id, !contact.blocked)
      toast({ title: contact.blocked ? 'Contact unblocked' : 'Contact blocked' })
      loadContacts()
    } catch {
      toast({ title: 'Failed to update', variant: 'destructive' })
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === contacts.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(contacts.map((c) => c.id))
    }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Contacts</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} total contacts</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Upload className="w-4 h-4" />
            Import
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="w-4 h-4" />
            Export
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => { setEditingContact(null); setShowModal(true) }}>
            <Plus className="w-4 h-4" />
            New Contact
          </Button>
        </div>
      </div>

      {/* Search & filters */}
      <div className="px-6 py-3 bg-white border-b border-gray-100 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
        </div>
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">{selectedIds.length} selected</span>
            <Button
              size="sm"
              variant="destructive"
              className="h-8 gap-1"
              onClick={handleBulkDelete}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full">
          <thead className="sticky top-0 bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={selectedIds.length === contacts.length && contacts.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300"
                />
              </th>
              <th className="text-left text-xs font-medium text-gray-500 px-3 py-3">Name</th>
              <th className="text-left text-xs font-medium text-gray-500 px-3 py-3">Phone</th>
              <th className="text-left text-xs font-medium text-gray-500 px-3 py-3">Email</th>
              <th className="text-left text-xs font-medium text-gray-500 px-3 py-3">Tags</th>
              <th className="text-left text-xs font-medium text-gray-500 px-3 py-3">Added</th>
              <th className="w-12 px-3 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              [...Array(10)].map((_, i) => (
                <tr key={i}>
                  {[...Array(7)].map((_, j) => (
                    <td key={j} className="px-3 py-3">
                      <div className="h-4 bg-gray-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : contacts.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-16 text-gray-400">
                  <Search className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                  <p>No contacts found</p>
                </td>
              </tr>
            ) : (
              contacts.map((contact) => (
                <tr
                  key={contact.id}
                  className={cn(
                    'hover:bg-gray-50 transition-colors',
                    selectedIds.includes(contact.id) && 'bg-primary-50/50',
                    contact.blocked && 'opacity-60'
                  )}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(contact.id)}
                      onChange={() => toggleSelect(contact.id)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar className="w-8 h-8 flex-shrink-0">
                        <AvatarFallback
                          style={{ backgroundColor: getAvatarColor(contact.id) }}
                          className="text-white text-xs font-semibold"
                        >
                          {getInitials(contact.name, contact.phone)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{contact.name || '—'}</p>
                        {contact.blocked && (
                          <span className="text-xs text-red-500">Blocked</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-600">{contact.phone}</td>
                  <td className="px-3 py-3 text-sm text-gray-500">{contact.email || '—'}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {contact.tags?.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                      {contact.tags?.length > 3 && (
                        <span className="text-xs text-gray-400">+{contact.tags.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-400">{formatDate(contact.createdAt)}</td>
                  <td className="px-3 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => { setEditingContact(contact); setShowModal(true) }}>
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStartConversation(contact)}>
                          <MessageCircle className="w-4 h-4 mr-2" />
                          Start Conversation
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleBlock(contact)} className="text-orange-600">
                          <Ban className="w-4 h-4 mr-2" />
                          {contact.blocked ? 'Unblock' : 'Block'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(contact.id)} className="text-red-600">
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-3 bg-white border-t border-gray-100">
          <p className="text-sm text-gray-500">
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-gray-600 px-2">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      <ContactModal
        open={showModal}
        onClose={() => setShowModal(false)}
        contact={editingContact}
        onSaved={loadContacts}
      />
    </div>
  )
}
