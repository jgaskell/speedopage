// PostgreSQL and Redis connection management
const { Pool } = require('pg');
const redis = require('redis');
require('dotenv').config();

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DB_URL,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
  process.exit(-1);
});

// Redis client
let redisClient = null;
let redisConnected = false;

async function initRedis() {
  try {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
      redisConnected = false;
    });

    redisClient.on('connect', () => {
      console.log('Redis connected successfully');
      redisConnected = true;
    });

    redisClient.on('reconnecting', () => {
      console.log('Redis reconnecting...');
    });

    await redisClient.connect();
    return redisClient;
  } catch (err) {
    console.error('Failed to initialize Redis:', err);
    redisConnected = false;
    return null;
  }
}

// Query helper function with error handling
async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 100) {
      console.log('Slow query:', { text, duration, rows: res.rowCount });
    }
    return res;
  } catch (err) {
    console.error('Database query error:', { text, params, error: err.message });
    throw err;
  }
}

// Get a client from the pool for transactions
async function getClient() {
  const client = await pool.connect();
  const originalQuery = client.query;
  const originalRelease = client.release;

  // Set a timeout of 5 seconds
  const timeout = setTimeout(() => {
    console.error('A client has been checked out for more than 5 seconds!');
  }, 5000);

  // Monkey patch the query method to keep track of the last query executed
  client.query = (...args) => {
    client.lastQuery = args;
    return originalQuery.apply(client, args);
  };

  // Override release to clear the timeout
  client.release = () => {
    clearTimeout(timeout);
    client.query = originalQuery;
    client.release = originalRelease;
    return originalRelease.apply(client);
  };

  return client;
}

// Transaction helper
async function transaction(callback) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Graceful shutdown
async function closeConnections() {
  console.log('Closing database connections...');
  try {
    if (redisClient && redisConnected) {
      await redisClient.quit();
      console.log('Redis connection closed');
    }
    await pool.end();
    console.log('PostgreSQL pool closed');
  } catch (err) {
    console.error('Error closing connections:', err);
  }
}

// Handle process termination
process.on('SIGTERM', closeConnections);
process.on('SIGINT', closeConnections);

module.exports = {
  query,
  getClient,
  transaction,
  pool,
  initRedis,
  getRedis: () => redisClient,
  isRedisConnected: () => redisConnected,
  closeConnections
};
