# AWS Production Setup Guide - Complete & Resilient

## Overview
This guide sets up SpeedoPage to run reliably on AWS, survive reboots, and handle updates properly.

---

## Step 1: Initial Setup (Run Once)

### 1.1 Create Application Directory Structure
```bash
# As ec2-user
sudo mkdir -p /var/lib/speedopage
sudo chown nodeapp:nodeapp /var/lib/speedopage
sudo chmod 755 /var/lib/speedopage
```

### 1.2 Set Up Database Location
Move database to persistent location:

```bash
# Switch to nodeapp
sudo su - nodeapp

# Go to app directory
cd /home/nodeapp/apps/speedopage

# Move database to data directory (if it exists)
if [ -f speeds.db ]; then
    mv speeds.db /var/lib/speedopage/
fi

# Create symbolic link
ln -sf /var/lib/speedopage/speeds.db speeds.db

# Verify
ls -la speeds.db
# Should show: speeds.db -> /var/lib/speedopage/speeds.db
```

---

## Step 2: Update server.js to Use Persistent Database

Edit `/home/nodeapp/apps/speedopage/server.js`:

Find this line (around line 82):
```javascript
const db = new sqlite3.Database('speeds.db');
```

Change it to:
```javascript
const db = new sqlite3.Database(process.env.DB_PATH || '/var/lib/speedopage/speeds.db');
```

This allows overriding the database path via environment variable if needed.

---

## Step 3: Run Database Migration

```bash
# As nodeapp user
cd /home/nodeapp/apps/speedopage

# Run migration
node migrate-db.js

# Expected output:
# ✓ Database opened successfully
# ⚠ onIncline column missing - adding now...
# ✓ Successfully added onIncline column
# ✅ Migration complete!
```

---

## Step 4: Start with PM2

```bash
# Still as nodeapp user
cd /home/nodeapp/apps/speedopage

# Start the application
pm2 start server.js --name speedopage

# Save PM2 configuration
pm2 save

# Check it's running
pm2 status

# View logs
pm2 logs speedopage --lines 20

# Should see: "SpeedoPage running on HTTPS port 3000"
```

---

## Step 5: Set Up PM2 to Start on Boot

```bash
# Still as nodeapp user
pm2 startup

# This will output a command like:
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u nodeapp --hp /home/nodeapp

# COPY that command, then exit to ec2-user
exit

# As ec2-user, paste and run the command PM2 gave you:
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u nodeapp --hp /home/nodeapp

# Verify the systemd service was created
sudo systemctl status pm2-nodeapp

# Should show: Active (running)
```

---

## Step 6: Create Deployment Script

Create `/home/nodeapp/deploy-speedopage.sh`:

```bash
#!/bin/bash
# SpeedoPage Deployment Script

set -e  # Exit on error

APP_DIR="/home/nodeapp/apps/speedopage"
DB_DIR="/var/lib/speedopage"

echo "=== SpeedoPage Deployment ==="
echo "Starting deployment at $(date)"
echo ""

# Go to app directory
cd $APP_DIR

# Pull latest code
echo "1. Pulling latest code..."
git pull
echo "   ✓ Code updated"
echo ""

# Install dependencies
echo "2. Installing dependencies..."
npm install --production
echo "   ✓ Dependencies installed"
echo ""

# Run database migration
echo "3. Running database migration..."
node migrate-db.js
echo "   ✓ Migration complete"
echo ""

# Fix permissions (just in case)
echo "4. Fixing permissions..."
chmod 666 $DB_DIR/speeds.db
chmod 775 $DB_DIR
echo "   ✓ Permissions fixed"
echo ""

# Restart PM2
echo "5. Restarting application..."
pm2 restart speedopage
echo "   ✓ Application restarted"
echo ""

# Wait for startup
sleep 2

# Check status
echo "6. Checking status..."
pm2 status speedopage
echo ""

# Show recent logs
echo "7. Recent logs:"
pm2 logs speedopage --lines 10 --nostream
echo ""

echo "=== Deployment Complete ==="
echo "Finished at $(date)"
```

Make it executable:
```bash
chmod +x /home/nodeapp/deploy-speedopage.sh
```

---

## Step 7: Test the Setup

