import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { sendResponse } from '../../helpers/responseHelper.js';
import statusType from '../../enums/statusTypes.js';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import { generateRecommendations } from './talentHelpers.js';
import { createNotification } from '../../helpers/notificationHelper.js';
import { OPENAI_API_KEY } from '../../../config/index.js';

const prisma = new PrismaClient();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadType = req.query.type; // 'resume', 'profile-image', or 'project-image'
    let uploadPath;
    
    if (uploadType === 'resume') {
      uploadPath = path.join(__dirname, '../../../../public/uploads/talent/resumes');
    } else if (uploadType === 'profile-image') {
      uploadPath = path.join(__dirname, '../../../../public/uploads/talent/profile-images');
    } else if (uploadType === 'project-image') {
      uploadPath = path.join(__dirname, '../../../../public/uploads/projects');
    } else {
      return cb(new Error('Invalid upload type. Must be "resume", "profile-image", or "project-image"'), false);
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
  
  if (uploadType === 'resume') {
    // Allow PDF and DOC files for resumes
    const allowedMimes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and DOC files are allowed for resumes'), false);
    }
  } else if (uploadType === 'profile-image') {
    // Allow image files for profile images
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and GIF images are allowed for profile images'), false);
    }
  } else if (uploadType === 'project-image') {
    // Allow image files for project images
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, GIF, and WebP images are allowed for project images'), false);
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
export const uploadResume = async (req, res) => {
  try {
    if (!req.file) {
      return sendResponse(res, 'error', null, 'No file uploaded', statusType.BAD_REQUEST);
    }

    const userId = req.user?.user_id;
    if (!userId) {
      return sendResponse(res, 'error', null, 'User not authenticated', statusType.UNAUTHORIZED);
    }

    const filePath = req.file.path;
    const fileName = req.file.filename;
    const originalName = req.file.originalname;
    const fileSize = req.file.size;

    // Convert absolute path to relative path from /uploads
    // Find the uploads directory in the path and replace everything before it
    const uploadsIndex = filePath.indexOf('/uploads/');
    const relativePath = uploadsIndex !== -1 ? filePath.substring(uploadsIndex + 1) : filePath.replace(/\\/g, '/');

    // Update resume path in database
    await prisma.t_profile.updateMany({
      where: { user_id: userId },
      data: { 
        tp_resume: relativePath,
        updated_at: new Date()
      }
    });

    // Get the updated profile
    const profile = await prisma.t_profile.findFirst({
      where: { user_id: userId }
    });

    const fileData = {
      fileName: fileName,
      originalName: originalName,
      filePath: relativePath,
      fileSize: fileSize,
      uploadType: 'resume',
      profileId: profile?.tp_id
    };

    return sendResponse(res, 'success', fileData, 'Resume uploaded successfully', statusType.SUCCESS);
  } catch (error) {
    console.error('Error uploading resume:', error);
    return sendResponse(res, 'error', { error: error.message }, 'Error uploading resume', statusType.INTERNAL_SERVER_ERROR);
  }
};

export const uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return sendResponse(res, 'error', null, 'No file uploaded', statusType.BAD_REQUEST);
    }

    const userId = req.user?.user_id;
    if (!userId) {
      return sendResponse(res, 'error', null, 'User not authenticated', statusType.UNAUTHORIZED);
    }

    const filePath = req.file.path;
    const fileName = req.file.filename;
    const originalName = req.file.originalname;
    const fileSize = req.file.size;

    // Convert absolute path to relative path from /uploads
    // Find the uploads directory in the path and replace everything before it
    const uploadsIndex = filePath.indexOf('/uploads/');
    const relativePath = uploadsIndex !== -1 ? filePath.substring(uploadsIndex + 1) : filePath.replace(/\\/g, '/');

    // Update profile image path in database
    await prisma.t_profile.updateMany({
      where: { user_id: userId },
      data: { 
        tp_image: relativePath,
        updated_at: new Date()
      }
    });

    // Get the updated profile
    const profile = await prisma.t_profile.findFirst({
      where: { user_id: userId }
    });

    const fileData = {
      fileName: fileName,
      originalName: originalName,
      filePath: relativePath,
      fileSize: fileSize,
      uploadType: 'profile-image',
      profileId: profile?.tp_id
    };

    return sendResponse(res, 'success', fileData, 'Profile image uploaded successfully', statusType.SUCCESS);
  } catch (error) {
    console.error('Error uploading profile image:', error);
    return sendResponse(res, 'error', { error: error.message }, 'Error uploading profile image', statusType.INTERNAL_SERVER_ERROR);
  }
};

export const uploadProjectImage = async (req, res) => {
  try {
    if (!req.file) {
      return sendResponse(res, 'error', null, 'No file uploaded', statusType.BAD_REQUEST);
    }

    const userId = req.user?.user_id;
    if (!userId) {
      return sendResponse(res, 'error', null, 'User not authenticated', statusType.UNAUTHORIZED);
    }

    const filePath = req.file.path;
    const fileName = req.file.filename;
    const originalName = req.file.originalname;
    const fileSize = req.file.size;

    // Convert absolute path to relative path from /uploads
    // Find the uploads directory in the path and replace everything before it
    const uploadsIndex = filePath.indexOf('/uploads/');
    const relativePath = uploadsIndex !== -1 ? filePath.substring(uploadsIndex + 1) : filePath.replace(/\\/g, '/');

    const fileData = {
      fileName: fileName,
      originalName: originalName,
      filePath: relativePath,
      fileSize: fileSize,
      uploadType: 'project-image'
    };

    return sendResponse(res, 'success', fileData, 'Project image uploaded successfully', statusType.SUCCESS);
  } catch (error) {
    console.error('Error uploading project image:', error);
    return sendResponse(res, 'error', { error: error.message }, 'Error uploading project image', statusType.INTERNAL_SERVER_ERROR);
  }
};

