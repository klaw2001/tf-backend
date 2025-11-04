import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { sendResponse } from '../../helpers/responseHelper.js';
import statusType from '../../enums/statusTypes.js';
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, FRONTEND_URL } from '../../../config/index.js';
import { createNotification } from '../../helpers/notificationHelper.js';

const prisma = new PrismaClient();
const stripe = new Stripe(STRIPE_SECRET_KEY);

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
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return sendResponse(res, 'error', null, 'User not authenticated', statusType.UNAUTHORIZED);
    }

    // Extract query parameters
    const {
      page = 1,
      limit = 6,
      skills,
      location,
      experience_level,
      availability,
      min_rate,
      max_rate,
      sort_by = 'relevance',
      search_query
    } = req.query;

    // Convert page and limit to numbers
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    // Build where clause for filtering
    const whereClause = {
      status: true,
      user: {
        is_active: true,
        is_deleted: false,
        is_blocked: false,
        is_suspended: false,
        user_role: {
          role_name: 'talent'
        }
      }
    };

    // Add skills filter
    if (skills) {
      const skillsArray = skills.split(',').map(skill => skill.trim());
      whereClause.t_skills = {
        some: {
          ts_skill: {
            in: skillsArray,
            mode: 'insensitive'
          },
          status: true
        }
      };
    }

    // Add location filter
    if (location && location !== 'All Locations') {
      whereClause.tp_location = {
        contains: location,
        mode: 'insensitive'
      };
    }

    // Add experience level filter
    if (experience_level && experience_level !== 'All Levels') {
      const experienceMap = {
        'Junior': { min: 0, max: 3 },
        'Mid': { min: 3, max: 7 },
        'Senior': { min: 7, max: 12 },
        'Lead': { min: 12, max: 999 }
      };
      
      if (experienceMap[experience_level]) {
        const { min, max } = experienceMap[experience_level];
        whereClause.tp_total_experience = {
          gte: min.toString(),
          lte: max.toString()
        };
      }
    }

    // Add availability filter
    if (availability && availability !== 'All Types') {
      const availabilityMap = {
        'Full-time': { ta_full_time: true },
        'Part-time': { ta_part_time: true },
        'Consulting': { ta_consulting: true }
      };
      
      if (availabilityMap[availability]) {
        whereClause.t_availability = {
          some: {
            ...availabilityMap[availability],
            status: true
          }
        };
      }
    }

    // Add rate range filter
    if (min_rate || max_rate) {
      const rateFilter = {
        some: {
          status: true
        }
      };

      if (min_rate) {
        rateFilter.some.OR = [
          { ta_full_min_salary: { gte: parseInt(min_rate) } },
          { ta_part_min_salary: { gte: parseInt(min_rate) } },
          { ta_consulting_min_salary: { gte: parseInt(min_rate) } }
        ];
      }

      if (max_rate) {
        if (rateFilter.some.OR) {
          rateFilter.some.AND = [
            { OR: rateFilter.some.OR },
            {
              OR: [
                { ta_full_max_salary: { lte: parseInt(max_rate) } },
                { ta_part_max_salary: { lte: parseInt(max_rate) } },
                { ta_consulting_max_salary: { lte: parseInt(max_rate) } }
              ]
            }
          ];
          delete rateFilter.some.OR;
        } else {
          rateFilter.some.OR = [
            { ta_full_max_salary: { lte: parseInt(max_rate) } },
            { ta_part_max_salary: { lte: parseInt(max_rate) } },
            { ta_consulting_max_salary: { lte: parseInt(max_rate) } }
          ];
        }
      }

      whereClause.t_availability = rateFilter;
    }

    // Add search query filter
    if (search_query) {
      whereClause.OR = [
        { tp_designation: { contains: search_query, mode: 'insensitive' } },
        { tp_about: { contains: search_query, mode: 'insensitive' } },
        { tp_professional_summary: { contains: search_query, mode: 'insensitive' } },
        { user: { user_full_name: { contains: search_query, mode: 'insensitive' } } }
      ];
    }

    // Build order by clause
    let orderBy = {};
    switch (sort_by) {
      case 'experience':
        orderBy = { tp_total_experience: 'desc' };
        break;
      case 'location':
        orderBy = { tp_location: 'asc' };
        break;
      case 'recent':
        orderBy = { updated_at: 'desc' };
        break;
      case 'relevance':
      default:
        orderBy = { updated_at: 'desc' };
        break;
    }

    // Get total count for pagination
    const totalCount = await prisma.t_profile.count({
      where: whereClause
    });

    // Get talents with pagination
    const talents = await prisma.t_profile.findMany({
      where: whereClause,
      orderBy,
      skip: offset,
      take: limitNum,
      select: {
        tp_id: true,
        tp_designation: true,
        tp_location: true,
        tp_total_experience: true,
        tp_about: true,
        tp_professional_summary: true,
        tp_image: true,
        updated_at: true,
        user: {
          select: {
            user_id: true,
            user_full_name: true,
            user_email: true
          }
        },
        t_skills: {
          where: { status: true },
          select: {
            ts_skill: true
          },
          take: 5
        },
        t_availability: {
          where: { status: true },
          select: {
            ta_full_time: true,
            ta_full_min_salary: true,
            ta_full_max_salary: true,
            ta_part_time: true,
            ta_part_min_salary: true,
            ta_part_max_salary: true,
            ta_consulting: true,
            ta_consulting_min_salary: true,
            ta_consulting_max_salary: true,
            ta_work_location: true
          }
        },
        t_reviews: {
          where: { status: true },
          select: {
            tr_rating: true
          }
        }
      }
    });

    // Get user's favourite talents
    const favouriteTalents = await prisma.r_favourite_talents.findMany({
      where: {
        user_id: userId,
        status: true
      },
      select: {
        tp_id: true
      }
    });

    // Create a Set of favourite talent IDs for quick lookup
    const favouriteTalentIds = new Set(favouriteTalents.map(fav => fav.tp_id));

    // Transform data to match frontend requirements
    const transformedTalents = talents.map(talent => {
      // Calculate profile strength (simplified calculation)
      let profileStrength = 0;
      if (talent.tp_designation) profileStrength += 20;
      if (talent.tp_about) profileStrength += 20;
      if (talent.tp_professional_summary) profileStrength += 15;
      if (talent.tp_image) profileStrength += 10;
      if (talent.t_skills.length > 0) profileStrength += 15;
      if (talent.t_availability.length > 0) profileStrength += 10;
      if (talent.t_reviews.length > 0) profileStrength += 10;

      // Calculate average rating
      const avgRating = talent.t_reviews.length > 0 
        ? talent.t_reviews.reduce((sum, review) => sum + review.tr_rating, 0) / talent.t_reviews.length 
        : 0;

      // Determine employment type and rate
      const availability = talent.t_availability[0];
      let employmentType = 'Not specified';
      let rateRange = 'Not specified';

      if (availability) {
        const types = [];
        const rates = [];

        if (availability.ta_full_time && availability.ta_full_min_salary && availability.ta_full_max_salary) {
          types.push('Full-time');
          rates.push(`$${availability.ta_full_min_salary}k-${availability.ta_full_max_salary}k`);
        }
        if (availability.ta_part_time && availability.ta_part_min_salary && availability.ta_part_max_salary) {
          types.push('Part-time');
          rates.push(`$${availability.ta_part_min_salary}k-${availability.ta_part_max_salary}k (PT)`);
        }
        if (availability.ta_consulting && availability.ta_consulting_min_salary && availability.ta_consulting_max_salary) {
          types.push('Consulting');
          rates.push(`$${availability.ta_consulting_min_salary}-${availability.ta_consulting_max_salary}/hr`);
        }

        employmentType = types.join(' & ') || 'Not specified';
        rateRange = rates.join(' • ') || 'Not specified';
      }

      // Format experience summary
      const experienceSummary = `${talent.tp_total_experience}+ years • ${talent.tp_location || 'Location not specified'}`;

      // Get skills for display
      const displaySkills = talent.t_skills.slice(0, 4).map(skill => skill.ts_skill);
      const remainingSkills = talent.t_skills.length - 4;

      return {
        tp_id: talent.tp_id,
        user_name: talent.user.user_full_name,
        experience_summary: experienceSummary,
        description: talent.tp_professional_summary || talent.tp_about || 'No description available',
        skills: displaySkills,
        remaining_skills_count: remainingSkills > 0 ? remainingSkills : 0,
        profile_strength: `${profileStrength}%`,
        employment_type: employmentType,
        rate_range: rateRange,
        profile_image: talent.tp_image,
        user_email: talent.user.user_email,
        last_updated: talent.updated_at,
        average_rating: avgRating,
        total_reviews: talent.t_reviews.length,
        work_location: availability?.ta_work_location || 'Not specified',
        is_favourite: favouriteTalentIds.has(talent.tp_id)
      };
    });

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    const responseData = {
      talents: transformedTalents,
      pagination: {
        current_page: pageNum,
        total_pages: totalPages,
        total_count: totalCount,
        per_page: limitNum,
        has_next_page: hasNextPage,
        has_prev_page: hasPrevPage,
        showing: `${offset + 1}-${Math.min(offset + limitNum, totalCount)} of ${totalCount} talents`
      },
      filters_applied: {
        skills: skills || null,
        location: location || null,
        experience_level: experience_level || null,
        availability: availability || null,
        min_rate: min_rate || null,
        max_rate: max_rate || null,
        search_query: search_query || null,
        sort_by: sort_by
      }
    };

    return sendResponse(res, 'success', responseData, 'Talents retrieved successfully', statusType.SUCCESS);

  } catch (error) {
    console.error('Error searching talents:', error);
    return sendResponse(res, 'error', { error: error.message }, 'Error searching talents', statusType.INTERNAL_SERVER_ERROR);
  }
};

