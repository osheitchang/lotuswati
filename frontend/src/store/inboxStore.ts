import { create } from 'zustand'
import { conversationsApi } from '@/lib/api'
import type { Conversation, Message, Note } from '@/types'

interface InboxFilters {
  status: string
  assignedTo: string
  label: string
  search: string
}

interface InboxState {
  conversations: Conversation[]
  selectedConversationId: string | null
  selectedConversation: Conversation | null
  messages: Record<string, Message[]>
  notes: Record<string, Note[]>
  filters: InboxFilters
  isLoadingConversations: boolean
  isLoadingMessages: boolean
  totalUnread: number

  loadConversations: () => Promise<void>
  selectConversation: (id: string | null) => void
  loadMessages: (conversationId: string) => Promise<void>
  sendMessage: (conversationId: string, content: string | undefined, type?: string, isNote?: boolean, mediaUrl?: string) => Promise<void>
  addNote: (conversationId: string, content: string) => Promise<void>
  resolveConversation: (id: string) => Promise<void>
  reopenConversation: (id: string) => Promise<void>
  assignConversation: (id: string, agentId: string | null) => Promise<void>
  addIncomingMessage: (message: Message) => void
  updateConversation: (conversation: Conversation) => void
  addConversation: (conversation: Conversation) => void
  updateFilters: (filters: Partial<InboxFilters>) => void
  setConversations: (conversations: Conversation[]) => void
  updateMessageStatus: (messageId: string, status: string) => void
  addLabel: (conversationId: string, labelId: string) => Promise<void>
  removeLabel: (conversationId: string, labelId: string) => Promise<void>
}

