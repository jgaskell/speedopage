# SpeedoPage Agents

Agent-specific guidance for working with the SpeedoPage GPS speedometer application. These agents help structure development work across different concerns: frontend, backend, data, and planning.

---

## Tech Stack Overview

- **Backend**: Node.js + Express 5.1.0 + SQLite3 5.1.6
- **Frontend**: Vanilla JavaScript (ES6+) + HTML5 + CSS3
- **APIs**: Geolocation API, IP geolocation (ipapi.co), Reverse geocoding (OpenStreetMap Nominatim)
- **Storage**: SQLite database for speed logs, localStorage for device tracking
- **Deployment**: Single HTTP server on port 3000 (configurable via PORT env var)

---

## Project Structure

```
speedopage/
├── server.js              # Express server + SQLite database setup
├── public/
│   ├── index.html         # Minimal HTML structure with embedded CSS
│   └── app.js             # Main application logic (GPS, timers, logging)
├── speeds.db              # SQLite database (auto-created)
├── package.json           # Dependencies and scripts
└── CLAUDE.md              # Project overview and architecture notes
```

---

## Frontend Agent

### Responsibilities
- GPS tracking and position updates
- Speed calculations using Haversine formula
- UI updates and display logic
- Performance timer tracking (0-60, 1/4 mile, etc.)
- Unit conversion (mph/kmh) based on country detection
- Device ID management via localStorage
- Client-side data logging coordination

### Key Files
- `public/app.js` - All frontend logic
- `public/index.html` - UI structure and embedded styles

### Frontend Architecture

#### State Management
All state is managed via global variables in `app.js`:
```javascript
let units = 'kmh';              // Current display unit
let speed = 0;                   // Current speed in km/h
let lastPosition = null;         // Last GPS position
let timers = {};                 // Performance timer results
let vmax = 0;                    // Maximum speed in current run
let deviceId = localStorage...   // Unique device identifier
```

#### Core Functions
- `watchPosition(position)` - GPS callback, drives all calculations (app.js:79)
- `updateTimers(speed, timeDiff, dist)` - Tracks acceleration and drag timers
- `haversine(lat1, lon1, lat2, lon2)` - Distance calculation between GPS coords
- `getCountryFromCoords(lat, lon)` - Reverse geocoding for unit detection (throttled to 1/min)
- `logSpeed()` - Posts speed data to backend (throttled to 10s intervals)

#### UI Updates
- Speed display updates on every GPS position change
- Dual unit display: primary unit (large) + alternate unit (small)
- Timer display dynamically updates as targets are reached
- Display format: `${speed.toFixed(1)} ${units}`

#### GPS Configuration
```javascript
navigator.geolocation.watchPosition(
  watchPosition,
  errorHandler,
  {
    enableHighAccuracy: true,
    maximumAge: 1000  // Accept positions up to 1s old
  }
);
```

### Adding New Features

#### Add a new performance timer
1. For speed targets, add to `timerTargets` object in `app.js`:
```javascript
let timerTargets = {
  '0-80': 80,  // Add new timer for 0-80 mph/kmh
  // existing timers...
};
```

2. For distance targets, add to `distances` and `dragTargets`:
```javascript
let distances = { '1/3': 0.536448 };  // miles to km
let dragTargets = ['1/3 mile'];
```

#### Add a new display element
1. Add HTML element to `index.html`
2. Update display logic in `updateDisplay()` function
3. Style via embedded `<style>` tag or inline styles

#### Modify unit detection logic
Edit `setUnits(country)` function in `app.js:48` to change country-to-unit mapping.

### Important Constraints
- **All speeds stored in km/h internally** - conversion happens only at display time
- **GPS is the source of truth** - all calculations happen in `watchPosition()`
- **Timer auto-reset** - when speed drops below 1 km/h, all timers reset
- **API throttling** - country check limited to once per minute, logging every 10 seconds
- **No external dependencies** - pure vanilla JS, no frameworks or build tools

### Performance Considerations
- Haversine calculation runs on every GPS update (typically 1-3x per second)
- localStorage access is synchronous but fast (only on init and ID generation)
- Fetch calls are fire-and-forget (no blocking on responses)

---

## Backend Agent

### Responsibilities
- HTTP server setup and static file serving
- SQLite database initialization and management
- API endpoint for speed data logging
- Request validation and error handling

### Key Files
- `server.js` - Express server and all backend logic
- `speeds.db` - SQLite database (auto-created on first run)

### Backend Architecture

#### Server Setup
```javascript
const app = express();
app.use(express.static('public'));  // Serve frontend files
app.use(express.json());            // Parse JSON bodies
http.createServer(app).listen(port);
```

