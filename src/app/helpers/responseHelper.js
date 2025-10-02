import statusType from '../enums/statusTypes.js';

/**
 * Unified response helper function
 * @param {Object} res - Express response object
 * @param {string} status - Response status ('success' or 'error')
 * @param {Object|null} data - Response data
 * @param {string} message - Response message
 * @param {number} statusCode - HTTP status code (default: 200)
 * @param {string|null} apiVersion - API version (default: 'No Version')
 * @returns {Object} JSON response
 */
export function sendResponse(res, status, data, message, statusCode = 200, apiVersion = null) {
    let obj = {
        status,
        data,
        message,
        // statusCode,
        apiVersion: apiVersion || 'No Version',
    };

    return res.status(statusCode).json(obj);
}

/**
 * Send validation error response
 * @param {Object} res - Express response object
 * @param {Object} errors - Validation errors
 * @param {string|null} apiVersion - API version
 * @returns {Object} JSON response
 */
export const sendValidationError = (res, errors, apiVersion = null) => {
    return sendResponse(res, 'error', errors, 'Validation errors', statusType.BAD_REQUEST, apiVersion);
};

export default {
    sendResponse,
    sendValidationError
};