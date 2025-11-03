let units = 'kmh'; // default
let altUnits = 'mph';
let currentCountry = '';
let speed = 0;
let lastPosition = null;
let lastTime = Date.now();
let timers = {};
let timerStart = null;
let distances = { '1/8': 0.201168, '1/4': 0.402336, '1/2': 0.804672, '1': 1.609344 }; // miles to km
let timerTargets = {
    '0-60': 60, '0-100': 100, '0-150': 150, '0-200': 200,
    '30-60': 60, '60-120': 120, '60-130': 130, '100-150': 150,
    '0-100kmh': 100, '0-160kmh': 160, '0-250kmh': 250, '0-320kmh': 320,
    '100-200kmh': 200, '160-240kmh': 240
};
let dragTargets = ['1/8 mile', '1/4 mile', '1/2 mile', 'standing mile'];
let vmax = 0;
let lastCountryCheck = 0;
let deviceId = localStorage.getItem('deviceId') || generateDeviceId();
let lastLogTime = 0;

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
    if (['US', 'GB', 'MM'].includes(country)) { // mph countries
        units = 'mph';
        altUnits = 'kmh';
    } else {
        units = 'kmh';
        altUnits = 'mph';
    }
}

function toMph(kmh) { return kmh * 0.621371; }
function toKmh(mph) { return mph / 0.621371; }

function updateDisplay() {
    const displaySpeed = units === 'mph' ? toMph(speed) : speed;
    const altDisplay = altUnits === 'mph' ? toMph(speed) : speed;
    document.getElementById('speed').textContent = displaySpeed.toFixed(1) + ' ' + units;
    document.getElementById('alt-speed').textContent = altDisplay.toFixed(1) + ' ' + altUnits;
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
    getCountryFromCoords(lat, lon);
    if (lastPosition) {
        const dist = haversine(lastPosition.lat, lastPosition.lon, lat, lon);
        const timeDiff = (now - lastTime) / 1000; // seconds
        speed = (dist / timeDiff) * 3600; // kmh
        vmax = Math.max(vmax, speed);
        updateTimers(speed, timeDiff, dist);
    }
    lastPosition = { lat, lon };
    lastTime = now;
    updateDisplay();
    logSpeed();
}

function updateTimers(currentSpeed, timeDiff, dist) {
    if (currentSpeed < 1) {
        resetTimers();
        return;
    }
    if (!timerStart) timerStart = Date.now();
    const elapsed = (Date.now() - timerStart) / 1000;
    // speed timers
    Object.keys(timerTargets).forEach(key => {
        if (!timers[key] && currentSpeed >= timerTargets[key]) {
            timers[key] = elapsed.toFixed(2);
        }
    });
    // drag timers
    dragTargets.forEach(target => {
        const distKm = distances[target.split(' ')[0]];
        if (!timers[target] && dist >= distKm) {
            timers[target] = elapsed.toFixed(2) + 's @ ' + currentSpeed.toFixed(1) + 'kmh';
        }
    });
    displayTimers();
}

function resetTimers() {
    timers = {};
    timerStart = null;
    vmax = 0;
    displayTimers();
}

function displayTimers() {
    let html = '';
    Object.keys(timers).forEach(key => {
        html += `<div class="timer">${key}: ${timers[key]}</div>`;
    });
    if (vmax > 0) html += `<div class="timer">Vmax: ${vmax.toFixed(1)} kmh</div>`;
    document.getElementById('timers').innerHTML = html;
}

function generateDeviceId() {
    const id = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
    localStorage.setItem('deviceId', id);
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

async function init() {
    await getCountryFromIP();
    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(watchPosition, (err) => console.log(err), { enableHighAccuracy: true, maximumAge: 1000 });
    } else {
        alert('Geolocation not supported');
    }
}

init();