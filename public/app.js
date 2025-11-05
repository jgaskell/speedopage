// Authentication state
let currentUser = null;
let isAuthenticated = false;
let hasChosenAuthOption = false; // Track if user has made auth choice

// Garage state
let userCars = [];
let activeCar = null;
let editingCarId = null;

let units = 'kmh'; // default
let altUnits = 'mph';
let currentCountry = '';
let autoDetectUnits = true; // Track if units were auto-detected or manually set
let speed = 0;
let interpolatedSpeed = 0; // Interpolated speed between GPS updates
let lastPosition = null;
let lastTime = Date.now();
let lastSpeed = 0;
let timers = {};
let timerStart = null;
let sessionStart = null;
let totalDistance = 0; // Track total distance in km
let distances = { '1/8': 0.201168, '1/4': 0.402336, '1/2': 0.804672, '1': 1.609344 }; // miles to km
let timerTargets = {
    '0-60': 60, '0-100': 100, '0-150': 150, '0-200': 200,
    '30-60': 60, '60-120': 120, '60-130': 130, '100-150': 150,
    '0-100kmh': 100, '0-160kmh': 160, '0-250kmh': 250, '0-320kmh': 320,
    '100-200kmh': 200, '160-240kmh': 240
};
let dragTargets = ['1/8 mile', '1/4 mile', '1/2 mile', 'standing mile'];
let sessionVmax = 0; // Persistent vmax across timer resets
let lastCountryCheck = 0;
let deviceId = localStorage.getItem('deviceId') || generateDeviceId();
let lastLogTime = 0;
let currentView = 'speedometer'; // 'speedometer' or 'summary'
let interpolationInterval = null;
let gpsLocked = false; // Track if we have sufficient GPS accuracy
let minSatellites = 4; // Minimum satellites for reliable speed reading
let lastAltitude = null; // Previous altitude reading
let altitudeHistory = []; // Rolling window for altitude smoothing
let currentIncline = 0; // Current incline in degrees
let onDownhill = false; // Flag if currently on downhill >= 2 degrees
let inclineThreshold = 2; // Degrees - threshold for invalidating data
let summaryUnits = localStorage.getItem('summaryUnits') ?
    JSON.parse(localStorage.getItem('summaryUnits')) :
    { speed: 'kmh', distance: 'km' }; // Summary view unit preferences

async function getCountryFromIP() {
    try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        setUnits(data.country_code);
    } catch (e) {
        console.log('IP country detection failed, using kmh');
    }
}

async function getCountryFromCoords(lat, lon) {
    if (Date.now() - lastCountryCheck < 60000) return; // throttle to 1 min
    lastCountryCheck = Date.now();
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
        const data = await response.json();
        const country = data.address?.country_code?.toUpperCase();
        if (country && country !== currentCountry) {
            currentCountry = country;
            setUnits(country);
        }
    } catch (e) {
        console.log('Coords country detection failed');
    }
}

function setUnits(country) {
    if (!autoDetectUnits) return; // Don't override manual selection
    if (['US', 'GB', 'MM'].includes(country)) { // mph countries
        units = 'mph';
        altUnits = 'kmh';
    } else {
        units = 'kmh';
        altUnits = 'mph';
    }
}

function toggleUnits() {
    // Manual toggle - disable auto-detection
    autoDetectUnits = false;
    if (units === 'kmh') {
        units = 'mph';
        altUnits = 'kmh';
    } else {
        units = 'kmh';
        altUnits = 'mph';
    }
    updateDisplay();
}

function toMph(kmh) { return kmh * 0.621371; }
function toKmh(mph) { return mph / 0.621371; }

// Interpolate speed between GPS updates considering drag (non-linear deceleration)
function interpolateSpeed(v0, v1, timeSinceUpdate, totalInterval) {
    if (totalInterval === 0) return v0;
    const t = timeSinceUpdate / totalInterval; // 0 to 1

    // If accelerating or maintaining speed, use linear interpolation
    if (v1 >= v0) {
        return v0 + (v1 - v0) * t;
    }

    // If decelerating, model drag deceleration (quadratic relationship)
    // Drag force ∝ v², so deceleration rate increases with speed
    // Use exponential decay as approximation: v = v0 * e^(-kt)
    // BUG FIX #1: Guard against division by zero when v1 is very small
    if (v1 < 0.1) {
        // Linear decay to zero for very low speeds
        return Math.max(0, v0 * (1 - t));
    }
    const k = -Math.log(v1 / v0) / totalInterval; // decay constant
    return v0 * Math.exp(-k * timeSinceUpdate);
}

// Start interpolation updates at higher frequency than GPS
function startInterpolation() {
    if (interpolationInterval) return; // Already running
    interpolationInterval = setInterval(() => {
        if (!lastPosition) return;

        const timeSinceUpdate = (Date.now() - lastTime) / 1000;
        const expectedInterval = 1.0; // GPS updates roughly every 1 second

        // Interpolate between last measured speed and current speed
        interpolatedSpeed = interpolateSpeed(lastSpeed, speed, timeSinceUpdate, expectedInterval);

        // Update display with interpolated value
        updateDisplay();
    }, 100); // Update display 10 times per second for smooth animation
}

function updateDisplay() {
    // Don't display speed until we have GPS lock
    if (!gpsLocked) {
        document.getElementById('speed').textContent = '--';
        document.getElementById('speed-unit').textContent = 'Acquiring GPS...';
        document.getElementById('alt-speed').textContent = 'Waiting for satellite lock';
        const displayDistance = units === 'mph' ? (totalDistance * 0.621371) : totalDistance;
        const distUnit = units === 'mph' ? 'mi' : 'km';
        const displayVmax = units === 'mph' ? toMph(sessionVmax) : sessionVmax;
        document.getElementById('distance').textContent = displayDistance.toFixed(2) + ' ' + distUnit;
        document.getElementById('session-vmax').textContent = displayVmax.toFixed(1) + ' ' + units;
        return;
    }

    const displaySpeedValue = interpolatedSpeed || speed;
    const displaySpeed = units === 'mph' ? toMph(displaySpeedValue) : displaySpeedValue;
    const altDisplay = altUnits === 'mph' ? toMph(displaySpeedValue) : displaySpeedValue;

    // Convert distance based on current units
    const displayDistance = units === 'mph' ? (totalDistance * 0.621371) : totalDistance;
    const distUnit = units === 'mph' ? 'mi' : 'km';

    // Convert session vMax based on current units
    const displayVmax = units === 'mph' ? toMph(sessionVmax) : sessionVmax;

    document.getElementById('speed').textContent = displaySpeed.toFixed(1);
    document.getElementById('speed-unit').textContent = units;
    document.getElementById('alt-speed').textContent = altDisplay.toFixed(1) + ' ' + altUnits;
    document.getElementById('distance').textContent = displayDistance.toFixed(2) + ' ' + distUnit;
    document.getElementById('session-vmax').textContent = displayVmax.toFixed(1) + ' ' + units;
}

