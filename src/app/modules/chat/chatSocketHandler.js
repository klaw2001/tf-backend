import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const handleChatEvents = (socket, io) => {
  
  // Join conversation room
  socket.on('join_conversation', async (data) => {
    try {
      const { conversationId } = data;
      
      // Validate conversationId
      if (!conversationId) {
        socket.emit('error', { message: 'Conversation ID is required' });
        console.error('Join conversation error: conversationId is missing', data);
        return;
      }

      // Parse conversationId to integer if it's a string
      const conversationIdInt = parseInt(conversationId);
      if (isNaN(conversationIdInt)) {
        socket.emit('error', { message: 'Invalid conversation ID format' });
        console.error('Join conversation error: conversationId is not a number', conversationId);
        return;
      }
      
      // Verify user has access to this conversation
      const conversation = await prisma.chat_conversation.findFirst({
        where: {
          cc_id: conversationIdInt,
          OR: [
            { recruiter_user_id: socket.user.user_id },
            { talent_user_id: socket.user.user_id }
          ],
          status: true
        }
      });

      if (conversation) {
        socket.join(`conversation:${conversationIdInt}`);
        socket.emit('joined_conversation', { conversationId: conversationIdInt });
        console.log(`✅ User ${socket.user.user_id} joined conversation ${conversationIdInt}`);
      } else {
        socket.emit('error', { message: 'Conversation not found or access denied' });
        console.error(`❌ User ${socket.user.user_id} failed to join conversation ${conversationIdInt} - not found`);
      }
    } catch (error) {
      console.error('Error joining conversation:', error);
      socket.emit('error', { message: 'Failed to join conversation', details: error.message });
    }
  });

  // Send message
  socket.on('send_message', async (data) => {
    try {
      const { conversationId, message, messageType = 'Text', fileUrl = null } = data;
      console.log('send_message', data);
      
      // Add validation
      if (!conversationId) {
        socket.emit('error', { message: 'Conversation ID is required' });
        console.error('Send message error: conversationId is missing', data);
        return;
      }
      console.log({message});
      
      if (!message || typeof message !== 'string' || message.trim() === '') {
        socket.emit('error', { message: 'Message cannot be empty' });
        console.error('Send message error: message is invalid', data);
        return;
      }

      // Parse conversationId to integer if it's a string
      const conversationIdInt = parseInt(conversationId);
      if (isNaN(conversationIdInt)) {
        socket.emit('error', { message: 'Invalid conversation ID format' });
        console.error('Send message error: conversationId is not a number', conversationId);
        return;
      }
      
      // Verify conversation access
      const conversation = await prisma.chat_conversation.findFirst({
        where: {
          cc_id: conversationIdInt,
          OR: [
            { recruiter_user_id: socket.user.user_id },
            { talent_user_id: socket.user.user_id }
          ],
          status: true
        }
      });

      if (!conversation) {
        socket.emit('error', { message: 'Conversation not found or access denied' });
        console.error(`Conversation ${conversationIdInt} not found for user ${socket.user.user_id}`);
        return;
      }

      const trimmedMessage = message.trim();

      // Create message
      const newMessage = await prisma.$transaction(async (tx) => {
        const msg = await tx.chat_message.create({
          data: {
            cc_id: conversationIdInt,
            sender_user_id: socket.user.user_id,
            cm_message: trimmedMessage,
            cm_message_type: messageType,
            cm_file_url: fileUrl,
          },
          include: {
            chat_conversation: true
          }
        });

        // Update conversation
        const isRecruiter = conversation.recruiter_user_id === socket.user.user_id;
        await tx.chat_conversation.update({
          where: { cc_id: conversationIdInt },
          data: {
            cc_last_message: trimmedMessage.substring(0, 255),
            cc_last_message_at: new Date(),
            ...(isRecruiter 
              ? { cc_unread_count_talent: { increment: 1 } }
              : { cc_unread_count_recruiter: { increment: 1 } }
            )
          }
        });

        return msg;
      });

      console.log(`Message sent in conversation ${conversationIdInt} by user ${socket.user.user_id}`);

      // Emit to conversation room
      io.to(`conversation:${conversationIdInt}`).emit('new_message', {
        message: {
          ...newMessage,
          sender: {
            user_id: socket.user.user_id,
            user_full_name: socket.user.user_full_name
          }
        }
      });

      // Emit to recipient's personal room for notification
      const recipientUserId = conversation.recruiter_user_id === socket.user.user_id 
        ? conversation.talent_user_id 
        : conversation.recruiter_user_id;
      
      io.to(`user:${recipientUserId}`).emit('message_notification', {
        conversationId: conversationIdInt,
        message: trimmedMessage.substring(0, 50),
        sender_name: socket.user.user_full_name
      });

    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message', details: error.message });
    }
  });

  // Mark messages as read
  socket.on('mark_as_read', async (data) => {
    try {
      const { conversationId } = data;
      
      // Validate conversationId
      if (!conversationId) {
        socket.emit('error', { message: 'Conversation ID is required' });
        console.error('Mark as read error: conversationId is missing', data);
        return;
      }

      // Parse conversationId to integer if it's a string
      const conversationIdInt = parseInt(conversationId);
      if (isNaN(conversationIdInt)) {
        socket.emit('error', { message: 'Invalid conversation ID format' });
        console.error('Mark as read error: conversationId is not a number', conversationId);
        return;
      }
      
      const conversation = await prisma.chat_conversation.findFirst({
        where: {
          cc_id: conversationIdInt,
          OR: [
            { recruiter_user_id: socket.user.user_id },
            { talent_user_id: socket.user.user_id }
          ]
        }
      });

      if (!conversation) {
        console.error(`Conversation ${conversationIdInt} not found for user ${socket.user.user_id}`);
        return;
      }

      const isRecruiter = conversation.recruiter_user_id === socket.user.user_id;

      // Mark unread messages as read
      await prisma.$transaction(async (tx) => {
        await tx.chat_message.updateMany({
          where: {
            cc_id: conversationIdInt,
            sender_user_id: { not: socket.user.user_id },
            cm_is_read: false
          },
          data: {
            cm_is_read: true,
            cm_read_at: new Date()
          }
        });

        await tx.chat_conversation.update({
          where: { cc_id: conversationIdInt },
          data: isRecruiter 
            ? { cc_unread_count_recruiter: 0 }
            : { cc_unread_count_talent: 0 }
        });
      });

      console.log(`Messages marked as read in conversation ${conversationIdInt} by user ${socket.user.user_id}`);
      socket.emit('messages_marked_read', { conversationId: conversationIdInt });
      
      // Notify the other user that messages were read
      const recipientUserId = conversation.recruiter_user_id === socket.user.user_id 
        ? conversation.talent_user_id 
        : conversation.recruiter_user_id;
      
      io.to(`user:${recipientUserId}`).emit('messages_read', { conversationId: conversationIdInt });
      
    } catch (error) {
      console.error('Error marking messages as read:', error);
      socket.emit('error', { message: 'Failed to mark messages as read', details: error.message });
    }
  });

  // Typing indicator
  socket.on('typing', (data) => {
    const { conversationId } = data;
    socket.to(`conversation:${conversationId}`).emit('user_typing', {
      userId: socket.user.user_id,
      userName: socket.user.user_full_name,
      conversationId
    });
  });

  socket.on('stop_typing', (data) => {
    const { conversationId } = data;
    socket.to(`conversation:${conversationId}`).emit('user_stop_typing', {
      userId: socket.user.user_id,
      conversationId
    });
  });

  // Leave conversation room
  socket.on('leave_conversation', (data) => {
    const { conversationId } = data;
    socket.leave(`conversation:${conversationId}`);
    console.log(`User ${socket.user.user_id} left conversation ${conversationId}`);
  });
};

