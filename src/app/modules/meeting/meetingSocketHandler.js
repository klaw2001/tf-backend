import { PrismaClient } from '@prisma/client';
import { calculateDuration } from './meetingHelper.js';

const prisma = new PrismaClient();

/**
 * Handle meeting-related socket events
 * @param {Object} socket - Socket instance
 * @param {Object} io - Socket.io server instance
 */
export const handleMeetingEvents = (socket, io) => {
  
  // Join meeting room
  socket.on('join_meeting_room', async (data) => {
    try {
      const { meetingId } = data;
      
      if (!meetingId) {
        socket.emit('error', { message: 'Meeting ID is required' });
        return;
      }

      socket.join(`meeting:${meetingId}`);
      
      console.log(`✅ User ${socket.user.user_id} joined meeting room ${meetingId}`);
      
      // Notify others in the meeting
      socket.to(`meeting:${meetingId}`).emit('user_joined_meeting', {
        userId: socket.user.user_id,
        userName: socket.user.user_full_name,
        meetingId: parseInt(meetingId),
        timestamp: new Date().toISOString(),
      });

      // Send confirmation to user
      socket.emit('joined_meeting_room', {
        meetingId: parseInt(meetingId),
      });
    } catch (error) {
      console.error('Error joining meeting room:', error);
      socket.emit('error', { message: 'Failed to join meeting room' });
    }
  });

  // Leave meeting room
  socket.on('leave_meeting_room', async (data) => {
    try {
      const { meetingId } = data;
      
      if (!meetingId) {
        socket.emit('error', { message: 'Meeting ID is required' });
        return;
      }

      // Update participant left time and calculate duration
      const participant = await prisma.meeting_participant.findFirst({
        where: {
          meeting_id: parseInt(meetingId),
          user_id: socket.user.user_id,
        },
      });

      if (participant && participant.mp_joined_at) {
        const leftAt = new Date();
        const duration = calculateDuration(participant.mp_joined_at, leftAt);

        await prisma.meeting_participant.update({
          where: { mp_id: participant.mp_id },
          data: {
            mp_left_at: leftAt,
            mp_duration: duration,
          },
        });
      }

      socket.leave(`meeting:${meetingId}`);
      
      console.log(`❌ User ${socket.user.user_id} left meeting room ${meetingId}`);
      
      // Notify others
      socket.to(`meeting:${meetingId}`).emit('user_left_meeting', {
        userId: socket.user.user_id,
        userName: socket.user.user_full_name,
        meetingId: parseInt(meetingId),
        timestamp: new Date().toISOString(),
      });

      // Send confirmation to user
      socket.emit('left_meeting_room', {
        meetingId: parseInt(meetingId),
      });
    } catch (error) {
      console.error('Error leaving meeting room:', error);
      socket.emit('error', { message: 'Failed to leave meeting room' });
    }
  });

  // Participant muted/unmuted audio
  socket.on('meeting_audio_status', async (data) => {
    try {
      const { meetingId, isMuted } = data;
      
      if (!meetingId) {
        socket.emit('error', { message: 'Meeting ID is required' });
        return;
      }

      // Update participant status
      await prisma.meeting_participant.updateMany({
        where: {
          meeting_id: parseInt(meetingId),
          user_id: socket.user.user_id,
        },
        data: {
          mp_is_muted: isMuted,
        },
      });

      // Notify others
      socket.to(`meeting:${meetingId}`).emit('user_audio_status', {
        userId: socket.user.user_id,
        userName: socket.user.user_full_name,
        isMuted,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error updating audio status:', error);
    }
  });

  // Participant video on/off
  socket.on('meeting_video_status', async (data) => {
    try {
      const { meetingId, isVideoOn } = data;
      
      if (!meetingId) {
        socket.emit('error', { message: 'Meeting ID is required' });
        return;
      }

      // Update participant status
      await prisma.meeting_participant.updateMany({
        where: {
          meeting_id: parseInt(meetingId),
          user_id: socket.user.user_id,
        },
        data: {
          mp_is_video_on: isVideoOn,
        },
      });

      // Notify others
      socket.to(`meeting:${meetingId}`).emit('user_video_status', {
        userId: socket.user.user_id,
        userName: socket.user.user_full_name,
        isVideoOn,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error updating video status:', error);
    }
  });

  // Meeting recording started
  socket.on('meeting_recording_started', (data) => {
    try {
      const { meetingId } = data;
      
      if (!meetingId) {
        socket.emit('error', { message: 'Meeting ID is required' });
        return;
      }

      console.log(`🔴 Recording started for meeting ${meetingId} by ${socket.user.user_full_name}`);

      // Notify all participants
      io.to(`meeting:${meetingId}`).emit('recording_started', {
        meetingId: parseInt(meetingId),
        startedBy: socket.user.user_full_name,
        startedById: socket.user.user_id,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error handling recording started:', error);
    }
  });

  // Meeting recording stopped
  socket.on('meeting_recording_stopped', (data) => {
    try {
      const { meetingId } = data;
      
      if (!meetingId) {
        socket.emit('error', { message: 'Meeting ID is required' });
        return;
      }

      console.log(`⏹️  Recording stopped for meeting ${meetingId} by ${socket.user.user_full_name}`);

      // Notify all participants
      io.to(`meeting:${meetingId}`).emit('recording_stopped', {
        meetingId: parseInt(meetingId),
        stoppedBy: socket.user.user_full_name,
        stoppedById: socket.user.user_id,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error handling recording stopped:', error);
    }
  });

  // Screen sharing started
  socket.on('meeting_screen_share_started', (data) => {
    try {
      const { meetingId } = data;
      
      if (!meetingId) {
        socket.emit('error', { message: 'Meeting ID is required' });
        return;
      }

      // Notify others
      socket.to(`meeting:${meetingId}`).emit('user_screen_share_started', {
        userId: socket.user.user_id,
        userName: socket.user.user_full_name,
        meetingId: parseInt(meetingId),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error handling screen share started:', error);
    }
  });

  // Screen sharing stopped
  socket.on('meeting_screen_share_stopped', (data) => {
    try {
      const { meetingId } = data;
      
      if (!meetingId) {
        socket.emit('error', { message: 'Meeting ID is required' });
        return;
      }

      // Notify others
      socket.to(`meeting:${meetingId}`).emit('user_screen_share_stopped', {
        userId: socket.user.user_id,
        userName: socket.user.user_full_name,
        meetingId: parseInt(meetingId),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error handling screen share stopped:', error);
    }
  });

  // Hand raised
  socket.on('meeting_hand_raised', (data) => {
    try {
      const { meetingId } = data;
      
      if (!meetingId) {
        socket.emit('error', { message: 'Meeting ID is required' });
        return;
      }

      // Notify others
      socket.to(`meeting:${meetingId}`).emit('user_hand_raised', {
        userId: socket.user.user_id,
        userName: socket.user.user_full_name,
        meetingId: parseInt(meetingId),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error handling hand raised:', error);
    }
  });

  // Hand lowered
  socket.on('meeting_hand_lowered', (data) => {
    try {
      const { meetingId } = data;
      
      if (!meetingId) {
        socket.emit('error', { message: 'Meeting ID is required' });
        return;
      }

      // Notify others
      socket.to(`meeting:${meetingId}`).emit('user_hand_lowered', {
        userId: socket.user.user_id,
        userName: socket.user.user_full_name,
        meetingId: parseInt(meetingId),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error handling hand lowered:', error);
    }
  });
};

export default { handleMeetingEvents };