// OpenAI-powered resume parser
export const parseResume = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return sendResponse(res, 'error', null, 'User not authenticated', statusType.UNAUTHORIZED);
    }

    // Get user profile with resume URL
    const profile = await prisma.t_profile.findFirst({
      where: { user_id: userId },
      include: {
        user: true
      }
    });

    if (!profile || !profile.tp_resume) {
      return sendResponse(res, 'error', null, 'No resume found. Please upload a resume first.', statusType.BAD_REQUEST);
    }

    // Construct the full URL for the resume file
    const baseUrl = 'https://859qxtxj-8000.inc1.devtunnels.ms';
    const resumeUrl = `${baseUrl}/${profile.tp_resume}`;

    // Create the prompt for OpenAI
    const prompt = `
You are an expert resume parser and talent assessment AI. Please analyze the resume at the following URL and extract comprehensive profile information.

Resume URL: ${resumeUrl}

Please parse this resume and return a JSON object with the following structure. IMPORTANT: Only return valid JSON, no additional text or formatting.

{
  "experience_years": number (total years of experience),
  "ai_detected_personality_traits": [
    "Analytical",
    "Leadership", 
    "Innovation-driven",
    "Detail-oriented",
    "Collaborative"
  ],
  "short_profile": {
    "job_title": "string",
    "experience_summary": "string (e.g., '15+ years • Technology')",
    "summary": "string (brief professional summary for recruiters)",
    "skills": ["string", "string", "string"],
    "personality_traits": ["string", "string"],
    "employment_type": "string (e.g., 'Full-time & Consulting')",
    "industry": "string"
  },
  "full_profile": {
    "job_title": "string",
    "experience_summary": "string (e.g., '15+ years • San Francisco, CA')",
    "summary": "string (detailed professional summary)",
    "core_skills": ["string", "string", "string"],
    "personality_profile": ["string", "string", "string"],
    "location": "string",
    "work_history": "string (brief work history summary)",
    "education": "string (education background)",
    "achievements": "string (key achievements)"
  },
  "projects": [
    {
      "tpj_name": "string (project name)",
      "tpj_description": "string (project description)",
      "tpj_url": "string (project URL if available)",
      "tpj_github_url": "string (GitHub URL if available)",
      "tpj_duration": "string (project duration, e.g., '6 months', '2022-2023')",
      "tpj_impact": "string (project impact and results)",
      "tpj_technologies": "string (comma-separated technologies used)"
    }
  ],
  "experience": [
    {
      "te_company_name": "string (company name)",
      "te_designation": "string (job title/position)",
      "te_location": "string (work location)",
      "te_start_date": "string (start date in YYYY-MM-DD format)",
      "te_end_date": "string (end date in YYYY-MM-DD format or 'Present' for current role)",
      "te_description": "string (job description and responsibilities)",
      "te_technologies": "string (comma-separated technologies used)"
    }
  ],
  "skills": [
    "string (individual skill name)",
    "string (individual skill name)"
  ]
}

CRITICAL REQUIREMENT: 
- Calculate the total years of experience across all positions
- If the total experience is less than 10 years, set "experience_years" to the actual number and include a field "error": "Candidate must have at least 10 years of experience"
- Extract personality traits based on the content, tone, and achievements in the resume
- Generate appropriate skills lists based on technologies and competencies mentioned
- Create both short and detailed summaries for different viewing contexts
- Extract ALL projects mentioned in the resume (personal, professional, academic)
- Extract ALL work experience entries with accurate dates and descriptions
- Extract ALL skills mentioned in the resume (technical, soft skills, tools, frameworks, languages, etc.)
- For current positions, use "Present" as the end date
- Ensure all strings are concise and professional
- If no projects, experience, or skills are found, return empty arrays

Analyze the resume content thoroughly and provide accurate, professional assessments.
`;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert resume parser and talent assessment AI. You analyze resumes and extract structured professional information. Always return valid JSON format only."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 2000
    });

    const aiResponse = completion.choices[0].message.content;
    
    // Parse the JSON response
    let parsedData;
    try {
      parsedData = JSON.parse(aiResponse);
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError);
      return sendResponse(res, 'error', null, 'Failed to parse AI response', statusType.INTERNAL_SERVER_ERROR);
    }

    // Check experience requirement
    if (parsedData.experience_years < 10) {
      return sendResponse(res, 'error', {
        experience_years: parsedData.experience_years,
        message: 'Candidate must have at least 10 years of experience'
      }, 'Insufficient experience: Minimum 10 years required', statusType.BAD_REQUEST);
    }

    // Update the talent profile with parsed data
    const updatedProfile = await prisma.t_profile.updateMany({
      where: { user_id: userId },
      data: {
        tp_designation: parsedData.short_profile?.job_title || parsedData.full_profile?.job_title,
        tp_location: parsedData.full_profile?.location,
        tp_total_experience: parsedData.experience_years?.toString(),
        tp_about: parsedData.full_profile?.summary,
        tp_professional_summary: parsedData.short_profile?.summary,
        updated_at: new Date()
      }
    });

    // Get the updated profile to get tp_id
    const talentProfile = await prisma.t_profile.findFirst({
      where: { user_id: userId },
      select: {
        tp_id: true,
        tp_designation: true,
        tp_location: true,
        tp_total_experience: true,
        tp_about: true,
        tp_professional_summary: true,
        tp_image: true,
        status: true,
        created_at: true,
        updated_at: true,
        user: {
          select: {
            user_id: true,
            user_email: true,
            user_full_name: true
          }
        }
      }
    });

    if (!talentProfile) {
      return sendResponse(res, 'error', null, 'Failed to retrieve updated profile', statusType.INTERNAL_SERVER_ERROR);
    }

    // Save projects data if available
    let createdProjects = [];
    if (parsedData.projects && Array.isArray(parsedData.projects) && parsedData.projects.length > 0) {
      try {
        // Delete existing projects for this profile
        await prisma.t_projects.updateMany({
          where: { tp_id: talentProfile.tp_id },
          data: { status: false }
        });

        // Create new projects
        for (const project of parsedData.projects) {
          if (project.tpj_name && project.tpj_description) {
            const newProject = await prisma.t_projects.create({
              data: {
                tp_id: talentProfile.tp_id,
                tpj_name: project.tpj_name,
                tpj_description: project.tpj_description,
                tpj_url: project.tpj_url || null,
                tpj_github_url: project.tpj_github_url || null,
                tpj_duration: project.tpj_duration || null,
                tpj_impact: project.tpj_impact || null,
                tpj_technologies: project.tpj_technologies || null,
                status: true
              }
            });
            createdProjects.push(newProject);
          }
        }
      } catch (projectError) {
        console.error('Error saving projects:', projectError);
        // Continue execution even if projects fail to save
      }
    }

    // Save experience data if available
    let createdExperience = [];
    if (parsedData.experience && Array.isArray(parsedData.experience) && parsedData.experience.length > 0) {
      try {
        // Delete existing experience for this profile
        await prisma.t_experience.updateMany({
          where: { tp_id: talentProfile.tp_id },
          data: { status: false }
        });

        // Create new experience records
        for (const exp of parsedData.experience) {
          if (exp.te_company_name && exp.te_designation) {
            // Handle date parsing
            let startDate = null;
            let endDate = null;
            
            if (exp.te_start_date) {
              startDate = new Date(exp.te_start_date);
            }
            
            if (exp.te_end_date && exp.te_end_date.toLowerCase() !== 'present') {
              endDate = new Date(exp.te_end_date);
            }

            const newExperience = await prisma.t_experience.create({
              data: {
                tp_id: talentProfile.tp_id,
                te_company_name: exp.te_company_name,
                te_designation: exp.te_designation,
                te_location: exp.te_location || null,
                te_start_date: startDate,
                te_end_date: endDate,
                te_description: exp.te_description || null,
                te_technologies: exp.te_technologies || null,
                status: true
              }
            });
            createdExperience.push(newExperience);
          }
        }
      } catch (experienceError) {
        console.error('Error saving experience:', experienceError);
        // Continue execution even if experience fails to save
      }
    }

    // Save skills data if available
    let createdSkills = [];
    if (parsedData.skills && Array.isArray(parsedData.skills) && parsedData.skills.length > 0) {
      try {
        // Delete existing skills for this profile
        await prisma.t_skills.updateMany({
          where: { tp_id: talentProfile.tp_id },
          data: { status: false }
        });

        // Create new skills
        for (const skill of parsedData.skills) {
          if (skill && skill.trim() !== '') {
            const newSkill = await prisma.t_skills.create({
              data: {
                tp_id: talentProfile.tp_id,
                ts_skill: skill.trim(),
                status: true
              }
            });
            createdSkills.push(newSkill);
          }
        }
      } catch (skillsError) {
        console.error('Error saving skills:', skillsError);
        // Continue execution even if skills fail to save
      }
    }

    // Return both the parsed data and updated profile with created records
    const responseData = {
      parsed_data: parsedData,
      updated_profile: talentProfile,
      created_projects: createdProjects,
      created_experience: createdExperience,
      created_skills: createdSkills,
      summary: {
        projects_created: createdProjects.length,
        experience_created: createdExperience.length,
        skills_created: createdSkills.length,
        total_parsed_projects: parsedData.projects?.length || 0,
        total_parsed_experience: parsedData.experience?.length || 0,
        total_parsed_skills: parsedData.skills?.length || 0
      }
    };

    return sendResponse(res, 'success', responseData, 'Resume parsed and profile updated successfully', statusType.SUCCESS);

  } catch (error) {
    console.error('Error parsing resume:', error);
    
    // Handle OpenAI API errors
    if (error.code === 'insufficient_quota') {
      return sendResponse(res, 'error', null, 'OpenAI API quota exceeded', statusType.SERVICE_UNAVAILABLE);
    } else if (error.code === 'rate_limit_exceeded') {
      return sendResponse(res, 'error', null, 'OpenAI API rate limit exceeded', statusType.TOO_MANY_REQUESTS);
    } else if (error.code === 'invalid_api_key') {
      return sendResponse(res, 'error', null, 'OpenAI API key is invalid', statusType.UNAUTHORIZED);
    }
    
    return sendResponse(res, 'error', { error: error.message }, 'Error parsing resume', statusType.INTERNAL_SERVER_ERROR);
  }
};

