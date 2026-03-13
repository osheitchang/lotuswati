'use client'

import { useState } from 'react'
import {
  Phone,
  Mail,
  Tag,
  Calendar,
  Clock,
  ChevronRight,
  X,
  Plus,
  User,
  UserCheck,
} from 'lucide-react'
import { useInboxStore } from '@/store/inboxStore'
import { useAppStore } from '@/store/appStore'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { cn, getInitials, getAvatarColor, formatDate, formatRelativeTime } from '@/lib/utils'
import { toast } from '@/components/ui/use-toast'
import { Textarea } from '@/components/ui/textarea'

interface ConversationDetailProps {
  onClose: () => void
}

export function ConversationDetail({ onClose }: ConversationDetailProps) {
  const {
    selectedConversation,
    notes,
    selectedConversationId,
    addNote,
    addLabel,
    removeLabel,
    assignConversation,
  } = useInboxStore()
  const { labels, agents } = useAppStore()
  const [noteContent, setNoteContent] = useState('')
  const [isAddingNote, setIsAddingNote] = useState(false)
  const [expandedSection, setExpandedSection] = useState<string | null>('contact')

  if (!selectedConversation) return null

  const { contact, assignedTo, createdAt, updatedAt, labels: convLabels } = selectedConversation
  const convNotes = selectedConversationId ? notes[selectedConversationId] || [] : []

  const handleAddNote = async () => {
    if (!noteContent.trim() || !selectedConversationId) return
    setIsAddingNote(true)
    try {
      await addNote(selectedConversationId, noteContent)
      setNoteContent('')
      toast({ title: 'Note added' })
    } catch {
      toast({ title: 'Failed to add note', variant: 'destructive' })
    } finally {
      setIsAddingNote(false)
    }
  }

  const handleAddLabel = async (labelId: string) => {
    if (!selectedConversationId) return
    try {
      await addLabel(selectedConversationId, labelId)
    } catch {
      toast({ title: 'Failed to add label', variant: 'destructive' })
    }
  }

  const handleRemoveLabel = async (labelId: string) => {
    if (!selectedConversationId) return
    try {
      await removeLabel(selectedConversationId, labelId)
    } catch {
      toast({ title: 'Failed to remove label', variant: 'destructive' })
    }
  }

  const handleAssign = async (agentId: string) => {
    if (!selectedConversationId) return
    try {
      await assignConversation(selectedConversationId, agentId)
    } catch {
      toast({ title: 'Failed to assign', variant: 'destructive' })
    }
  }

  const Section = ({
    id,
    title,
    children,
  }: { id: string; title: string; children: React.ReactNode }) => (
    <div className="border-b border-gray-100 last:border-0">
      <button
        className="flex items-center justify-between w-full px-4 py-3 hover:bg-gray-50 transition-colors"
        onClick={() => setExpandedSection(expandedSection === id ? null : id)}
      >
        <span className="text-sm font-medium text-gray-700">{title}</span>
        <ChevronRight className={cn('w-4 h-4 text-gray-400 transition-transform', expandedSection === id && 'rotate-90')} />
      </button>
      {expandedSection === id && (
        <div className="px-4 pb-4">{children}</div>
      )}
    </div>
  )

  return (
    <div className="w-72 flex flex-col h-full bg-white border-l border-gray-100 flex-shrink-0 animate-slide-in-right">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900 text-sm">Contact Details</h3>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-gray-100 transition-colors"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Contact header */}
        <div className="flex flex-col items-center px-4 py-6 border-b border-gray-100">
          <Avatar className="w-16 h-16 mb-3">
            <AvatarFallback
              style={{ backgroundColor: getAvatarColor(contact?.id || '') }}
              className="text-white text-xl font-semibold"
            >
              {getInitials(contact?.name, contact?.phone)}
            </AvatarFallback>
          </Avatar>
          <h4 className="font-semibold text-gray-900">{contact?.name || 'Unknown'}</h4>
          <p className="text-sm text-gray-500 mt-0.5">{contact?.phone}</p>
          {contact?.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2 justify-center">
              {contact.tags.map((tag) => (
                <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Contact Info */}
        <Section id="contact" title="Contact Information">
          <div className="space-y-2">
            {contact?.phone && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="truncate">{contact.phone}</span>
              </div>
            )}
            {contact?.email && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="truncate">{contact.email}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span>Added {formatDate(contact?.createdAt || createdAt)}</span>
            </div>
          </div>
        </Section>

        {/* Labels */}
        <Section id="labels" title="Labels">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {convLabels?.map((label) => (
              <div
                key={label.id}
                className="flex items-center gap-1 text-xs text-white px-2 py-0.5 rounded-full group"
                style={{ backgroundColor: label.color }}
              >
                {label.name}
                <button
                  onClick={() => handleRemoveLabel(label.id)}
                  className="opacity-0 group-hover:opacity-100 hover:bg-white/20 rounded-full p-0.5 transition-all"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700">
                <Plus className="w-3.5 h-3.5" />
                Add label
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              {labels.filter(l => !convLabels?.some(cl => cl.id === l.id)).map((label) => (
                <DropdownMenuItem key={label.id} onClick={() => handleAddLabel(label.id)}>
                  <span
                    className="w-2 h-2 rounded-full mr-2"
                    style={{ backgroundColor: label.color }}
                  />
                  {label.name}
                </DropdownMenuItem>
              ))}
              {labels.length === 0 && (
                <DropdownMenuItem disabled>No labels available</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </Section>

        {/* Assigned Agent */}
        <Section id="agent" title="Assigned Agent">
          <div className="flex items-center gap-2 mb-2">
            {assignedTo ? (
              <>
                <Avatar className="w-7 h-7">
                  <AvatarFallback
                    style={{ backgroundColor: getAvatarColor(assignedTo.id) }}
                    className="text-white text-xs font-semibold"
                  >
                    {getInitials(assignedTo.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium text-gray-800">{assignedTo.name}</p>
                  <p className="text-xs text-gray-400 capitalize">{assignedTo.role}</p>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-400">Unassigned</p>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700">
                <UserCheck className="w-3.5 h-3.5" />
                {assignedTo ? 'Reassign' : 'Assign agent'}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              <DropdownMenuItem onClick={() => handleAssign('')}>
                Unassigned
              </DropdownMenuItem>
              {agents.map((agent) => (
                <DropdownMenuItem key={agent.id} onClick={() => handleAssign(agent.id)}>
                  {agent.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </Section>

        {/* Conversation Info */}
        <Section id="info" title="Conversation Info">
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Created</span>
              <span className="text-gray-700">{formatRelativeTime(createdAt)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Last activity</span>
              <span className="text-gray-700">{formatRelativeTime(updatedAt)}</span>
            </div>
          </div>
        </Section>

        {/* Notes */}
        <Section id="notes" title={`Notes (${convNotes.length})`}>
          <div className="space-y-3 mb-3">
            {convNotes.length === 0 && (
              <p className="text-xs text-gray-400">No notes yet</p>
            )}
            {convNotes.map((note) => (
              <div key={note.id} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-xs font-medium text-gray-700">{note.user?.name}</span>
                  <span className="text-xs text-gray-400">· {formatRelativeTime(note.createdAt)}</span>
                </div>
                <p className="text-xs text-gray-600 whitespace-pre-wrap">{note.content}</p>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <Textarea
              placeholder="Add a note..."
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              className="text-xs min-h-[64px] bg-yellow-50 border-yellow-200 focus:ring-yellow-400"
            />
            <Button
              size="sm"
              variant="outline"
              className="w-full h-7 text-xs"
              onClick={handleAddNote}
              disabled={!noteContent.trim() || isAddingNote}
            >
              Add Note
            </Button>
          </div>
        </Section>

        {/* Custom Fields */}
        {contact?.customFields && Object.keys(contact.customFields).length > 0 && (
          <Section id="custom" title="Custom Fields">
            <div className="space-y-1.5">
              {Object.entries(contact.customFields).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 capitalize">{key}</span>
                  <span className="text-gray-700 font-medium">{value}</span>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}
