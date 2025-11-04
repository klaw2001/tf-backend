// Validation helper functions
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password) => {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
};

export const validatePhone = (phone) => {
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  return phoneRegex.test(phone);
};

export const sanitizePhoneNumber = (phone) => {
  if (!phone || typeof phone !== 'string') {
    return null;
  }

  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // Handle different formats
  if (cleaned.startsWith('+')) {
    // International format: +91 98123 45678 -> +919812345678
    cleaned = cleaned.substring(1); // Remove the +
  }
  
  // Handle Indian numbers specifically
  if (cleaned.startsWith('91') && cleaned.length >= 12) {
    // +91 98123 45678 or 919812345678 -> 9812345678
    cleaned = cleaned.substring(2);
  }
  
  // Handle other common country codes that might be present
  const countryCodes = {
    '1': 10,    // US/Canada
    '44': 10,   // UK
    '33': 9,    // France
    '49': 10,   // Germany
    '86': 11,   // China
    '81': 10,   // Japan
    '82': 10,   // South Korea
    '61': 9,    // Australia
    '55': 10,   // Brazil
    '52': 10,   // Mexico
  };
  
  // Check if the number starts with a known country code
  for (const [code, expectedLength] of Object.entries(countryCodes)) {
    if (cleaned.startsWith(code) && cleaned.length > expectedLength) {
      // Remove country code if the remaining number is the expected length
      const withoutCountryCode = cleaned.substring(code.length);
      if (withoutCountryCode.length === expectedLength) {
        cleaned = withoutCountryCode;
        break;
      }
    }
  }
  
  // Final validation - should be 7-15 digits
  if (!/^\d{7,15}$/.test(cleaned)) {
    return null;
  }
  
  return cleaned;
};

export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input.trim().replace(/[<>]/g, '');
};

export const validateRequired = (fields, data) => {
  const missing = [];
  fields.forEach(field => {
    if (!data[field] || (typeof data[field] === 'string' && !data[field].trim())) {
      missing.push(field);
    }
  });
  return missing;
};

export default {
  validateEmail,
  validatePassword,
  validatePhone,
  sanitizePhoneNumber,
  sanitizeInput,
  validateRequired
};
