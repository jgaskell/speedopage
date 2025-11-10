const express = require('express');
const http = require('http');
const { query, initRedis, getRedis, isRedisConnected, closeConnections } = require('./db/connection');
const app = express();
const port = process.env.PORT || 3000;

// Security headers
app.use((req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // XSS Protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Content Security Policy - prevent inline scripts and external resources
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://ipapi.co https://nominatim.openstreetmap.org; img-src 'self' data: https:; font-src 'self';");
  // Remove server signature
  res.removeHeader('X-Powered-By');
  next();
});

// Disable directory listing and serve static files securely
app.use(express.static('public', {
  dotfiles: 'deny',
  index: false,
  setHeaders: (res, path) => {
    // Prevent caching of sensitive files
    if (path.endsWith('.js')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    }
  }
}));

app.use(express.json({ limit: '100kb' })); // Limit JSON payload size

// Rate limiting state (simple in-memory implementation)
const rateLimits = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS = 100; // per window

function rateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();

  if (!rateLimits.has(ip)) {
    rateLimits.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return next();
  }

  const limit = rateLimits.get(ip);

  if (now > limit.resetTime) {
    // Reset the limit
    limit.count = 1;
    limit.resetTime = now + RATE_LIMIT_WINDOW;
    return next();
  }

  if (limit.count >= MAX_REQUESTS) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  limit.count++;
  next();
}

// Clean up old rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, limit] of rateLimits.entries()) {
    if (now > limit.resetTime + RATE_LIMIT_WINDOW) {
      rateLimits.delete(ip);
    }
  }
}, 300000);

// Initialize Redis connection
let redis;
initRedis().then(client => {
  redis = client;
  if (redis) {
    console.log('✓ Redis initialized and connected');
  } else {
    console.warn('⚠ Redis not available - running without cache');
  }
}).catch(err => {
  console.error('Redis initialization error:', err);
});

// Authentication routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes.router);

// Car management routes
const carRoutes = require('./routes/cars');
app.use('/api/cars', carRoutes.router);

