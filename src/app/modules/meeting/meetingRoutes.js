import express from 'express';
import {
  createMeeting,
  joinMeeting,
  endMeeting,
  getUserMeetings,
  getMeetingDetails,
  saveMeetingRecording,
  cancelMeeting,
} from './meetingController.js';


const router = express.Router();

// Meeting CRUD operations
router.post('/create', createMeeting);
router.post('/:meetingId/join', joinMeeting);
router.put('/:meetingId/end', endMeeting);
router.put('/:meetingId/cancel', cancelMeeting);
router.get('/list', getUserMeetings);
router.get('/:meetingId', getMeetingDetails);
router.post('/:meetingId/recording', saveMeetingRecording);

export default router;

