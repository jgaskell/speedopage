const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
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

// Database setup
const db = new sqlite3.Database('speeds.db');
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS speeds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deviceId TEXT,
    speed REAL,
    timestamp DATETIME
  )`);

  // Session summaries table for storing completed runs
  db.run(`CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    carId INTEGER,
    deviceId TEXT,
    startTime DATETIME,
    endTime DATETIME,
    vMax REAL,
    distance REAL,
    duration INTEGER,
    timers TEXT,
    onIncline BOOLEAN DEFAULT 0,
    timestamp DATETIME,
    createdAt DATETIME,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (carId) REFERENCES cars(id) ON DELETE SET NULL
  )`, (err) => {
    if (err) console.error('Error creating sessions table:', err);

    // Add missing columns if they don't exist (migration for existing databases)
    db.all("PRAGMA table_info(sessions)", (err, rows) => {
      if (!err && rows) {
        const columnNames = rows.map(row => row.name);

        if (!columnNames.includes('onIncline')) {
          db.run('ALTER TABLE sessions ADD COLUMN onIncline BOOLEAN DEFAULT 0', (err) => {
            if (err) console.error('Error adding onIncline column:', err);
            else console.log('Added onIncline column to sessions table');
          });
        }

        if (!columnNames.includes('timestamp')) {
          db.run('ALTER TABLE sessions ADD COLUMN timestamp DATETIME', (err) => {
            if (err) console.error('Error adding timestamp column:', err);
            else console.log('Added timestamp column to sessions table');
          });
        }

        if (!columnNames.includes('userId')) {
          db.run('ALTER TABLE sessions ADD COLUMN userId INTEGER', (err) => {
            if (err) console.error('Error adding userId column:', err);
            else console.log('Added userId column to sessions table');
          });
        }

        if (!columnNames.includes('carId')) {
          db.run('ALTER TABLE sessions ADD COLUMN carId INTEGER', (err) => {
            if (err) console.error('Error adding carId column:', err);
            else console.log('Added carId column to sessions table');
          });
        }

        if (!columnNames.includes('createdAt')) {
          db.run('ALTER TABLE sessions ADD COLUMN createdAt DATETIME', (err) => {
            if (err) console.error('Error adding createdAt column:', err);
            else console.log('Added createdAt column to sessions table');
          });
        }
      }
    });
  });
});

// Authentication routes
const authRoutes = require('./routes/auth');
authRoutes.setDatabase(db);
app.use('/api/auth', authRoutes.router);

// Car management routes
const carRoutes = require('./routes/cars');
carRoutes.setDatabase(db);
app.use('/api/cars', carRoutes.router);

// User profile routes
const userRoutes = require('./routes/users');
userRoutes.setDatabase(db);
app.use('/api/users', userRoutes.router);

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.post('/api/log-speed', rateLimit, (req, res) => {
  const { deviceId, speed, timestamp } = req.body;
  if (!deviceId || speed == null) {
    return res.status(400).json({ error: 'Invalid data' });
  }
  db.run('INSERT INTO speeds (deviceId, speed, timestamp) VALUES (?, ?, ?)', [deviceId, speed, timestamp], function(err) {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ success: true, id: this.lastID });
  });
});

// Save session summary (supports both authenticated users and anonymous)
const { optionalAuth } = require('./middleware/auth');

app.post('/api/save-session', rateLimit, optionalAuth, (req, res) => {
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

  // Safely stringify timers
  let timersJSON;
  try {
    timersJSON = JSON.stringify(timers || {});
  } catch (err) {
    console.error('Failed to stringify timers:', err);
    return res.status(400).json({ error: 'Invalid timers format' });
  }

  const inclineFlag = onIncline ? 1 : 0;

  // Insert session with userId and carId (if authenticated) or deviceId (if anonymous)
  const query = `INSERT INTO sessions (
    userId, carId, deviceId, startTime, endTime, vMax, distance, duration,
    timers, onIncline, createdAt
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  const params = [
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
  ];

  db.run(query, params, function(err) {
    if (err) {
      console.error('Database insert error:', err);
      console.error('Query:', query);
      console.error('Params:', params);
      return res.status(500).json({ error: 'Database error', details: err.message });
    }

    const logInfo = userId
      ? `userId ${userId}, carId ${carId}`
      : `deviceId ${deviceId}`;

    console.log(`Session saved: ID ${this.lastID}, ${logInfo}, vMax ${vMax}`);
    res.json({ success: true, id: this.lastID });
  });
});

