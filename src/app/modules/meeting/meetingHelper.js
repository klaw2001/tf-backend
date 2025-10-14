import jwt from 'jsonwebtoken';
import { JITSI_CONFIG } from '../../../config/index.js';

/**
 * Generate Jitsi JWT token for secure meeting access
 * @param {Object} user - User object
 * @param {String} roomName - Meeting room name
 * @param {String} role - User role (host/moderator/participant)
 * @returns {String} JWT token
 */
export const generateJitsiToken = (user, roomName, role = 'participant') => {
  const isModerator = role === 'moderator' || role === 'host' || role === 'Host';
  
  const payload = {
    context: {
      user: {
        id: user.user_id.toString(),
        name: user.user_full_name,
        email: user.user_email,
        avatar: user.profile_image || '',
      },
      features: {
        livestreaming: isModerator,
        recording: isModerator,
        transcription: true,
        'screen-sharing': true,
      },
    },
    aud: JITSI_CONFIG.appId,
    iss: JITSI_CONFIG.appId,
    sub: JITSI_CONFIG.domain.replace('https://', '').replace('http://', ''),
    room: roomName,
    moderator: isModerator,
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 3), // 3 hours expiry
  };

  return jwt.sign(payload, JITSI_CONFIG.appSecret, { algorithm: 'HS256' });
};

/**
 * Generate unique room name
 * @param {String} prefix - Room name prefix (from config or custom)
 * @returns {String} Unique room name
 */
export const generateRoomName = (prefix = null) => {
  const roomPrefix = prefix || JITSI_CONFIG.roomPrefix;
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${roomPrefix}${timestamp}_${random}`;
};

/**
 * Calculate meeting duration
 * @param {Date} startTime - Meeting start time
 * @param {Date} endTime - Meeting end time
 * @returns {Number} Duration in seconds
 */
export const calculateDuration = (startTime, endTime) => {
  if (!startTime || !endTime) return null;
  return Math.floor((new Date(endTime) - new Date(startTime)) / 1000);
};

/**
 * Format duration to human readable format
 * @param {Number} seconds - Duration in seconds
 * @returns {String} Formatted duration (e.g., "1h 23m 45s")
 */
export const formatDuration = (seconds) => {
  if (!seconds) return '0s';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
  
  return parts.join(' ');
};

/**
 * Validate meeting password (if required)
 * @param {String} password - Password to validate
 * @returns {Boolean} True if valid
 */
export const isValidMeetingPassword = (password) => {
  if (!password) return true; // Optional password
  return password.length >= 4 && password.length <= 50;
};

export default {
  generateJitsiToken,
  generateRoomName,
  calculateDuration,
  formatDuration,
  isValidMeetingPassword,
};

