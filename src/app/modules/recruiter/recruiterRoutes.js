import express from 'express';
const router = express.Router();
import * as recruiterController from './recruiterController.js';
import { authMiddleware } from '../../../middleware/authMiddleware.js';

// Public routes
// TODO: Add public routes here

// Protected routes
router.use(authMiddleware); // Apply authentication middleware to all routes below

// TODO: Add protected routes here

export default router;
