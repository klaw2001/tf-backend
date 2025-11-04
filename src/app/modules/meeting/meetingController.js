import { PrismaClient } from '@prisma/client';
import { sendResponse } from '../../helpers/responseHelper.js';
import statusType from '../../enums/statusTypes.js';
import { generateJitsiToken, generateRoomName, calculateDuration } from './meetingHelper.js';
import { JITSI_CONFIG } from '../../../config/index.js';
import { createNotification } from '../../helpers/notificationHelper.js';
import { getIO } from '../../../socket/socketServer.js';
import { sendNotificationEmail } from '../../helpers/emailHelper.js';

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

    // Prepare final list of participant user IDs
    let finalParticipantUserIds = [];

    // If conversationId is provided, automatically add the other participant from the conversation
    if (conversationId) {
      try {
        const conversation = await prisma.chat_conversation.findUnique({
          where: { cc_id: parseInt(conversationId) },
          select: {
            recruiter_user_id: true,
            talent_user_id: true,
          },
        });

        if (conversation) {
          // Determine the other participant (not the host)
          let otherParticipantId = null;
          if (hostUserId === conversation.recruiter_user_id) {
            // Host is recruiter, so the other participant is the talent
            otherParticipantId = conversation.talent_user_id;
          } else if (hostUserId === conversation.talent_user_id) {
            // Host is talent, so the other participant is the recruiter
            otherParticipantId = conversation.recruiter_user_id;
          }

          // Add the other participant to the list if found
          if (otherParticipantId && otherParticipantId !== hostUserId) {
            finalParticipantUserIds.push(otherParticipantId);
            console.log(`✅ Auto-added other participant (${otherParticipantId}) from conversation ${conversationId}`);
          }
        }
      } catch (convError) {
        console.error('Error fetching conversation:', convError);
        // Continue even if conversation fetch fails
      }
    }

    // Add manually provided participant user IDs (avoid duplicates)
    if (participantUserIds && Array.isArray(participantUserIds) && participantUserIds.length > 0) {
      const validUserIds = participantUserIds
        .map(id => parseInt(id))
        .filter(id => !isNaN(id) && id > 0 && id !== hostUserId); // Exclude host

      // Add to final list, avoiding duplicates
      validUserIds.forEach(userId => {
        if (!finalParticipantUserIds.includes(userId)) {
          finalParticipantUserIds.push(userId);
        }
      });
    }

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
      if (finalParticipantUserIds.length > 0) {
        await Promise.all(
          finalParticipantUserIds.map((userId) =>
            tx.meeting_participant.create({
              data: {
                meeting_id: newMeeting.meeting_id,
                user_id: userId,
                mp_role: 'Participant',
              },
            })
          )
        );
      }

      // Create chat message for meeting history if linked to conversation
      if (conversationId) {
        await tx.chat_message.create({
          data: {
            cc_id: parseInt(conversationId),
            sender_user_id: hostUserId,
            cm_message: `Meeting scheduled: ${title}`,
            cm_message_type: 'Meeting',
            cm_file_url: `/meeting/${newMeeting.meeting_id}`,
            cm_is_delivered: true,
            cm_delivered_at: new Date(),
          }
        });

        // Update conversation last message
        await tx.chat_conversation.update({
          where: { cc_id: parseInt(conversationId) },
          data: {
            cc_last_message: `📅 Meeting: ${title}`,
            cc_last_message_at: new Date(),
          }
        });
      }

      return newMeeting;
    });

    // Send notifications to all participants (including auto-added ones)
    if (finalParticipantUserIds.length > 0) {
      const io = getIO();
      
      for (const userId of finalParticipantUserIds) {
        try {
          // Get participant details for email
          const participant = await prisma.user.findUnique({
            where: { user_id: parseInt(userId) },
            select: {
              user_full_name: true,
              user_email: true,
            }
          });

          if (participant) {
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

            // Send email notification
            const meetingUrl = `${process.env.FRONTEND_URL || 'http://localhost:4000'}/meeting/${meeting.meeting_id}`;
            const scheduledTime = scheduledAt 
              ? `<p><strong>Scheduled for:</strong> ${new Date(scheduledAt).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</p>`
              : '<p><strong>Type:</strong> Instant Meeting - Join Now!</p>';

            await sendNotificationEmail(
              participant.user_email,
              participant.user_full_name,
              `Meeting Invitation: ${title}`,
              '📅 You have been invited to a meeting',
              `
                <p><strong>${req.user.user_full_name}</strong> has invited you to a meeting:</p>
                
                <div style="background-color: white; padding: 20px; border-left: 4px solid #4F46E5; margin: 20px 0; border-radius: 4px;">
                  <h3 style="margin-top: 0; color: #4F46E5;">${title}</h3>
                  ${description ? `<p style="color: #6b7280;">${description}</p>` : ''}
                  ${scheduledTime}
                </div>
                
                <p>Click the button below to view meeting details and join when ready:</p>
              `,
              'View Meeting Details',
              meetingUrl
            );

            console.log(`✅ Meeting invitation sent to ${participant.user_email}`);
          }
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

