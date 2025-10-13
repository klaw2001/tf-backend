import { Server } from 'socket.io';
import { verifySocketToken } from './socketMiddleware.js';
import { handleChatEvents } from '../app/modules/chat/chatSocketHandler.js';

let io;

export const initializeSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: ['http://localhost:3000', 'http://localhost:4000', 'https://stg.talentflip.ai'],
      credentials: true,
      methods: ['GET', 'POST']
    },
    pingTimeout: 60000,
  });

  // Authentication middleware
  io.use(verifySocketToken);

  // Handle connections
  io.on('connection', (socket) => {
    console.log(`✅ User connected: ${socket.user.user_id} - ${socket.user.user_full_name}`);
    
    // Join user to their personal room
    socket.join(`user:${socket.user.user_id}`);
    
    // Handle chat events
    handleChatEvents(socket, io);
    
    socket.on('disconnect', () => {
      console.log(`❌ User disconnected: ${socket.user.user_id} - ${socket.user.user_full_name}`);
    });
  });

  console.log('🔌 Socket.io server initialized successfully');
  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};

