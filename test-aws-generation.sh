#!/bin/bash

# Test script to diagnose AWS test data generation issue

SERVER="https://speedo.blownbytwins.co.uk"
SAMPLE_ID="SAMPLE-GTR-test123"

echo "Testing AWS server test data generation..."
echo "Server: $SERVER"
echo ""

# Test 1: Check if server is responding
echo "1. Testing server health..."
curl -k -s -o /dev/null -w "HTTP Status: %{http_code}\n" "$SERVER/"

echo ""
echo "2. Testing /api/save-session endpoint with sample data..."

# Create a test session with comprehensive timers (like the GT-R data)
curl -v -k -X POST "$SERVER/api/save-session" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "'$SAMPLE_ID'",
    "startTime": "2025-11-04T15:00:00.000Z",
    "endTime": "2025-11-04T15:00:52.000Z",
    "vMax": 318.4,
    "distance": 1.609344,
    "duration": 52,
    "timers": {
      "0-60": {"time": "2.41s", "invalid": false},
      "0-100": {"time": "5.23s", "invalid": false},
      "0-150": {"time": "10.68s", "invalid": false},
      "0-100kmh": {"time": "2.52s", "invalid": false},
      "0-160kmh": {"time": "5.45s", "invalid": false},
      "1/4 mile": {"time": "9.87s @ 238.2 km/h", "invalid": false},
      "1/2 mile": {"time": "16.34s @ 301.5 km/h", "invalid": false},
      "standing mile": {"time": "24.89s @ 318.4 km/h", "invalid": false}
    },
    "onIncline": false
  }' 2>&1 | tee /tmp/aws-test-response.txt

echo ""
echo ""
echo "3. Full response saved to /tmp/aws-test-response.txt"
echo ""
echo "4. Checking if session was created by fetching all sessions..."
curl -k -s "$SERVER/api/sessions/00000000-0000-0000-0000-000000000000/all" | grep -o "\"deviceId\":\"SAMPLE-" | wc -l | xargs echo "Sample sessions found:"

echo ""
echo "Done. Check the output above for errors."
