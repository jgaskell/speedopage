# AWS Amazon Linux ARM64 Setup Guide for Node.js Apps

Complete setup guide for deploying Node.js applications on Amazon Linux 2023 ARM64 (t4g.micro) with emphasis on efficiency, speed, and security.

## Initial Server Setup

### 1. Update System
```bash
sudo dnf update -y
sudo dnf install -y git vim htop curl wget
```

### 2. Install Node.js (Latest LTS)
```bash
# Install Node.js 20.x LTS (ARM64 compatible)
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs

# Verify installation
node --version
npm --version
```

### 3. Install PM2 Process Manager
```bash
sudo npm install -g pm2

# Configure PM2 to start on boot
pm2 startup systemd
# Run the command it outputs

# Save PM2 configuration
pm2 save
```

## Web Server Setup (Nginx - Recommended for ARM64)

### 1. Install Nginx
```bash
sudo dnf install -y nginx

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 2. Configure Firewall
```bash
# Allow HTTP and HTTPS
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload

# Verify
sudo firewall-cmd --list-all
```

### 3. Configure Nginx Reverse Proxy

Create `/etc/nginx/conf.d/speedopage.conf`:

```nginx
# HTTP - Redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name speedo.blownbytwins.co.uk;

    # Redirect all HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

# HTTPS - Proxy to Node.js
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name speedo.blownbytwins.co.uk;

    # SSL Configuration (will be added by certbot)
    ssl_certificate /etc/letsencrypt/live/speedo.blownbytwins.co.uk/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/speedo.blownbytwins.co.uk/privkey.pem;

    # SSL Security Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_stapling on;
    ssl_stapling_verify on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Proxy to Node.js on port 3000
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;

    # Access and Error Logs
    access_log /var/log/nginx/speedopage-access.log;
    error_log /var/log/nginx/speedopage-error.log;
}
```

### 4. Test and Reload Nginx
```bash
# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

## SSL Certificate Setup (Let's Encrypt)

### 1. Install Certbot
```bash
sudo dnf install -y certbot python3-certbot-nginx
```

### 2. Obtain SSL Certificate
```bash
# Make sure DNS is pointing to your server first!
sudo certbot --nginx -d speedo.blownbytwins.co.uk

# Follow the prompts
# Choose: Redirect HTTP to HTTPS (option 2)
```

### 3. Auto-Renewal
```bash
# Certbot auto-renewal is configured by default
# Test renewal process
sudo certbot renew --dry-run

# Check renewal timer
sudo systemctl status certbot-renew.timer
```

## Security Hardening

### 1. Configure SSH Security
Edit `/etc/ssh/sshd_config`:
```bash
# Disable root login
PermitRootLogin no

# Disable password authentication (use SSH keys only)
PasswordAuthentication no

# Allow specific user only
AllowUsers ec2-user

# Change SSH port (optional but recommended)
Port 2222
```

Restart SSH:
```bash
sudo systemctl restart sshd
```

**Important**: If you change SSH port, update AWS Security Group!

### 2. Install and Configure Fail2Ban
```bash
sudo dnf install -y fail2ban

# Create local configuration
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local

# Edit /etc/fail2ban/jail.local
sudo vim /etc/fail2ban/jail.local
```

Add this configuration:
```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = 2222
logpath = /var/log/secure

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
logpath = /var/log/nginx/*error.log
```

Start Fail2Ban:
```bash
sudo systemctl start fail2ban
sudo systemctl enable fail2ban
sudo fail2ban-client status
```

### 3. Configure SELinux (Amazon Linux has it enabled)
```bash
# Check SELinux status
getenforce

# Allow Nginx to connect to Node.js
sudo setsebool -P httpd_can_network_connect 1

# Check for SELinux denials
sudo ausearch -m avc -ts recent
```

### 4. Automatic Security Updates
```bash
sudo dnf install -y dnf-automatic

# Configure for automatic security updates
sudo vim /etc/dnf/automatic.conf
```

Set:
```ini
[commands]
upgrade_type = security
apply_updates = yes
```

Enable:
```bash
sudo systemctl enable --now dnf-automatic.timer
```

### 5. System Limits and Performance Tuning

Edit `/etc/security/limits.conf`:
```bash
* soft nofile 65536
* hard nofile 65536
```

Edit `/etc/sysctl.conf`:
```bash
# Network performance
net.core.somaxconn = 4096
net.ipv4.tcp_max_syn_backlog = 4096
net.ipv4.ip_local_port_range = 1024 65535
net.ipv4.tcp_tw_reuse = 1

# Security
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.all.secure_redirects = 0
net.ipv4.icmp_echo_ignore_broadcasts = 1
```