export const getAllTalentProfile = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    
    if (!userId) {
      return sendResponse(res, 'error', null, 'User not authenticated', statusType.UNAUTHORIZED);
    }

    // Find the talent profile for the logged-in user
    const profile = await prisma.t_profile.findFirst({
      where: { 
        user_id: userId,
        status: true
      },
      select: {
        tp_id: true,
        tp_designation: true,
        tp_location: true,
        tp_total_experience: true,
        tp_about: true,
        tp_professional_summary: true,
        tp_image: true,
        status: true,
        created_at: true,
        updated_at: true,
        user: {
          select: {
            user_id: true,
            user_email: true,
            user_full_name: true,
            user_role: true
          }
        }
        // Note: tp_resume is intentionally excluded
      }
    });

    if (!profile) {
      return sendResponse(res, 'error', null, 'Talent profile not found', statusType.NOT_FOUND);
    }

    return sendResponse(res, 'success', profile, 'Talent profile retrieved successfully', statusType.SUCCESS);

  } catch (error) {
    console.error('Error fetching talent profile:', error);
    return sendResponse(res, 'error', { error: error.message }, 'Error fetching talent profile', statusType.INTERNAL_SERVER_ERROR);
  }
};

export const getAllTalentProjects = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    
    if (!userId) {
      return sendResponse(res, 'error', null, 'User not authenticated', statusType.UNAUTHORIZED);
    }

    // First, get the talent profile to get tp_id
    const profile = await prisma.t_profile.findFirst({
      where: { 
        user_id: userId,
        status: true
      },
      select: {
        tp_id: true
      }
    });

    if (!profile) {
      return sendResponse(res, 'error', null, 'Talent profile not found', statusType.NOT_FOUND);
    }

    // Now get all projects for this talent profile
    const projects = await prisma.t_projects.findMany({
      where: { 
        tp_id: profile.tp_id,
        status: true
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    return sendResponse(res, 'success', projects, 'Talent projects retrieved successfully', statusType.SUCCESS);

  } catch (error) {
    console.error('Error fetching talent projects:', error);
    return sendResponse(res, 'error', { error: error.message }, 'Error fetching talent projects', statusType.INTERNAL_SERVER_ERROR);
  }
};

export const getAllTalentExperience = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    
    if (!userId) {
      return sendResponse(res, 'error', null, 'User not authenticated', statusType.UNAUTHORIZED);
    }

    // First, get the talent profile to get tp_id
    const profile = await prisma.t_profile.findFirst({
      where: { 
        user_id: userId,
        status: true
      },
      select: {
        tp_id: true
      }
    });

    if (!profile) {
      return sendResponse(res, 'error', null, 'Talent profile not found', statusType.NOT_FOUND);
    }

    // Now get all experience records for this talent profile
    const experience = await prisma.t_experience.findMany({
      where: { 
        tp_id: profile.tp_id,
        status: true
      },
      orderBy: {
        te_start_date: 'desc'
      }
    });

    return sendResponse(res, 'success', experience, 'Talent experience retrieved successfully', statusType.SUCCESS);

  } catch (error) {
    console.error('Error fetching talent experience:', error);
    return sendResponse(res, 'error', { error: error.message }, 'Error fetching talent experience', statusType.INTERNAL_SERVER_ERROR);
  }
};

export const getAllTalentAvailability = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    
    if (!userId) {
      return sendResponse(res, 'error', null, 'User not authenticated', statusType.UNAUTHORIZED);
    }

    // First, get the talent profile to get tp_id
    const profile = await prisma.t_profile.findFirst({
      where: { 
        user_id: userId,
        status: true
      },
      select: {
        tp_id: true
      }
    });

    if (!profile) {
      return sendResponse(res, 'error', null, 'Talent profile not found', statusType.NOT_FOUND);
    }

    // Now get all availability records for this talent profile
    const availability = await prisma.t_availability.findMany({
      where: { 
        tp_id: profile.tp_id,
        status: true
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    return sendResponse(res, 'success', availability, 'Talent availability retrieved successfully', statusType.SUCCESS);

  } catch (error) {
    console.error('Error fetching talent availability:', error);
    return sendResponse(res, 'error', { error: error.message }, 'Error fetching talent availability', statusType.INTERNAL_SERVER_ERROR);
  }
};

export const getAllTalentReviews = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    
    if (!userId) {
      return sendResponse(res, 'error', null, 'User not authenticated', statusType.UNAUTHORIZED);
    }

    // First, get the talent profile to get tp_id
    const profile = await prisma.t_profile.findFirst({
      where: { 
        user_id: userId,
        status: true
      },
      select: {
        tp_id: true
      }
    });

    if (!profile) {
      return sendResponse(res, 'error', null, 'Talent profile not found', statusType.NOT_FOUND);
    }

    // Now get all reviews for this talent profile
    const reviews = await prisma.t_reviews.findMany({
      where: { 
        tp_id: profile.tp_id,
        status: true
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    return sendResponse(res, 'success', reviews, 'Talent reviews retrieved successfully', statusType.SUCCESS);

  } catch (error) {
    console.error('Error fetching talent reviews:', error);
    return sendResponse(res, 'error', { error: error.message }, 'Error fetching talent reviews', statusType.INTERNAL_SERVER_ERROR);
  }
};



// Save Talent Profile Controller
export const saveTalentProfile = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return sendResponse(res, 'error', null, 'User not authenticated', statusType.UNAUTHORIZED);
    }

    const {
      tp_id,
      tp_designation,
      tp_location,
      tp_total_experience,
      tp_about,
      tp_professional_summary,
      tp_resume,
      tp_image,
    } = req.body;


    if (tp_id) {
      // Update the existing record if tp_id is provided
      const updatedProfile = await prisma.t_profile.update({
        where: { tp_id: parseInt(tp_id) },
        data: {
          tp_designation,
          tp_location,
          tp_total_experience,
          tp_about,
          tp_professional_summary,
          tp_resume,
          tp_image,
          user_id: userId,
          status: true
        }
      });

      return sendResponse(res, 'success', updatedProfile, 'Talent profile updated successfully', statusType.SUCCESS);
    } else {
      // Create new record
      const newProfile = await prisma.t_profile.create({
        data: {
          tp_designation,
          tp_location,
          tp_total_experience,
          tp_about,
          tp_professional_summary,
          tp_resume,
          tp_image,
          user_id: userId,
          status: true
        }
      });

      return sendResponse(res, 'success', newProfile, 'Talent profile created successfully', statusType.SUCCESS);
    }
  } catch (error) {
    console.error('Error saving talent profile:', error);
    return sendResponse(res, 'error', { error: error.message }, 'Error saving talent profile', statusType.INTERNAL_SERVER_ERROR);
  }
};

