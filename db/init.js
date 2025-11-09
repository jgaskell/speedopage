// Database initialization script
// Run this to create tables in PostgreSQL

const fs = require('fs');
const path = require('path');
const { pool, closeConnections } = require('./connection');

async function initDatabase() {
  try {
    console.log('Initializing PostgreSQL database...');

    // Read schema file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Execute schema
    await pool.query(schema);

    console.log('✓ Database schema created successfully');
    console.log('✓ Tables: users, cars, speeds, sessions');
    console.log('✓ Indexes created');
    console.log('✓ Triggers created');

    // Check if tables exist
    const tableCheck = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('\nExisting tables:');
    tableCheck.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });

  } catch (err) {
    console.error('Error initializing database:', err);
    process.exit(1);
  } finally {
    await closeConnections();
  }
}

// Run if called directly
if (require.main === module) {
  initDatabase();
}

module.exports = { initDatabase };
