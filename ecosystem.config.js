// PM2 Ecosystem Configuration for SpeedoPage
// This file configures PM2 to manage the Node.js application

module.exports = {
  apps: [{
    name: 'speedopage',
    script: './server.js',
    cwd: '/home/john/development/speedopage',

    // Process management
    instances: 1,
    exec_mode: 'fork',

    // Environment variables
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },

    // Logging
    error_file: './logs/error.log',
    out_file: './logs/output.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

    // Auto-restart configuration
    watch: false,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',

    // Memory management
    max_memory_restart: '200M'
  }]
};