// Save Talent Projects Controller
export const saveTalentProjects = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return sendResponse(res, 'error', null, 'User not authenticated', statusType.UNAUTHORIZED);
    }

    // Get talent profile tp_id
    const profile = await prisma.t_profile.findFirst({
      where: { user_id: userId, status: true },
      select: { tp_id: true }
    });

    if (!profile) {
      return sendResponse(res, 'error', null, 'Talent profile not found', statusType.NOT_FOUND);
    }

    const {
      tpj_id,
      tpj_name,
      tpj_description,
      tpj_url,
      tpj_github_url,
      tpj_duration,
      tpj_impact,
      tpj_technologies,
      tpj_images,
      status // status can be true, false, or undefined
    } = req.body;

    // Default status to true if not provided or empty
    const newStatus = (typeof status === 'undefined' || status === null || status === '') ? true : status;

    // If status is false, do not create a new record
    if (newStatus === false) {
      return sendResponse(res, 'success', null, 'No new project created as status is false', statusType.SUCCESS);
    }

    // If tpj_id is provided, update existing record
    if (tpj_id) {
      // First, set status to false for existing record
      await prisma.t_projects.update({
        where: { tpj_id: parseInt(tpj_id) },
        data: { status: false }
      });

      // Create new record with updated data
      const newProject = await prisma.t_projects.create({
        data: {
          tp_id: profile.tp_id,
          tpj_name,
          tpj_description,
          tpj_url,
          tpj_github_url,
          tpj_duration,
          tpj_impact,
          tpj_technologies,
          tpj_images,
          status: newStatus
        }
      });

      return sendResponse(res, 'success', newProject, 'Talent project updated successfully', statusType.SUCCESS);
    } else {
      // Create new record
      const newProject = await prisma.t_projects.create({
        data: {
          tp_id: profile.tp_id,
          tpj_name,
          tpj_description,
          tpj_url,
          tpj_github_url,
          tpj_duration,
          tpj_impact,
          tpj_technologies,
          tpj_images,
          status: newStatus
        }
      });

      return sendResponse(res, 'success', newProject, 'Talent project created successfully', statusType.SUCCESS);
    }
  } catch (error) {
    console.error('Error saving talent project:', error);
    return sendResponse(res, 'error', { error: error.message }, 'Error saving talent project', statusType.INTERNAL_SERVER_ERROR);
  }
};

// Save Talent Experience Controller
export const saveTalentExperience = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return sendResponse(res, 'error', null, 'User not authenticated', statusType.UNAUTHORIZED);
    }

    // Get talent profile tp_id
    const profile = await prisma.t_profile.findFirst({
      where: { user_id: userId, status: true },
      select: { tp_id: true }
    });

    if (!profile) {
      return sendResponse(res, 'error', null, 'Talent profile not found', statusType.NOT_FOUND);
    }

    const {
      te_id,
      te_company_name,
      te_designation,
      te_location,
      te_start_date,
      te_end_date,
      te_description,
      te_technologies,
      status // status can be true, false, or undefined
    } = req.body;

    // Default status to true if not provided or empty
    const newStatus = (typeof status === 'undefined' || status === null || status === '') ? true : status;

    // If status is false, do not create a new record
    if (newStatus === false) {
      return sendResponse(res, 'success', null, 'No new experience created as status is false', statusType.SUCCESS);
    }

    // If te_id is provided, update existing record
    if (te_id) {
      // First, set status to false for existing record
      await prisma.t_experience.update({
        where: { te_id: parseInt(te_id) },
        data: { status: false }
      });

      // Create new record with updated data
      const newExperience = await prisma.t_experience.create({
        data: {
          tp_id: profile.tp_id,
          te_company_name,
          te_designation,
          te_location,
          te_start_date: te_start_date ? new Date(te_start_date) : null,
          te_end_date: te_end_date ? new Date(te_end_date) : null,
          te_description,
          te_technologies,
          status: newStatus
        }
      });

      return sendResponse(res, 'success', newExperience, 'Talent experience updated successfully', statusType.SUCCESS);
    } else {
      // Create new record
      const newExperience = await prisma.t_experience.create({
        data: {
          tp_id: profile.tp_id,
          te_company_name,
          te_designation,
          te_location,
          te_start_date: te_start_date ? new Date(te_start_date) : null,
          te_end_date: te_end_date ? new Date(te_end_date) : null,
          te_description,
          te_technologies,
          status: newStatus
        }
      });

      return sendResponse(res, 'success', newExperience, 'Talent experience created successfully', statusType.SUCCESS);
    }
  } catch (error) {
    console.error('Error saving talent experience:', error);
    return sendResponse(res, 'error', { error: error.message }, 'Error saving talent experience', statusType.INTERNAL_SERVER_ERROR);
  }
};

// Save Talent Availability Controller
export const saveTalentAvailability = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return sendResponse(res, 'error', null, 'User not authenticated', statusType.UNAUTHORIZED);
    }

    // Get talent profile tp_id
    const profile = await prisma.t_profile.findFirst({
      where: { user_id: userId, status: true },
      select: { tp_id: true }
    });

    if (!profile) {
      return sendResponse(res, 'error', null, 'Talent profile not found', statusType.NOT_FOUND);
    }

    const {
      ta_id,
      ta_full_time,
      ta_full_min_salary,
      ta_full_max_salary,
      ta_part_time,
      ta_part_min_salary,
      ta_part_max_salary,
      ta_consulting,
      ta_consulting_min_salary,
      ta_consulting_max_salary,
      ta_work_location,
      ta_timezone
    } = req.body;

    // If ta_id is provided, update existing record
    if (ta_id) {
      // First, set status to false for existing record
      await prisma.t_availability.update({
        where: { ta_id: parseInt(ta_id) },
        data: { status: false }
      });

      // Create new record with updated data
      const newAvailability = await prisma.t_availability.create({
        data: {
          tp_id: profile.tp_id,
          ta_full_time: ta_full_time || false,
          ta_full_min_salary: ta_full_min_salary ? parseInt(ta_full_min_salary) : null,
          ta_full_max_salary: ta_full_max_salary ? parseInt(ta_full_max_salary) : null,
          ta_part_time: ta_part_time || false,
          ta_part_min_salary: ta_part_min_salary ? parseInt(ta_part_min_salary) : null,
          ta_part_max_salary: ta_part_max_salary ? parseInt(ta_part_max_salary) : null,
          ta_consulting: ta_consulting || false,
          ta_consulting_min_salary: ta_consulting_min_salary ? parseInt(ta_consulting_min_salary) : null,
          ta_consulting_max_salary: ta_consulting_max_salary ? parseInt(ta_consulting_max_salary) : null,
          ta_work_location: ta_work_location || 'Remote',
          ta_timezone: ta_timezone || 'UTC',
          status: true
        }
      });

      return sendResponse(res, 'success', newAvailability, 'Talent availability updated successfully', statusType.SUCCESS);
    } else {
      // Create new record
      const newAvailability = await prisma.t_availability.create({
        data: {
          tp_id: profile.tp_id,
          ta_full_time: ta_full_time || false,
          ta_full_min_salary: ta_full_min_salary ? parseInt(ta_full_min_salary) : null,
          ta_full_max_salary: ta_full_max_salary ? parseInt(ta_full_max_salary) : null,
          ta_part_time: ta_part_time || false,
          ta_part_min_salary: ta_part_min_salary ? parseInt(ta_part_min_salary) : null,
          ta_part_max_salary: ta_part_max_salary ? parseInt(ta_part_max_salary) : null,
          ta_consulting: ta_consulting || false,
          ta_consulting_min_salary: ta_consulting_min_salary ? parseInt(ta_consulting_min_salary) : null,
          ta_consulting_max_salary: ta_consulting_max_salary ? parseInt(ta_consulting_max_salary) : null,
          ta_work_location: ta_work_location || 'Remote',
          ta_timezone: ta_timezone || 'UTC',
          status: true
        }
      });

      return sendResponse(res, 'success', newAvailability, 'Talent availability created successfully', statusType.SUCCESS);
    }
  } catch (error) {
    console.error('Error saving talent availability:', error);
    return sendResponse(res, 'error', { error: error.message }, 'Error saving talent availability', statusType.INTERNAL_SERVER_ERROR);
  }
};