function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function calculateIncline(altitudeChange, horizontalDistance) {
    // Calculate incline angle in degrees
    // altitudeChange: meters, horizontalDistance: km
    if (horizontalDistance < 0.01) return 0; // Ignore very small distances

    const distanceMeters = horizontalDistance * 1000;
    const inclineRadians = Math.atan(altitudeChange / distanceMeters);
    const inclineDegrees = inclineRadians * (180 / Math.PI);

    return inclineDegrees;
}

function smoothAltitude(newAltitude) {
    // Use 5-reading moving average to reduce GPS noise
    altitudeHistory.push(newAltitude);
    if (altitudeHistory.length > 5) {
        altitudeHistory.shift();
    }

    const sum = altitudeHistory.reduce((a, b) => a + b, 0);
    return sum / altitudeHistory.length;
}

function watchPosition(position) {
    const now = Date.now();
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;
    const altitude = position.coords.altitude; // meters above sea level (may be null)
    const altitudeAccuracy = position.coords.altitudeAccuracy;

    // Check GPS accuracy - require minimum satellite count
    // Note: accuracy is in meters, lower is better. Most devices don't expose satellite count,
    // so we use accuracy as a proxy. Good accuracy (< 20m) typically means 4+ satellites.
    const accuracy = position.coords.accuracy;
    const hasGoodAccuracy = accuracy !== undefined && accuracy < 20; // < 20 meters is good

    // Alternative check: use satellites if available (non-standard, Android/some browsers)
    const satellites = position.coords.satellites || 0;
    const hasSufficientSatellites = satellites >= minSatellites;

    // GPS is locked if we have good accuracy OR sufficient satellites
    gpsLocked = hasGoodAccuracy || hasSufficientSatellites;

    if (!gpsLocked) {
        updateDisplay();
        return; // Don't process position until we have lock
    }

    getCountryFromCoords(lat, lon);

    // Process altitude if available and accurate enough
    if (altitude !== null && altitudeAccuracy !== null && altitudeAccuracy < 50) {
        const smoothedAltitude = smoothAltitude(altitude);

        if (lastAltitude !== null && lastPosition) {
            const altitudeChange = smoothedAltitude - lastAltitude; // meters
            const dist = haversine(lastPosition.lat, lastPosition.lon, lat, lon); // km

            if (dist >= 0.01) { // Only calculate for meaningful distances
                currentIncline = calculateIncline(altitudeChange, dist);
                // Check if on downhill (negative incline >= threshold)
                onDownhill = currentIncline <= -inclineThreshold;
            }
        }

        lastAltitude = smoothedAltitude;
    }

    if (lastPosition) {
        const dist = haversine(lastPosition.lat, lastPosition.lon, lat, lon);
        const timeDiff = (now - lastTime) / 1000; // seconds

        // BUG FIX #6: Validate distance and time to avoid spurious speeds
        // Ignore readings with very small distances (GPS jitter) or time intervals
        if (dist < 0.001 || timeDiff < 0.5) {
            lastPosition = { lat, lon };
            lastTime = now;
            updateDisplay();
            return;
        }

        lastSpeed = speed; // Store for interpolation
        const calculatedSpeed = (dist / timeDiff) * 3600; // kmh

        // Sanity check: ignore physically impossible speeds (> 500 km/h for ground vehicles)
        if (calculatedSpeed <= 500) {
            speed = calculatedSpeed;
            interpolatedSpeed = speed; // Reset interpolated to actual

            totalDistance += dist; // Accumulate distance
            sessionVmax = Math.max(sessionVmax, speed);

            updateTimers(speed, timeDiff, totalDistance);
        }
    }

    lastPosition = { lat, lon };
    lastTime = now;
    updateDisplay();
    displayTimers();
    logSpeed();
}

function updateTimers(currentSpeed, timeDiff, totalDist) {
    // Auto-reset timers when stopped, but keep vmax and session data
    if (currentSpeed < 1) {
        if (Object.keys(timers).length > 0) {
            // Session ended, timers will be reset but vmax persists
            timers = {};
            timerStart = null;
            // BUG FIX #4: Reset totalDistance when timers reset
            totalDistance = 0;
        }
        return;
    }

    if (!timerStart) {
        timerStart = Date.now();
        if (!sessionStart) sessionStart = new Date().toISOString();
    }

    const elapsed = (Date.now() - timerStart) / 1000;

    // speed timers
    Object.keys(timerTargets).forEach(key => {
        if (!timers[key] && currentSpeed >= timerTargets[key]) {
            timers[key] = {
                time: elapsed.toFixed(2) + 's',
                invalid: onDownhill
            };
        }
    });

    // drag timers
    dragTargets.forEach(target => {
        const distKm = distances[target.split(' ')[0]];
        if (!timers[target] && totalDist >= distKm) {
            timers[target] = {
                time: elapsed.toFixed(2) + 's @ ' + currentSpeed.toFixed(1) + ' km/h',
                invalid: onDownhill
            };
        }
    });
}

function resetSession() {
    if (!confirm('Reset all session data? This will clear timers, distance, and vMax.')) {
        return;
    }

    // BUG FIX #3: Only save session if meaningful data was collected
    // BUG FIX #5: Pass session data to avoid race condition
    if (sessionStart && sessionVmax > 5 && totalDistance > 0.1) {
        // Check if any timers were achieved on downhill
        const hasInvalidTimers = Object.values(timers).some(t =>
            typeof t === 'object' && t.invalid
        );

        const sessionData = {
            deviceId,
            startTime: sessionStart,
            endTime: new Date().toISOString(),
            vMax: sessionVmax,
            distance: totalDistance,
            duration: Math.floor((Date.now() - new Date(sessionStart)) / 1000),
            timers: { ...timers },
            onIncline: hasInvalidTimers || onDownhill
        };
        saveSession(sessionData);
    }

    timers = {};
    timerStart = null;
    sessionStart = null;
    sessionVmax = 0;
    totalDistance = 0;
    displayTimers();
    updateDisplay();
}

