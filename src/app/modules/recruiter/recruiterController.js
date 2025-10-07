import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { sendResponse } from '../../helpers/responseHelper.js';
import statusType from '../../enums/statusTypes.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadType = req.query.type; // 'profile-image'
    let uploadPath;
    
    if (uploadType === 'profile-image') {
      uploadPath = path.join(__dirname, '../../../../public/uploads/recruiter/profile-images');
    } else {
      return cb(new Error('Invalid upload type. Must be "profile-image"'), false);
    }
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExtension = path.extname(file.originalname);
    const fileName = `${file.fieldname}-${uniqueSuffix}${fileExtension}`;
    cb(null, fileName);
  }
});

// File filter for allowed file types
const fileFilter = (req, file, cb) => {
  const uploadType = req.query.type;
  
  if (uploadType === 'profile-image') {
    // Allow image files for profile images
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and GIF images are allowed for profile images'), false);
    }
  } else {
    cb(new Error('Invalid upload type'), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Middleware for single file upload
export const uploadSingle = upload.single('file');

// Profile image upload
export const uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return sendResponse(res, 'error', null, 'No file uploaded', statusType.BAD_REQUEST);
    }

    const userId = req.user?.user_id;
    if (!userId) {
      return sendResponse(res, 'error', null, 'User not authenticated', statusType.UNAUTHORIZED);
    }

    const { rp_type } = req.body;
    if (!rp_type || !['company', 'individual'].includes(rp_type)) {
      return sendResponse(res, 'error', null, 'rp_type is required and must be either "company" or "individual"', statusType.BAD_REQUEST);
    }

    const filePath = req.file.path;
    const fileName = req.file.filename;
    const originalName = req.file.originalname;
    const fileSize = req.file.size;

    // Convert absolute path to relative path from /uploads
    const uploadsIndex = filePath.indexOf('/uploads/');
    const relativePath = uploadsIndex !== -1 ? filePath.substring(uploadsIndex + 1) : filePath.replace(/\\/g, '/');

    // Check if recruiter profile exists, if not create one
    let recruiterProfile = await prisma.r_profile.findFirst({
      where: { user_id: userId }
    });

    if (!recruiterProfile) {
      // Create new recruiter profile
      recruiterProfile = await prisma.r_profile.create({
        data: {
          user_id: userId,
          rp_profile_image: relativePath,
          rp_type: rp_type,
          created_by: userId.toString()
        }
      });
    } else {
      // Update existing recruiter profile
      recruiterProfile = await prisma.r_profile.update({
        where: { rp_id: recruiterProfile.rp_id },
        data: { 
          rp_profile_image: relativePath,
          rp_type: rp_type,
          updated_at: new Date(),
          updated_by: userId.toString()
        }
      });
    }

    const fileData = {
      fileName: fileName,
      originalName: originalName,
      filePath: relativePath,
      fileSize: fileSize,
      uploadType: 'profile-image',
      profileId: recruiterProfile.rp_id,
      rp_type: rp_type
    };

    return sendResponse(res, 'success', fileData, 'Profile image uploaded successfully', statusType.SUCCESS);
  } catch (error) {
    console.error('Error uploading profile image:', error);
    return sendResponse(res, 'error', { error: error.message }, 'Error uploading profile image', statusType.INTERNAL_SERVER_ERROR);
  }
};

export const register = async (req, res) => {
  // TODO: Implement recruiter registration
  res.json({ message: 'Recruiter registration endpoint' });
};

export const login = async (req, res) => {
  // TODO: Implement recruiter login
  res.json({ message: 'Recruiter login endpoint' });
};

// Company Profile Management
export const addOrUpdateCompanyProfile = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return sendResponse(res, 'error', null, 'User not authenticated', statusType.UNAUTHORIZED);
    }

    const { rc_name, rc_website, rc_industry, rc_size, rc_role, rc_description } = req.body;

    if (!rc_name) {
      return sendResponse(res, 'error', null, 'Company name is required', statusType.BAD_REQUEST);
    }

    // Check if recruiter profile exists
    let recruiterProfile = await prisma.r_profile.findFirst({
      where: { user_id: userId }
    });

    if (!recruiterProfile) {
      return sendResponse(res, 'error', null, 'Recruiter profile not found. Please upload a profile image first.', statusType.BAD_REQUEST);
    }

    // Check if company profile already exists
    const existingCompanyProfile = await prisma.r_company_profile.findFirst({
      where: { rp_id: recruiterProfile.rp_id }
    });

    let companyProfile;
    if (existingCompanyProfile) {
      // Update existing company profile
      companyProfile = await prisma.r_company_profile.update({
        where: { rc_id: existingCompanyProfile.rc_id },
        data: {
          rc_name,
          rc_website,
          rc_industry,
          rc_size,
          rc_role,
          rc_description,
          updated_at: new Date(),
          updated_by: userId.toString()
        }
      });
    } else {
      // Create new company profile
      companyProfile = await prisma.r_company_profile.create({
        data: {
          rp_id: recruiterProfile.rp_id,
          rc_name,
          rc_website,
          rc_industry,
          rc_size,
          rc_role,
          rc_description,
          created_by: userId.toString()
        }
      });
    }

    return sendResponse(res, 'success', companyProfile, 'Company profile saved successfully', statusType.SUCCESS);
  } catch (error) {
    console.error('Error saving company profile:', error);
    return sendResponse(res, 'error', { error: error.message }, 'Error saving company profile', statusType.INTERNAL_SERVER_ERROR);
  }
};

