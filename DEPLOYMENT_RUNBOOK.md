# MORSE Deployment Runbook

Quick reference for common deployment scenarios and operations.

## Table of Contents

1. [First-Time Deployment](#first-time-deployment)
2. [Regular Deployment](#regular-deployment)
3. [Emergency Rollback](#emergency-rollback)
4. [Hotfix Deployment](#hotfix-deployment)
5. [Database Migration](#database-migration)
6. [Common Operations](#common-operations)

---

## First-Time Deployment

### Prerequisites

```bash
# Install dependencies
brew install just  # macOS
# or: cargo install just

# Install Render CLI (optional)
npm install -g render-cli

# Clone repository
git clone <your-repo-url>
cd morse

# Install project dependencies
just install
```

### 1. Setup Render Services

**Via Render Dashboard:**

1. Go to https://dashboard.render.com
2. Click "New +" > "Blueprint"
3. Connect your GitHub repository
4. Select branch: `main`
5. Render will automatically detect `render.yaml`
6. Click "Apply"

**Services created:**
- `morse-api` (Web Service)
- `morse-frontend` (Web Service)
- `morse-redis` (Redis)
- `morse-db` (PostgreSQL)

### 2. Configure Environment Variables

**In Render Dashboard > morse-api > Environment:**

Add:
- `GEMINI_API_KEY` = your-gemini-api-key (if using AI features)
- `JWT_SECRET` = auto-generated (Render will create)

**Verify other variables are set automatically:**
- `DATABASE_URL` (from morse-db)
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` (from morse-redis)
- `NODE_ENV=production`

### 3. Initial Deployment

```bash
# Validate configuration
just validate

# Push to main (triggers auto-deploy)
git push origin main

# Monitor deployment
just monitor
```

### 4. Verify Deployment

```bash
# Set your service URLs
export API_URL=https://morse-api.onrender.com
export FRONTEND_URL=https://morse-frontend.onrender.com

# Run health checks
just health

# Run smoke tests
just smoke
```

### 5. Setup Monitoring

1. **UptimeRobot:** Monitor health endpoints
2. **Render Notifications:** Enable in dashboard
3. **Optional:** Setup Sentry (see MONITORING_SETUP.md)

**First deployment complete!** Monitor for 30 minutes.

---

## Regular Deployment

### Standard Workflow

```bash
# 1. Make changes on feature branch
git checkout -b feature/my-feature

# 2. Develop and test locally
just dev           # Start local environment
just test          # Run tests

# 3. Commit and push
git add .
git commit -m "Add my feature"
git push origin feature/my-feature

# 4. Create pull request
# GitHub will run CI/CD pipeline automatically

# 5. After PR approval, merge to main
# Auto-deploy triggers automatically

# 6. Monitor deployment
export API_URL=https://morse-api.onrender.com
just monitor

# 7. Verify deployment
just health
just smoke
```

### One-Command Deployment (from main)

```bash
# Full deployment with all checks
just deploy-full

# This runs:
# - Pre-deployment validation
# - Database migration checks
# - Tests
# - Git push to main
# - Deployment monitoring
# - Health checks
# - Smoke tests
```

### Timeline

- **CI/CD Pipeline:** 15 minutes
- **Deployment:** 3-5 minutes
- **Health checks:** 1 minute
- **Total:** ~20 minutes

---

## Emergency Rollback

### When to Rollback

- Error rate >10%
- Critical functionality broken
- Service downtime >5 minutes
- Data corruption risk

### Quick Rollback

```bash
# Rollback API service
just emergency-rollback morse-api

# Rollback frontend
just emergency-rollback morse-frontend

# This will:
# 1. Confirm rollback
# 2. Identify previous deploy
# 3. Trigger redeployment
# 4. Monitor health
# 5. Verify rollback success
```

### Manual Rollback (if CLI fails)

1. Go to https://dashboard.render.com
2. Select service (morse-api or morse-frontend)
3. Click "Manual Deploy" button
4. Select previous successful deploy
5. Click "Deploy"
6. Monitor health: `just health`

### Post-Rollback

```bash
# Verify system health
just health
just smoke

# Monitor for 15 minutes
just monitor

# Investigate root cause
render logs -s morse-api --tail 500

# Create hotfix branch
git checkout -b hotfix/issue-name
```

**Timeline:** <2 minutes to rollback

---

## Hotfix Deployment

### For Critical Bugs in Production

```bash
# 1. Create hotfix branch from main
git checkout main
git pull
git checkout -b hotfix/critical-bug-name

# 2. Fix the issue
# ... make changes ...

# 3. Test locally
just test
just smoke

# 4. Validate
just validate

# 5. Fast-track deployment
git add .
git commit -m "Hotfix: [description of fix]"

# 6. Push and create PR
git push origin hotfix/critical-bug-name
# Create PR with "HOTFIX" label

# 7. After quick review, merge to main
# Auto-deploy triggers

# 8. Monitor closely
just monitor

# 9. Verify fix
just health
just smoke

# 10. Merge back to develop (if using git-flow)
git checkout develop
git merge hotfix/critical-bug-name
git push origin develop
```

**Timeline:** 10-15 minutes (expedited review)

---

## Database Migration

### Adding New Migration

```bash
# 1. Create migration file
cd morse-backend/database/migrations
touch 007_your_migration_name.sql

# 2. Write migration
# Use CREATE TABLE IF NOT EXISTS
# Use ALTER TABLE ADD COLUMN IF NOT EXISTS
# Wrap in transaction (BEGIN/COMMIT)

# 3. Validate migration
just validate-migrations

# 4. Test migration locally
export DATABASE_URL=postgresql://user:pass@localhost/morse
psql $DATABASE_URL -f morse-backend/database/migrations/007_your_migration_name.sql

# 5. Verify database state
psql $DATABASE_URL -c "\dt"  # List tables

# 6. Add to init-db.sh
# Add line: psql $DATABASE_URL -f morse-backend/database/migrations/007_your_migration_name.sql

# 7. Test full migration sequence
just migrate

# 8. Commit and deploy
git add morse-backend/database/migrations/007_your_migration_name.sql
git add init-db.sh
git commit -m "Add migration: [description]"
git push origin main
```

### Migration Best Practices

**DO:**
- Use `IF NOT EXISTS` / `IF EXISTS`
- Wrap in transactions
- Test on staging/local first
- Make migrations reversible
- Document breaking changes

**DON'T:**
- Drop tables without backup
- Change column types destructively
- Run migrations manually on production
- Skip migration validation

### Rollback Migration

```bash
# Create rollback migration
cd morse-backend/database/migrations
touch 008_rollback_007.sql

# Write reverse operations
# Example:
# - DROP TABLE created_table IF EXISTS
# - ALTER TABLE ... DROP COLUMN ... IF EXISTS

# Test rollback
psql $DATABASE_URL -f morse-backend/database/migrations/008_rollback_007.sql
```

---

## Common Operations

### View Logs

```bash
# API logs (last 100 lines)
render logs -s morse-api --tail 100

# Frontend logs
render logs -s morse-frontend --tail 100

# Follow logs in real-time
render logs -s morse-api --follow

# Filter for errors
render logs -s morse-api | grep -i error
```

### Check Service Status

```bash
# Using just
just status

# Using Render CLI
render services list

# View recent deploys
render deploys list -s morse-api --limit 10

# Check specific deploy
render deploy show <deploy-id>
```

### Update Environment Variables

```bash
# Via Render Dashboard:
# 1. Service > Environment
# 2. Add/Edit variable
# 3. Save (triggers redeploy)

# Via Render CLI:
render env set -s morse-api KEY=value

# List all env vars
render env list -s morse-api
```

### Scale Service

```bash
# Via Render Dashboard:
# 1. Service > Settings
# 2. Change plan (Starter, Standard, Pro)
# 3. Adjust instance count
# 4. Save

# Note: Free tier doesn't support scaling
# Starter plan ($7/month) allows 1 instance
# Standard+ allows multiple instances
```

### Database Operations

```bash
# Connect to production database
# Get connection string from Render Dashboard > morse-db
psql <connection-string>

# Create backup
# Render auto-backs up daily
# Manual backup:
pg_dump <connection-string> > backup-$(date +%Y%m%d).sql

# Restore from backup (DANGER)
psql <connection-string> < backup-20240101.sql
```

### Performance Optimization

```bash
# Check current performance
just health

# Monitor for extended period
just monitor

# View custom metrics
curl https://morse-api.onrender.com/metrics

# Check database query performance
# Add logging to routes/workouts.js:
console.time('query');
// ... query ...
console.timeEnd('query');
```

---

## Troubleshooting Quick Reference

### Service Won't Start

```bash
# Check logs
render logs -s morse-api --tail 200

# Common causes:
# - Missing environment variable
# - Database migration failed
# - Port already in use
# - Syntax error in code

# Fix:
# 1. Check environment variables in dashboard
# 2. Validate migrations: just validate-migrations
# 3. Rollback if needed: just rollback morse-api
```

### Database Connection Failed

```bash
# Verify DATABASE_URL is set
render env list -s morse-api | grep DATABASE_URL

# Check database status
# Render Dashboard > morse-db > Status

# Test connection locally
psql <connection-string> -c "SELECT 1"

# Fix:
# - Restart database service
# - Check IP allowlist (should be empty for Render services)
# - Verify connection string format
```

### High Error Rate

```bash
# Check error logs
render logs -s morse-api | grep -i error

# Check metrics
curl https://morse-api.onrender.com/metrics

# Common causes:
# - Database query error
# - Missing error handling
# - Third-party API down
# - Memory leak

# Fix:
# 1. Identify error pattern
# 2. Create hotfix
# 3. Or rollback: just emergency-rollback morse-api
```

### Slow Performance

```bash
# Monitor response times
just monitor

# Check metrics
curl https://morse-api.onrender.com/metrics

# Check resource usage
# Render Dashboard > Service > Metrics

# Common causes:
# - Slow database queries
# - No caching
# - N+1 queries
# - Insufficient resources

# Fix:
# 1. Add database indexes
# 2. Implement caching
# 3. Optimize queries
# 4. Scale up service plan
```

---

## Cheat Sheet

### Most Common Commands

```bash
# Development
just dev                    # Start local environment
just test                   # Run all tests
just validate               # Validate configuration

# Deployment
just deploy-full            # Full deployment with checks
just monitor                # Monitor deployment
just health                 # Run health checks
just smoke                  # Run smoke tests

# Emergency
just emergency-rollback morse-api   # Quick rollback
render logs -s morse-api --tail 100 # View logs

# Status
just status                 # Service status
render services list        # List all services
```

### URLs

- **Render Dashboard:** https://dashboard.render.com
- **API Health:** https://morse-api.onrender.com/health
- **API Docs:** https://morse-api.onrender.com/
- **Frontend:** https://morse-frontend.onrender.com
- **Metrics:** https://morse-api.onrender.com/metrics

### Support Contacts

- **Render Support:** https://render.com/support
- **Render Status:** https://status.render.com
- **Documentation:** https://render.com/docs

---

## Deployment Calendar

### Regular Maintenance

- **Daily:** Check health metrics (5 min)
- **Weekly:** Review error logs, update dependencies (30 min)
- **Monthly:** Security audit, performance review (2 hours)
- **Quarterly:** Disaster recovery test (4 hours)

### Best Times to Deploy

- **Recommended:** Tuesday-Thursday, 10am-2pm (your timezone)
- **Avoid:** Fridays after 2pm, weekends, holidays
- **Emergency:** Anytime (with monitoring)

---

This runbook covers 90% of deployment scenarios. For detailed information, see:
- **DEPLOYMENT_AUTOMATION.md** - Full automation guide
- **MONITORING_SETUP.md** - Monitoring configuration
- **README_DEPLOYMENT.md** - Deployment overview
