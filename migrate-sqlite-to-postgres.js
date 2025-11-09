#!/usr/bin/env node

/**
 * Migrate data from SQLite (speeds.db) to PostgreSQL
 *
 * This script reads all data from the SQLite database and inserts it into PostgreSQL
 * while preserving relationships and data integrity.
 */

const sqlite3 = require('sqlite3').verbose();
const { query, pool, closeConnections } = require('./db/connection');
require('dotenv').config();

const sqliteDb = new sqlite3.Database('./speeds.db');

// Promisify SQLite operations
function sqliteAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    sqliteDb.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function migrateUsers() {
  console.log('\n📋 Migrating users table...');

  try {
    const users = await sqliteAll('SELECT * FROM users');

    if (users.length === 0) {
      console.log('  ℹ️  No users to migrate');
      return;
    }

    for (const user of users) {
      // Map SQLite column names to PostgreSQL snake_case
      await query(
        `INSERT INTO users (id, email, password_hash, display_name, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (email) DO NOTHING`,
        [
          user.id,
          user.email,
          user.passwordHash,
          user.displayName || null,
          user.createdAt || new Date().toISOString(),
          user.updatedAt || new Date().toISOString()
        ]
      );
    }

    // Reset sequence to match max ID
    const maxId = Math.max(...users.map(u => u.id));
    await query(`SELECT setval('users_id_seq', $1)`, [maxId]);

    console.log(`  ✓ Migrated ${users.length} users`);
  } catch (err) {
    console.error('  ✗ Error migrating users:', err.message);
    throw err;
  }
}

async function migrateCars() {
  console.log('\n🚗 Migrating cars table...');

  try {
    const cars = await sqliteAll('SELECT * FROM cars');

    if (cars.length === 0) {
      console.log('  ℹ️  No cars to migrate');
      return;
    }

    for (const car of cars) {
      await query(
        `INSERT INTO cars (id, user_id, name, make, model, year, horsepower, photo_url, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO NOTHING`,
        [
          car.id,
          car.userId,
          car.name,
          car.make,
          car.model,
          car.year || null,
          car.horsepower || null,
          car.photoUrl || null,
          car.isActive || false,
          car.createdAt || new Date().toISOString(),
          car.updatedAt || new Date().toISOString()
        ]
      );
    }

    // Reset sequence
    const maxId = Math.max(...cars.map(c => c.id));
    await query(`SELECT setval('cars_id_seq', $1)`, [maxId]);

    console.log(`  ✓ Migrated ${cars.length} cars`);
  } catch (err) {
    console.error('  ✗ Error migrating cars:', err.message);
    throw err;
  }
}

async function migrateSpeeds() {
  console.log('\n📊 Migrating speeds table...');

  try {
    const speeds = await sqliteAll('SELECT * FROM speeds');

    if (speeds.length === 0) {
      console.log('  ℹ️  No speed logs to migrate');
      return;
    }

    console.log(`  ⏳ Processing ${speeds.length} speed records...`);

    // Batch insert for performance
    const batchSize = 1000;
    for (let i = 0; i < speeds.length; i += batchSize) {
      const batch = speeds.slice(i, i + batchSize);
      const values = [];
      const params = [];
      let paramIndex = 1;

      for (const speed of batch) {
        values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2})`);
        params.push(speed.deviceId, speed.speed, speed.timestamp);
        paramIndex += 3;
      }

      await query(
        `INSERT INTO speeds (device_id, speed, timestamp) VALUES ${values.join(', ')}`,
        params
      );

      console.log(`  ⏳ Migrated ${Math.min(i + batchSize, speeds.length)}/${speeds.length} speed records`);
    }

    console.log(`  ✓ Migrated ${speeds.length} speed records`);
  } catch (err) {
    console.error('  ✗ Error migrating speeds:', err.message);
    throw err;
  }
}

async function migrateSessions() {
  console.log('\n🏁 Migrating sessions table...');

  try {
    const sessions = await sqliteAll('SELECT * FROM sessions');

    if (sessions.length === 0) {
      console.log('  ℹ️  No sessions to migrate');
      return;
    }

    for (const session of sessions) {
      // Parse timers JSON (SQLite stores as TEXT, PostgreSQL uses JSONB)
      let timersJSON = null;
      if (session.timers) {
        try {
          timersJSON = JSON.parse(session.timers);
        } catch (e) {
          console.warn(`  ⚠️  Failed to parse timers for session ${session.id}`);
          timersJSON = {};
        }
      }

      await query(
        `INSERT INTO sessions (id, user_id, car_id, device_id, start_time, end_time, v_max, distance, duration, timers, on_incline, timestamp, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (id) DO NOTHING`,
        [
          session.id,
          session.userId || null,
          session.carId || null,
          session.deviceId || null,
          session.startTime,
          session.endTime,
          session.vMax || null,
          session.distance || null,
          session.duration || null,
          JSON.stringify(timersJSON), // Convert to JSONB
          session.onIncline || false,
          session.timestamp || session.createdAt || new Date().toISOString(),
          session.createdAt || new Date().toISOString()
        ]
      );
    }

    // Reset sequence
    const maxId = Math.max(...sessions.map(s => s.id));
    await query(`SELECT setval('sessions_id_seq', $1)`, [maxId]);

    console.log(`  ✓ Migrated ${sessions.length} sessions`);
  } catch (err) {
    console.error('  ✗ Error migrating sessions:', err.message);
    throw err;
  }
}

async function main() {
  console.log('🚀 Starting SQLite to PostgreSQL migration...\n');
  console.log('Source: speeds.db (SQLite)');
  console.log(`Target: ${process.env.DB_URL}\n`);

  try {
    // Migrate in order of dependencies
    await migrateUsers();
    await migrateCars();
    await migrateSpeeds();
    await migrateSessions();

    console.log('\n✅ Migration completed successfully!\n');

    // Show summary
    const userCount = await query('SELECT COUNT(*) FROM users');
    const carCount = await query('SELECT COUNT(*) FROM cars');
    const speedCount = await query('SELECT COUNT(*) FROM speeds');
    const sessionCount = await query('SELECT COUNT(*) FROM sessions');

    console.log('📊 Database Summary:');
    console.log(`  Users:    ${userCount.rows[0].count}`);
    console.log(`  Cars:     ${carCount.rows[0].count}`);
    console.log(`  Speeds:   ${speedCount.rows[0].count}`);
    console.log(`  Sessions: ${sessionCount.rows[0].count}`);
    console.log('');

  } catch (err) {
    console.error('\n❌ Migration failed:', err);
    process.exit(1);
  } finally {
    sqliteDb.close();
    await closeConnections();
  }
}

// Run migration
if (require.main === module) {
  main();
}

module.exports = { main };