// Individual Profile Management
export const addOrUpdateIndividualProfile = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return sendResponse(res, 'error', null, 'User not authenticated', statusType.UNAUTHORIZED);
    }

    const { ri_full_name, ri_email, ri_mobile, ri_linkedin_url, ri_portfolio_url, ri_about } = req.body;

    if (!ri_full_name || !ri_email) {
      return sendResponse(res, 'error', null, 'Full name and email are required', statusType.BAD_REQUEST);
    }

    // Check if recruiter profile exists
    let recruiterProfile = await prisma.r_profile.findFirst({
      where: { user_id: userId }
    });

    if (!recruiterProfile) {
      return sendResponse(res, 'error', null, 'Recruiter profile not found. Please upload a profile image first.', statusType.BAD_REQUEST);
    }

    // Check if individual profile already exists
    const existingIndividualProfile = await prisma.r_individual_profile.findFirst({
      where: { rp_id: recruiterProfile.rp_id }
    });

    let individualProfile;
    if (existingIndividualProfile) {
      // Update existing individual profile
      individualProfile = await prisma.r_individual_profile.update({
        where: { ri_id: existingIndividualProfile.ri_id },
        data: {
          ri_full_name,
          ri_email,
          ri_mobile,
          ri_linkedin_url,
          ri_portfolio_url,
          ri_about,
          updated_at: new Date(),
          updated_by: userId.toString()
        }
      });
    } else {
      // Create new individual profile
      individualProfile = await prisma.r_individual_profile.create({
        data: {
          rp_id: recruiterProfile.rp_id,
          ri_full_name,
          ri_email,
          ri_mobile,
          ri_linkedin_url,
          ri_portfolio_url,
          ri_about,
          created_by: userId.toString()
        }
      });
    }

    return sendResponse(res, 'success', individualProfile, 'Individual profile saved successfully', statusType.SUCCESS);
  } catch (error) {
    console.error('Error saving individual profile:', error);
    return sendResponse(res, 'error', { error: error.message }, 'Error saving individual profile', statusType.INTERNAL_SERVER_ERROR);
  }
};

// Get Company Profile
export const getCompanyProfile = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return sendResponse(res, 'error', null, 'User not authenticated', statusType.UNAUTHORIZED);
    }

    const recruiterProfile = await prisma.r_profile.findFirst({
      where: { user_id: userId }
    });

    if (!recruiterProfile) {
      return sendResponse(res, 'error', null, 'Recruiter profile not found', statusType.NOT_FOUND);
    }

    const companyProfile = await prisma.r_company_profile.findFirst({
      where: { rp_id: recruiterProfile.rp_id }
    });

    if (!companyProfile) {
      return sendResponse(res, 'error', null, 'Company profile not found', statusType.NOT_FOUND);
    }

    return sendResponse(res, 'success', companyProfile, 'Company profile retrieved successfully', statusType.SUCCESS);
  } catch (error) {
    console.error('Error getting company profile:', error);
    return sendResponse(res, 'error', { error: error.message }, 'Error getting company profile', statusType.INTERNAL_SERVER_ERROR);
  }
};

// Get Individual Profile
export const getIndividualProfile = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return sendResponse(res, 'error', null, 'User not authenticated', statusType.UNAUTHORIZED);
    }

    const recruiterProfile = await prisma.r_profile.findFirst({
      where: { user_id: userId }
    });

    if (!recruiterProfile) {
      return sendResponse(res, 'error', null, 'Recruiter profile not found', statusType.NOT_FOUND);
    }

    const individualProfile = await prisma.r_individual_profile.findFirst({
      where: { rp_id: recruiterProfile.rp_id }
    });

    if (!individualProfile) {
      return sendResponse(res, 'error', null, 'Individual profile not found', statusType.NOT_FOUND);
    }

    return sendResponse(res, 'success', individualProfile, 'Individual profile retrieved successfully', statusType.SUCCESS);
  } catch (error) {
    console.error('Error getting individual profile:', error);
    return sendResponse(res, 'error', { error: error.message }, 'Error getting individual profile', statusType.INTERNAL_SERVER_ERROR);
  }
};

