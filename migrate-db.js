#!/usr/bin/env node

/**
 * Database migration script for SpeedoPage
 * Adds onIncline column to sessions table if it doesn't exist
 *
 * Usage: node migrate-db.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'speeds.db');
console.log(`Opening database: ${dbPath}`);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }
  console.log('✓ Database opened successfully');
});

// Check current schema
db.all("PRAGMA table_info(sessions)", (err, columns) => {
  if (err) {
    console.error('Error checking sessions table:', err);
    db.close();
    process.exit(1);
  }

  console.log('\nCurrent sessions table schema:');
  columns.forEach(col => {
    console.log(`  - ${col.name}: ${col.type}${col.notnull ? ' NOT NULL' : ''}${col.dflt_value ? ` DEFAULT ${col.dflt_value}` : ''}`);
  });

  const hasOnIncline = columns.some(col => col.name === 'onIncline');

  if (hasOnIncline) {
    console.log('\n✓ onIncline column already exists - no migration needed');
    db.close();
    return;
  }

  console.log('\n⚠ onIncline column missing - adding now...');

  db.run('ALTER TABLE sessions ADD COLUMN onIncline BOOLEAN DEFAULT 0', (err) => {
    if (err) {
      console.error('✗ Migration failed:', err.message);
      db.close();
      process.exit(1);
    }

    console.log('✓ Successfully added onIncline column');

    // Verify
    db.all("PRAGMA table_info(sessions)", (err, newColumns) => {
      if (err) {
        console.error('Error verifying migration:', err);
        db.close();
        process.exit(1);
      }

      console.log('\nUpdated sessions table schema:');
      newColumns.forEach(col => {
        console.log(`  - ${col.name}: ${col.type}${col.notnull ? ' NOT NULL' : ''}${col.dflt_value ? ` DEFAULT ${col.dflt_value}` : ''}`);
      });

      console.log('\n✅ Migration complete!');
      db.close();
    });
  });
});
