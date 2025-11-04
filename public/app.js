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

function watchPosition(position) {
    const now = Date.now();
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;

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
            timers[key] = elapsed.toFixed(2) + 's';
        }
    });

    // drag timers
    dragTargets.forEach(target => {
        const distKm = distances[target.split(' ')[0]];
        if (!timers[target] && totalDist >= distKm) {
            timers[target] = elapsed.toFixed(2) + 's @ ' + currentSpeed.toFixed(1) + ' km/h';
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
        const sessionData = {
            deviceId,
            startTime: sessionStart,
            endTime: new Date().toISOString(),
            vMax: sessionVmax,
            distance: totalDistance,
            duration: Math.floor((Date.now() - new Date(sessionStart)) / 1000),
            timers: { ...timers }
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
        html += `<div class="timer-item">
            <span class="timer-label">${key}</span>
            <span class="timer-value">${value}</span>
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

function loadSummary() {
    const summaryContent = `
        <div class="summary-section">
            <h3>Current Session</h3>
            <div class="summary-grid">
                <div class="summary-stat">
                    <span class="stat-label">vMax</span>
                    <span class="stat-value">${sessionVmax.toFixed(1)} km/h</span>
                </div>
                <div class="summary-stat">
                    <span class="stat-label">Distance</span>
                    <span class="stat-value">${totalDistance.toFixed(2)} km</span>
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
    `;

    document.getElementById('summary-content').innerHTML = summaryContent;

    // Load session history
    fetch(`/api/sessions/${deviceId}`)
        .then(res => res.json())
        .then(data => {
            const historyEl = document.getElementById('session-history');
            if (data.sessions && data.sessions.length > 0) {
                historyEl.innerHTML = data.sessions.map(session => {
                    // BUG FIX #12: Proper NULL handling for session values
                    const vMax = (session.vMax || 0).toFixed(1);
                    const distance = (session.distance || 0).toFixed(2);
                    const duration = formatDuration(session.duration || 0);
                    return `
                        <div class="history-item">
                            <div class="history-date">${new Date(session.timestamp).toLocaleString()}</div>
                            <div class="history-stats">
                                <span>vMax: ${vMax} km/h</span>
                                <span>Distance: ${distance} km</span>
                                <span>Duration: ${duration}</span>
                            </div>
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

function formatDuration(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
}

async function init() {
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
