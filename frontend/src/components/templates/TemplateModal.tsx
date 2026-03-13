'use client'

import { useState, useEffect } from 'react'
import { Plus, X, Smartphone } from 'lucide-react'
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
import { templatesApi } from '@/lib/api'
import { Template, TemplateButton } from '@/types'
import { toast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

interface TemplateModalProps {
  open: boolean
  onClose: () => void
  template?: Template | null
  onSaved: () => void
}

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'id', name: 'Indonesian' },
  { code: 'es', name: 'Spanish' },
  { code: 'pt_BR', name: 'Portuguese (BR)' },
  { code: 'fr', name: 'French' },
  { code: 'ar', name: 'Arabic' },
]

export function TemplateModal({ open, onClose, template, onSaved }: TemplateModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    category: 'MARKETING' as 'MARKETING' | 'UTILITY' | 'AUTHENTICATION',
    language: 'en',
    headerType: 'none' as 'none' | 'text' | 'image' | 'video' | 'document',
    headerValue: '',
    body: '',
    footer: '',
    buttons: [] as TemplateButton[],
  })
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name,
        category: template.category,
        language: template.language,
        headerType: (template.headerType || 'none') as any,
        headerValue: template.headerValue || '',
        body: template.body,
        footer: template.footer || '',
        buttons: template.buttons || [],
      })
    } else {
      setFormData({
        name: '',
        category: 'MARKETING',
        language: 'en',
        headerType: 'none',
        headerValue: '',
        body: '',
        footer: '',
        buttons: [],
      })
    }
  }, [template, open])

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.body.trim()) {
      toast({ title: 'Name and body are required', variant: 'destructive' })
      return
    }
    setIsSaving(true)
    try {
      const payload = {
        ...formData,
        headerType: formData.headerType === 'none' ? undefined : formData.headerType,
        headerValue: formData.headerType !== 'none' ? formData.headerValue : undefined,
        footer: formData.footer || undefined,
      }
      if (template) {
        await templatesApi.update(template.id, payload)
        toast({ title: 'Template updated' })
      } else {
        await templatesApi.create(payload)
        toast({ title: 'Template created' })
      }
      onSaved()
      onClose()
    } catch (error: any) {
      toast({
        title: 'Failed to save template',
        description: error.response?.data?.message || 'An error occurred',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const addButton = (type: TemplateButton['type']) => {
    if (formData.buttons.length >= 3) return
    setFormData({
      ...formData,
      buttons: [...formData.buttons, { type, text: '', url: type === 'url' ? '' : undefined, phone_number: type === 'phone_number' ? '' : undefined }],
    })
  }

  const updateButton = (index: number, updates: Partial<TemplateButton>) => {
    const newButtons = [...formData.buttons]
    newButtons[index] = { ...newButtons[index], ...updates }
    setFormData({ ...formData, buttons: newButtons })
  }

  const removeButton = (index: number) => {
    setFormData({ ...formData, buttons: formData.buttons.filter((_, i) => i !== index) })
  }

  // Preview rendering
  const previewBody = formData.body.replace(/\{\{(\d+)\}\}/g, (_, n) => `[Variable ${n}]`)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{template ? 'Edit Template' : 'Create Template'}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex gap-4">
          {/* Form */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Template Name *</Label>
                <Input
                  placeholder="e.g. welcome_message"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                  className="mt-1"
                />
                <p className="text-xs text-gray-400 mt-0.5">Lowercase, no spaces</p>
              </div>
              <div>
                <Label>Category</Label>
                <Select value={formData.category} onValueChange={(v: any) => setFormData({ ...formData, category: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MARKETING">Marketing</SelectItem>
                    <SelectItem value="UTILITY">Utility</SelectItem>
                    <SelectItem value="AUTHENTICATION">Authentication</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Language</Label>
              <Select value={formData.language} onValueChange={(v) => setFormData({ ...formData, language: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Header */}
            <div>
              <Label>Header (optional)</Label>
              <Select value={formData.headerType} onValueChange={(v: any) => setFormData({ ...formData, headerType: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="image">Image URL</SelectItem>
                  <SelectItem value="video">Video URL</SelectItem>
                  <SelectItem value="document">Document URL</SelectItem>
                </SelectContent>
              </Select>
              {formData.headerType !== 'none' && (
                <Input
                  placeholder={formData.headerType === 'text' ? 'Header text...' : 'Media URL...'}
                  value={formData.headerValue}
                  onChange={(e) => setFormData({ ...formData, headerValue: e.target.value })}
                  className="mt-2"
                />
              )}
            </div>

            {/* Body */}
            <div>
              <div className="flex items-center justify-between">
                <Label>Body *</Label>
                <span className={cn('text-xs', formData.body.length > 1024 ? 'text-red-500' : 'text-gray-400')}>
                  {formData.body.length}/1024
                </span>
              </div>
              <Textarea
                placeholder="Hello {{1}}, your order {{2}} is ready!"
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                className="mt-1 min-h-[100px]"
                maxLength={1024}
              />
              <p className="text-xs text-gray-400 mt-1">Use {'{{1}}'}, {'{{2}}'} for variables</p>
            </div>

            {/* Footer */}
            <div>
              <Label>Footer (optional)</Label>
              <Input
                placeholder="Footer text..."
                value={formData.footer}
                onChange={(e) => setFormData({ ...formData, footer: e.target.value })}
                className="mt-1"
                maxLength={60}
              />
            </div>

            {/* Buttons */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Buttons (max 3)</Label>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => addButton('quick_reply')}
                    disabled={formData.buttons.length >= 3}
                  >
                    + Quick Reply
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => addButton('url')}
                    disabled={formData.buttons.length >= 3}
                  >
                    + URL
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => addButton('phone_number')}
                    disabled={formData.buttons.length >= 3}
                  >
                    + Phone
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                {formData.buttons.map((btn, i) => (
                  <div key={i} className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1 space-y-2">
                      <Input
                        placeholder="Button text"
                        value={btn.text}
                        onChange={(e) => updateButton(i, { text: e.target.value })}
                        className="h-8 text-sm"
                      />
                      {btn.type === 'url' && (
                        <Input
                          placeholder="https://..."
                          value={btn.url || ''}
                          onChange={(e) => updateButton(i, { url: e.target.value })}
                          className="h-8 text-sm"
                        />
                      )}
                      {btn.type === 'phone_number' && (
                        <Input
                          placeholder="+1234567890"
                          value={btn.phone_number || ''}
                          onChange={(e) => updateButton(i, { phone_number: e.target.value })}
                          className="h-8 text-sm"
                        />
                      )}
                      <span className="text-xs text-gray-400 capitalize">{btn.type.replace('_', ' ')}</span>
                    </div>
                    <button onClick={() => removeButton(i)} className="p-1 rounded hover:bg-gray-200">
                      <X className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="w-56 flex-shrink-0">
            <p className="text-xs font-medium text-gray-500 mb-3 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5" /> Phone Preview
            </p>
            <div className="bg-gray-800 rounded-3xl p-3 shadow-xl">
              <div className="bg-[#ECE5DD] rounded-2xl overflow-hidden min-h-64 p-3">
                <div className="bg-white rounded-xl shadow-sm p-3 max-w-[90%]">
                  {formData.headerType === 'text' && formData.headerValue && (
                    <p className="text-sm font-bold mb-1">{formData.headerValue}</p>
                  )}
                  {formData.headerType === 'image' && (
                    <div className="h-24 bg-gray-200 rounded-lg mb-2 flex items-center justify-center text-xs text-gray-400">Image</div>
                  )}
                  <p className="text-xs text-gray-700 whitespace-pre-wrap">{previewBody || 'Message body will appear here...'}</p>
                  {formData.footer && (
                    <p className="text-xs text-gray-400 mt-1 border-t border-gray-100 pt-1">{formData.footer}</p>
                  )}
                  <p className="text-right text-gray-400 mt-1" style={{ fontSize: '10px' }}>12:00 PM</p>
                </div>
                {formData.buttons.map((btn, i) => (
                  <div key={i} className="bg-white rounded-lg shadow-sm mt-1 p-2 text-center max-w-[90%]">
                    <span className="text-xs text-blue-600 font-medium">{btn.text || `Button ${i + 1}`}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : template ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
