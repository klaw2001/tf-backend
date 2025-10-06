// Export all middleware functions for easy importing
// All middleware includes JWT token verification and Bearer token checking
// Re-export default exports under named aliases
export { default as authMiddleware } from './authMiddleware.js';
export { default as adminMiddleware } from './adminMiddleware.js';
export { default as superAdminMiddleware } from './superAdminMiddleware.js';
export { default as recruiterMiddleware } from './recruiterMiddleware.js';
export { default as talentMiddleware } from './talentMiddleware.js';
export { default as roleMiddleware } from './roleMiddleware.js';
