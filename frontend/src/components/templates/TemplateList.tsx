'use client'

import { useState, useEffect } from 'react'
import { Plus, FileText, Edit, Trash2, Send, Filter, RefreshCw } from 'lucide-react'
import { templatesApi } from '@/lib/api'
import { Template } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TemplateModal } from './TemplateModal'
import { cn, getTemplateStatusColor } from '@/lib/utils'
import { toast } from '@/components/ui/use-toast'

export function TemplateList() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const loadTemplates = async () => {
    setIsLoading(true)
    try {
      const response = await templatesApi.list({
        category: filterCategory || undefined,
        status: filterStatus || undefined,
      })
      setTemplates(response.data.templates || response.data || [])
    } catch {
      toast({ title: 'Failed to load templates', variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadTemplates()
  }, [filterCategory, filterStatus])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return
    try {
      await templatesApi.delete(id)
      toast({ title: 'Template deleted' })
      loadTemplates()
    } catch {
      toast({ title: 'Failed to delete', variant: 'destructive' })
    }
  }

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      const response = await templatesApi.sync()
      toast({ title: `Synced ${response.data.synced} templates from Meta` })
      loadTemplates()
    } catch (error: any) {
      toast({
        title: 'Sync failed',
        description: error.response?.data?.error || 'Could not reach Meta API',
        variant: 'destructive',
      })
    } finally {
      setIsSyncing(false)
    }
  }

  const handleSubmit = async (id: string) => {
    try {
      const response = await templatesApi.submit(id)
      const submittedToMeta = response.data?.submittedToMeta
      toast({
        title: submittedToMeta
          ? 'Template submitted to WhatsApp for approval'
          : 'Template submitted (no WA credentials configured)',
      })
      loadTemplates()
    } catch (error: any) {
      toast({
        title: 'Failed to submit',
        description: error.response?.data?.error,
        variant: 'destructive',
      })
    }
  }

  const categories = ['MARKETING', 'UTILITY', 'AUTHENTICATION']
  const statuses = ['pending', 'approved', 'rejected', 'draft']

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Templates</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage your WhatsApp message templates</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-1.5" onClick={handleSync} disabled={isSyncing}>
              <RefreshCw className={cn('w-4 h-4', isSyncing && 'animate-spin')} />
              {isSyncing ? 'Syncing...' : 'Sync from Meta'}
            </Button>
            <Button className="gap-1.5" onClick={() => { setEditingTemplate(null); setShowModal(true) }}>
              <Plus className="w-4 h-4" />
              New Template
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mt-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn(
                'flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors',
                filterCategory ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              )}>
                <Filter className="w-3.5 h-3.5" />
                {filterCategory || 'Category'}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setFilterCategory('')}>All Categories</DropdownMenuItem>
              {categories.map((c) => (
                <DropdownMenuItem key={c} onClick={() => setFilterCategory(c)}>{c}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn(
                'flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors',
                filterStatus ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              )}>
                <Filter className="w-3.5 h-3.5" />
                {filterStatus ? filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1) : 'Status'}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setFilterStatus('')}>All Statuses</DropdownMenuItem>
              {statuses.map((s) => (
                <DropdownMenuItem key={s} onClick={() => setFilterStatus(s)}>{s.charAt(0).toUpperCase() + s.slice(1)}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Template grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-white rounded-xl border border-gray-100 animate-pulse" />
            ))}
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-gray-600 font-medium">No templates yet</p>
            <p className="text-gray-400 text-sm mt-1">Create message templates for WhatsApp</p>
            <Button className="mt-4" onClick={() => setShowModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New Template
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
            {templates.map((template) => (
              <div key={template.id} className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm truncate">{template.name}</h3>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                        {template.category}
                      </span>
                      <span className="text-xs text-gray-400">{template.language}</span>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', getTemplateStatusColor(template.status))}>
                        {template.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 ml-2 flex-shrink-0">
                    <button
                      onClick={() => { setEditingTemplate(template); setShowModal(true) }}
                      className="p-1 rounded hover:bg-gray-100"
                    >
                      <Edit className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                    <button
                      onClick={() => handleDelete(template.id)}
                      className="p-1 rounded hover:bg-gray-100"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                    </button>
                  </div>
                </div>

                {/* Body preview */}
                <div className="bg-gray-50 rounded-lg p-2.5 mb-3">
                  <p className="text-xs text-gray-600 line-clamp-3">{template.body}</p>
                </div>

                {/* Footer & buttons */}
                {template.buttons?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {template.buttons.map((btn, i) => (
                      <span key={i} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-200">
                        {btn.text}
                      </span>
                    ))}
                  </div>
                )}

                {(template.status === 'draft' || (template.status === 'pending' && !template.waTemplateId)) && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full h-7 text-xs gap-1"
                    onClick={() => handleSubmit(template.id)}
                  >
                    <Send className="w-3 h-3" />
                    Submit to WhatsApp
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <TemplateModal
        open={showModal}
        onClose={() => setShowModal(false)}
        template={editingTemplate}
        onSaved={loadTemplates}
      />
    </div>
  )
}
