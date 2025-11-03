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

http.createServer(app).listen(port, () => {
  console.log(`SpeedoPage running on port ${port}`);
});