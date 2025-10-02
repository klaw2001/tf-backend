import express from 'express';
const router = express.Router();
import * as adminController from './adminController.js';
import { authMiddleware } from '@/middleware/authMiddleware.js';
import { adminMiddleware } from '@/middleware/adminMiddleware.js';

// Public routes
// TODO: Add public routes here

// Protected routes
router.use(authMiddleware); // Apply authentication middleware to all routes below
router.use(adminMiddleware); // Apply admin middleware to all routes below

// TODO: Add admin routes here

export default router;
