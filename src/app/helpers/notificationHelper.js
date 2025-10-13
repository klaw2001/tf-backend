import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Create a notification for a user
 * @param {Number} userId - The user ID to send notification to
 * @param {String} notificationName - Name/type of the notification
 * @param {String} notificationHeading - Heading of the notification
 * @param {String} notificationText - Text content of the notification
 * @param {String} notificationImage - Optional image URL for the notification
 * @returns {Promise<Object>} Created notification object
 */
export const createNotification = async (
  userId,
  notificationName,
  notificationHeading,
  notificationText,
  notificationImage = null
) => {
  try {
    const notification = await prisma.notification.create({
      data: {
        user_id: userId,
        notification_name: notificationName,
        notification_heading: notificationHeading,
        notification_text: notificationText,
        notification_image: notificationImage,
        is_read: false,
        status: true,
      },
    });

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

/**
 * Create multiple notifications at once
 * @param {Array<Object>} notifications - Array of notification objects
 * @returns {Promise<Object>} Created notifications
 */
export const createBulkNotifications = async (notifications) => {
  try {
    const result = await prisma.notification.createMany({
      data: notifications.map((notif) => ({
        user_id: notif.userId,
        notification_name: notif.notificationName,
        notification_heading: notif.notificationHeading,
        notification_text: notif.notificationText,
        notification_image: notif.notificationImage || null,
        is_read: false,
        status: true,
      })),
    });

    return result;
  } catch (error) {
    console.error('Error creating bulk notifications:', error);
    throw error;
  }
};

/**
 * Mark notification as read
 * @param {Number} notificationId - The notification ID to mark as read
 * @returns {Promise<Object>} Updated notification object
 */
export const markNotificationAsRead = async (notificationId) => {
  try {
    const notification = await prisma.notification.update({
      where: { notification_id: notificationId },
      data: { is_read: true },
    });

    return notification;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

/**
 * Mark all notifications as read for a user
 * @param {Number} userId - The user ID
 * @returns {Promise<Object>} Updated notifications count
 */
export const markAllNotificationsAsRead = async (userId) => {
  try {
    const result = await prisma.notification.updateMany({
      where: {
        user_id: userId,
        is_read: false,
      },
      data: { is_read: true },
    });

    return result;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
};

/**
 * Get all notifications for a user
 * @param {Number} userId - The user ID
 * @param {Object} options - Query options (limit, offset, isRead filter)
 * @returns {Promise<Array>} Array of notifications
 */
export const getUserNotifications = async (userId, options = {}) => {
  try {
    const { limit = 50, offset = 0, isRead = null } = options;

    const where = {
      user_id: userId,
      status: true,
    };

    if (isRead !== null) {
      where.is_read = isRead;
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    });

    return notifications;
  } catch (error) {
    console.error('Error getting user notifications:', error);
    throw error;
  }
};

/**
 * Get unread notification count for a user
 * @param {Number} userId - The user ID
 * @returns {Promise<Number>} Count of unread notifications
 */
export const getUnreadNotificationCount = async (userId) => {
  try {
    const count = await prisma.notification.count({
      where: {
        user_id: userId,
        is_read: false,
        status: true,
      },
    });

    return count;
  } catch (error) {
    console.error('Error getting unread notification count:', error);
    throw error;
  }
};

/**
 * Delete a notification
 * @param {Number} notificationId - The notification ID to delete
 * @returns {Promise<Object>} Deleted notification object
 */
export const deleteNotification = async (notificationId) => {
  try {
    const notification = await prisma.notification.update({
      where: { notification_id: notificationId },
      data: { status: false },
    });

    return notification;
  } catch (error) {
    console.error('Error deleting notification:', error);
    throw error;
  }
};

export default {
  createNotification,
  createBulkNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUserNotifications,
  getUnreadNotificationCount,
  deleteNotification,
};

