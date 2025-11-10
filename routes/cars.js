/**
 * Car Management Routes for SpeedoPage
 *
 * Handles CRUD operations for user's car garage
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { query } = require('../db/connection');
const router = express.Router();

/**
 * GET /api/cars
 * Get all cars for the authenticated user
 */
router.get('/', requireAuth, async (req, res) => {
  const userId = req.user.userId;

  try {
    const result = await query(
      'SELECT * FROM cars WHERE user_id = $1 ORDER BY is_active DESC, created_at DESC',
      [userId]
    );

    // Convert snake_case to camelCase for frontend
    const cars = result.rows.map(car => ({
      id: car.id,
      userId: car.user_id,
      name: car.name,
      make: car.make,
      model: car.model,
      year: car.year,
      trim: car.trim,
      color: car.color,
      photoUrl: car.photo_url,
      weight: car.weight,
      horsepower: car.horsepower,
      modifications: car.modifications,
      isActive: car.is_active,
      createdAt: car.created_at,
      updatedAt: car.updated_at
    }));

    res.json({ cars });
  } catch (err) {
    console.error('Error fetching cars:', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

/**
 * GET /api/cars/:carId
 * Get a specific car by ID
 */
router.get('/:carId', requireAuth, async (req, res) => {
  const userId = req.user.userId;
  const carId = parseInt(req.params.carId);

  if (isNaN(carId)) {
    return res.status(400).json({ error: 'Invalid car ID' });
  }

  try {
    const result = await query(
      'SELECT * FROM cars WHERE id = $1 AND user_id = $2',
      [carId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Car not found' });
    }

    const car = result.rows[0];
    res.json({
      car: {
        id: car.id,
        userId: car.user_id,
        name: car.name,
        make: car.make,
        model: car.model,
        year: car.year,
        trim: car.trim,
        color: car.color,
        photoUrl: car.photo_url,
        weight: car.weight,
        horsepower: car.horsepower,
        modifications: car.modifications,
        isActive: car.is_active,
        createdAt: car.created_at,
        updatedAt: car.updated_at
      }
    });
  } catch (err) {
    console.error('Error fetching car:', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

/**
 * POST /api/cars
 * Add a new car to the user's garage
 */
router.post('/', requireAuth, [
  body('name').trim().isLength({ min: 1, max: 100 }),
  body('make').optional().trim().isLength({ max: 50 }),
  body('model').optional().trim().isLength({ max: 50 }),
  body('year').optional().isInt({ min: 1900, max: 2100 }),
  body('trim').optional().trim().isLength({ max: 50 }),
  body('color').optional().trim().isLength({ max: 30 }),
  body('weight').optional().isFloat({ min: 0 }),
  body('horsepower').optional().isInt({ min: 0 }),
  body('modifications').optional().isString()
], async (req, res) => {
  // Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }

  const userId = req.user.userId;
  const {
    name,
    make,
    model,
    year,
    trim,
    color,
    photoUrl,
    weight,
    horsepower,
    modifications
  } = req.body;

  try {
    // Check if user has any cars - if not, make this one active
    const countResult = await query(
      'SELECT COUNT(*) as count FROM cars WHERE user_id = $1',
      [userId]
    );

    const isFirstCar = parseInt(countResult.rows[0].count) === 0;
    const isActive = isFirstCar;

    // Insert new car
    const result = await query(
      `INSERT INTO cars (
        user_id, name, make, model, year, trim, color, photo_url,
        weight, horsepower, modifications, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        userId,
        name,
        make || null,
        model || null,
        year || null,
        trim || null,
        color || null,
        photoUrl || null,
        weight || null,
        horsepower || null,
        modifications || null,
        isActive
      ]
    );

    const car = result.rows[0];
    console.log(`New car added: ${name} (ID: ${car.id}) for user ${userId}`);

    res.status(201).json({
      success: true,
      car: {
        id: car.id,
        userId: car.user_id,
        name: car.name,
        make: car.make,
        model: car.model,
        year: car.year,
        trim: car.trim,
        color: car.color,
        photoUrl: car.photo_url,
        weight: car.weight,
        horsepower: car.horsepower,
        modifications: car.modifications,
        isActive: car.is_active,
        createdAt: car.created_at,
        updatedAt: car.updated_at
      }
    });
  } catch (err) {
    console.error('Error creating car:', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

/**
 * PUT /api/cars/:carId
 * Update a car
 */
router.put('/:carId', requireAuth, [
  body('name').optional().trim().isLength({ min: 1, max: 100 }),
  body('make').optional().trim().isLength({ max: 50 }),
  body('model').optional().trim().isLength({ max: 50 }),
  body('year').optional().isInt({ min: 1900, max: 2100 }),
  body('trim').optional().trim().isLength({ max: 50 }),
  body('color').optional().trim().isLength({ max: 30 }),
  body('weight').optional().isFloat({ min: 0 }),
  body('horsepower').optional().isInt({ min: 0 }),
  body('modifications').optional().isString()
], async (req, res) => {
  // Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }

  const userId = req.user.userId;
  const carId = parseInt(req.params.carId);

  if (isNaN(carId)) {
    return res.status(400).json({ error: 'Invalid car ID' });
  }

  try {
    // Check if car exists and belongs to user
    const checkResult = await query(
      'SELECT * FROM cars WHERE id = $1 AND user_id = $2',
      [carId, userId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Car not found' });
    }

    // Build update query dynamically based on provided fields
    const updates = [];
    const values = [];
    let paramCount = 1;

    const fieldMapping = {
      name: 'name',
      make: 'make',
      model: 'model',
      year: 'year',
      trim: 'trim',
      color: 'color',
      photoUrl: 'photo_url',
      weight: 'weight',
      horsepower: 'horsepower',
      modifications: 'modifications'
    };

    Object.keys(fieldMapping).forEach(field => {
      if (req.body.hasOwnProperty(field)) {
        updates.push(`${fieldMapping[field]} = $${paramCount}`);
        values.push(req.body[field]);
        paramCount++;
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Add carId and userId to values for WHERE clause
    values.push(carId);
    values.push(userId);

    const updateQuery = `UPDATE cars SET ${updates.join(', ')} WHERE id = $${paramCount} AND user_id = $${paramCount + 1} RETURNING *`;

    const result = await query(updateQuery, values);
    const updatedCar = result.rows[0];

    console.log(`Car updated: ${updatedCar.name} (ID: ${carId})`);

    res.json({
      success: true,
      car: {
        id: updatedCar.id,
        userId: updatedCar.user_id,
        name: updatedCar.name,
        make: updatedCar.make,
        model: updatedCar.model,
        year: updatedCar.year,
        trim: updatedCar.trim,
        color: updatedCar.color,
        photoUrl: updatedCar.photo_url,
        weight: updatedCar.weight,
        horsepower: updatedCar.horsepower,
        modifications: updatedCar.modifications,
        isActive: updatedCar.is_active,
        createdAt: updatedCar.created_at,
        updatedAt: updatedCar.updated_at
      }
    });
  } catch (err) {
    console.error('Error updating car:', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

/**
 * DELETE /api/cars/:carId
 * Delete a car
 */
router.delete('/:carId', requireAuth, async (req, res) => {
  const userId = req.user.userId;
  const carId = parseInt(req.params.carId);

  if (isNaN(carId)) {
    return res.status(400).json({ error: 'Invalid car ID' });
  }

  try {
    // Check if car exists and belongs to user
    const checkResult = await query(
      'SELECT * FROM cars WHERE id = $1 AND user_id = $2',
      [carId, userId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Car not found' });
    }

    const car = checkResult.rows[0];
    const wasActive = car.is_active;

    // Delete the car
    await query('DELETE FROM cars WHERE id = $1', [carId]);

    console.log(`Car deleted: ${car.name} (ID: ${carId})`);

    // If deleted car was active, set another car as active
    if (wasActive) {
      const nextCarResult = await query(
        'SELECT id FROM cars WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
        [userId]
      );

      if (nextCarResult.rows.length > 0) {
        await query('UPDATE cars SET is_active = true WHERE id = $1', [nextCarResult.rows[0].id]);
      }
    }

    res.json({
      success: true,
      message: 'Car deleted successfully'
    });
  } catch (err) {
    console.error('Error deleting car:', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

/**
 * PUT /api/cars/:carId/set-active
 * Set a car as the active car for the user
 */
router.put('/:carId/set-active', requireAuth, async (req, res) => {
  const userId = req.user.userId;
  const carId = parseInt(req.params.carId);

  if (isNaN(carId)) {
    return res.status(400).json({ error: 'Invalid car ID' });
  }

  try {
    // Check if car exists and belongs to user
    const checkResult = await query(
      'SELECT * FROM cars WHERE id = $1 AND user_id = $2',
      [carId, userId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Car not found' });
    }

    const car = checkResult.rows[0];

    // Set all user's cars to inactive
    await query('UPDATE cars SET is_active = false WHERE user_id = $1', [userId]);

    // Set the selected car as active
    await query('UPDATE cars SET is_active = true WHERE id = $1', [carId]);

    console.log(`Active car set: ${car.name} (ID: ${carId}) for user ${userId}`);

    res.json({
      success: true,
      message: 'Active car updated',
      carId
    });
  } catch (err) {
    console.error('Error setting active car:', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

/**
 * GET /api/cars/:carId/stats
 * Get statistics for a specific car
 */
router.get('/:carId/stats', requireAuth, async (req, res) => {
  const userId = req.user.userId;
  const carId = parseInt(req.params.carId);

  if (isNaN(carId)) {
    return res.status(400).json({ error: 'Invalid car ID' });
  }

  try {
    // Check if car belongs to user
    const carResult = await query(
      'SELECT * FROM cars WHERE id = $1 AND user_id = $2',
      [carId, userId]
    );

    if (carResult.rows.length === 0) {
      return res.status(404).json({ error: 'Car not found' });
    }

    const car = carResult.rows[0];

    // Get session statistics for this car
    const statsResult = await query(
      `SELECT
        COUNT(*) as total_sessions,
        MAX(v_max) as top_speed,
        SUM(distance) as total_distance,
        SUM(duration) as total_duration,
        AVG(v_max) as avg_max_speed
      FROM sessions
      WHERE car_id = $1`,
      [carId]
    );

    const stats = statsResult.rows[0];

    // Get best times (parse timers JSONB)
    const sessionsResult = await query(
      'SELECT timers FROM sessions WHERE car_id = $1 AND timers IS NOT NULL',
      [carId]
    );

    // Parse and aggregate best times
    const bestTimes = {};
    sessionsResult.rows.forEach(session => {
      const timers = session.timers; // Already parsed by pg driver
      if (timers && typeof timers === 'object') {
        Object.keys(timers).forEach(key => {
          const value = typeof timers[key] === 'object' ? timers[key].time : timers[key];
          const timeValue = parseFloat(value);

          if (!isNaN(timeValue)) {
            if (!bestTimes[key] || timeValue < bestTimes[key]) {
              bestTimes[key] = timeValue;
            }
          }
        });
      }
    });

    res.json({
      car: {
        id: car.id,
        userId: car.user_id,
        name: car.name,
        make: car.make,
        model: car.model,
        year: car.year,
        horsepower: car.horsepower,
        isActive: car.is_active
      },
      stats: {
        totalSessions: parseInt(stats.total_sessions) || 0,
        topSpeed: parseFloat(stats.top_speed) || 0,
        totalDistance: parseFloat(stats.total_distance) || 0,
        totalDuration: parseInt(stats.total_duration) || 0,
        avgMaxSpeed: parseFloat(stats.avg_max_speed) || 0,
        bestTimes
      }
    });
  } catch (err) {
    console.error('Error fetching car stats:', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

module.exports = {
  router
};
