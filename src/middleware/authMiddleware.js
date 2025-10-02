import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { sendResponse } from '../app/helpers/responseHelper.js';
import statusType from '../app/enums/statusTypes.js';

const prisma = new PrismaClient();

// JWT secret - should match the one in authController
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * Authentication Middleware
 * Verifies JWT token and attaches user information to request object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const authMiddleware = async (req, res, next) => {
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

    // Attach user information to request object
    req.user = {
      user_id: user.user_id,
      user_email: user.user_email,
      role_id: user.role_id
    };

    next();

  } catch (error) {
    console.error('Auth middleware error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return sendResponse(res, 'error', null, 'Access denied. Invalid token.', statusType.UNAUTHORIZED);
    }
    
    if (error.name === 'TokenExpiredError') {
      return sendResponse(res, 'error', null, 'Access denied. Token expired.', statusType.UNAUTHORIZED);
    }
    
    return sendResponse(res, 'error', null, 'Access denied. Token verification failed.', statusType.UNAUTHORIZED);
  }
};

/**
 * Optional Role-based Middleware
 * Checks if user has required role
 * @param {Array} allowedRoles - Array of role IDs that are allowed
 * @returns {Function} Middleware function
 */
export const roleMiddleware = (allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return sendResponse(res, 'error', null, 'Access denied. User not authenticated.', statusType.UNAUTHORIZED);
      }

      if (!allowedRoles.includes(req.user.role_id)) {
        return sendResponse(res, 'error', null, 'Access denied. Insufficient permissions.', statusType.FORBIDDEN);
      }

      next();
    } catch (error) {
      console.error('Role middleware error:', error);
      return sendResponse(res, 'error', null, 'Access denied. Role verification failed.', statusType.FORBIDDEN);
    }
  };
};

/**
 * Admin Only Middleware
 * Checks if user is admin (assuming role_id 1 is admin)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */

export default authMiddleware;