// Save Talent Reviews Controller
export const saveTalentReviews = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return sendResponse(res, 'error', null, 'User not authenticated', statusType.UNAUTHORIZED);
    }

    // Get talent profile tp_id
    const profile = await prisma.t_profile.findFirst({
      where: { user_id: userId, status: true },
      select: { tp_id: true }
    });

    if (!profile) {
      return sendResponse(res, 'error', null, 'Talent profile not found', statusType.NOT_FOUND);
    }

    const {
      tr_id,
      tr_rating,
      tr_review
    } = req.body;

    // If tr_id is provided, update existing record
    if (tr_id) {
      // First, set status to false for existing record
      await prisma.t_reviews.update({
        where: { tr_id: parseInt(tr_id) },
        data: { status: false }
      });

      // Create new record with updated data
      const newReview = await prisma.t_reviews.create({
        data: {
          tp_id: profile.tp_id,
          tr_rating: parseInt(tr_rating),
          tr_review,
          status: true
        }
      });

      return sendResponse(res, 'success', newReview, 'Talent review updated successfully', statusType.SUCCESS);
    } else {
      // Create new record
      const newReview = await prisma.t_reviews.create({
        data: {
          tp_id: profile.tp_id,
          tr_rating: parseInt(tr_rating),
          tr_review,
          status: true
        }
      });

      return sendResponse(res, 'success', newReview, 'Talent review created successfully', statusType.SUCCESS);
    }
  } catch (error) {
    console.error('Error saving talent review:', error);
    return sendResponse(res, 'error', { error: error.message }, 'Error saving talent review', statusType.INTERNAL_SERVER_ERROR);
  }
};

// Get Profile Percentage Controller
export const getProfilePercentage = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return sendResponse(res, 'error', null, 'User not authenticated', statusType.UNAUTHORIZED);
    }

    // Get user information
    const user = await prisma.user.findUnique({
      where: { user_id: userId },
      select: {
        user_id: true,
        user_full_name: true,
        user_email: true,
        user_mobile: true,
        is_verified: true
      }
    });

    if (!user) {
      return sendResponse(res, 'error', null, 'User not found', statusType.NOT_FOUND);
    }

    // Get talent profile with related data
    const profile = await prisma.t_profile.findFirst({
      where: { 
        user_id: userId,
        status: true
      },
      include: {
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
            tpj_technologies: true
          }
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
            te_technologies: true
          }
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
            ta_timezone: true
          }
        },
        t_reviews: {
          where: { status: true },
          select: {
            tr_id: true,
            tr_rating: true,
            tr_review: true
          }
        }
      }
    });

    // Define field weights and requirements
    const fieldWeights = {
      // Basic Profile Fields (40% total)
      basic_profile: {
        tp_designation: { weight: 8, required: true },
        tp_location: { weight: 6, required: true },
        tp_total_experience: { weight: 8, required: true },
        tp_about: { weight: 10, required: true },
        tp_professional_summary: { weight: 8, required: true },
        tp_resume: { weight: 10, required: true },
        tp_image: { weight: 5, required: false }
      },
      // User Information (15% total)
      user_info: {
        user_full_name: { weight: 5, required: true },
        user_email: { weight: 5, required: true },
        user_mobile: { weight: 3, required: true },
        is_verified: { weight: 2, required: true }
      },
      // Related Data (45% total)
      related_data: {
        projects: { weight: 15, required: true, min_count: 1 },
        experience: { weight: 20, required: true, min_count: 1 },
        availability: { weight: 10, required: true, min_count: 1 }
      }
    };

    let totalScore = 0;
    let maxScore = 0;
    const pendingFields = [];
    const completedFields = [];

    // Calculate basic profile completion
    if (profile) {
      for (const [field, config] of Object.entries(fieldWeights.basic_profile)) {
        maxScore += config.weight;
        const value = profile[field];
        const isCompleted = value && value.toString().trim() !== '';
        
        if (isCompleted) {
          totalScore += config.weight;
          completedFields.push({
            category: 'basic_profile',
            field: field,
            field_name: field.replace('tp_', '').replace(/_/g, ' ').toUpperCase(),
            weight: config.weight,
            value: value
          });
        } else {
          pendingFields.push({
            category: 'basic_profile',
            field: field,
            field_name: field.replace('tp_', '').replace(/_/g, ' ').toUpperCase(),
            weight: config.weight,
            required: config.required,
            message: config.required ? 'Required field' : 'Optional field'
          });
        }
      }
    } else {
      // If no profile exists, all basic profile fields are pending
      for (const [field, config] of Object.entries(fieldWeights.basic_profile)) {
        maxScore += config.weight;
        pendingFields.push({
          category: 'basic_profile',
          field: field,
          field_name: field.replace('tp_', '').replace(/_/g, ' ').toUpperCase(),
          weight: config.weight,
          required: config.required,
          message: config.required ? 'Required field' : 'Optional field'
        });
      }
    }

    // Calculate user information completion
    for (const [field, config] of Object.entries(fieldWeights.user_info)) {
      maxScore += config.weight;
      const value = user[field];
      const isCompleted = value && value.toString().trim() !== '';
      
      if (isCompleted) {
        totalScore += config.weight;
        completedFields.push({
          category: 'user_info',
          field: field,
          field_name: field.replace('user_', '').replace(/_/g, ' ').toUpperCase(),
          weight: config.weight,
          value: value
        });
      } else {
        pendingFields.push({
          category: 'user_info',
          field: field,
          field_name: field.replace('user_', '').replace(/_/g, ' ').toUpperCase(),
          weight: config.weight,
          required: config.required,
          message: config.required ? 'Required field' : 'Optional field'
        });
      }
    }

    // Calculate related data completion
    for (const [dataType, config] of Object.entries(fieldWeights.related_data)) {
      maxScore += config.weight;
      let isCompleted = false;
      let count = 0;

      if (profile) {
        switch (dataType) {
          case 'projects':
            count = profile.t_projects.length;
            isCompleted = count >= config.min_count;
            break;
          case 'experience':
            count = profile.t_experience.length;
            isCompleted = count >= config.min_count;
            break;
          case 'availability':
            count = profile.t_availability.length;
            isCompleted = count >= config.min_count;
            break;
        }
      }

      if (isCompleted) {
        totalScore += config.weight;
        completedFields.push({
          category: 'related_data',
          field: dataType,
          field_name: dataType.toUpperCase(),
          weight: config.weight,
          count: count,
          message: `${count} ${dataType} record(s) found`
        });
      } else {
        pendingFields.push({
          category: 'related_data',
          field: dataType,
          field_name: dataType.toUpperCase(),
          weight: config.weight,
          required: config.required,
          count: count,
          message: `Need at least ${config.min_count} ${dataType} record(s)`
        });
      }
    }

    // Calculate percentage
    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

    // Determine profile status
    let profileStatus = 'incomplete';
    if (percentage >= 90) {
      profileStatus = 'excellent';
    } else if (percentage >= 75) {
      profileStatus = 'good';
    } else if (percentage >= 50) {
      profileStatus = 'fair';
    } else if (percentage >= 25) {
      profileStatus = 'poor';
    }

    // Group pending fields by category
    const pendingByCategory = {
      basic_profile: pendingFields.filter(f => f.category === 'basic_profile'),
      user_info: pendingFields.filter(f => f.category === 'user_info'),
      related_data: pendingFields.filter(f => f.category === 'related_data')
    };

    // Calculate category-wise percentages
    const categoryPercentages = {
      basic_profile: profile ? Math.round((completedFields.filter(f => f.category === 'basic_profile').reduce((sum, f) => sum + f.weight, 0) / fieldWeights.basic_profile.total_weight) * 100) : 0,
      user_info: Math.round((completedFields.filter(f => f.category === 'user_info').reduce((sum, f) => sum + f.weight, 0) / Object.values(fieldWeights.user_info).reduce((sum, f) => sum + f.weight, 0)) * 100),
      related_data: profile ? Math.round((completedFields.filter(f => f.category === 'related_data').reduce((sum, f) => sum + f.weight, 0) / Object.values(fieldWeights.related_data).reduce((sum, f) => sum + f.weight, 0)) * 100) : 0
    };

    // Calculate total weight for basic profile
    const basicProfileTotalWeight = Object.values(fieldWeights.basic_profile).reduce((sum, f) => sum + f.weight, 0);
    categoryPercentages.basic_profile = profile ? Math.round((completedFields.filter(f => f.category === 'basic_profile').reduce((sum, f) => sum + f.weight, 0) / basicProfileTotalWeight) * 100) : 0;

    const responseData = {
      profile_percentage: percentage,
      profile_status: profileStatus,
      total_score: totalScore,
      max_score: maxScore,
      category_percentages: categoryPercentages,
      completed_fields: completedFields,
      pending_fields: pendingFields,
      pending_by_category: pendingByCategory,
      summary: {
        total_completed: completedFields.length,
        total_pending: pendingFields.length,
        critical_pending: pendingFields.filter(f => f.required).length,
        optional_pending: pendingFields.filter(f => !f.required).length
      },
      recommendations: generateRecommendations(percentage, pendingFields)
    };

    return sendResponse(res, 'success', responseData, 'Profile percentage calculated successfully', statusType.SUCCESS);

  } catch (error) {
    console.error('Error calculating profile percentage:', error);
    return sendResponse(res, 'error', { error: error.message }, 'Error calculating profile percentage', statusType.INTERNAL_SERVER_ERROR);
  }
};

