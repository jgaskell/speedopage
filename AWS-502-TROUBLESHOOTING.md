# AWS 502 Bad Gateway - Troubleshooting Guide

## What 502 Means
Nginx is running but **cannot connect to your Node.js server**. The Node.js app is either:
1. Not running
2. Running on the wrong port
3. Crashed during startup
4. Blocked by firewall

## Step 1: Check if Node.js is Running

SSH into AWS and run:

```bash
# Check if Node is running
ps aux | grep node

# Check what's listening on port 3000
lsof -i :3000

# OR use netstat
netstat -tlnp | grep 3000
```

**Expected:** You should see a node process listening on port 3000

**If nothing:** The server isn't running - go to Step 2

## Step 2: Check Server Logs

### If using PM2:
```bash
pm2 logs speedopage --lines 50
```

### If using systemd:
```bash
sudo journalctl -u speedopage -n 50 --no-pager
```

### If running manually, check:
```bash
# Check if there are any logs
cat /path/to/speedopage/server.log

# Or check if there's a crash log
ls -la /path/to/speedopage/*.log
```

Look for errors like:
- `Error: listen EADDRINUSE` - Port already in use
- `Error opening database` - Database issue
- `MODULE_NOT_FOUND` - Missing dependencies
- `SyntaxError` - Code syntax error

## Step 3: Try Starting the Server Manually

```bash
cd /path/to/your/speedopage

# First, make sure dependencies are installed
npm install

# Try starting manually to see errors
node server.js
```

**If you see errors:**
- Database errors → Run migration first: `node migrate-db.js`
- Module not found → Run `npm install`
- Port in use → Kill the process: `lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill`

**If it starts successfully:**
- You should see: `SpeedoPage running on HTTPS port 3000`
- Stop it (Ctrl+C) and restart with your process manager

## Step 4: Restart with Process Manager

### Using PM2:
```bash
# Check status
pm2 status

# Restart
pm2 restart speedopage

# Check logs
pm2 logs speedopage
```

### Using systemd:
```bash
# Check status
sudo systemctl status speedopage

# Restart
sudo systemctl restart speedopage

# Check logs
sudo journalctl -u speedopage -f
```

## Step 5: Check Nginx Configuration

```bash
# Test nginx config
sudo nginx -t

# Check what nginx is proxying to
cat /etc/nginx/sites-enabled/speedopage  # or your config file
```

**Expected nginx config should have:**
```nginx
location / {
    proxy_pass http://localhost:3000;  # or https://localhost:3000
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

If config changed, reload nginx:
```bash
sudo nginx -t && sudo nginx -s reload
```

## Step 6: Check SSL Certificates

If the server expects HTTPS but certs are missing:

```bash
ls -la /path/to/speedopage/cert.pem
ls -la /path/to/speedopage/key.pem
```

**If missing:** The server will fall back to HTTP mode automatically. Check server.js output to confirm:
- With certs: `HTTPS enabled with SSL certificates`
- Without certs: `SSL certificates not found or invalid, falling back to HTTP`

## Common Issues & Solutions

### Issue 1: "Database error" on startup
**Solution:** Run the migration
```bash
node migrate-db.js
```

### Issue 2: Port 3000 already in use
**Solution:** Kill the old process
```bash
lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

### Issue 3: Module not found
**Solution:** Reinstall dependencies
```bash
rm -rf node_modules package-lock.json
npm install
```

### Issue 4: Permission denied on port 3000
**Solution:** Either:
- Run as root (not recommended)
- Use a port > 1024 and update nginx config
- Set up port forwarding with iptables

### Issue 5: Server starts but nginx still 502
**Solution:** Check nginx can connect to localhost:3000
```bash
# Test from the server itself
curl -k http://localhost:3000/

# If that works but nginx doesn't, check nginx error logs
sudo tail -f /var/log/nginx/error.log
```

## Quick Fix Workflow

```bash
# 1. Go to app directory
cd /path/to/speedopage

# 2. Run migration
node migrate-db.js

# 3. Kill any existing node processes
pkill -9 node

# 4. Start fresh (choose one):

# Option A: PM2
pm2 start server.js --name speedopage
pm2 save

# Option B: systemd
sudo systemctl restart speedopage

# Option C: Manual (for testing)
node server.js

# 5. Verify it's running
curl -k http://localhost:3000/

# 6. Check browser
# Go to https://speedo.blownbytwins.co.uk
```

## Still Not Working?

Run this diagnostic and send me the output:

```bash
# Diagnostic script
echo "=== Node Process ==="
ps aux | grep node
echo ""
echo "=== Port 3000 ==="
lsof -i :3000
echo ""
echo "=== Server Files ==="
ls -la /path/to/speedopage/server.js
ls -la /path/to/speedopage/*.pem
echo ""
echo "=== Try starting ==="
cd /path/to/speedopage && node server.js 2>&1 | head -20
```

The output will show exactly what's wrong!
