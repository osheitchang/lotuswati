'use client'

import { useEffect, useState } from 'react'
import { Search, Plus, Filter, RefreshCw } from 'lucide-react'
import { useInboxStore } from '@/store/inboxStore'
import { useAppStore } from '@/store/appStore'
import { ConversationItem } from './ConversationItem'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { conversationsApi, templatesApi } from '@/lib/api'
import { toast } from '@/components/ui/use-toast'
import { Template } from '@/types'

const statusTabs = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'pending', label: 'Pending' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'snoozed', label: 'Snoozed' },
]

interface ConversationListProps {
  onNewConversation?: () => void
}

export function ConversationList({ onNewConversation }: ConversationListProps) {
  const {
    conversations,
    selectedConversationId,
    filters,
    isLoadingConversations,
    loadConversations,
    selectConversation,
    updateFilters,
    resolveConversation,
  } = useInboxStore()
  const { labels, agents } = useAppStore()
  const [searchValue, setSearchValue] = useState(filters.search)
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null)
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [newPhone, setNewPhone] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [approvedTemplates, setApprovedTemplates] = useState<Template[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [templateVars, setTemplateVars] = useState<Record<string, string>>({})

  function extractVariables(body: string): number[] {
    const indices: number[] = []
    const seen = new Set<number>()
    const re = /\{\{(\d+)\}\}/g
    let m
    while ((m = re.exec(body)) !== null) {
      const n = Number(m[1])
      if (!seen.has(n)) { seen.add(n); indices.push(n) }
    }
    return indices.sort((a, b) => a - b)
  }

  useEffect(() => {
    if (showNewDialog) {
      templatesApi.list({ status: 'approved' }).then((res) => {
        setApprovedTemplates(res.data.templates || res.data || [])
      }).catch(() => {})
    }
  }, [showNewDialog])

  useEffect(() => {
    loadConversations()
  }, [filters.status, filters.assignedTo, filters.label])

  const handleSearch = (value: string) => {
    setSearchValue(value)
    if (searchTimeout) clearTimeout(searchTimeout)
    const timeout = setTimeout(() => {
      updateFilters({ search: value })
      loadConversations()
    }, 400)
    setSearchTimeout(timeout)
  }

  const handleCreateConversation = async () => {
    const phone = newPhone.replace(/\D/g, '')
    if (!phone) return
    setIsCreating(true)
    try {
      const payload: Parameters<typeof conversationsApi.create>[0] = { phone }
      if (selectedTemplateId) {
        const tpl = approvedTemplates.find((t) => t.id === selectedTemplateId)
        if (tpl) {
          payload.templateName = tpl.name
          payload.templateLanguage = tpl.language
          payload.templateVariables = templateVars
        }
      }
      const response = await conversationsApi.create(payload)
      const conversation = response.data.conversation || response.data
      toast({ title: 'Conversation started' })
      setShowNewDialog(false)
      setNewPhone('')
      setSelectedTemplateId('')
      setTemplateVars({})
      loadConversations()
      selectConversation(conversation.id)
    } catch (error: any) {
      const status = error.response?.status
      if (status === 409) {
        // Open conversation already exists — just navigate to it
        const existingId = error.response.data.conversationId
        if (existingId) {
          setShowNewDialog(false)
          setNewPhone('')
          setSelectedTemplateId('')
          setTemplateVars({})
          selectConversation(existingId)
          toast({ title: 'Existing conversation opened' })
        } else {
          toast({ title: 'A conversation with this contact is already open', variant: 'destructive' })
        }
      } else {
        toast({
          title: 'Failed to create conversation',
          description: error.response?.data?.error || error.response?.data?.message || 'An error occurred',
          variant: 'destructive',
        })
      }
    } finally {
      setIsCreating(false)
    }
  }

  const filteredConversations = conversations.filter((c) => {
    if (!searchValue) return true
    const name = c.contact?.name?.toLowerCase() || ''
    const phone = c.contact?.phone?.toLowerCase() || ''
    const search = searchValue.toLowerCase()
    return name.includes(search) || phone.includes(search)
  })

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-100">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900 text-base">Conversations</h2>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => loadConversations()}
              disabled={isLoadingConversations}
            >
              <RefreshCw className={cn('w-4 h-4', isLoadingConversations && 'animate-spin')} />
            </Button>
            <Button
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => setShowNewDialog(true)}
            >
              <Plus className="w-3.5 h-3.5" />
              New
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search conversations..."
            value={searchValue}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9 h-8 text-sm bg-gray-50 border-gray-200"
          />
        </div>

        {/* Status tabs */}
        <div className="flex gap-1 mt-3 overflow-x-auto scrollbar-hide">
          {statusTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => updateFilters({ status: tab.value })}
              className={cn(
                'text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap transition-colors',
                filters.status === tab.value
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-500 hover:bg-gray-100'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filter row */}
        <div className="flex items-center gap-2 mt-2">
          {/* Label filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200 hover:bg-gray-50">
                <Filter className="w-3 h-3" />
                {filters.label ? labels.find(l => l.id === filters.label)?.name || 'Label' : 'Label'}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              <DropdownMenuLabel className="text-xs">Filter by Label</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => updateFilters({ label: '' })}>
                All Labels
              </DropdownMenuItem>
              {labels.map((label) => (
                <DropdownMenuItem
                  key={label.id}
                  onClick={() => updateFilters({ label: label.id })}
                >
                  <span
                    className="w-2 h-2 rounded-full mr-2 flex-shrink-0"
                    style={{ backgroundColor: label.color }}
                  />
                  {label.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Agent filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200 hover:bg-gray-50">
                <Filter className="w-3 h-3" />
                {filters.assignedTo
                  ? agents.find(a => a.id === filters.assignedTo)?.name || 'Agent'
                  : 'Agent'}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              <DropdownMenuLabel className="text-xs">Filter by Agent</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => updateFilters({ assignedTo: '' })}>
                All Agents
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateFilters({ assignedTo: 'unassigned' })}>
                Unassigned
              </DropdownMenuItem>
              {agents.map((agent) => (
                <DropdownMenuItem
                  key={agent.id}
                  onClick={() => updateFilters({ assignedTo: agent.id })}
                >
                  {agent.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoadingConversations ? (
          <div className="space-y-0">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3 border-b border-gray-100">
                <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-gray-200 rounded animate-pulse w-3/4" />
                  <div className="h-2.5 bg-gray-100 rounded animate-pulse w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-gray-500 text-sm font-medium">No conversations</p>
            <p className="text-gray-400 text-xs mt-1">
              {searchValue ? 'Try a different search term' : 'Start a new conversation'}
            </p>
          </div>
        ) : (
          filteredConversations.map((conversation) => (
            <ConversationItem
              key={conversation.id}
              conversation={conversation}
              isSelected={selectedConversationId === conversation.id}
              onClick={() => selectConversation(conversation.id)}
              onResolve={() => resolveConversation(conversation.id)}
              onAssign={() => {}}
            />
          ))
        )}
      </div>
      {/* ── New Conversation Dialog ── */}
      <Dialog open={showNewDialog} onOpenChange={(open) => {
        setShowNewDialog(open)
        if (!open) { setNewPhone(''); setSelectedTemplateId(''); setTemplateVars({}) }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Conversation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="new-phone">Phone Number</Label>
              <Input
                id="new-phone"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="e.g. 628123456789 (with country code)"
                className="mt-1"
              />
              <p className="text-xs text-gray-400 mt-1">Digits only, include country code</p>
            </div>
            <div>
              <Label>Template <span className="text-gray-400 font-normal">(required to send first message)</span></Label>
              <select
                value={selectedTemplateId}
                onChange={(e) => { setSelectedTemplateId(e.target.value); setTemplateVars({}) }}
                className="w-full mt-1 border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="">— No template, just create conversation —</option>
                {approvedTemplates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.language})</option>
                ))}
              </select>
            </div>
            {selectedTemplateId && (() => {
              const tpl = approvedTemplates.find((t) => t.id === selectedTemplateId)
              if (!tpl) return null
              const vars = extractVariables(tpl.body)
              if (vars.length === 0) return (
                <div className="bg-gray-50 rounded-lg p-2.5 text-xs text-gray-600">{tpl.body}</div>
              )
              return (
                <div className="space-y-2">
                  <div className="bg-gray-50 rounded-lg p-2.5 text-xs text-gray-600">{tpl.body}</div>
                  {vars.map((n) => (
                    <div key={n}>
                      <Label className="text-xs">Variable {`{{${n}}}`}</Label>
                      <Input
                        value={templateVars[String(n)] || ''}
                        onChange={(e) => setTemplateVars((prev) => ({ ...prev, [String(n)]: e.target.value }))}
                        placeholder={`Value for {{${n}}}`}
                        className="mt-0.5 h-8 text-sm"
                      />
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>Cancel</Button>
            <Button
              onClick={handleCreateConversation}
              disabled={isCreating || !newPhone.replace(/\D/g, '') || (!!selectedTemplateId && (() => {
                const tpl = approvedTemplates.find((t) => t.id === selectedTemplateId)
                if (!tpl) return false
                return extractVariables(tpl.body).some((n) => !templateVars[String(n)]?.trim())
              })())}
            >
              {isCreating ? 'Starting...' : 'Start Conversation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
