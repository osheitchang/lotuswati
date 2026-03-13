import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

interface AuthPayload {
  id: string;
  email: string;
  teamId: string;
  role: string;
}

interface SocketWithAuth extends Socket {
  user?: AuthPayload;
}

let io: Server;

function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Authentication middleware
  io.use((socket: SocketWithAuth, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    try {
      const jwtSecret = process.env.JWT_SECRET || 'lotuswati-super-secret-key-change-in-production';
      const decoded = jwt.verify(token, jwtSecret) as AuthPayload;
      socket.user = decoded;
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket: SocketWithAuth) => {
    const user = socket.user!;
    console.log(`[Socket] User connected: ${user.email} (${socket.id})`);

    // Automatically join the team room on connection
    socket.join(`team:${user.teamId}`);
    console.log(`[Socket] ${user.email} joined room team:${user.teamId}`);

    // Join team room explicitly
    socket.on('join_team', (data: { teamId: string }) => {
      if (data.teamId === user.teamId) {
        socket.join(`team:${data.teamId}`);
        socket.emit('joined_team', { teamId: data.teamId });
        console.log(`[Socket] ${user.email} joined team room: ${data.teamId}`);
      } else {
        socket.emit('error', { message: 'Unauthorized: Cannot join another team room' });
      }
    });

    // Join specific conversation room
    socket.on('join_conversation', (data: { conversationId: string }) => {
      const roomName = `conversation:${data.conversationId}`;
      socket.join(roomName);
      socket.emit('joined_conversation', { conversationId: data.conversationId });
      console.log(`[Socket] ${user.email} joined conversation room: ${data.conversationId}`);
    });

    // Leave a conversation room
    socket.on('leave_conversation', (data: { conversationId: string }) => {
      const roomName = `conversation:${data.conversationId}`;
      socket.leave(roomName);
      socket.emit('left_conversation', { conversationId: data.conversationId });
      console.log(`[Socket] ${user.email} left conversation room: ${data.conversationId}`);
    });

    // Typing indicators
    socket.on('typing_start', (data: { conversationId: string }) => {
      socket.to(`conversation:${data.conversationId}`).emit('agent_typing', {
        conversationId: data.conversationId,
        agentId: user.id,
        agentName: user.email,
      });
    });

    socket.on('typing_stop', (data: { conversationId: string }) => {
      socket.to(`conversation:${data.conversationId}`).emit('agent_stopped_typing', {
        conversationId: data.conversationId,
        agentId: user.id,
      });
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      console.log(`[Socket] User disconnected: ${user.email} (${socket.id}). Reason: ${reason}`);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`[Socket] Error for ${user.email}:`, error);
    });
  });

  return io;
}

function getIO(): Server {
  if (!io) {
    throw new Error('Socket.io has not been initialized. Call initSocket first.');
  }
  return io;
}

export { io, initSocket, getIO };