### 7.1 Test the Application
```bash
# Check if server is responding
curl -k https://localhost:3000/

# Test saving a session
curl -k -X POST "https://localhost:3000/api/save-session" \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"test-123","startTime":"2025-11-04T15:00:00.000Z","endTime":"2025-11-04T15:00:52.000Z","vMax":100,"distance":1,"duration":52,"timers":{},"onIncline":false}'

# Should return: {"success":true,"id":XX}
```

### 7.2 Test Reboot Resilience
```bash
# Reboot the server
sudo reboot

# Wait 2 minutes, then SSH back in

# Check PM2 auto-started
sudo su - nodeapp
pm2 status

# Should show speedopage running

# Check application is accessible
curl -k https://localhost:3000/
```

---

## Step 8: Future Deployments

Whenever you want to deploy new code:

```bash
# SSH to AWS
ssh ec2-user@your-aws-server

# Switch to nodeapp
sudo su - nodeapp

# Run deployment script
./deploy-speedopage.sh
```

That's it! The script handles everything: git pull, npm install, migration, restart.

---

## Step 9: Monitoring and Troubleshooting

### View Logs
```bash
# As nodeapp user
pm2 logs speedopage

# Last 50 lines
pm2 logs speedopage --lines 50

# Follow logs in real-time
pm2 logs speedopage -f
```

### Check Status
```bash
pm2 status
pm2 describe speedopage
```

### Restart Application
```bash
pm2 restart speedopage
```

### Check What's Using Port 3000
```bash
sudo netstat -tlnp | grep :3000
```

### Manual Start (if PM2 fails)
```bash
cd /home/nodeapp/apps/speedopage
node server.js
# Press Ctrl+C to stop
```

---

## Step 10: Nginx Configuration

Ensure your nginx config proxies to the right port:

```nginx
# /etc/nginx/sites-available/speedopage

server {
    listen 80;
    server_name speedo.blownbytwins.co.uk;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name speedo.blownbytwins.co.uk;

    ssl_certificate /path/to/your/cert.pem;
    ssl_certificate_key /path/to/your/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Test and reload nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## Complete Checklist

After reboot, verify:

- [ ] PM2 systemd service is active: `sudo systemctl status pm2-nodeapp`
- [ ] Application is running: `pm2 status` (as nodeapp)
- [ ] Port 3000 is listening: `sudo netstat -tlnp | grep :3000`
- [ ] Server responds: `curl -k https://localhost:3000/`
- [ ] Nginx is running: `sudo systemctl status nginx`
- [ ] Website is accessible: Open browser to https://speedo.blownbytwins.co.uk
- [ ] Database is writable: Test saving data via UI
- [ ] Logs are clean: `pm2 logs speedopage` (no errors)

---

## Quick Reference Commands

```bash
# Deploy updates
sudo su - nodeapp
./deploy-speedopage.sh

# View logs
pm2 logs speedopage

# Restart app
pm2 restart speedopage

# Check status
pm2 status

# Check what's on port 3000
sudo netstat -tlnp | grep :3000

# Test database
curl -k -X POST "https://localhost:3000/api/save-session" \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"test","startTime":"2025-11-04T15:00:00Z","endTime":"2025-11-04T15:01:00Z","vMax":100,"distance":1,"duration":60,"timers":{},"onIncline":false}'
```

---

## Expected Output After Setup

### PM2 Status:
```
┌─────┬──────────────┬─────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┬──────────┬──────────┬──────────┬──────────┐
│ id  │ name         │ namespace   │ version │ mode    │ pid      │ uptime │ ↺    │ status    │ cpu      │ mem      │ user     │ watching │
├─────┼──────────────┼─────────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┼──────────┼──────────┼──────────┼──────────┤
│ 0   │ speedopage   │ default     │ 1.2.0   │ fork    │ 12345    │ 5m     │ 0    │ online    │ 0%       │ 45.2mb   │ nodeapp  │ disabled │
└─────┴──────────────┴─────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┴──────────┴──────────┴──────────┴──────────┘
```

### Application Logs:
```
HTTPS enabled with SSL certificates
SpeedoPage running on HTTPS port 3000
```

### Test Request Response:
```json
{"success":true,"id":123}
```

✅ **Setup Complete!**
