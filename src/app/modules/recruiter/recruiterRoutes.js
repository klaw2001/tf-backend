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

// Talent management routes
router.get('/talents/search', recruiterController.searchTalents);
router.get('/talents/:talentId', recruiterController.getTalentProfile);
router.post('/talents/favourite', recruiterController.addFavouriteTalent);

// Intent management routes
router.post('/intents/agreement/draft', recruiterController.generateIntentAgreementDraft);
router.post('/intents', recruiterController.saveIntent);
router.get('/intents', recruiterController.getIntents);
router.get('/intents/:intentId', recruiterController.getIntentById);
router.post('/intents/:intentId/send', recruiterController.sendIntentToTalents);
router.get('/intents/stats', recruiterController.getIntentStats);
router.post('/intents/timeline/:ritmId/start-project', recruiterController.markProjectStart);
router.get('/intents/timeline/:ritmId', recruiterController.getIntentTimeline);

// Service management routes
router.get('/services', recruiterController.getServices);
router.get('/services/:serviceId', recruiterController.getServiceById);
router.get('/purchases', recruiterController.getPurchaseHistory);

// Payment routes
router.post('/payment/create-checkout-session', recruiterController.createPaymentIntent);

// TODO: Add other protected routes here

export default router;