function displayTimers() {
    let html = '';
    const sortedTimers = Object.entries(timers).sort((a, b) => {
        // Sort by timer name
        return a[0].localeCompare(b[0]);
    });

    sortedTimers.forEach(([key, value]) => {
        const invalidClass = value.invalid ? 'timer-invalid' : '';
        const invalidIndicator = value.invalid ? ' ⚠️' : '';
        const displayValue = typeof value === 'object' ? value.time : value;

        html += `<div class="timer-item ${invalidClass}">
            <span class="timer-label">${key}${invalidIndicator}</span>
            <span class="timer-value">${displayValue}</span>
        </div>`;
    });

    if (html === '') {
        html = '<div class="timer-placeholder">No timers recorded yet. Start driving to track performance!</div>';
    }

    document.getElementById('timers').innerHTML = html;
}

function generateDeviceId() {
    const id = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
    // BUG FIX #8: Handle localStorage quota exhaustion
    try {
        localStorage.setItem('deviceId', id);
    } catch (e) {
        console.error('Failed to save device ID to localStorage:', e);
        // Continue without persisting - will generate new ID on next load
    }
    return id;
}

function logSpeed() {
    if (Date.now() - lastLogTime < 10000) return; // log every 10 seconds
    lastLogTime = Date.now();
    fetch('/api/log-speed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, speed, timestamp: new Date().toISOString() })
    }).catch(err => console.log('Logging failed', err));
}

function saveSession(sessionData) {
    // BUG FIX #5: Accept session data as parameter to avoid race conditions
    fetch('/api/save-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionData)
    }).catch(err => console.log('Session save failed', err));
}

function toggleView(view) {
    currentView = view;

    if (view === 'speedometer') {
        document.getElementById('speedometer-view').style.display = 'block';
        document.getElementById('summary-view').style.display = 'none';
        document.getElementById('btn-speedometer').classList.add('active');
        document.getElementById('btn-summary').classList.remove('active');
    } else {
        document.getElementById('speedometer-view').style.display = 'none';
        document.getElementById('summary-view').style.display = 'block';
        document.getElementById('btn-speedometer').classList.remove('active');
        document.getElementById('btn-summary').classList.add('active');
        loadSummary();
    }
}

function toggleSummaryUnits(type) {
    if (type === 'speed') {
        summaryUnits.speed = summaryUnits.speed === 'kmh' ? 'mph' : 'kmh';
    } else if (type === 'distance') {
        summaryUnits.distance = summaryUnits.distance === 'km' ? 'mi' : 'km';
    }
    localStorage.setItem('summaryUnits', JSON.stringify(summaryUnits));
    loadSummary(); // Reload to reflect changes
}

function loadSummary() {
    const vMaxValue = summaryUnits.speed === 'mph' ? toMph(sessionVmax) : sessionVmax;
    const distValue = summaryUnits.distance === 'mi' ? (totalDistance * 0.621371) : totalDistance;

    const summaryContent = `
        <div class="summary-section">
            <h3>Current Session</h3>
            <div class="summary-grid">
                <div class="summary-stat">
                    <span class="stat-label">vMax</span>
                    <span class="stat-value stat-clickable" onclick="toggleSummaryUnits('speed')" title="Click to toggle units">
                        ${vMaxValue.toFixed(1)} ${summaryUnits.speed}
                    </span>
                </div>
                <div class="summary-stat">
                    <span class="stat-label">Distance</span>
                    <span class="stat-value stat-clickable" onclick="toggleSummaryUnits('distance')" title="Click to toggle units">
                        ${distValue.toFixed(2)} ${summaryUnits.distance}
                    </span>
                </div>
                <div class="summary-stat">
                    <span class="stat-label">Duration</span>
                    <span class="stat-value">${sessionStart ? formatDuration((Date.now() - new Date(sessionStart)) / 1000) : '0s'}</span>
                </div>
            </div>
        </div>

        <div class="summary-section">
            <h3>Performance Timers</h3>
            <div class="summary-timers">
                ${Object.keys(timers).length > 0 ?
                    Object.entries(timers).map(([key, value]) => `
                        <div class="summary-timer">
                            <span class="timer-name">${key}</span>
                            <span class="timer-time">${value}</span>
                        </div>
                    `).join('') :
                    '<p class="no-data">No timer data recorded yet</p>'
                }
            </div>
        </div>

        <div class="summary-section">
            <h3>Session History</h3>
            <div id="session-history">Loading...</div>
        </div>

        <div class="summary-section">
            <h3>Export Data</h3>
            <div class="export-buttons">
                <button class="btn" onclick="exportCSV()">📊 Export to Excel/CSV</button>
            </div>
        </div>

        <div class="summary-section">
            <h3>Test Data</h3>
            <p style="opacity: 0.7; font-size: 0.9em; margin-bottom: 15px;">Generate sample performance data for demonstration purposes</p>
            <div class="export-buttons">
                <button class="btn" onclick="generateGTRTestData()">🏎️ Generate R35 GT-R Data (750bhp)</button>
            </div>
        </div>

        <div class="summary-section">
            <h3>Data Management</h3>
            <p style="opacity: 0.7; font-size: 0.9em; margin-bottom: 15px;">Remove session data from the database</p>
            <div class="export-buttons">
                <button class="btn btn-reset" onclick="removeSampleData()">🗑️ Remove Sample Data</button>
                <button class="btn btn-reset" onclick="removeUserData()">🗑️ Remove Your Data</button>
                <button class="btn btn-reset" onclick="removeAllData()">⚠️ Remove All Data</button>
            </div>
        </div>
    `;

    document.getElementById('summary-content').innerHTML = summaryContent;

    // Load session history (includes user's own data + sample data)
    fetch(`/api/sessions/${deviceId}/all`)
        .then(res => res.json())
        .then(data => {
            const historyEl = document.getElementById('session-history');
            if (data.sessions && data.sessions.length > 0) {
                historyEl.innerHTML = data.sessions.map(session => {
                    // BUG FIX #12: Proper NULL handling for session values
                    const vMax = (session.vMax || 0);
                    const distance = (session.distance || 0);
                    const duration = formatDuration(session.duration || 0);

                    // Convert based on summary units preference
                    const vMaxDisplay = summaryUnits.speed === 'mph' ? toMph(vMax).toFixed(1) : vMax.toFixed(1);
                    const distDisplay = summaryUnits.distance === 'mi' ? (distance * 0.621371).toFixed(2) : distance.toFixed(2);

                    const inclineIndicator = session.onIncline ? ' <span class="incline-warning" title="Achieved on downhill">⚠️ Downhill</span>' : '';
                    const inclineClass = session.onIncline ? 'session-invalid' : '';

                    // Mark sample data sessions
                    const isSample = session.deviceId && session.deviceId.startsWith('SAMPLE-');
                    const sampleBadge = isSample ? ' <span style="background: rgba(0, 212, 255, 0.2); padding: 2px 8px; border-radius: 4px; font-size: 0.85em;">🏎️ Sample</span>' : '';

                    // Build timers HTML for accordion
                    let timersHTML = '';
                    if (session.timers && Object.keys(session.timers).length > 0) {
                        timersHTML = '<div class="session-timers" style="display: none;"><div class="timers-grid">';
                        for (const [key, value] of Object.entries(session.timers)) {
                            const timerTime = typeof value === 'object' ? value.time : value;
                            const timerInvalid = typeof value === 'object' && value.invalid;
                            const invalidClass = timerInvalid ? 'timer-invalid' : '';
                            const invalidIcon = timerInvalid ? ' ⚠️' : '';

                            timersHTML += `
                                <div class="timer-item ${invalidClass}">
                                    <span class="timer-label">${key}${invalidIcon}</span>
                                    <span class="timer-value">${timerTime}</span>
                                </div>
                            `;
                        }
                        timersHTML += '</div></div>';
                    }

                    const expandIcon = timersHTML ? '<span class="expand-icon" style="float: right; cursor: pointer; user-select: none;">▼</span>' : '';

                    return `
                        <div class="history-item ${inclineClass}" onclick="toggleSessionDetails(this)" style="cursor: pointer;">
                            <div class="history-date">${new Date(session.timestamp).toLocaleString()}${sampleBadge}${expandIcon}</div>
                            <div class="history-stats">
                                <span>vMax: ${vMaxDisplay} ${summaryUnits.speed}</span>
                                <span>Distance: ${distDisplay} ${summaryUnits.distance}</span>
                                <span>Duration: ${duration}</span>
                                ${inclineIndicator}
                            </div>
                            ${timersHTML}
                        </div>
                    `;
                }).join('');
            } else {
                historyEl.innerHTML = '<p class="no-data">No previous sessions</p>';
            }
        })
        .catch(err => {
            document.getElementById('session-history').innerHTML = '<p class="error">Failed to load history</p>';
        });
}