export const getTalentProfile = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return sendResponse(res, 'error', null, 'User not authenticated', statusType.UNAUTHORIZED);
    }

    const { talentId } = req.params;

    if (!talentId) {
      return sendResponse(res, 'error', null, 'Talent ID is required', statusType.BAD_REQUEST);
    }

    // Get detailed talent profile
    const talent = await prisma.t_profile.findFirst({
      where: {
        tp_id: parseInt(talentId),
        status: true,
        user: {
          is_active: true,
          is_deleted: false,
          is_blocked: false,
          is_suspended: false
        }
      },
      include: {
        user: {
          select: {
            user_id: true,
            user_full_name: true,
            user_email: true,
            user_mobile: true,
            is_verified: true,
            created_at: true
          }
        },
        t_skills: {
          where: { status: true },
          select: {
            ts_id: true,
            ts_skill: true,
            created_at: true
          },
          orderBy: { created_at: 'desc' }
        },
        t_availability: {
          where: { status: true },
          select: {
            ta_id: true,
            ta_full_time: true,
            ta_full_min_salary: true,
            ta_full_max_salary: true,
            ta_part_time: true,
            ta_part_min_salary: true,
            ta_part_max_salary: true,
            ta_consulting: true,
            ta_consulting_min_salary: true,
            ta_consulting_max_salary: true,
            ta_work_location: true,
            ta_timezone: true,
            created_at: true
          },
          orderBy: { created_at: 'desc' }
        },
        t_projects: {
          where: { status: true },
          select: {
            tpj_id: true,
            tpj_name: true,
            tpj_description: true,
            tpj_url: true,
            tpj_github_url: true,
            tpj_duration: true,
            tpj_impact: true,
            tpj_technologies: true,
            tpj_images: true,
            created_at: true
          },
          orderBy: { created_at: 'desc' }
        },
        t_experience: {
          where: { status: true },
          select: {
            te_id: true,
            te_company_name: true,
            te_designation: true,
            te_location: true,
            te_start_date: true,
            te_end_date: true,
            te_description: true,
            te_technologies: true,
            created_at: true
          },
          orderBy: { te_start_date: 'desc' }
        },
        t_reviews: {
          where: { status: true },
          select: {
            tr_id: true,
            tr_rating: true,
            tr_review: true,
            created_at: true
          },
          orderBy: { created_at: 'desc' }
        }
      }
    });

    if (!talent) {
      return sendResponse(res, 'error', null, 'Talent profile not found', statusType.NOT_FOUND);
    }

    // Calculate profile strength
    let profileStrength = 0;
    if (talent.tp_designation) profileStrength += 15;
    if (talent.tp_about) profileStrength += 15;
    if (talent.tp_professional_summary) profileStrength += 10;
    if (talent.tp_image) profileStrength += 8;
    if (talent.tp_resume) profileStrength += 10;
    if (talent.t_skills.length > 0) profileStrength += 12;
    if (talent.t_availability.length > 0) profileStrength += 10;
    if (talent.t_projects.length > 0) profileStrength += 10;
    if (talent.t_experience.length > 0) profileStrength += 10;

    // Calculate average rating
    const avgRating = talent.t_reviews.length > 0 
      ? talent.t_reviews.reduce((sum, review) => sum + review.tr_rating, 0) / talent.t_reviews.length 
      : 0;

    // Format availability data
    const availabilityData = talent.t_availability.map(avail => {
      const types = [];
      const rates = [];

      if (avail.ta_full_time && avail.ta_full_min_salary && avail.ta_full_max_salary) {
        types.push('Full-time');
        rates.push(`$${avail.ta_full_min_salary}k-${avail.ta_full_max_salary}k`);
      }
      if (avail.ta_part_time && avail.ta_part_min_salary && avail.ta_part_max_salary) {
        types.push('Part-time');
        rates.push(`$${avail.ta_part_min_salary}k-${avail.ta_part_max_salary}k (PT)`);
      }
      if (avail.ta_consulting && avail.ta_consulting_min_salary && avail.ta_consulting_max_salary) {
        types.push('Consulting');
        rates.push(`$${avail.ta_consulting_min_salary}-${avail.ta_consulting_max_salary}/hr`);
      }

      return {
        ta_id: avail.ta_id,
        employment_types: types,
        rate_ranges: rates,
        work_location: avail.ta_work_location,
        timezone: avail.ta_timezone,
        created_at: avail.created_at
      };
    });

    // Format experience data
    const experienceData = talent.t_experience.map(exp => ({
      te_id: exp.te_id,
      company_name: exp.te_company_name,
      designation: exp.te_designation,
      location: exp.te_location,
      start_date: exp.te_start_date,
      end_date: exp.te_end_date,
      duration: exp.te_start_date && exp.te_end_date 
        ? `${new Date(exp.te_start_date).getFullYear()} - ${new Date(exp.te_end_date).getFullYear()}`
        : exp.te_start_date 
        ? `${new Date(exp.te_start_date).getFullYear()} - Present`
        : 'Duration not specified',
      description: exp.te_description,
      technologies: exp.te_technologies ? exp.te_technologies.split(',').map(tech => tech.trim()) : [],
      created_at: exp.created_at
    }));

    // Format projects data
    const projectsData = talent.t_projects.map(project => ({
      tpj_id: project.tpj_id,
      name: project.tpj_name,
      description: project.tpj_description,
      url: project.tpj_url,
      github_url: project.tpj_github_url,
      duration: project.tpj_duration,
      impact: project.tpj_impact,
      technologies: project.tpj_technologies ? project.tpj_technologies.split(',').map(tech => tech.trim()) : [],
      images: project.tpj_images ? project.tpj_images.split(',').map(img => img.trim()) : [],
      created_at: project.created_at
    }));

    // Format skills data
    const skillsData = talent.t_skills.map(skill => ({
      ts_id: skill.ts_id,
      skill: skill.ts_skill,
      created_at: skill.created_at
    }));

    // Format reviews data
    const reviewsData = talent.t_reviews.map(review => ({
      tr_id: review.tr_id,
      rating: review.tr_rating,
      review: review.tr_review,
      created_at: review.created_at
    }));

    const responseData = {
      profile: {
        tp_id: talent.tp_id,
        job_title: talent.tp_designation,
        location: talent.tp_location,
        total_experience: talent.tp_total_experience,
        about: talent.tp_about,
        professional_summary: talent.tp_professional_summary,
        profile_image: talent.tp_image,
        resume: talent.tp_resume,
        profile_strength: `${profileStrength}%`,
        created_at: talent.created_at,
        updated_at: talent.updated_at
      },
      user: {
        user_id: talent.user.user_id,
        full_name: talent.user.user_full_name,
        email: talent.user.user_email,
        mobile: talent.user.user_mobile,
        is_verified: talent.user.is_verified,
        member_since: talent.user.created_at
      },
      skills: skillsData,
      availability: availabilityData,
      projects: projectsData,
      experience: experienceData,
      reviews: {
        data: reviewsData,
        average_rating: Math.round(avgRating * 10) / 10,
        total_reviews: talent.t_reviews.length,
        rating_breakdown: {
          5: talent.t_reviews.filter(r => r.tr_rating === 5).length,
          4: talent.t_reviews.filter(r => r.tr_rating === 4).length,
          3: talent.t_reviews.filter(r => r.tr_rating === 3).length,
          2: talent.t_reviews.filter(r => r.tr_rating === 2).length,
          1: talent.t_reviews.filter(r => r.tr_rating === 1).length
        }
      },
      summary: {
        total_projects: talent.t_projects.length,
        total_experience_records: talent.t_experience.length,
        total_skills: talent.t_skills.length,
        total_reviews: talent.t_reviews.length,
        profile_completeness: profileStrength
      }
    };

    return sendResponse(res, 'success', responseData, 'Talent profile retrieved successfully', statusType.SUCCESS);

  } catch (error) {
    console.error('Error getting talent profile:', error);
    return sendResponse(res, 'error', { error: error.message }, 'Error getting talent profile', statusType.INTERNAL_SERVER_ERROR);
  }
};

