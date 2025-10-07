import express from 'express';
const router = express.Router();
import * as recruiterController from './recruiterController.js';

// Public routes
// TODO: Add public routes here

// Protected routes
// Note: Authentication is already handled by recruiterMiddleware in routes.js

// File upload routes
router.post('/upload/profile-image', recruiterController.uploadSingle, recruiterController.uploadProfileImage);

// Profile management routes
router.get('/profile', recruiterController.getProfile);
router.post('/company-profile', recruiterController.addOrUpdateCompanyProfile);
router.post('/individual-profile', recruiterController.addOrUpdateIndividualProfile);
router.get('/company-profile', recruiterController.getCompanyProfile);
router.get('/individual-profile', recruiterController.getIndividualProfile);

// TODO: Add other protected routes here

export default router;
