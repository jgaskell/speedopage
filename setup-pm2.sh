#!/bin/bash
# Setup script for PM2 process manager

echo "=== SpeedoPage PM2 Setup ==="

# Create logs directory
mkdir -p logs

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "PM2 not found. Installing PM2 globally..."
    npm install -g pm2
else
    echo "PM2 is already installed"
fi

# Stop existing process if running
echo "Stopping any existing speedopage process..."
pm2 stop speedopage 2>/dev/null || true
pm2 delete speedopage 2>/dev/null || true

# Start the application using ecosystem config
echo "Starting SpeedoPage with PM2..."
pm2 start ecosystem.config.js

# Save PM2 process list
echo "Saving PM2 process list..."
pm2 save

# Setup PM2 to start on system boot
echo "Setting up PM2 startup script..."
pm2 startup

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Useful PM2 commands:"
echo "  pm2 status              - Check app status"
echo "  pm2 logs speedopage     - View logs"
echo "  pm2 restart speedopage  - Restart app"
echo "  pm2 stop speedopage     - Stop app"
echo "  pm2 monit               - Monitor app in real-time"
echo ""
echo "Your app should now be running on http://localhost:3000"
