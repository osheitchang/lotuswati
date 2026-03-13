'use client'

import { useState, useEffect } from 'react'
import { Plus, Zap, Edit, Trash2, Play, ArrowRight } from 'lucide-react'
import { automationsApi } from '@/lib/api'
import { Automation } from '@/types'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { AutomationModal } from './AutomationModal'
import { cn } from '@/lib/utils'
import { toast } from '@/components/ui/use-toast'

const TRIGGER_LABELS: Record<string, string> = {
  keyword: 'Keyword received',
  new_conversation: 'New conversation',
  no_reply: 'No reply',
  label_added: 'Label added',
  resolved: 'Conversation resolved',
}

const ACTION_LABELS: Record<string, string> = {
  send_message: 'Send message',
  assign_agent: 'Assign agent',
  add_label: 'Add label',
  resolve: 'Resolve',
  send_template: 'Send template',
}

export function AutomationList() {
  const [automations, setAutomations] = useState<Automation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null)

  const loadAutomations = async () => {
    setIsLoading(true)
    try {
      const response = await automationsApi.list()
      setAutomations(response.data.automations || response.data || [])
    } catch {
      toast({ title: 'Failed to load automations', variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadAutomations()
  }, [])

  const handleToggle = async (automation: Automation) => {
    try {
      await automationsApi.toggle(automation.id, !automation.isActive)
      setAutomations(automations.map((a) =>
        a.id === automation.id ? { ...a, isActive: !a.isActive } : a
      ))
    } catch {
      toast({ title: 'Failed to toggle', variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this automation?')) return
    try {
      await automationsApi.delete(id)
      toast({ title: 'Automation deleted' })
      loadAutomations()
    } catch {
      toast({ title: 'Failed to delete', variant: 'destructive' })
    }
  }

  const getTriggerDescription = (auto: Automation) => {
    const label = TRIGGER_LABELS[auto.trigger?.type] || auto.trigger?.type
    if (auto.trigger?.type === 'keyword' && auto.trigger.keywords?.length) {
      return `${label}: "${auto.trigger.keywords.slice(0, 3).join('", "')}"`
    }
    if (auto.trigger?.type === 'no_reply') {
      return `${label} ${auto.trigger.minutes || '?'} minutes`
    }
    return label
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Automations</h1>
            <p className="text-sm text-gray-500 mt-0.5">Automate repetitive tasks and workflows</p>
          </div>
          <Button className="gap-1.5" onClick={() => { setEditingAutomation(null); setShowModal(true) }}>
            <Plus className="w-4 h-4" />
            New Automation
          </Button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        {isLoading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-white rounded-xl border border-gray-100 animate-pulse" />
          ))
        ) : automations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
              <Zap className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-gray-600 font-medium">No automations yet</p>
            <p className="text-gray-400 text-sm mt-1">Create automations to handle conversations automatically</p>
            <Button className="mt-4" onClick={() => setShowModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New Automation
            </Button>
          </div>
        ) : (
          automations.map((automation) => (
            <div
              key={automation.id}
              className={cn(
                'bg-white rounded-xl border p-4 transition-all',
                automation.isActive ? 'border-gray-100 shadow-sm' : 'border-gray-100 opacity-70'
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn(
                      'w-8 h-8 rounded-xl flex items-center justify-center',
                      automation.isActive ? 'bg-primary-100' : 'bg-gray-100'
                    )}>
                      <Zap className={cn('w-4 h-4', automation.isActive ? 'text-primary-600' : 'text-gray-400')} />
                    </div>
                    <h3 className="font-semibold text-gray-900">{automation.name}</h3>
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full font-medium',
                      automation.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    )}>
                      {automation.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {/* Flow preview */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-100 text-orange-700 text-xs px-2.5 py-1 rounded-lg">
                      <span className="font-medium">When:</span>
                      {getTriggerDescription(automation)}
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-gray-300" />
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {automation.actions?.slice(0, 3).map((action, i) => (
                        <div key={i} className="flex items-center gap-1">
                          <div className="flex items-center gap-1.5 bg-primary-50 border border-primary-100 text-primary-700 text-xs px-2.5 py-1 rounded-lg">
                            {ACTION_LABELS[action.type] || action.type}
                          </div>
                          {i < automation.actions.length - 1 && i < 2 && (
                            <ArrowRight className="w-3 h-3 text-gray-200" />
                          )}
                        </div>
                      ))}
                      {automation.actions?.length > 3 && (
                        <span className="text-xs text-gray-400">+{automation.actions.length - 3} more</span>
                      )}
                    </div>
                  </div>

                  {automation.runCount > 0 && (
                    <p className="text-xs text-gray-400 mt-2">
                      <Play className="w-3 h-3 inline mr-1" />
                      Ran {automation.runCount} times
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 ml-4">
                  <Switch
                    checked={automation.isActive}
                    onCheckedChange={() => handleToggle(automation)}
                  />
                  <button
                    onClick={() => { setEditingAutomation(automation); setShowModal(true) }}
                    className="p-1.5 rounded hover:bg-gray-100"
                  >
                    <Edit className="w-4 h-4 text-gray-400" />
                  </button>
                  <button
                    onClick={() => handleDelete(automation.id)}
                    className="p-1.5 rounded hover:bg-gray-100"
                  >
                    <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <AutomationModal
        open={showModal}
        onClose={() => setShowModal(false)}
        automation={editingAutomation}
        onSaved={loadAutomations}
      />
    </div>
  )
}
