# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SpeedoPage is a GPS-based speedometer web application that tracks vehicle speed, performance timers (0-60, quarter-mile, etc.), and logs speed data to a SQLite database. The app automatically detects the user's country and displays speeds in the appropriate units (mph or km/h).

## Architecture

### Backend (server.js)
- Express HTTP server serving static files from `/public`
- SQLite database (`speeds.db`) storing speed logs with deviceId, speed, and timestamp
- Single API endpoint: `POST /api/log-speed` for logging speed data

### Frontend (public/)
- `index.html`: Minimal HTML structure with embedded CSS
- `app.js`: Main application logic handling GPS tracking, speed calculation, and performance timers

### Key Frontend Components
- **GPS tracking**: Uses `navigator.geolocation.watchPosition` with high accuracy
- **Speed calculation**: Haversine formula to compute distance between GPS coordinates, converted to km/h
- **Country detection**: Two-tier system - IP-based on load, then GPS-based for accurate country detection
- **Unit conversion**: Automatically switches between mph (US, GB, MM) and km/h (rest of world)
- **Performance timers**: Tracks acceleration (0-60, 0-100, etc.) and drag racing times (1/8 mile, 1/4 mile, etc.)
- **Device tracking**: Generates UUID for each device, stored in localStorage
- **Data logging**: Sends speed data to backend every 10 seconds

## Common Commands

### Development
```bash
npm start               # Start the server on port 3000 (or PORT env variable)
```

### Dependencies
```bash
npm install            # Install dependencies (express, sqlite3)
```

## Database Schema

The `speeds` table structure:
- `id`: INTEGER PRIMARY KEY AUTOINCREMENT
- `deviceId`: TEXT - unique identifier for each client device
- `speed`: REAL - speed in km/h
- `timestamp`: DATETIME - ISO 8601 timestamp

## Important Notes

- The application stores speeds in km/h internally, regardless of display units
- GPS position updates drive all calculations in `watchPosition()` function (public/app.js:79)
- Timer resets automatically when speed drops below 1 km/h (public/app.js:98-100)
- Country detection is throttled to once per minute to avoid API rate limits (public/app.js:33)
- SSL certificates (`cert.pem`, `key.pem`) are present but not currently used by the HTTP server