function toggleSessionDetails(element) {
    const timersDiv = element.querySelector('.session-timers');
    const expandIcon = element.querySelector('.expand-icon');

    if (timersDiv && expandIcon) {
        const isExpanded = timersDiv.style.display !== 'none';

        if (isExpanded) {
            // Collapse
            timersDiv.style.display = 'none';
            expandIcon.textContent = '▼';
        } else {
            // Expand
            timersDiv.style.display = 'block';
            expandIcon.textContent = '▲';
        }
    }
}

function formatDuration(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
}

function generateGTRTestData() {
    // Generate realistic test data for 750bhp R35 GT-R
    const confirmation = confirm('Generate sample data for a 750bhp R35 GT-R?\n\nThis will create 10 demo sessions with comprehensive performance metrics.\n\nNote: Sample data will be marked with deviceId starting with "SAMPLE-"');
    if (!confirmation) return;

    // Use special deviceId prefix to identify sample data
    const sampleDeviceId = 'SAMPLE-GTR-' + crypto.randomUUID().substring(0, 8);

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
            vMax: 241.4, // Just after 1/4 mile
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
            vMax: 327.8, // 204 mph - extended run
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
            // Run 6: Track day, multiple runs
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
            // Run 7: Wet conditions - slower times
            vMax: 254.8,
            distance: 0.804672, // 0.5 mile
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
            // Run 8: Highway roll from 60 mph
            vMax: 305.2,
            distance: 1.207008, // 0.75 mile
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
            // Run 9: Downhill run (INVALID)
            vMax: 332.6,
            distance: 1.609344, // 1 mile
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
            // Run 10: 1/8 mile test
            vMax: 189.7,
            distance: 0.201168, // 1/8 mile
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

    // Generate timestamps spread over the last 30 days
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    let successCount = 0;
    let errorCount = 0;
    const totalSessions = testSessions.length;

    console.log(`Starting generation of ${totalSessions} test sessions...`);

    // Process sessions sequentially with delay to avoid rate limiting
    async function processSessions() {
        for (let index = 0; index < testSessions.length; index++) {
            const session = testSessions[index];

            // Spread sessions over last 30 days
            const daysAgo = Math.floor((30 / testSessions.length) * index);
            const timestamp = new Date(now - (daysAgo * dayMs) - Math.random() * dayMs);
            const startTime = new Date(timestamp.getTime() - session.duration * 1000);

            const sessionData = {
                deviceId: sampleDeviceId,
                startTime: startTime.toISOString(),
                endTime: timestamp.toISOString(),
                vMax: session.vMax,
                distance: session.distance,
                duration: session.duration,
                timers: session.timers,
                onIncline: session.onIncline
            };

            console.log(`Sending session ${index + 1}/${totalSessions}...`, sessionData);

            try {
                // Send to server
                const response = await fetch('/api/save-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(sessionData)
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    successCount++;
                    console.log(`✓ Session ${index + 1}/${totalSessions} created (ID: ${data.id})`);
                } else {
                    errorCount++;
                    console.error(`✗ Session ${index + 1}/${totalSessions} failed:`, data);
                }
            } catch (err) {
                errorCount++;
                console.error(`✗ Session ${index + 1}/${totalSessions} error:`, err);
            }

            // Small delay to avoid overwhelming rate limiter
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // All done
        console.log(`\n✅ Complete: ${successCount} sessions created, ${errorCount} failed`);
        alert(`✅ Generated ${successCount} GT-R test sessions!\n${errorCount > 0 ? `Failed: ${errorCount}\n` : ''}\nGo to Summary tab to view and export.`);

        if (currentView === 'summary') {
            loadSummary(); // Refresh if already on summary
        }
    }

    processSessions();
}

function exportCSV() {
    // Fetch all sessions (user + sample data) and export to CSV
    fetch(`/api/sessions/${deviceId}/all`)
        .then(res => res.json())
        .then(data => {
            if (!data.sessions || data.sessions.length === 0) {
                alert('No session data to export');
                return;
            }

            // CSV Headers
            const headers = [
                'Date',
                'Time',
                'vMax (km/h)',
                'vMax (mph)',
                'Distance (km)',
                'Distance (mi)',
                'Duration',
                'On Incline',
                'Timers'
            ];

            // Convert sessions to CSV rows
            const rows = data.sessions.map(session => {
                const date = new Date(session.timestamp);
                const vMaxKmh = (session.vMax || 0).toFixed(1);
                const vMaxMph = toMph(session.vMax || 0).toFixed(1);
                const distKm = (session.distance || 0).toFixed(2);
                const distMi = ((session.distance || 0) * 0.621371).toFixed(2);
                const duration = formatDuration(session.duration || 0);
                const onIncline = session.onIncline ? 'Yes*' : 'No';

                // Format timers
                let timersText = '';
                if (session.timers && typeof session.timers === 'object') {
                    timersText = Object.entries(session.timers)
                        .map(([key, val]) => {
                            const time = typeof val === 'object' ? val.time : val;
                            const invalid = typeof val === 'object' && val.invalid ? '*' : '';
                            return `${key}: ${time}${invalid}`;
                        })
                        .join('; ');
                }

                return [
                    date.toLocaleDateString(),
                    date.toLocaleTimeString(),
                    vMaxKmh,
                    vMaxMph,
                    distKm,
                    distMi,
                    duration,
                    onIncline,
                    `"${timersText}"` // Quote to handle commas in timers
                ];
            });

            // Build CSV content
            const csvContent = [headers, ...rows]
                .map(row => row.join(','))
                .join('\n');

            // Add footer note
            const footer = '\n\n"Note: * indicates data collected on downhill (>=2° decline)"';
            const fullCsv = csvContent + footer;

            // Create and download file
            const blob = new Blob([fullCsv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `speedopage-sessions-${Date.now()}.csv`;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        })
        .catch(err => {
            console.error('Export failed:', err);
            alert('Failed to export data. Please try again.');
        });
}

function removeSampleData() {
    if (!confirm('Remove all sample GT-R data?\n\nThis will delete all sessions with SAMPLE- device IDs.')) {
        return;
    }

    fetch('/api/sessions/sample', { method: 'DELETE' })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                alert(`✓ Deleted ${data.deleted} sample session${data.deleted !== 1 ? 's' : ''}`);
                if (currentView === 'summary') {
                    loadSummary(); // Refresh summary view
                }
            } else {
                alert('Failed to delete sample data: ' + (data.error || 'Unknown error'));
            }
        })
        .catch(err => {
            console.error('Delete sample data failed:', err);
            alert('Failed to delete sample data. Please try again.');
        });
}

