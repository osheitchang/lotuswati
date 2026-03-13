'use client'

import { useState, useEffect } from 'react'
import { Plus, X, ArrowDown } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { automationsApi, templatesApi } from '@/lib/api'
import { useAppStore } from '@/store/appStore'
import { Automation, AutomationTrigger, AutomationAction, Template } from '@/types'
import { toast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

interface AutomationModalProps {
  open: boolean
  onClose: () => void
  automation?: Automation | null
  onSaved: () => void
}

const TRIGGER_TYPES = [
  { value: 'keyword', label: 'Keyword Received' },
  { value: 'new_conversation', label: 'New Conversation Started' },
  { value: 'no_reply', label: 'No Reply for X minutes' },
  { value: 'label_added', label: 'Label Added' },
  { value: 'resolved', label: 'Conversation Resolved' },
]

const ACTION_TYPES = [
  { value: 'send_message', label: 'Send Message' },
  { value: 'assign_agent', label: 'Assign to Agent' },
  { value: 'add_label', label: 'Add Label' },
  { value: 'resolve', label: 'Resolve Conversation' },
  { value: 'send_template', label: 'Send Template' },
]

export function AutomationModal({ open, onClose, automation, onSaved }: AutomationModalProps) {
  const { labels, agents } = useAppStore()
  const [name, setName] = useState('')
  const [trigger, setTrigger] = useState<AutomationTrigger>({ type: 'keyword', keywords: [] })
  const [actions, setActions] = useState<AutomationAction[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [keywordInput, setKeywordInput] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (automation) {
      setName(automation.name)
      setTrigger(automation.trigger)
      setActions(automation.actions || [])
    } else {
      setName('')
      setTrigger({ type: 'keyword', keywords: [] })
      setActions([])
    }
  }, [automation, open])

  useEffect(() => {
    if (open) {
      templatesApi.list({ status: 'approved' }).then((r) => {
        setTemplates(r.data.templates || r.data || [])
      }).catch(() => {})
    }
  }, [open])

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' })
      return
    }
    if (actions.length === 0) {
      toast({ title: 'At least one action is required', variant: 'destructive' })
      return
    }
    setIsSaving(true)
    try {
      if (automation) {
        await automationsApi.update(automation.id, { name, trigger, actions })
        toast({ title: 'Automation updated' })
      } else {
        await automationsApi.create({ name, trigger, actions })
        toast({ title: 'Automation created' })
      }
      onSaved()
      onClose()
    } catch (error: any) {
      toast({
        title: 'Failed to save',
        description: error.response?.data?.message || 'An error occurred',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const addAction = () => {
    setActions([...actions, { type: 'send_message', message: '' }])
  }

  const updateAction = (index: number, updates: Partial<AutomationAction>) => {
    const newActions = [...actions]
    newActions[index] = { ...newActions[index], ...updates }
    setActions(newActions)
  }

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index))
  }

  const addKeyword = () => {
    const kw = keywordInput.trim()
    if (kw && !trigger.keywords?.includes(kw)) {
      setTrigger({ ...trigger, keywords: [...(trigger.keywords || []), kw] })
    }
    setKeywordInput('')
  }

  const removeKeyword = (kw: string) => {
    setTrigger({ ...trigger, keywords: trigger.keywords?.filter((k) => k !== kw) })
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{automation ? 'Edit Automation' : 'Create Automation'}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 py-2 pr-2">
          {/* Name */}
          <div>
            <Label>Automation Name *</Label>
            <Input
              placeholder="e.g. Welcome New Contact"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1"
            />
          </div>

          {/* Trigger */}
          <div className="border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-orange-600">T</span>
              </div>
              <Label className="text-sm font-semibold text-gray-800">Trigger</Label>
            </div>
            <Select
              value={trigger.type}
              onValueChange={(v: any) => setTrigger({ type: v })}
            >
              <SelectTrigger className="mb-3">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {trigger.type === 'keyword' && (
              <div>
                <Label className="text-xs text-gray-600">Keywords (comma-separated)</Label>
                <div className="flex flex-wrap gap-1.5 mt-1 mb-2">
                  {trigger.keywords?.map((kw) => (
                    <span key={kw} className="flex items-center gap-1 text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full border border-orange-200">
                      {kw}
                      <button onClick={() => removeKeyword(kw)} className="hover:text-orange-900">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="hi, hello, hey..."
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeyword() } }}
                    className="h-8 text-sm"
                  />
                  <Button size="sm" variant="outline" onClick={addKeyword} className="h-8">Add</Button>
                </div>
              </div>
            )}

            {trigger.type === 'no_reply' && (
              <div>
                <Label className="text-xs text-gray-600">Minutes without reply</Label>
                <Input
                  type="number"
                  value={trigger.minutes || ''}
                  onChange={(e) => setTrigger({ ...trigger, minutes: parseInt(e.target.value) })}
                  placeholder="e.g. 30"
                  className="mt-1 w-32"
                  min={1}
                />
              </div>
            )}

            {trigger.type === 'label_added' && (
              <div>
                <Label className="text-xs text-gray-600">When label is added</Label>
                <Select
                  value={trigger.labelId || ''}
                  onValueChange={(v) => setTrigger({ ...trigger, labelId: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select label..." />
                  </SelectTrigger>
                  <SelectContent>
                    {labels.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Actions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-sm font-semibold text-gray-800">Actions</Label>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={addAction}
              >
                <Plus className="w-3 h-3" />
                Add Action
              </Button>
            </div>

            {actions.length === 0 ? (
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center">
                <p className="text-sm text-gray-400">No actions yet. Add an action to define what happens when the trigger fires.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {actions.map((action, i) => (
                  <div key={i}>
                    {i > 0 && (
                      <div className="flex justify-center my-1">
                        <ArrowDown className="w-4 h-4 text-gray-300" />
                      </div>
                    )}
                    <div className="border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-semibold text-primary-600">{i + 1}</span>
                        </div>
                        <Select
                          value={action.type}
                          onValueChange={(v: any) => updateAction(i, { type: v })}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ACTION_TYPES.map((t) => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <button
                          onClick={() => removeAction(i)}
                          className="p-1 rounded hover:bg-gray-100"
                        >
                          <X className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>

                      {action.type === 'send_message' && (
                        <Textarea
                          placeholder="Message to send..."
                          value={action.message || ''}
                          onChange={(e) => updateAction(i, { message: e.target.value })}
                          className="min-h-[60px] text-sm"
                        />
                      )}

                      {action.type === 'assign_agent' && (
                        <Select
                          value={action.agentId || ''}
                          onValueChange={(v) => updateAction(i, { agentId: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select agent..." />
                          </SelectTrigger>
                          <SelectContent>
                            {agents.map((a) => (
                              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      {action.type === 'add_label' && (
                        <Select
                          value={action.labelId || ''}
                          onValueChange={(v) => updateAction(i, { labelId: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select label..." />
                          </SelectTrigger>
                          <SelectContent>
                            {labels.map((l) => (
                              <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      {action.type === 'send_template' && (
                        <Select
                          value={action.templateId || ''}
                          onValueChange={(v) => updateAction(i, { templateId: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select template..." />
                          </SelectTrigger>
                          <SelectContent>
                            {templates.map((t) => (
                              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      {action.type === 'resolve' && (
                        <p className="text-xs text-gray-500">The conversation will be marked as resolved.</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : automation ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
