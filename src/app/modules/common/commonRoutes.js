import express from 'express';
const router = express.Router();
import * as commonController from './commonController.js';

// Notification routes
router.get('/notifications', commonController.getAllNotifications);
router.get('/notifications/unread/count', commonController.getUnreadCount);
router.get('/notifications/:notificationId', commonController.getSingleNotification);
router.patch('/notifications/:notificationId/read', commonController.markAsRead);
router.patch('/notifications/read-all', commonController.markAllAsRead);

// Intent timeline route (accessible to both talent and recruiter)
router.get('/intent/timeline/:ritmId', commonController.getIntentTimeline);

export default router;

