import express from 'express';
import { signup, signupOld, signin, uploadResumeMiddleware } from './authController.js';


const router = express.Router();

// New signup with resume upload (for talents)
router.post('/signup', uploadResumeMiddleware, signup);

// Old signup with manual entry (for recruiters or fallback)
router.post('/signup-old', signupOld);

router.post('/signin', signin);

export default router;
