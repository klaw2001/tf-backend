import { Server } from 'socket.io';
import { verifySocketToken } from './socketMiddleware.js';
import { handleChatEvents } from '../app/modules/chat/chatSocketHandler.js';
import { handleMeetingEvents } from '../app/modules/meeting/meetingSocketHandler.js';

let io;

export const initializeSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: ['http://localhost:3000', 'http://localhost:4000', 'https://stg-web.talentflip.ai','https://stg-app.talentflip.ai'],
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
    
    // Emit user_online event to notify others
    socket.broadcast.emit('user_online', {
      userId: socket.user.user_id,
      userName: socket.user.user_full_name,
      timestamp: new Date().toISOString()
    });
    
    // Handle chat events
    handleChatEvents(socket, io);
    
    // Handle meeting events
    handleMeetingEvents(socket, io);
    
    // Handle user going offline/disconnect
    socket.on('disconnect', () => {
      console.log(`❌ User disconnected: ${socket.user.user_id} - ${socket.user.user_full_name}`);
      
      // Emit user_offline event to notify others
      socket.broadcast.emit('user_offline', {
        userId: socket.user.user_id,
        userName: socket.user.user_full_name,
        timestamp: new Date().toISOString()
      });
    });
    
    // Manual set_online event (optional - for explicit online status)
    socket.on('set_online', () => {
      socket.broadcast.emit('user_online', {
        userId: socket.user.user_id,
        userName: socket.user.user_full_name,
        timestamp: new Date().toISOString()
      });
      socket.emit('online_status_set', { status: 'online' });
    });
    
    // Manual set_offline event (optional - for explicit offline/away status)
    socket.on('set_offline', () => {
      socket.broadcast.emit('user_offline', {
        userId: socket.user.user_id,
        userName: socket.user.user_full_name,
        timestamp: new Date().toISOString()
      });
      socket.emit('online_status_set', { status: 'offline' });
    });
    
    // Get online status of specific user
    socket.on('check_user_status', async (data) => {
      const { userId } = data;
      if (!userId) return;
      
      const userSockets = await io.in(`user:${userId}`).fetchSockets();
      const isOnline = userSockets.length > 0;
      
      socket.emit('user_status_response', {
        userId,
        isOnline,
        timestamp: new Date().toISOString()
      });
    });
    
    // Get online status of multiple users
    socket.on('check_multiple_users_status', async (data) => {
      const { userIds } = data;
      if (!Array.isArray(userIds)) return;
      
      const statuses = await Promise.all(
        userIds.map(async (userId) => {
          const userSockets = await io.in(`user:${userId}`).fetchSockets();
          return {
            userId,
            isOnline: userSockets.length > 0
          };
        })
      );
      
      socket.emit('multiple_users_status_response', {
        statuses,
        timestamp: new Date().toISOString()
      });
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