#### Database Connection
- SQLite in-memory or file-based (file: `speeds.db`)
- Connection opened on server start, persists throughout lifetime
- Uses `sqlite3` package with callback API (not promises)

#### API Endpoints

**POST /api/log-speed**
- **Purpose**: Log speed data from client devices
- **Request body**:
  ```json
  {
    "deviceId": "uuid-string",
    "speed": 85.5,           // km/h
    "timestamp": "2025-11-03T12:34:56.789Z"
  }
  ```
- **Response**:
  - Success (200): `{ "success": true, "id": 123 }`
  - Bad request (400): `{ "error": "Invalid data" }`
  - Server error (500): `{ "error": "Database error" }`
- **Validation**: Checks for `deviceId` presence and `speed` not null
- **Location**: server.js:25

### Adding New Features

#### Add a new API endpoint
1. Define route handler in `server.js`:
```javascript
app.get('/api/stats/:deviceId', (req, res) => {
  const { deviceId } = req.params;
  db.all(
    'SELECT * FROM speeds WHERE deviceId = ? ORDER BY timestamp DESC LIMIT 100',
    [deviceId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ data: rows });
    }
  );
});
```

2. Add request validation as needed
3. Handle errors appropriately (400 for client errors, 500 for server errors)

#### Add database indexes for performance
```javascript
db.run('CREATE INDEX IF NOT EXISTS idx_deviceId ON speeds(deviceId)');
db.run('CREATE INDEX IF NOT EXISTS idx_timestamp ON speeds(timestamp)');
```

#### Add CORS for external API access
```javascript
const cors = require('cors');
app.use(cors({
  origin: 'https://yourdomain.com',
  methods: ['GET', 'POST']
}));
```

### Important Constraints
- **Single database connection** - shared across all requests
- **No authentication** - endpoints are currently open
- **Synchronous db.serialize()** - schema creation blocks server start
- **HTTP only** - HTTPS setup requires uncommenting cert configuration
- **No request logging** - add middleware if needed (e.g., morgan)

### Error Handling Patterns
```javascript
// Always check for errors in callbacks
db.run('INSERT ...', [params], function(err) {
  if (err) {
    console.error(err);  // Log for debugging
    return res.status(500).json({ error: 'Database error' });
  }
  res.json({ success: true, id: this.lastID });
});
```

### Database Transaction Best Practices
For multiple related operations, use transactions:
```javascript
db.serialize(() => {
  db.run('BEGIN TRANSACTION');
  db.run('INSERT ...', [], (err) => {
    if (err) return db.run('ROLLBACK');
  });
  db.run('UPDATE ...', [], (err) => {
    if (err) return db.run('ROLLBACK');
  });
  db.run('COMMIT');
});
```

---

## Data Agent

### Responsibilities
- Database schema design and migrations
- Query optimization and indexing
- Data integrity and validation
- Analytics and reporting queries
- Backup and recovery procedures

### Key Files
- `speeds.db` - SQLite database file
- `server.js:11-19` - Schema definition

### Database Schema

#### speeds table
```sql
CREATE TABLE IF NOT EXISTS speeds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deviceId TEXT,           -- UUID from client localStorage
  speed REAL,               -- Speed in km/h (not mph)
  timestamp DATETIME        -- ISO 8601 format (e.g., "2025-11-03T12:34:56.789Z")
)
```

### Data Characteristics
- **Storage format**: All speeds in km/h regardless of display units
- **Timestamp format**: ISO 8601 strings (not Unix timestamps)
- **Device tracking**: UUIDs generated client-side, stored in localStorage
- **No user accounts**: Devices are anonymous
- **Logging frequency**: Approximately every 10 seconds per active device

### Common Queries

#### Get device history
```sql
SELECT * FROM speeds
WHERE deviceId = ?
ORDER BY timestamp DESC
LIMIT 100;
```

#### Get speed statistics for a device
```sql
SELECT
  COUNT(*) as total_readings,
  AVG(speed) as avg_speed,
  MAX(speed) as max_speed,
  MIN(speed) as min_speed
FROM speeds
WHERE deviceId = ?;
```

#### Get all devices and their latest reading
```sql
SELECT deviceId, MAX(timestamp) as last_seen, speed
FROM speeds
GROUP BY deviceId
ORDER BY last_seen DESC;
```

#### Clean old data (7 days retention)
```sql
DELETE FROM speeds
WHERE datetime(timestamp) < datetime('now', '-7 days');
```

### Adding New Features

#### Add a new column
```javascript
// In server.js, add migration logic:
db.serialize(() => {
  // Check if column exists
  db.all("PRAGMA table_info(speeds)", (err, rows) => {
    const hasColumn = rows.some(row => row.name === 'location');
    if (!hasColumn) {
      db.run('ALTER TABLE speeds ADD COLUMN location TEXT');
    }
  });
});
```

