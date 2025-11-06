# Club Tracker - Project Specification

## Project Overview

Club Tracker is a real-time location sharing and tracking application designed for car clubs and driving groups. Built on the same technology stack as SpeedoPage, it enables club members to share their live location, speed, and route information with other members during organized drives and events.

**Think**: "Find My" + "Waze" for car clubs

---

## Core Concept

- **Car clubs register** and create private groups
- **Club admins** control when location sharing is active (event-based)
- **Members see each other** on a live map during active events
- **Icons show real-time speed** and direction
- **Privacy-first**: Location only shared during active club events

---

## Technology Stack

### Backend
- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Database**: SQLite3 (with migration path to PostgreSQL)
- **Authentication**: JWT (JSON Web Tokens)
- **Real-time**: Socket.IO for live location updates
- **Rate Limiting**: express-rate-limit

### Frontend
- **UI**: Vanilla JavaScript (no framework)
- **Maps**: Leaflet.js or Mapbox GL JS
- **Real-time Updates**: Socket.IO client
- **GPS**: Geolocation API
- **Icons/UI**: CSS with gradients, modern design

### Dependencies
```json
{
  "dependencies": {
    "express": "^5.1.0",
    "sqlite3": "^5.1.6",
    "bcrypt": "^6.0.0",
    "jsonwebtoken": "^9.0.2",
    "socket.io": "^4.7.0",
    "express-validator": "^7.3.0",
    "express-rate-limit": "^8.2.1",
    "uuid": "^13.0.0",
    "dotenv": "^16.4.0"
  }
}
```

---

## Database Schema

### Tables

#### 1. users
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    passwordHash TEXT NOT NULL,
    displayName TEXT NOT NULL,
    phoneNumber TEXT,
    avatarUrl TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 2. clubs
