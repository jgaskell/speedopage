#!/bin/bash

# Test posting a session to the API
# Usage: ./test-session-post.sh [server-url]

SERVER="${1:-https://speedo.blownbytwins.co.uk}"
DEVICE_ID="test-$(date +%s)"

echo "Testing session POST to: $SERVER/api/save-session"
echo "Device ID: $DEVICE_ID"
echo ""

# Create a simple test session
curl -v -k -X POST "$SERVER/api/save-session" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "'$DEVICE_ID'",
    "startTime": "2025-11-04T10:00:00.000Z",
    "endTime": "2025-11-04T10:01:00.000Z",
    "vMax": 100.5,
    "distance": 1.5,
    "duration": 60,
    "timers": {
      "0-60": {
        "time": "5.0s",
        "invalid": false
      }
    },
    "onIncline": false
  }'

echo ""
echo ""
echo "Check server logs for error details"