function removeUserData() {
    if (!confirm('⚠️ Remove YOUR performance data?\n\nThis will delete all your recorded sessions.\n\nThis CANNOT be undone!\n\nClick OK to continue.')) {
        return;
    }

    fetch(`/api/sessions/${deviceId}/user`, { method: 'DELETE' })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                alert(`✓ Deleted ${data.deleted} of your session${data.deleted !== 1 ? 's' : ''}`);
                if (currentView === 'summary') {
                    loadSummary(); // Refresh summary view
                }
            } else {
                alert('Failed to delete your data: ' + (data.error || 'Unknown error'));
            }
        })
        .catch(err => {
            console.error('Delete user data failed:', err);
            alert('Failed to delete your data. Please try again.');
        });
}

function removeAllData() {
    const confirm1 = confirm('⚠️⚠️⚠️ DANGER: Remove ALL data?\n\nThis will delete EVERYTHING from the database.\n\n• All user sessions\n• All sample data\n• Everything!\n\nThis CANNOT be undone!\n\nClick OK to proceed to final confirmation.');
    if (!confirm1) {
        return;
    }

    const confirm2 = prompt('Type "DELETE ALL" (all caps, no quotes) to confirm:');
    if (confirm2 !== 'DELETE ALL') {
        alert('Cancelled - confirmation text did not match.');
        return;
    }

    fetch('/api/sessions/all/CONFIRM-DELETE-ALL', { method: 'DELETE' })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                alert(`⚠️ DELETED ALL ${data.deleted} sessions from database`);
                if (currentView === 'summary') {
                    loadSummary(); // Refresh summary view
                }
            } else {
                alert('Failed to delete all data: ' + (data.error || 'Unknown error'));
            }
        })
        .catch(err => {
            console.error('Delete all data failed:', err);
            alert('Failed to delete all data. Please try again.');
        });
}

// =======================
// Authentication Functions
// =======================

function checkAuthStatus() {
    isAuthenticated = AuthService.isAuthenticated();
    currentUser = AuthService.getUser();
    hasChosenAuthOption = localStorage.getItem('hasChosenAuthOption') === 'true';

    updateAuthUI();
}

function updateAuthUI() {
    const userInfo = document.getElementById('user-info');
    const authPrompt = document.getElementById('auth-prompt');
    const userName = document.getElementById('user-name');
    const garageBtn = document.getElementById('btn-garage');

    if (isAuthenticated && currentUser) {
        // Show user info, hide auth prompt
        userInfo.style.display = 'block';
        authPrompt.style.display = 'none';
        userName.textContent = `Welcome, ${currentUser.displayName || currentUser.email}`;
        garageBtn.style.display = 'inline-block'; // Show garage button

        // Load user's cars
        loadUserCars();
    } else if (hasChosenAuthOption) {
        // User chose to continue as guest, hide both
        userInfo.style.display = 'none';
        authPrompt.style.display = 'none';
        garageBtn.style.display = 'none'; // Hide garage button
    } else {
        // Show auth prompt
        userInfo.style.display = 'none';
        authPrompt.style.display = 'block';
        garageBtn.style.display = 'none'; // Hide garage button
    }
}