```sql
CREATE TABLE clubs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    logoUrl TEXT,
    clubCode TEXT UNIQUE NOT NULL, -- 6-character code for joining
    isPrivate INTEGER DEFAULT 1,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 3. club_members
```sql
CREATE TABLE club_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clubId INTEGER NOT NULL,
    userId INTEGER NOT NULL,
    role TEXT NOT NULL DEFAULT 'member', -- 'admin', 'moderator', 'member'
    carName TEXT, -- e.g., "John's GT-R"
    carMake TEXT,
    carModel TEXT,
    carColor TEXT,
    mapIconColor TEXT DEFAULT '#00d4ff', -- Custom color for map marker
    joinedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (clubId) REFERENCES clubs(id) ON DELETE CASCADE,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(clubId, userId)
);
```

#### 4. events (drives/meetups)
```sql
CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clubId INTEGER NOT NULL,
    creatorId INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    startTime DATETIME NOT NULL,
    endTime DATETIME,
    isActive INTEGER DEFAULT 0, -- Admin toggles this to enable location sharing
    startLocation TEXT, -- JSON: {lat, lng, name}
    endLocation TEXT, -- JSON: {lat, lng, name}
    routeWaypoints TEXT, -- JSON array of waypoints
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (clubId) REFERENCES clubs(id) ON DELETE CASCADE,
    FOREIGN KEY (creatorId) REFERENCES users(id)
);
```

#### 5. location_history
```sql
CREATE TABLE location_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    eventId INTEGER NOT NULL,
    userId INTEGER NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    speed REAL DEFAULT 0, -- km/h
    heading INTEGER, -- 0-359 degrees
    accuracy REAL, -- meters
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (eventId) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (userId) REFERENCES users(id)
);
```

#### 6. event_participants
```sql
CREATE TABLE event_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    eventId INTEGER NOT NULL,
    userId INTEGER NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'declined'
    isOnline INTEGER DEFAULT 0, -- Currently sharing location
    lastSeen DATETIME,
    FOREIGN KEY (eventId) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(eventId, userId)
);
```

#### 7. invitations
```sql
CREATE TABLE invitations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clubId INTEGER NOT NULL,
    email TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    invitedBy INTEGER NOT NULL,
    expiresAt DATETIME NOT NULL,
    usedAt DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (clubId) REFERENCES clubs(id) ON DELETE CASCADE,
    FOREIGN KEY (invitedBy) REFERENCES users(id)
);
```

---

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get JWT
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout
- `PUT /api/auth/profile` - Update profile

### Clubs
- `POST /api/clubs` - Create new club (user becomes admin)
- `GET /api/clubs` - List user's clubs
- `GET /api/clubs/:clubId` - Get club details
- `PUT /api/clubs/:clubId` - Update club (admin only)
- `DELETE /api/clubs/:clubId` - Delete club (admin only)
- `POST /api/clubs/join` - Join club with club code
- `GET /api/clubs/:clubId/members` - List club members
- `PUT /api/clubs/:clubId/members/:userId` - Update member role (admin only)
- `DELETE /api/clubs/:clubId/members/:userId` - Remove member

### Events
- `POST /api/events` - Create event (admin/moderator)
- `GET /api/clubs/:clubId/events` - List club events
- `GET /api/events/:eventId` - Get event details
- `PUT /api/events/:eventId` - Update event (creator/admin)
- `DELETE /api/events/:eventId` - Delete event
- `POST /api/events/:eventId/activate` - Start event (enable tracking) - admin only
- `POST /api/events/:eventId/deactivate` - Stop event - admin only
- `POST /api/events/:eventId/join` - Join event as participant
- `GET /api/events/:eventId/participants` - List participants

### Location Tracking
- `POST /api/events/:eventId/location` - Update my location (during active event)
- `GET /api/events/:eventId/locations` - Get all participant locations (real-time fallback)
- `DELETE /api/events/:eventId/location` - Stop sharing location

### Invitations
- `POST /api/clubs/:clubId/invite` - Invite user by email (admin only)
- `POST /api/invitations/:token/accept` - Accept invitation

---

## Real-Time Communication (Socket.IO)

### Events Emitted by Server

#### Connection
```javascript
socket.on('connect', () => {
    // Client connected
});
```

#### Join Event Room
```javascript
socket.emit('join:event', { eventId, userId, token });
// Server response: 'joined:event' or 'error'
```

#### Location Updates
```javascript
// Broadcast to all participants in event
socket.on('location:update', {
    userId,
    displayName,
    carName,
    latitude,
    longitude,
    speed,
    heading,
    accuracy,
    timestamp,
    iconColor,
    isMoving // true if speed > 5 km/h
});
```

#### Participant Status
```javascript
// When participant joins/leaves
socket.on('participant:online', { userId, displayName });
socket.on('participant:offline', { userId });
```

#### Event Status
```javascript
// When admin activates/deactivates event
socket.on('event:activated', { eventId, activatedBy });
socket.on('event:deactivated', { eventId, deactivatedBy });
```

### Events Emitted by Client

#### Send Location Update
```javascript
socket.emit('location:send', {
    eventId,
    latitude,
    longitude,
    speed,
    heading,
    accuracy
});
```

#### Request Current Locations
```javascript
socket.emit('location:request', { eventId });
// Server responds with all current locations
```

---

## Frontend Architecture

### File Structure
```
public/
├── index.html          # Main app shell
├── css/
│   └── styles.css      # All styles
├── js/
│   ├── app.js          # Main application logic
│   ├── auth.js         # Authentication service
│   ├── map.js          # Map rendering and marker management
│   ├── socket.js       # Socket.IO connection management
│   ├── location.js     # GPS tracking and location updates
│   └── ui.js           # UI components and modals
└── assets/
    └── markers/        # Custom map marker icons
