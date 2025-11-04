import express from 'express';
import * as chatController from './chatController.js';

const router = express.Router();

// Get all conversations for logged-in user
router.get('/conversations', chatController.getConversations);

// Get single conversation
router.get('/conversations/:conversationId', chatController.getSingleConversation);

// Get messages for a conversation
router.get('/conversations/:conversationId/messages', chatController.getMessages);

// Get meetings for a conversation
router.get('/conversation/:conversationId/meetings', chatController.getChatMeetings);

// Get total unread count
router.get('/unread-count', chatController.getUnreadCount);

export default router;

