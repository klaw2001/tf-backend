import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { sendResponse } from '../../helpers/responseHelper.js';
import { validateEmail, validatePassword, validatePhone, validateRequired, sanitizeInput, sanitizePhoneNumber } from '../../helpers/validationHelper.js';
import statusType from '../../enums/statusTypes.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { OPENAI_API_KEY } from '../../../config/index.js';
import { sendNotificationEmail } from '../../helpers/emailHelper.js';
import { PDFParse } from 'pdf-parse';
import { readFile } from 'node:fs/promises';


const prisma = new PrismaClient();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// JWT secret - in production, this should be in environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Configure multer for resume uploads during signup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../../../public/uploads/talent/resumes');
    
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    } else {
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExtension = path.extname(file.originalname);
    const fileName = `resume-${uniqueSuffix}${fileExtension}`;
    cb(null, fileName);
  }
});

// File filter for allowed file types
const fileFilter = (req, file, cb) => {
  // Allow PDF and DOC files for resumes
  const allowedMimes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF and DOC files are allowed for resumes'), false);
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

// Middleware for single resume upload
export const uploadResumeMiddleware = upload.single('resume');

/**
 * Parse resume using OpenAI to extract user information
 * @param {String} filePath - Path to the resume file
 * @param {String} relativePath - Relative path for URL construction
 * @returns {Object} Extracted information { email, fullName, mobile }
 */
export const parseResumeWithOpenAI = async (filePath, relativePath) => {
  try {

    // ✅ Build absolute path to local file
    const absolutePath = path.join(process.cwd(), "public", relativePath);
    const buffer = await readFile(absolutePath);
    const parser = new PDFParse({ data: buffer });
    const textResult = await parser.getText();
    await parser.destroy();

    // 2️⃣ Send file to GPT-4o-mini with direct file upload
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
You are a resume parsing assistant.
You will receive the extracted text contents from a resume file.
Your task is to extract and return only the following fields as valid JSON:
{
  "fullName": "string or null",
  "email": "string or null",
  "mobile": "string or null"
}
If a value is missing, return null for that field. Do not include any text except the JSON output.
`
        },
        {
          role: "user",
          content: textResult.text
        }
      ],
      temperature: 0,
      max_tokens: 800
    });


    // 4️⃣ Extract AI response text
    const aiResponse = completion.choices?.[0]?.message?.content?.trim() || '';


    // 5️⃣ Sanitize and parse JSON safely
    const cleanResponse = aiResponse
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    let parsedData;
    try {
      parsedData = JSON.parse(cleanResponse);
    } catch (err) {
      throw new Error('Invalid JSON from OpenAI');
    }

    // 6️⃣ Return structured result
    const result = {
      fullName: parsedData.fullName || null,
      email: parsedData.email || null,
      mobile: parsedData.mobile || null
    };

    return result;

  } catch (error) {
    if (error.code === 'insufficient_quota') {
      throw new Error('OpenAI quota exceeded.');
    } else if (error.code === 'rate_limit_exceeded') {
      throw new Error('Rate limit exceeded.');
    } else if (error.code === 'invalid_api_key') {
      throw new Error('Invalid API key.');
    }
    throw new Error(`Failed to parse resume: ${error.message}`);
  }
};

/**
 * New Talent Signup with Resume Upload
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const signup = async (req, res) => {
  try {
    const { role_id } = req.body;

    // Check if resume file was uploaded
    if (!req.file) {
      return sendResponse(res, 'error', null, 'Resume file is required', statusType.BAD_REQUEST);
    }
    

    // Validate role_id
    if (!role_id) {
      return sendResponse(res, 'error', null, 'Role ID is required', statusType.BAD_REQUEST);
    }

    // Check if role exists (should be talent role, typically role_id = 2)
    const role = await prisma.role.findUnique({
      where: { role_id: parseInt(role_id) }
    });

    if (!role) {
      return sendResponse(res, 'error', null, 'Invalid role ID', statusType.BAD_REQUEST);
    }

    // Parse resume to extract information
    const filePath = req.file.path;

    
    // Convert absolute path to relative path from /uploads
    const uploadsIndex = filePath.indexOf('/uploads/');
    const relativePath = uploadsIndex !== -1 ? filePath.substring(uploadsIndex + 1) : filePath.replace(/\\/g, '/');
    
    
    // List files in the directory
    const uploadDir = path.join(__dirname, '../../../../public/uploads/talent/resumes');
    if (fs.existsSync(uploadDir)) {
      const files = fs.readdirSync(uploadDir);
    } else {
    }
    
    const parsedInfo = await parseResumeWithOpenAI(filePath, relativePath);

    // Validate extracted information
    if (!parsedInfo.email || !parsedInfo.fullName || !parsedInfo.mobile) {
      return sendResponse(res, 'error', {
        message: 'Could not extract all required information from resume',
        extracted: parsedInfo
      }, 'Resume parsing incomplete', statusType.BAD_REQUEST);
    }

    // Validate email format
    if (!validateEmail(parsedInfo.email)) {
      return sendResponse(res, 'error', {
        message: 'Invalid email format in resume',
        field: 'user_email'
      }, 'Validation errors', statusType.BAD_REQUEST);
    }

    // Sanitize and validate phone format
    const sanitizedMobile = sanitizePhoneNumber(parsedInfo.mobile);
    if (!sanitizedMobile) {
      return sendResponse(res, 'error', {
        message: 'Invalid phone number format in resume',
        field: 'user_mobile'
      }, 'Validation errors', statusType.BAD_REQUEST);
    }
    
    // Update parsedInfo with sanitized mobile number
    parsedInfo.mobile = sanitizedMobile;

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { user_email: parsedInfo.email.toLowerCase() },
          { user_mobile: parsedInfo.mobile }
        ]
      }
    });

    if (existingUser) {
      return sendResponse(res, 'error', null, 'User with this email or mobile number already exists', statusType.BAD_REQUEST);
    }

    // Generate password from first name
    const firstName = parsedInfo.fullName.split(' ')[0];
    const generatedPassword = `${firstName}@123`;

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(generatedPassword, saltRounds);

    // Create user and profile in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create user
      const newUser = await tx.user.create({
        data: {
          user_full_name: sanitizeInput(parsedInfo.fullName),
          user_email: parsedInfo.email.toLowerCase(),
          user_mobile: parsedInfo.mobile,
          user_password: hashedPassword,
          role_id: parseInt(role_id),
          status: true,
          is_verified: false,
          is_active: true,
          is_deleted: false,
          is_blocked: false,
          is_suspended: false
        },
        select: {
          user_id: true,
          user_full_name: true,
          user_email: true,
          user_mobile: true,
          role_id: true,
          status: true,
          is_verified: true,
          is_active: true,
          created_at: true,
          user_role: {
            select: {
              role_name: true
            }
          }
        }
      });

      // Create t_profile with resume
      await tx.t_profile.create({
        data: {
          user_id: newUser.user_id,
          tp_resume: relativePath,
          tp_image: null,
          status: true
        }
      });

      return newUser;
    });

    const newUser = result;

    // ============================================
    // FULL RESUME PARSING & PROFILE ENRICHMENT
    // ============================================
    let parsedResumeData = null;
    let profileEnrichmentError = null;

    try {
      // Get the created profile with tp_id
      const talentProfile = await prisma.t_profile.findFirst({
        where: { user_id: newUser.user_id }
      });

      if (!talentProfile) {
        throw new Error('Profile not found after creation');
      }

      // Read the resume file to extract text
      const absolutePath = path.join(process.cwd(), "public", relativePath);
      const buffer = await readFile(absolutePath);
      const parser = new PDFParse({ data: buffer });
      const textResult = await parser.getText();
      await parser.destroy();

      // Create comprehensive parsing prompt
      const comprehensivePrompt = `
You are an expert resume parser and talent assessment AI. Please analyze the following resume text and extract comprehensive profile information.

Resume Text:
${textResult.text}

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

      // Call OpenAI API for comprehensive parsing
      const comprehensiveCompletion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an expert resume parser and talent assessment AI. You analyze resumes and extract structured professional information. Always return valid JSON format only."
          },
          {
            role: "user",
            content: comprehensivePrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      });

      const aiResponse = comprehensiveCompletion.choices[0].message.content;
      
      // Parse the JSON response
      let parsedData;
      try {
        const cleanResponse = aiResponse
          .replace(/```json/g, '')
          .replace(/```/g, '')
          .trim();
        parsedData = JSON.parse(cleanResponse);
      } catch (parseError) {
        console.error('Error parsing comprehensive OpenAI response:', parseError);
        throw new Error('Failed to parse comprehensive AI response');
      }

      // Check experience requirement
      if (parsedData.experience_years < 10) {
        profileEnrichmentError = {
          experience_years: parsedData.experience_years,
          message: 'Candidate must have at least 10 years of experience'
        };
        // Continue with profile creation but flag the error
      }

      // Update the talent profile with comprehensive parsed data
      await prisma.t_profile.updateMany({
        where: { user_id: newUser.user_id },
        data: {
          tp_designation: parsedData.short_profile?.job_title || parsedData.full_profile?.job_title,
          tp_location: parsedData.full_profile?.location,
          tp_total_experience: parsedData.experience_years?.toString(),
          tp_about: parsedData.full_profile?.summary,
          tp_professional_summary: parsedData.short_profile?.summary,
          updated_at: new Date()
        }
      });

      // Save projects data if available
      let createdProjects = [];
      if (parsedData.projects && Array.isArray(parsedData.projects) && parsedData.projects.length > 0) {
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
      }

      // Save experience data if available
      let createdExperience = [];
      if (parsedData.experience && Array.isArray(parsedData.experience) && parsedData.experience.length > 0) {
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
      }

      // Save skills data if available
      let createdSkills = [];
      if (parsedData.skills && Array.isArray(parsedData.skills) && parsedData.skills.length > 0) {
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
      }

      // Store parsed data for response
      parsedResumeData = {
        parsed_data: parsedData,
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

    } catch (enrichmentError) {
      console.error('Error during profile enrichment:', enrichmentError);
      // Store error but don't fail the signup
      profileEnrichmentError = profileEnrichmentError || {
        message: 'Profile created but enrichment failed',
        error: enrichmentError.message
      };
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        user_id: newUser.user_id,
        user_email: newUser.user_email,
        role_id: newUser.role_id
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Send email with credentials via Brevo
    try {
      await sendNotificationEmail(
        newUser.user_email,
        newUser.user_full_name,
        'Welcome to TalentFlip - Your Account Credentials',
        '🎉 Welcome to TalentFlip!',
        `
          <p>Your account has been created successfully!</p>
          <p><strong>Your login credentials:</strong></p>
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Email:</strong> ${newUser.user_email}</p>
            <p style="margin: 5px 0;"><strong>Password:</strong> ${generatedPassword}</p>
          </div>
          <p style="color: #ef4444; font-weight: 600;">⚠️ Important: Please change your password after your first login for security purposes.</p>
          <p>We're excited to have you on board!</p>
        `,
        'Login to Your Account',
        process.env.FRONTEND_URL || 'http://localhost:4000'
      );
    } catch (emailError) {
      // Don't fail the signup if email fails
    }

    // Prepare response data
    const responseData = {
      user: newUser,
      token,
      resume_parsing: parsedResumeData,
      warnings: profileEnrichmentError ? [profileEnrichmentError] : []
    };

    // Check if there was an experience requirement issue
    if (profileEnrichmentError && profileEnrichmentError.experience_years < 10) {
      return sendResponse(
        res, 
        'warning', 
        responseData, 
        `User registered successfully, but profile has insufficient experience: ${profileEnrichmentError.experience_years} years (minimum 10 required). Credentials sent to email.`, 
        statusType.CREATED
      );
    }

    return sendResponse(
      res, 
      'success', 
      responseData, 
      'User registered successfully. Profile enriched with resume data. Credentials sent to email.', 
      statusType.CREATED
    );

  } catch (error) {
    return sendResponse(res, 'error', error.message, 'Internal server error during signup', statusType.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Old User Signup Controller (Manual Entry)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const signupOld = async (req, res) => {
  try {
    const { user_full_name, user_email, user_mobile, user_password, role_id } = req.body;

    // Validate required fields
    const requiredFields = ['user_full_name', 'user_email', 'user_mobile', 'user_password', 'role_id'];
    const missingFields = validateRequired(requiredFields, req.body);
    
    if (missingFields.length > 0) {
      return sendResponse(res, 'error', {
        message: 'Missing required fields',
        fields: missingFields
      }, 'Validation errors', statusType.BAD_REQUEST);
    }

    // Validate email format
    if (!validateEmail(user_email)) {
      return sendResponse(res, 'error', {
        message: 'Invalid email format',
        field: 'user_email'
      }, 'Validation errors', statusType.BAD_REQUEST);
    }

    // Validate password strength
    if (!validatePassword(user_password)) {
      return sendResponse(res, 'error', {
        message: 'Password must be at least 8 characters long with at least 1 uppercase letter, 1 lowercase letter, and 1 number',
        field: 'user_password'
      }, 'Validation errors', statusType.BAD_REQUEST);
    }

    // Validate phone format
    if (!validatePhone(user_mobile)) {
      return sendResponse(res, 'error', {
        message: 'Invalid phone number format',
        field: 'user_mobile'
      }, 'Validation errors', statusType.BAD_REQUEST);
    }

    // Check if role exists
    const role = await prisma.role.findUnique({
      where: { role_id: parseInt(role_id) }
    });

    if (!role) {
      return sendResponse(res, 'error', null, 'Invalid role ID', statusType.BAD_REQUEST);
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { user_email: user_email.toLowerCase() },
          { user_mobile: user_mobile }
        ]
      }
    });

    if (existingUser) {
      return sendResponse(res, 'error', null, 'User with this email or mobile number already exists', statusType.BAD_REQUEST);
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(user_password, saltRounds);

    // Create user and profile in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create user
      const newUser = await tx.user.create({
        data: {
          user_full_name: sanitizeInput(user_full_name),
          user_email: user_email.toLowerCase(),
          user_mobile: user_mobile,
          user_password: hashedPassword,
          role_id: parseInt(role_id),
          status: true,
          is_verified: false,
          is_active: true,
          is_deleted: false,
          is_blocked: false,
          is_suspended: false
        },
        select: {
          user_id: true,
          user_full_name: true,
          user_email: true,
          user_mobile: true,
          role_id: true,
          status: true,
          is_verified: true,
          is_active: true,
          created_at: true,
          user_role: {
            select: {
              role_name: true
            }
          }
        }
      });

      // Create empty t_profile for the user
      await tx.t_profile.create({
        data: {
          user_id: newUser.user_id,
          tp_resume: null,
          tp_image: null,
          status: true
        }
      });

      return newUser;
    });

    const newUser = result;

    // Generate JWT token
    const token = jwt.sign(
      { 
        user_id: newUser.user_id,
        user_email: newUser.user_email,
        role_id: newUser.role_id
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return sendResponse(res, 'success', {
      user: newUser,
      token
    }, 'User registered successfully', statusType.CREATED);

  } catch (error) {
    return sendResponse(res, 'error', error.message, 'Internal server error during signup', statusType.INTERNAL_SERVER_ERROR);
  }
};

/**
 * User Sign-in Controller
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const signin = async (req, res) => {
  try {
    const { user_email, user_password } = req.body;

    // Validate required fields
    const requiredFields = ['user_email', 'user_password'];
    const missingFields = validateRequired(requiredFields, req.body);
    
    if (missingFields.length > 0) {
      return sendResponse(res, 'error', {
        message: 'Missing required fields',
        fields: missingFields
      }, 'Validation errors', statusType.BAD_REQUEST);
    }

    // Validate email format
    if (!validateEmail(user_email)) {
      return sendResponse(res, 'error', {
        message: 'Invalid email format',
        field: 'user_email'
      }, 'Validation errors', statusType.BAD_REQUEST);
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { user_email: user_email.toLowerCase() },
      include: {
        user_role: {
          select: {
            role_name: true
          }
        }
      }
    });

    if (!user) {
      return sendResponse(res, 'error', null, 'Invalid email or password', statusType.UNAUTHORIZED);
    }

    // Check if user is active and not blocked
    if (!user.is_active || user.is_blocked || user.is_deleted) {
      return sendResponse(res, 'error', null, 'Account is inactive, blocked, or deleted', statusType.UNAUTHORIZED);
    }

    // Check if user is suspended
    if (user.is_suspended) {
      return sendResponse(res, 'error', null, 'Account is suspended', statusType.UNAUTHORIZED);
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(user_password, user.user_password);
    
    if (!isPasswordValid) {
      return sendResponse(res, 'error', null, 'Invalid email or password', statusType.UNAUTHORIZED);
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        user_id: user.user_id,
        user_email: user.user_email,
        role_id: user.role_id
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Remove password from response
    const { user_password: _, ...userWithoutPassword } = user;

    return sendResponse(res, 'success', {
      user: userWithoutPassword,
      token
    }, 'Login successful', statusType.SUCCESS);

  } catch (error) {
    return sendResponse(res, 'error', error.message, 'Internal server error during signin', statusType.INTERNAL_SERVER_ERROR);
  }
};