export const addFavouriteTalent = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return sendResponse(res, 'error', null, 'User not authenticated', statusType.UNAUTHORIZED);
    }

    const { talentId, status } = req.body;

    // Validate input
    if (!talentId) {
      return sendResponse(res, 'error', null, 'Talent ID is required', statusType.BAD_REQUEST);
    }

    if (typeof status !== 'boolean') {
      return sendResponse(res, 'error', null, 'Status must be a boolean value', statusType.BAD_REQUEST);
    }

    // Verify talent profile exists
    const talentProfile = await prisma.t_profile.findFirst({
      where: {
        tp_id: parseInt(talentId),
        status: true,
        user: {
          is_active: true,
          is_deleted: false
        }
      }
    });

    if (!talentProfile) {
      return sendResponse(res, 'error', null, 'Talent profile not found', statusType.NOT_FOUND);
    }

    // Check if favourite already exists
    const existingFavourite = await prisma.r_favourite_talents.findFirst({
      where: {
        user_id: userId,
        tp_id: parseInt(talentId)
      }
    });

    if (status === true) {
      // Add to favourites
      if (existingFavourite) {
        // Update existing record to active
        await prisma.r_favourite_talents.update({
          where: {
            rft_id: existingFavourite.rft_id
          },
          data: {
            status: true,
            updated_at: new Date(),
            updated_by: userId.toString()
          }
        });
        return sendResponse(res, 'success', { is_favourite: true }, 'Talent added to favourites successfully', statusType.SUCCESS);
      } else {
        // Create new favourite record
        await prisma.r_favourite_talents.create({
          data: {
            user_id: userId,
            tp_id: parseInt(talentId),
            status: true,
            created_by: userId.toString(),
            updated_by: userId.toString()
          }
        });
        return sendResponse(res, 'success', { is_favourite: true }, 'Talent added to favourites successfully', statusType.SUCCESS);
      }
    } else {
      // Remove from favourites (set status to false)
      if (existingFavourite) {
        await prisma.r_favourite_talents.update({
          where: {
            rft_id: existingFavourite.rft_id
          },
          data: {
            status: false,
            updated_at: new Date(),
            updated_by: userId.toString()
          }
        });
        return sendResponse(res, 'success', { is_favourite: false }, 'Talent removed from favourites successfully', statusType.SUCCESS);
      } else {
        return sendResponse(res, 'success', { is_favourite: false }, 'Talent was not in favourites', statusType.SUCCESS);
      }
    }

  } catch (error) {
    console.error('Error managing favourite talent:', error);
    return sendResponse(res, 'error', { error: error.message }, 'Error managing favourite talent', statusType.INTERNAL_SERVER_ERROR);
  }
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