#### Add indexes for common queries
```javascript
db.run('CREATE INDEX IF NOT EXISTS idx_deviceId_timestamp ON speeds(deviceId, timestamp)');
db.run('CREATE INDEX IF NOT EXISTS idx_speed ON speeds(speed)');
```

#### Create a new table for trip sessions
```javascript
db.run(`CREATE TABLE IF NOT EXISTS trips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deviceId TEXT,
  startTime DATETIME,
  endTime DATETIME,
  maxSpeed REAL,
  avgSpeed REAL,
  distance REAL
)`);
```

### Data Validation Rules
- `deviceId`: Must be present, should be UUID format
- `speed`: Must be numeric, typically >= 0 and < 500 km/h
- `timestamp`: Must be valid ISO 8601 date string

### Backup Strategy
```bash
# Backup database file
sqlite3 speeds.db ".backup speeds_backup_$(date +%Y%m%d).db"

# Export to CSV
sqlite3 speeds.db -header -csv "SELECT * FROM speeds;" > speeds_export.csv

# Restore from backup
sqlite3 speeds.db ".restore speeds_backup_20251103.db"
```

### Performance Optimization

#### Regular maintenance
```sql
-- Rebuild database to reclaim space
VACUUM;

-- Update statistics for query optimizer
ANALYZE;
```

#### Query performance tips
- Use indexes on frequently queried columns (deviceId, timestamp)
- Limit large result sets with LIMIT clause
- Use prepared statements (already done via parameterized queries)
- Consider archiving old data to separate tables

---

## Planning Agent

### Responsibilities
- Breaking down feature requests into tasks
- Identifying dependencies between changes
- Estimating complexity and impact
- Planning testing strategies
- Coordinating multi-agent work

### Planning Workflow

#### 1. Understand the Request
- Clarify requirements and acceptance criteria
- Identify which agents are involved (frontend, backend, data)
- Determine if changes affect the API contract

#### 2. Break Down the Work
- Create discrete tasks for each agent
- Identify shared concerns (e.g., data models, API endpoints)
- Note any sequential dependencies

#### 3. Plan Testing
- Unit testing strategy (if adding test framework)
- Manual testing steps
- Edge cases to verify

#### 4. Consider Deployment
- Database migrations needed?
- Breaking changes to API?
- Backwards compatibility with existing client data?

### Common Scenarios

#### Scenario: Add a new feature (e.g., trip tracking)

**Planning checklist:**
- [ ] **Data**: Design new schema (trips table, relationships)
- [ ] **Backend**: Create new API endpoints (start/end trip, get trip history)
- [ ] **Frontend**: Add UI controls (start/stop trip button)
- [ ] **Frontend**: Implement trip tracking logic (accumulate distance/time)
- [ ] **Backend**: Migrate existing data if needed
- [ ] **Testing**: Test trip start/stop, data persistence, edge cases

**Dependencies:**
1. Data schema must be created first
2. Backend endpoints depend on schema
3. Frontend changes depend on backend API
4. Testing happens last

**Estimated complexity:** Medium
- New table: 1 data agent task
- 2-3 API endpoints: 1 backend agent task
- UI + logic: 1-2 frontend agent tasks

#### Scenario: Optimize performance

**Planning checklist:**
- [ ] **Data**: Add indexes to frequently queried columns
- [ ] **Backend**: Review query patterns, add caching if needed
- [ ] **Frontend**: Profile GPS update frequency, optimize calculations
- [ ] **Testing**: Measure before/after performance

**Dependencies:** Independent tasks, can be done in parallel

**Estimated complexity:** Low-Medium
- Database indexing: Quick
- Query optimization: Varies by issue
- Frontend optimization: Depends on bottleneck

#### Scenario: Add user authentication

**Planning checklist:**
- [ ] **Planning**: Choose auth strategy (JWT, sessions, OAuth)
- [ ] **Data**: Add users table, link speeds to users
- [ ] **Backend**: Add auth middleware, login/signup endpoints
- [ ] **Backend**: Protect existing endpoints with auth
- [ ] **Frontend**: Add login UI and session management
- [ ] **Frontend**: Store and send auth tokens with requests
- [ ] **Testing**: Test auth flows, unauthorized access

**Dependencies:**
1. Auth strategy decision required first
2. Schema changes before backend auth
3. Backend auth before frontend integration
4. Comprehensive testing at end

**Estimated complexity:** High
- Major architectural change
- Affects all layers
- Requires careful migration of existing anonymous data

### Cross-Agent Considerations

#### API Contract Changes
When backend changes affect frontend:
1. **Document the change** - update API docs or comments
2. **Version the API** - consider /api/v1/ vs /api/v2/
3. **Backwards compatibility** - support old clients during transition
4. **Coordinate deployment** - backend first, then frontend