// User profile routes
const userRoutes = require('./routes/users');
app.use('/api/users', userRoutes.router);

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.post('/api/log-speed', rateLimit, async (req, res) => {
  const { deviceId, speed, timestamp } = req.body;
  if (!deviceId || speed == null) {
    return res.status(400).json({ error: 'Invalid data' });
  }

  try {
    const result = await query(
      'INSERT INTO speeds (device_id, speed, timestamp) VALUES ($1, $2, $3) RETURNING id',
      [deviceId, speed, timestamp]
    );
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    console.error('Error logging speed:', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

// Save session summary (supports both authenticated users and anonymous)
const { optionalAuth } = require('./middleware/auth');

app.post('/api/save-session', rateLimit, optionalAuth, async (req, res) => {
  const { deviceId, carId, startTime, endTime, vMax, distance, duration, timers, onIncline } = req.body;
  const userId = req.user ? req.user.userId : null;

  // Validate required fields (either authenticated with carId, or anonymous with deviceId)
  if (!startTime || !endTime) {
    console.error('Missing required fields:', { startTime: !!startTime, endTime: !!endTime });
    return res.status(400).json({ error: 'Invalid session data: missing required fields' });
  }

  // For authenticated users, carId is required
  if (userId && !carId) {
    return res.status(400).json({ error: 'carId is required for authenticated users' });
  }

  // For anonymous users, deviceId is required
  if (!userId && !deviceId) {
    return res.status(400).json({ error: 'deviceId is required for anonymous users' });
  }

  // Safely stringify timers (use JSONB in Postgres)
  let timersJSON;
  try {
    timersJSON = JSON.stringify(timers || {});
  } catch (err) {
    console.error('Failed to stringify timers:', err);
    return res.status(400).json({ error: 'Invalid timers format' });
  }

  const inclineFlag = onIncline ? true : false;

  try {
    // Insert session with userId and carId (if authenticated) or deviceId (if anonymous)
    const result = await query(
      `INSERT INTO sessions (
        user_id, car_id, device_id, start_time, end_time, v_max, distance, duration,
        timers, on_incline, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [
        userId,
        carId || null,
        deviceId || null,
        startTime,
        endTime,
        vMax,
        distance,
        duration,
        timersJSON,
        inclineFlag,
        new Date().toISOString()
      ]
    );

    const logInfo = userId
      ? `userId ${userId}, carId ${carId}`
      : `deviceId ${deviceId}`;

    console.log(`Session saved: ID ${result.rows[0].id}, ${logInfo}, vMax ${vMax}`);
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    console.error('Database insert error:', err);
    return res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Get session history for a device
app.get('/api/sessions/:deviceId', rateLimit, async (req, res) => {
  const { deviceId } = req.params;

  // Validate deviceId format (UUID)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(deviceId)) {
    return res.status(400).json({ error: 'Invalid device ID format' });
  }

  try {
    const result = await query(
      'SELECT * FROM sessions WHERE device_id = $1 ORDER BY timestamp DESC LIMIT 50',
      [deviceId]
    );

    // JSONB columns are automatically parsed by pg driver
    const sessions = result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      carId: row.car_id,
      deviceId: row.device_id,
      startTime: row.start_time,
      endTime: row.end_time,
      vMax: row.v_max,
      distance: row.distance,
      duration: row.duration,
      timers: row.timers || {},
      onIncline: row.on_incline,
      timestamp: row.timestamp,
      createdAt: row.created_at
    }));

    res.json({ sessions });
  } catch (err) {
    console.error('Error fetching sessions:', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

// Get ALL sessions (user's own + sample data) for display purposes
app.get('/api/sessions/:deviceId/all', rateLimit, async (req, res) => {
  const { deviceId } = req.params;

  // Validate deviceId format (UUID or SAMPLE-)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isSample = deviceId.startsWith('SAMPLE-');

  if (!isSample && !uuidRegex.test(deviceId)) {
    return res.status(400).json({ error: 'Invalid device ID format' });
  }

  try {
    // Get both user's sessions AND sample data, sorted by timestamp
    const result = await query(
      "SELECT * FROM sessions WHERE device_id = $1 OR device_id LIKE 'SAMPLE-%' ORDER BY timestamp DESC LIMIT 50",
      [deviceId]
    );

    // JSONB columns are automatically parsed by pg driver
    const sessions = result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      carId: row.car_id,
      deviceId: row.device_id,
      startTime: row.start_time,
      endTime: row.end_time,
      vMax: row.v_max,
      distance: row.distance,
      duration: row.duration,
      timers: row.timers || {},
      onIncline: row.on_incline,
      timestamp: row.timestamp,
      createdAt: row.created_at
    }));

    res.json({ sessions });
  } catch (err) {
    console.error('Error fetching all sessions:', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

// Delete sample data (deviceId starts with "SAMPLE-")
app.delete('/api/sessions/sample', rateLimit, async (req, res) => {
  try {
    const result = await query("DELETE FROM sessions WHERE device_id LIKE 'SAMPLE-%'");
    console.log(`Deleted ${result.rowCount} sample sessions`);
    res.json({ success: true, deleted: result.rowCount });
  } catch (err) {
    console.error('Error deleting sample data:', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

// Delete user's own data (specific deviceId)
app.delete('/api/sessions/:deviceId/user', rateLimit, async (req, res) => {
  const { deviceId } = req.params;

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(deviceId)) {
    return res.status(400).json({ error: 'Invalid device ID format' });
  }

  // Don't delete sample data with this endpoint
  if (deviceId.startsWith('SAMPLE-')) {
    return res.status(400).json({ error: 'Use /api/sessions/sample to delete sample data' });
  }

  try {
    const result = await query('DELETE FROM sessions WHERE device_id = $1', [deviceId]);
    console.log(`Deleted ${result.rowCount} sessions for device ${deviceId}`);
    res.json({ success: true, deleted: result.rowCount });
  } catch (err) {
    console.error('Error deleting user data:', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

// Delete ALL session data (requires confirmation token)
app.delete('/api/sessions/all/:confirmToken', rateLimit, async (req, res) => {
  const { confirmToken } = req.params;

  // Require specific confirmation token to prevent accidental deletion
  if (confirmToken !== 'CONFIRM-DELETE-ALL') {
    return res.status(400).json({ error: 'Invalid confirmation token' });
  }

  try {
    const result = await query('DELETE FROM sessions');
    console.log(`⚠️ Deleted ALL ${result.rowCount} sessions from database`);
    res.json({ success: true, deleted: result.rowCount });
  } catch (err) {
    console.error('Error deleting all data:', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

// Catch-all route to prevent enumeration of files/directories
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// HTTP server (HTTPS handled by Nginx reverse proxy)
const server = http.createServer(app);

server.listen(port, () => {
  console.log(`SpeedoPage running on HTTP port ${port} (HTTPS handled by Nginx)`);
  console.log(`PostgreSQL connection pool active`);
  console.log(`Redis cache: ${isRedisConnected() ? 'Connected' : 'Not available'}`);
});