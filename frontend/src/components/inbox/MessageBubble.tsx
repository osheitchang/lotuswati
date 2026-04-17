'use client'

import { Check, CheckCheck, Download, FileText, Lock } from 'lucide-react'
import { Message } from '@/types'
import { cn, formatTime, getInitials, getAvatarColor } from '@/lib/utils'

interface MessageBubbleProps {
  message: Message
  showAgentName?: boolean
}

export function MessageBubble({ message, showAgentName }: MessageBubbleProps) {
  const isOutgoing = message.fromType === 'agent' || message.fromType === 'bot'
  const isSystem = message.fromType === 'system'
  const isNote = message.type === 'note'

  if (isSystem) {
    return (
      <div className="flex justify-center my-3">
        <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    )
  }

  if (isNote) {
    return (
      <div className="flex justify-end my-2">
        <div className="max-w-[70%]">
          <div className="flex items-center gap-1 mb-1 justify-end">
            <Lock className="w-3 h-3 text-yellow-600" />
            <span className="text-xs text-yellow-600 font-medium">Internal Note</span>
            {message.agent && (
              <span className="text-xs text-gray-400">· {message.agent.name}</span>
            )}
          </div>
          <div className="message-bubble-note px-4 py-2.5 text-sm">
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
            <div className="text-right mt-1">
              <span className="text-xs text-yellow-600/60">{formatTime(message.createdAt)}</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex items-end gap-2 mb-2 animate-fade-in', isOutgoing ? 'flex-row-reverse' : 'flex-row')}>
      {/* Agent avatar for incoming */}
      {!isOutgoing && (
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 mb-0.5"
          style={{ backgroundColor: getAvatarColor('contact') }}
        >
          C
        </div>
      )}

      <div className={cn('flex flex-col max-w-[70%]', isOutgoing ? 'items-end' : 'items-start')}>
        {/* Agent name */}
        {showAgentName && isOutgoing && message.agent && (
          <span className="text-xs text-gray-400 mb-1 mr-1">{message.agent.name}</span>
        )}

        {/* Message content */}
        {message.type === 'text' && (
          <div className={cn('px-4 py-2.5 text-sm', isOutgoing ? 'message-bubble-outgoing' : 'message-bubble-incoming')}>
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
            <div className={cn('flex items-center justify-end gap-1 mt-1', isOutgoing ? 'text-white/70' : 'text-gray-400')}>
              <span className="text-xs">{formatTime(message.createdAt)}</span>
              {isOutgoing && <StatusIcon status={message.status} />}
            </div>
          </div>
        )}

        {message.type === 'image' && (
          <div className={cn('rounded-2xl overflow-hidden', isOutgoing ? 'rounded-br-sm' : 'rounded-bl-sm')}>
            {message.mediaUrl ? (
              <div>
                <img
                  src={message.mediaUrl}
                  alt="Image"
                  className="max-w-xs max-h-64 object-cover cursor-pointer hover:opacity-95"
                  onClick={() => window.open(message.mediaUrl, '_blank')}
                />
                {message.caption && (
                  <div className={cn('px-3 py-2 text-sm', isOutgoing ? 'bg-primary-500 text-white' : 'bg-white text-gray-700')}>
                    {message.caption}
                  </div>
                )}
              </div>
            ) : (
              <div className="w-48 h-32 bg-gray-200 flex items-center justify-center">
                <span className="text-gray-400 text-sm">Image unavailable</span>
              </div>
            )}
            <div className={cn('px-3 py-1 flex items-center justify-end gap-1', isOutgoing ? 'bg-primary-500 text-white/70' : 'bg-white text-gray-400')}>
              <span className="text-xs">{formatTime(message.createdAt)}</span>
              {isOutgoing && <StatusIcon status={message.status} />}
            </div>
          </div>
        )}

        {message.type === 'file' && (
          <div className={cn('px-4 py-3 text-sm flex items-center gap-3', isOutgoing ? 'message-bubble-outgoing' : 'message-bubble-incoming')}>
            <FileText className={cn('w-8 h-8 flex-shrink-0', isOutgoing ? 'text-white/80' : 'text-gray-400')} />
            <div className="flex-1 min-w-0">
              <p className={cn('font-medium truncate', isOutgoing ? 'text-white' : 'text-gray-800')}>
                {message.fileName || 'File'}
              </p>
              <div className={cn('flex items-center gap-2 mt-0.5', isOutgoing ? 'text-white/70' : 'text-gray-400')}>
                <span className="text-xs">{formatTime(message.createdAt)}</span>
                {isOutgoing && <StatusIcon status={message.status} />}
              </div>
            </div>
            {message.mediaUrl && (
              <a href={message.mediaUrl} download className={cn('p-1 rounded', isOutgoing ? 'hover:bg-white/20' : 'hover:bg-gray-100')}>
                <Download className={cn('w-4 h-4', isOutgoing ? 'text-white' : 'text-gray-500')} />
              </a>
            )}
          </div>
        )}

        {message.type === 'video' && (
          <div className={cn('rounded-2xl overflow-hidden', isOutgoing ? 'rounded-br-sm' : 'rounded-bl-sm')}>
            {message.mediaUrl ? (
              <div>
                <video
                  controls
                  style={{ maxWidth: '300px' }}
                  className="block"
                  onError={(e) => { (e.currentTarget as HTMLVideoElement).style.display = 'none'; (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'block' }}
                >
                  <source src={message.mediaUrl} type="video/mp4" />
                  <source src={message.mediaUrl} type="video/3gpp" />
                  <source src={message.mediaUrl} type="video/webm" />
                </video>
                <a
                  href={message.mediaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn('hidden px-3 py-2 text-sm underline', isOutgoing ? 'text-white' : 'text-primary-600')}
                >
                  Download video
                </a>
                {message.caption && (
                  <div className={cn('px-3 py-2 text-sm', isOutgoing ? 'bg-primary-500 text-white' : 'bg-white text-gray-700')}>
                    {message.caption}
                  </div>
                )}
              </div>
            ) : (
              <div className="w-48 h-32 bg-gray-200 flex items-center justify-center">
                <span className="text-gray-400 text-sm">Video unavailable</span>
              </div>
            )}
            <div className={cn('px-3 py-1 flex items-center justify-end gap-1', isOutgoing ? 'bg-primary-500 text-white/70' : 'bg-white text-gray-400')}>
              <span className="text-xs">{formatTime(message.createdAt)}</span>
              {isOutgoing && <StatusIcon status={message.status} />}
            </div>
          </div>
        )}

        {message.type === 'audio' && (
          <div className={cn('px-4 py-3', isOutgoing ? 'message-bubble-outgoing' : 'message-bubble-incoming')}>
            {message.mediaUrl ? (
              <audio controls className="h-10 w-48">
                <source src={message.mediaUrl} />
              </audio>
            ) : (
              <p className={cn('text-sm', isOutgoing ? 'text-white' : 'text-gray-500')}>🎵 Voice message</p>
            )}
            <div className={cn('flex items-center justify-end gap-1 mt-1', isOutgoing ? 'text-white/70' : 'text-gray-400')}>
              <span className="text-xs">{formatTime(message.createdAt)}</span>
              {isOutgoing && <StatusIcon status={message.status} />}
            </div>
          </div>
        )}

        {message.type === 'template' && (
          <div className={cn('w-72 rounded-2xl overflow-hidden border', isOutgoing ? 'rounded-br-sm border-primary-300' : 'rounded-bl-sm border-gray-200 bg-white')}>
            <div className={cn('px-4 py-3', isOutgoing ? 'bg-primary-500 text-white' : 'text-gray-800')}>
              <p className={cn('text-xs font-semibold mb-1', isOutgoing ? 'text-white/70' : 'text-gray-400')}>
                Template: {message.templateName}
              </p>
              <p className="text-sm whitespace-pre-wrap">
                {message.content || message.templateName}
              </p>
              <div className={cn('flex items-center justify-end gap-1 mt-1', isOutgoing ? 'text-white/70' : 'text-gray-400')}>
                <span className="text-xs">{formatTime(message.createdAt)}</span>
                {isOutgoing && <StatusIcon status={message.status} />}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'read':
      return <CheckCheck className="w-3.5 h-3.5 text-blue-300" />
    case 'delivered':
      return <CheckCheck className="w-3.5 h-3.5 text-white/60" />
    case 'sent':
      return <Check className="w-3.5 h-3.5 text-white/60" />
    case 'failed':
      return <span className="text-red-300 text-xs">!</span>
    default:
      return <Check className="w-3.5 h-3.5 text-white/40" />
  }
}
