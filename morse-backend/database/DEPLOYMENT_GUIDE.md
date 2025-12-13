# MORSE Database Deployment Guide for Render

## Quick Deployment (5 Minutes)

### Prerequisites
- GitHub repository connected to Render
- Render account with PostgreSQL database provisioned

### Step 1: Deploy Infrastructure (Automatic)

```bash
# Push to trigger deployment
git push origin main
```

Render will automatically:
1. Create PostgreSQL database (`morse-db`)
2. Create Redis instance (`morse-redis`)
3. Deploy API service (`morse-api`)
4. Deploy frontend service (`morse-frontend`)

**Wait for**: All services show "Live" status (3-5 minutes)

### Step 2: Initialize Database (One-Time, Manual)

```bash
# Option A: Via Render Shell (Recommended)
render shell -s morse-api
cd /app/morse-backend/database
./init_database.sh

# Option B: Via SSH (if configured)
ssh user@morse-api.onrender.com
cd /app/morse-backend/database
./init_database.sh
```

### Step 3: Verify Database

```bash
# Still in the shell
./verify_database.sh
```

Expected output:
```
✓ Extension: uuid-ossp
✓ Table: users
✓ Table: app_users
...
✓ All verifications passed!
Database is correctly initialized and ready for use.
```

### Step 4: Test API

```bash
# Exit the shell
exit

# Test health endpoint
curl https://morse-api.onrender.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2025-12-12T..."
}
```

## Deployment Checklist

### Pre-Deployment

- [ ] All code committed and pushed to `main` branch
- [ ] `render.yaml` configured correctly
- [ ] Environment variables documented

### During Deployment

- [ ] Monitor Render dashboard for build/deploy status
- [ ] Check logs for any errors
- [ ] Verify all services reach "Live" status

### Post-Deployment

- [ ] Run `init_database.sh` via shell
- [ ] Run `verify_database.sh` to confirm
- [ ] Test API `/health` endpoint
- [ ] Test audio upload functionality
- [ ] Test workout creation and claiming
- [ ] Verify worker is processing jobs

### Production Readiness

- [ ] Database initialization verified
- [ ] API responding correctly
- [ ] Frontend loads without errors
- [ ] Worker processing audio files
- [ ] Error logging configured
- [ ] Monitoring alerts set up

## Environment Variables

### Required (Set in Render Dashboard)

| Variable | Value | Where to Set |
|----------|-------|--------------|
| `DATABASE_URL` | Auto-generated | Database settings |
| `REDIS_HOST` | Auto-generated | Redis settings |
| `REDIS_PORT` | Auto-generated | Redis settings |
| `REDIS_PASSWORD` | Auto-generated | Redis settings |
| `GEMINI_API_KEY` | Your API key | morse-api service |
| `JWT_SECRET` | Auto-generated | morse-api service |

### Optional (Development)

| Variable | Value | Purpose |
|----------|-------|---------|
| `LOG_LEVEL` | `info` | Logging verbosity |
| `NODE_ENV` | `production` | Runtime environment |

## Database Connection Testing

### From Render Shell

```bash
# Test connection
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"

# Check database size
psql $DATABASE_URL -c "SELECT pg_size_pretty(pg_database_size('morse'));"

# List all tables
psql $DATABASE_URL -c "\dt"
```

### From Local Development

```bash
# Get database URL from Render dashboard
export DATABASE_URL="postgresql://..."

# Run verification
./verify_database.sh
```

## Common Deployment Scenarios

### Scenario 1: Fresh Deployment (New Project)

```bash
# 1. Deploy via Render (automatic)
git push origin main

# 2. Wait for deployment (5 minutes)
render logs -s morse-api --tail

# 3. Initialize database
render shell -s morse-api
./init_database.sh

# 4. Verify
./verify_database.sh
```

**Total Time**: ~7 minutes

### Scenario 2: Update Deployment (Code Changes)

```bash
# 1. Push changes
git push origin main

# 2. Wait for redeploy (3 minutes)
# Database schema is idempotent - no manual steps needed
```

**Total Time**: ~3 minutes

### Scenario 3: Database Schema Update

```bash
# 1. Update schema files locally
# 2. Test locally first
export DATABASE_URL="postgresql://localhost:5432/morse_dev"
./init_database.sh --force
./verify_database.sh

# 3. Deploy to Render
git push origin main

# 4. Apply schema changes (idempotent)
render shell -s morse-api
./init_database.sh  # Safe to re-run
```

**Total Time**: ~5 minutes

### Scenario 4: Emergency Rollback

```bash
# 1. Access shell
render shell -s morse-api

# 2. Create backup
./rollback_database.sh --confirm --save-backup

# 3. Rollback to previous code version via Render dashboard

# 4. Restore database if needed
gunzip -c backups/morse_backup_*.sql.gz | psql $DATABASE_URL
```

**Total Time**: ~10 minutes

## Troubleshooting

### Issue: "Command not found: render"

**Solution**: Install Render CLI
```bash
# macOS/Linux
brew install render

# Or via npm
npm install -g render-cli

# Login
render login
```

### Issue: "Permission denied: init_database.sh"

**Solution**: Scripts should be executable (already configured)
```bash
# If needed, fix permissions
chmod +x init_database.sh verify_database.sh rollback_database.sh
```

### Issue: "Database connection failed"