function setupAuthEventListeners() {
    const modal = document.getElementById('auth-modal');
    const closeBtn = document.querySelector('.modal-close');
    const authForm = document.getElementById('auth-form');
    const switchLink = document.getElementById('auth-switch-link');

    let isLoginMode = true;

    // Show login modal
    document.getElementById('btn-show-login').addEventListener('click', () => {
        isLoginMode = true;
        updateModalMode();
        modal.style.display = 'flex';
    });

    // Show register modal
    document.getElementById('btn-show-register').addEventListener('click', () => {
        isLoginMode = false;
        updateModalMode();
        modal.style.display = 'flex';
    });

    // Continue as guest
    document.getElementById('btn-continue-guest').addEventListener('click', () => {
        hasChosenAuthOption = true;
        localStorage.setItem('hasChosenAuthOption', 'true');
        updateAuthUI();
    });

    // Logout
    document.getElementById('btn-logout').addEventListener('click', async () => {
        await AuthService.logout();
        currentUser = null;
        isAuthenticated = false;
        hasChosenAuthOption = false;
        localStorage.removeItem('hasChosenAuthOption');
        checkAuthStatus();
    });

    // Close modal
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        clearAuthForm();
    });

    // Close modal on outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
            clearAuthForm();
        }
    });

    // Switch between login/register
    switchLink.addEventListener('click', (e) => {
        e.preventDefault();
        isLoginMode = !isLoginMode;
        updateModalMode();
    });

    // Handle form submission
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        const displayName = document.getElementById('auth-display-name').value;
        const errorDiv = document.getElementById('auth-error');
        const submitBtn = document.getElementById('auth-submit-btn');

        // Disable submit button
        submitBtn.disabled = true;
        submitBtn.textContent = isLoginMode ? 'Logging in...' : 'Registering...';
        errorDiv.style.display = 'none';

        let result;
        if (isLoginMode) {
            result = await AuthService.login(email, password);
        } else {
            result = await AuthService.register(email, password, displayName);
        }

        if (result.success) {
            // Success!
            currentUser = result.user;
            isAuthenticated = true;
            hasChosenAuthOption = true;
            localStorage.setItem('hasChosenAuthOption', 'true');

            modal.style.display = 'none';
            clearAuthForm();
            updateAuthUI();
        } else {
            // Show error
            errorDiv.textContent = result.error;
            errorDiv.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.textContent = isLoginMode ? 'Login' : 'Register';
        }
    });

    function updateModalMode() {
        const title = document.getElementById('auth-modal-title');
        const submitBtn = document.getElementById('auth-submit-btn');
        const switchText = document.getElementById('auth-switch-text');
        const displayNameGroup = document.getElementById('display-name-group');

        if (isLoginMode) {
            title.textContent = 'Login';
            submitBtn.textContent = 'Login';
            switchText.textContent = "Don't have an account?";
            switchLink.textContent = 'Register here';
            displayNameGroup.style.display = 'none';
        } else {
            title.textContent = 'Register';
            submitBtn.textContent = 'Register';
            switchText.textContent = 'Already have an account?';
            switchLink.textContent = 'Login here';
            displayNameGroup.style.display = 'block';
        }
        clearAuthForm();
    }

    function clearAuthForm() {
        document.getElementById('auth-email').value = '';
        document.getElementById('auth-password').value = '';
        document.getElementById('auth-display-name').value = '';
        document.getElementById('auth-error').style.display = 'none';
        document.getElementById('auth-submit-btn').disabled = false;
    }
}

// ============================================================================
// VIEW SWITCHING
// ============================================================================

function toggleView(view) {
    currentView = view;

    const speedometerView = document.getElementById('speedometer-view');
    const summaryView = document.getElementById('summary-view');
    const garageView = document.getElementById('garage-view');

    const btnSpeedometer = document.getElementById('btn-speedometer');
    const btnSummary = document.getElementById('btn-summary');
    const btnGarage = document.getElementById('btn-garage');

    // Hide all views
    speedometerView.style.display = 'none';
    summaryView.style.display = 'none';
    garageView.style.display = 'none';

    // Remove active class from all buttons
    btnSpeedometer.classList.remove('active');
    btnSummary.classList.remove('active');
    btnGarage.classList.remove('active');

    // Show selected view and activate button
    if (view === 'speedometer') {
        speedometerView.style.display = 'block';
        btnSpeedometer.classList.add('active');
    } else if (view === 'summary') {
        summaryView.style.display = 'block';
        btnSummary.classList.add('active');
        loadSummary(); // Load summary data when switching to summary view
    } else if (view === 'garage') {
        garageView.style.display = 'block';
        btnGarage.classList.add('active');
    }
}

// ============================================================================
// SUMMARY VIEW
// ============================================================================