```

### Key Frontend Components

#### 1. Map View (Main Screen)
- Full-screen Leaflet/Mapbox map
- Real-time participant markers
- Speed displayed on/near marker
- Direction arrow rotation
- Clustered markers when zoomed out
- Route polyline (if defined)
- Current user highlighted

#### 2. Club Selector
- Dropdown/modal to switch between clubs
- "Create Club" button
- "Join Club" with code input

#### 3. Event List
- Upcoming events
- Active events (highlighted)
- Past events
- Quick "Start Tracking" for active events

#### 4. Participant List Panel
- Collapsible side panel
- List of online participants
- Shows: name, car, speed, last update time
- Click to center map on participant
- Shows offline participants (grayed out)

#### 5. Admin Controls (for admins)
- "Start Event" button (activates location sharing)
- "End Event" button
- Participant management
- Event editing

#### 6. Settings
- Map style (street, satellite, dark mode)
- Location update frequency (5s, 10s, 30s)
- Marker icon customization
- Notification preferences

---

## User Flows

### 1. First-Time User Registration
1. User visits app
2. Register account (email, password, display name)
3. Email verification (optional)
4. "Create Club" or "Join Club" prompt
5. If joining: enter 6-character club code
6. Setup car details (name, make, model, color)
7. Complete!

### 2. Creating a Club
1. Click "Create Club"
2. Enter: name, description, upload logo
3. Set privacy (private/public)
4. System generates unique 6-character club code
5. User becomes admin
6. Invite members via email or share club code

### 3. Joining an Active Event
1. User opens app
2. Sees list of clubs they're in
3. Selects club → sees upcoming/active events
4. Clicks active event (green indicator)
5. Clicks "Start Tracking"
6. GPS activates, location shared every 10 seconds
7. Sees other participants on map

### 4. Admin Starting an Event
1. Admin creates event:
   - Name: "Sunday Morning Drive"
   - Start time, end time
   - Optional: start location, destination, waypoints
2. Invites club members (or all)
3. When ready, admin clicks "Activate Event"
4. All participants get notification
5. Participants can join and start sharing location
6. Admin sees all participants on map
7. Admin clicks "Deactivate Event" when done

### 5. Real-Time Tracking During Event
1. Participant's phone sends GPS data every 10 seconds
2. Server broadcasts to all event participants via Socket.IO
3. Map updates markers with:
   - New position
   - Current speed (shown on marker)
   - Direction arrow rotation
   - Color-coded by participant
4. Polyline trail shows recent path (last 50 points)
5. If participant stops moving (speed < 5 km/h for 2 min):
   - Marker changes to "stopped" icon
6. If participant disconnects:
   - Marker grays out
   - Shows "Last seen: X minutes ago"

---

## Key Features

### Privacy & Security
- **Admin-controlled**: Only admins can activate location sharing
- **Event-based**: Location only shared during active events
- **Opt-in**: Members must actively join event and start tracking
- **Auto-off**: Location sharing stops when event ends
- **No history without consent**: Location history only saved if enabled
- **Club privacy**: Private clubs require approval or invitation

### Location Sharing Controls
- Toggle tracking on/off anytime
- Pause tracking (marker stays in place)
- "Ghost mode" - see others but don't share your location (admin only)
- Emergency "Stop All Tracking" button

### Map Features
- **Live markers** with speed and direction
- **Participant trails** (last 5 minutes of movement)
- **Route planning** (admins can set waypoints)
- **POI markers** (gas stations, rest stops, photo spots)
- **Geofence alerts** (notify when participant enters/leaves area)
- **Speed alerts** (notify admin if member exceeds speed limit)

### Notifications
- Event starting soon (15 min warning)
- Event activated (push notification)
- Participant joined event
- Participant disconnected
- Event ending soon
- Emergency alert (if participant triggers SOS)

### Social Features
- Event photo gallery (participants can upload)
- Event chat (during active events)
- Post-event summary (route map, max speeds, duration)
- Leaderboards (longest drive, most events attended)
- Event ratings/reviews

---

## Technical Implementation Details

### Location Update Strategy

#### High-Frequency Mode (Active Event)
```javascript
// Update every 10 seconds
navigator.geolocation.watchPosition(
    position => {
        const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            speed: position.coords.speed * 3.6, // m/s to km/h
            heading: position.coords.heading,
            accuracy: position.coords.accuracy
        };

        // Send via Socket.IO
        socket.emit('location:send', {
            eventId,
            ...location
        });

        // Also save to database (throttled to every 30 seconds)
        if (shouldSaveToDatabase()) {
            saveLocationToDatabase(location);
        }
    },
    error => console.error(error),
    {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000
    }
);
```

#### Bandwidth Optimization
- Socket.IO broadcasts location to connected clients (no API calls needed)
- Database saves throttled to 30-second intervals
- Client-side marker interpolation for smooth movement
- Compression enabled on Socket.IO transport

### Map Marker Rendering

#### Custom Marker with Speed Display
```javascript
// Leaflet custom marker
const createMarker = (participant) => {
    const icon = L.divIcon({
        html: `
            <div class="participant-marker" style="background: ${participant.iconColor}">
                <div class="marker-arrow" style="transform: rotate(${participant.heading}deg)">
                    ▲
                </div>
                <div class="marker-speed">${Math.round(participant.speed)}</div>
                <div class="marker-name">${participant.displayName}</div>
            </div>
        `,
        className: 'custom-marker',
        iconSize: [60, 80]
    });

    return L.marker([participant.latitude, participant.longitude], { icon });
};
```

#### Marker States
- **Moving** (speed > 5 km/h): Arrow rotates, speed shown
- **Stopped** (speed < 5 km/h): Parking icon, no speed
- **Offline**: Grayed out, "Last seen" timestamp
- **Current user**: Highlighted with pulse animation

### Performance Optimizations

#### 1. Socket.IO Room-Based Broadcasting
```javascript
// Only broadcast to event participants
io.to(`event:${eventId}`).emit('location:update', data);
```

#### 2. Client-Side Marker Pooling
```javascript
// Reuse marker objects instead of creating new ones
const markerPool = {};

