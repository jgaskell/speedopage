#!/bin/bash
# Fix Database Permissions Script
# Run this on AWS as: sudo su - nodeapp -c './fix-db-permissions.sh'

set -e

APP_DIR="/home/nodeapp/apps/speedopage"
DB_PATH="$APP_DIR/speeds.db"

echo "=== SpeedoPage Database Permission Fix ==="
echo ""

# Check current permissions
echo "1. Current database permissions:"
ls -la "$DB_PATH" 2>/dev/null || echo "   Database file not found at $DB_PATH"
echo ""

# Check directory permissions
echo "2. Current directory permissions:"
ls -ld "$APP_DIR"
echo ""

# Fix database file permissions
if [ -f "$DB_PATH" ]; then
    echo "3. Fixing database file permissions..."
    chmod 666 "$DB_PATH"
    echo "   ✓ Set database to rw-rw-rw-"
else
    echo "3. ⚠ Database file not found - will be created on first write"
fi
echo ""

# Fix directory permissions (SQLite needs to create journal/wal files)
echo "4. Fixing directory permissions..."
chmod 775 "$APP_DIR"
echo "   ✓ Set directory to rwxrwxr-x"
echo ""

# Verify ownership
echo "5. Verifying ownership..."
if [ -f "$DB_PATH" ]; then
    chown nodeapp:nodeapp "$DB_PATH" 2>/dev/null || echo "   ⚠ Could not change ownership (may need sudo)"
fi
chown nodeapp:nodeapp "$APP_DIR" 2>/dev/null || echo "   ⚠ Could not change directory ownership (may need sudo)"
echo ""

# Show final state
echo "6. Final permissions:"
ls -la "$DB_PATH" 2>/dev/null || echo "   Database not yet created"
ls -ld "$APP_DIR"
echo ""

# Test write permissions
echo "7. Testing write permissions..."
if [ -w "$DB_PATH" ]; then
    echo "   ✓ Database file is writable"
else
    echo "   ✗ Database file is NOT writable"
fi

if [ -w "$APP_DIR" ]; then
    echo "   ✓ Directory is writable"
else
    echo "   ✗ Directory is NOT writable"
fi
echo ""

echo "=== Permission Fix Complete ==="
echo ""
echo "Next steps:"
echo "1. Restart PM2: pm2 restart speedopage"
echo "2. Check logs: pm2 logs speedopage --lines 20"
echo "3. Test deletion: curl -k -X DELETE 'https://localhost:3000/api/sessions/sample'"
