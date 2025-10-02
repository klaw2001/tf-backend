import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { sendResponse } from '../../helpers/responseHelper.js';
import { validateEmail, validatePassword, validatePhone, validateRequired, sanitizeInput } from '../../helpers/validationHelper.js';
import statusType from '../../enums/statusTypes.js';

const prisma = new PrismaClient();

// JWT secret - in production, this should be in environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * User Signup Controller
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const signup = async (req, res) => {
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
    console.error('Signup error:', error);
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
    console.error('Signin error:', error);
    return sendResponse(res, 'error', error.message, 'Internal server error during signin', statusType.INTERNAL_SERVER_ERROR);
  }
};