function updateMarker(userId, location) {
    if (!markerPool[userId]) {
        markerPool[userId] = createMarker(location);
    } else {
        markerPool[userId].setLatLng([location.latitude, location.longitude]);
        markerPool[userId].setIcon(createIcon(location));
    }
}
```

#### 3. Database Write Batching
```javascript
// Batch location updates every 30 seconds
const locationBuffer = [];

function bufferLocation(location) {
    locationBuffer.push(location);

    if (locationBuffer.length >= 10 || lastFlush > 30000) {
        flushLocationsToDatabase(locationBuffer);
        locationBuffer.length = 0;
    }
}
```

#### 4. Map Viewport Filtering
```javascript
// Only render markers within viewport + buffer
const visibleBounds = map.getBounds().pad(0.2);
const visibleParticipants = participants.filter(p =>
    visibleBounds.contains([p.latitude, p.longitude])
);
```

---

## Deployment Architecture

### Single-Server Setup (Small Clubs)
```
[Internet]
    ↓
[Nginx/Caddy] (HTTPS, WebSocket proxy)
    ↓
[Node.js + Socket.IO]
    ↓
[SQLite Database]
```

**Suitable for**: 1-5 clubs, <100 concurrent users

### Scaled Setup (Multiple Clubs)
```
[Internet]
    ↓
[Load Balancer]
    ↓
[Node.js Cluster] (3 instances)
    ↓
[Redis] (Socket.IO adapter)
    ↓
[PostgreSQL] (replaces SQLite)
```

**Suitable for**: 10+ clubs, 100-500 concurrent users

### AWS Deployment
- **EC2**: T4G.small or T4G.medium
- **RDS**: PostgreSQL (if scaling beyond SQLite)
- **ElastiCache**: Redis for Socket.IO scaling
- **CloudFront**: CDN for static assets
- **Route 53**: DNS management
- **Certificate Manager**: Free SSL certificates

---

## Mobile Considerations

### Background Location Updates
```javascript
// Request background location permission
if ('permissions' in navigator) {
    navigator.permissions.query({ name: 'geolocation' }).then(result => {
        if (result.state === 'granted') {
            startBackgroundTracking();
        }
    });
}