function loadSummary() {
    const vMaxValue = summaryUnits.speed === 'mph' ? toMph(sessionVmax) : sessionVmax;
    const distValue = summaryUnits.distance === 'mi' ? (totalDistance * 0.621371) : totalDistance;

    const summaryContent = `
        <div class="summary-section">
            <h3>Current Session</h3>
            <div class="summary-grid">
                <div class="summary-stat">
                    <span class="stat-label">vMax</span>
                    <span class="stat-value stat-clickable" onclick="toggleSummaryUnits('speed')" title="Click to toggle units">
                        ${vMaxValue.toFixed(1)} ${summaryUnits.speed}
                    </span>
                </div>
                <div class="summary-stat">
                    <span class="stat-label">Distance</span>
                    <span class="stat-value stat-clickable" onclick="toggleSummaryUnits('distance')" title="Click to toggle units">
                        ${distValue.toFixed(2)} ${summaryUnits.distance}
                    </span>
                </div>
                <div class="summary-stat">
                    <span class="stat-label">Duration</span>
                    <span class="stat-value">${sessionStart ? formatDuration((Date.now() - new Date(sessionStart)) / 1000) : '0s'}</span>
                </div>
            </div>
        </div>

        <div class="summary-section">
            <h3>Performance Timers</h3>
            <div class="summary-timers">
                ${Object.keys(timers).length > 0 ?
                    Object.entries(timers).map(([key, value]) => `
                        <div class="summary-timer">
                            <span class="timer-name">${key}</span>
                            <span class="timer-time">${value}</span>
                        </div>
                    `).join('') :
                    '<p class="no-data">No timer data recorded yet</p>'
                }
            </div>
        </div>

        <div class="summary-section">
            <h3>Session History</h3>
            <div id="session-history">Loading...</div>
        </div>

        <div class="summary-section">
            <h3>Export Data</h3>
            <div class="export-buttons">
                <button class="btn" onclick="exportCSV()">📊 Export to Excel/CSV</button>
            </div>
        </div>

        <div class="summary-section">
            <h3>Test Data</h3>
            <p style="opacity: 0.7; font-size: 0.9em; margin-bottom: 15px;">Generate sample performance data for demonstration purposes</p>
            <div class="export-buttons">
                <button class="btn" onclick="generateGTRTestData()">🏎️ Generate R35 GT-R Data (750bhp)</button>
            </div>
        </div>

        <div class="summary-section">
            <h3>Data Management</h3>
            <p style="opacity: 0.7; font-size: 0.9em; margin-bottom: 15px;">Remove session data from the database</p>
            <div class="export-buttons">
                <button class="btn btn-reset" onclick="removeSampleData()">🗑️ Remove Sample Data</button>
                <button class="btn btn-reset" onclick="removeUserData()">🗑️ Remove Your Data</button>
                <button class="btn btn-reset" onclick="removeAllData()">⚠️ Remove All Data</button>
            </div>
        </div>
    `;

    document.getElementById('summary-content').innerHTML = summaryContent;

    // Load session history (includes user's own data + sample data)
    fetch(`/api/sessions/${deviceId}/all`)
        .then(res => res.json())
        .then(data => {
            const historyEl = document.getElementById('session-history');
            if (data.sessions && data.sessions.length > 0) {
                historyEl.innerHTML = data.sessions.map(session => {
                    const vMax = (session.vMax || 0);
                    const distance = (session.distance || 0);
                    const duration = formatDuration(session.duration || 0);

                    // Convert based on summary units preference
                    const vMaxDisplay = summaryUnits.speed === 'mph' ? toMph(vMax).toFixed(1) : vMax.toFixed(1);
                    const distDisplay = summaryUnits.distance === 'mi' ? (distance * 0.621371).toFixed(2) : distance.toFixed(2);

                    const inclineIndicator = session.onIncline ? ' <span class="incline-warning" title="Achieved on downhill">⚠️ Downhill</span>' : '';
                    const inclineClass = session.onIncline ? 'session-invalid' : '';

                    // Mark sample data sessions
                    const isSample = session.deviceId && session.deviceId.startsWith('SAMPLE-');
                    const sampleBadge = isSample ? ' <span style="background: rgba(0, 212, 255, 0.2); padding: 2px 8px; border-radius: 4px; font-size: 0.85em;">🏎️ Sample</span>' : '';

                    // Build timers HTML for accordion
                    let timersHTML = '';
                    if (session.timers && Object.keys(session.timers).length > 0) {
                        timersHTML = '<div class="session-timers" style="display: none;"><div class="timers-grid">';
                        for (const [key, value] of Object.entries(session.timers)) {
                            const timerTime = typeof value === 'object' ? value.time : value;
                            const timerInvalid = typeof value === 'object' && value.invalid;
                            const invalidClass = timerInvalid ? 'timer-invalid' : '';
                            const invalidIcon = timerInvalid ? ' ⚠️' : '';

                            timersHTML += `
                                <div class="timer-item ${invalidClass}">
                                    <span class="timer-label">${key}${invalidIcon}</span>
                                    <span class="timer-value">${timerTime}</span>
                                </div>
                            `;
                        }
                        timersHTML += '</div></div>';
                    }

                    const expandIcon = timersHTML ? '<span class="expand-icon" style="float: right; cursor: pointer; user-select: none;">▼</span>' : '';

                    return `
                        <div class="history-item ${inclineClass}" onclick="toggleSessionDetails(this)" style="cursor: pointer;">
                            <div class="history-date">${new Date(session.timestamp).toLocaleString()}${sampleBadge}${expandIcon}</div>
                            <div class="history-stats">
                                <span>vMax: ${vMaxDisplay} ${summaryUnits.speed}</span>
                                <span>Distance: ${distDisplay} ${summaryUnits.distance}</span>
                                <span>Duration: ${duration}</span>
                                ${inclineIndicator}
                            </div>
                            ${timersHTML}
                        </div>
                    `;
                }).join('');
            } else {
                historyEl.innerHTML = '<p class="no-data">No previous sessions</p>';
            }
        })
        .catch(err => {
            document.getElementById('session-history').innerHTML = '<p class="error">Failed to load history</p>';
        });
}

// ============================================================================
// GARAGE FUNCTIONALITY
// ============================================================================

async function loadUserCars() {
    if (!isAuthenticated) {
        userCars = [];
        activeCar = null;
        return;
    }

    const result = await AuthService.apiRequest('/api/cars', { method: 'GET' });
    if (result.success) {
        userCars = result.data.cars || [];
        activeCar = userCars.find(car => car.isActive) || null;
        renderCarsList();
    } else {
        console.error('Failed to load cars:', result.error);
    }
}

