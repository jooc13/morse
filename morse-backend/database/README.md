# MORSE Database Migration Strategy

## Overview

This directory contains a consolidated, production-ready database initialization system for MORSE workout tracker deployment to Render PostgreSQL. The system has been optimized to resolve conflicts from the original 6 separate migration files and provides a robust, idempotent, and transactional database setup.

## Key Features

- **Idempotent**: Safe to run multiple times without errors
- **Transactional**: All-or-nothing execution for data integrity
- **Optimized**: PostgreSQL-specific indexes and query optimization
- **Validated**: Comprehensive verification scripts
- **Recoverable**: Emergency rollback capabilities
- **Documented**: Clear schema with inline comments

## File Structure

```
database/
├── init_production_schema.sql   # Consolidated schema (tables, indexes)
├── init_functions.sql            # Functions, triggers, and views
├── init_test_data.sql           # Optional test data
├── init_database.sh             # Main initialization script
├── verify_database.sh           # Verification script
├── rollback_database.sh         # Emergency rollback script
└── README.md                    # This file

migrations/                      # Original migrations (archived)
├── 001_initial_schema.sql
├── 002_workout_tables.sql
├── 003_workout_sessions.sql
├── 004_auth_refactor.sql
├── 005_teams.sql
├── 005_test_data.sql
└── 006_device_linking_system.sql
```

## Migration Consolidation Analysis

### Original Migration Issues Resolved

1. **Duplicate Table Definitions**: Files 001 and 002 both created `transcriptions`, `workouts`, `exercises`, and `user_progress` tables with conflicting schemas
2. **Type Mismatches**: Teams migration referenced `users(user_id)` as INTEGER but the table uses UUID
3. **Invalid Test Data**: UUID typo (`c4p9` → `c4b9`) corrected
4. **No Idempotency**: Original scripts would fail on re-run
5. **No Transaction Safety**: Partial failures could leave database in inconsistent state
6. **Missing Dependencies**: No foreign key constraint ordering

### Consolidated Schema Features

The production schema (`init_production_schema.sql`) consolidates all 6 migrations into a single coherent structure:

- **Core Tables**: `users`, `app_users`, `audio_files`, `transcriptions`
- **Workouts**: `workouts`, `exercises`, `exercise_library`, `user_progress`
- **Sessions**: `workout_sessions`, `session_audio_files`, `session_detection_config`
- **Authentication**: `voice_profiles`, `speaker_verifications`, `user_devices`, `device_links`
- **Claims**: `workout_claims`, `session_claims`
- **Teams**: `teams`, `team_memberships`

All tables use:
- UUID primary keys (except teams which uses SERIAL for compatibility)
- Proper CASCADE/SET NULL foreign key relationships
- Optimized indexes including GIN, partial, and suffix indexes
- Transaction-safe DDL wrapped in BEGIN/COMMIT

## Quick Start

### First-Time Deployment on Render

1. **Deploy to Render** (creates empty database)
   ```bash
   git push origin main
   ```

2. **Access service shell**
   ```bash
   render shell -s morse-api
   ```

3. **Initialize database**
   ```bash
   cd /app/morse-backend/database
   ./init_database.sh
   ```

4. **Verify installation**
   ```bash
   ./verify_database.sh
   ```

### Local Development Setup

```bash
# Set your local database URL
export DATABASE_URL="postgresql://localhost:5432/morse_dev"

# Initialize with test data
./init_database.sh --with-test-data

# Verify
./verify_database.sh
```

## Usage

### Initialize Database

```bash
./init_database.sh [OPTIONS]

Options:
  --with-test-data    Include test data for development
  --force            Drop and recreate database (DESTRUCTIVE!)

Examples:
  ./init_database.sh                      # Production setup
  ./init_database.sh --with-test-data     # Development setup
  ./init_database.sh --force              # Clean reinstall
```

**Environment Variables Required:**
- `DATABASE_URL`: PostgreSQL connection string (format: `postgresql://user:pass@host:port/db`)

### Verify Database

```bash
./verify_database.sh
```

Checks:
- All tables exist
- Critical indexes present
- Functions and triggers installed
- Foreign key constraints valid
- No orphaned records
- Database integrity

Exit codes:
- `0`: All checks passed
- `1`: Some checks failed

### Rollback Database

```bash
./rollback_database.sh --confirm [--save-backup]

Options:
  --confirm       Required to execute (safety measure)
  --save-backup   Create compressed dump before rollback

Example:
  ./rollback_database.sh --confirm --save-backup
```

**WARNING**: This is a DESTRUCTIVE operation that drops all database objects.

## Schema Overview

### Core Authentication Flow

```
Device (users.device_uuid)
    ↓
Audio Upload (audio_files)
    ↓
Transcription (transcriptions)
    ↓
Workout Creation (workouts) [unclaimed]
    ↓
Voice Verification (speaker_verifications)
    ↓
User Claims Workout (workout_claims)
    ↓
Workout Linked to User (app_users)
```

### Key Relationships

```
users (device-based)
  ├─→ audio_files
  ├─→ workouts
  ├─→ workout_sessions
  └─→ user_progress

app_users (authenticated)
  ├─→ voice_profiles
  ├─→ workout_claims
  ├─→ device_links
  └─→ teams (as creator/member)

workouts
  ├─→ exercises
  ├─→ workout_claims
  ├─→ session_id (optional grouping)
  └─→ transcription_id
```

### Session Grouping

Multiple audio recordings can be grouped into a single workout session:

```
workout_session
  ├─→ session_audio_files (junction table)
  │     └─→ audio_files (with recording_order)
  └─→ workouts (final processed workout)
```

## Database Functions

