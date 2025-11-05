# AWS Server Migration Required

## Problem
The AWS server is returning `500 Database error` when trying to save sessions because the database is missing the `onIncline` column.

## Diagnosis
```bash
curl -k -X POST "https://speedo.blownbytwins.co.uk/api/save-session" \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"SAMPLE-test","startTime":"2025-11-04T15:00:00.000Z","endTime":"2025-11-04T15:00:52.000Z","vMax":318.4,"distance":1.609344,"duration":52,"timers":{},"onIncline":false}'

# Returns: {"error":"Database error"}
```

## Solution

SSH into your AWS server and run:

```bash
# Navigate to the speedopage directory
cd /path/to/speedopage

# Run the migration script
node migrate-db.js
```

Expected output:
```
Opening database: /path/to/speedopage/speeds.db
✓ Database opened successfully

Current sessions table schema:
  - id: INTEGER
  - deviceId: TEXT
  - startTime: DATETIME
  - endTime: DATETIME
  - vMax: REAL
  - distance: REAL
  - duration: INTEGER
  - timers: TEXT
  - timestamp: DATETIME

⚠ onIncline column missing - adding now...
✓ Successfully added onIncline column

Updated sessions table schema:
  - id: INTEGER
  - deviceId: TEXT
  - startTime: DATETIME
  - endTime: DATETIME
  - vMax: REAL
  - distance: REAL
  - duration: INTEGER
  - timers: TEXT
  - onIncline: BOOLEAN DEFAULT 0
  - timestamp: DATETIME

✅ Migration complete!
```

## Restart Server (if needed)

If your server is running with a process manager like PM2:
```bash
pm2 restart speedopage
```

Or if running with systemd:
```bash
sudo systemctl restart speedopage
```

Or if running manually, just stop and restart:
```bash
# Stop: Ctrl+C or kill the process
# Start:
npm start
```

## Verification

After migration, test that it works:
```bash
curl -k -X POST "https://speedo.blownbytwins.co.uk/api/save-session" \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"SAMPLE-test","startTime":"2025-11-04T15:00:00.000Z","endTime":"2025-11-04T15:00:52.000Z","vMax":318.4,"distance":1.609344,"duration":52,"timers":{},"onIncline":false}'

# Should return: {"success":true,"id":XX}
```

Then try the test data generation button in the UI - it should work!
