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


export default {
  getAllNotifications,
  getSingleNotification,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
};