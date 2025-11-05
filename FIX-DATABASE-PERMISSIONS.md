# Fix Database Permissions - SQLITE_READONLY Error

## The Problem
```
errno: 8,
code: 'SQLITE_READONLY'
```

The server is running but **cannot write to the database** because of file permissions.

## The Fix

SSH into your AWS server and run:

```bash
# Navigate to the speedopage directory
cd /home/nodeapp/apps/speedopage

# Check current permissions
ls -la speeds.db

# Fix database file permissions
chmod 666 speeds.db

# Fix the directory permissions (SQLite needs to write journal files)
chmod 777 .

# Better: Set proper ownership (replace 'nodeapp' with your process user)
sudo chown nodeapp:nodeapp speeds.db
sudo chown nodeapp:nodeapp .

# If you don't know the user, check who's running PM2:
ps aux | grep PM2 | grep -v grep
```

## Verify the Fix

```bash
# Check permissions
ls -la speeds.db

# Should show something like:
# -rw-rw-rw- 1 nodeapp nodeapp 12288 Nov  4 18:02 speeds.db

# Restart PM2
pm2 restart speedopage

# Watch the logs - should see no more SQLITE_READONLY errors
pm2 logs speedopage --lines 20
```

## Test It Works

```bash
# Test saving a session from command line
curl -k -X POST "https://speedo.blownbytwins.co.uk/api/save-session" \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"SAMPLE-test","startTime":"2025-11-04T15:00:00.000Z","endTime":"2025-11-04T15:00:52.000Z","vMax":318.4,"distance":1.609344,"duration":52,"timers":{},"onIncline":false}'

# Should return: {"success":true,"id":XX}
# NOT: {"error":"Database error"}
```

## Why This Happened

When you pulled the new code with `git pull`, Git doesn't preserve file permissions. The database file likely had restricted permissions that prevented the Node.js process from writing to it.

## Permanent Fix

Add to your deployment script:

```bash
#!/bin/bash
# deploy.sh

cd /home/nodeapp/apps/speedopage

# Pull latest code
git pull

# Run migration
node migrate-db.js

# Fix permissions
chmod 666 speeds.db
chown nodeapp:nodeapp speeds.db

# Restart
pm2 restart speedopage
```

## Alternative: Move Database to Writable Location

If the app directory has restricted permissions, consider moving the database:

```bash
# Create a data directory
sudo mkdir -p /var/lib/speedopage
sudo chown nodeapp:nodeapp /var/lib/speedopage
sudo chmod 755 /var/lib/speedopage

# Move database
mv speeds.db /var/lib/speedopage/

# Update server.js to point to new location:
# const db = new sqlite3.Database('/var/lib/speedopage/speeds.db');

# Restart
pm2 restart speedopage
```
