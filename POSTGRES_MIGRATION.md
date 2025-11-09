# PostgreSQL Migration Guide for SpeedoPage

## Overview
This guide explains how to migrate SpeedoPage from SQLite to PostgreSQL + Redis.

## Prerequisites
- PostgreSQL 16 running on localhost:5432
- Redis running on localhost:6379
- Database `app1` created with user `app1`
- Redis password configured

## Migration Steps

### 1. Install Dependencies
```bash
npm install pg redis dotenv
```

### 2. Configure Environment
Update `.env` with your database credentials:
```bash
DB_URL=postgres://app1:StrongPass1@localhost:5432/app1
REDIS_URL=redis://:yourRedisPassword@localhost:6379/0
JWT_SECRET=your-secret-key-change-this-in-production
SESSION_SECRET=your-session-secret-change-this-in-production
PORT=3101
NODE_ENV=production
```

### 3. Initialize PostgreSQL Schema
```bash
node db/init.js
```

This will create:
- `users` table (authentication)
- `cars` table (user's garage)
- `speeds` table (raw GPS data)
- `sessions` table (completed driving sessions)

### 4. Migrate Existing Data
```bash
node migrate-sqlite-to-postgres.js
```

This script will:
- Read all data from `speeds.db` (SQLite)
- Transform and insert into PostgreSQL
- Preserve all user data, sessions, and speed logs

### 5. Update Server Configuration
The following files have been updated for PostgreSQL:
- `db/connection.js` - PostgreSQL connection pool
- `db/schema.sql` - Database schema
- `routes/auth.js` - Authentication routes (UPDATED)
- `routes/cars.js` - Car management routes (NEEDS UPDATE)
- `routes/users.js` - User profile routes (NEEDS UPDATE)
- `server.js` - Main server file (NEEDS UPDATE)

### 6. Test the Migration
```bash
# Start the server
npm start

# Verify database connection
# Check logs for "PostgreSQL pool initialized" and "Redis connected successfully"
```

## Database Schema Differences

### SQLite → PostgreSQL Column Name Changes
- `passwordHash` → `password_hash`
- `displayName` → `display_name`
- `deviceId` → `device_id`
- `startTime` → `start_time`
- `endTime` → `end_time`
- `vMax` → `v_max`
- `onIncline` → `on_incline`
- `createdAt` → `created_at`
- `updatedAt` → `updated_at`
- `isActive` → `is_active`
- `photoUrl` → `photo_url`
- `userId` → `user_id`
- `carId` → `car_id`

### Data Type Changes
- SQLite `TEXT` → PostgreSQL `JSONB` for `timers` column
- SQLite `BOOLEAN` → PostgreSQL `BOOLEAN` (native support)
- SQLite `DATETIME` → PostgreSQL `TIMESTAMP`
- SQLite `AUTOINCREMENT` → PostgreSQL `SERIAL`

## Key Benefits of PostgreSQL

1. **Better Performance** - Optimized indexes, query planning
2. **JSONB Support** - Native JSON operations for timers data
3. **Connection Pooling** - Efficient resource management
4. **Transactions** - ACID compliance
5. **Scalability** - Ready for production loads

## Redis Integration

Redis will be used for:
- Session storage (future enhancement)
- Rate limiting (replacing in-memory Map)
- Caching frequently accessed data

## Rollback Plan

If migration fails, keep `speeds.db` as backup:
```bash
cp speeds.db speeds.db.backup
```

To rollback:
1. Stop the new server
2. Restore `speeds.db`
3. Revert code changes with `git checkout`

## Post-Migration Checklist

- [ ] All tables created successfully
- [ ] Data migrated from SQLite
- [ ] Authentication works (login/register)
- [ ] Sessions are saved correctly
- [ ] GPS speed logging functional
- [ ] Car garage features working
- [ ] No database connection errors in logs

## Performance Monitoring

Monitor slow queries (> 100ms):
```sql
-- Enable slow query logging in PostgreSQL
ALTER DATABASE app1 SET log_min_duration_statement = 100;
```

## Next Steps

1. Update `routes/cars.js` for PostgreSQL
2. Update `routes/users.js` for PostgreSQL
3. Update `server.js` for PostgreSQL
4. Implement Redis-based rate limiting
5. Add Redis session storage
6. Deploy to production
