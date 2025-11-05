#!/usr/bin/env node

/**
 * SpeedoPage V2 Migration - User Accounts & Multi-Car System
 *
 * This migration adds:
 * - User authentication (users table)
 * - Multi-car garage (cars table)
 * - Enhanced sessions table (replaces speed logs)
 * - Social features (follows table)
 * - Achievements system
 * - Password reset tokens
 *
 * IMPORTANT: Run this on a backup database first!
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Configuration
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'speeds.db');
const DRY_RUN = process.argv.includes('--dry-run');

console.log('=== SpeedoPage V2 Migration ===');
console.log(`Database: ${DB_PATH}`);
console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE'}`);
console.log('');

// Open database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Failed to open database:', err.message);
    process.exit(1);
  }
  console.log('✓ Database opened successfully');
});

// Helper function to run SQL and return a promise
function runSQL(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function allSQL(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getSQL(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function migrate() {
  try {
    console.log('\n📋 Step 1: Checking current database state...');

    // Check if migration already ran
    const tables = await allSQL(
      "SELECT name FROM sqlite_master WHERE type='table'"
    );
    const tableNames = tables.map(t => t.name);

    if (tableNames.includes('users')) {
      console.log('⚠️  Migration appears to have already run (users table exists)');
      console.log('   Use --force flag to re-run (WARNING: data loss)');
      if (!process.argv.includes('--force')) {
        process.exit(0);
      }
    }

    console.log(`   Found ${tableNames.length} existing tables:`, tableNames.join(', '));

    if (DRY_RUN) {
      console.log('\n🔍 DRY RUN MODE - No changes will be made\n');
    }

    console.log('\n📋 Step 2: Creating new tables...');

    // Create users table
    console.log('   Creating users table...');
    if (!DRY_RUN) {
      await runSQL(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          passwordHash TEXT NOT NULL,
          displayName TEXT,
          avatarUrl TEXT,
          unitsPreference TEXT DEFAULT 'auto',
          isEmailVerified BOOLEAN DEFAULT 0,
          isPublicProfile BOOLEAN DEFAULT 0,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          lastLoginAt DATETIME,
          accountStatus TEXT DEFAULT 'active'
        )
      `);
      await runSQL('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
      console.log('   ✓ users table created');
    } else {
      console.log('   [DRY RUN] Would create users table');
    }

    // Create cars table
    console.log('   Creating cars table...');
    if (!DRY_RUN) {
      await runSQL(`
        CREATE TABLE IF NOT EXISTS cars (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId INTEGER NOT NULL,
          name TEXT NOT NULL,
          make TEXT,
          model TEXT,
          year INTEGER,
          trim TEXT,
          color TEXT,
          photoUrl TEXT,
          weight REAL,
          horsepower INTEGER,
          modifications TEXT,
          isActive BOOLEAN DEFAULT 1,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME,
          FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      await runSQL('CREATE INDEX IF NOT EXISTS idx_cars_userId ON cars(userId)');
      await runSQL('CREATE INDEX IF NOT EXISTS idx_cars_userId_active ON cars(userId, isActive)');
      console.log('   ✓ cars table created');
    } else {
      console.log('   [DRY RUN] Would create cars table');
    }

    // Backup existing sessions table if it exists
    if (tableNames.includes('sessions')) {
      console.log('   Backing up existing sessions table...');
      if (!DRY_RUN) {
        await runSQL('ALTER TABLE sessions RENAME TO sessions_backup');
        console.log('   ✓ Existing sessions backed up to sessions_backup');
      } else {
        console.log('   [DRY RUN] Would backup existing sessions table');
      }
    }

    // Create enhanced sessions table
    console.log('   Creating enhanced sessions table...');
    if (!DRY_RUN) {
      await runSQL(`
        CREATE TABLE IF NOT EXISTS sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId INTEGER,
          carId INTEGER,
          deviceId TEXT,
          startTime DATETIME NOT NULL,
          endTime DATETIME NOT NULL,
          vMax REAL NOT NULL,
          distance REAL,
          duration INTEGER,
          timers TEXT,
          onIncline BOOLEAN DEFAULT 0,
          location TEXT,
          latitude REAL,
          longitude REAL,
          weatherConditions TEXT,
          notes TEXT,
          tags TEXT,
          isPublic BOOLEAN DEFAULT 0,
          shareToken TEXT UNIQUE,
          videoUrl TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (carId) REFERENCES cars(id) ON DELETE SET NULL
        )
      `);
      await runSQL('CREATE INDEX IF NOT EXISTS idx_sessions_userId ON sessions(userId)');
      await runSQL('CREATE INDEX IF NOT EXISTS idx_sessions_carId ON sessions(carId)');
      await runSQL('CREATE INDEX IF NOT EXISTS idx_sessions_deviceId ON sessions(deviceId)');
      await runSQL('CREATE INDEX IF NOT EXISTS idx_sessions_shareToken ON sessions(shareToken)');
      await runSQL('CREATE INDEX IF NOT EXISTS idx_sessions_startTime ON sessions(startTime)');
      console.log('   ✓ sessions table created');
    } else {
      console.log('   [DRY RUN] Would create enhanced sessions table');
    }

    // Create achievements table
    console.log('   Creating achievements table...');
    if (!DRY_RUN) {
      await runSQL(`
        CREATE TABLE IF NOT EXISTS achievements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId INTEGER NOT NULL,
          achievementType TEXT NOT NULL,
          achievedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          metadata TEXT,
          FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      await runSQL('CREATE INDEX IF NOT EXISTS idx_achievements_userId ON achievements(userId)');
      console.log('   ✓ achievements table created');
    } else {
      console.log('   [DRY RUN] Would create achievements table');
    }

    // Create follows table
    console.log('   Creating follows table...');
    if (!DRY_RUN) {
      await runSQL(`
        CREATE TABLE IF NOT EXISTS follows (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          followerId INTEGER NOT NULL,
          followingId INTEGER NOT NULL,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (followerId) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (followingId) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE(followerId, followingId)
        )
      `);
      await runSQL('CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(followerId)');
      await runSQL('CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(followingId)');
      console.log('   ✓ follows table created');
    } else {
      console.log('   [DRY RUN] Would create follows table');
    }

    // Create password_resets table
    console.log('   Creating password_resets table...');
    if (!DRY_RUN) {
      await runSQL(`
        CREATE TABLE IF NOT EXISTS password_resets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId INTEGER NOT NULL,
          token TEXT UNIQUE NOT NULL,
          expiresAt DATETIME NOT NULL,
          usedAt DATETIME,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      await runSQL('CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token)');
      console.log('   ✓ password_resets table created');
    } else {
      console.log('   [DRY RUN] Would create password_resets table');
    }

    // Migrate existing sessions_backup data if it exists
    if (tableNames.includes('sessions') || tableNames.includes('sessions_backup')) {
      console.log('\n📋 Step 3: Migrating existing session data...');

      const backupTable = tableNames.includes('sessions_backup') ? 'sessions_backup' : 'sessions';
      const existingSessions = await allSQL(`SELECT * FROM ${backupTable}`);

      console.log(`   Found ${existingSessions.length} existing sessions to migrate`);

      if (!DRY_RUN && existingSessions.length > 0) {
        let migrated = 0;
        for (const session of existingSessions) {
          try {
            await runSQL(`
              INSERT INTO sessions (
                deviceId, startTime, endTime, vMax, distance, duration,
                timers, onIncline, createdAt
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              session.deviceId,
              session.startTime,
              session.endTime,
              session.vMax,
              session.distance,
              session.duration,
              session.timers,
              session.onIncline || 0,
              session.timestamp || session.createdAt || new Date().toISOString()
            ]);
            migrated++;
          } catch (err) {
            console.error(`   ⚠️  Failed to migrate session ${session.id}:`, err.message);
          }
        }
        console.log(`   ✓ Migrated ${migrated} sessions`);
      } else if (DRY_RUN) {
        console.log(`   [DRY RUN] Would migrate ${existingSessions.length} sessions`);
      }
    }

    console.log('\n📋 Step 4: Verifying migration...');

    const finalTables = await allSQL(
      "SELECT name FROM sqlite_master WHERE type='table'"
    );
    console.log(`   ✓ Database now has ${finalTables.length} tables`);

    // Count records
    if (!DRY_RUN) {
      const userCount = await getSQL('SELECT COUNT(*) as count FROM users');
      const carCount = await getSQL('SELECT COUNT(*) as count FROM cars');
      const sessionCount = await getSQL('SELECT COUNT(*) as count FROM sessions');

      console.log(`   - Users: ${userCount.count}`);
      console.log(`   - Cars: ${carCount.count}`);
      console.log(`   - Sessions: ${sessionCount.count}`);
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Test the application locally');
    console.log('2. Verify data integrity');
    console.log('3. Update server.js to use new schema');
    console.log('4. Deploy to production');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
      }
    });
  }
}

// Run migration
migrate();