// Get Recruiter Profile (main profile with type)
export const getProfile = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return sendResponse(res, 'error', null, 'User not authenticated', statusType.UNAUTHORIZED);
    }

    const recruiterProfile = await prisma.r_profile.findFirst({
      where: { user_id: userId },
      include: {
        r_company_profile: true,
        r_individual_profile: true
      }
    });

    if (!recruiterProfile) {
      return sendResponse(res, 'error', null, 'Recruiter profile not found', statusType.NOT_FOUND);
    }

    return sendResponse(res, 'success', recruiterProfile, 'Recruiter profile retrieved successfully', statusType.SUCCESS);
  } catch (error) {
    console.error('Error getting recruiter profile:', error);
    return sendResponse(res, 'error', { error: error.message }, 'Error getting recruiter profile', statusType.INTERNAL_SERVER_ERROR);
  }
};

export const updateProfile = async (req, res) => {
  // TODO: Implement update recruiter profile
  res.json({ message: 'Update recruiter profile endpoint' });
};

export const deleteProfile = async (req, res) => {
  // TODO: Implement delete recruiter profile
  res.json({ message: 'Delete recruiter profile endpoint' });
};

export const getJobs = async (req, res) => {
  // TODO: Implement get recruiter jobs
  res.json({ message: 'Get recruiter jobs endpoint' });
};

export const createJob = async (req, res) => {
  // TODO: Implement create job posting
  res.json({ message: 'Create job posting endpoint' });
};

export const updateJob = async (req, res) => {
  // TODO: Implement update job posting
  res.json({ message: 'Update job posting endpoint' });
};

export const deleteJob = async (req, res) => {
  // TODO: Implement delete job posting
  res.json({ message: 'Delete job posting endpoint' });
};

export const getApplications = async (req, res) => {
  // TODO: Implement get job applications
  res.json({ message: 'Get job applications endpoint' });
};

export const updateApplicationStatus = async (req, res) => {
  // TODO: Implement update application status
  res.json({ message: 'Update application status endpoint' });
};

export const searchTalents = async (req, res) => {
  // TODO: Implement search talents
  res.json({ message: 'Search talents endpoint' });
};

export const getTalentProfile = async (req, res) => {
  // TODO: Implement get talent profile
  res.json({ message: 'Get talent profile endpoint' });
};

export const getNotifications = async (req, res) => {
  // TODO: Implement get notifications
  res.json({ message: 'Get notifications endpoint' });
};

export const markNotificationAsRead = async (req, res) => {
  // TODO: Implement mark notification as read
  res.json({ message: 'Mark notification as read endpoint' });
};

export const getDashboard = async (req, res) => {
  // TODO: Implement get dashboard
  res.json({ message: 'Get dashboard endpoint' });
};

export const createPaymentIntent = async (req, res) => {
  // TODO: Implement create Stripe payment intent
  res.json({ message: 'Create payment intent endpoint' });
};

export const handleStripeWebhook = async (req, res) => {
  // TODO: Implement handle Stripe webhook
  res.json({ message: 'Handle Stripe webhook endpoint' });
};

export const forgotPassword = async (req, res) => {
  // TODO: Implement forgot password
  res.json({ message: 'Forgot password endpoint' });
};

export const resetPassword = async (req, res) => {
  // TODO: Implement reset password
  res.json({ message: 'Reset password endpoint' });
};

export default {
  // File upload
  uploadSingle,
  uploadProfileImage,
  
  // Profile management
  getProfile,
  addOrUpdateCompanyProfile,
  addOrUpdateIndividualProfile,
  getCompanyProfile,
  getIndividualProfile,
  
  // Auth
  register,
  login,
  updateProfile,
  deleteProfile,
  forgotPassword,
  resetPassword,
  
  // Job management
  getJobs,
  createJob,
  updateJob,
  deleteJob,
  getApplications,
  updateApplicationStatus,
  
  // Talent management
  searchTalents,
  getTalentProfile,
  
  // Notifications
  getNotifications,
  markNotificationAsRead,
  
  // Dashboard
  getDashboard,
  
  // Payment
  createPaymentIntent,
  handleStripeWebhook
};
