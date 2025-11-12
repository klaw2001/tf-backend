import { PrismaClient } from '@prisma/client';
import { sendResponse } from '../../helpers/responseHelper.js';
import statusType from '../../enums/statusTypes.js';
import {
  getUserNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  
} from '../../helpers/notificationHelper.js';

const prisma = new PrismaClient();

/**
 * Get all notifications for logged in user
 * @route GET /api/common/notifications
 */
export const getAllNotifications = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { limit = 50, offset = 0, isRead } = req.query;

    // Parse isRead query parameter
    let isReadFilter = null;
    if (isRead === 'true') isReadFilter = true;
    if (isRead === 'false') isReadFilter = false;

    const notifications = await getUserNotifications(userId, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      isRead: isReadFilter,
    });

    const unreadCount = await getUnreadNotificationCount(userId);

    return sendResponse(
      res,
      'success',
      {
        notifications,
        unreadCount,
        total: notifications.length,
      },
      'Notifications fetched successfully',
      statusType.OK
    );
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return sendResponse(
      res,
      'error',
      null,
      'Failed to fetch notifications',
      statusType.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Get single notification by ID for logged in user
 * @route GET /api/common/notifications/:notificationId
 */
export const getSingleNotification = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { notificationId } = req.params;

    // Validate notificationId
    if (!notificationId || isNaN(notificationId)) {
      return sendResponse(
        res,
        'error',
        null,
        'Invalid notification ID',
        statusType.BAD_REQUEST
      );
    }

    const notification = await prisma.notification.findFirst({
      where: {
        notification_id: parseInt(notificationId),
        user_id: userId,
        status: true,
      },
    });

    if (!notification) {
      return sendResponse(
        res,
        'error',
        null,
        'Notification not found',
        statusType.NOT_FOUND
      );
    }

    return sendResponse(
      res,
      'success',
      { notification },
      'Notification fetched successfully',
      statusType.OK
    );
  } catch (error) {
    console.error('Error fetching single notification:', error);
    return sendResponse(
      res,
      'error',
      null,
      'Failed to fetch notification',
      statusType.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Mark notification as read
 * @route PATCH /api/common/notifications/:notificationId/read
 */
export const markAsRead = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { notificationId } = req.params;

    // Validate notificationId
    if (!notificationId || isNaN(notificationId)) {
      return sendResponse(
        res,
        'error',
        null,
        'Invalid notification ID',
        statusType.BAD_REQUEST
      );
    }

    // Check if notification belongs to user
    const notification = await prisma.notification.findFirst({
      where: {
        notification_id: parseInt(notificationId),
        user_id: userId,
        status: true,
      },
    });

    if (!notification) {
      return sendResponse(
        res,
        'error',
        null,
        'Notification not found',
        statusType.NOT_FOUND
      );
    }

    const updatedNotification = await markNotificationAsRead(parseInt(notificationId));

    return sendResponse(
      res,
      'success',
      { notification: updatedNotification },
      'Notification marked as read',
      statusType.OK
    );
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return sendResponse(
      res,
      'error',
      null,
      'Failed to mark notification as read',
      statusType.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Mark all notifications as read
 * @route PATCH /api/common/notifications/read-all
 */
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.user_id;

    const result = await markAllNotificationsAsRead(userId);

    return sendResponse(
      res,
      'success',
      { count: result.count },
      'All notifications marked as read',
      statusType.OK
    );
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return sendResponse(
      res,
      'error',
      null,
      'Failed to mark all notifications as read',
      statusType.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Get unread notification count
 * @route GET /api/common/notifications/unread/count
 */
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.user_id;

    const count = await getUnreadNotificationCount(userId);

    return sendResponse(
      res,
      'success',
      { count },
      'Unread notification count fetched successfully',
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
 * Get intent timeline - accessible to both talent and recruiter
 * @route GET /api/common/intent/timeline/:ritmId
 */
export const getIntentTimeline = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return sendResponse(res, 'error', null, 'User not authenticated', statusType.UNAUTHORIZED);
    }

    const { ritmId } = req.params;

    if (!ritmId) {
      return sendResponse(res, 'error', null, 'Intent mapping ID is required', statusType.BAD_REQUEST);
    }

    // Get the intent mapping with related data
    const mapping = await prisma.r_intent_talent_mapper.findFirst({
      where: {
        ritm_id: parseInt(ritmId),
        status: true
      },
      include: {
        r_intent: {
          include: {
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
          include: {
            user: {
              select: {
                user_id: true,
                user_full_name: true,
                user_email: true
              }
            }
          }
        },
        r_intent_timeline: {
          orderBy: { created_at: 'asc' },
          where: { status: true }
        }
      }
    });

    if (!mapping) {
      return sendResponse(res, 'error', null, 'Intent mapping not found', statusType.NOT_FOUND);
    }

    // Check if user has access to this intent (either talent or recruiter)
    const isTalent = mapping.t_profile.user.user_id === userId;
    const isRecruiter = mapping.r_intent.user.user_id === userId;

    if (!isTalent && !isRecruiter) {
      return sendResponse(res, 'error', null, 'Access denied', statusType.FORBIDDEN);
    }

    const responseData = {
      ritm_id: mapping.ritm_id,
      current_status: mapping.ritm_intent_status,
      intent_summary: {
        job_title: mapping.r_intent.ri_job_title,
        employment_type: mapping.r_intent.ri_employment_type,
        work_mode: mapping.r_intent.ri_work_mode,
        location: mapping.r_intent.ri_location,
        compensation: `${mapping.r_intent.ri_compensation_range} ${mapping.r_intent.ri_currency}`,
        experience_level: mapping.r_intent.ri_experience_level,
        intent_type: mapping.r_intent.ri_intent_type
      },
      recruiter: {
        user_id: mapping.r_intent.user.user_id,
        name: mapping.r_intent.user.user_full_name,
        email: mapping.r_intent.user.user_email
      },
      talent: {
        user_id: mapping.t_profile.user.user_id,
        name: mapping.t_profile.user.user_full_name,
        email: mapping.t_profile.user.user_email
      },
      agreement: {
        content: mapping.r_intent.ri_agreement_content,
        snapshot: mapping.ritm_agreement_snapshot,
        accepted_at: mapping.ritm_agreement_accepted_at,
        accepted_by: mapping.ritm_agreement_accepted_by,
        required: mapping.r_intent.ri_intent_type === 'WithAgreement'
      },
      timeline: mapping.r_intent_timeline.map(t => ({
        rit_id: t.rit_id,
        status: t.rit_status,
        notes: t.rit_notes,
        created_at: t.created_at,
        created_by: t.created_by
      }))
    };

    return sendResponse(res, 'success', responseData, 'Timeline retrieved successfully', statusType.OK);

  } catch (error) {
    console.error('Error getting intent timeline:', error);
    return sendResponse(res, 'error', { error: error.message }, 'Error getting intent timeline', statusType.INTERNAL_SERVER_ERROR);
  }
};

export default {
  getAllNotifications,
  getSingleNotification,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  getIntentTimeline,
};