// Generate Professional Summary Controller
export const generateProfessionalSummary = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return sendResponse(res, 'error', null, 'User not authenticated', statusType.UNAUTHORIZED);
    }

    const { prompt } = req.body;
    const { existing_description } = req.query;

    if (!prompt || prompt.trim() === '') {
      return sendResponse(res, 'error', null, 'Prompt is required', statusType.BAD_REQUEST);
    }

    // Get user profile with all related data
    const profile = await prisma.t_profile.findFirst({
      where: { 
        user_id: userId,
        status: true
      },
      include: {
        user: {
          select: {
            user_full_name: true,
            user_email: true
          }
        },
        t_projects: {
          where: { status: true },
          select: {
            tpj_name: true,
            tpj_description: true,
            tpj_technologies: true,
            tpj_impact: true,
            tpj_duration: true
          }
        },
        t_experience: {
          where: { status: true },
          select: {
            te_company_name: true,
            te_designation: true,
            te_description: true,
            te_technologies: true,
            te_start_date: true,
            te_end_date: true
          }
        },
        t_skills: {
          where: { status: true },
          select: {
            ts_skill: true
          }
        }
      }
    });

    if (!profile) {
      return sendResponse(res, 'error', null, 'Talent profile not found', statusType.NOT_FOUND);
    }

    // Prepare context data for OpenAI
    const contextData = {
      user_name: profile.user.user_full_name,
      current_designation: profile.tp_designation,
      location: profile.tp_location,
      total_experience: profile.tp_total_experience,
      current_description: existing_description || profile.tp_about || '',
      projects: profile.t_projects.map(project => ({
        name: project.tpj_name,
        description: project.tpj_description,
        technologies: project.tpj_technologies,
        impact: project.tpj_impact,
        duration: project.tpj_duration
      })),
      experience: profile.t_experience.map(exp => ({
        company: exp.te_company_name,
        designation: exp.te_designation,
        description: exp.te_description,
        technologies: exp.te_technologies,
        start_date: exp.te_start_date,
        end_date: exp.te_end_date
      })),
      skills: profile.t_skills.map(skill => skill.ts_skill)
    };

    // Create the prompt for OpenAI
    const openaiPrompt = `
You are an expert professional resume writer and career consultant. Based on the following talent profile information and the user's specific prompt, generate a compelling professional summary.

TALENT PROFILE INFORMATION:
- Name: ${contextData.user_name}
- Current Designation: ${contextData.current_designation || 'Not specified'}
- Location: ${contextData.location || 'Not specified'}
- Total Experience: ${contextData.total_experience || 'Not specified'}
- Current Description: ${contextData.current_description}

PROJECTS:
${contextData.projects.map(project => `
- ${project.name}: ${project.description}
  Technologies: ${project.technologies || 'Not specified'}
  Impact: ${project.impact || 'Not specified'}
  Duration: ${project.duration || 'Not specified'}
`).join('')}

WORK EXPERIENCE:
${contextData.experience.map(exp => `
- ${exp.designation} at ${exp.company}
  Description: ${exp.description || 'Not specified'}
  Technologies: ${exp.technologies || 'Not specified'}
  Duration: ${exp.start_date ? new Date(exp.start_date).getFullYear() : 'Unknown'} - ${exp.end_date ? new Date(exp.end_date).getFullYear() : 'Present'}
