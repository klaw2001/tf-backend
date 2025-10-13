import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { sendResponse } from '../app/helpers/responseHelper.js';
import statusType from '../app/enums/statusTypes.js';

const prisma = new PrismaClient();

// JWT secret - should match the one in authController
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * Common Middleware
 * Verifies JWT token and checks if user has talent or recruiter privileges
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const commonMiddleware = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return sendResponse(res, 'error', null, 'Access denied. No token provided.', statusType.UNAUTHORIZED);
    }

    // Check if token starts with 'Bearer '
    if (!authHeader.startsWith('Bearer ')) {
      return sendResponse(res, 'error', null, 'Access denied. Invalid token format.', statusType.UNAUTHORIZED);
    }

    // Extract token
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      return sendResponse(res, 'error', null, 'Access denied. No token provided.', statusType.UNAUTHORIZED);
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Check if user still exists and is active
    const user = await prisma.user.findUnique({
      where: { user_id: decoded.user_id },
      select: {
        user_id: true,
        user_email: true,
        role_id: true,
        is_active: true,
        is_blocked: true,
        is_deleted: true,
        is_suspended: true,
        status: true
      }
    });

    if (!user) {
      return sendResponse(res, 'error', null, 'Access denied. User not found.', statusType.UNAUTHORIZED);
    }

    // Check if user is active and not blocked
    if (!user.is_active || user.is_blocked || user.is_deleted) {
      return sendResponse(res, 'error', null, 'Access denied. Account is inactive, blocked, or deleted.', statusType.UNAUTHORIZED);
    }

    // Check if user is suspended
    if (user.is_suspended) {
      return sendResponse(res, 'error', null, 'Access denied. Account is suspended.', statusType.UNAUTHORIZED);
    }

    // Check if user status is active
    if (!user.status) {
      return sendResponse(res, 'error', null, 'Access denied. Account is inactive.', statusType.UNAUTHORIZED);
    }

    // Check if user is talent (role_id 3) or recruiter (role_id 2)
    if (user.role_id !== 2 && user.role_id !== 3) {
      return sendResponse(res, 'error', null, 'Access denied. Talent or Recruiter access required.', statusType.FORBIDDEN);
    }

    // Attach user information to request object
    req.user = {
      user_id: user.user_id,
      user_email: user.user_email,
      role_id: user.role_id
    };

    // User is authenticated and has talent or recruiter privileges
    next();

  } catch (error) {
    console.error('Common middleware error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return sendResponse(res, 'error', null, 'Access denied. Invalid token.', statusType.UNAUTHORIZED);
    }
    
    if (error.name === 'TokenExpiredError') {
      return sendResponse(res, 'error', null, 'Access denied. Token expired.', statusType.UNAUTHORIZED);
    }
    
    return sendResponse(res, 'error', null, 'Access denied. Verification failed.', statusType.FORBIDDEN);
  }
};

export default commonMiddleware;

