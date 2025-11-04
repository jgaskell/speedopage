#!/usr/bin/env node

/**
 * Generate R35 GT-R test data directly to server
 * Usage: node generate-test-data.js [server-url] [device-id]
 * Example: node generate-test-data.js https://your-aws.com:3000 abc-123-def
 */

const https = require('https');
const http = require('http');

const serverUrl = process.argv[2] || 'https://localhost:3000';
const deviceId = process.argv[3] || require('crypto').randomUUID();

console.log(`Generating GT-R test data...`);
console.log(`Server: ${serverUrl}`);
console.log(`Device ID: ${deviceId}`);

const testSessions = [
    {
        // Run 1: Perfect launch, dry conditions
        vMax: 318.4, // 198 mph
        distance: 1.609344, // 1 mile
        duration: 52,
        timers: {
            '0-60': { time: '2.41s', invalid: false },
            '0-100': { time: '5.23s', invalid: false },
            '0-150': { time: '10.68s', invalid: false },
            '0-100kmh': { time: '2.52s', invalid: false },
            '0-160kmh': { time: '5.45s', invalid: false },
            '1/4 mile': { time: '9.87s @ 238.2 km/h', invalid: false },
            '1/2 mile': { time: '16.34s @ 301.5 km/h', invalid: false },
            'standing mile': { time: '24.89s @ 318.4 km/h', invalid: false }
        },
        onIncline: false
    },
    {
        // Run 2: Good launch, slight wheel spin
        vMax: 315.7,
        distance: 1.609344,
        duration: 53,
        timers: {
            '0-60': { time: '2.53s', invalid: false },
            '0-100': { time: '5.41s', invalid: false },
            '0-150': { time: '10.94s', invalid: false },
            '0-100kmh': { time: '2.64s', invalid: false },
            '0-160kmh': { time: '5.63s', invalid: false },
            '1/4 mile': { time: '10.02s @ 235.8 km/h', invalid: false },
            '1/2 mile': { time: '16.58s @ 298.7 km/h', invalid: false },
            'standing mile': { time: '25.12s @ 315.7 km/h', invalid: false }
        },
        onIncline: false
    },
    {
        // Run 3: Street run, rolling start from 30
        vMax: 289.3,
        distance: 0.804672, // 0.5 mile
        duration: 28,
        timers: {
            '30-60': { time: '1.82s', invalid: false },
            '60-120': { time: '4.67s', invalid: false },
            '60-130': { time: '5.91s', invalid: false },
            '100-150': { time: '4.23s', invalid: false },
            '100-200kmh': { time: '5.87s', invalid: false },
            '1/2 mile': { time: '16.89s @ 289.3 km/h', invalid: false }
        },
        onIncline: false
    },
    {
        // Run 4: Drag strip, perfect conditions
        vMax: 241.4,
        distance: 0.402336, // 1/4 mile
        duration: 10,
        timers: {
            '0-60': { time: '2.38s', invalid: false },
            '0-100': { time: '5.19s', invalid: false },
            '0-100kmh': { time: '2.49s', invalid: false },
            '0-160kmh': { time: '5.38s', invalid: false },
            '1/4 mile': { time: '9.78s @ 241.4 km/h', invalid: false }
        },
        onIncline: false
    },
    {
        // Run 5: Autobahn blast
        vMax: 327.8,
        distance: 3.218688, // 2 miles
        duration: 98,
        timers: {
            '0-60': { time: '2.45s', invalid: false },
            '0-100': { time: '5.28s', invalid: false },
            '0-150': { time: '10.76s', invalid: false },
            '0-200': { time: '18.92s', invalid: false },
            '0-100kmh': { time: '2.56s', invalid: false },
            '0-160kmh': { time: '5.49s', invalid: false },
            '0-250kmh': { time: '14.23s', invalid: false },
            '1/4 mile': { time: '9.92s @ 239.5 km/h', invalid: false },
            '1/2 mile': { time: '16.45s @ 303.2 km/h', invalid: false },
            'standing mile': { time: '24.76s @ 320.1 km/h', invalid: false }
        },
        onIncline: false
    },
    {
        // Run 6: Track day
        vMax: 267.3,
        distance: 2.414016, // 1.5 miles
        duration: 72,
        timers: {
            '0-60': { time: '2.58s', invalid: false },
            '0-100': { time: '5.47s', invalid: false },
            '0-150': { time: '11.12s', invalid: false },
            '0-100kmh': { time: '2.69s', invalid: false },
            '0-160kmh': { time: '5.68s', invalid: false },
            '160-240kmh': { time: '8.94s', invalid: false },
            '1/4 mile': { time: '10.15s @ 232.6 km/h', invalid: false },
            '1/2 mile': { time: '16.82s @ 267.3 km/h', invalid: false }
        },
        onIncline: false
    },
    {
        // Run 7: Wet conditions
        vMax: 254.8,
        distance: 0.804672,
        duration: 32,
        timers: {
            '0-60': { time: '3.12s', invalid: false },
            '0-100': { time: '6.38s', invalid: false },
            '0-150': { time: '13.45s', invalid: false },
            '0-100kmh': { time: '3.26s', invalid: false },
            '0-160kmh': { time: '6.62s', invalid: false },
            '1/4 mile': { time: '11.23s @ 218.7 km/h', invalid: false },
            '1/2 mile': { time: '18.94s @ 254.8 km/h', invalid: false }
        },
        onIncline: false
    },
    {
        // Run 8: Highway roll
        vMax: 305.2,
        distance: 1.207008,
        duration: 41,
        timers: {
            '60-120': { time: '4.59s', invalid: false },
            '60-130': { time: '5.78s', invalid: false },
            '100-150': { time: '4.15s', invalid: false },
            '100-200kmh': { time: '5.73s', invalid: false },
            '160-240kmh': { time: '8.67s', invalid: false }
        },
        onIncline: false
    },
    {
        // Run 9: Downhill (INVALID)
        vMax: 332.6,
        distance: 1.609344,
        duration: 46,
        timers: {
            '0-60': { time: '2.18s', invalid: true },
            '0-100': { time: '4.87s', invalid: true },
            '0-150': { time: '9.92s', invalid: true },
            '0-100kmh': { time: '2.28s', invalid: true },
            '0-160kmh': { time: '5.06s', invalid: true },
            '1/4 mile': { time: '9.34s @ 246.8 km/h', invalid: true },
            '1/2 mile': { time: '15.67s @ 312.4 km/h', invalid: true },
            'standing mile': { time: '23.89s @ 332.6 km/h', invalid: true }
        },
        onIncline: true
    },
    {
        // Run 10: 1/8 mile
        vMax: 189.7,
        distance: 0.201168,
        duration: 6,
        timers: {
            '0-60': { time: '2.44s', invalid: false },
            '0-100': { time: '5.31s', invalid: false },
            '0-100kmh': { time: '2.55s', invalid: false },
            '1/8 mile': { time: '6.12s @ 189.7 km/h', invalid: false }
        },
        onIncline: false
    }
];