function renderCarsList() {
    const carsGrid = document.getElementById('cars-grid');
    const emptyGarage = document.getElementById('empty-garage');

    if (userCars.length === 0) {
        carsGrid.style.display = 'none';
        emptyGarage.style.display = 'block';
        return;
    }

    carsGrid.style.display = 'grid';
    emptyGarage.style.display = 'none';

    carsGrid.innerHTML = userCars.map(car => {
        const isActive = car.isActive;
        const photoUrl = car.photoUrl || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjE4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMzMzIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMjAiIGZpbGw9IiM2NjYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBQaG90bzwvdGV4dD48L3N2Zz4=';

        return `
            <div class="car-card ${isActive ? 'active-car' : ''}" data-car-id="${car.id}">
                ${isActive ? '<div class="active-badge">ACTIVE</div>' : ''}
                <img src="${photoUrl}" alt="${car.name}" class="car-photo" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjE4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMzMzIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMjAiIGZpbGw9IiM2NjYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBQaG90bzwvdGV4dD48L3N2Zz4='">
                <div class="car-info">
                    <h3>${car.name}</h3>
                    <div class="car-details">
                        <p><strong>${car.make} ${car.model}</strong></p>
                        ${car.year ? `<p>Year: ${car.year}</p>` : ''}
                        ${car.horsepower ? `<p>Power: ${car.horsepower} HP</p>` : ''}
                    </div>
                    <div class="car-stats">
                        <h4>Best Times</h4>
                        <p>Sessions: ${car.sessionCount || 0}</p>
                        ${car.stats && car.stats.vMax ? `<p>V-Max: ${car.stats.vMax.toFixed(1)} km/h</p>` : ''}
                        ${car.stats && car.stats.bestTimes && Object.keys(car.stats.bestTimes).length > 0
                            ? Object.entries(car.stats.bestTimes).slice(0, 3).map(([key, time]) =>
                                `<p>${key}: ${time.toFixed(2)}s</p>`
                              ).join('')
                            : '<p>No times recorded yet</p>'
                        }
                    </div>
                    <div class="car-actions">
                        ${!isActive ? `<button class="btn btn-set-active" onclick="setActiveCar(${car.id})">Set Active</button>` : ''}
                        <button class="btn btn-edit" onclick="editCar(${car.id})">Edit</button>
                        <button class="btn btn-delete" onclick="deleteCar(${car.id})">Delete</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

async function setActiveCar(carId) {
    const result = await AuthService.apiRequest(`/api/cars/${carId}/set-active`, {
        method: 'PUT'
    });

    if (result.success) {
        await loadUserCars(); // Reload to update UI
    } else {
        alert('Failed to set active car: ' + result.error);
    }
}

async function addCar(carData) {
    const result = await AuthService.apiRequest('/api/cars', {
        method: 'POST',
        body: JSON.stringify(carData)
    });

    if (result.success) {
        await loadUserCars(); // Reload cars list
        return { success: true };
    } else {
        return { success: false, error: result.error };
    }
}

async function updateCar(carId, carData) {
    const result = await AuthService.apiRequest(`/api/cars/${carId}`, {
        method: 'PUT',
        body: JSON.stringify(carData)
    });

    if (result.success) {
        await loadUserCars(); // Reload cars list
        return { success: true };
    } else {
        return { success: false, error: result.error };
    }
}

async function deleteCar(carId) {
    if (!confirm('Are you sure you want to delete this car? This will not delete your sessions.')) {
        return;
    }

    const result = await AuthService.apiRequest(`/api/cars/${carId}`, {
        method: 'DELETE'
    });

    if (result.success) {
        await loadUserCars(); // Reload cars list
    } else {
        alert('Failed to delete car: ' + result.error);
    }
}

function editCar(carId) {
    const car = userCars.find(c => c.id === carId);
    if (!car) return;

    editingCarId = carId;

    // Fill the form with car data
    document.getElementById('car-name').value = car.name || '';
    document.getElementById('car-make').value = car.make || '';
    document.getElementById('car-model').value = car.model || '';
    document.getElementById('car-year').value = car.year || '';
    document.getElementById('car-horsepower').value = car.horsepower || '';
    document.getElementById('car-photo-url').value = car.photoUrl || '';

    // Update modal title
    document.getElementById('car-modal-title').textContent = 'Edit Car';
    document.getElementById('car-form-submit').textContent = 'Update Car';

    // Show modal
    document.getElementById('car-modal').style.display = 'flex';
}

function setupGarageEventListeners() {
    const garageBtn = document.getElementById('btn-garage');
    const addCarBtn = document.getElementById('btn-add-car');
    const carModal = document.getElementById('car-modal');
    const carModalClose = document.getElementById('car-modal-close');
    const carForm = document.getElementById('car-form');
    const carFormCancel = document.getElementById('car-form-cancel');
    const carFormError = document.getElementById('car-form-error');

    // Garage button - toggle to garage view
    garageBtn.addEventListener('click', () => {
        toggleView('garage');
        loadUserCars(); // Reload cars when opening garage
    });

    // Add car button
    addCarBtn.addEventListener('click', () => {
        editingCarId = null;
        document.getElementById('car-modal-title').textContent = 'Add Car';
        document.getElementById('car-form-submit').textContent = 'Save Car';
        carForm.reset();
        carFormError.style.display = 'none';
        carModal.style.display = 'flex';
    });

    // Close modal
    carModalClose.addEventListener('click', () => {
        carModal.style.display = 'none';
        carForm.reset();
        editingCarId = null;
    });

    carFormCancel.addEventListener('click', () => {
        carModal.style.display = 'none';
        carForm.reset();
        editingCarId = null;
    });

    // Close modal on outside click
    carModal.addEventListener('click', (e) => {
        if (e.target === carModal) {
            carModal.style.display = 'none';
            carForm.reset();
            editingCarId = null;
        }
    });

    // Handle form submission
    carForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const carData = {
            name: document.getElementById('car-name').value,
            make: document.getElementById('car-make').value,
            model: document.getElementById('car-model').value,
            year: document.getElementById('car-year').value || null,
            horsepower: document.getElementById('car-horsepower').value || null,
            photoUrl: document.getElementById('car-photo-url').value || null
        };

        const submitBtn = document.getElementById('car-form-submit');
        submitBtn.disabled = true;
        submitBtn.textContent = editingCarId ? 'Updating...' : 'Saving...';
        carFormError.style.display = 'none';

        let result;
        if (editingCarId) {
            result = await updateCar(editingCarId, carData);
        } else {
            result = await addCar(carData);
        }

        if (result.success) {
            carModal.style.display = 'none';
            carForm.reset();
            editingCarId = null;
        } else {
            carFormError.textContent = result.error || 'Failed to save car';
            carFormError.style.display = 'block';

            // If auth error, prompt user to login and close modal
            if (result.needsAuth) {
                setTimeout(() => {
                    carModal.style.display = 'none';
                    carForm.reset();
                    editingCarId = null;
                    // Reset auth state and show login prompt
                    isAuthenticated = false;
                    currentUser = null;
                    updateAuthUI();
                }, 2000); // Show error for 2 seconds before closing
            }
        }

        submitBtn.disabled = false;
        submitBtn.textContent = editingCarId ? 'Update Car' : 'Save Car';
    });
}

async function init() {
    // Check authentication status first
    checkAuthStatus();
    setupAuthEventListeners();
    setupGarageEventListeners();

    await getCountryFromIP();

    // Set up button event listeners
    document.getElementById('btn-reset').addEventListener('click', resetSession);
    document.getElementById('btn-speedometer').addEventListener('click', () => toggleView('speedometer'));
    document.getElementById('btn-summary').addEventListener('click', () => toggleView('summary'));

    // Add tap-to-toggle units feature on speed circle
    document.querySelector('.speed-circle').addEventListener('click', toggleUnits);

    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(watchPosition, (err) => console.log(err), { enableHighAccuracy: true, maximumAge: 1000 });
        startInterpolation(); // Start interpolation for smoother display
    } else {
        alert('Geolocation not supported');
    }
}

init();
