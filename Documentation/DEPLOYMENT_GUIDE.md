# SpeedoPage v2.0 - Deployment Guide

## Overview

This comprehensive guide covers deploying SpeedoPage to various environments: local development, Raspberry Pi, AWS, and other cloud platforms. It includes setup instructions, SSL configuration, database migration, and troubleshooting.

---

## Table of Contents

1. [Local Development Setup](#local-development-setup)
2. [Raspberry Pi Deployment](#raspberry-pi-deployment)
3. [AWS Deployment](#aws-deployment)
4. [Other Cloud Platforms](#other-cloud-platforms)
5. [SSL Certificate Setup](#ssl-certificate-setup)
6. [Database Migration](#database-migration)
7. [Environment Configuration](#environment-configuration)
8. [Process Management](#process-management)
9. [Monitoring and Logging](#monitoring-and-logging)
10. [Backup and Recovery](#backup-and-recovery)
11. [Troubleshooting](#troubleshooting)

---

## Local Development Setup

### Prerequisites

- Node.js 14+ (recommend 18 LTS or newer)
- npm (comes with Node.js)
- Git
- Modern web browser
- Text editor or IDE

### Installation Steps

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/speedopage.git
   cd speedopage
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Initialize database** (if starting fresh):
   ```bash
   # Database will be created automatically on first run
   # Or run migration for v2.0 schema:
   node migrate-v2-user-accounts.js
   ```

4. **Start the development server**:
   ```bash
   npm start
   ```

5. **Access the application**:
   - Open browser to `http://localhost:3000`
   - For GPS to work, use `https://localhost:3000` (see SSL setup below)

### Development Environment Variables

Create a `.env` file in the project root:

```bash
# Server
PORT=3000

# JWT
JWT_SECRET=dev-secret-change-in-production-at-least-32-characters
JWT_EXPIRES_IN=24h

# Database
DB_PATH=./speeds.db

# Development
NODE_ENV=development
```

### Hot Reload (Optional)

For automatic restarts during development:

```bash
# Install nodemon globally
npm install -g nodemon

# Run with nodemon
nodemon server.js
```

---

## Raspberry Pi Deployment

Perfect for in-vehicle deployment or home server.

### Hardware Requirements

- **Raspberry Pi 4** (2GB+ RAM recommended)
- **MicroSD Card** (16GB+ Class 10)
- **Power Supply** (Official 5V 3A recommended)
- **Case** (optional but recommended for vehicle use)
- **GPS Module** (optional - can use smartphone GPS)

### OS Installation

1. **Install Raspberry Pi OS Lite**:
   - Download Raspberry Pi Imager
   - Flash Raspberry Pi OS Lite (64-bit) to SD card
   - Enable SSH during imaging

2. **Initial Setup**:
   ```bash
   # SSH into Pi
   ssh pi@raspberrypi.local
   # Default password: raspberry

   # Update system
   sudo apt update
   sudo apt upgrade -y

   # Change default password
   passwd
   ```

### Install Node.js

```bash
# Install Node.js 18 LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should be v18.x
npm --version
```

### Install SpeedoPage

```bash
# Create app directory
sudo mkdir -p /var/lib/speedopage
sudo mkdir -p /opt/speedopage

# Clone repository
cd /opt/speedopage
sudo git clone https://github.com/yourusername/speedopage.git .

# Install dependencies
sudo npm install --production

# Set ownership
sudo chown -R pi:pi /opt/speedopage
sudo chown -R pi:pi /var/lib/speedopage
```

### Configure Database

```bash
# Update server.js to use persistent database location
# Edit line ~82 to:
# const db = new sqlite3.Database('/var/lib/speedopage/speeds.db');

# Or use environment variable
echo "DB_PATH=/var/lib/speedopage/speeds.db" | sudo tee /opt/speedopage/.env
```

### Run Migration

```bash
cd /opt/speedopage
DB_PATH=/var/lib/speedopage/speeds.db node migrate-v2-user-accounts.js
```

### Set Up Systemd Service

Create `/etc/systemd/system/speedopage.service`:

```ini
[Unit]
Description=SpeedoPage GPS Speedometer
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/opt/speedopage
Environment="NODE_ENV=production"
Environment="PORT=3000"
Environment="DB_PATH=/var/lib/speedopage/speeds.db"
Environment="JWT_SECRET=CHANGE-THIS-TO-RANDOM-SECRET"
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=speedopage

[Install]
WantedBy=multi-user.target
```

**Enable and start service**:

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable on boot
sudo systemctl enable speedopage

# Start service
sudo systemctl start speedopage

# Check status
sudo systemctl status speedopage

# View logs
sudo journalctl -u speedopage -f
```

### Configure WiFi Access Point (Optional)

Create a WiFi hotspot so phones can connect directly to the Pi:

```bash
# Install packages
sudo apt install -y hostapd dnsmasq

# Configure hostapd
sudo nano /etc/hostapd/hostapd.conf
```

Add configuration:
```
interface=wlan0
driver=nl80211
ssid=SpeedoPage
hw_mode=g
channel=6
wmm_enabled=0
macaddr_acl=0
auth_algs=1
ignore_broadcast_ssid=0
wpa=2
wpa_passphrase=YourSecurePassword
wpa_key_mgmt=WPA-PSK
wpa_pairwise=TKIP
rsn_pairwise=CCMP
```

Enable and start:
```bash
sudo systemctl unmask hostapd
sudo systemctl enable hostapd
sudo systemctl start hostapd
```

Connect to `SpeedoPage` WiFi and navigate to `https://raspberrypi.local:3000`

---

## AWS Deployment

Deploy to Amazon Web Services for scalable cloud hosting.

### Prerequisites

- AWS Account
- AWS CLI installed and configured
- Basic knowledge of EC2, security groups

### EC2 Instance Setup

1. **Launch EC2 Instance**:
   - AMI: Amazon Linux 2023
   - Instance Type: t2.micro (free tier) or t3.small
   - Storage: 20GB gp3
   - Security Group:
     - SSH (22) from your IP
     - HTTPS (443) from 0.0.0.0/0
     - HTTP (80) from 0.0.0.0/0 (redirect to HTTPS)

2. **Connect to instance**:
   ```bash
   ssh -i your-key.pem ec2-user@your-instance-ip
   ```

### Install Node.js on Amazon Linux

```bash
# Update system
sudo yum update -y

# Install Node.js 18
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Verify
node --version
npm --version
```

### Set Up Application User

```bash
# Create dedicated user
sudo useradd -r -s /bin/bash -d /home/nodeapp -m nodeapp

# Create directories
sudo mkdir -p /home/nodeapp/apps/speedopage
sudo mkdir -p /var/lib/speedopage
sudo mkdir -p /var/log/speedopage

# Set ownership
sudo chown -R nodeapp:nodeapp /home/nodeapp
sudo chown -R nodeapp:nodeapp /var/lib/speedopage
sudo chown -R nodeapp:nodeapp /var/log/speedopage
```

### Deploy Application

```bash
# Switch to nodeapp user
sudo su - nodeapp

# Navigate to app directory
cd /home/nodeapp/apps/speedopage

# Clone repository (or upload files)
git clone https://github.com/yourusername/speedopage.git .

# Install dependencies
npm install --production

# Set up environment variables
cat > .env << EOF
NODE_ENV=production
PORT=3000
DB_PATH=/var/lib/speedopage/speeds.db
JWT_SECRET=$(openssl rand -base64 32)
JWT_EXPIRES_IN=24h
EOF

# Secure .env file
chmod 600 .env
```

### Run Database Migration

```bash
# As nodeapp user
cd /home/nodeapp/apps/speedopage
DB_PATH=/var/lib/speedopage/speeds.db node migrate-v2-user-accounts.js
```

### Install PM2 Process Manager

```bash
# As nodeapp user
npm install -g pm2

# Start application
pm2 start server.js --name speedopage

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
# Copy and run the command it provides with sudo
```

### Configure PM2 Startup

```bash
# Exit from nodeapp user
exit

# As ec2-user, run the command PM2 provided
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u nodeapp --hp /home/nodeapp

# Verify service
sudo systemctl status pm2-nodeapp
```

### Set Up Nginx Reverse Proxy

```bash
# Install Nginx
sudo yum install -y nginx

# Create Nginx configuration
sudo nano /etc/nginx/conf.d/speedopage.conf
```

Add configuration:
```nginx
upstream speedopage {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name your-domain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL certificates (from Let's Encrypt or AWS Certificate Manager)
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;

    # Proxy settings
    location / {
        proxy_pass http://speedopage;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Static files caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico)$ {
        proxy_pass http://speedopage;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Start Nginx:
```bash
sudo systemctl enable nginx
sudo systemctl start nginx
```

### Install SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo yum install -y certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

### Configure Firewall

```bash
# Allow HTTP/HTTPS through firewall
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

---

## Other Cloud Platforms

### DigitalOcean

Similar to AWS deployment:
1. Create Droplet (Ubuntu 22.04)
2. Follow Ubuntu deployment steps
3. Use DigitalOcean's floating IP for DNS
4. Configure Cloud Firewall

### Google Cloud Platform (GCP)

1. Create Compute Engine instance
2. Follow Ubuntu deployment steps
3. Configure VPC firewall rules
4. Use Cloud DNS for domain

### Heroku

```bash
# Install Heroku CLI
# Login
heroku login

# Create app
heroku create speedopage

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=$(openssl rand -base64 32)

# Deploy
git push heroku main

# Open app
heroku open
```

**Note**: Heroku's ephemeral filesystem means database must be external (PostgreSQL addon recommended).

### Docker Deployment

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install --production

# Bundle app source
COPY . .

# Create data directory
RUN mkdir -p /data

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/data/speeds.db

# Expose port
EXPOSE 3000

# Start app
CMD ["node", "server.js"]
```

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  speedopage:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - JWT_SECRET=${JWT_SECRET}
      - DB_PATH=/data/speeds.db
    volumes:
      - speedopage-data:/data
    restart: unless-stopped

volumes:
  speedopage-data:
```

Deploy:
```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

---

## SSL Certificate Setup

GPS requires HTTPS. Here are multiple options:

### Option 1: Self-Signed Certificate (Development)

```bash
# Generate certificate
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

# Answer prompts (use localhost for Common Name)

# Files created: key.pem, cert.pem
# Place in project root

# server.js will automatically use them if present
```

**Note**: Browsers will show security warning. Click "Advanced" → "Proceed to localhost".

### Option 2: Let's Encrypt (Production)

**Prerequisites**: Domain name pointing to your server

```bash
# Install Certbot
sudo apt install -y certbot  # Ubuntu/Debian
sudo yum install -y certbot  # Amazon Linux/CentOS

# Stop application temporarily
sudo systemctl stop speedopage  # or sudo pm2 stop speedopage

# Obtain certificate
sudo certbot certonly --standalone -d your-domain.com

# Certificates saved to:
# /etc/letsencrypt/live/your-domain.com/fullchain.pem
# /etc/letsencrypt/live/your-domain.com/privkey.pem

# Update server.js to use Let's Encrypt certs:
const httpsOptions = {
  key: fs.readFileSync('/etc/letsencrypt/live/your-domain.com/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/your-domain.com/fullchain.pem')
};

# Auto-renewal (already configured by Certbot)
sudo certbot renew --dry-run
```

### Option 3: Cloudflare (Free)

1. Add site to Cloudflare
2. Update nameservers at domain registrar
3. Enable SSL (Flexible or Full)
4. Use Cloudflare Origin Certificate in server

### Option 4: Reverse Proxy (Nginx/Apache)

Let Nginx/Apache handle SSL, proxy to Node.js on HTTP:

```nginx
# Nginx handles SSL, proxies to Node.js on port 3000
server {
    listen 443 ssl;
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        # ... proxy headers
    }
}
```

---

## Database Migration

### Migrating from v1.x to v2.0

**Important**: Backup your database first!

```bash
# Backup database
cp speeds.db speeds.db.backup.$(date +%Y%m%d)

# Run migration script
node migrate-v2-user-accounts.js

# Expected output:
# ✓ Database opened successfully
# Found 2 existing tables: speeds, sessions
# Creating users table...
# Creating cars table...
# Creating enhanced sessions table...
# ✓ Migrated 150 sessions
# ✅ Migration completed successfully!

# Verify migration
sqlite3 speeds.db ".tables"
# Should show: users, cars, sessions, achievements, follows, password_resets
```

### Dry Run (Test Without Changes)

```bash
# Test migration without making changes
node migrate-v2-user-accounts.js --dry-run

# Review output to ensure no errors
```

### Force Re-Run (Dangerous!)

```bash
# WARNING: This will drop and recreate tables
node migrate-v2-user-accounts.js --force
```

### Manual Migration Steps

If automated migration fails:

```sql
-- Backup sessions
CREATE TABLE sessions_backup AS SELECT * FROM sessions;

-- Create v2.0 schema (see migrate-v2-user-accounts.js for full SQL)

-- Migrate data manually
INSERT INTO sessions (deviceId, startTime, endTime, vMax, distance, duration, timers, onIncline, createdAt)
SELECT deviceId, startTime, endTime, vMax, distance, duration, timers,
       COALESCE(onIncline, 0),
       COALESCE(timestamp, createdAt, datetime('now'))
FROM sessions_backup;
```

### Database Schema Verification

```bash
# Check schema
sqlite3 speeds.db ".schema users"
sqlite3 speeds.db ".schema cars"
sqlite3 speeds.db ".schema sessions"

# Check indexes
sqlite3 speeds.db ".indexes"

# Count records
sqlite3 speeds.db "SELECT
  (SELECT COUNT(*) FROM users) as users,
  (SELECT COUNT(*) FROM cars) as cars,
  (SELECT COUNT(*) FROM sessions) as sessions"
```

---

## Environment Configuration

### Environment Variables

Create `.env` file (never commit to git!):

```bash
# Server Configuration
NODE_ENV=production              # production, development, test
PORT=3000                        # Server port

# JWT Authentication
JWT_SECRET=your-random-secret-at-least-32-characters-long
JWT_EXPIRES_IN=24h              # Token lifetime (e.g., 1h, 24h, 7d)

# Database
DB_PATH=/var/lib/speedopage/speeds.db  # Database file path

# Logging (optional)
LOG_LEVEL=info                   # debug, info, warn, error
LOG_FILE=/var/log/speedopage/app.log

# Rate Limiting (optional)
RATE_LIMIT_WINDOW=60000          # 1 minute in ms
MAX_REQUESTS=100                 # Requests per window
```

### Loading Environment Variables

**Option 1: dotenv package**

```bash
npm install dotenv
```

In `server.js` (at very top):
```javascript
require('dotenv').config();

// Now use process.env.JWT_SECRET, etc.
```

**Option 2: Systemd environment file**

Create `/etc/systemd/system/speedopage.service.d/override.conf`:
```ini
[Service]
EnvironmentFile=/opt/speedopage/.env
```

**Option 3: PM2 ecosystem file**

Create `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'speedopage',
    script: './server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_file: '.env'
  }]
};
```

Start with:
```bash
pm2 start ecosystem.config.js
```

### Security Best Practices

1. **Generate Strong JWT Secret**:
   ```bash
   openssl rand -base64 32
   ```

2. **Restrict .env Permissions**:
   ```bash
   chmod 600 .env
   chown nodeapp:nodeapp .env
   ```

3. **Never Commit Secrets**:
   Add to `.gitignore`:
   ```
   .env
   .env.*
   !.env.example
   ```

4. **Use Different Secrets Per Environment**:
   - Development: Dev secret
   - Staging: Staging secret
   - Production: Strong production secret

---

## Process Management

### PM2 (Recommended)

**Install**:
```bash
npm install -g pm2
```

**Start application**:
```bash
pm2 start server.js --name speedopage
```

**Common commands**:
```bash
pm2 list                    # List all processes
pm2 status                  # Same as list
pm2 logs speedopage         # View logs
pm2 logs speedopage --lines 100  # Last 100 lines
pm2 restart speedopage      # Restart app
pm2 stop speedopage         # Stop app
pm2 delete speedopage       # Remove from PM2
pm2 monit                   # Monitor resources
pm2 save                    # Save current list
pm2 resurrect               # Restore saved list
```

**Startup script**:
```bash
pm2 startup
# Run the command it provides with sudo
pm2 save
```

**Update application**:
```bash
cd /path/to/speedopage
git pull
npm install
pm2 restart speedopage
```

### Systemd (Alternative)

See Raspberry Pi section for systemd service file example.

**Common commands**:
```bash
sudo systemctl start speedopage
sudo systemctl stop speedopage
sudo systemctl restart speedopage
sudo systemctl status speedopage
sudo systemctl enable speedopage   # Start on boot
sudo systemctl disable speedopage  # Don't start on boot
sudo journalctl -u speedopage -f   # View logs
```

### Docker (Alternative)

See Docker deployment section above.

**Common commands**:
```bash
docker-compose up -d        # Start
docker-compose down         # Stop
docker-compose logs -f      # View logs
docker-compose restart      # Restart
docker-compose pull         # Update images
```

---

## Monitoring and Logging

### Application Logs

**PM2 logs**:
```bash
pm2 logs speedopage --lines 200
pm2 logs speedopage --err      # Only errors
pm2 flush speedopage           # Clear logs
```

**Systemd logs**:
```bash
sudo journalctl -u speedopage -f
sudo journalctl -u speedopage --since "1 hour ago"
sudo journalctl -u speedopage -p err  # Only errors
```

### Log Rotation

**For PM2**, install pm2-logrotate:
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

**For Systemd**, logs auto-rotate via journald.

**Custom log rotation** (`/etc/logrotate.d/speedopage`):
```
/var/log/speedopage/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 nodeapp nodeapp
    sharedscripts
    postrotate
        systemctl reload speedopage > /dev/null 2>&1 || true
    endscript
}
```

### Monitoring Tools

**1. PM2 Plus (formerly Keymetrics)**:
- Real-time monitoring
- Error tracking
- Performance metrics
- Free tier available

```bash
pm2 link <secret> <public>  # Get keys from pm2.io
```

**2. New Relic**:
```bash
npm install newrelic
# Configure with license key
```

**3. CloudWatch (AWS)**:
- EC2 metrics
- Custom application metrics
- Log aggregation

**4. Basic health check**:

Create `health.js`:
```javascript
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/',
  method: 'GET',
  timeout: 5000
};

const req = http.request(options, (res) => {
  process.exit(res.statusCode === 200 ? 0 : 1);
});

req.on('error', () => process.exit(1));
req.on('timeout', () => {
  req.destroy();
  process.exit(1);
});

req.end();
```

Run with cron:
```cron
*/5 * * * * /usr/bin/node /opt/speedopage/health.js || systemctl restart speedopage
```

---

## Backup and Recovery

### Database Backup

**Automated daily backup**:

Create `/usr/local/bin/backup-speedopage.sh`:
```bash
#!/bin/bash

BACKUP_DIR="/var/backups/speedopage"
DB_PATH="/var/lib/speedopage/speeds.db"
DATE=$(date +%Y%m%d-%H%M%S)

mkdir -p $BACKUP_DIR

# SQLite backup (safe while running)
sqlite3 $DB_PATH ".backup '$BACKUP_DIR/speeds-$DATE.db'"

# Compress
gzip "$BACKUP_DIR/speeds-$DATE.db"

# Keep only last 30 days
find $BACKUP_DIR -name "speeds-*.db.gz" -mtime +30 -delete

echo "Backup completed: speeds-$DATE.db.gz"
```

Make executable and add to cron:
```bash
sudo chmod +x /usr/local/bin/backup-speedopage.sh

# Add to crontab (daily at 2 AM)
sudo crontab -e
0 2 * * * /usr/local/bin/backup-speedopage.sh >> /var/log/speedopage-backup.log 2>&1
```

### Manual Backup

```bash
# Stop application first (for consistency)
sudo systemctl stop speedopage

# Backup database
cp /var/lib/speedopage/speeds.db /backup/location/speeds-backup-$(date +%Y%m%d).db

# Backup application files
tar -czf /backup/location/speedopage-app-$(date +%Y%m%d).tar.gz /opt/speedopage

# Start application
sudo systemctl start speedopage
```

### Restore from Backup

```bash
# Stop application
sudo systemctl stop speedopage

# Restore database
cp /backup/location/speeds-backup-20251105.db /var/lib/speedopage/speeds.db

# Set permissions
sudo chown nodeapp:nodeapp /var/lib/speedopage/speeds.db
sudo chmod 644 /var/lib/speedopage/speeds.db

# Start application
sudo systemctl start speedopage

# Verify
sudo systemctl status speedopage
```

### Disaster Recovery

**Full system restore**:
1. Deploy fresh instance
2. Install dependencies
3. Restore application files from backup
4. Restore database from backup
5. Restore .env file (from secure location)
6. Configure services (PM2/systemd)
7. Test application

**Database corruption recovery**:
```bash
# Check for corruption
sqlite3 speeds.db "PRAGMA integrity_check"

# If corrupted, try to recover
sqlite3 speeds.db ".dump" | sqlite3 recovered.db

# Replace if recovery successful
mv recovered.db speeds.db
```

---

## Troubleshooting

### Server Won't Start

**Check logs**:
```bash
# PM2
pm2 logs speedopage --err

# Systemd
sudo journalctl -u speedopage -n 50

# Check Node.js directly
cd /opt/speedopage
node server.js
```

**Common issues**:

1. **Port already in use**:
   ```bash
   # Find process using port 3000
   sudo lsof -i :3000
   # Kill it
   sudo kill -9 <PID>
   ```

2. **Database locked**:
   ```bash
   # Check for other processes
   fuser /var/lib/speedopage/speeds.db
   # Kill if found
   sudo kill <PID>
   ```

3. **Permission denied**:
   ```bash
   # Fix ownership
   sudo chown -R nodeapp:nodeapp /opt/speedopage
   sudo chown -R nodeapp:nodeapp /var/lib/speedopage
   ```

4. **Missing dependencies**:
   ```bash
   cd /opt/speedopage
   npm install
   ```

### GPS Not Working

**Client-side issues**:
1. Check HTTPS is enabled (GPS requires secure context)
2. Check browser location permissions granted
3. Try on different device/browser
4. Go outside for better signal

**Server-side**: GPS is client-side only, no server troubleshooting needed.

### Authentication Issues

**JWT token issues**:
```bash
# Verify JWT_SECRET is set
echo $JWT_SECRET  # Should not be empty

# Regenerate secret
openssl rand -base64 32 > /opt/speedopage/.jwt_secret

# Update .env
JWT_SECRET=$(cat /opt/speedopage/.jwt_secret)
```

**Database issues**:
```sql
-- Check users table exists
sqlite3 speeds.db ".tables"

-- Check user can login
sqlite3 speeds.db "SELECT id, email FROM users LIMIT 5;"
```

### Performance Issues

**High CPU**:
```bash
# Check PM2 monitoring
pm2 monit

# Check system resources
top
htop
```

**High memory**:
```bash
# PM2 restart on memory threshold
pm2 start server.js --max-memory-restart 500M
```

**Slow database queries**:
```sql
-- Enable query logging
sqlite3 speeds.db
.log stdout
-- Run queries and observe performance

-- Check indexes exist
.indexes

-- Add missing indexes if needed
CREATE INDEX idx_sessions_userId ON sessions(userId);
```

### Database Issues

**Corruption**:
```bash
sqlite3 speeds.db "PRAGMA integrity_check"
```

**Too large**:
```bash
# Check size
ls -lh /var/lib/speedopage/speeds.db

# Vacuum (optimize)
sqlite3 speeds.db "VACUUM;"

# Archive old sessions
sqlite3 speeds.db "DELETE FROM sessions WHERE createdAt < date('now', '-1 year');"
```

### SSL Certificate Issues

**Certificate expired**:
```bash
# Check expiration
openssl x509 -in cert.pem -noout -dates

# Renew Let's Encrypt
sudo certbot renew
sudo systemctl restart nginx  # if using Nginx
```

**Browser warning**:
- Self-signed certs always show warning
- Click "Advanced" → "Proceed"
- Or add certificate to browser's trusted CAs

### Network Issues

**Can't connect from external IP**:
1. Check firewall:
   ```bash
   sudo firewall-cmd --list-all
   sudo iptables -L
   ```

2. Check security group (AWS) allows inbound HTTPS

3. Check DNS resolves:
   ```bash
   nslookup your-domain.com
   ```

4. Check port binding:
   ```bash
   sudo netstat -tulpn | grep :3000
   ```

---

## Production Checklist

Before going live:

- [ ] Change JWT_SECRET to strong random value
- [ ] Set NODE_ENV=production
- [ ] Enable HTTPS with valid certificate
- [ ] Configure firewall (only necessary ports open)
- [ ] Set up automated database backups
- [ ] Configure log rotation
- [ ] Enable process monitoring (PM2 or systemd)
- [ ] Set up health checks
- [ ] Test disaster recovery procedure
- [ ] Document your specific deployment configuration
- [ ] Set up monitoring/alerting
- [ ] Update DNS records
- [ ] Test from external network
- [ ] Run security audit
- [ ] Enable rate limiting (already in code)
- [ ] Review and tighten security headers
- [ ] Configure CORS if needed
- [ ] Test mobile device access
- [ ] Verify GPS works over HTTPS

---

## Getting Help

### Resources
- **GitHub Issues**: Report bugs and request features
- **Documentation**: Complete guides in `/Documentation`
- **Logs**: Always check logs first (PM2/systemd)

### Support Channels
- GitHub: https://github.com/yourusername/speedopage
- Discord/Slack: (if available)
- Email: support@speedopage.example

### Reporting Issues

When reporting deployment issues, include:
1. Environment (OS, Node version, deployment method)
2. Error messages (full logs)
3. Steps to reproduce
4. Expected vs actual behavior
5. Configuration (sanitized, no secrets!)

---

## Conclusion

This guide covers comprehensive deployment scenarios for SpeedoPage. Choose the deployment method that best fits your needs:

- **Local**: Quick testing and development
- **Raspberry Pi**: In-vehicle or home server
- **AWS/Cloud**: Scalable production deployment
- **Docker**: Containerized, portable deployment

Always test in a staging environment before deploying to production.

**Happy Deploying!**

---

**SpeedoPage Deployment Guide v2.0.0**
*Last Updated: November 5, 2025*
