'use client'

import { useEffect, useRef, useState } from 'react'
import {
  CheckCheck,
  ChevronDown,
  UserCheck,
  MoreVertical,
  Phone,
  RefreshCw,
  MessageSquare,
} from 'lucide-react'
import { useInboxStore } from '@/store/inboxStore'
import { useAppStore } from '@/store/appStore'
import { MessageBubble } from './MessageBubble'
import { MessageInput } from './MessageInput'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn, getInitials, getAvatarColor, getConversationStatusColor } from '@/lib/utils'
import { toast } from '@/components/ui/use-toast'
import { format } from 'date-fns'

interface ChatWindowProps {
  onToggleDetail: () => void
  showDetail: boolean
}

export function ChatWindow({ onToggleDetail, showDetail }: ChatWindowProps) {
  const {
    selectedConversationId,
    selectedConversation,
    messages,
    isLoadingMessages,
    loadMessages,
    resolveConversation,
    reopenConversation,
    assignConversation,
  } = useInboxStore()
  const { agents } = useAppStore()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [showScrollBottom, setShowScrollBottom] = useState(false)

  useEffect(() => {
    if (selectedConversationId) {
      loadMessages(selectedConversationId)
    }
  }, [selectedConversationId])

  const conversationMessages = selectedConversationId
    ? messages[selectedConversationId] || []
    : []

  useEffect(() => {
    scrollToBottom()
  }, [conversationMessages.length, selectedConversationId])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100
    setShowScrollBottom(!isAtBottom)
  }

  const handleResolve = async () => {
    if (!selectedConversationId) return
    try {
      await resolveConversation(selectedConversationId)
      toast({ title: 'Conversation resolved', variant: 'default' })
    } catch {
      toast({ title: 'Failed to resolve', variant: 'destructive' })
    }
  }

  const handleReopen = async () => {
    if (!selectedConversationId) return
    try {
      await reopenConversation(selectedConversationId)
      toast({ title: 'Conversation reopened' })
    } catch {
      toast({ title: 'Failed to reopen', variant: 'destructive' })
    }
  }

  const handleAssign = async (agentId: string) => {
    if (!selectedConversationId) return
    try {
      await assignConversation(selectedConversationId, agentId)
      toast({ title: 'Conversation assigned' })
    } catch {
      toast({ title: 'Failed to assign', variant: 'destructive' })
    }
  }

  if (!selectedConversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-20 h-20 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4 border border-gray-100">
            <MessageSquare className="w-10 h-10 text-gray-300" />
          </div>
          <h3 className="text-gray-700 font-medium text-lg">Select a conversation</h3>
          <p className="text-gray-400 text-sm mt-1">
            Choose from the list to start chatting
          </p>
        </div>
      </div>
    )
  }

  const { contact, status, assignedTo } = selectedConversation
  const displayName = contact?.name || contact?.phone || 'Unknown'
  const initials = getInitials(contact?.name, contact?.phone)
  const avatarColor = getAvatarColor(contact?.id || contact?.phone || '')
  const statusClass = getConversationStatusColor(status)

  // Group messages by date
  const groupedMessages: { date: string; messages: typeof conversationMessages }[] = []
  let currentDate = ''
  conversationMessages.forEach((msg) => {
    const msgDate = format(new Date(msg.createdAt), 'MMMM d, yyyy')
    if (msgDate !== currentDate) {
      currentDate = msgDate
      groupedMessages.push({ date: msgDate, messages: [msg] })
    } else {
      groupedMessages[groupedMessages.length - 1].messages.push(msg)
    }
  })

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 bg-white border-b border-gray-100 flex-shrink-0">
        <Avatar className="w-9 h-9">
          <AvatarFallback
            style={{ backgroundColor: avatarColor }}
            className="text-white text-sm font-semibold"
          >
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 text-sm">{displayName}</h3>
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', statusClass)}>
              {status}
            </span>
          </div>
          <p className="text-xs text-gray-400">{contact?.phone}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Assign dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <UserCheck className="w-3.5 h-3.5" />
                {assignedTo ? assignedTo.name : 'Assign'}
                <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel className="text-xs">Assign to</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleAssign('')}>
                Unassigned
              </DropdownMenuItem>
              {agents.map((agent) => (
                <DropdownMenuItem key={agent.id} onClick={() => handleAssign(agent.id)}>
                  {agent.name}
                  {assignedTo?.id === agent.id && (
                    <span className="ml-auto text-primary-500 text-xs">✓</span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Resolve button */}
          {status === 'resolved' ? (
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={handleReopen}>
              <RefreshCw className="w-3.5 h-3.5" />
              Reopen
            </Button>
          ) : (
            <Button size="sm" className="h-8 text-xs gap-1" onClick={handleResolve}>
              <CheckCheck className="w-3.5 h-3.5" />
              Resolve
            </Button>
          )}

          {/* More options */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onToggleDetail}
          >
            <MoreVertical className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Messages area */}
      <div
        className="flex-1 overflow-y-auto chat-bg px-4 py-4 relative"
        onScroll={handleScroll}
      >
        {isLoadingMessages ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-3 border-primary-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : conversationMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-3">
              <MessageSquare className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-gray-500 text-sm">No messages yet</p>
            <p className="text-gray-400 text-xs mt-1">Send the first message</p>
          </div>
        ) : (
          <>
            {groupedMessages.map(({ date, messages: dayMessages }) => (
              <div key={date}>
                <div className="flex justify-center my-4">
                  <span className="text-xs text-gray-400 bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm">
                    {date}
                  </span>
                </div>
                {dayMessages.map((message, idx) => {
                  const prevMsg = idx > 0 ? dayMessages[idx - 1] : null
                  const showAgent = message.fromType === 'agent' &&
                    (!prevMsg || prevMsg.fromType !== 'agent' || prevMsg.fromId !== message.fromId)
                  return (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      showAgentName={showAgent}
                    />
                  )
                })}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}

        {/* Scroll to bottom button */}
        {showScrollBottom && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-4 right-6 w-9 h-9 bg-white shadow-md rounded-full flex items-center justify-center hover:bg-gray-50 transition-colors border border-gray-200"
          >
            <ChevronDown className="w-4 h-4 text-gray-600" />
          </button>
        )}
      </div>

      {/* Message Input */}
      <MessageInput conversationId={selectedConversationId!} />
    </div>
  )
}
