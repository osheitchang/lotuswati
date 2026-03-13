import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function initSocket(token: string): Socket {
  if (socket) {
    socket.disconnect()
  }

  const backendUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace('/api', '')
  socket = io(backendUrl, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  })

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket?.id)
  })

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason)
  })

  socket.on('connect_error', (error) => {
    console.error('[Socket] Connection error:', error.message)
  })

  return socket
}

export function getSocket(): Socket | null {
  return socket
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

export type SocketEventHandlers = {
  'message:new': (data: { conversationId: string; message: any }) => void
  'message:status': (data: { messageId: string; status: string }) => void
  'conversation:created': (data: { conversation: any }) => void
  'conversation:updated': (data: { conversation: any }) => void
  'conversation:assigned': (data: { conversationId: string; agentId: string; agent: any }) => void
  'conversation:resolved': (data: { conversationId: string }) => void
  'broadcast:progress': (data: { broadcastId: string; sent: number; total: number }) => void
}

export function onSocketEvent<K extends keyof SocketEventHandlers>(
  event: K,
  handler: SocketEventHandlers[K]
): () => void {
  if (!socket) return () => {}
  socket.on(event as string, handler as any)
  return () => {
    socket?.off(event as string, handler as any)
  }
}
