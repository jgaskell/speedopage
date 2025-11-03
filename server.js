const express = require('express');
const http = require('http');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const port = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());

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
    timestamp DATETIME
  )`);
});

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.post('/api/log-speed', (req, res) => {
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
app.post('/api/save-session', (req, res) => {
  const { deviceId, startTime, endTime, vMax, distance, duration, timers } = req.body;
  if (!deviceId || !startTime || !endTime) {
    return res.status(400).json({ error: 'Invalid session data' });
  }
  const timersJSON = JSON.stringify(timers);
  db.run(
    'INSERT INTO sessions (deviceId, startTime, endTime, vMax, distance, duration, timers, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [deviceId, startTime, endTime, vMax, distance, duration, timersJSON, new Date().toISOString()],
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
app.get('/api/sessions/:deviceId', (req, res) => {
  const { deviceId } = req.params;
  db.all(
    'SELECT * FROM sessions WHERE deviceId = ? ORDER BY timestamp DESC LIMIT 50',
    [deviceId],
    (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Database error' });
      }
      // Parse timers JSON for each session
      const sessions = rows.map(row => ({
        ...row,
        timers: JSON.parse(row.timers)
      }));
      res.json({ sessions });
    }
  );
});

http.createServer(app).listen(port, () => {
  console.log(`SpeedoPage running on port ${port}`);
});