// Service Management APIs
export const getServices = async (req, res) => {
  try {
    const { page = 1, limit = 10, status_filter = 'active' } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    // Build where clause
    const whereClause = {};
    if (status_filter === 'active') {
      whereClause.status = true;
    } else if (status_filter === 'inactive') {
      whereClause.status = false;
    }

    // Get total count
    const totalCount = await prisma.r_service.count({
      where: whereClause
    });

    // Get services
    const services = await prisma.r_service.findMany({
      where: whereClause,
      orderBy: { created_at: 'desc' },
      skip: offset,
      take: limitNum,
      include: {
        r_service_feature: {
          where: { status: true },
          orderBy: { created_at: 'asc' }
        }
      }
    });

    // Transform data
    const transformedServices = services.map(service => ({
      rs_id: service.rs_id,
      name: service.rs_name,
      inr_price: parseFloat(service.rs_inr_price),
      international_price: parseFloat(service.rs_international_price),
      international_currency: service.rs_currency_international,
      description: service.rs_description,
      features: service.r_service_feature.map(f => ({
        rsf_id: f.rsf_id,
        name: f.rsf_name
      })),
      status: service.status,
      created_at: service.created_at,
      updated_at: service.updated_at
    }));

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    const responseData = {
      services: transformedServices,
      pagination: {
        current_page: pageNum,
        total_pages: totalPages,
        total_count: totalCount,
        per_page: limitNum,
        has_next_page: hasNextPage,
        has_prev_page: hasPrevPage
      }
    };

    return sendResponse(res, 'success', responseData, 'Services retrieved successfully', statusType.SUCCESS);

  } catch (error) {
    console.error('Error getting services:', error);
    return sendResponse(res, 'error', { error: error.message }, 'Error getting services', statusType.INTERNAL_SERVER_ERROR);
  }
};

export const getServiceById = async (req, res) => {
  try {
    const { serviceId } = req.params;

    if (!serviceId) {
      return sendResponse(res, 'error', null, 'Service ID is required', statusType.BAD_REQUEST);
    }

    const service = await prisma.r_service.findFirst({
      where: {
        rs_id: parseInt(serviceId),
        status: true
      },
      include: {
        r_service_feature: {
          where: { status: true },
          orderBy: { created_at: 'asc' }
        }
      }
    });

    if (!service) {
      return sendResponse(res, 'error', null, 'Service not found', statusType.NOT_FOUND);
    }

    const responseData = {
      rs_id: service.rs_id,
      name: service.rs_name,
      inr_price: parseFloat(service.rs_inr_price),
      international_price: parseFloat(service.rs_international_price),
      international_currency: service.rs_currency_international,
      description: service.rs_description,
      features: service.r_service_feature.map(f => ({
        rsf_id: f.rsf_id,
        name: f.rsf_name
      })),
      status: service.status,
      created_at: service.created_at,
      updated_at: service.updated_at
    };

    return sendResponse(res, 'success', responseData, 'Service retrieved successfully', statusType.SUCCESS);

  } catch (error) {
    console.error('Error getting service:', error);
    return sendResponse(res, 'error', { error: error.message }, 'Error getting service', statusType.INTERNAL_SERVER_ERROR);
  }
};

export const getPurchaseHistory = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return sendResponse(res, 'error', null, 'User not authenticated', statusType.UNAUTHORIZED);
    }

    const { page = 1, limit = 10, payment_status = 'all' } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    // Build where clause
    const whereClause = {
      user_id: userId,
      status: true
    };

    if (payment_status !== 'all') {
      whereClause.rt_payment_status = payment_status;
    }

    // Get total count
    const totalCount = await prisma.r_transaction.count({
      where: whereClause
    });

    // Get transactions
    const transactions = await prisma.r_transaction.findMany({
      where: whereClause,
      orderBy: { created_at: 'desc' },
      skip: offset,
      take: limitNum,
      include: {
        r_service: {
          select: {
            rs_id: true,
            rs_name: true,
            rs_description: true
          }
        },
        r_service_purchase_mapper: {
          where: { status: true },
          select: {
            rspm_id: true,
            rspm_purchase_date: true,
            rspm_expiry_date: true,
            rspm_is_active: true
          }
        }
      }
    });

    // Transform data
    const transformedTransactions = transactions.map(transaction => ({
      rt_id: transaction.rt_id,
      amount: parseFloat(transaction.rt_amount),
      currency: transaction.rt_currency,
      payment_status: transaction.rt_payment_status,
      payment_method: transaction.rt_payment_method,
      transaction_date: transaction.rt_transaction_date,
      service: {
        rs_id: transaction.r_service.rs_id,
        name: transaction.r_service.rs_name,
        description: transaction.r_service.rs_description
      },
      purchase_info: transaction.r_service_purchase_mapper.length > 0 ? {
        purchase_date: transaction.r_service_purchase_mapper[0].rspm_purchase_date,
        expiry_date: transaction.r_service_purchase_mapper[0].rspm_expiry_date,
        is_active: transaction.r_service_purchase_mapper[0].rspm_is_active
      } : null,
      created_at: transaction.created_at
    }));

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    const responseData = {
      transactions: transformedTransactions,
      pagination: {
        current_page: pageNum,
        total_pages: totalPages,
        total_count: totalCount,
        per_page: limitNum,
        has_next_page: hasNextPage,
        has_prev_page: hasPrevPage
      }
    };

    return sendResponse(res, 'success', responseData, 'Purchase history retrieved successfully', statusType.SUCCESS);

  } catch (error) {
    console.error('Error getting purchase history:', error);
    return sendResponse(res, 'error', { error: error.message }, 'Error getting purchase history', statusType.INTERNAL_SERVER_ERROR);
  }
};

