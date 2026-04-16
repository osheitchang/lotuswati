'use client'

import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import {
  Send,
  Paperclip,
  FileText,
  StickyNote,
  Smile,
  X,
  Image,
  File,
  Music,
  Video,
  Loader2,
} from 'lucide-react'
import { useInboxStore } from '@/store/inboxStore'
import { useAppStore } from '@/store/appStore'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from '@/components/ui/use-toast'
import { CannedResponse, Template } from '@/types'
import { templatesApi, mediaApi, conversationsApi } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { AlertCircle } from 'lucide-react'

interface MessageInputProps {
  conversationId: string
}

const COMMON_EMOJIS = ['😊', '👍', '❤️', '😂', '🙏', '✅', '🔥', '👋', '😍', '🎉', '💪', '✨', '🙌', '💯', '😅']

const ACCEPT_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/aac',
  'video/mp4', 'video/3gpp', 'video/quicktime', 'video/webm',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
  'application/zip',
].join(',')

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <Image className="w-4 h-4" />
  if (mimeType.startsWith('audio/')) return <Music className="w-4 h-4" />
  if (mimeType.startsWith('video/')) return <Video className="w-4 h-4" />
  return <File className="w-4 h-4" />
}

function getMessageType(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (mimeType.startsWith('video/')) return 'video'
  return 'file'
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface PendingFile {
  file: File
  preview?: string // for images
}

/** Extract {{1}}, {{2}}, … variable indices from a template body */
function extractVariables(body: string): number[] {
  const matches = body.match(/\{\{(\d+)\}\}/g) || []
  const indices = matches.map((m) => parseInt(m.replace(/\{\{|\}\}/g, ''), 10))
  return Array.from(new Set(indices)).sort((a, b) => a - b)
}

/** Replace {{1}}, {{2}}, … with provided values */
function resolveVariables(body: string, values: Record<number, string>): string {
  return body.replace(/\{\{(\d+)\}\}/g, (_, idx) => values[parseInt(idx, 10)] ?? `{{${idx}}}`)
}

export function MessageInput({ conversationId }: MessageInputProps) {
  const { sendMessage, loadMessages, messages } = useInboxStore()
  const { cannedResponses } = useAppStore()
  const [content, setContent] = useState('')
  const [isNote, setIsNote] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [showCannedResponses, setShowCannedResponses] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [templateVars, setTemplateVars] = useState<Record<number, string>>({})
  const [cannedFilter, setCannedFilter] = useState('')
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const conversationMessages = messages[conversationId] || []
  const hasNoOutboundMessages = conversationMessages.length === 0 ||
    conversationMessages.every((m) => m.fromType === 'contact')

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px'
    }
  }, [content])

  // Detect "/" for canned responses
  useEffect(() => {
    if (content.startsWith('/')) {
      setShowCannedResponses(true)
      setCannedFilter(content.slice(1))
    } else {
      setShowCannedResponses(false)
    }
  }, [content])

  const filteredCanned = cannedResponses.filter(
    (cr) =>
      cr.shortcut.toLowerCase().includes(cannedFilter.toLowerCase()) ||
      cr.content.toLowerCase().includes(cannedFilter.toLowerCase())
  )

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 16 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Maximum file size is 16MB', variant: 'destructive' })
      return
    }

    const pending: PendingFile = { file }
    if (file.type.startsWith('image/')) {
      pending.preview = URL.createObjectURL(file)
    }
    setPendingFile(pending)
    // Reset the input so the same file can be re-selected
    e.target.value = ''
  }

  const clearPendingFile = () => {
    if (pendingFile?.preview) URL.revokeObjectURL(pendingFile.preview)
    setPendingFile(null)
    setUploadProgress(null)
  }

  const handleSendFile = async () => {
    if (!pendingFile || isSending) return

    setIsSending(true)
    setUploadProgress(0)

    try {
      const formData = new FormData()
      formData.append('file', pendingFile.file)

      // Simulate progress while uploading (axios doesn't expose upload progress easily through our wrapper)
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => (prev !== null && prev < 85 ? prev + 10 : prev))
      }, 200)

      const response = await mediaApi.uploadMedia(formData)
      clearInterval(progressInterval)
      setUploadProgress(100)

      const { url, mimeType } = response.data
      const msgType = getMessageType(mimeType)

      await sendMessage(conversationId, content.trim() || undefined, msgType, false, url)

      setContent('')
      clearPendingFile()
      textareaRef.current?.focus()
    } catch (error: any) {
      toast({
        title: 'Failed to send file',
        description: error.response?.data?.error || error.response?.data?.message || 'An error occurred',
        variant: 'destructive',
      })
      setUploadProgress(null)
    } finally {
      setIsSending(false)
    }
  }

  const handleSend = async () => {
    if (pendingFile) {
      await handleSendFile()
      return
    }

    const trimmed = content.trim()
    if (!trimmed || isSending) return

    setIsSending(true)
    try {
      await sendMessage(conversationId, trimmed, 'text', isNote)
      setContent('')
      setIsNote(false)
      textareaRef.current?.focus()
    } catch (error: any) {
      toast({
        title: 'Failed to send message',
        description: error.response?.data?.message || 'An error occurred',
        variant: 'destructive',
      })
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const insertCannedResponse = (cr: CannedResponse) => {
    setContent(cr.content)
    setShowCannedResponses(false)
    textareaRef.current?.focus()
  }

  const insertEmoji = (emoji: string) => {
    setContent((prev) => prev + emoji)
    setShowEmojiPicker(false)
    textareaRef.current?.focus()
  }

  const handleTemplateSelect = (template: Template) => {
    const vars = extractVariables(template.body)
    setSelectedTemplate(template)
    setTemplateVars(Object.fromEntries(vars.map((i) => [i, ''])))
    setShowTemplates(false)
  }

  const handleSendTemplate = async () => {
    if (!selectedTemplate) return
    setIsSending(true)
    try {
      const variableIndices = extractVariables(selectedTemplate.body)
      const bodyParams = variableIndices.map((i) => ({ type: 'text', text: templateVars[i] ?? '' }))
      const components = bodyParams.length > 0
        ? [{ type: 'body', parameters: bodyParams }]
        : []

      await conversationsApi.sendMessage(conversationId, {
        type: 'template',
        templateName: selectedTemplate.name,
        language: selectedTemplate.language,
        components,
      })
      await loadMessages(conversationId)
      setSelectedTemplate(null)
      setTemplateVars({})
      toast({ title: 'Template sent' })
    } catch (error: any) {
      toast({
        title: 'Failed to send template',
        description: error.response?.data?.error || error.response?.data?.message || 'An error occurred',
        variant: 'destructive',
      })
    } finally {
      setIsSending(false)
    }
  }

  const loadTemplates = async () => {
    if (templates.length > 0) {
      setShowTemplates(true)
      return
    }
    try {
      const response = await templatesApi.list({ status: 'approved' })
      setTemplates(response.data.templates || response.data || [])
      setShowTemplates(true)
    } catch {
      toast({ title: 'Failed to load templates', variant: 'destructive' })
    }
  }

  const canSend = pendingFile ? !isSending : (!!content.trim() && !isSending)

  return (
    <div className={cn(
      'border-t bg-white',
      isNote && 'bg-yellow-50 border-yellow-200'
    )}>
      {/* No-outbound-messages notice */}
      {hasNoOutboundMessages && (
        <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border-b border-amber-200">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-amber-800 font-medium">This customer hasn't messaged you yet.</p>
            <p className="text-xs text-amber-700 mt-0.5">WhatsApp requires an approved template to initiate a conversation.</p>
          </div>
          <button
            onClick={() => { loadTemplates(); setShowEmojiPicker(false) }}
            className="flex-shrink-0 text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            Use Template
          </button>
        </div>
      )}

      {/* Note indicator */}
      {isNote && (
        <div className="flex items-center gap-2 px-4 pt-2 text-xs text-yellow-700">
          <StickyNote className="w-3.5 h-3.5" />
          Sending as internal note — not visible to contact
        </div>
      )}

      {/* Canned responses popup */}
      {showCannedResponses && filteredCanned.length > 0 && (
        <div className="border-t border-gray-100 max-h-48 overflow-y-auto">
          <div className="px-3 py-1.5 text-xs font-medium text-gray-400 bg-gray-50">
            Canned Responses
          </div>
          {filteredCanned.map((cr) => (
            <button
              key={cr.id}
              className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50 text-left border-b border-gray-50"
              onClick={() => insertCannedResponse(cr)}
            >
              <span className="text-xs font-semibold text-primary-600 bg-primary-50 px-2 py-0.5 rounded mt-0.5 flex-shrink-0">
                /{cr.shortcut}
              </span>
              <p className="text-sm text-gray-600 truncate">{cr.content}</p>
            </button>
          ))}
        </div>
      )}

      {/* Emoji picker */}
      {showEmojiPicker && (
        <div className="border-t border-gray-100 p-3">
          <div className="flex flex-wrap gap-2">
            {COMMON_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                className="text-xl hover:bg-gray-100 rounded p-1 transition-colors"
                onClick={() => insertEmoji(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Template modal */}
      {showTemplates && (
        <div className="border-t border-gray-100 max-h-64 overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b">
            <span className="text-xs font-medium text-gray-500">Choose Template</span>
            <button onClick={() => setShowTemplates(false)} className="text-gray-400 hover:text-gray-600 text-xs">Close</button>
          </div>
          {templates.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No approved templates</p>
          ) : (
            templates.map((t) => (
              <button
                key={t.id}
                className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-100"
                onClick={() => handleTemplateSelect(t)}
              >
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-800">{t.name}</p>
                  <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{t.language}</span>
                </div>
                <p className="text-xs text-gray-500 truncate mt-0.5">{t.body}</p>
              </button>
            ))
          )}
        </div>
      )}

      {/* Pending file preview */}
      {pendingFile && (
        <div className="border-t border-gray-100 px-4 py-2">
          <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
            {pendingFile.preview ? (
              <img
                src={pendingFile.preview}
                alt="Preview"
                className="w-10 h-10 rounded object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center flex-shrink-0 text-gray-500">
                {getFileIcon(pendingFile.file.type)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{pendingFile.file.name}</p>
              <p className="text-xs text-gray-500">{formatBytes(pendingFile.file.size)}</p>
              {uploadProgress !== null && (
                <div className="mt-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-500 transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}
            </div>
            {!isSending && (
              <button
                onClick={clearPendingFile}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_TYPES}
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Main input */}
      <div className="flex items-end gap-2 px-4 py-3">
        {/* Toolbar */}
        <div className="flex items-center gap-1 mb-1">
          <button
            onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowTemplates(false) }}
            className={cn('p-1.5 rounded hover:bg-gray-100 transition-colors', showEmojiPicker && 'bg-gray-100')}
            title="Emoji"
            disabled={isSending}
          >
            <Smile className="w-4 h-4 text-gray-500" />
          </button>
          <button
            onClick={() => { fileInputRef.current?.click(); setShowEmojiPicker(false); setShowTemplates(false) }}
            className={cn('p-1.5 rounded hover:bg-gray-100 transition-colors', pendingFile && 'bg-gray-100')}
            title="Attach file"
            disabled={isSending}
          >
            <Paperclip className="w-4 h-4 text-gray-500" />
          </button>
          <button
            onClick={() => { loadTemplates(); setShowEmojiPicker(false) }}
            className={cn('p-1.5 rounded hover:bg-gray-100 transition-colors', showTemplates && 'bg-gray-100')}
            title="Templates"
            disabled={isSending}
          >
            <FileText className="w-4 h-4 text-gray-500" />
          </button>
          <button
            onClick={() => setIsNote(!isNote)}
            className={cn('p-1.5 rounded hover:bg-gray-100 transition-colors', isNote && 'bg-yellow-100')}
            title="Send as note"
            disabled={isSending || !!pendingFile}
          >
            <StickyNote className={cn('w-4 h-4', isNote ? 'text-yellow-600' : 'text-gray-500')} />
          </button>
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            pendingFile
              ? 'Add a caption (optional)...'
              : isNote
              ? 'Write an internal note...'
              : 'Type a message... (/ for canned responses)'
          }
          className={cn(
            'flex-1 resize-none text-sm border rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-400 placeholder:text-gray-400 min-h-[38px] max-h-[120px]',
            isNote
              ? 'bg-yellow-50 border-yellow-300 focus:ring-yellow-400'
              : 'bg-gray-50 border-gray-200'
          )}
          rows={1}
          disabled={isSending}
        />

        {/* Send button */}
        <Button
          onClick={handleSend}
          disabled={!canSend}
          size="icon"
          className={cn(
            'h-9 w-9 flex-shrink-0 rounded-xl transition-all',
            !canSend && 'opacity-50'
          )}
        >
          {isSending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Character count */}
      {content.length > 800 && (
        <div className="px-4 pb-2 text-right">
          <span className={cn('text-xs', content.length > 1024 ? 'text-red-500' : 'text-gray-400')}>
            {content.length}/1024
          </span>
        </div>
      )}

      {/* Template variable fill-in dialog */}
      <Dialog open={!!selectedTemplate} onOpenChange={(open) => { if (!open) { setSelectedTemplate(null); setTemplateVars({}) } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send Template: {selectedTemplate?.name}{selectedTemplate?.language ? ` (${selectedTemplate.language})` : ''}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {selectedTemplate ? resolveVariables(selectedTemplate.body, templateVars) : ''}
            </div>
            {selectedTemplate && extractVariables(selectedTemplate.body).length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Fill in variables</p>
                {extractVariables(selectedTemplate.body).map((idx) => (
                  <div key={idx}>
                    <Label htmlFor={`var-${idx}`} className="text-sm">Variable {`{{${idx}}}`}</Label>
                    <Input
                      id={`var-${idx}`}
                      value={templateVars[idx] ?? ''}
                      onChange={(e) => setTemplateVars((prev) => ({ ...prev, [idx]: e.target.value }))}
                      placeholder={`Value for {{${idx}}}`}
                      className="mt-1"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">No variables — ready to send as-is.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSelectedTemplate(null); setTemplateVars({}) }}>Cancel</Button>
            <Button
              onClick={handleSendTemplate}
              disabled={isSending || (!!selectedTemplate && extractVariables(selectedTemplate.body).some((i) => !templateVars[i]?.trim()))}
            >
              {isSending ? 'Sending...' : 'Send Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
