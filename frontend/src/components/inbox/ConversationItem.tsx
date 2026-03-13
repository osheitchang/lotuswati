'use client'

import { useState } from 'react'
import { MoreVertical, CheckCheck, UserCheck, Tag } from 'lucide-react'
import { Conversation } from '@/types'
import { cn, getInitials, getAvatarColor, formatDate } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

interface ConversationItemProps {
  conversation: Conversation
  isSelected: boolean
  onClick: () => void
  onResolve: () => void
  onAssign: () => void
}

export function ConversationItem({
  conversation,
  isSelected,
  onClick,
  onResolve,
  onAssign,
}: ConversationItemProps) {
  const [showMenu, setShowMenu] = useState(false)
  const { contact, lastMessage, unreadCount, labels, assignedTo, status } = conversation

  const displayName = contact?.name || contact?.phone || 'Unknown'
  const initials = getInitials(contact?.name, contact?.phone)
  const avatarColor = getAvatarColor(contact?.id || contact?.phone || '')

  const lastMessageText = lastMessage?.content
    || (lastMessage?.type === 'image' ? '📷 Image' : '')
    || (lastMessage?.type === 'audio' ? '🎵 Audio' : '')
    || (lastMessage?.type === 'video' ? '🎥 Video' : '')
    || (lastMessage?.type === 'file' ? '📎 File' : '')
    || (lastMessage?.type === 'template' ? '📋 Template' : '')
    || 'No messages yet'

  const timeDisplay = conversation.lastMessageAt
    ? formatDate(conversation.lastMessageAt)
    : formatDate(conversation.createdAt)

  const statusDotColor = {
    open: 'bg-green-400',
    pending: 'bg-yellow-400',
    resolved: 'bg-gray-300',
    snoozed: 'bg-blue-400',
  }[status] || 'bg-gray-300'

  return (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3 cursor-pointer border-b border-gray-100 hover:bg-gray-50 transition-colors relative group',
        isSelected && 'bg-primary-50 border-l-2 border-l-primary-500',
      )}
      onClick={onClick}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0 mt-0.5">
        <Avatar className="w-10 h-10">
          <AvatarFallback
            style={{ backgroundColor: avatarColor }}
            className="text-white text-sm font-semibold"
          >
            {initials}
          </AvatarFallback>
        </Avatar>
        <span className={cn('absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white', statusDotColor)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-900 truncate max-w-[150px]">
            {displayName}
          </span>
          <div className="flex items-center gap-1 flex-shrink-0 ml-1">
            <span className="text-xs text-gray-400">{timeDisplay}</span>
            {/* Kebab menu */}
            <DropdownMenu open={showMenu} onOpenChange={setShowMenu}>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <button className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-200 transition-all">
                  <MoreVertical className="w-3.5 h-3.5 text-gray-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAssign() }}>
                  <UserCheck className="w-4 h-4 mr-2" />
                  Assign
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation() }}>
                  <Tag className="w-4 h-4 mr-2" />
                  Add Label
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {status !== 'resolved' && (
                  <DropdownMenuItem
                    onClick={(e) => { e.stopPropagation(); onResolve() }}
                    className="text-green-600"
                  >
                    <CheckCheck className="w-4 h-4 mr-2" />
                    Resolve
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <p className="text-xs text-gray-500 truncate mt-0.5">{lastMessageText}</p>

        {/* Labels + badges */}
        <div className="flex items-center gap-1 mt-1 flex-wrap">
          {labels?.slice(0, 2).map((label) => (
            <span
              key={label.id}
              className="text-xs px-1.5 py-0.5 rounded-full text-white font-medium"
              style={{ backgroundColor: label.color }}
            >
              {label.name}
            </span>
          ))}
          {labels?.length > 2 && (
            <span className="text-xs text-gray-400">+{labels.length - 2}</span>
          )}

          {assignedTo && (
            <div className="ml-auto flex items-center">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                style={{ backgroundColor: getAvatarColor(assignedTo.id) }}
                title={assignedTo.name}
              >
                {getInitials(assignedTo.name)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Unread badge */}
      {unreadCount > 0 && (
        <div className="absolute right-3 top-3">
          <span className="flex items-center justify-center w-5 h-5 bg-primary-500 text-white text-xs font-bold rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        </div>
      )}
    </div>
  )
}
