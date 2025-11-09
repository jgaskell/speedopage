Pre-production backend configuration summary

PostgreSQL

Version: 16

Service: postgresql (enabled and active)

Cluster: 16/main

Port: 5432

Listen: localhost only (127.0.0.1)

Databases: app1 to app6

Users: app1–app6 with matching passwords (StrongPass1–StrongPass6)

This app will be app1

Authentication: md5

Config files:

/etc/postgresql/16/main/postgresql.conf

/etc/postgresql/16/main/pg_hba.conf

Data directory: /var/lib/postgresql/16/main

No remote connections exposed — all apps access via localhost.

Redis

Service: redis-server (enabled and active)

Port: 6379

Bound to: 127.0.0.1 only

Password: set in /etc/redis/redis.conf (requirepass yourRedisPassword)

Databases: 0–5 reserved for app1–app6

Config file: /etc/redis/redis.conf

No external access permitted.

App integration reference
Each app uses environment variables of this form:

DB_URL=postgres://app1:StrongPass1@localhost:5432/app1
REDIS_URL=redis://:yourRedisPassword@localhost:6379/0
PORT=3101
NODE_ENV=production

All backend services (PostgreSQL, Redis, Nginx) run locally on the same host; no external network exposure.