// Get session history for a device
app.get('/api/sessions/:deviceId', rateLimit, (req, res) => {
  const { deviceId } = req.params;

  // Validate deviceId format (UUID)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(deviceId)) {
    return res.status(400).json({ error: 'Invalid device ID format' });
  }

  db.all(
    'SELECT * FROM sessions WHERE deviceId = ? ORDER BY timestamp DESC LIMIT 50',
    [deviceId],
    (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Database error' });
      }
      // BUG FIX #2: Safe JSON parsing with error handling
      const sessions = rows.map(row => {
        let timers = {};
        if (row.timers) {
          try {
            timers = JSON.parse(row.timers);
          } catch (parseErr) {
            console.error('Failed to parse timers JSON for session', row.id, parseErr);
            timers = {}; // Use empty object if parse fails
          }
        }
        return {
          ...row,
          timers
        };
      });
      res.json({ sessions });
    }
  );
});

// Get ALL sessions (user's own + sample data) for display purposes
app.get('/api/sessions/:deviceId/all', rateLimit, (req, res) => {
  const { deviceId } = req.params;

  // Validate deviceId format (UUID or SAMPLE-)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isSample = deviceId.startsWith('SAMPLE-');

  if (!isSample && !uuidRegex.test(deviceId)) {
    return res.status(400).json({ error: 'Invalid device ID format' });
  }

  // Get both user's sessions AND sample data, sorted by timestamp
  db.all(
    "SELECT * FROM sessions WHERE deviceId = ? OR deviceId LIKE 'SAMPLE-%' ORDER BY timestamp DESC LIMIT 50",
    [deviceId],
    (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Database error' });
      }
      // Safe JSON parsing with error handling
      const sessions = rows.map(row => {
        let timers = {};
        if (row.timers) {
          try {
            timers = JSON.parse(row.timers);
          } catch (parseErr) {
            console.error('Failed to parse timers JSON for session', row.id, parseErr);
            timers = {};
          }
        }
        return {
          ...row,
          timers
        };
      });
      res.json({ sessions });
    }
  );
});

// Delete sample data (deviceId starts with "SAMPLE-")
app.delete('/api/sessions/sample', rateLimit, (req, res) => {
  db.run(
    "DELETE FROM sessions WHERE deviceId LIKE 'SAMPLE-%'",
    function(err) {
      if (err) {
        console.error('Error deleting sample data:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      console.log(`Deleted ${this.changes} sample sessions`);
      res.json({ success: true, deleted: this.changes });
    }
  );
});

// Delete user's own data (specific deviceId)
app.delete('/api/sessions/:deviceId/user', rateLimit, (req, res) => {
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

  db.run(
    'DELETE FROM sessions WHERE deviceId = ?',
    [deviceId],
    function(err) {
      if (err) {
        console.error('Error deleting user data:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      console.log(`Deleted ${this.changes} sessions for device ${deviceId}`);
      res.json({ success: true, deleted: this.changes });
    }
  );
});

// Delete ALL session data (requires confirmation token)
app.delete('/api/sessions/all/:confirmToken', rateLimit, (req, res) => {
  const { confirmToken } = req.params;

  // Require specific confirmation token to prevent accidental deletion
  if (confirmToken !== 'CONFIRM-DELETE-ALL') {
    return res.status(400).json({ error: 'Invalid confirmation token' });
  }

  db.run('DELETE FROM sessions', function(err) {
    if (err) {
      console.error('Error deleting all data:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    console.log(`⚠️ Deleted ALL ${this.changes} sessions from database`);
    res.json({ success: true, deleted: this.changes });
  });
});

// Catch-all route to prevent enumeration of files/directories
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// HTTPS Configuration
let server;
try {
  const httpsOptions = {
    key: fs.readFileSync('./key.pem'),
    cert: fs.readFileSync('./cert.pem')
  };

  server = https.createServer(httpsOptions, app);
  console.log('HTTPS enabled with SSL certificates');
} catch (err) {
  console.warn('SSL certificates not found or invalid, falling back to HTTP');
  console.warn('Error:', err.message);
  server = http.createServer(app);
}

server.listen(port, () => {
  const protocol = server instanceof https.Server ? 'HTTPS' : 'HTTP';
  console.log(`SpeedoPage running on ${protocol} port ${port}`);
});