export const useInboxStore = create<InboxState>((set, get) => ({
  conversations: [],
  selectedConversationId: null,
  selectedConversation: null,
  messages: {},
  notes: {},
  filters: {
    status: 'open',
    assignedTo: '',
    label: '',
    search: '',
  },
  isLoadingConversations: false,
  isLoadingMessages: false,
  totalUnread: 0,

  loadConversations: async () => {
    set({ isLoadingConversations: true })
    try {
      const { filters } = get()
      const response = await conversationsApi.list({
        status: filters.status || undefined,
        assignedTo: filters.assignedTo || undefined,
        label: filters.label || undefined,
        search: filters.search || undefined,
        limit: 50,
      })
      const conversations = response.data.conversations || response.data || []
      const totalUnread = conversations.reduce((sum: number, c: Conversation) => sum + (c.unreadCount || 0), 0)
      set({ conversations, totalUnread, isLoadingConversations: false })
    } catch (error) {
      set({ isLoadingConversations: false })
    }
  },

  selectConversation: (id) => {
    const { conversations } = get()
    const conversation = conversations.find((c) => c.id === id) || null
    set({ selectedConversationId: id, selectedConversation: conversation })

    if (id) {
      // Mark as read
      conversationsApi.markRead(id).catch(() => {})
      // Clear unread count
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === id ? { ...c, unreadCount: 0 } : c
        ),
        totalUnread: Math.max(0, state.totalUnread - (conversation?.unreadCount || 0)),
      }))
    }
  },

  loadMessages: async (conversationId) => {
    set({ isLoadingMessages: true })
    try {
      const [messagesResponse, notesResponse] = await Promise.all([
        conversationsApi.getMessages(conversationId, { limit: 100 }),
        conversationsApi.getNotes(conversationId).catch(() => ({ data: [] })),
      ])
      const messages = messagesResponse.data.messages || messagesResponse.data || []
      const notes = notesResponse.data.notes || notesResponse.data || []
      set((state) => ({
        messages: { ...state.messages, [conversationId]: messages },
        notes: { ...state.notes, [conversationId]: notes },
        isLoadingMessages: false,
      }))
    } catch (error) {
      set({ isLoadingMessages: false })
    }
  },

  sendMessage: async (conversationId, content, type = 'text', isNote = false, mediaUrl?: string) => {
    try {
      await conversationsApi.sendMessage(conversationId, {
        content,
        type,
        isNote,
        mediaUrl,
      })
      // Don't add optimistically — the socket `message:new` event will deliver it,
      // preventing the message from appearing twice in the chat.
    } catch (error) {
      throw error
    }
  },

  addNote: async (conversationId, content) => {
    try {
      const response = await conversationsApi.addNote(conversationId, content)
      const note = response.data.note || response.data
      set((state) => ({
        notes: {
          ...state.notes,
          [conversationId]: [...(state.notes[conversationId] || []), note],
        },
      }))
    } catch (error) {
      throw error
    }
  },

  resolveConversation: async (id) => {
    try {
      await conversationsApi.resolve(id)
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === id ? { ...c, status: 'resolved' } : c
        ),
        selectedConversation: state.selectedConversation?.id === id
          ? { ...state.selectedConversation, status: 'resolved' }
          : state.selectedConversation,
      }))
    } catch (error) {
      throw error
    }
  },

  reopenConversation: async (id) => {
    try {
      await conversationsApi.reopen(id)
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === id ? { ...c, status: 'open' } : c
        ),
        selectedConversation: state.selectedConversation?.id === id
          ? { ...state.selectedConversation, status: 'open' }
          : state.selectedConversation,
      }))
    } catch (error) {
      throw error
    }
  },

  assignConversation: async (id, agentId) => {
    try {
      const response = await conversationsApi.assign(id, agentId || '')
      const updated = response.data.conversation || response.data
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === id ? { ...c, ...updated } : c
        ),
        selectedConversation: state.selectedConversation?.id === id
          ? { ...state.selectedConversation, ...updated }
          : state.selectedConversation,
      }))
    } catch (error) {
      throw error
    }
  },

  addIncomingMessage: (message) => {
    const { selectedConversationId } = get()
    set((state) => {
      const existingMessages = state.messages[message.conversationId] || []
      const msgTime = new Date(message.createdAt).getTime()
      const isDuplicate = existingMessages.some((m) => {
        if (m.id === message.id) return true
        if ((m as any).waMessageId && (message as any).waMessageId && (m as any).waMessageId === (message as any).waMessageId) return true
        if (
          m.content === message.content &&
          m.fromId === message.fromId &&
          m.fromType === message.fromType &&
          Math.abs(new Date(m.createdAt).getTime() - msgTime) < 10000
        ) return true
        return false
      })
      if (isDuplicate) return state

      const updatedMessages = [...existingMessages, message]
      const updatedConversations = state.conversations.map((c) => {
        if (c.id === message.conversationId) {
          return {
            ...c,
            lastMessage: message,
            lastMessageAt: message.createdAt,
            unreadCount: selectedConversationId === message.conversationId
              ? 0
              : (c.unreadCount || 0) + 1,
          }
        }
        return c
      }).sort((a, b) => {
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0
        return bTime - aTime
      })

      const totalUnread = updatedConversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0)

      return {
        messages: { ...state.messages, [message.conversationId]: updatedMessages },
        conversations: updatedConversations,
        totalUnread,
      }
    })
  },

  updateConversation: (conversation) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversation.id ? { ...c, ...conversation } : c
      ),
      selectedConversation: state.selectedConversation?.id === conversation.id
        ? { ...state.selectedConversation, ...conversation }
        : state.selectedConversation,
    }))
  },

  addConversation: (conversation) => {
    set((state) => {
      const exists = state.conversations.some((c) => c.id === conversation.id)
      if (exists) return state
      return {
        conversations: [conversation, ...state.conversations],
      }
    })
  },

  updateFilters: (filters) => {
    set((state) => ({
      filters: { ...state.filters, ...filters },
    }))
  },

  setConversations: (conversations) => {
    set({ conversations })
  },

  updateMessageStatus: (messageId, status) => {
    set((state) => {
      const updatedMessages = { ...state.messages }
      for (const conversationId in updatedMessages) {
        updatedMessages[conversationId] = updatedMessages[conversationId].map((m) =>
          m.id === messageId ? { ...m, status: status as Message['status'] } : m
        )
      }
      return { messages: updatedMessages }
    })
  },

  addLabel: async (conversationId, labelId) => {
    try {
      await conversationsApi.addLabel(conversationId, labelId)
      // Reload the conversation to get updated labels
      const response = await conversationsApi.get(conversationId)
      const updated = response.data.conversation || response.data
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === conversationId ? { ...c, labels: updated.labels } : c
        ),
        selectedConversation: state.selectedConversation?.id === conversationId
          ? { ...state.selectedConversation, labels: updated.labels }
          : state.selectedConversation,
      }))
    } catch (error) {
      throw error
    }
  },

  removeLabel: async (conversationId, labelId) => {
    try {
      await conversationsApi.removeLabel(conversationId, labelId)
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === conversationId
            ? { ...c, labels: c.labels.filter((l) => l.id !== labelId) }
            : c
        ),
        selectedConversation: state.selectedConversation?.id === conversationId
          ? {
              ...state.selectedConversation,
              labels: state.selectedConversation.labels.filter((l) => l.id !== labelId),
            }
          : state.selectedConversation,
      }))
    } catch (error) {
      throw error
    }
  },
}))