### Session Management
- `create_new_session()`: Create workout session
- `add_audio_to_session()`: Add recording to session
- `detect_session_candidates()`: Find sessions within timeout window

### Device Management
- `link_user_to_device()`: Link authenticated user to device
- `get_user_linked_devices()`: List user's devices with stats
- `search_devices_by_last4()`: Find devices by UUID suffix

### Workout Claiming
- `claim_workout()`: Claim unclaimed workout
- `get_unclaimed_workouts_for_device()`: List claimable workouts
- `expire_old_unclaimed_workouts()`: Cleanup old unclaimed data

### Speaker Verification
- `auto_assign_workout_to_user()`: Auto-claim via voice match

### Teams
- `generate_invite_code()`: Create unique team invite codes

## Indexes

### Performance-Critical Indexes

```sql
-- Fast user lookups
CREATE INDEX idx_users_device_uuid ON users(device_uuid);
CREATE INDEX idx_user_devices_device_uuid_suffix ON user_devices(RIGHT(device_uuid, 4));

-- Fast workout queries
CREATE INDEX idx_workouts_user_id ON workouts(user_id);
CREATE INDEX idx_workouts_claim_status ON workouts(claim_status);
CREATE INDEX idx_workouts_date ON workouts(workout_date);

-- Fast audio file processing
CREATE INDEX idx_audio_files_transcription_status ON audio_files(transcription_status);
CREATE INDEX idx_audio_files_processed ON audio_files(processed);

-- GIN index for array searches
CREATE INDEX idx_exercises_muscle_groups ON exercises USING GIN(muscle_groups);
```

### Partial Indexes (Space-Efficient)

```sql
-- Only index active records
CREATE INDEX idx_voice_profiles_active ON voice_profiles(is_active) WHERE is_active = true;
CREATE INDEX idx_user_devices_active ON user_devices(is_active) WHERE is_active = true;
```

## Test Data

When using `--with-test-data`, the following test accounts are created:

### Test Device UUIDs (searchable by last 4 characters)
- `f47ac10b-58cc-4372-a567-0e02b2c4c4b9` → search: `c4b9`
- `a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d` → search: `4c5d`
- `9876543f-210a-4bcd-ef12-3456789abc12` → search: `bc12`
- `deadbeef-cafe-4bad-face-123456789012` → search: `9012`
- `12345678-90ab-4cde-f123-456789abcdef` → search: `cdef`

### Test App User
- **Passphrase**: `TestPassword123`
- Use for authentication testing

### Test Workout Data
- 3+ workouts with exercises (bench press, squats, pull-ups)
- Audio files with transcriptions
- Unclaimed status for testing claiming flow

## Troubleshooting

### Connection Issues

```bash
# Test connection manually
psql $DATABASE_URL -c "SELECT version();"

# Check environment variable
echo $DATABASE_URL
```

### Verification Failures

```bash
# Run verification with verbose output
./verify_database.sh

# Check specific table
psql $DATABASE_URL -c "\d users"

# Check function exists
psql $DATABASE_URL -c "\df claim_workout"
```

### Rollback and Reinitialize

```bash
# Save backup first
./rollback_database.sh --confirm --save-backup

# Reinitialize from scratch
./init_database.sh --force

# Restore from backup if needed
gunzip -c backups/morse_backup_*.sql.gz | psql $DATABASE_URL
```

## Production Deployment Checklist

- [ ] Database provisioned on Render
- [ ] `DATABASE_URL` environment variable configured
- [ ] `init_database.sh` executed successfully
- [ ] `verify_database.sh` passes all checks
- [ ] API service can connect (`/health` endpoint)
- [ ] Worker service can process jobs
- [ ] Test audio upload and transcription flow
- [ ] Test workout claiming functionality
- [ ] Monitor database performance metrics
- [ ] Set up automated backups (Render handles this)

## Monitoring

### Key Metrics to Monitor

```sql
-- Check database size
SELECT pg_size_pretty(pg_database_size('morse'));

-- Check table sizes
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check index usage
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Check for slow queries
SELECT
    query,
    mean_exec_time,
    calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

## Backup and Recovery

### Manual Backup

```bash
# Create compressed backup
pg_dump $DATABASE_URL | gzip > morse_backup_$(date +%Y%m%d).sql.gz

# Restore from backup
gunzip -c morse_backup_YYYYMMDD.sql.gz | psql $DATABASE_URL
```

### Render Automatic Backups

Render PostgreSQL includes:
- Daily automated backups (retained for 7 days on free tier, 30 days on paid)
- Point-in-time recovery (paid plans)
- Restore via Render dashboard

## Support

### Documentation References

- PostgreSQL: https://www.postgresql.org/docs/
- Render Databases: https://render.com/docs/databases
- MORSE Backend: `/morse-backend/README.md`

### Common Issues

1. **Foreign key violations**: Check table creation order in schema
2. **Duplicate key errors**: Ensure idempotent operations use `IF NOT EXISTS`
3. **Performance issues**: Check index usage with `EXPLAIN ANALYZE`
4. **Connection pool exhausted**: Adjust `max_connections` or connection pooling

## Version History

- **v1.0.0** (2025-12-12): Initial consolidated migration
  - Merged 6 separate migration files
  - Resolved conflicts and type mismatches
  - Added comprehensive error handling
  - Implemented idempotent operations
  - Added verification and rollback scripts

## Future Enhancements

- [ ] Add pgvector extension for voice embedding similarity search
- [ ] Implement connection pooling with PgBouncer
- [ ] Add materialized views for analytics
- [ ] Implement row-level security (RLS) policies
- [ ] Add audit logging triggers
- [ ] Automated migration versioning system