// Use Service Worker for background updates
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(registration => {
        // Service worker can continue sending location updates
        // even when app is in background
    });
}
```

### Battery Optimization
- Reduce update frequency when battery low
- Use coarse location when speed < 10 km/h
- Disable trail rendering on low battery
- Option to disable background tracking

### Progressive Web App (PWA)
```json
// manifest.json
{
    "name": "Club Tracker",
    "short_name": "ClubTracker",
    "start_url": "/",
    "display": "standalone",
    "background_color": "#0f0c29",
    "theme_color": "#00d4ff",
    "icons": [
        {
            "src": "/icon-192.png",
            "sizes": "192x192",
            "type": "image/png"
        },
        {
            "src": "/icon-512.png",
            "sizes": "512x512",
            "type": "image/png"
        }
    ]
}
```

---

## Security Considerations

### Authentication
- JWT tokens with 24-hour expiration
- Refresh token mechanism
- Password hashing with bcrypt (12 rounds)
- Rate limiting on login (5 attempts per 15 min)

### Authorization
- Role-based access control (admin, moderator, member)
- Event activation restricted to admins
- Club editing restricted to admins/moderators
- Location data only visible to event participants

### Data Privacy
- Location data encrypted in transit (HTTPS, WSS)
- Location history deleted after 30 days (configurable)
- Users can delete all their data
- GDPR compliance features:
  - Data export
  - Right to be forgotten
  - Consent management

### Input Validation
- All API inputs validated with express-validator
- SQL injection prevention (parameterized queries)
- XSS prevention (sanitize all user inputs)
- CSRF protection for sensitive operations

---

## Testing Strategy

### Unit Tests
- Authentication functions
- Location calculation utilities
- Database queries
- Authorization middleware

### Integration Tests
- API endpoints
- Socket.IO events
- Database operations
- User flows

### End-to-End Tests
- User registration and login
- Club creation and joining
- Event creation and activation
- Location sharing during event
- Map marker updates

### Load Testing
- Socket.IO connection capacity
- Concurrent location updates
- Database write throughput
- API response times under load

---

## Future Enhancements (v2.0+)

### Advanced Features
1. **Route Recording**: Save and share favorite routes
2. **Replay Mode**: Replay past events with speed control
3. **Caravan Mode**: Keep group together with spacing alerts
4. **Meet-up Points**: Suggest gas stations, rest areas along route
5. **Integration**: Strava, Google Maps, Apple Maps
6. **Analytics**: Club insights, popular routes, member activity
7. **Gamification**: Badges, achievements, club challenges
8. **Video Streaming**: Live dashcam feed from participants
9. **Voice Chat**: In-app voice communication during events
10. **AR Navigation**: Augmented reality waypoint markers

### Platform Expansion
- Native iOS app (Swift)
- Native Android app (Kotlin)
- Apple CarPlay integration
- Android Auto integration
- Smartwatch companion app

---

## Migration from SpeedoPage

### Code Reuse Opportunities

#### 1. Authentication System (100% reusable)
- `middleware/auth.js`
- `middleware/password.js`
- `routes/auth.js`
- `public/auth-service.js`

#### 2. GPS Tracking Logic (80% reusable)
- Speed calculation
- Heading calculation
- Accuracy handling
- Country detection for units

#### 3. Database Structure (50% reusable)
- Users table (same)
- Session pattern → Location history pattern
- SQLite setup and migration scripts

#### 4. UI Components (40% reusable)
- Authentication modals
- Navigation structure
- CSS styling patterns
- Error handling

### New Components Needed
- Socket.IO integration
- Map rendering (Leaflet/Mapbox)
- Real-time marker updates
- Club management UI
- Event management UI
- Admin controls

---

## Development Phases

### Phase 1: Foundation (2-3 weeks)
- [ ] Project setup and database schema
- [ ] User authentication (reuse from SpeedoPage)
- [ ] Club CRUD operations
- [ ] Member management
- [ ] Basic UI structure

### Phase 2: Real-Time Core (3-4 weeks)
- [ ] Socket.IO integration
- [ ] Location tracking service
- [ ] Map integration (Leaflet)
- [ ] Real-time marker updates
- [ ] Basic event management

### Phase 3: Event System (2-3 weeks)
- [ ] Event CRUD operations
- [ ] Event activation/deactivation
- [ ] Participant management
- [ ] Event notifications
- [ ] Location history recording

### Phase 4: Polish & Features (2-3 weeks)
- [ ] Admin controls and UI
- [ ] Participant list panel
- [ ] Map customization options
- [ ] Trail rendering
- [ ] Performance optimizations

### Phase 5: Testing & Deployment (1-2 weeks)
- [ ] Unit and integration tests
- [ ] Load testing
- [ ] Security audit
- [ ] AWS deployment
- [ ] Documentation

**Total Estimated Time**: 10-15 weeks for MVP

---

## Success Metrics

### Technical Metrics
- Socket.IO connection success rate: >99%
- Location update latency: <500ms
- API response time: <200ms
- Uptime: >99.9%
- Battery drain: <5% per hour of tracking

### User Metrics
- User registration rate
- Daily active users
- Average event duration
- Participants per event
- User retention (30-day)

### Business Metrics
- Number of clubs created
- Average club size
- Events per club per month
- Monthly active clubs
- User satisfaction (NPS score)

---

## Monetization Potential (Optional)

### Free Tier
- 1 club membership
- 5 active events per month
- Location history: 7 days
- Max 10 participants per event

### Club Tier ($5/month per club)
- Unlimited club memberships
- Unlimited events
- Location history: 90 days
- Max 50 participants per event
- Custom club branding
- Priority support

### Enterprise Tier ($50/month per club)
- Unlimited everything
- Location history: 1 year
- Unlimited participants
- White-label option
- API access
- Dedicated support
- Custom integrations

---

## Competitive Analysis

### Similar Apps
1. **Glympse** - Temporary location sharing
2. **Life360** - Family location tracking
3. **Find My Friends** (Apple) - iOS location sharing
4. **Zenly** - Social location sharing (discontinued)
5. **Strava** - Route tracking (no real-time)

### Club Tracker Advantages
- **Event-based**: Privacy by design
- **Car club focused**: Tailored features
- **Admin control**: Organized, not chaotic
- **Speed display**: Relevant for driving groups
- **Route planning**: Not just tracking, but leading
- **Open source**: Self-hostable, no vendor lock-in

---

## License & Distribution

### Licensing
- **Recommended**: MIT License (same as SpeedoPage)
- Allows commercial use
- Allows modification and distribution
- Minimal restrictions

### Distribution Channels
- GitHub (open source)
- npm package (for easy deployment)
- Docker Hub (containerized version)
- AWS Marketplace (one-click deploy)

---

## Conclusion

Club Tracker is a natural evolution of SpeedoPage's technology, shifting focus from individual performance tracking to group coordination and safety. By leveraging the same robust stack (Node.js, Express, SQLite, Socket.IO) and adding real-time location features, it creates a unique product for the car enthusiast community.

**Key Differentiators:**
- Privacy-first, event-based location sharing
- Admin-controlled activation
- Real-time speed and direction display
- Built for car clubs and driving groups
- Self-hostable and open source

**Next Steps:**
1. Review and refine this specification
2. Create new project structure based on SpeedoPage
3. Set up database schema and migrations
4. Implement Socket.IO real-time infrastructure
5. Build map interface with Leaflet/Mapbox
6. Iterative development following phases above

---

## Contact & Support

For questions about this specification or implementation guidance:
- GitHub Issues: (project repository)
- Email: (your contact)
- Documentation: See `/Documentation` folder in project

---

**Document Version**: 1.0
**Created**: 2025-11-05
**Last Updated**: 2025-11-05
**Based on**: SpeedoPage v2.0.0
