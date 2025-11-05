/**
 * Car Management Routes for SpeedoPage
 *
 * Handles CRUD operations for user's car garage
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// Database will be injected by server.js
let db;

function setDatabase(database) {
  db = database;
}

/**
 * GET /api/cars
 * Get all cars for the authenticated user
 */
router.get('/', requireAuth, (req, res) => {
  const userId = req.user.userId;

  db.all(
    'SELECT * FROM cars WHERE userId = ? ORDER BY isActive DESC, createdAt DESC',
    [userId],
    (err, cars) => {
      if (err) {
        console.error('Error fetching cars:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({ cars });
    }
  );
});

/**
 * GET /api/cars/:carId
 * Get a specific car by ID
 */
router.get('/:carId', requireAuth, (req, res) => {
  const userId = req.user.userId;
  const carId = parseInt(req.params.carId);

  if (isNaN(carId)) {
    return res.status(400).json({ error: 'Invalid car ID' });
  }

  db.get(
    'SELECT * FROM cars WHERE id = ? AND userId = ?',
    [carId, userId],
    (err, car) => {
      if (err) {
        console.error('Error fetching car:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (!car) {
        return res.status(404).json({ error: 'Car not found' });
      }

      res.json({ car });
    }
  );
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
], (req, res) => {
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

  // Check if user has any cars - if not, make this one active
  db.get('SELECT COUNT(*) as count FROM cars WHERE userId = ?', [userId], (err, result) => {
    if (err) {
      console.error('Error checking car count:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    const isFirstCar = result.count === 0;
    const isActive = isFirstCar ? 1 : 0; // First car is automatically active

    // Insert new car
    db.run(
      `INSERT INTO cars (
        userId, name, make, model, year, trim, color, photoUrl,
        weight, horsepower, modifications, isActive, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        isActive,
        new Date().toISOString(),
        new Date().toISOString()
      ],
      function(err) {
        if (err) {
          console.error('Error creating car:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        const carId = this.lastID;

        // Fetch the newly created car
        db.get('SELECT * FROM cars WHERE id = ?', [carId], (err, car) => {
          if (err) {
            console.error('Error fetching new car:', err);
            return res.status(500).json({ error: 'Database error' });
          }

          console.log(`New car added: ${name} (ID: ${carId}) for user ${userId}`);

          res.status(201).json({
            success: true,
            car
          });
        });
      }
    );
  });
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
], (req, res) => {
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

  // Check if car exists and belongs to user
  db.get('SELECT * FROM cars WHERE id = ? AND userId = ?', [carId, userId], (err, car) => {
    if (err) {
      console.error('Error checking car ownership:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!car) {
      return res.status(404).json({ error: 'Car not found' });
    }

    // Build update query dynamically based on provided fields
    const updates = [];
    const values = [];

    const fields = ['name', 'make', 'model', 'year', 'trim', 'color', 'photoUrl', 'weight', 'horsepower', 'modifications'];

    fields.forEach(field => {
      if (req.body.hasOwnProperty(field)) {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Add updatedAt timestamp
    updates.push('updatedAt = ?');
    values.push(new Date().toISOString());

    // Add carId to values for WHERE clause
    values.push(carId);

    const query = `UPDATE cars SET ${updates.join(', ')} WHERE id = ?`;

    db.run(query, values, function(err) {
      if (err) {
        console.error('Error updating car:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      // Fetch updated car
      db.get('SELECT * FROM cars WHERE id = ?', [carId], (err, updatedCar) => {
        if (err) {
          console.error('Error fetching updated car:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        console.log(`Car updated: ${updatedCar.name} (ID: ${carId})`);

        res.json({
          success: true,
          car: updatedCar
        });
      });
    });
  });
});

/**
 * DELETE /api/cars/:carId
 * Delete a car
 */
router.delete('/:carId', requireAuth, (req, res) => {
  const userId = req.user.userId;
  const carId = parseInt(req.params.carId);

  if (isNaN(carId)) {
    return res.status(400).json({ error: 'Invalid car ID' });
  }

  // Check if car exists and belongs to user
  db.get('SELECT * FROM cars WHERE id = ? AND userId = ?', [carId, userId], (err, car) => {
    if (err) {
      console.error('Error checking car ownership:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!car) {
      return res.status(404).json({ error: 'Car not found' });
    }

    const wasActive = car.isActive;

    // Delete the car
    db.run('DELETE FROM cars WHERE id = ?', [carId], function(err) {
      if (err) {
        console.error('Error deleting car:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      console.log(`Car deleted: ${car.name} (ID: ${carId})`);

      // If deleted car was active, set another car as active
      if (wasActive) {
        db.get(
          'SELECT id FROM cars WHERE userId = ? ORDER BY createdAt DESC LIMIT 1',
          [userId],
          (err, nextCar) => {
            if (!err && nextCar) {
              db.run('UPDATE cars SET isActive = 1 WHERE id = ?', [nextCar.id], (err) => {
                if (err) console.error('Error activating next car:', err);
              });
            }
          }
        );
      }

      res.json({
        success: true,
        message: 'Car deleted successfully'
      });
    });
  });
});

/**
 * PUT /api/cars/:carId/set-active
 * Set a car as the active car for the user
 */
router.put('/:carId/set-active', requireAuth, (req, res) => {
  const userId = req.user.userId;
  const carId = parseInt(req.params.carId);

  if (isNaN(carId)) {
    return res.status(400).json({ error: 'Invalid car ID' });
  }

  // Check if car exists and belongs to user
  db.get('SELECT * FROM cars WHERE id = ? AND userId = ?', [carId, userId], (err, car) => {
    if (err) {
      console.error('Error checking car ownership:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!car) {
      return res.status(404).json({ error: 'Car not found' });
    }

    // Set all user's cars to inactive
    db.run('UPDATE cars SET isActive = 0 WHERE userId = ?', [userId], (err) => {
      if (err) {
        console.error('Error deactivating cars:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      // Set the selected car as active
      db.run('UPDATE cars SET isActive = 1 WHERE id = ?', [carId], (err) => {
        if (err) {
          console.error('Error activating car:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        console.log(`Active car set: ${car.name} (ID: ${carId}) for user ${userId}`);

        res.json({
          success: true,
          message: 'Active car updated',
          carId
        });
      });
    });
  });
});

/**
 * GET /api/cars/:carId/stats
 * Get statistics for a specific car
 */
router.get('/:carId/stats', requireAuth, (req, res) => {
  const userId = req.user.userId;
  const carId = parseInt(req.params.carId);

  if (isNaN(carId)) {
    return res.status(400).json({ error: 'Invalid car ID' });
  }

  // Check if car belongs to user
  db.get('SELECT * FROM cars WHERE id = ? AND userId = ?', [carId, userId], (err, car) => {
    if (err) {
      console.error('Error checking car ownership:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!car) {
      return res.status(404).json({ error: 'Car not found' });
    }

    // Get session statistics for this car
    db.get(
      `SELECT
        COUNT(*) as totalSessions,
        MAX(vMax) as topSpeed,
        SUM(distance) as totalDistance,
        SUM(duration) as totalDuration,
        AVG(vMax) as avgMaxSpeed
      FROM sessions
      WHERE carId = ?`,
      [carId],
      (err, stats) => {
        if (err) {
          console.error('Error fetching car stats:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        // Get best times (parse timers JSON)
        db.all(
          'SELECT timers FROM sessions WHERE carId = ? AND timers IS NOT NULL',
          [carId],
          (err, sessions) => {
            if (err) {
              console.error('Error fetching session timers:', err);
              return res.status(500).json({ error: 'Database error' });
            }

            // Parse and aggregate best times
            const bestTimes = {};
            sessions.forEach(session => {
              try {
                const timers = JSON.parse(session.timers);
                Object.keys(timers).forEach(key => {
                  const value = typeof timers[key] === 'object' ? timers[key].time : timers[key];
                  const timeValue = parseFloat(value);

                  if (!isNaN(timeValue)) {
                    if (!bestTimes[key] || timeValue < bestTimes[key]) {
                      bestTimes[key] = timeValue;
                    }
                  }
                });
              } catch (e) {
                // Skip invalid JSON
              }
            });

            res.json({
              car,
              stats: {
                totalSessions: stats.totalSessions || 0,
                topSpeed: stats.topSpeed || 0,
                totalDistance: stats.totalDistance || 0,
                totalDuration: stats.totalDuration || 0,
                avgMaxSpeed: stats.avgMaxSpeed || 0,
                bestTimes
              }
            });
          }
        );
      }
    );
  });
});

module.exports = {
  router,
  setDatabase
};
