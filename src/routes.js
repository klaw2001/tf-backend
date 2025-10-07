import express from 'express';
const router = express.Router();

// Import module routes
import authRoutes from './app/modules/auth/authRoutes.js';
import homeRoutes from './app/modules/home/homeRoutes.js';
import talentRoutes from './app/modules/talent/talentRoutes.js';
import recruiterRoutes from './app/modules/recruiter/recruiterRoutes.js';
import adminRoutes from './app/modules/admin/adminRoutes.js';
import datamanipRoutes from './app/modules/datamanip/datamanip.js';
import talentMiddleware from './middleware/talentMiddleware.js';
import recruiterMiddleware from './middleware/recruiterMiddleware.js';
import adminMiddleware from './middleware/adminMiddleware.js';
import { authMiddleware } from './middleware/authMiddleware.js';

// Health check route
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'TalentFlip API is running',
    timestamp: new Date().toISOString()
  });
});

// Module routes
router.use('/auth', authRoutes);
router.use('/home', authMiddleware, homeRoutes);
router.use('/talent', talentMiddleware, talentRoutes);
router.use('/recruiter', recruiterMiddleware, recruiterRoutes);
router.use('/admin', adminMiddleware, adminRoutes);
router.use('/danger',datamanipRoutes);

// TODO: Add more routes as needed

export default router;