`).join('')}

SKILLS:
${contextData.skills.join(', ')}

USER'S SPECIFIC PROMPT:
"${prompt}"

INSTRUCTIONS:
1. Generate a professional summary that addresses the user's specific prompt
2. Incorporate relevant information from their profile, projects, and experience
3. Make it compelling and tailored to their career goals
4. Keep it concise but impactful (2-4 sentences)
5. Use professional language and industry-standard terminology
6. Focus on achievements, skills, and value proposition
7. Ensure it's ready to use in resumes, LinkedIn profiles, or job applications

Generate only the professional summary text, no additional formatting or explanations.
`;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert professional resume writer and career consultant. Generate compelling, tailored professional summaries based on talent profiles and specific user requirements."
        },
        {
          role: "user",
          content: openaiPrompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    const generatedSummary = completion.choices[0].message.content;

    // Prepare response data
    const responseData = {
      generated_summary: generatedSummary,
      user_prompt: prompt,
      existing_description: existing_description || profile.tp_about,
      profile_context: {
        user_name: contextData.user_name,
        designation: contextData.current_designation,
        location: contextData.location,
        experience_years: contextData.total_experience,
        projects_count: contextData.projects.length,
        experience_count: contextData.experience.length,
        skills_count: contextData.skills.length
      },
      generation_metadata: {
        model_used: "gpt-4o-mini",
        timestamp: new Date().toISOString(),
        prompt_length: prompt.length,
        summary_length: generatedSummary.length
      }
    };

    return sendResponse(res, 'success', responseData, 'Professional summary generated successfully', statusType.SUCCESS);

  } catch (error) {
    console.error('Error generating professional summary:', error);
    
    // Handle OpenAI API errors
    if (error.code === 'insufficient_quota') {
      return sendResponse(res, 'error', null, 'OpenAI API quota exceeded', statusType.SERVICE_UNAVAILABLE);
    } else if (error.code === 'rate_limit_exceeded') {
      return sendResponse(res, 'error', null, 'OpenAI API rate limit exceeded', statusType.TOO_MANY_REQUESTS);
    } else if (error.code === 'invalid_api_key') {
      return sendResponse(res, 'error', null, 'OpenAI API key is invalid', statusType.UNAUTHORIZED);
    }
    
    return sendResponse(res, 'error', { error: error.message }, 'Error generating professional summary', statusType.INTERNAL_SERVER_ERROR);
  }
};

// Get All Talent Skills Controller
export const getAllTalentSkills = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    
    if (!userId) {
      return sendResponse(res, 'error', null, 'User not authenticated', statusType.UNAUTHORIZED);
    }

    // First, get the talent profile to get tp_id
    const profile = await prisma.t_profile.findFirst({
      where: { 
        user_id: userId,
        status: true
      },
      select: {
        tp_id: true
      }
    });

    if (!profile) {
      return sendResponse(res, 'error', null, 'Talent profile not found', statusType.NOT_FOUND);
    }

    // Now get all skills for this talent profile
    const skills = await prisma.t_skills.findMany({
      where: { 
        tp_id: profile.tp_id,
        status: true
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    return sendResponse(res, 'success', skills, 'Talent skills retrieved successfully', statusType.SUCCESS);

  } catch (error) {
    console.error('Error fetching talent skills:', error);
    return sendResponse(res, 'error', { error: error.message }, 'Error fetching talent skills', statusType.INTERNAL_SERVER_ERROR);
  }
};

// Save Talent Skills Controller
export const saveTalentSkills = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return sendResponse(res, 'error', null, 'User not authenticated', statusType.UNAUTHORIZED);
    }

    // Get talent profile tp_id
    const profile = await prisma.t_profile.findFirst({
      where: { user_id: userId, status: true },
      select: { tp_id: true }
    });

    if (!profile) {
      return sendResponse(res, 'error', null, 'Talent profile not found', statusType.NOT_FOUND);
    }

    const { skills } = req.body;

    if (!skills || !Array.isArray(skills)) {
      return sendResponse(res, 'error', null, 'Skills array is required', statusType.BAD_REQUEST);
    }

    // Check if user has existing skills
    const existingSkills = await prisma.t_skills.findMany({
      where: { 
        tp_id: profile.tp_id,
        status: true
      }
    });

    // If user has existing skills, deactivate them first
    if (existingSkills.length > 0) {
      await prisma.t_skills.updateMany({
        where: { 
          tp_id: profile.tp_id,
          status: true
        },
        data: { status: false }
      });
    }

    // Process skills based on format
    const skillsToCreate = [];
    
    for (const skill of skills) {
      if (typeof skill === 'string') {
        // First time adding skills - array of strings
        if (skill.trim() !== '') {
          skillsToCreate.push({
            tp_id: profile.tp_id,
            ts_skill: skill.trim(),
            status: true
          });
        }
      } else if (typeof skill === 'object' && skill !== null) {
        // Updating skills - array of objects
        if (skill.ts_skill && skill.ts_skill.trim() !== '') {
          skillsToCreate.push({
            tp_id: profile.tp_id,
            ts_skill: skill.ts_skill.trim(),
            status: true
          });
        }
      }
    }

    // Create new skills
    const createdSkills = [];
    for (const skillData of skillsToCreate) {
      const newSkill = await prisma.t_skills.create({
        data: skillData
      });
      createdSkills.push(newSkill);
    }

    const responseData = {
      created_skills: createdSkills,
      total_created: createdSkills.length,
      deactivated_previous: existingSkills.length,
      skills_format: skills.length > 0 ? (typeof skills[0] === 'string' ? 'strings' : 'objects') : 'empty'
    };

    return sendResponse(res, 'success', responseData, 'Talent skills saved successfully', statusType.SUCCESS);

  } catch (error) {
    console.error('Error saving talent skills:', error);
    return sendResponse(res, 'error', { error: error.message }, 'Error saving talent skills', statusType.INTERNAL_SERVER_ERROR);
  }
};

