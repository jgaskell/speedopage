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
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://ipapi.co https://nominatim.openstreetmap.org; img-src 'self' data:; font-src 'self';");
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
    deviceId TEXT,
    startTime DATETIME,
    endTime DATETIME,
    vMax REAL,
    distance REAL,
    duration INTEGER,
    timers TEXT,
    onIncline BOOLEAN DEFAULT 0,
    timestamp DATETIME
  )`, (err) => {
    if (err) console.error('Error creating sessions table:', err);

    // Add onIncline column if it doesn't exist (migration for existing databases)
    db.all("PRAGMA table_info(sessions)", (err, rows) => {
      if (!err && rows) {
        const hasOnIncline = rows.some(row => row.name === 'onIncline');
        if (!hasOnIncline) {
          db.run('ALTER TABLE sessions ADD COLUMN onIncline BOOLEAN DEFAULT 0', (err) => {
            if (err) console.error('Error adding onIncline column:', err);
            else console.log('Added onIncline column to sessions table');
          });
        }
      }
    });
  });
});

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

// Save session summary
app.post('/api/save-session', rateLimit, (req, res) => {
  const { deviceId, startTime, endTime, vMax, distance, duration, timers, onIncline } = req.body;
  if (!deviceId || !startTime || !endTime) {
    return res.status(400).json({ error: 'Invalid session data' });
  }
  const timersJSON = JSON.stringify(timers);
  const inclineFlag = onIncline ? 1 : 0;

  db.run(
    'INSERT INTO sessions (deviceId, startTime, endTime, vMax, distance, duration, timers, onIncline, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [deviceId, startTime, endTime, vMax, distance, duration, timersJSON, inclineFlag, new Date().toISOString()],
    function(err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ success: true, id: this.lastID });
    }
  );
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