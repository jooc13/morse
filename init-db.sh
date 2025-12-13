#!/bin/bash
set -e

echo "Running database migrations..."

# Run migrations in order
psql $DATABASE_URL -f morse-backend/database/migrations/001_initial_schema.sql
psql $DATABASE_URL -f morse-backend/database/migrations/002_workout_tables.sql
psql $DATABASE_URL -f morse-backend/database/migrations/003_workout_sessions.sql
psql $DATABASE_URL -f morse-backend/database/migrations/004_auth_refactor.sql
psql $DATABASE_URL -f morse-backend/database/migrations/005_teams.sql
psql $DATABASE_URL -f morse-backend/database/migrations/006_device_linking_system.sql

# Skip test data in production
# psql $DATABASE_URL -f morse-backend/database/migrations/005_test_data.sql

echo "Database migrations completed successfully"