// Payment and Stripe Integration
export const createPaymentIntent = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return sendResponse(res, 'error', null, 'User not authenticated', statusType.UNAUTHORIZED);
    }

    const { serviceId, currency = 'INR' } = req.body;

    if (!serviceId) {
      return sendResponse(res, 'error', null, 'Service ID is required', statusType.BAD_REQUEST);
    }

    // Get service details
    const service = await prisma.r_service.findFirst({
      where: {
        rs_id: parseInt(serviceId),
        status: true
      }
    });

    if (!service) {
      return sendResponse(res, 'error', null, 'Service not found', statusType.NOT_FOUND);
    }

    // Determine price based on currency
    let amount;
    let finalCurrency = currency.toUpperCase();
    
    if (finalCurrency === 'INR') {
      amount = parseFloat(service.rs_inr_price);
    } else {
      amount = parseFloat(service.rs_international_price);
      finalCurrency = service.rs_currency_international;
    }

    // Create transaction record first
    const transaction = await prisma.r_transaction.create({
      data: {
        user_id: userId,
        rs_id: parseInt(serviceId),
        rt_amount: amount,
        rt_currency: finalCurrency,
        rt_payment_status: 'Pending',
        created_by: userId.toString()
      }
    });

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: finalCurrency.toLowerCase(),
            product_data: {
              name: service.rs_name,
              description: service.rs_description || 'Service purchase',
            },
            unit_amount: Math.round(amount * 100), // Convert to cents/paisa
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}&transaction_id=${transaction.rt_id}`,
      cancel_url: `${FRONTEND_URL}/payment/cancel?transaction_id=${transaction.rt_id}`,
      client_reference_id: transaction.rt_id.toString(),
      metadata: {
        transaction_id: transaction.rt_id.toString(),
        user_id: userId.toString(),
        service_id: serviceId.toString()
      }
    });

    // Update transaction with session ID
    await prisma.r_transaction.update({
      where: { rt_id: transaction.rt_id },
      data: {
        rt_stripe_session_id: session.id,
        rt_payment_status: 'Processing'
      }
    });

    const responseData = {
      session_id: session.id,
      session_url: session.url,
      transaction_id: transaction.rt_id,
      amount: amount,
      currency: finalCurrency
    };

    return sendResponse(res, 'success', responseData, 'Payment session created successfully', statusType.SUCCESS);

  } catch (error) {
    console.error('Error creating payment intent:', error);
    return sendResponse(res, 'error', { error: error.message }, 'Error creating payment intent', statusType.INTERNAL_SERVER_ERROR);
  }
};

export const handleStripeWebhook = async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        
        // Get transaction details from metadata
        const transactionId = parseInt(session.metadata.transaction_id);
        const userId = parseInt(session.metadata.user_id);
        const serviceId = parseInt(session.metadata.service_id);

        // Update transaction and create purchase mapper in a transaction
        await prisma.$transaction(async (tx) => {
          // Update transaction status
          await tx.r_transaction.update({
            where: { rt_id: transactionId },
            data: {
              rt_payment_status: 'Completed',
              rt_stripe_payment_intent_id: session.payment_intent,
              rt_payment_method: session.payment_method_types[0],
              rt_transaction_date: new Date(),
              updated_by: userId.toString()
            }
          });

          // Create purchase mapper record
          await tx.r_service_purchase_mapper.create({
            data: {
              rt_id: transactionId,
              user_id: userId,
              rspm_purchase_date: new Date(),
              rspm_is_active: true,
              created_by: userId.toString()
            }
          });
        });

        console.log(`Payment completed for transaction ${transactionId}`);
        break;

      case 'checkout.session.expired':
        const expiredSession = event.data.object;
        const expiredTransactionId = parseInt(expiredSession.metadata.transaction_id);

        // Update transaction status to cancelled
        await prisma.r_transaction.update({
          where: { rt_id: expiredTransactionId },
          data: {
            rt_payment_status: 'Cancelled'
          }
        });

        console.log(`Payment session expired for transaction ${expiredTransactionId}`);
        break;

      case 'payment_intent.payment_failed':
        const failedIntent = event.data.object;
        
        // Find transaction by payment intent ID
        const failedTransaction = await prisma.r_transaction.findFirst({
          where: { rt_stripe_payment_intent_id: failedIntent.id }
        });

        if (failedTransaction) {
          await prisma.r_transaction.update({
            where: { rt_id: failedTransaction.rt_id },
            data: {
              rt_payment_status: 'Failed'
            }
          });
        }

        console.log(`Payment failed for payment intent ${failedIntent.id}`);
        break;

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    res.json({ received: true });

  } catch (error) {
    console.error('Error handling webhook:', error);
    return res.status(500).json({ error: error.message });
  }
};

// Intent Management APIs
export const saveIntent = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return sendResponse(res, 'error', null, 'User not authenticated', statusType.UNAUTHORIZED);
    }

    const {
      ri_id,
      ri_job_title,
      ri_employment_type,
      ri_work_mode,
      ri_location,
      ri_experience_level,
      ri_compensation_range,
      ri_currency,
      ri_skills_required,
      ri_job_description,
      ri_personalised_message,
      ri_next_step,
      ri_preferred_timeline,
      ri_response_deadline
    } = req.body;

    // Validate required fields
    if (!ri_job_title || !ri_employment_type || !ri_work_mode || !ri_experience_level || 
        !ri_compensation_range || !ri_currency || !ri_skills_required || !ri_job_description ||
        !ri_personalised_message || !ri_next_step) {
      return sendResponse(res, 'error', null, 'All required fields must be provided', statusType.BAD_REQUEST);
    }

    // Validate location is required for hybrid/onsite
    if ((ri_work_mode === 'Hybrid' || ri_work_mode === 'Onsite') && !ri_location) {
      return sendResponse(res, 'error', null, 'Location is required for Hybrid and Onsite work modes', statusType.BAD_REQUEST);
    }

    // Parse skills if it's a string
    let skillsArray = ri_skills_required;
    if (typeof ri_skills_required === 'string') {
      try {
        skillsArray = JSON.parse(ri_skills_required);
      } catch (e) {
        // If not JSON, treat as comma-separated string
        skillsArray = ri_skills_required.split(',').map(skill => skill.trim());
      }
    }

    let intent;
    let message;

    if (ri_id) {
      // Update existing intent
      // Check if intent exists and belongs to user
      const existingIntent = await prisma.r_intent.findFirst({
        where: {
          ri_id: parseInt(ri_id),
          user_id: userId
        }
      });

      if (!existingIntent) {
        return sendResponse(res, 'error', null, 'Intent not found', statusType.NOT_FOUND);
      }

      // Update the intent
      intent = await prisma.r_intent.update({
        where: { ri_id: parseInt(ri_id) },
        data: {
          ri_job_title,
          ri_employment_type,
          ri_work_mode,
          ri_location,
          ri_experience_level,
          ri_compensation_range,
          ri_currency,
          ri_skills_required: JSON.stringify(skillsArray),
          ri_job_description,
          ri_personalised_message,
          ri_next_step,
          ri_preferred_timeline,
          ri_response_deadline: ri_response_deadline ? new Date(ri_response_deadline) : null,
          updated_by: userId.toString(),
          updated_at: new Date()
        }
      });

      message = 'Intent updated successfully';
    } else {
      // Create new intent
      intent = await prisma.r_intent.create({
        data: {
          user_id: userId,
          ri_job_title,
          ri_employment_type,
          ri_work_mode,
          ri_location,
          ri_experience_level,
          ri_compensation_range,
          ri_currency,
          ri_skills_required: JSON.stringify(skillsArray),
          ri_job_description,
          ri_personalised_message,
          ri_next_step,
          ri_preferred_timeline,
          ri_response_deadline: ri_response_deadline ? new Date(ri_response_deadline) : null,
          created_by: userId.toString()
        }
      });

      message = 'Intent created successfully';
    }

    return sendResponse(res, 'success', intent, message, statusType.SUCCESS);

  } catch (error) {
    console.error('Error saving intent:', error);
    return sendResponse(res, 'error', { error: error.message }, 'Error saving intent', statusType.INTERNAL_SERVER_ERROR);
  }
};

export const getIntents = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return sendResponse(res, 'error', null, 'User not authenticated', statusType.UNAUTHORIZED);
    }

    const { page = 1, limit = 10, status = 'active' } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    // Build where clause
    const whereClause = {
      user_id: userId
    };

    if (status === 'active') {
      whereClause.status = true;
    } else if (status === 'inactive') {
      whereClause.status = false;
    }

    // Get total count
    const totalCount = await prisma.r_intent.count({
      where: whereClause
    });

    // Get intents with pagination
    const intents = await prisma.r_intent.findMany({
      where: whereClause,
      orderBy: { created_at: 'desc' },
      skip: offset,
      take: limitNum,
      include: {
        r_intent_talent_mapper: {
          where: { status: true },
          select: {
            ritm_id: true,
            tp_id: true,
            created_at: true,
            t_profile: {
              select: {
                tp_id: true,
                tp_designation: true,
                user: {
                  select: {
                    user_full_name: true
                  }
                }
              }
            }
          }
        }
      }
    });

    // Transform data
    const transformedIntents = intents.map(intent => {
      const skillsArray = JSON.parse(intent.ri_skills_required);
      
      return {
        ri_id: intent.ri_id,
        job_title: intent.ri_job_title,
        employment_type: intent.ri_employment_type,
        work_mode: intent.ri_work_mode,
        location: intent.ri_location,
        experience_level: intent.ri_experience_level,
        compensation_range: intent.ri_compensation_range,
        currency: intent.ri_currency,
        skills_required: skillsArray,
        job_description: intent.ri_job_description,
        personalised_message: intent.ri_personalised_message,
        next_step: intent.ri_next_step,
        preferred_timeline: intent.ri_preferred_timeline,
        response_deadline: intent.ri_response_deadline,
        status: intent.status,
        created_at: intent.created_at,
        updated_at: intent.updated_at,
        talents_count: intent.r_intent_talent_mapper.length,
        talents: intent.r_intent_talent_mapper.map(mapper => ({
          ritm_id: mapper.ritm_id,
          tp_id: mapper.tp_id,
          talent_name: mapper.t_profile.user.user_full_name,
          talent_designation: mapper.t_profile.tp_designation,
          sent_at: mapper.created_at
        }))
      };
    });

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    const responseData = {
      intents: transformedIntents,
      pagination: {
        current_page: pageNum,
        total_pages: totalPages,
        total_count: totalCount,
        per_page: limitNum,
        has_next_page: hasNextPage,
        has_prev_page: hasPrevPage
      }
    };

    return sendResponse(res, 'success', responseData, 'Intents retrieved successfully', statusType.SUCCESS);

  } catch (error) {
    console.error('Error getting intents:', error);
    return sendResponse(res, 'error', { error: error.message }, 'Error getting intents', statusType.INTERNAL_SERVER_ERROR);
  }
};

export const getIntentById = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return sendResponse(res, 'error', null, 'User not authenticated', statusType.UNAUTHORIZED);
    }

    const { intentId } = req.params;

    if (!intentId) {
      return sendResponse(res, 'error', null, 'Intent ID is required', statusType.BAD_REQUEST);
    }

    const intent = await prisma.r_intent.findFirst({
      where: {
        ri_id: parseInt(intentId),
        user_id: userId
      },
      include: {
        r_intent_talent_mapper: {
          where: { status: true },
          include: {
            t_profile: {
              select: {
                tp_id: true,
                tp_designation: true,
                tp_location: true,
                tp_total_experience: true,
                tp_professional_summary: true,
                tp_image: true,
                user: {
                  select: {
                    user_id: true,
                    user_full_name: true,
                    user_email: true
                  }
                },
                t_skills: {
                  where: { status: true },
                  select: { ts_skill: true },
                  take: 5
                }
              }
            }
          }
        }
      }
    });

    if (!intent) {
      return sendResponse(res, 'error', null, 'Intent not found', statusType.NOT_FOUND);
    }

    const skillsArray = JSON.parse(intent.ri_skills_required);

    const responseData = {
      ri_id: intent.ri_id,
      job_title: intent.ri_job_title,
      employment_type: intent.ri_employment_type,
      work_mode: intent.ri_work_mode,
      location: intent.ri_location,
      experience_level: intent.ri_experience_level,
      compensation_range: intent.ri_compensation_range,
      currency: intent.ri_currency,
      skills_required: skillsArray,
      job_description: intent.ri_job_description,
      personalised_message: intent.ri_personalised_message,
      next_step: intent.ri_next_step,
      preferred_timeline: intent.ri_preferred_timeline,
      response_deadline: intent.ri_response_deadline,
      status: intent.status,
      created_at: intent.created_at,
      updated_at: intent.updated_at,
      talents: intent.r_intent_talent_mapper.map(mapper => ({
        ritm_id: mapper.ritm_id,
        tp_id: mapper.tp_id,
        talent_name: mapper.t_profile.user.user_full_name,
        talent_email: mapper.t_profile.user.user_email,
        talent_designation: mapper.t_profile.tp_designation,
        talent_location: mapper.t_profile.tp_location,
        talent_experience: mapper.t_profile.tp_total_experience,
        talent_summary: mapper.t_profile.tp_professional_summary,
        talent_image: mapper.t_profile.tp_image,
        talent_skills: mapper.t_profile.t_skills.map(skill => skill.ts_skill),
        sent_at: mapper.created_at
      }))
    };

    return sendResponse(res, 'success', responseData, 'Intent retrieved successfully', statusType.SUCCESS);

  } catch (error) {
    console.error('Error getting intent:', error);
    return sendResponse(res, 'error', { error: error.message }, 'Error getting intent', statusType.INTERNAL_SERVER_ERROR);
  }
};


export const sendIntentToTalents = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return sendResponse(res, 'error', null, 'User not authenticated', statusType.UNAUTHORIZED);
    }

    const { intentId } = req.params;
    const { talentIds } = req.body;

    if (!intentId) {
      return sendResponse(res, 'error', null, 'Intent ID is required', statusType.BAD_REQUEST);
    }

    if (!talentIds || !Array.isArray(talentIds) || talentIds.length === 0) {
      return sendResponse(res, 'error', null, 'Talent IDs array is required', statusType.BAD_REQUEST);
    }

    // Check if intent exists and belongs to user
    const intent = await prisma.r_intent.findFirst({
      where: {
        ri_id: parseInt(intentId),
        user_id: userId,
        status: true
      },
      include: {
        user: {
          select: {
            user_full_name: true
          }
        }
      }
    });

    if (!intent) {
      return sendResponse(res, 'error', null, 'Intent not found or inactive', statusType.NOT_FOUND);
    }

    // Check if talents exist and are active
    const talents = await prisma.t_profile.findMany({
      where: {
        tp_id: { in: talentIds.map(id => parseInt(id)) },
        status: true,
        user: {
          is_active: true,
          is_deleted: false,
          is_blocked: false,
          is_suspended: false
        }
      },
      select: { 
        tp_id: true,
        user_id: true,
        user: {
          select: {
            user_full_name: true
          }
        }
      }
    });

    if (talents.length !== talentIds.length) {
      return sendResponse(res, 'error', null, 'Some talent profiles not found or inactive', statusType.BAD_REQUEST);
    }

    // Check for existing mappings to avoid duplicates
    const existingMappings = await prisma.r_intent_talent_mapper.findMany({
      where: {
        ri_id: parseInt(intentId),
        tp_id: { in: talentIds.map(id => parseInt(id)) },
        status: true
      },
      select: { tp_id: true }
    });

    const existingTalentIds = existingMappings.map(mapping => mapping.tp_id);
    const newTalentIds = talentIds.filter(id => !existingTalentIds.includes(parseInt(id)));

    if (newTalentIds.length === 0) {
      return sendResponse(res, 'error', null, 'All selected talents have already received this intent', statusType.BAD_REQUEST);
    }

    // Create new mappings, timeline records, and chat conversations in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const createdMappers = [];
      const createdConversations = [];
      
      // Create each mapping individually to get the ritm_id for timeline and chat creation
      for (const talentId of newTalentIds) {
        const talent = talents.find(t => t.tp_id === parseInt(talentId));
        
        const mapper = await tx.r_intent_talent_mapper.create({
          data: {
            ri_id: parseInt(intentId),
            tp_id: parseInt(talentId),
            ritm_intent_status: 'Intent_Submitted',
            created_by: userId.toString()
          }
        });
        
        // Create timeline record for Intent Submitted
        await tx.r_intent_timeline.create({
          data: {
            ritm_id: mapper.ritm_id,
            rit_status: 'Intent_Submitted',
            rit_notes: 'Intent sent to talent',
            created_by: userId.toString()
          }
        });
        
        // Create chat conversation immediately when intent is submitted
        const conversation = await tx.chat_conversation.create({
          data: {
            ritm_id: mapper.ritm_id,
            recruiter_user_id: userId,
            talent_user_id: talent.user_id,
          }
        });
        
        createdMappers.push(mapper);
        createdConversations.push({
          conversation,
          talentUserId: talent.user_id,
          talentName: talent.user.user_full_name
        });
      }
      
      return { createdMappers, createdConversations };
    });

    // Create notifications for talents
    try {
      for (const talentId of newTalentIds) {
        const talent = talents.find(t => t.tp_id === parseInt(talentId));
        if (talent) {
          await createNotification(
            talent.user_id,
            'intent_received',
            'New Job Opportunity!',
            `${intent.user.user_full_name} sent you an intent for ${intent.ri_job_title}`,
            null
          );
        }
      }
    } catch (notificationError) {
      console.error('Error creating notifications:', notificationError);
      // Don't fail the request if notification fails
    }

    // Emit socket events for chat creation
    try {
      const { getIO } = await import('../../../socket/socketServer.js');
      const io = getIO();
      
      for (const convData of result.createdConversations) {
        const { conversation, talentUserId, talentName } = convData;
        
        // Notify recruiter about chat creation
        io.to(`user:${userId}`).emit('chat_created', {
          conversationId: conversation.cc_id,
          withUser: {
            user_id: talentUserId,
            user_full_name: talentName
          },
          jobTitle: intent.ri_job_title
        });
        
        // Notify talent about chat creation
        io.to(`user:${talentUserId}`).emit('chat_created', {
          conversationId: conversation.cc_id,
          withUser: {
            user_id: userId,
            user_full_name: intent.user.user_full_name
          },
          jobTitle: intent.ri_job_title
        });
      }
    } catch (socketError) {
      console.error('Error emitting socket events:', socketError);
      // Don't fail the request if socket emission fails
    }

    const responseData = {
      intent_id: parseInt(intentId),
      total_requested: talentIds.length,
      already_sent: existingTalentIds.length,
      newly_sent: newTalentIds.length,
      created_mappings: result.createdMappers.length,
      created_conversations: result.createdConversations.length,
      talent_ids_sent: newTalentIds
    };

    return sendResponse(res, 'success', responseData, 'Intent sent to talents successfully', statusType.SUCCESS);

  } catch (error) {
    console.error('Error sending intent to talents:', error);
    return sendResponse(res, 'error', { error: error.message }, 'Error sending intent to talents', statusType.INTERNAL_SERVER_ERROR);
  }
};

export const getIntentStats = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return sendResponse(res, 'error', null, 'User not authenticated', statusType.UNAUTHORIZED);
    }

    // Get total intents
    const totalIntents = await prisma.r_intent.count({
      where: { user_id: userId, status: true }
    });

    // Get total talents reached
    const totalTalentsReached = await prisma.r_intent_talent_mapper.count({
      where: {
        r_intent: { user_id: userId },
        status: true
      }
    });

    // Get intents by employment type
    const intentsByEmploymentType = await prisma.r_intent.groupBy({
      by: ['ri_employment_type'],
      where: { user_id: userId, status: true },
      _count: { ri_id: true }
    });

    // Get intents by experience level
    const intentsByExperienceLevel = await prisma.r_intent.groupBy({
      by: ['ri_experience_level'],
      where: { user_id: userId, status: true },
      _count: { ri_id: true }
    });

    // Get recent intents (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentIntents = await prisma.r_intent.count({
      where: {
        user_id: userId,
        status: true,
        created_at: { gte: thirtyDaysAgo }
      }
    });

    const responseData = {
      total_intents: totalIntents,
      total_talents_reached: totalTalentsReached,
      recent_intents_30_days: recentIntents,
      intents_by_employment_type: intentsByEmploymentType.map(item => ({
        employment_type: item.ri_employment_type,
        count: item._count.ri_id
      })),
      intents_by_experience_level: intentsByExperienceLevel.map(item => ({
        experience_level: item.ri_experience_level,
        count: item._count.ri_id
      }))
    };

    return sendResponse(res, 'success', responseData, 'Intent statistics retrieved successfully', statusType.SUCCESS);

  } catch (error) {
    console.error('Error getting intent stats:', error);
    return sendResponse(res, 'error', { error: error.message }, 'Error getting intent statistics', statusType.INTERNAL_SERVER_ERROR);
  }
};

export const markProjectStart = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return sendResponse(res, 'error', null, 'User not authenticated', statusType.UNAUTHORIZED);
    }

    const { ritmId } = req.params;
    const { notes } = req.body;

    if (!ritmId) {
      return sendResponse(res, 'error', null, 'Intent mapping ID is required', statusType.BAD_REQUEST);
    }

    // Check if intent mapping exists and belongs to recruiter
    const mapping = await prisma.r_intent_talent_mapper.findFirst({
      where: {
        ritm_id: parseInt(ritmId),
        status: true,
        r_intent: {
          user_id: userId
        }
      }
    });

    if (!mapping) {
      return sendResponse(res, 'error', null, 'Intent mapping not found', statusType.NOT_FOUND);
    }

    // Check if intent was accepted
    if (mapping.ritm_intent_status !== 'Intent_Accepted') {
      return sendResponse(res, 'error', null, 'Cannot start project - intent must be accepted first', statusType.BAD_REQUEST);
    }

    // Check if project already started
    if (mapping.ritm_intent_status === 'Project_Started') {
      return sendResponse(res, 'error', null, 'Project already started', statusType.BAD_REQUEST);
    }

    // Update mapping and create timeline record in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update mapping status
      const updatedMapping = await tx.r_intent_talent_mapper.update({
        where: { ritm_id: parseInt(ritmId) },
        data: {
          ritm_intent_status: 'Project_Started',
          updated_by: userId.toString()
        }
      });

      // Create timeline record
      const timelineRecord = await tx.r_intent_timeline.create({
        data: {
          ritm_id: parseInt(ritmId),
          rit_status: 'Project_Started',
          rit_notes: notes || 'Project started by recruiter',
          created_by: userId.toString()
        }
      });

      return { updatedMapping, timelineRecord };
    });

    return sendResponse(res, 'success', result, 'Project marked as started successfully', statusType.SUCCESS);

  } catch (error) {
    console.error('Error marking project start:', error);
    return sendResponse(res, 'error', { error: error.message }, 'Error marking project start', statusType.INTERNAL_SERVER_ERROR);
  }
};

export const getIntentTimeline = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return sendResponse(res, 'error', null, 'User not authenticated', statusType.UNAUTHORIZED);
    }

    const { ritmId } = req.params;

    if (!ritmId) {
      return sendResponse(res, 'error', null, 'Intent mapping ID is required', statusType.BAD_REQUEST);
    }

    // Check if intent mapping exists and belongs to recruiter
    const mapping = await prisma.r_intent_talent_mapper.findFirst({
      where: {
        ritm_id: parseInt(ritmId),
        status: true,
        r_intent: {
          user_id: userId
        }
      },
      include: {
        r_intent: {
          select: {
            ri_job_title: true,
            ri_employment_type: true,
            ri_compensation_range: true,
            ri_currency: true
          }
        },
        t_profile: {
          select: {
            user: {
              select: {
                user_full_name: true,
                user_email: true
              }
            }
          }
        },
        r_intent_timeline: {
          orderBy: { created_at: 'asc' },
          where: { status: true }
        }
      }
    });

    if (!mapping) {
      return sendResponse(res, 'error', null, 'Intent mapping not found', statusType.NOT_FOUND);
    }

    const responseData = {
      ritm_id: mapping.ritm_id,
      current_status: mapping.ritm_intent_status,
      intent_summary: {
        job_title: mapping.r_intent.ri_job_title,
        employment_type: mapping.r_intent.ri_employment_type,
        compensation: `${mapping.r_intent.ri_compensation_range} ${mapping.r_intent.ri_currency}`
      },
      talent_info: {
        name: mapping.t_profile.user.user_full_name,
        email: mapping.t_profile.user.user_email
      },
      timeline: mapping.r_intent_timeline.map(t => ({
        rit_id: t.rit_id,
        status: t.rit_status,
        notes: t.rit_notes,
        created_at: t.created_at,
        created_by: t.created_by
      }))
    };

    return sendResponse(res, 'success', responseData, 'Timeline retrieved successfully', statusType.SUCCESS);

  } catch (error) {
    console.error('Error getting intent timeline:', error);
    return sendResponse(res, 'error', { error: error.message }, 'Error getting intent timeline', statusType.INTERNAL_SERVER_ERROR);
  }
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
  addFavouriteTalent,
  
  // Intent management
  saveIntent,
  getIntents,
  getIntentById,
  sendIntentToTalents,
  getIntentStats,
  markProjectStart,
  getIntentTimeline,
  
  // Service management
  getServices,
  getServiceById,
  getPurchaseHistory,
  
  // Notifications
  getNotifications,
  markNotificationAsRead,
  
  // Dashboard
  getDashboard,
  
  // Payment
  createPaymentIntent,
  handleStripeWebhook
};
