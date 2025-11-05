/**
 * Authentication Routes for SpeedoPage
 *
 * Handles user registration, login, and token management
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { hashPassword, verifyPassword, validatePassword } = require('../middleware/password');
const { generateToken, requireAuth } = require('../middleware/auth');
const router = express.Router();

// Database will be injected by server.js
let db;

function setDatabase(database) {
  db = database;
}

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8, max: 128 }),
  body('displayName').optional().trim().isLength({ min: 1, max: 50 })
], async (req, res) => {
  // Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }

  const { email, password, displayName } = req.body;

  // Validate password strength
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    return res.status(400).json({
      error: 'Password does not meet requirements',
      details: passwordValidation.errors
    });
  }

  try {
    // Check if user already exists
    db.get('SELECT id FROM users WHERE email = ?', [email], async (err, existingUser) => {
      if (err) {
        console.error('Database error checking for existing user:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (existingUser) {
        return res.status(409).json({
          error: 'User already exists',
          code: 'USER_EXISTS'
        });
      }

      // Hash password
      let passwordHash;
      try {
        passwordHash = await hashPassword(password);
      } catch (hashErr) {
        console.error('Error hashing password:', hashErr);
        return res.status(500).json({ error: 'Server error' });
      }

      // Insert new user
      db.run(
        'INSERT INTO users (email, passwordHash, displayName, createdAt) VALUES (?, ?, ?, ?)',
        [email, passwordHash, displayName || null, new Date().toISOString()],
        function(insertErr) {
          if (insertErr) {
            console.error('Error creating user:', insertErr);
            return res.status(500).json({ error: 'Database error' });
          }

          const userId = this.lastID;

          // Generate JWT token
          const token = generateToken({
            id: userId,
            email,
            displayName: displayName || null
          });

          console.log(`New user registered: ${email} (ID: ${userId})`);

          res.status(201).json({
            success: true,
            token,
            user: {
              id: userId,
              email,
              displayName: displayName || null,
              unitsPreference: 'auto',
              isEmailVerified: false
            }
          });
        }
      );
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/auth/login
 * Login an existing user
 */
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  // Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }

  const { email, password } = req.body;

  try {
    // Find user by email
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
      if (err) {
        console.error('Database error during login:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (!user) {
        return res.status(401).json({
          error: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS'
        });
      }

      // Check if account is suspended
      if (user.accountStatus !== 'active') {
        return res.status(403).json({
          error: 'Account is not active',
          code: 'ACCOUNT_SUSPENDED'
        });
      }

      // Verify password
      let passwordValid;
      try {
        passwordValid = await verifyPassword(password, user.passwordHash);
      } catch (verifyErr) {
        console.error('Error verifying password:', verifyErr);
        return res.status(500).json({ error: 'Server error' });
      }

      if (!passwordValid) {
        return res.status(401).json({
          error: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS'
        });
      }

      // Update last login time
      db.run('UPDATE users SET lastLoginAt = ? WHERE id = ?',
        [new Date().toISOString(), user.id],
        (updateErr) => {
          if (updateErr) {
            console.error('Error updating last login:', updateErr);
          }
        }
      );

      // Generate JWT token
      const token = generateToken({
        id: user.id,
        email: user.email,
        displayName: user.displayName
      });

      console.log(`User logged in: ${email} (ID: ${user.id})`);

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          unitsPreference: user.unitsPreference,
          isEmailVerified: user.isEmailVerified,
          isPublicProfile: user.isPublicProfile,
          avatarUrl: user.avatarUrl
        }
      });
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/auth/me
 * Get current user info (requires authentication)
 */
router.get('/me', requireAuth, (req, res) => {
  const userId = req.user.userId;

  db.get('SELECT id, email, displayName, unitsPreference, isEmailVerified, isPublicProfile, avatarUrl, createdAt, lastLoginAt FROM users WHERE id = ?',
    [userId],
    (err, user) => {
      if (err) {
        console.error('Error fetching user:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ user });
    }
  );
});

/**
 * POST /api/auth/logout
 * Logout (client-side token deletion)
 */
router.post('/logout', (req, res) => {
  // With JWT, logout is handled client-side by deleting the token
  // We could add a token blacklist here if needed
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

/**
 * POST /api/auth/refresh
 * Refresh JWT token (requires valid token)
 */
router.post('/refresh', requireAuth, (req, res) => {
  const userId = req.user.userId;

  // Fetch fresh user data
  db.get('SELECT id, email, displayName FROM users WHERE id = ? AND accountStatus = ?',
    [userId, 'active'],
    (err, user) => {
      if (err) {
        console.error('Error refreshing token:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (!user) {
        return res.status(401).json({ error: 'User not found or inactive' });
      }

      // Generate new token
      const token = generateToken({
        id: user.id,
        email: user.email,
        displayName: user.displayName
      });

      res.json({
        success: true,
        token
      });
    }
  );
});

module.exports = {
  router,
  setDatabase
};