// Intent management APIs
export const getReceivedIntents = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return sendResponse(res, 'error', null, 'User not authenticated', statusType.UNAUTHORIZED);
    }

    // Get talent profile
    const talentProfile = await prisma.t_profile.findFirst({
      where: { user_id: userId, status: true }
    });

    if (!talentProfile) {
      return sendResponse(res, 'error', null, 'Talent profile not found', statusType.NOT_FOUND);
    }

    const { page = 1, limit = 10, intent_status = 'all' } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    // Build where clause
    const whereClause = {
      tp_id: talentProfile.tp_id,
      status: true
    };

    if (intent_status !== 'all') {
      whereClause.ritm_intent_status = intent_status;
    }

    // Get total count
    const totalCount = await prisma.r_intent_talent_mapper.count({
      where: whereClause
    });

    // Get intent mappings
    const intentMappings = await prisma.r_intent_talent_mapper.findMany({
      where: whereClause,
      orderBy: { created_at: 'desc' },
      skip: offset,
      take: limitNum,
      include: {
        r_intent: {
          include: {
            user: {
              include: {
                r_profile: {
                  include: {
                    r_company_profile: true,
                    r_individual_profile: true
                  }
                }
              }
            }
          }
        },
        r_intent_timeline: {
          orderBy: { created_at: 'asc' }
        }
      }
    });

    // Transform data
    const transformedIntents = intentMappings.map(mapping => {
      const intent = mapping.r_intent;
      const recruiter = intent.user.r_profile?.[0];
      const skillsArray = JSON.parse(intent.ri_skills_required);

      return {
        ritm_id: mapping.ritm_id,
        intent_status: mapping.ritm_intent_status,
        sent_at: mapping.created_at,
        intent: {
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
          response_deadline: intent.ri_response_deadline
        },
        recruiter: {
          name: intent.user.user_full_name,
          email: intent.user.user_email,
          profile_image: recruiter?.rp_profile_image,
          company_name: recruiter?.r_company_profile?.rc_name,
          company_website: recruiter?.r_company_profile?.rc_website
        },
        timeline: mapping.r_intent_timeline.map(t => ({
          status: t.rit_status,
          notes: t.rit_notes,
          created_at: t.created_at
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
    console.error('Error getting received intents:', error);
    return sendResponse(res, 'error', { error: error.message }, 'Error getting received intents', statusType.INTERNAL_SERVER_ERROR);
  }
};

export const acceptIntent = async (req, res) => {
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

    // Get talent profile
    const talentProfile = await prisma.t_profile.findFirst({
      where: { user_id: userId, status: true }
    });

    if (!talentProfile) {
      return sendResponse(res, 'error', null, 'Talent profile not found', statusType.NOT_FOUND);
    }

    // Check if intent mapping exists and belongs to talent
    const mapping = await prisma.r_intent_talent_mapper.findFirst({
      where: {
        ritm_id: parseInt(ritmId),
        tp_id: talentProfile.tp_id,
        status: true
      },
      include: {
        r_intent: {
          select: {
            ri_job_title: true,
            user_id: true,
            user: {
              select: {
                user_full_name: true
              }
            }
          }
        },
        t_profile: {
          select: {
            user: {
              select: {
                user_full_name: true
              }
            }
          }
        }
      }
    });

    if (!mapping) {
      return sendResponse(res, 'error', null, 'Intent mapping not found', statusType.NOT_FOUND);
    }

    // Check if already accepted or rejected
    if (mapping.ritm_intent_status === 'Intent_Accepted') {
      return sendResponse(res, 'error', null, 'Intent already accepted', statusType.BAD_REQUEST);
    }

    if (mapping.ritm_intent_status === 'Intent_Rejected') {
      return sendResponse(res, 'error', null, 'Cannot accept a rejected intent', statusType.BAD_REQUEST);
    }

    // Update mapping and create timeline record in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update mapping status
      const updatedMapping = await tx.r_intent_talent_mapper.update({
        where: { ritm_id: parseInt(ritmId) },
        data: {
          ritm_intent_status: 'Intent_Accepted',
          updated_by: userId.toString()
        }
      });

      // Create timeline record
      const timelineRecord = await tx.r_intent_timeline.create({
        data: {
          ritm_id: parseInt(ritmId),
          rit_status: 'Intent_Accepted',
          rit_notes: notes || 'Intent accepted by talent',
          created_by: userId.toString()
        }
      });

      return { updatedMapping, timelineRecord };
    });

    // Create notification for recruiter
    try {
      await createNotification(
        mapping.r_intent.user_id,
        'intent_accepted',
        'Intent Accepted!',
        `${mapping.t_profile.user.user_full_name} accepted your intent for ${mapping.r_intent.ri_job_title}`,
        null
      );
    } catch (notificationError) {
      console.error('Error creating notification:', notificationError);
      // Don't fail the request if notification fails
    }

    // Create chat conversation when intent is accepted
    try {
      const conversation = await prisma.chat_conversation.create({
        data: {
          ritm_id: parseInt(ritmId),
          recruiter_user_id: mapping.r_intent.user_id,
          talent_user_id: userId,
        }
      });

      // Emit socket event to both users
      try {
        const { getIO } = await import('../../../socket/socketServer.js');
        const io = getIO();
        
        io.to(`user:${mapping.r_intent.user_id}`).emit('chat_created', {
          conversationId: conversation.cc_id,
          withUser: {
            user_id: userId,
            user_full_name: mapping.t_profile.user.user_full_name
          },
          jobTitle: mapping.r_intent.ri_job_title
        });

        io.to(`user:${userId}`).emit('chat_created', {
          conversationId: conversation.cc_id,
          withUser: {
            user_id: mapping.r_intent.user_id,
            user_full_name: mapping.r_intent.user.user_full_name
          },
          jobTitle: mapping.r_intent.ri_job_title
        });
      } catch (socketError) {
        console.error('Error emitting socket event:', socketError);
        // Don't fail if socket emission fails
      }
      
    } catch (chatError) {
      console.error('Error creating chat conversation:', chatError);
      // Don't fail the request if chat creation fails
    }

    return sendResponse(res, 'success', result, 'Intent accepted successfully', statusType.SUCCESS);

  } catch (error) {
    console.error('Error accepting intent:', error);
    return sendResponse(res, 'error', { error: error.message }, 'Error accepting intent', statusType.INTERNAL_SERVER_ERROR);
  }
};

export const rejectIntent = async (req, res) => {
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

    // Get talent profile
    const talentProfile = await prisma.t_profile.findFirst({
      where: { user_id: userId, status: true }
    });

    if (!talentProfile) {
      return sendResponse(res, 'error', null, 'Talent profile not found', statusType.NOT_FOUND);
    }

    // Check if intent mapping exists and belongs to talent
    const mapping = await prisma.r_intent_talent_mapper.findFirst({
      where: {
        ritm_id: parseInt(ritmId),
        tp_id: talentProfile.tp_id,
        status: true
      },
      include: {
        r_intent: {
          select: {
            ri_job_title: true,
            user_id: true,
            user: {
              select: {
                user_full_name: true
              }
            }
          }
        },
        t_profile: {
          select: {
            user: {
              select: {
                user_full_name: true
              }
            }
          }
        }
      }
    });

    if (!mapping) {
      return sendResponse(res, 'error', null, 'Intent mapping not found', statusType.NOT_FOUND);
    }

    // Check if already accepted or rejected
    if (mapping.ritm_intent_status === 'Intent_Rejected') {
      return sendResponse(res, 'error', null, 'Intent already rejected', statusType.BAD_REQUEST);
    }

    if (mapping.ritm_intent_status === 'Intent_Accepted') {
      return sendResponse(res, 'error', null, 'Cannot reject an accepted intent', statusType.BAD_REQUEST);
    }

    // Update mapping and create timeline record in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update mapping status
      const updatedMapping = await tx.r_intent_talent_mapper.update({
        where: { ritm_id: parseInt(ritmId) },
        data: {
          ritm_intent_status: 'Intent_Rejected',
          updated_by: userId.toString()
        }
      });

      // Create timeline record
      const timelineRecord = await tx.r_intent_timeline.create({
        data: {
          ritm_id: parseInt(ritmId),
          rit_status: 'Intent_Rejected',
          rit_notes: notes || 'Intent rejected by talent',
          created_by: userId.toString()
        }
      });

      return { updatedMapping, timelineRecord };
    });

    // Create notification for recruiter
    try {
      await createNotification(
        mapping.r_intent.user_id,
        'intent_rejected',
        'Intent Declined',
        `${mapping.t_profile.user.user_full_name} declined your intent for ${mapping.r_intent.ri_job_title}`,
        null
      );
    } catch (notificationError) {
      console.error('Error creating notification:', notificationError);
      // Don't fail the request if notification fails
    }

    return sendResponse(res, 'success', result, 'Intent rejected successfully', statusType.SUCCESS);

  } catch (error) {
    console.error('Error rejecting intent:', error);
    return sendResponse(res, 'error', { error: error.message }, 'Error rejecting intent', statusType.INTERNAL_SERVER_ERROR);
  }
};


// Helper function to generate recommendations

