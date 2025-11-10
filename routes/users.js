/**
 * User Profile Management Routes for SpeedoPage
 *
 * Handles user profile updates, settings, and account management
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { hashPassword, verifyPassword, validatePassword } = require('../middleware/password');
const { query } = require('../db/connection');
const router = express.Router();

/**
 * GET /api/users/:userId/profile
 * Get user profile (public or own)
 */
router.get('/:userId/profile', async (req, res) => {
  const requestedUserId = parseInt(req.params.userId);
  const isOwnProfile = req.user && req.user.userId === requestedUserId;

  if (isNaN(requestedUserId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  try {
    // Determine which fields to return based on privacy settings
    const fields = isOwnProfile
      ? 'id, email, display_name, created_at, updated_at'
      : 'id, display_name, created_at';

    const result = await query(
      `SELECT ${fields} FROM users WHERE id = $1`,
      [requestedUserId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    res.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }
    });
  } catch (err) {
    console.error('Error fetching user profile:', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

/**
 * PUT /api/users/:userId/profile
 * Update user profile (requires auth and ownership)
 */
router.put('/:userId/profile', requireAuth, [
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

  try {
    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 1;
    const allowedFields = ['displayName'];

    allowedFields.forEach(field => {
      if (req.body.hasOwnProperty(field)) {
        const dbField = field === 'displayName' ? 'display_name' : field;
        updates.push(`${dbField} = $${paramCount}`);
        values.push(req.body[field]);
        paramCount++;
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(userId);

    const updateQuery = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, email, display_name, created_at, updated_at`;

    const result = await query(updateQuery, values);
    const user = result.rows[0];

    console.log(`Profile updated for user ${userId}`);

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }
    });
  } catch (err) {
    console.error('Error updating profile:', err);
    return res.status(500).json({ error: 'Database error' });
  }
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

  try {
    // Fetch user with current password hash
    const result = await query(
      'SELECT id, password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    // Verify current password
    const passwordValid = await verifyPassword(currentPassword, user.password_hash);

    if (!passwordValid) {
      return res.status(401).json({
        error: 'Current password is incorrect',
        code: 'INVALID_PASSWORD'
      });
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newPasswordHash, userId]);

    console.log(`Password updated for user ${userId}`);

    res.json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (err) {
    console.error('Error updating password:', err);
    return res.status(500).json({ error: 'Database error' });
  }
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

  try {
    // Fetch user with password hash
    const result = await query(
      'SELECT id, email, password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    // Verify password
    const passwordValid = await verifyPassword(password, user.password_hash);

    if (!passwordValid) {
      return res.status(401).json({
        error: 'Password is incorrect',
        code: 'INVALID_PASSWORD'
      });
    }

    // Delete user account (CASCADE will delete cars, sessions, etc.)
    await query('DELETE FROM users WHERE id = $1', [userId]);

    console.log(`Account deleted: ${user.email} (ID: ${userId})`);

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (err) {
    console.error('Error deleting account:', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

/**
 * GET /api/users/:userId/stats
 * Get user statistics (total sessions, distance, etc.)
 */
router.get('/:userId/stats', requireAuth, async (req, res) => {
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

  try {
    // Get overall statistics
    const statsResult = await query(
      `SELECT
        COUNT(*) as total_sessions,
        MAX(v_max) as top_speed,
        SUM(distance) as total_distance,
        SUM(duration) as total_duration,
        AVG(v_max) as avg_max_speed
      FROM sessions
      WHERE user_id = $1`,
      [userId]
    );

    const stats = statsResult.rows[0];

    // Get car count
    const carResult = await query(
      'SELECT COUNT(*) as car_count FROM cars WHERE user_id = $1',
      [userId]
    );

    res.json({
      stats: {
        totalSessions: parseInt(stats.total_sessions) || 0,
        topSpeed: parseFloat(stats.top_speed) || 0,
        totalDistance: parseFloat(stats.total_distance) || 0,
        totalDuration: parseInt(stats.total_duration) || 0,
        avgMaxSpeed: parseFloat(stats.avg_max_speed) || 0,
        carCount: parseInt(carResult.rows[0].car_count) || 0
      }
    });
  } catch (err) {
    console.error('Error fetching user stats:', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

module.exports = {
  router
};
