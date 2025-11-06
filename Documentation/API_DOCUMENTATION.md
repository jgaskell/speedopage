# SpeedoPage v2.0 - API Documentation

## Overview

The SpeedoPage API provides RESTful endpoints for user authentication, car management, session tracking, and user profiles. All endpoints return JSON responses and use standard HTTP status codes.

**Base URL**: `http://localhost:3000` (development) or your deployed URL

**API Version**: 2.0.0

---

## Table of Contents

1. [Authentication](#authentication)
2. [Authentication Endpoints](#authentication-endpoints)
3. [Car Management Endpoints](#car-management-endpoints)
4. [User Profile Endpoints](#user-profile-endpoints)
5. [Session Endpoints](#session-endpoints)
6. [Error Handling](#error-handling)
7. [Rate Limiting](#rate-limiting)
8. [Data Models](#data-models)

---

## Authentication

SpeedoPage uses JWT (JSON Web Tokens) for authentication. Include the token in the `Authorization` header:

```
Authorization: Bearer <your-jwt-token>
```

### Token Lifetime

- JWT tokens expire after **24 hours** (configurable via `JWT_EXPIRES_IN` environment variable)
- Use the `/api/auth/refresh` endpoint to obtain a new token

### Authentication States

- **Required**: Endpoint requires valid JWT token (returns 401 if missing/invalid)
- **Optional**: Endpoint works with or without authentication (enhanced features when authenticated)
- **None**: Endpoint publicly accessible

---

## Authentication Endpoints

### POST /api/auth/register

Create a new user account.

**Authentication**: None required

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "displayName": "John Doe" // optional
}
```

**Validation Rules**:
- `email`: Valid email format, normalized (lowercase)
- `password`:
  - Minimum 8 characters
  - Maximum 128 characters
  - Must contain at least one letter and one number
- `displayName`: Optional, 1-50 characters

**Success Response** (201 Created):
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "displayName": "John Doe",
    "unitsPreference": "auto",
    "isEmailVerified": false
  }
}
```

**Error Responses**:
- `400 Bad Request`: Validation failed
  ```json
  {
    "error": "Password does not meet requirements",
    "details": ["Must contain at least one letter", "Must contain at least one number"]
  }
  ```
- `409 Conflict`: User already exists
  ```json
  {
    "error": "User already exists",
    "code": "USER_EXISTS"
  }
  ```
- `500 Internal Server Error`: Server error

---

### POST /api/auth/login

Authenticate an existing user.

**Authentication**: None required

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "displayName": "John Doe",
    "unitsPreference": "auto",
    "isEmailVerified": false,
    "isPublicProfile": false,
    "avatarUrl": null
  }
}
```

**Error Responses**:
- `400 Bad Request`: Validation failed
- `401 Unauthorized`: Invalid credentials
  ```json
  {
    "error": "Invalid email or password",
    "code": "INVALID_CREDENTIALS"
  }
  ```
- `403 Forbidden`: Account suspended
  ```json
  {
    "error": "Account is not active",
    "code": "ACCOUNT_SUSPENDED"
  }
  ```

---

### GET /api/auth/me

Get current authenticated user information.

**Authentication**: Required

**Headers**:
```
Authorization: Bearer <token>
```

**Success Response** (200 OK):
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "displayName": "John Doe",
    "unitsPreference": "auto",
    "isEmailVerified": false,
    "isPublicProfile": false,
    "avatarUrl": null,
    "createdAt": "2025-11-05T10:30:00.000Z",
    "lastLoginAt": "2025-11-05T14:20:00.000Z"
  }
}
```

**Error Responses**:
- `401 Unauthorized`: Missing or invalid token
- `404 Not Found`: User not found

---

### POST /api/auth/logout

Logout the current user (client-side token deletion).

**Authentication**: None required

**Note**: With JWT, logout is primarily client-side (delete the token). This endpoint exists for consistency and future token blacklisting.

**Success Response** (200 OK):
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### POST /api/auth/refresh

Refresh JWT token to extend session.

**Authentication**: Required

**Headers**:
```
Authorization: Bearer <current-token>
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses**:
- `401 Unauthorized`: Invalid token or inactive user

---

## Car Management Endpoints

### GET /api/cars

Get all cars for the authenticated user.

**Authentication**: Required

**Success Response** (200 OK):
```json
{
  "cars": [
    {
      "id": 1,
      "userId": 1,
      "name": "My Mustang GT",
      "make": "Ford",
      "model": "Mustang",
      "year": 2020,
      "trim": "GT Premium",
      "color": "Velocity Blue",
      "photoUrl": null,
      "weight": 1750,
      "horsepower": 460,
      "modifications": "Cold air intake, cat-back exhaust",
      "isActive": 1,
      "createdAt": "2025-11-05T10:00:00.000Z",
      "updatedAt": "2025-11-05T10:00:00.000Z"
    }
  ]
}
```

**Notes**:
- Cars are ordered by `isActive DESC, createdAt DESC` (active car first, then newest)
- Only returns cars owned by the authenticated user

---

### GET /api/cars/:carId

Get a specific car by ID.

**Authentication**: Required

**URL Parameters**:
- `carId` (integer): Car ID

**Success Response** (200 OK):
```json
{
  "car": {
    "id": 1,
    "userId": 1,
    "name": "My Mustang GT",
    "make": "Ford",
    "model": "Mustang",
    "year": 2020,
    "trim": "GT Premium",
    "color": "Velocity Blue",
    "photoUrl": null,
    "weight": 1750,
    "horsepower": 460,
    "modifications": "Cold air intake, cat-back exhaust",
    "isActive": 1,
    "createdAt": "2025-11-05T10:00:00.000Z",
    "updatedAt": "2025-11-05T10:00:00.000Z"
  }
}
```

**Error Responses**:
- `400 Bad Request`: Invalid car ID format
- `404 Not Found`: Car not found or not owned by user

---

### POST /api/cars

Add a new car to the user's garage.

**Authentication**: Required

**Request Body**:
```json
{
  "name": "My Mustang GT",           // required
  "make": "Ford",                    // optional
  "model": "Mustang",                // optional
  "year": 2020,                      // optional
  "trim": "GT Premium",              // optional
  "color": "Velocity Blue",          // optional
  "photoUrl": "https://...",         // optional
  "weight": 1750,                    // optional (kg)
  "horsepower": 460,                 // optional
  "modifications": "CAI, exhaust"    // optional
}
```

**Validation Rules**:
- `name`: Required, 1-100 characters
- `make`: Optional, max 50 characters
- `model`: Optional, max 50 characters
- `year`: Optional, 1900-2100
- `trim`: Optional, max 50 characters
- `color`: Optional, max 30 characters
- `weight`: Optional, positive float
- `horsepower`: Optional, positive integer
- `modifications`: Optional, string

**Success Response** (201 Created):
```json
{
  "success": true,
  "car": {
    "id": 1,
    "userId": 1,
    "name": "My Mustang GT",
    "make": "Ford",
    "model": "Mustang",
    "year": 2020,
    "trim": "GT Premium",
    "color": "Velocity Blue",
    "photoUrl": null,
    "weight": 1750,
    "horsepower": 460,
    "modifications": "CAI, exhaust",
    "isActive": 1,
    "createdAt": "2025-11-05T10:00:00.000Z",
    "updatedAt": "2025-11-05T10:00:00.000Z"
  }
}
```

**Notes**:
- If this is the user's first car, it's automatically set as active
- Otherwise, `isActive` is 0 and must be manually activated

---

### PUT /api/cars/:carId

Update an existing car.

**Authentication**: Required

**URL Parameters**:
- `carId` (integer): Car ID

**Request Body**: (All fields optional)
```json
{
  "name": "Updated Name",
  "make": "Updated Make",
  "horsepower": 500
}
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "car": {
    // Updated car object
  }
}
```

**Error Responses**:
- `400 Bad Request`: Invalid car ID or no fields to update
- `404 Not Found`: Car not found or not owned by user

---

### DELETE /api/cars/:carId

Delete a car from the garage.

**Authentication**: Required

**URL Parameters**:
- `carId` (integer): Car ID

**Success Response** (200 OK):
```json
{
  "success": true,
  "message": "Car deleted successfully"
}
```

**Notes**:
- If deleted car was active, the most recently created car becomes active
- Sessions associated with this car are NOT deleted (car name is preserved in session data)

---

### PUT /api/cars/:carId/set-active

Set a car as the active car for the user.

**Authentication**: Required

**URL Parameters**:
- `carId` (integer): Car ID

**Success Response** (200 OK):
```json
{
  "success": true,
  "message": "Active car updated",
  "carId": 1
}
```

**Notes**:
- All other cars are automatically set to inactive
- Only one car can be active at a time

---

### GET /api/cars/:carId/stats

Get performance statistics for a specific car.

**Authentication**: Required

**URL Parameters**:
- `carId` (integer): Car ID

**Success Response** (200 OK):
```json
{
  "car": {
    "id": 1,
    "name": "My Mustang GT",
    // ... other car fields
  },
  "stats": {
    "totalSessions": 25,
    "topSpeed": 185.5,
    "totalDistance": 45.8,
    "totalDuration": 3600,
    "avgMaxSpeed": 142.3,
    "bestTimes": {
      "0-60": 4.2,
      "0-100": 8.9,
      "1/4 mile": 12.5,
      "0-100kmh": 4.4,
      "100-200kmh": 8.1
    }
  }
}
```

**Field Descriptions**:
- `totalSessions`: Number of recorded sessions
- `topSpeed`: Fastest speed ever recorded (km/h)
- `totalDistance`: Total distance traveled (km)
- `totalDuration`: Total driving time (seconds)
- `avgMaxSpeed`: Average maximum speed across all sessions (km/h)
- `bestTimes`: Best time for each performance metric (seconds)

---

## User Profile Endpoints

### GET /api/users/:userId/profile

Get user profile (public or own).

**Authentication**: Optional (required for private profiles)

**URL Parameters**:
- `userId` (integer): User ID

**Success Response** (200 OK - Own Profile):
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "displayName": "John Doe",
    "avatarUrl": "https://...",
    "unitsPreference": "auto",
    "isEmailVerified": false,
    "isPublicProfile": false,
    "createdAt": "2025-11-05T10:00:00.000Z",
    "lastLoginAt": "2025-11-05T14:00:00.000Z"
  }
}
```

**Success Response** (200 OK - Public Profile):
```json
{
  "user": {
    "id": 2,
    "displayName": "Jane Doe",
    "avatarUrl": "https://...",
    "isPublicProfile": true,
    "createdAt": "2025-11-05T10:00:00.000Z"
  }
}
```

**Error Responses**:
- `403 Forbidden`: Profile is private
- `404 Not Found`: User not found

---

### PUT /api/users/:userId/profile

Update user profile.

**Authentication**: Required (must be own profile)

**URL Parameters**:
- `userId` (integer): User ID

**Request Body**: (All fields optional)
```json
{
  "displayName": "New Name",
  "avatarUrl": "https://...",
  "unitsPreference": "mph",
  "isPublicProfile": true
}
```

**Validation Rules**:
- `displayName`: 1-50 characters
- `avatarUrl`: Valid URL format
- `unitsPreference`: One of: "auto", "kmh", "mph"
- `isPublicProfile`: Boolean

**Success Response** (200 OK):
```json
{
  "success": true,
  "user": {
    // Updated user object
  }
}
```

**Error Responses**:
- `400 Bad Request`: Validation failed or no fields to update
- `403 Forbidden`: Not own profile

---

### PUT /api/users/:userId/password

Change user password.

**Authentication**: Required (must be own profile)

**URL Parameters**:
- `userId` (integer): User ID

**Request Body**:
```json
{
  "currentPassword": "OldPassword123",
  "newPassword": "NewSecurePass456"
}
```

**Validation Rules**:
- `newPassword`: Same rules as registration (min 8 chars, letter + number)

**Success Response** (200 OK):
```json
{
  "success": true,
  "message": "Password updated successfully"
}
```

**Error Responses**:
- `400 Bad Request`: Password doesn't meet requirements
- `401 Unauthorized`: Current password incorrect
- `403 Forbidden`: Not own profile

---

### DELETE /api/users/:userId/account

Delete user account permanently.

**Authentication**: Required (must be own profile)

**URL Parameters**:
- `userId` (integer): User ID

**Request Body**:
```json
{
  "password": "CurrentPassword123",
  "confirmation": "DELETE"
}
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "message": "Account deleted successfully"
}
```

**Notes**:
- This action is **permanent** and cannot be undone
- All user data (cars, sessions) is deleted via CASCADE

**Error Responses**:
- `401 Unauthorized`: Password incorrect
- `403 Forbidden`: Not own profile

---

### GET /api/users/:userId/stats

Get overall statistics for a user.

**Authentication**: Required (must be own profile)

**URL Parameters**:
- `userId` (integer): User ID

**Success Response** (200 OK):
```json
{
  "stats": {
    "totalSessions": 125,
    "topSpeed": 210.5,
    "totalDistance": 450.8,
    "totalDuration": 18000,
    "avgMaxSpeed": 152.3,
    "carCount": 3
  }
}
```

---

## Session Endpoints

### POST /api/log-speed

Log a single speed data point (legacy endpoint for continuous logging).

**Authentication**: None required

**Request Body**:
```json
{
  "deviceId": "abc123-...",
  "speed": 75.5,
  "timestamp": "2025-11-05T14:30:00.000Z"
}
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "id": 12345
}
```

**Error Responses**:
- `400 Bad Request`: Invalid data
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Database error

---

### POST /api/save-session

Save a completed session.

**Authentication**: Optional (enhanced for authenticated users)

**Request Body** (Anonymous):
```json
{
  "deviceId": "abc123-...",
  "startTime": "2025-11-05T14:00:00.000Z",
  "endTime": "2025-11-05T14:15:00.000Z",
  "vMax": 145.5,
  "distance": 12.5,
  "duration": 900,
  "timers": {
    "0-60": 4.5,
    "0-100": 9.2,
    "1/4 mile": 12.8
  },
  "onIncline": false
}
```

**Request Body** (Authenticated):
```json
{
  "carId": 1,
  "startTime": "2025-11-05T14:00:00.000Z",
  "endTime": "2025-11-05T14:15:00.000Z",
  "vMax": 145.5,
  "distance": 12.5,
  "duration": 900,
  "timers": {
    "0-60": 4.5,
    "0-100": 9.2,
    "1/4 mile": 12.8
  },
  "onIncline": false
}
```

**Headers** (if authenticated):
```
Authorization: Bearer <token>
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "id": 456
}
```

**Notes**:
- For authenticated users, `carId` is required
- For anonymous users, `deviceId` is required
- `timers` is a JSON object with completed performance metrics
- `onIncline` flags sessions performed on significant downhill slopes

---

### GET /api/sessions/:deviceId

Get session history for a device (anonymous users).

**Authentication**: None required

**URL Parameters**:
- `deviceId` (UUID): Device identifier

**Success Response** (200 OK):
```json
{
  "sessions": [
    {
      "id": 1,
      "deviceId": "abc123-...",
      "startTime": "2025-11-05T14:00:00.000Z",
      "endTime": "2025-11-05T14:15:00.000Z",
      "vMax": 145.5,
      "distance": 12.5,
      "duration": 900,
      "timers": {
        "0-60": 4.5,
        "0-100": 9.2
      },
      "onIncline": 0,
      "timestamp": "2025-11-05T14:15:30.000Z"
    }
  ]
}
```

**Notes**:
- Returns up to 50 most recent sessions
- Ordered by timestamp DESC (newest first)
- `deviceId` must be valid UUID format

---

### GET /api/sessions/:deviceId/all

Get all sessions (user's own + sample data).

**Authentication**: None required

**URL Parameters**:
- `deviceId` (UUID or "SAMPLE-*"): Device identifier

**Success Response** (200 OK):
```json
{
  "sessions": [
    // User's sessions + sample sessions
  ]
}
```

**Notes**:
- Includes both user sessions and sample data
- Used for demonstration purposes
- Limited to 50 sessions

---

### DELETE /api/sessions/sample

Delete all sample sessions from database.

**Authentication**: None required

**Success Response** (200 OK):
```json
{
  "success": true,
  "deleted": 5
}
```

**Notes**:
- Deletes all sessions with deviceId starting with "SAMPLE-"
- User sessions are not affected

---

### DELETE /api/sessions/:deviceId/user

Delete all sessions for a specific device (anonymous user data).

**Authentication**: None required

**URL Parameters**:
- `deviceId` (UUID): Device identifier

**Success Response** (200 OK):
```json
{
  "success": true,
  "deleted": 12
}
```

**Notes**:
- Only deletes sessions for the specified deviceId
- Does not delete sample data

---

### DELETE /api/sessions/all/:confirmToken

Delete ALL session data from database (dangerous operation).

**Authentication**: None required (but requires confirmation token)

**URL Parameters**:
- `confirmToken`: Must be exactly "CONFIRM-DELETE-ALL"

**Success Response** (200 OK):
```json
{
  "success": true,
  "deleted": 150
}
```

**Warning**: This permanently deletes ALL sessions from ALL users. Use with extreme caution.

---

## Error Handling

### Standard Error Response Format

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": ["Additional info"]
}
```

### HTTP Status Codes

- **200 OK**: Request successful
- **201 Created**: Resource created successfully
- **400 Bad Request**: Invalid request data
- **401 Unauthorized**: Authentication required or invalid
- **403 Forbidden**: Authenticated but not authorized
- **404 Not Found**: Resource not found
- **409 Conflict**: Resource already exists
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server error

### Common Error Codes

- `NO_TOKEN`: Authentication token missing
- `INVALID_TOKEN`: Token expired or invalid
- `INVALID_CREDENTIALS`: Wrong email/password
- `USER_EXISTS`: Email already registered
- `ACCOUNT_SUSPENDED`: Account not active
- `FORBIDDEN`: Access denied to resource
- `PRIVATE_PROFILE`: Profile is not public
- `INVALID_PASSWORD`: Password incorrect

---

## Rate Limiting

SpeedoPage implements rate limiting to prevent abuse:

- **Window**: 60 seconds (1 minute)
- **Max Requests**: 100 per window per IP address
- **Cleanup**: Old rate limit entries purged every 5 minutes

**Rate Limit Response** (429 Too Many Requests):
```json
{
  "error": "Too many requests. Please try again later."
}
```

**Best Practices**:
- Batch operations when possible
- Implement exponential backoff on 429 responses
- Cache responses when appropriate

---

## Data Models

### User Model

```typescript
interface User {
  id: number;
  email: string;
  passwordHash: string;          // bcrypt hash
  displayName: string | null;
  avatarUrl: string | null;
  unitsPreference: 'auto' | 'kmh' | 'mph';
  isEmailVerified: boolean;
  isPublicProfile: boolean;
  accountStatus: 'active' | 'suspended' | 'deleted';
  createdAt: string;              // ISO 8601
  lastLoginAt: string | null;     // ISO 8601
}
```

### Car Model

```typescript
interface Car {
  id: number;
  userId: number;
  name: string;
  make: string | null;
  model: string | null;
  year: number | null;
  trim: string | null;
  color: string | null;
  photoUrl: string | null;
  weight: number | null;          // kg
  horsepower: number | null;
  modifications: string | null;
  drivetrain: string | null;      // 'FWD', 'RWD', 'AWD', '4WD'
  transmission: string | null;    // 'Manual', 'Automatic', 'DCT', 'CVT'
  notes: string | null;
  isActive: 0 | 1;
  createdAt: string;              // ISO 8601
  updatedAt: string;              // ISO 8601
}
```

### Session Model

```typescript
interface Session {
  id: number;
  userId: number | null;          // null for anonymous
  carId: number | null;           // null for anonymous
  deviceId: string | null;        // UUID for anonymous
  startTime: string;              // ISO 8601
  endTime: string;                // ISO 8601
  vMax: number;                   // km/h
  distance: number;               // km
  duration: number;               // seconds
  timers: object;                 // JSON: { "0-60": 4.5, ... }
  onIncline: 0 | 1;               // downhill flag
  createdAt: string;              // ISO 8601
}
```

### Timers Object Structure

```typescript
interface Timers {
  // Acceleration timers (mph)
  "0-60"?: number;        // seconds
  "0-100"?: number;
  "0-150"?: number;
  "0-200"?: number;
  "30-60"?: number;
  "60-120"?: number;
  "60-130"?: number;
  "100-150"?: number;

  // Acceleration timers (km/h)
  "0-100kmh"?: number;
  "0-160kmh"?: number;
  "0-250kmh"?: number;
  "0-320kmh"?: number;
  "100-200kmh"?: number;
  "160-240kmh"?: number;

  // Distance timers
  "1/8 mile"?: number;
  "1/4 mile"?: number;
  "1/2 mile"?: number;
  "standing mile"?: number;
}
```

### Speed Log Model (Legacy)

```typescript
interface SpeedLog {
  id: number;
  deviceId: string;
  speed: number;                  // km/h
  timestamp: string;              // ISO 8601
}
```

---

## Security Considerations

### Password Security

- Passwords hashed with **bcrypt** (10 salt rounds)
- Minimum 8 characters required
- Must contain letters and numbers
- Maximum 128 characters to prevent DoS

### JWT Security

- Tokens signed with `JWT_SECRET` (set via environment variable)
- 24-hour expiration
- Tokens include: userId, email, displayName
- No sensitive data (passwords, hashes) in tokens

### SQL Injection Protection

- All queries use **parameterized statements**
- User input never concatenated into SQL
- Express-validator sanitizes input

### Rate Limiting

- 100 requests per minute per IP
- Applies to all endpoints
- In-memory implementation (scales to Redis in production)

### Input Validation

- Express-validator on all input endpoints
- Type checking (integers, emails, URLs)
- Length limits on all string fields
- Whitelist allowed values for enums

### Ownership Verification

- Middleware checks user owns resource before modification
- Database queries include userId in WHERE clause
- 403 Forbidden returned for unauthorized access

---

## Environment Variables

Configure SpeedoPage via environment variables:

```bash
# Server
PORT=3000                    # Server port (default: 3000)

# JWT
JWT_SECRET=your-secret-key   # JWT signing secret (CHANGE IN PRODUCTION!)
JWT_EXPIRES_IN=24h           # Token lifetime (default: 24h)

# Database
DB_PATH=./speeds.db          # SQLite database path
```

**Production Recommendations**:
- Generate cryptographically random `JWT_SECRET` (32+ characters)
- Use environment-specific `.env` files
- Never commit secrets to version control

---

## Example Client Usage

### JavaScript Fetch Example

```javascript
// Register a new user
const register = async (email, password, displayName) => {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password, displayName })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  const data = await response.json();
  localStorage.setItem('token', data.token);
  return data.user;
};

// Authenticated request
const getCars = async () => {
  const token = localStorage.getItem('token');

  const response = await fetch('/api/cars', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch cars');
  }

  const data = await response.json();
  return data.cars;
};

// Save a session (authenticated)
const saveSession = async (sessionData) => {
  const token = localStorage.getItem('token');

  const response = await fetch('/api/save-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(sessionData)
  });

  if (!response.ok) {
    throw new Error('Failed to save session');
  }

  return await response.json();
};
```

---

## Changelog

### v2.0.0 (2025-11-05)

**Added**:
- User authentication system (register, login, JWT)
- Car management endpoints (CRUD operations)
- User profile endpoints
- Enhanced session tracking with user/car linkage
- Rate limiting on all endpoints
- Password security validation
- Ownership verification middleware

**Changed**:
- `/api/save-session` now supports both authenticated and anonymous users
- Sessions table includes userId and carId fields

**Deprecated**:
- `/api/log-speed` (still functional but sessions are preferred)

---

## Support

For API issues, bugs, or feature requests:

- **GitHub Issues**: [Report a bug](https://github.com/yourusername/speedopage/issues)
- **Documentation**: See `DEVELOPER_GUIDE.md` for implementation details
- **Email**: support@speedopage.example

---

**SpeedoPage API v2.0.0**
*Last Updated: November 5, 2025*
