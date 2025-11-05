/**
 * User Profile Management Routes for SpeedoPage
 *
 * Handles user profile updates, settings, and account management
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { hashPassword, verifyPassword, validatePassword } = require('../middleware/password');
const router = express.Router();

// Database will be injected by server.js
let db;

function setDatabase(database) {
  db = database;
}

/**
 * GET /api/users/:userId/profile
 * Get user profile (public or own)
 */
router.get('/:userId/profile', (req, res) => {
  const requestedUserId = parseInt(req.params.userId);
  const isOwnProfile = req.user && req.user.userId === requestedUserId;

  if (isNaN(requestedUserId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  // Determine which fields to return based on privacy settings
  const fields = isOwnProfile
    ? 'id, email, displayName, avatarUrl, unitsPreference, isEmailVerified, isPublicProfile, createdAt, lastLoginAt'
    : 'id, displayName, avatarUrl, isPublicProfile, createdAt';

  db.get(
    `SELECT ${fields} FROM users WHERE id = ?`,
    [requestedUserId],
    (err, user) => {
      if (err) {
        console.error('Error fetching user profile:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if profile is public or if it's own profile
      if (!isOwnProfile && !user.isPublicProfile) {
        return res.status(403).json({
          error: 'Profile is private',
          code: 'PRIVATE_PROFILE'
        });
      }

      res.json({ user });
    }
  );
});

/**
 * PUT /api/users/:userId/profile
 * Update user profile (requires auth and ownership)
 */
router.put('/:userId/profile', requireAuth, [
  body('displayName').optional().trim().isLength({ min: 1, max: 50 }),
  body('avatarUrl').optional().isURL(),
  body('unitsPreference').optional().isIn(['auto', 'kmh', 'mph']),
  body('isPublicProfile').optional().isBoolean()
], (req, res) => {
  // Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }

  const userId = parseInt(req.params.userId);
  const requesterId = req.user.userId;

  if (isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  // Check ownership
  if (userId !== requesterId) {
    return res.status(403).json({
      error: 'Access denied',
      code: 'FORBIDDEN'
    });
  }

  // Build update query dynamically
  const updates = [];
  const values = [];
  const allowedFields = ['displayName', 'avatarUrl', 'unitsPreference', 'isPublicProfile'];

  allowedFields.forEach(field => {
    if (req.body.hasOwnProperty(field)) {
      updates.push(`${field} = ?`);
      values.push(req.body[field]);
    }
  });

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  values.push(userId);

  const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;

  db.run(query, values, function(err) {
    if (err) {
      console.error('Error updating profile:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    // Fetch updated profile
    db.get(
      'SELECT id, email, displayName, avatarUrl, unitsPreference, isEmailVerified, isPublicProfile, createdAt, lastLoginAt FROM users WHERE id = ?',
      [userId],
      (err, user) => {
        if (err) {
          console.error('Error fetching updated profile:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        console.log(`Profile updated for user ${userId}`);

        res.json({
          success: true,
          user
        });
      }
    );
  });
});

/**
 * PUT /api/users/:userId/password
 * Change user password (requires current password)
 */
router.put('/:userId/password', requireAuth, [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8, max: 128 })
], async (req, res) => {
  // Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }

  const userId = parseInt(req.params.userId);
  const requesterId = req.user.userId;
  const { currentPassword, newPassword } = req.body;

  if (isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  // Check ownership
  if (userId !== requesterId) {
    return res.status(403).json({
      error: 'Access denied',
      code: 'FORBIDDEN'
    });
  }

  // Validate new password strength
  const passwordValidation = validatePassword(newPassword);
  if (!passwordValidation.valid) {
    return res.status(400).json({
      error: 'New password does not meet requirements',
      details: passwordValidation.errors
    });
  }

  // Fetch user with current password hash
  db.get('SELECT id, passwordHash FROM users WHERE id = ?', [userId], async (err, user) => {
    if (err) {
      console.error('Error fetching user:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    let passwordValid;
    try {
      passwordValid = await verifyPassword(currentPassword, user.passwordHash);
    } catch (verifyErr) {
      console.error('Error verifying password:', verifyErr);
      return res.status(500).json({ error: 'Server error' });
    }

    if (!passwordValid) {
      return res.status(401).json({
        error: 'Current password is incorrect',
        code: 'INVALID_PASSWORD'
      });
    }

    // Hash new password
    let newPasswordHash;
    try {
      newPasswordHash = await hashPassword(newPassword);
    } catch (hashErr) {
      console.error('Error hashing password:', hashErr);
      return res.status(500).json({ error: 'Server error' });
    }

    // Update password
    db.run('UPDATE users SET passwordHash = ? WHERE id = ?', [newPasswordHash, userId], (err) => {
      if (err) {
        console.error('Error updating password:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      console.log(`Password updated for user ${userId}`);

      res.json({
        success: true,
        message: 'Password updated successfully'
      });
    });
  });
});

/**
 * DELETE /api/users/:userId/account
 * Delete user account (requires password confirmation)
 */
router.delete('/:userId/account', requireAuth, [
  body('password').notEmpty(),
  body('confirmation').equals('DELETE')
], async (req, res) => {
  // Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }

  const userId = parseInt(req.params.userId);
  const requesterId = req.user.userId;
  const { password } = req.body;

  if (isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  // Check ownership
  if (userId !== requesterId) {
    return res.status(403).json({
      error: 'Access denied',
      code: 'FORBIDDEN'
    });
  }

  // Fetch user with password hash
  db.get('SELECT id, email, passwordHash FROM users WHERE id = ?', [userId], async (err, user) => {
    if (err) {
      console.error('Error fetching user:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
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
        error: 'Password is incorrect',
        code: 'INVALID_PASSWORD'
      });
    }

    // Delete user account (CASCADE will delete cars, sessions, etc.)
    db.run('DELETE FROM users WHERE id = ?', [userId], (err) => {
      if (err) {
        console.error('Error deleting account:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      console.log(`Account deleted: ${user.email} (ID: ${userId})`);

      res.json({
        success: true,
        message: 'Account deleted successfully'
      });
    });
  });
});

/**
 * GET /api/users/:userId/stats
 * Get user statistics (total sessions, distance, etc.)
 */
router.get('/:userId/stats', requireAuth, (req, res) => {
  const userId = parseInt(req.params.userId);
  const requesterId = req.user.userId;

  if (isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  // Check ownership
  if (userId !== requesterId) {
    return res.status(403).json({
      error: 'Access denied',
      code: 'FORBIDDEN'
    });
  }

  // Get overall statistics
  db.get(
    `SELECT
      COUNT(*) as totalSessions,
      MAX(vMax) as topSpeed,
      SUM(distance) as totalDistance,
      SUM(duration) as totalDuration,
      AVG(vMax) as avgMaxSpeed
    FROM sessions
    WHERE userId = ?`,
    [userId],
    (err, stats) => {
      if (err) {
        console.error('Error fetching user stats:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      // Get car count
      db.get('SELECT COUNT(*) as carCount FROM cars WHERE userId = ?', [userId], (err, carResult) => {
        if (err) {
          console.error('Error fetching car count:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        res.json({
          stats: {
            totalSessions: stats.totalSessions || 0,
            topSpeed: stats.topSpeed || 0,
            totalDistance: stats.totalDistance || 0,
            totalDuration: stats.totalDuration || 0,
            avgMaxSpeed: stats.avgMaxSpeed || 0,
            carCount: carResult.carCount || 0
          }
        });
      });
    }
  );
});

module.exports = {
  router,
  setDatabase
};
