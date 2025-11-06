# SpeedoPage v2.0 - Developer Guide

## Overview

This guide provides technical documentation for developers working on SpeedoPage. It covers the architecture, codebase structure, database schema, authentication flow, and guidelines for extending the application.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Database Schema](#database-schema)
5. [Backend Architecture](#backend-architecture)
6. [Frontend Architecture](#frontend-architecture)
7. [Authentication Flow](#authentication-flow)
8. [Adding New Features](#adding-new-features)
9. [Testing Guidelines](#testing-guidelines)
10. [Code Style Guide](#code-style-guide)
11. [Performance Considerations](#performance-considerations)
12. [Security Best Practices](#security-best-practices)

---

## Architecture Overview

SpeedoPage follows a traditional client-server architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Browser)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  index.html  │  │    app.js    │  │ auth-service │      │
│  │   (UI)       │  │  (Logic)     │  │   .js        │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↕ HTTP/HTTPS
┌─────────────────────────────────────────────────────────────┐
│                      Backend (Node.js)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  server.js   │  │   routes/    │  │ middleware/  │      │
│  │  (Express)   │  │  (Handlers)  │  │   (Auth)     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                    Database (SQLite)                         │
│        users, cars, sessions, achievements, etc.             │
└─────────────────────────────────────────────────────────────┘
```

### Key Principles

1. **RESTful API**: HTTP endpoints follow REST conventions
2. **JWT Authentication**: Stateless token-based auth
3. **Single Page Application**: Minimal page reloads, dynamic content
4. **Progressive Enhancement**: Works without account, enhanced with login
5. **GPS-First**: All speed/distance calculations from GPS data

---

## Technology Stack

### Backend

- **Runtime**: Node.js 14+ (tested on 18+)
- **Framework**: Express 5.1.0
- **Database**: SQLite3 5.1.6
- **Authentication**:
  - jsonwebtoken 9.0.2 (JWT)
  - bcrypt 6.0.0 (password hashing)
- **Validation**: express-validator 7.3.0
- **Security**: express-rate-limit 8.2.1
- **Utilities**: uuid 13.0.0

### Frontend

- **Pure JavaScript** (no frameworks)
- **HTML5**: Semantic markup
- **CSS3**: Modern styling with gradients, animations
- **APIs**:
  - Geolocation API (GPS)
  - Fetch API (HTTP requests)
  - LocalStorage API (persistence)

### Development Tools

- **Version Control**: Git
- **Package Manager**: npm
- **Database Tool**: SQLite CLI, DB Browser for SQLite

---

## Project Structure

```
speedopage/
├── server.js                    # Main Express server
├── package.json                 # Dependencies and scripts
├── speeds.db                    # SQLite database (gitignored)
│
├── public/                      # Static frontend files
│   ├── index.html              # Main HTML structure
│   ├── app.js                  # Core application logic
│   └── auth-service.js         # Authentication client
│
├── routes/                      # API route handlers
│   ├── auth.js                 # Authentication endpoints
│   ├── cars.js                 # Car management endpoints
│   └── users.js                # User profile endpoints
│
├── middleware/                  # Express middleware
│   ├── auth.js                 # JWT verification, ownership checks
│   └── password.js             # Password hashing/validation
│
├── migrate-v2-user-accounts.js # Database migration script
│
├── Documentation/               # Project documentation
│   ├── USER_GUIDE.md           # End-user manual
│   ├── API_DOCUMENTATION.md    # API reference
│   ├── DEVELOPER_GUIDE.md      # This file
│   └── DEPLOYMENT_GUIDE.md     # Deployment instructions
│
├── CLAUDE.md                    # AI assistant instructions
├── RELEASE-NOTES-v2.0.md       # Release notes
└── README.md                    # Project overview
```

---

## Database Schema

### Entity Relationship Diagram

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│    users     │       │     cars     │       │   sessions   │
├──────────────┤       ├──────────────┤       ├──────────────┤
│ id (PK)      │◄──────│ userId (FK)  │◄──────│ userId (FK)  │
│ email (UQ)   │       │ id (PK)      │       │ carId (FK)   │
│ passwordHash │       │ name         │       │ deviceId     │
│ displayName  │       │ make         │       │ startTime    │
│ ...          │       │ model        │       │ endTime      │
└──────────────┘       │ isActive     │       │ vMax         │
                       │ ...          │       │ timers       │
                       └──────────────┘       │ ...          │
                                              └──────────────┘
```

### Table Definitions

#### users

Stores user account information.

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  passwordHash TEXT NOT NULL,           -- bcrypt hash
  displayName TEXT,
  avatarUrl TEXT,
  unitsPreference TEXT DEFAULT 'auto', -- 'auto', 'kmh', 'mph'
  isEmailVerified BOOLEAN DEFAULT 0,
  isPublicProfile BOOLEAN DEFAULT 0,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  lastLoginAt DATETIME,
  accountStatus TEXT DEFAULT 'active'  -- 'active', 'suspended', 'deleted'
);

CREATE INDEX idx_users_email ON users(email);
```

**Key Fields**:
- `passwordHash`: bcrypt with 10 salt rounds
- `unitsPreference`: User's speed unit preference
- `accountStatus`: Soft deletion support

---

#### cars

Stores vehicle profiles for users.

```sql
CREATE TABLE cars (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  name TEXT NOT NULL,                   -- User-friendly name
  make TEXT,
  model TEXT,
  year INTEGER,
  trim TEXT,
  color TEXT,
  photoUrl TEXT,
  weight REAL,                          -- kg
  horsepower INTEGER,
  modifications TEXT,                   -- Free-form text
  drivetrain TEXT,                      -- 'FWD', 'RWD', 'AWD', '4WD'
  transmission TEXT,                    -- 'Manual', 'Automatic', 'DCT', 'CVT'
  notes TEXT,
  isActive BOOLEAN DEFAULT 1,          -- Only one active car per user
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_cars_userId ON cars(userId);
CREATE INDEX idx_cars_userId_active ON cars(userId, isActive);
```

**Key Concepts**:
- Each user can have multiple cars
- Only one car is "active" at a time (used for new sessions)
- CASCADE delete: Deleting user deletes all their cars
- SET NULL on sessions: Deleting car preserves sessions

---

#### sessions

Stores performance run data.

```sql
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER,                       -- NULL for anonymous users
  carId INTEGER,                        -- NULL for anonymous users
  deviceId TEXT,                        -- UUID for anonymous tracking
  startTime DATETIME NOT NULL,
  endTime DATETIME NOT NULL,
  vMax REAL NOT NULL,                  -- Maximum speed (km/h)
  distance REAL,                        -- Total distance (km)
  duration INTEGER,                     -- Duration (seconds)
  timers TEXT,                          -- JSON: {"0-60": 4.5, ...}
  onIncline BOOLEAN DEFAULT 0,         -- Downhill flag
  location TEXT,                        -- Human-readable location
  latitude REAL,
  longitude REAL,
  weatherConditions TEXT,               -- JSON: temp, conditions, wind
  notes TEXT,
  tags TEXT,                            -- JSON array: ["track", "dragstrip"]
  isPublic BOOLEAN DEFAULT 0,
  shareToken TEXT UNIQUE,               -- For sharing sessions
  videoUrl TEXT,                        -- Link to video recording
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (carId) REFERENCES cars(id) ON DELETE SET NULL
);

CREATE INDEX idx_sessions_userId ON sessions(userId);
CREATE INDEX idx_sessions_carId ON sessions(carId);
CREATE INDEX idx_sessions_deviceId ON sessions(deviceId);
CREATE INDEX idx_sessions_shareToken ON sessions(shareToken);
CREATE INDEX idx_sessions_startTime ON sessions(startTime);
```

**Key Concepts**:
- Supports both authenticated (userId/carId) and anonymous (deviceId) users
- `timers` stored as JSON for flexibility
- Future features: location, weather, sharing, video
- ON DELETE SET NULL: Preserve sessions when car is deleted

---

#### speeds (Legacy)

Original speed log table, still used for continuous logging.

```sql
CREATE TABLE speeds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deviceId TEXT,
  speed REAL,                           -- km/h
  timestamp DATETIME
);
```

**Note**: This table is deprecated in favor of sessions but maintained for backward compatibility.

---

#### achievements

Foundation for gamification system (future feature).

```sql
CREATE TABLE achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  achievementType TEXT NOT NULL,       -- '0-60-under-4', 'first-200mph', etc.
  achievedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT,                        -- JSON: session details
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_achievements_userId ON achievements(userId);
```

---

#### follows

Social feature foundation (future feature).

```sql
CREATE TABLE follows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  followerId INTEGER NOT NULL,
  followingId INTEGER NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (followerId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (followingId) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(followerId, followingId)
);

CREATE INDEX idx_follows_follower ON follows(followerId);
CREATE INDEX idx_follows_following ON follows(followingId);
```

---

#### password_resets

Password reset token storage (future feature).

```sql
CREATE TABLE password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expiresAt DATETIME NOT NULL,
  usedAt DATETIME,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_password_resets_token ON password_resets(token);
```

---

## Backend Architecture

### Server Entry Point (server.js)

Main responsibilities:
1. Initialize Express app
2. Configure security headers
3. Set up rate limiting
4. Initialize database connection
5. Register route handlers
6. Start HTTP/HTTPS server

**Security Headers**:
```javascript
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; ...");
  res.removeHeader('X-Powered-By');
  next();
});
```

**Rate Limiting**:
- In-memory Map-based implementation
- 100 requests per 60 seconds per IP
- Automatic cleanup of stale entries
- Production should use Redis for distributed rate limiting

---

### Route Handlers

#### Route Pattern

All route modules follow this pattern:

```javascript
const express = require('express');
const router = express.Router();

let db; // Database injected by server.js

function setDatabase(database) {
  db = database;
}

// Route definitions
router.get('/', requireAuth, (req, res) => {
  // Handler logic
});

module.exports = {
  router,
  setDatabase
};
```

**Why Dependency Injection?**
- Testability: Easy to mock database
- Flexibility: Can swap database implementations
- Clean separation: Routes don't own database connection

---

#### Authentication Routes (routes/auth.js)

**Endpoints**:
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Authenticate
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout
- `POST /api/auth/refresh` - Refresh token

**Key Functions**:
```javascript
// Password validation
const passwordValidation = validatePassword(password);
if (!passwordValidation.valid) {
  return res.status(400).json({ error: 'Password weak' });
}

// Hash password
const passwordHash = await hashPassword(password);

// Generate JWT
const token = generateToken({ id, email, displayName });

// Verify password
const isValid = await verifyPassword(password, storedHash);
```

---

#### Car Routes (routes/cars.js)

**Endpoints**:
- `GET /api/cars` - List user's cars
- `POST /api/cars` - Add new car
- `GET /api/cars/:carId` - Get car details
- `PUT /api/cars/:carId` - Update car
- `DELETE /api/cars/:carId` - Delete car
- `PUT /api/cars/:carId/set-active` - Activate car
- `GET /api/cars/:carId/stats` - Get performance stats

**Active Car Logic**:
```javascript
// First car is automatically active
db.get('SELECT COUNT(*) as count FROM cars WHERE userId = ?', [userId], (err, result) => {
  const isFirstCar = result.count === 0;
  const isActive = isFirstCar ? 1 : 0;
  // Insert with isActive
});

// Setting active deactivates others
db.run('UPDATE cars SET isActive = 0 WHERE userId = ?', [userId], () => {
  db.run('UPDATE cars SET isActive = 1 WHERE id = ?', [carId]);
});
```

---

#### User Routes (routes/users.js)

**Endpoints**:
- `GET /api/users/:userId/profile` - Get profile
- `PUT /api/users/:userId/profile` - Update profile
- `PUT /api/users/:userId/password` - Change password
- `DELETE /api/users/:userId/account` - Delete account
- `GET /api/users/:userId/stats` - Get user stats

**Privacy Logic**:
```javascript
// Public vs private profiles
const fields = isOwnProfile
  ? 'id, email, displayName, ...'  // Full details
  : 'id, displayName, avatarUrl';  // Public only

if (!isOwnProfile && !user.isPublicProfile) {
  return res.status(403).json({ error: 'Profile is private' });
}
```

---

### Middleware

#### Authentication Middleware (middleware/auth.js)

**Functions**:

1. **generateToken(user)**: Create JWT
   ```javascript
   const payload = { userId: user.id, email: user.email, displayName };
   return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
   ```

2. **verifyToken(token)**: Validate JWT
   ```javascript
   try {
     return jwt.verify(token, JWT_SECRET);
   } catch (error) {
     return null;
   }
   ```

3. **extractToken(req)**: Get token from request
   ```javascript
   // Try Authorization header
   if (req.headers.authorization?.startsWith('Bearer ')) {
     return req.headers.authorization.substring(7);
   }
   // Try cookie, then query param
   ```

4. **requireAuth**: Middleware requiring authentication
   ```javascript
   function requireAuth(req, res, next) {
     const token = extractToken(req);
     if (!token) return res.status(401).json({ error: 'No token' });

     const decoded = verifyToken(token);
     if (!decoded) return res.status(401).json({ error: 'Invalid token' });

     req.user = decoded;
     next();
   }
   ```

5. **optionalAuth**: Middleware with optional authentication
   ```javascript
   function optionalAuth(req, res, next) {
     const token = extractToken(req);
     if (token) {
       const decoded = verifyToken(token);
       if (decoded) req.user = decoded;
     }
     next();
   }
   ```

6. **requireOwnership**: Ensure user owns resource
   ```javascript
   function requireOwnership(resourceUserIdParam = 'userId') {
     return (req, res, next) => {
       const resourceUserId = parseInt(req.params[resourceUserIdParam]);
       if (resourceUserId !== req.user.userId) {
         return res.status(403).json({ error: 'Forbidden' });
       }
       next();
     };
   }
   ```

---

#### Password Middleware (middleware/password.js)

**Functions**:

1. **hashPassword(password)**: Hash with bcrypt
   ```javascript
   const bcrypt = require('bcrypt');
   const SALT_ROUNDS = 10;

   async function hashPassword(password) {
     return await bcrypt.hash(password, SALT_ROUNDS);
   }
   ```

2. **verifyPassword(password, hash)**: Compare password
   ```javascript
   async function verifyPassword(password, hash) {
     return await bcrypt.compare(password, hash);
   }
   ```

3. **validatePassword(password)**: Check strength
   ```javascript
   function validatePassword(password) {
     const errors = [];
     if (password.length < 8) errors.push('At least 8 characters');
     if (!/[a-zA-Z]/.test(password)) errors.push('Must contain letter');
     if (!/\d/.test(password)) errors.push('Must contain number');

     return { valid: errors.length === 0, errors };
   }
   ```

---

## Frontend Architecture

### Application State (app.js)

**Global State Variables**:
```javascript
// Authentication state
let currentUser = null;
let isAuthenticated = false;
let hasChosenAuthOption = false;

// Garage state
let userCars = [];
let activeCar = null;
let editingCarId = null;

// Speedometer state
let units = 'kmh';
let speed = 0;
let lastPosition = null;
let sessionStart = null;
let totalDistance = 0;
let timers = {};
let sessionVmax = 0;

// GPS state
let gpsLocked = false;
let currentIncline = 0;
let onDownhill = false;

// View state
let currentView = 'speedometer'; // 'speedometer', 'summary', 'garage'
```

---

### GPS and Speed Calculation

**Core Algorithm** (Haversine Formula):

```javascript
// Calculate distance between two GPS coordinates
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
            Math.sin(dLon/2) * Math.sin(dLon/2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
}

// Calculate speed from GPS updates
navigator.geolocation.watchPosition((position) => {
  const { latitude, longitude, altitude, accuracy } = position.coords;
  const now = Date.now();

  if (lastPosition) {
    const distance = haversine(
      lastPosition.latitude, lastPosition.longitude,
      latitude, longitude
    );
    const timeDelta = (now - lastTime) / 1000; // seconds
    const speedKmh = (distance / timeDelta) * 3600; // km/h

    speed = speedKmh;
  }

  lastPosition = { latitude, longitude, altitude };
  lastTime = now;
}, { enableHighAccuracy: true });
```

**Why Haversine?**
- Accounts for Earth's curvature
- Accurate for short distances (< 100 km)
- More accurate than simple Pythagorean distance

---

### Performance Timers

**Timer System**:

```javascript
const timerTargets = {
  // mph timers
  '0-60': 60, '0-100': 100, '0-150': 150, '0-200': 200,
  '30-60': 60, '60-120': 120, '60-130': 130, '100-150': 150,

  // km/h timers
  '0-100kmh': 100, '0-160kmh': 160, '0-250kmh': 250, '0-320kmh': 320,
  '100-200kmh': 200, '160-240kmh': 240
};

const distances = {
  '1/8': 0.201168,  // miles to km
  '1/4': 0.402336,
  '1/2': 0.804672,
  '1': 1.609344
};

// Check timers each GPS update
function checkTimers(currentSpeed, distanceTraveled) {
  // Acceleration timers
  Object.keys(timerTargets).forEach(key => {
    if (!timers[key] && currentSpeed >= timerTargets[key]) {
      timers[key] = (Date.now() - timerStart) / 1000; // seconds
    }
  });

  // Distance timers
  ['1/8 mile', '1/4 mile', '1/2 mile', 'standing mile'].forEach(key => {
    const targetDist = distances[key.split(' ')[0]];
    if (!timers[key] && distanceTraveled >= targetDist) {
      timers[key] = (Date.now() - timerStart) / 1000;
    }
  });
}
```

**Timer Reset Logic**:
```javascript
// Reset when stopped
if (speed < 1) {
  if (timerStart) {
    // Save session before resetting
    if (sessionVmax > 5) { // Minimum speed threshold
      saveSession();
    }
  }

  // Reset timers but preserve vMax
  timers = {};
  timerStart = null;
  totalDistance = 0;
} else if (!timerStart) {
  // Start new timer run
  timerStart = Date.now();
}
```

---

### Incline Detection

**Altitude Smoothing**:
```javascript
const altitudeHistory = []; // Rolling window
const ALTITUDE_WINDOW = 10; // Number of samples

// Add new altitude reading
altitudeHistory.push(altitude);
if (altitudeHistory.length > ALTITUDE_WINDOW) {
  altitudeHistory.shift();
}

// Calculate smoothed altitude
const smoothedAltitude = altitudeHistory.reduce((a, b) => a + b, 0) / altitudeHistory.length;
```

**Incline Calculation**:
```javascript
if (lastAltitude !== null) {
  const altitudeChange = smoothedAltitude - lastAltitude;
  const distance = haversine(lastPos.lat, lastPos.lon, lat, lon);

  if (distance > 0) {
    // Incline in degrees
    currentIncline = Math.atan2(altitudeChange, distance * 1000) * (180 / Math.PI);

    // Flag downhill runs
    onDownhill = currentIncline < -2; // 2 degree threshold
  }
}
```

---

### Authentication Service (auth-service.js)

**Token Management**:
```javascript
const AuthService = {
  TOKEN_KEY: 'speedopage_auth_token',
  USER_KEY: 'speedopage_user',

  getToken() {
    return localStorage.getItem(this.TOKEN_KEY);
  },

  setToken(token) {
    localStorage.setItem(this.TOKEN_KEY, token);
  },

  removeToken() {
    localStorage.removeItem(this.TOKEN_KEY);
  },

  async register(email, password, displayName) {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName })
    });

    if (!response.ok) throw new Error('Registration failed');

    const data = await response.json();
    this.setToken(data.token);
    this.setUser(data.user);
    return data.user;
  },

  async fetchWithAuth(url, options = {}) {
    const token = this.getToken();
    if (token) {
      options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`
      };
    }
    return fetch(url, options);
  }
};
```

---

### View Management

**View Switching**:
```javascript
function showView(viewName) {
  // Hide all views
  document.getElementById('speedometer-view').style.display = 'none';
  document.getElementById('summary-view').style.display = 'none';
  document.getElementById('garage-view').style.display = 'none';

  // Show selected view
  document.getElementById(`${viewName}-view`).style.display = 'block';
  currentView = viewName;

  // Update active button
  document.querySelectorAll('.nav-buttons .btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[onclick*="${viewName}"]`)?.classList.add('active');

  // Load view data
  if (viewName === 'summary') loadSessions();
  if (viewName === 'garage') loadGarage();
}
```

---

## Authentication Flow

### Registration Flow

```
User                  Frontend              Backend              Database
  │                      │                     │                     │
  │─── Fill Form ───────>│                     │                     │
  │                      │                     │                     │
  │                      │─── POST /register ──>│                     │
  │                      │                     │                     │
  │                      │                     │─── Check Email ────>│
  │                      │                     │<─── Not Exists ─────│
  │                      │                     │                     │
  │                      │                     │─── Hash Password    │
  │                      │                     │                     │
  │                      │                     │─── Insert User ────>│
  │                      │                     │<─── User ID ────────│
  │                      │                     │                     │
  │                      │                     │─── Generate JWT     │
  │                      │<─── Token + User ───│                     │
  │                      │                     │                     │
  │                      │─── Store Token      │                     │
  │<─── Redirect Home ───│                     │                     │
```

### Login Flow

```
User                  Frontend              Backend              Database
  │                      │                     │                     │
  │─── Enter Creds ─────>│                     │                     │
  │                      │                     │                     │
  │                      │─── POST /login ────>│                     │
  │                      │                     │                     │
  │                      │                     │─── Find User ──────>│
  │                      │                     │<─── User + Hash ────│
  │                      │                     │                     │
  │                      │                     │─── Verify Password  │
  │                      │                     │                     │
  │                      │                     │─── Generate JWT     │
  │                      │<─── Token + User ───│                     │
  │                      │                     │                     │
  │                      │─── Store Token      │                     │
  │<─── Redirect Home ───│                     │                     │
```

### Authenticated Request Flow

```
Frontend              Middleware            Route Handler         Database
  │                      │                     │                     │
  │─── GET /api/cars ───>│                     │                     │
  │   (with Bearer token) │                     │                     │
  │                      │                     │                     │
  │                      │─── Extract Token    │                     │
  │                      │─── Verify JWT       │                     │
  │                      │─── Decode Payload   │                     │
  │                      │                     │                     │
  │                      │─── req.user = {...} │                     │
  │                      │                     │                     │
  │                      │────────────────────>│                     │
  │                      │                     │                     │
  │                      │                     │─── Query Cars ─────>│
  │                      │                     │    WHERE userId=?    │
  │                      │                     │<─── Cars ───────────│
  │<─────────────────────────────────────────────── JSON Response ───│
```

---

## Adding New Features

### Example: Add a "Notes" Field to Sessions

#### Step 1: Update Database Schema

```javascript
// In migration script
await runSQL('ALTER TABLE sessions ADD COLUMN notes TEXT');
```

Or manually in SQLite:
```sql
ALTER TABLE sessions ADD COLUMN notes TEXT;
```

#### Step 2: Update Backend Endpoint

```javascript
// In server.js or routes/sessions.js
app.post('/api/save-session', rateLimit, optionalAuth, (req, res) => {
  const { deviceId, carId, startTime, endTime, vMax, distance, duration, timers, onIncline, notes } = req.body;

  const query = `INSERT INTO sessions (
    userId, carId, deviceId, startTime, endTime, vMax, distance, duration,
    timers, onIncline, notes, createdAt
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  const params = [
    userId, carId, deviceId, startTime, endTime, vMax, distance, duration,
    JSON.stringify(timers), inclineFlag, notes, new Date().toISOString()
  ];

  // Execute query...
});
```

#### Step 3: Update Frontend UI

```html
<!-- In index.html -->
<div class="session-notes">
  <label for="session-notes">Session Notes:</label>
  <textarea id="session-notes" rows="3" placeholder="Add notes about this run..."></textarea>
</div>
```

#### Step 4: Update Frontend Logic

```javascript
// In app.js
function saveSession() {
  const notes = document.getElementById('session-notes').value;

  const sessionData = {
    carId: activeCar?.id,
    deviceId: !isAuthenticated ? deviceId : undefined,
    startTime: sessionStart,
    endTime: new Date().toISOString(),
    vMax: sessionVmax,
    distance: totalDistance,
    duration: Math.floor((Date.now() - sessionStart) / 1000),
    timers: timers,
    onIncline: onDownhill,
    notes: notes  // Add notes field
  };

  // Send to server...
}
```

#### Step 5: Display in Summary View

```javascript
// In loadSessions()
sessions.forEach(session => {
  const card = `
    <div class="session-card">
      <h3>${new Date(session.startTime).toLocaleString()}</h3>
      <p>vMax: ${session.vMax} km/h</p>
      ${session.notes ? `<p class="notes">${session.notes}</p>` : ''}
    </div>
  `;
  summaryContainer.innerHTML += card;
});
```

---

## Testing Guidelines

### Manual Testing Checklist

#### Authentication Tests
- [ ] Register new account
- [ ] Register with existing email (should fail)
- [ ] Register with weak password (should fail)
- [ ] Login with correct credentials
- [ ] Login with wrong password (should fail)
- [ ] Access protected route without token (should fail)
- [ ] Access protected route with expired token (should fail)
- [ ] Refresh token before expiration
- [ ] Logout and verify token deleted

#### Car Management Tests
- [ ] Add first car (should auto-activate)
- [ ] Add second car (should not auto-activate)
- [ ] Set car as active
- [ ] Edit car details
- [ ] Delete car (verify sessions preserved)
- [ ] Delete active car (verify another becomes active)

#### Session Tests
- [ ] Save session as guest (with deviceId)
- [ ] Save session as logged-in user (with carId)
- [ ] View session history as guest
- [ ] View session history as user
- [ ] Delete sample data
- [ ] Delete user data

#### GPS and Speed Tests
- [ ] GPS lock indoors (should fail or low accuracy)
- [ ] GPS lock outdoors (should succeed)
- [ ] Speed updates while moving
- [ ] Speed shows zero when stopped
- [ ] Timer starts when moving
- [ ] Timer stops when reaching target speed/distance
- [ ] Timer resets when stopped
- [ ] vMax persists across timer resets
- [ ] Incline detection on hills

### Unit Testing (Future)

**Recommended Testing Stack**:
- **Mocha** or **Jest**: Test runner
- **Chai**: Assertions
- **Supertest**: HTTP testing
- **Sinon**: Mocking

**Example Test Structure**:
```javascript
// tests/auth.test.js
const request = require('supertest');
const app = require('../server');

describe('Authentication', () => {
  describe('POST /api/auth/register', () => {
    it('should create a new user', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'SecurePass123',
          displayName: 'Test User'
        });

      expect(res.status).to.equal(201);
      expect(res.body).to.have.property('token');
      expect(res.body.user.email).to.equal('test@example.com');
    });

    it('should reject weak password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'weak'
        });

      expect(res.status).to.equal(400);
      expect(res.body.error).to.include('Password');
    });
  });
});
```

---

## Code Style Guide

### JavaScript Conventions

**Naming**:
- `camelCase` for variables and functions
- `PascalCase` for constructors/classes
- `UPPER_SNAKE_CASE` for constants
- Descriptive names (avoid abbreviations)

**Good**:
```javascript
const sessionStartTime = new Date();
const MAX_SPEED_THRESHOLD = 300;

function calculateDistance(lat1, lon1, lat2, lon2) {
  // ...
}
```

**Bad**:
```javascript
const sst = new Date();
const mst = 300;

function calcDist(l1, l2, l3, l4) {
  // ...
}
```

### Code Organization

**Single Responsibility**: Each function should do one thing
```javascript
// Good: Separate concerns
function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

function validatePassword(password) {
  // Validation logic
}

function createUser(email, password) {
  const hash = await hashPassword(password);
  // Insert logic
}

// Bad: Function does too much
function createUser(email, password) {
  // Validate
  // Hash
  // Insert
  // Send email
  // Log
}
```

**DRY (Don't Repeat Yourself)**:
```javascript
// Good: Reusable function
function formatSpeed(kmh, units) {
  return units === 'mph' ? toMph(kmh) : kmh;
}

// Bad: Repeated logic
if (units === 'mph') {
  speed = toMph(speed);
  vMax = toMph(vMax);
} else {
  speed = speed;
  vMax = vMax;
}
```

### Error Handling

**Always handle errors**:
```javascript
// Good
db.get('SELECT * FROM users WHERE id = ?', [id], (err, user) => {
  if (err) {
    console.error('Database error:', err);
    return res.status(500).json({ error: 'Database error' });
  }

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ user });
});

// Bad
db.get('SELECT * FROM users WHERE id = ?', [id], (err, user) => {
  res.json({ user }); // What if err? What if !user?
});
```

**Use try-catch for async/await**:
```javascript
// Good
try {
  const hash = await hashPassword(password);
  // Use hash
} catch (error) {
  console.error('Hashing failed:', error);
  return res.status(500).json({ error: 'Server error' });
}

// Bad
const hash = await hashPassword(password); // Unhandled rejection!
```

### Comments

**When to comment**:
- Complex algorithms (e.g., Haversine formula)
- Non-obvious business logic
- Security considerations
- Performance optimizations
- TODO/FIXME markers

**When NOT to comment**:
- Obvious code (e.g., `// Set x to 5`)
- Instead, write self-documenting code

```javascript
// Good comment
// Use Haversine formula to account for Earth's curvature
// More accurate than Pythagorean distance for GPS coordinates
function haversine(lat1, lon1, lat2, lon2) {
  // ...
}

// Bad comment
// Calculate distance
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius
  // ...
}
```

---

## Performance Considerations

### Database Optimization

**Indexes**: Ensure proper indexing
```sql
-- Good: Indexed foreign keys
CREATE INDEX idx_sessions_userId ON sessions(userId);
CREATE INDEX idx_sessions_carId ON sessions(carId);
CREATE INDEX idx_sessions_startTime ON sessions(startTime);

-- Query uses index
SELECT * FROM sessions WHERE userId = ? ORDER BY startTime DESC LIMIT 50;
```

**Connection Pooling**: For production, consider connection pooling
```javascript
// Future: Use better-sqlite3 or pg-pool
const Database = require('better-sqlite3');
const db = new Database('speeds.db');
db.pragma('journal_mode = WAL'); // Write-Ahead Logging
```

**Query Optimization**:
```javascript
// Good: Limit results
db.all('SELECT * FROM sessions WHERE userId = ? ORDER BY startTime DESC LIMIT 50', [userId]);

// Bad: Load all sessions
db.all('SELECT * FROM sessions WHERE userId = ?', [userId]);
```

### Frontend Performance

**Debounce GPS Updates**:
```javascript
// Avoid excessive UI updates
let lastUpdateTime = 0;
const UPDATE_INTERVAL = 100; // ms

navigator.geolocation.watchPosition((position) => {
  const now = Date.now();
  if (now - lastUpdateTime < UPDATE_INTERVAL) return;

  lastUpdateTime = now;
  updateSpeed(position);
});
```

**Lazy Loading**: Load data only when needed
```javascript
function showView(viewName) {
  if (viewName === 'summary' && !summaryLoaded) {
    loadSessions();
    summaryLoaded = true;
  }
}
```

**Minimize DOM Manipulation**:
```javascript
// Good: Build HTML string, single innerHTML
let html = '';
sessions.forEach(session => {
  html += `<div class="card">${session.vMax}</div>`;
});
container.innerHTML = html;

// Bad: Multiple DOM operations
sessions.forEach(session => {
  const div = document.createElement('div');
  div.className = 'card';
  div.textContent = session.vMax;
  container.appendChild(div);
});
```

---

## Security Best Practices

### Input Validation

**Never trust user input**:
```javascript
// Good: Validate and sanitize
const { body, validationResult } = require('express-validator');

router.post('/api/cars', [
  body('name').trim().isLength({ min: 1, max: 100 }),
  body('year').optional().isInt({ min: 1900, max: 2100 }),
  body('horsepower').optional().isInt({ min: 0 })
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  // Process validated data
});
```

### SQL Injection Prevention

**Always use parameterized queries**:
```javascript
// Good: Parameterized
db.get('SELECT * FROM users WHERE email = ?', [email], callback);

// Bad: Concatenated (SQL injection vulnerable!)
db.get(`SELECT * FROM users WHERE email = '${email}'`, callback);
```

### XSS Prevention

**Escape user content**:
```javascript
// Good: Use textContent (escapes HTML)
element.textContent = userInput;

// Bad: innerHTML with user input
element.innerHTML = userInput; // XSS vulnerable!

// If HTML needed, sanitize first
const sanitizedHTML = DOMPurify.sanitize(userInput);
element.innerHTML = sanitizedHTML;
```

### CSRF Protection

For state-changing operations with sessions:
```javascript
// Generate CSRF token on login
const csrfToken = crypto.randomBytes(32).toString('hex');
req.session.csrfToken = csrfToken;

// Validate on state-changing requests
function validateCSRF(req, res, next) {
  if (req.body.csrfToken !== req.session.csrfToken) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  next();
}
```

**Note**: JWT-based auth is less vulnerable to CSRF since tokens are in headers, not cookies.

### Environment Variables

**Never commit secrets**:
```javascript
// Good: Use environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// Bad: Hardcoded secrets
const JWT_SECRET = 'my-super-secret-key-12345';
```

**Use .env files**:
```bash
# .env (gitignored)
JWT_SECRET=your-random-secret-here-at-least-32-chars
DB_PATH=/path/to/production/speeds.db
PORT=3000
```

---

## Debugging Tips

### Backend Debugging

**Logging**:
```javascript
// Add detailed logs
console.log('User login attempt:', { email, ip: req.ip });
console.log('Database query:', query, params);
console.error('Error details:', err.message, err.stack);
```

**Database Inspection**:
```bash
# SQLite CLI
sqlite3 speeds.db
.schema users
.tables
SELECT * FROM users LIMIT 5;
```

### Frontend Debugging

**Browser DevTools**:
- **Console**: Check for JavaScript errors
- **Network**: Inspect API requests/responses
- **Application**: View localStorage, cookies
- **Sources**: Set breakpoints in code

**GPS Issues**:
```javascript
// Log GPS data
navigator.geolocation.watchPosition(
  (position) => {
    console.log('GPS Update:', {
      lat: position.coords.latitude,
      lon: position.coords.longitude,
      accuracy: position.coords.accuracy,
      speed: position.coords.speed
    });
  },
  (error) => {
    console.error('GPS Error:', error.code, error.message);
  },
  { enableHighAccuracy: true }
);
```

---

## Contributing Guidelines

### Git Workflow

1. **Create feature branch**:
   ```bash
   git checkout -b feature/add-notes-field
   ```

2. **Make changes and commit**:
   ```bash
   git add .
   git commit -m "Add notes field to sessions"
   ```

3. **Push and create pull request**:
   ```bash
   git push origin feature/add-notes-field
   ```

4. **Code review and merge**

### Commit Messages

**Format**: `<type>: <description>`

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Tests
- `chore`: Maintenance

**Examples**:
```
feat: add notes field to sessions
fix: resolve GPS accuracy calculation bug
docs: update API documentation for cars endpoint
refactor: extract authentication logic to middleware
```

---

## Useful Resources

### Documentation
- [Express Documentation](https://expressjs.com/)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [JWT Introduction](https://jwt.io/introduction)
- [MDN Web APIs](https://developer.mozilla.org/en-US/docs/Web/API)

### Tools
- [DB Browser for SQLite](https://sqlitebrowser.org/) - GUI for SQLite
- [Postman](https://www.postman.com/) - API testing
- [JWT Debugger](https://jwt.io/) - Decode JWT tokens

### Learning
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [JavaScript Clean Code](https://github.com/ryanmcdermott/clean-code-javascript)

---

## Conclusion

This guide provides a comprehensive overview of SpeedoPage's architecture and development practices. For questions or clarifications, consult the API Documentation or reach out to the development team.

**Happy Coding!**

---

**SpeedoPage Developer Guide v2.0.0**
*Last Updated: November 5, 2025*
