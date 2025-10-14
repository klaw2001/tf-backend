import { PrismaClient } from '@prisma/client';
import { sendResponse } from '../../helpers/responseHelper.js';
import statusType from '../../enums/statusTypes.js';
import { generateJitsiToken, generateRoomName, calculateDuration } from './meetingHelper.js';
import { JITSI_CONFIG } from '../../../config/index.js';
import { createNotification } from '../../helpers/notificationHelper.js';
import { getIO } from '../../../socket/socketServer.js';

const prisma = new PrismaClient();

/**
 * Create a new meeting
 * @route POST /api/meeting/create
 */
export const createMeeting = async (req, res) => {
  try {
    const {
      title,
      description,
      conversationId,
      scheduledAt,
      participantUserIds,
      password,
      enableRecording
    } = req.body;

    const hostUserId = req.user.user_id;

    // Generate unique room name
    const roomName = generateRoomName();

    // Create meeting
    const meeting = await prisma.$transaction(async (tx) => {
      const newMeeting = await tx.meeting.create({
        data: {
          meeting_room_name: roomName,
          meeting_title: title,
          meeting_description: description,
          cc_id: conversationId ? parseInt(conversationId) : null,
          host_user_id: hostUserId,
          meeting_scheduled_at: scheduledAt ? new Date(scheduledAt) : null,
          meeting_password: password || null,
          is_recording_enabled: enableRecording || false,
          meeting_status: scheduledAt ? 'Scheduled' : 'InProgress',
        },
      });

      // Add host as participant
      await tx.meeting_participant.create({
        data: {
          meeting_id: newMeeting.meeting_id,
          user_id: hostUserId,
          mp_role: 'Host',
        },
      });

      // Add other participants
      if (participantUserIds && Array.isArray(participantUserIds)) {
        await Promise.all(
          participantUserIds.map((userId) =>
            tx.meeting_participant.create({
              data: {
                meeting_id: newMeeting.meeting_id,
                user_id: parseInt(userId),
                mp_role: 'Participant',
              },
            })
          )
        );
      }

      return newMeeting;
    });

    // Send notifications to participants
    if (participantUserIds && Array.isArray(participantUserIds)) {
      const io = getIO();
      
      for (const userId of participantUserIds) {
        try {
          // Create in-app notification
          await createNotification(
            parseInt(userId),
            'meeting_invitation',
            `Meeting invitation from ${req.user.user_full_name}`,
            `You've been invited to: ${title}`,
            null
          );

          // Send socket notification
          io.to(`user:${userId}`).emit('meeting_invitation', {
            meetingId: meeting.meeting_id,
            hostName: req.user.user_full_name,
            title,
            scheduledAt,
          });
        } catch (notifError) {
          console.error(`Error sending notification to user ${userId}:`, notifError);
        }
      }
    }

    return sendResponse(
      res,
      'success',
      {
        meeting: {
          ...meeting,
          jitsiDomain: JITSI_CONFIG.domain,
        },
      },
      'Meeting created successfully',
      statusType.CREATED
    );
  } catch (error) {
    console.error('Error creating meeting:', error);
    return sendResponse(
      res,
      'error',
      null,
      'Failed to create meeting',
      statusType.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Join a meeting - Get Jitsi token
 * @route POST /api/meeting/:meetingId/join
 */
export const joinMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user.user_id;

    // Get meeting and participant info
    const meeting = await prisma.meeting.findUnique({
      where: { meeting_id: parseInt(meetingId) },
      include: {
        meeting_participants: {
          where: { user_id: userId },
        },
      },
    });

    if (!meeting) {
      return sendResponse(res, 'error', null, 'Meeting not found', statusType.NOT_FOUND);
    }

    if (meeting.meeting_status === 'Cancelled') {
      return sendResponse(res, 'error', null, 'Meeting has been cancelled', statusType.BAD_REQUEST);
    }

    if (meeting.meeting_status === 'Completed') {
      return sendResponse(res, 'error', null, 'Meeting has ended', statusType.BAD_REQUEST);
    }

    // Check if user is a participant
    const participant = meeting.meeting_participants[0];
    if (!participant && meeting.host_user_id !== userId) {
      return sendResponse(res, 'error', null, 'You are not invited to this meeting', statusType.FORBIDDEN);
    }

    // Determine role
    const role = participant?.mp_role || (meeting.host_user_id === userId ? 'Host' : 'Participant');

    // Generate Jitsi JWT token
    const jitsiToken = generateJitsiToken(req.user, meeting.meeting_room_name, role);

    // Update participant join time
    if (participant) {
      await prisma.meeting_participant.update({
        where: { mp_id: participant.mp_id },
        data: { mp_joined_at: new Date() },
      });
    }

    // Update meeting status to InProgress if it was Scheduled
    if (meeting.meeting_status === 'Scheduled') {
      await prisma.meeting.update({
        where: { meeting_id: meeting.meeting_id },
        data: {
          meeting_status: 'InProgress',
          meeting_started_at: new Date(),
        },
      });
    }

    return sendResponse(
      res,
      'success',
      {
        jitsiToken,
        roomName: meeting.meeting_room_name,
        jitsiDomain: JITSI_CONFIG.domain,
        jitsiAppId: JITSI_CONFIG.appId,
        role,
        meeting: {
          meeting_id: meeting.meeting_id,
          title: meeting.meeting_title,
          description: meeting.meeting_description,
          isRecordingEnabled: meeting.is_recording_enabled,
        },
      },
      'Joined meeting successfully',
      statusType.OK
    );
  } catch (error) {
    console.error('Error joining meeting:', error);
    return sendResponse(
      res,
      'error',
      null,
      'Failed to join meeting',
      statusType.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * End a meeting
 * @route PUT /api/meeting/:meetingId/end
 */
export const endMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user.user_id;

    const meeting = await prisma.meeting.findUnique({
      where: { meeting_id: parseInt(meetingId) },
    });

    if (!meeting) {
      return sendResponse(res, 'error', null, 'Meeting not found', statusType.NOT_FOUND);
    }

    // Only host can end meeting
    if (meeting.host_user_id !== userId) {
      return sendResponse(res, 'error', null, 'Only host can end the meeting', statusType.FORBIDDEN);
    }

    const endedAt = new Date();
    const duration = meeting.meeting_started_at
      ? calculateDuration(meeting.meeting_started_at, endedAt)
      : null;

    // Update meeting
    const updatedMeeting = await prisma.meeting.update({
      where: { meeting_id: parseInt(meetingId) },
      data: {
        meeting_status: 'Completed',
        meeting_ended_at: endedAt,
        meeting_duration: duration,
      },
    });

    // Notify all participants
    try {
      const io = getIO();
      io.to(`meeting:${meetingId}`).emit('meeting_ended', {
        meetingId: meeting.meeting_id,
        endedAt,
      });
    } catch (socketError) {
      console.error('Error sending socket notification:', socketError);
    }

    return sendResponse(
      res,
      'success',
      { meeting: updatedMeeting },
      'Meeting ended successfully',
      statusType.OK
    );
  } catch (error) {
    console.error('Error ending meeting:', error);
    return sendResponse(
      res,
      'error',
      null,
      'Failed to end meeting',
      statusType.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Get user's meetings
 * @route GET /api/meeting/list
 */
export const getUserMeetings = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { status, limit = 50, offset = 0 } = req.query;

    const where = {
      status: true,
      OR: [
        { host_user_id: userId },
        {
          meeting_participants: {
            some: { user_id: userId },
          },
        },
      ],
    };

    if (status) {
      where.meeting_status = status;
    }

    const meetings = await prisma.meeting.findMany({
      where,
      include: {
        host_user: {
          select: {
            user_id: true,
            user_full_name: true,
            user_email: true,
          },
        },
        meeting_participants: {
          include: {
            user: {
              select: {
                user_id: true,
                user_full_name: true,
                user_email: true,
              },
            },
          },
        },
        meeting_recordings: true,
      },
      orderBy: {
        created_at: 'desc',
      },
      take: parseInt(limit),
      skip: parseInt(offset),
    });

    return sendResponse(
      res,
      'success',
      { meetings, total: meetings.length },
      'Meetings fetched successfully',
      statusType.OK
    );
  } catch (error) {
    console.error('Error fetching meetings:', error);
    return sendResponse(
      res,
      'error',
      null,
      'Failed to fetch meetings',
      statusType.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Get single meeting details
 * @route GET /api/meeting/:meetingId
 */
export const getMeetingDetails = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user.user_id;

    const meeting = await prisma.meeting.findUnique({
      where: { meeting_id: parseInt(meetingId) },
      include: {
        host_user: {
          select: {
            user_id: true,
            user_full_name: true,
            user_email: true,
          },
        },
        meeting_participants: {
          include: {
            user: {
              select: {
                user_id: true,
                user_full_name: true,
                user_email: true,
              },
            },
          },
        },
        meeting_recordings: true,
      },
    });

    if (!meeting) {
      return sendResponse(res, 'error', null, 'Meeting not found', statusType.NOT_FOUND);
    }

    // Check if user has access
    const hasAccess = meeting.host_user_id === userId || 
                     meeting.meeting_participants.some(p => p.user_id === userId);

    if (!hasAccess) {
      return sendResponse(res, 'error', null, 'Access denied', statusType.FORBIDDEN);
    }

    return sendResponse(
      res,
      'success',
      { meeting },
      'Meeting details fetched successfully',
      statusType.OK
    );
  } catch (error) {
    console.error('Error fetching meeting details:', error);
    return sendResponse(
      res,
      'error',
      null,
      'Failed to fetch meeting details',
      statusType.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Save meeting recording
 * @route POST /api/meeting/:meetingId/recording
 */
export const saveMeetingRecording = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { fileName, fileUrl, fileSize, duration, format, startedAt, endedAt } = req.body;

    const recording = await prisma.meeting_recording.create({
      data: {
        meeting_id: parseInt(meetingId),
        mr_file_name: fileName,
        mr_file_url: fileUrl,
        mr_file_size: fileSize ? BigInt(fileSize) : null,
        mr_duration: duration || null,
        mr_format: format || 'mp4',
        mr_started_at: startedAt ? new Date(startedAt) : new Date(),
        mr_ended_at: endedAt ? new Date(endedAt) : null,
      },
    });

    // Update meeting with recording URL
    await prisma.meeting.update({
      where: { meeting_id: parseInt(meetingId) },
      data: { recording_url: fileUrl },
    });

    return sendResponse(
      res,
      'success',
      { recording },
      'Recording saved successfully',
      statusType.CREATED
    );
  } catch (error) {
    console.error('Error saving recording:', error);
    return sendResponse(
      res,
      'error',
      null,
      'Failed to save recording',
      statusType.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Cancel a meeting
 * @route PUT /api/meeting/:meetingId/cancel
 */
export const cancelMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user.user_id;

    const meeting = await prisma.meeting.findUnique({
      where: { meeting_id: parseInt(meetingId) },
      include: {
        meeting_participants: true,
      },
    });

    if (!meeting) {
      return sendResponse(res, 'error', null, 'Meeting not found', statusType.NOT_FOUND);
    }

    // Only host can cancel meeting
    if (meeting.host_user_id !== userId) {
      return sendResponse(res, 'error', null, 'Only host can cancel the meeting', statusType.FORBIDDEN);
    }

    // Update meeting status
    const updatedMeeting = await prisma.meeting.update({
      where: { meeting_id: parseInt(meetingId) },
      data: { meeting_status: 'Cancelled' },
    });

    // Notify all participants
    try {
      const io = getIO();
      
      for (const participant of meeting.meeting_participants) {
        await createNotification(
          participant.user_id,
          'meeting_cancelled',
          'Meeting Cancelled',
          `The meeting "${meeting.meeting_title}" has been cancelled`,
          null
        );

        io.to(`user:${participant.user_id}`).emit('meeting_cancelled', {
          meetingId: meeting.meeting_id,
          title: meeting.meeting_title,
        });
      }
    } catch (notifError) {
      console.error('Error sending cancellation notifications:', notifError);
    }

    return sendResponse(
      res,
      'success',
      { meeting: updatedMeeting },
      'Meeting cancelled successfully',
      statusType.OK
    );
  } catch (error) {
    console.error('Error cancelling meeting:', error);
    return sendResponse(
      res,
      'error',
      null,
      'Failed to cancel meeting',
      statusType.INTERNAL_SERVER_ERROR
    );
  }
};

export default {
  createMeeting,
  joinMeeting,
  endMeeting,
  getUserMeetings,
  getMeetingDetails,
  saveMeetingRecording,
  cancelMeeting,
};

