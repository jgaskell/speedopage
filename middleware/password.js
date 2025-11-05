/**
 * Password hashing utilities for SpeedoPage
 *
 * Uses bcrypt for secure password hashing
 */

const bcrypt = require('bcrypt');

// Salt rounds for bcrypt (10 is a good balance of security and speed)
const SALT_ROUNDS = 10;

/**
 * Hash a password
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>} True if password matches
 */
async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {object} { valid: boolean, errors: string[] }
 */
function validatePassword(password) {
  const errors = [];

  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (password && password.length > 128) {
    errors.push('Password must be less than 128 characters');
  }

  // Check for at least one number
  if (password && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  // Check for at least one letter
  if (password && !/[a-zA-Z]/.test(password)) {
    errors.push('Password must contain at least one letter');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  hashPassword,
  verifyPassword,
  validatePassword,
  SALT_ROUNDS
};
