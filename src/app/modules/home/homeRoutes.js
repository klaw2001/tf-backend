import express from 'express';
import { authMiddleware } from '../../../middleware/authMiddleware.js';
import homeController, { getUserProfile, updateUserProfile, getUserDashboard } from './homeController.js';
import router from '../auth/authRoutes.js';

router.route('/profile').get(homeController.getUserProfile)

export default router;
