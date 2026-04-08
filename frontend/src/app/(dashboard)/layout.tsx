'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { useAuthStore } from '@/store/authStore'
import { useAppStore } from '@/store/appStore'
import { useInboxStore } from '@/store/inboxStore'
import { initSocket, getSocket, disconnectSocket } from '@/lib/socket'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { token, isAuthenticated, loadUser, isLoading } = useAuthStore()
  const { loadAll, setConnected } = useAppStore()
  const { addIncomingMessage, updateConversation, addConversation, updateMessageStatus, loadConversations, selectedConversationId } = useInboxStore()

  useEffect(() => {
    const init = async () => {
      const storedToken = token || localStorage.getItem('token')
      if (!storedToken) {
        router.push('/login')
        return
      }
      await loadUser()
    }
    init()
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      loadAll()
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !localStorage.getItem('token')) {
      router.push('/login')
    }
  }, [isLoading, isAuthenticated])

  // Initialize socket
  useEffect(() => {
    const storedToken = token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null)
    if (!storedToken) return

    const socket = initSocket(storedToken)

    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))

    socket.on('message:new', (data: any) => {
      const message = data.message || data
      addIncomingMessage(message)
    })

    socket.on('message:status', (data: any) => {
      updateMessageStatus(data.messageId, data.status)
    })

    socket.on('conversation:created', (data: any) => {
      const conversation = data.conversation || data
      addConversation(conversation)
    })

    socket.on('conversation:updated', (data: any) => {
      const conversation = data.conversation || data
      updateConversation(conversation)
    })

    socket.on('conversation:assigned', (data: any) => {
      updateConversation({
        id: data.conversationId,
        assignedToId: data.agentId,
        assignedTo: data.agent,
      } as any)
    })

    socket.on('conversation:message', () => {
      // Refresh the conversation list so lastMessage and unreadCount stay current
      loadConversations()
    })

    socket.on('conversation:resolved', (data: any) => {
      updateConversation({
        id: data.conversationId,
        status: 'resolved',
      } as any)
    })

    return () => {
      socket.off('connect')
      socket.off('disconnect')
      socket.off('message:new')
      socket.off('message:status')
      socket.off('conversation:created')
      socket.off('conversation:updated')
      socket.off('conversation:assigned')
      socket.off('conversation:message')
      socket.off('conversation:resolved')
      disconnectSocket()
    }
  }, [token])

  // Join/leave conversation rooms when the selected conversation changes
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    if (selectedConversationId) {
      socket.emit('join_conversation', { conversationId: selectedConversationId })
    }

    return () => {
      if (selectedConversationId) {
        socket.emit('leave_conversation', { conversationId: selectedConversationId })
      }
    }
  }, [selectedConversationId])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading LotusWati...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-hidden flex flex-col min-w-0">
        {children}
      </main>
    </div>
  )
}
