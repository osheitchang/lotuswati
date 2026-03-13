'use client'

import { useState, useEffect } from 'react'
import { ChevronRight, ChevronLeft, Check, Send, Clock } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { broadcastsApi, templatesApi } from '@/lib/api'
import { Template } from '@/types'
import { toast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

interface CreateBroadcastModalProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

const STEPS = ['Setup', 'Audience', 'Schedule']

export function CreateBroadcastModal({ open, onClose, onCreated }: CreateBroadcastModalProps) {
  const [step, setStep] = useState(0)
  const [templates, setTemplates] = useState<Template[]>([])
  const [formData, setFormData] = useState({
    name: '',
    messageType: 'template' as 'template' | 'direct',
    templateId: '',
    message: '',
    audienceType: 'all' as 'all' | 'tag' | 'manual',
    tags: [] as string[],
    contactIds: [] as string[],
    scheduleType: 'now' as 'now' | 'scheduled',
    scheduledAt: '',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [tagInput, setTagInput] = useState('')

  useEffect(() => {
    if (open) {
      templatesApi.list({ status: 'approved' }).then((r) => {
        setTemplates(r.data.templates || r.data || [])
      }).catch(() => {})
    }
  }, [open])

  const selectedTemplate = templates.find((t) => t.id === formData.templateId)

  const handleCreate = async () => {
    setIsSaving(true)
    try {
      const payload = {
        name: formData.name,
        templateId: formData.messageType === 'template' ? formData.templateId : undefined,
        message: formData.messageType === 'direct' ? formData.message : undefined,
        tags: formData.audienceType === 'tag' ? formData.tags : undefined,
        contactIds: formData.audienceType === 'manual' ? formData.contactIds : undefined,
      }
      const response = await broadcastsApi.create(payload)
      const broadcast = response.data.broadcast || response.data

      if (formData.scheduleType === 'now') {
        await broadcastsApi.send(broadcast.id)
        toast({ title: 'Broadcast sent!' })
      } else if (formData.scheduledAt) {
        await broadcastsApi.schedule(broadcast.id, formData.scheduledAt)
        toast({ title: 'Broadcast scheduled!' })
      }

      onCreated()
      onClose()
      setStep(0)
      setFormData({
        name: '',
        messageType: 'template',
        templateId: '',
        message: '',
        audienceType: 'all',
        tags: [],
        contactIds: [],
        scheduleType: 'now',
        scheduledAt: '',
      })
    } catch (error: any) {
      toast({
        title: 'Failed to create broadcast',
        description: error.response?.data?.message || 'An error occurred',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const canProceed = () => {
    if (step === 0) {
      return formData.name.trim() && (
        (formData.messageType === 'template' && formData.templateId) ||
        (formData.messageType === 'direct' && formData.message.trim())
      )
    }
    if (step === 1) return true
    return true
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Create Broadcast</DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 py-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={cn(
                'flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold',
                i < step ? 'bg-primary-500 text-white' :
                i === step ? 'bg-primary-100 text-primary-700 border-2 border-primary-500' :
                'bg-gray-100 text-gray-400'
              )}>
                {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className={cn('text-sm', i === step ? 'text-primary-700 font-medium' : 'text-gray-400')}>
                {s}
              </span>
              {i < STEPS.length - 1 && <div className="w-8 h-px bg-gray-200" />}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {/* Step 1: Setup */}
          {step === 0 && (
            <div className="space-y-4 px-1">
              <div>
                <Label>Broadcast Name *</Label>
                <Input
                  placeholder="e.g. Holiday Promotion 2024"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Message Type</Label>
                <div className="flex gap-3 mt-1">
                  {(['template', 'direct'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setFormData({ ...formData, messageType: type })}
                      className={cn(
                        'flex-1 py-2.5 px-4 rounded-lg border-2 text-sm font-medium transition-all',
                        formData.messageType === type
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      )}
                    >
                      {type === 'template' ? 'WhatsApp Template' : 'Direct Message'}
                    </button>
                  ))}
                </div>
              </div>

              {formData.messageType === 'template' ? (
                <div>
                  <Label>Select Template *</Label>
                  <Select
                    value={formData.templateId}
                    onValueChange={(v) => setFormData({ ...formData, templateId: v })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Choose a template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedTemplate && (
                    <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-xs font-medium text-gray-500 mb-1">Preview:</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedTemplate.body}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <Label>Message *</Label>
                  <Textarea
                    placeholder="Write your message..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="mt-1 min-h-[100px]"
                  />
                  <p className="text-xs text-gray-400 text-right mt-1">{formData.message.length}/1024</p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Audience */}
          {step === 1 && (
            <div className="space-y-4 px-1">
              <div>
                <Label>Select Audience</Label>
                <div className="space-y-2 mt-1">
                  {([
                    { value: 'all', label: 'All Contacts', desc: 'Send to all your contacts' },
                    { value: 'tag', label: 'By Tag', desc: 'Target specific contact groups' },
                  ] as const).map((opt) => (
                    <label
                      key={opt.value}
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all',
                        formData.audienceType === opt.value
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <input
                        type="radio"
                        name="audience"
                        value={opt.value}
                        checked={formData.audienceType === opt.value}
                        onChange={() => setFormData({ ...formData, audienceType: opt.value })}
                        className="mt-0.5"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-800">{opt.label}</p>
                        <p className="text-xs text-gray-500">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {formData.audienceType === 'tag' && (
                <div>
                  <Label>Tags</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1 mb-2">
                    {formData.tags.map((tag) => (
                      <span key={tag} className="flex items-center gap-1 text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full">
                        {tag}
                        <button onClick={() => setFormData({ ...formData, tags: formData.tags.filter(t => t !== tag) })}>×</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add tag..."
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          if (tagInput.trim()) {
                            setFormData({ ...formData, tags: [...formData.tags, tagInput.trim()] })
                            setTagInput('')
                          }
                        }
                      }}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Schedule */}
          {step === 2 && (
            <div className="space-y-4 px-1">
              <div className="space-y-2">
                {([
                  { value: 'now', label: 'Send Now', desc: 'Broadcast will be sent immediately', icon: Send },
                  { value: 'scheduled', label: 'Schedule for Later', desc: 'Pick a date and time', icon: Clock },
                ] as const).map((opt) => (
                  <label
                    key={opt.value}
                    className={cn(
                      'flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all',
                      formData.scheduleType === opt.value
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <input
                      type="radio"
                      name="schedule"
                      value={opt.value}
                      checked={formData.scheduleType === opt.value}
                      onChange={() => setFormData({ ...formData, scheduleType: opt.value })}
                      className="mt-1"
                    />
                    <opt.icon className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-800">{opt.label}</p>
                      <p className="text-xs text-gray-500">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>

              {formData.scheduleType === 'scheduled' && (
                <div>
                  <Label>Schedule Date & Time</Label>
                  <Input
                    type="datetime-local"
                    value={formData.scheduledAt}
                    onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                    className="mt-1"
                    min={new Date().toISOString().slice(0, 16)}
                  />
                </div>
              )}

              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-2">
                <p className="font-medium text-gray-700">Summary</p>
                <div className="flex justify-between text-gray-600">
                  <span>Name:</span><span className="font-medium">{formData.name}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Message:</span>
                  <span className="font-medium">
                    {formData.messageType === 'template' ? selectedTemplate?.name || 'Template' : 'Direct message'}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Audience:</span>
                  <span className="font-medium capitalize">{formData.audienceType === 'tag' ? `Tags: ${formData.tags.join(', ')}` : formData.audienceType}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <Button
            variant="outline"
            onClick={() => step === 0 ? onClose() : setStep(step - 1)}
          >
            {step === 0 ? 'Cancel' : <><ChevronLeft className="w-4 h-4 mr-1" /> Back</>}
          </Button>
          {step < 2 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canProceed()}>
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving ? 'Creating...' : formData.scheduleType === 'now' ? 'Send Now' : 'Schedule'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
