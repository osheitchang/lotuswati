'use client'

import { useState } from 'react'
import { ConversationList } from '@/components/inbox/ConversationList'
import { ChatWindow } from '@/components/inbox/ChatWindow'
import { ConversationDetail } from '@/components/inbox/ConversationDetail'
import { useInboxStore } from '@/store/inboxStore'

export default function InboxPage() {
  const [showDetail, setShowDetail] = useState(false)
  const { selectedConversationId } = useInboxStore()

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel: Conversation list */}
      <div className="w-80 flex-shrink-0 h-full">
        <ConversationList />
      </div>

      {/* Middle panel: Chat */}
      <div className="flex-1 flex overflow-hidden min-w-0 h-full">
        <ChatWindow
          onToggleDetail={() => setShowDetail(!showDetail)}
          showDetail={showDetail}
        />
      </div>

      {/* Right panel: Conversation Detail (collapsible) */}
      {showDetail && selectedConversationId && (
        <ConversationDetail onClose={() => setShowDetail(false)} />
      )}
    </div>
  )
}