// Generate timestamps spread over last 30 days
const now = Date.now();
const dayMs = 24 * 60 * 60 * 1000;

let successCount = 0;
let errorCount = 0;

testSessions.forEach((session, index) => {
    const daysAgo = Math.floor((30 / testSessions.length) * index);
    const timestamp = new Date(now - (daysAgo * dayMs) - Math.random() * dayMs);
    const startTime = new Date(timestamp.getTime() - session.duration * 1000);

    const sessionData = {
        deviceId: deviceId,
        startTime: startTime.toISOString(),
        endTime: timestamp.toISOString(),
        vMax: session.vMax,
        distance: session.distance,
        duration: session.duration,
        timers: session.timers,
        onIncline: session.onIncline
    };

    const postData = JSON.stringify(sessionData);
    const url = new URL(serverUrl);
    const protocol = url.protocol === 'https:' ? https : http;

    const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: '/api/save-session',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        },
        rejectUnauthorized: false // For self-signed certs
    };

    const req = protocol.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            if (res.statusCode === 200) {
                successCount++;
                console.log(`✓ Session ${index + 1}/10 created`);
            } else {
                errorCount++;
                console.error(`✗ Session ${index + 1}/10 failed: ${res.statusCode}`);
            }

            if (successCount + errorCount === testSessions.length) {
                console.log(`\n✅ Complete: ${successCount} sessions created, ${errorCount} failed`);
                console.log(`\nView at: ${serverUrl}`);
            }
        });
    });

    req.on('error', (error) => {
        errorCount++;
        console.error(`✗ Session ${index + 1}/10 error:`, error.message);
    });

    req.write(postData);
    req.end();
});