#### Schema Migrations
When data structure changes:
1. **Write migration script** - ALTER TABLE, data transformations
2. **Test on backup first** - never migrate prod without testing
3. **Plan rollback** - have a way to undo changes
4. **Update seed data** - if using test fixtures

#### Performance Testing
Before optimizing:
1. **Measure baseline** - current performance metrics
2. **Identify bottleneck** - GPS updates? Database? Network?
3. **Optimize one thing** - make focused changes
4. **Measure again** - verify improvement
5. **Document findings** - what worked, what didn't

### Risk Assessment

**Low Risk Changes:**
- CSS styling updates
- Adding console.log statements
- New optional features that don't affect existing flows

**Medium Risk Changes:**
- Adding new API endpoints
- New database columns
- Changing display logic

**High Risk Changes:**
- Modifying GPS calculation logic
- Changing database schema of existing tables
- Authentication/authorization
- Unit conversion logic

### Collaboration Patterns

#### Frontend + Backend
Example: Adding device statistics endpoint
1. Frontend agent identifies data needed
2. Backend agent implements endpoint
3. Frontend agent integrates the call

#### Data + Backend
Example: Optimizing slow queries
1. Data agent analyzes query patterns
2. Data agent creates indexes
3. Backend agent updates queries to use indexes

#### All Three
Example: Adding real-time leaderboard
1. Planning agent breaks down work
2. Data agent creates leaderboard table/views
3. Backend agent creates WebSocket or polling endpoint
4. Frontend agent builds leaderboard UI

---

## Development Workflow

### Starting Work
1. **Planning agent** reviews request and creates task breakdown
2. **Data agent** makes schema changes if needed (and tests locally)
3. **Backend agent** implements API changes (and tests endpoints)
4. **Frontend agent** updates UI and logic (and tests in browser)

### Common Commands
```bash
npm start           # Start development server
sqlite3 speeds.db   # Open database CLI
node -v             # Check Node.js version (should be 14+)
```

### Testing Approach
Since there's no test framework yet, manual testing is required:
- **Frontend**: Open browser DevTools, check console for errors
- **Backend**: Use curl or Postman to test API endpoints
- **Data**: Use sqlite3 CLI to verify schema and query results

Example backend test:
```bash
curl -X POST http://localhost:3000/api/log-speed \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"test-123","speed":75.5,"timestamp":"2025-11-03T12:00:00Z"}'
```

### Code Quality Guidelines
- Use descriptive variable names (avoid single letters except in math formulas)
- Comment complex logic (e.g., Haversine formula)
- Validate all user input in backend
- Handle errors gracefully (try/catch, error callbacks)
- Keep functions focused on single responsibilities

---

## Common Pitfalls

### Frontend
- **Don't forget unit conversion**: Always store in km/h, convert only for display
- **GPS accuracy varies**: High accuracy mode drains battery faster
- **Throttle API calls**: Respect rate limits on external APIs (Nominatim)
- **localStorage limits**: ~5MB across all storage for the origin

### Backend
- **SQL injection**: Always use parameterized queries (already implemented)
- **Error exposure**: Don't leak stack traces to client (use generic error messages)
- **Database locks**: SQLite doesn't handle high write concurrency well
- **Memory leaks**: Close database connections properly (though we use one persistent connection)

### Data
- **No foreign keys by default**: SQLite requires `PRAGMA foreign_keys = ON;`
- **Type flexibility**: SQLite is loosely typed, validate in application layer
- **No ALTER TABLE for some operations**: Can't drop columns in older SQLite versions
- **Backup before migrations**: Always test schema changes on copies first

---

## Future Improvements

### Potential Enhancements
- Add user authentication and accounts
- Implement trip sessions (group consecutive speed readings)
- Real-time leaderboard or social features
- Export data to CSV/GPX formats
- Progressive Web App (PWA) with offline support
- Add test framework (Vitest, Jest, or Mocha)
- Add WebSocket for real-time updates
- Implement HTTPS with proper certificates
- Add rate limiting to API endpoints
- Create admin dashboard for viewing all devices

### Scalability Considerations
- **Current limits**: SQLite handles ~100K writes/sec, likely sufficient for this use case
- **If scaling needed**: Migrate to PostgreSQL or MySQL
- **For many concurrent users**: Add Redis for session management
- **For real-time features**: Use WebSockets or Server-Sent Events

---

## Questions or Issues?

When stuck:
1. Check `CLAUDE.md` for project overview
2. Review relevant agent section above
3. Examine existing code for patterns
4. Test in isolation (one change at a time)
5. Use console.log / console.error liberally during development
