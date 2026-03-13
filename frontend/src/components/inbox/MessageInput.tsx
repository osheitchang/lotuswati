'use client'

import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import {
  Send,
  Paperclip,
  FileText,
  ChevronDown,
  StickyNote,
  Smile,
} from 'lucide-react'
import { useInboxStore } from '@/store/inboxStore'
import { useAppStore } from '@/store/appStore'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from '@/components/ui/use-toast'
import { CannedResponse, Template } from '@/types'
import { templatesApi } from '@/lib/api'

interface MessageInputProps {
  conversationId: string
}

const COMMON_EMOJIS = ['😊', '👍', '❤️', '😂', '🙏', '✅', '🔥', '👋', '😍', '🎉', '💪', '✨', '🙌', '💯', '😅']

export function MessageInput({ conversationId }: MessageInputProps) {
  const { sendMessage } = useInboxStore()
  const { cannedResponses } = useAppStore()
  const [content, setContent] = useState('')
  const [isNote, setIsNote] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [showCannedResponses, setShowCannedResponses] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [cannedFilter, setCannedFilter] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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

  const handleSend = async () => {
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

  const handleTemplateSelect = async (template: Template) => {
    try {
      await sendMessage(conversationId, template.body, 'template', false)
      setShowTemplates(false)
      toast({ title: 'Template sent' })
    } catch (error: any) {
      toast({
        title: 'Failed to send template',
        description: error.response?.data?.message || 'An error occurred',
        variant: 'destructive',
      })
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

  return (
    <div className={cn(
      'border-t bg-white',
      isNote && 'bg-yellow-50 border-yellow-200'
    )}>
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
                <p className="text-sm font-medium text-gray-800">{t.name}</p>
                <p className="text-xs text-gray-500 truncate mt-0.5">{t.body}</p>
              </button>
            ))
          )}
        </div>
      )}

      {/* Main input */}
      <div className="flex items-end gap-2 px-4 py-3">
        {/* Toolbar */}
        <div className="flex items-center gap-1 mb-1">
          <button
            onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowTemplates(false) }}
            className={cn('p-1.5 rounded hover:bg-gray-100 transition-colors', showEmojiPicker && 'bg-gray-100')}
            title="Emoji"
          >
            <Smile className="w-4 h-4 text-gray-500" />
          </button>
          <button
            className="p-1.5 rounded hover:bg-gray-100 transition-colors"
            title="Attach file"
          >
            <Paperclip className="w-4 h-4 text-gray-500" />
          </button>
          <button
            onClick={() => { loadTemplates(); setShowEmojiPicker(false) }}
            className={cn('p-1.5 rounded hover:bg-gray-100 transition-colors', showTemplates && 'bg-gray-100')}
            title="Templates"
          >
            <FileText className="w-4 h-4 text-gray-500" />
          </button>
          <button
            onClick={() => setIsNote(!isNote)}
            className={cn('p-1.5 rounded hover:bg-gray-100 transition-colors', isNote && 'bg-yellow-100')}
            title="Send as note"
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
          placeholder={isNote ? 'Write an internal note...' : 'Type a message... (/ for canned responses)'}
          className={cn(
            'flex-1 resize-none text-sm border rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-400 placeholder:text-gray-400 min-h-[38px] max-h-[120px]',
            isNote
              ? 'bg-yellow-50 border-yellow-300 focus:ring-yellow-400'
              : 'bg-gray-50 border-gray-200'
          )}
          rows={1}
        />

        {/* Send button */}
        <Button
          onClick={handleSend}
          disabled={!content.trim() || isSending}
          size="icon"
          className={cn(
            'h-9 w-9 flex-shrink-0 rounded-xl transition-all',
            !content.trim() && 'opacity-50'
          )}
        >
          <Send className="w-4 h-4" />
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
    </div>
  )
}