Apply:
```bash
sudo sysctl -p
```

## AWS Security Group Configuration

### Inbound Rules:
```
Type            Protocol    Port Range    Source          Description
SSH             TCP         2222          YOUR_IP/32      SSH (custom port)
HTTP            TCP         80            0.0.0.0/0       HTTP
HTTPS           TCP         443           0.0.0.0/0       HTTPS
```

### Outbound Rules:
```
Type            Protocol    Port Range    Destination     Description
All traffic     All         All           0.0.0.0/0       Allow all outbound
```

## Deploy SpeedoPage Application

### 1. Create Application User
```bash
sudo useradd -m -s /bin/bash nodeapp
sudo su - nodeapp
```

### 2. Clone or Upload Application
```bash
# Create app directory
mkdir -p ~/apps/speedopage
cd ~/apps/speedopage

# Upload your files or clone from git
# For now, copy your files here
```

### 3. Install Dependencies
```bash
cd ~/apps/speedopage
npm install --production
```

### 4. Start with PM2
```bash
pm2 start server.js --name speedopage
pm2 save
pm2 startup
# Run the command it outputs as root
```

### 5. Configure PM2 Monitoring
```bash
# View logs
pm2 logs speedopage

# Monitor
pm2 monit

# Check status
pm2 status
```

## Monitoring and Maintenance

### 1. Setup CloudWatch Agent (AWS)
```bash
sudo dnf install -y amazon-cloudwatch-agent

# Configure CloudWatch
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-config-wizard
```

### 2. Log Rotation
Create `/etc/logrotate.d/speedopage`:
```bash
/var/log/nginx/speedopage-*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 nginx nginx
    sharedscripts
    postrotate
        systemctl reload nginx > /dev/null 2>&1
    endscript
}
```

### 3. Monitoring Commands
```bash
# System resources
htop

# Disk usage
df -h

# Memory usage
free -h

# Network connections
ss -tunlp

# PM2 status
pm2 status

# Nginx status
sudo systemctl status nginx

# Check logs
sudo tail -f /var/log/nginx/speedopage-access.log
pm2 logs speedopage --lines 100
```

## Performance Optimization

### 1. Enable HTTP/2 (already in config)
HTTP/2 is enabled in the Nginx config above

### 2. Configure Node.js for Production
```bash
# Set NODE_ENV
export NODE_ENV=production

# Or add to PM2 ecosystem.config.js
env: {
  NODE_ENV: 'production',
  PORT: 3000
}
```

### 3. Nginx Caching (Optional)
Add to nginx config if serving static files:
```nginx
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

## Backup Strategy

### 1. Backup SQLite Database
```bash
# Create backup script
cat > ~/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/nodeapp/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
sqlite3 /home/nodeapp/apps/speedopage/speeds.db ".backup $BACKUP_DIR/speeds_$DATE.db"
# Keep only last 7 days
find $BACKUP_DIR -name "speeds_*.db" -mtime +7 -delete
EOF

chmod +x ~/backup.sh

# Add to crontab
crontab -e
# Add: 0 2 * * * /home/nodeapp/backup.sh
```

### 2. AWS Snapshots
Enable automated EBS snapshots in AWS console

## Quick Deployment Checklist

- [ ] Launch t4g.micro instance with Amazon Linux 2023 ARM64
- [ ] Update system and install Node.js
- [ ] Install and configure Nginx
- [ ] Configure firewall and security groups
- [ ] Point DNS to instance public IP
- [ ] Install SSL certificate with certbot
- [ ] Deploy application with PM2
- [ ] Configure security hardening (SSH, Fail2Ban, SELinux)
- [ ] Setup monitoring and backups
- [ ] Test application at https://speedo.blownbytwins.co.uk

## Useful Commands Reference

```bash
# Restart services
sudo systemctl restart nginx
pm2 restart speedopage

# View logs
sudo tail -f /var/log/nginx/error.log
pm2 logs speedopage

# Check SSL certificate expiry
sudo certbot certificates

# Monitor resources
htop
pm2 monit

# Check security
sudo fail2ban-client status
sudo ausearch -m avc -ts recent  # SELinux denials
```

## Cost Optimization

- t4g.micro is free tier eligible (750 hours/month first 12 months)
- ARM64 is ~20% cheaper than x86
- Use reserved instances for long-term (up to 72% savings)
- Enable CloudWatch detailed monitoring only if needed
- Use AWS Budgets to set spending alerts

---

Your SpeedoPage app will run efficiently and securely on this setup!
