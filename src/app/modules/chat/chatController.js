import { PrismaClient } from '@prisma/client';
import { sendResponse } from '../../helpers/responseHelper.js';
import statusType from '../../enums/statusTypes.js';

const prisma = new PrismaClient();

/**
 * Get all conversations for logged-in user
 * @route GET /api/chat/conversations
 */
export const getConversations = async (req, res) => {
  try {
    const userId = req.user.user_id;

    const conversations = await prisma.chat_conversation.findMany({
      where: {
        OR: [
          { recruiter_user_id: userId },
          { talent_user_id: userId }
        ],
        status: true
      },
      include: {
        r_intent_talent_mapper: {
          include: {
            r_intent: {
              select: {
                ri_id: true,
                ri_job_title: true,
                ri_intent_type: true,
                user_id: true,
                user: {
                  select: {
                    user_id: true,
                    user_full_name: true,
                    user_email: true
                  }
                }
              }
            },
            t_profile: {
              select: {
                tp_id: true,
                tp_image: true,
                tp_designation: true,
                user_id: true,
                user: {
                  select: {
                    user_id: true,
                    user_full_name: true,
                    user_email: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        cc_last_message_at: 'desc'
      }
    });

    // Format conversations
    const formattedConversations = conversations.map(conv => {
      const isRecruiter = conv.recruiter_user_id === userId;
      const otherUser = isRecruiter 
        ? conv.r_intent_talent_mapper.t_profile.user 
        : conv.r_intent_talent_mapper.r_intent.user;
      
      const otherUserProfile = isRecruiter
        ? {
            tp_id: conv.r_intent_talent_mapper.t_profile.tp_id,
            tp_image: conv.r_intent_talent_mapper.t_profile.tp_image,
            tp_designation: conv.r_intent_talent_mapper.t_profile.tp_designation
          }
        : null;

      return {
        conversationId: conv.cc_id,
        ritmId: conv.ritm_id,
        otherUser: {
          ...otherUser,
          ...otherUserProfile
        },
        jobTitle: conv.r_intent_talent_mapper.r_intent.ri_job_title,
        intentType: conv.r_intent_talent_mapper.r_intent.ri_intent_type,
        agreementRequired: conv.r_intent_talent_mapper.r_intent.ri_intent_type === 'WithAgreement',
        lastMessage: conv.cc_last_message,
        lastMessageAt: conv.cc_last_message_at,
        unreadCount: isRecruiter 
          ? conv.cc_unread_count_recruiter 
          : conv.cc_unread_count_talent,
        isRecruiter,
        createdAt: conv.created_at
      };
    });

    return sendResponse(
      res, 
      'success', 
      { conversations: formattedConversations }, 
      'Conversations fetched successfully', 
      statusType.OK
    );
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return sendResponse(
      res, 
      'error', 
      null, 
      'Failed to fetch conversations', 
      statusType.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Get single conversation by ID
 * @route GET /api/chat/conversations/:conversationId
 */
export const getSingleConversation = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { conversationId } = req.params;

    // Validate conversationId
    if (!conversationId || isNaN(conversationId)) {
      return sendResponse(
        res,
        'error',
        null,
        'Invalid conversation ID',
        statusType.BAD_REQUEST
      );
    }

    const conversation = await prisma.chat_conversation.findFirst({
      where: {
        cc_id: parseInt(conversationId),
        OR: [
          { recruiter_user_id: userId },
          { talent_user_id: userId }
        ],
        status: true
      },
      include: {
        r_intent_talent_mapper: {
          include: {
            r_intent: {
              select: {
                ri_id: true,
                ri_job_title: true,
                ri_job_description: true,
                ri_intent_type: true,
                ri_agreement_content: true,
                user_id: true,
                user: {
                  select: {
                    user_id: true,
                    user_full_name: true,
                    user_email: true
                  }
                }
              }
            },
            t_profile: {
              select: {
                tp_id: true,
                tp_image: true,
                tp_designation: true,
                user_id: true,
                user: {
                  select: {
                    user_id: true,
                    user_full_name: true,
                    user_email: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!conversation) {
      return sendResponse(
        res,
        'error',
        null,
        'Conversation not found',
        statusType.NOT_FOUND
      );
    }

    const isRecruiter = conversation.recruiter_user_id === userId;
    const otherUser = isRecruiter 
      ? conversation.r_intent_talent_mapper.t_profile.user 
      : conversation.r_intent_talent_mapper.r_intent.user;

    const formattedConversation = {
      conversationId: conversation.cc_id,
      ritmId: conversation.ritm_id,
      otherUser,
      jobTitle: conversation.r_intent_talent_mapper.r_intent.ri_job_title,
      jobDescription: conversation.r_intent_talent_mapper.r_intent.ri_job_description,
      intentType: conversation.r_intent_talent_mapper.r_intent.ri_intent_type,
      agreement: {
        required: conversation.r_intent_talent_mapper.r_intent.ri_intent_type === 'WithAgreement',
        content: conversation.r_intent_talent_mapper.r_intent.ri_agreement_content,
        snapshot: conversation.r_intent_talent_mapper.ritm_agreement_snapshot,
        accepted_at: conversation.r_intent_talent_mapper.ritm_agreement_accepted_at,
        accepted_by: conversation.r_intent_talent_mapper.ritm_agreement_accepted_by
      },
      lastMessage: conversation.cc_last_message,
      lastMessageAt: conversation.cc_last_message_at,
      unreadCount: isRecruiter 
        ? conversation.cc_unread_count_recruiter 
        : conversation.cc_unread_count_talent,
      isRecruiter,
      createdAt: conversation.created_at
    };

    return sendResponse(
      res,
      'success',
      { conversation: formattedConversation },
      'Conversation fetched successfully',
      statusType.OK
    );
  } catch (error) {
    console.error('Error fetching conversation:', error);
    return sendResponse(
      res,
      'error',
      null,
      'Failed to fetch conversation',
      statusType.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Get messages for a conversation
 * @route GET /api/chat/conversations/:conversationId/messages
 */
export const getMessages = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { conversationId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    // Validate conversationId
    if (!conversationId || isNaN(conversationId)) {
      return sendResponse(
        res,
        'error',
        null,
        'Invalid conversation ID',
        statusType.BAD_REQUEST
      );
    }

    // Verify access
    const conversation = await prisma.chat_conversation.findFirst({
      where: {
        cc_id: parseInt(conversationId),
        OR: [
          { recruiter_user_id: userId },
          { talent_user_id: userId }
        ],
        status: true
      }
    });

    if (!conversation) {
      return sendResponse(
        res, 
        'error', 
        null, 
        'Conversation not found', 
        statusType.NOT_FOUND
      );
    }

    const messages = await prisma.chat_message.findMany({
      where: {
        cc_id: parseInt(conversationId),
        status: true
      },
      orderBy: {
        created_at: 'desc'
      },
      take: parseInt(limit),
      skip: parseInt(offset)
    });

    const totalMessages = await prisma.chat_message.count({
      where: {
        cc_id: parseInt(conversationId),
        status: true
      }
    });

    return sendResponse(
      res, 
      'success', 
      { 
        messages: messages.reverse(), 
        total: totalMessages,
        hasMore: totalMessages > (parseInt(offset) + parseInt(limit))
      }, 
      'Messages fetched successfully', 
      statusType.OK
    );
  } catch (error) {
    console.error('Error fetching messages:', error);
    return sendResponse(
      res, 
      'error', 
      null, 
      'Failed to fetch messages', 
      statusType.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Get total unread message count for user
 * @route GET /api/chat/unread-count
 */
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.user_id;

    // Get user's role to determine which field to sum
    const user = await prisma.user.findUnique({
      where: { user_id: userId },
      select: { role_id: true }
    });

    if (!user) {
      return sendResponse(
        res,
        'error',
        null,
        'User not found',
        statusType.NOT_FOUND
      );
    }

    // Role IDs: 2 = talent, 3 = recruiter (adjust based on your role setup)
    const isRecruiter = user.role_id === 3;

    const conversations = await prisma.chat_conversation.findMany({
      where: {
        OR: [
          { recruiter_user_id: userId },
          { talent_user_id: userId }
        ],
        status: true
      },
      select: {
        cc_unread_count_recruiter: true,
        cc_unread_count_talent: true,
        recruiter_user_id: true
      }
    });

    const totalUnread = conversations.reduce((sum, conv) => {
      const isUserRecruiter = conv.recruiter_user_id === userId;
      return sum + (isUserRecruiter ? conv.cc_unread_count_recruiter : conv.cc_unread_count_talent);
    }, 0);

    return sendResponse(
      res,
      'success',
      { unreadCount: totalUnread },
      'Unread count fetched successfully',
      statusType.OK
    );
  } catch (error) {
    console.error('Error fetching unread count:', error);
    return sendResponse(
      res,
      'error',
      null,
      'Failed to fetch unread count',
      statusType.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Get all meetings for a conversation
 * @route GET /api/chat/conversation/:conversationId/meetings
 */
export const getChatMeetings = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.user_id;

    // Verify user has access to this conversation
    const conversation = await prisma.chat_conversation.findFirst({
      where: {
        cc_id: parseInt(conversationId),
        OR: [
          { recruiter_user_id: userId },
          { talent_user_id: userId }
        ],
        status: true
      }
    });

    if (!conversation) {
      return sendResponse(res, 'error', null, 'Conversation not found', statusType.NOT_FOUND);
    }

    // Get all meetings for this conversation
    const meetings = await prisma.meeting.findMany({
      where: {
        cc_id: parseInt(conversationId),
        status: true
      },
      include: {
        host_user: {
          select: {
            user_id: true,
            user_full_name: true,
            user_email: true,
          }
        },
        meeting_participants: {
          include: {
            user: {
              select: {
                user_id: true,
                user_full_name: true,
                user_email: true,
              }
            }
          }
        },
        meeting_recordings: {
          select: {
            mr_id: true,
            mr_file_name: true,
            mr_file_url: true,
            mr_duration: true,
            mr_format: true,
            created_at: true,
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    return sendResponse(
      res,
      'success',
      { meetings, total: meetings.length },
      'Meetings fetched successfully',
      statusType.OK
    );
  } catch (error) {
    console.error('Error fetching chat meetings:', error);
    return sendResponse(
      res,
      'error',
      null,
      'Failed to fetch meetings',
      statusType.INTERNAL_SERVER_ERROR
    );
  }
};

export default {
  getConversations,
  getSingleConversation,
  getMessages,
  getUnreadCount,
  getChatMeetings
};

