import express from 'express';
const router = express.Router();
import * as talentController from './talentController.js';

// File upload routes
router.post('/upload/resume', talentController.uploadSingle, talentController.uploadResume);
router.post('/upload/profile-image', talentController.uploadSingle, talentController.uploadProfileImage);
router.post('/upload/project-image', talentController.uploadSingle, talentController.uploadProjectImage);

// Resume parsing route
router.post('/parse-resume', talentController.parseResume);

// Professional summary generation route
router.post('/generate-professional-summary', talentController.generateProfessionalSummary);

// Skill tiles generation route
router.post('/generate-skill-tiles', talentController.generateSkillTiles);

// Profile routes
router.get('/profile', talentController.getAllTalentProfile);
router.get('/projects', talentController.getAllTalentProjects);
router.get('/experience', talentController.getAllTalentExperience);
router.get('/availability', talentController.getAllTalentAvailability);
router.get('/reviews', talentController.getAllTalentReviews);
router.get('/skills', talentController.getAllTalentSkills);
router.get('/profile-percentage', talentController.getProfilePercentage);
// Save routes
router.post('/profile', talentController.saveTalentProfile);
router.post('/projects', talentController.saveTalentProjects);
router.post('/experience', talentController.saveTalentExperience);
router.post('/availability', talentController.saveTalentAvailability);
router.post('/reviews', talentController.saveTalentReviews);
router.post('/skills', talentController.saveTalentSkills);

// Intent management routes
router.get('/intents', talentController.getReceivedIntents);
router.post('/intents/:ritmId/accept', talentController.acceptIntent);
router.post('/intents/:ritmId/reject', talentController.rejectIntent);

export default router;