**Checklist**:
1. Database is provisioned and "Available" in Render dashboard
2. `DATABASE_URL` environment variable is set correctly
3. Service can reach database (same region/network)

**Solution**:
```bash
# Test connection manually
psql $DATABASE_URL -c "SELECT 1;"

# Check environment variable
echo $DATABASE_URL | grep -o '^[^:]*://[^@]*'  # Shows without password
```

### Issue: "Table already exists" error

**Solution**: Scripts are idempotent - this is expected and safe
```bash
# Force clean reinstall if needed
./init_database.sh --force
```

### Issue: Verification script fails

**Solution**: Check specific failures
```bash
# Run with full output
./verify_database.sh 2>&1 | tee verify_output.log

# Inspect specific table
psql $DATABASE_URL -c "\d table_name"

# Check function exists
psql $DATABASE_URL -c "\df function_name"
```

## Performance Optimization

### After Initial Deployment

```sql
-- Run ANALYZE to update query planner statistics
ANALYZE;

-- Check index usage after a few days
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
AND idx_scan < 10
ORDER BY idx_scan;
```

### Enable Connection Pooling

Add to your application code:
```javascript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,  // Maximum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### Monitor Query Performance

```sql
-- Enable pg_stat_statements (already enabled on Render)
-- View slow queries
SELECT
    query,
    calls,
    mean_exec_time,
    max_exec_time
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

## Backup Strategy

### Automatic Backups (Render Managed)

- **Free Tier**: Daily backups, 7-day retention
- **Paid Tier**: Daily backups, 30-day retention + point-in-time recovery
- **Access**: Via Render dashboard → Database → Backups

### Manual Backups (Before Major Changes)

```bash
# Before schema changes
render shell -s morse-api
cd /app/morse-backend/database

# Create backup
pg_dump $DATABASE_URL | gzip > /tmp/backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Download backup (from another terminal)
render scp morse-api:/tmp/backup_*.sql.gz ./local_backups/
```

### Recovery Testing

```bash
# Test restore in development
export DATABASE_URL="postgresql://localhost:5432/morse_test"

# Restore from backup
gunzip -c backup_YYYYMMDD_HHMMSS.sql.gz | psql $DATABASE_URL

# Verify
./verify_database.sh
```

## Monitoring and Alerts

### Set Up Render Alerts

1. Go to Render Dashboard → Database
2. Navigate to "Metrics" tab
3. Set up alerts for:
   - Connection count > 80%
   - Disk usage > 85%
   - Query duration > 1000ms

### Application-Level Monitoring

```javascript
// In your API service
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message
    });
  }
});
```

## Scaling Considerations

### When to Upgrade Database Plan

Upgrade from Free to Starter ($7/mo) when:
- [ ] Storage > 256MB (free tier limit)
- [ ] Active connections frequently > 20
- [ ] Query latency > 500ms consistently
- [ ] Need point-in-time recovery
- [ ] Production workload

### Vertical Scaling (Database Size)

```
Free:     256MB storage, 1GB RAM, shared CPU
Starter:  10GB storage, 1GB RAM, shared CPU
Pro:      50GB storage, 4GB RAM, dedicated CPU
```

### Horizontal Scaling (Read Replicas)

Available on Pro+ plans:
- Offload analytics queries
- Improve read performance
- Geographic distribution

## Security Best Practices

### Production Checklist

- [ ] SSL/TLS enabled (default on Render)
- [ ] Connection string not exposed in logs
- [ ] Principle of least privilege for database user
- [ ] Regular security updates (managed by Render)
- [ ] No sensitive data in test data scripts
- [ ] Environment variables properly secured

### Audit Trail

```sql
-- Create audit log trigger (optional)
CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(255),
    operation VARCHAR(10),
    user_id UUID,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Example trigger for workout_claims
CREATE OR REPLACE FUNCTION audit_workout_claims()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_log (table_name, operation, user_id, new_data)
    VALUES ('workout_claims', TG_OP, NEW.user_id, row_to_json(NEW));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workout_claims_audit
AFTER INSERT OR UPDATE ON workout_claims
FOR EACH ROW EXECUTE FUNCTION audit_workout_claims();
```

## Support and Resources

### Render Documentation
- Databases: https://render.com/docs/databases
- Shell Access: https://render.com/docs/shell
- Environment Variables: https://render.com/docs/environment-variables

### PostgreSQL Resources
- Official Docs: https://www.postgresql.org/docs/
- Performance Tuning: https://wiki.postgresql.org/wiki/Performance_Optimization

### MORSE Project
- Backend README: `/morse-backend/README.md`
- Database README: `/morse-backend/database/README.md`
- API Documentation: `/morse-backend/services/api/README.md`

## Next Steps After Deployment

1. **Test Core Functionality**
   - Upload audio file
   - Verify transcription
   - Create workout
   - Claim workout
   - Test team features

2. **Monitor Initial Usage**
   - Check logs for errors
   - Monitor database performance
   - Track API response times
   - Verify worker processing

3. **Set Up Ongoing Maintenance**
   - Schedule regular backups
   - Monitor disk usage
   - Review slow queries weekly
   - Update dependencies monthly

4. **Document Custom Changes**
   - Track any schema modifications
   - Document new environment variables
   - Update deployment procedures
   - Maintain changelog

---

**Deployment Complete!** 🎉

Your MORSE workout tracker is now live on Render with a fully initialized PostgreSQL database.
