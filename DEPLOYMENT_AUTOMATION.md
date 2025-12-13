# MORSE Deployment Automation Guide

Complete guide for automated, production-ready deployment on Render.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Automated Workflows](#automated-workflows)
3. [Testing Strategy](#testing-strategy)
4. [Monitoring & Alerts](#monitoring--alerts)
5. [Rollback Procedures](#rollback-procedures)
6. [CI/CD Pipeline](#cicd-pipeline)
7. [Troubleshooting](#troubleshooting)

---

## Quick Start

### One-Command Deployment

```bash
# Install just (if not already installed)
brew install just  # macOS
# or: cargo install just

# Deploy to production
just deploy-full
```

This single command:
- Validates all configuration files
- Checks database migrations
- Runs tests
- Deploys to Render
- Monitors deployment health
- Runs smoke tests
- Reports success/failure

**Deployment completes in under 5 minutes.**

---

## Automated Workflows

### Development

```bash
# Start local development (one command)
just dev

# This starts:
# - PostgreSQL database
# - Redis cache
# - API server (port 3000)
# - Frontend (port 3001)
```

### Testing

```bash
# Run all tests (completes in <3 minutes)
just test

# Individual test suites
just validate              # Configuration validation
just validate-migrations   # Database migration checks
just test-api             # API unit tests
just test-frontend        # Frontend tests
just smoke                # End-to-end smoke tests
```

### Deployment

```bash
# Full deployment with validation
just deploy-full

# Quick deploy (skips full test suite)
just deploy

# Deploy with custom message
just deploy-msg "Fix authentication bug"
```

---

## Testing Strategy

### 1. Pre-Deployment Validation

**Script:** `scripts/validate-deployment.sh`

Validates:
- Required files exist
- YAML syntax is correct
- Database migrations are present
- Package.json dependencies are valid
- Dockerfiles follow best practices
- Environment variables are documented
- No security vulnerabilities

**Runtime:** ~30 seconds

```bash
just validate
```

### 2. Database Migration Validation

**Script:** `scripts/validate-migrations.sh`

Checks:
- Migration naming conventions (001_description.sql)
- Correct ordering
- SQL syntax
- Idempotency (CREATE IF NOT EXISTS)
- Transaction wrapping
- No hardcoded credentials

**Runtime:** ~15 seconds

```bash
just validate-migrations
```

### 3. Smoke Tests

**Script:** `scripts/smoke-test.sh`

Tests critical user workflows:
- User registration
- User login
- Profile retrieval
- Team creation
- Workout retrieval
- API response time (<150ms avg)
- Error handling

**Runtime:** <60 seconds

```bash
just smoke
```

### 4. Health Checks

**Script:** `scripts/health-check.sh`

Verifies:
- API health endpoint (200 OK)
- Frontend accessibility
- Database connectivity
- Response times (p95 <150ms, LCP <2.5s)
- CORS configuration
- Security headers
- Rate limiting

**Runtime:** ~30 seconds

```bash
just health
```

---

## Monitoring & Alerts

### Real-Time Deployment Monitoring

**Script:** `scripts/monitor-deployment.sh`

Tracks:
- Health check status
- P95 response times
- Error rates
- Request counts
- Performance degradation

**Alerts trigger when:**
- P95 response time >150ms
- Error rate >5%
- Health check fails

```bash
# Monitor for 5 minutes after deployment
just monitor
```

### Key Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| P95 Response Time | <100ms | >150ms |
| LCP (Frontend) | <2.0s | >2.5s |
| Error Rate | <1% | >5% |
| Uptime | 99.9% | <99% |

### Recommended Monitoring Setup

**Render Dashboard:**
- Built-in metrics (CPU, memory, requests)
- Automatic alerts on service failures

**External Monitoring (Recommended):**

1. **UptimeRobot** (Free)
   - Monitor health endpoints
   - Alert on downtime
   - 5-minute intervals

2. **Sentry** (Free tier)
   - Error tracking
   - Performance monitoring
   - User impact analysis

3. **LogTail** (Free tier)
   - Log aggregation
   - Real-time search
   - Alerts on error patterns

**Setup Instructions:**

```bash
# 1. Add health check monitoring
# UptimeRobot: Monitor https://your-api.onrender.com/health

# 2. Add Sentry (optional)
npm install @sentry/node --save

# 3. Configure in morse-backend/services/api/src/app.js:
# const Sentry = require('@sentry/node');
# Sentry.init({ dsn: process.env.SENTRY_DSN });
```

---

## Rollback Procedures

### Automatic Rollback

**Script:** `scripts/rollback.sh`

```bash
# Rollback API service
just rollback morse-api

# Rollback frontend
just rollback morse-frontend

# Emergency rollback (includes monitoring)
just emergency-rollback morse-api
```

**Process:**
1. Confirms rollback with user
2. Identifies previous successful deployment
3. Triggers redeployment
4. Waits 30 seconds
5. Runs health checks
6. Logs rollback details

**Rollback time:** <2 minutes

### Manual Rollback (Render Dashboard)

1. Go to https://dashboard.render.com
2. Select service (morse-api or morse-frontend)
3. Click "Manual Deploy"
4. Select previous deploy from dropdown
5. Click "Deploy"

**Always run health checks after rollback:**

```bash
just health
```

---

## CI/CD Pipeline

### GitHub Actions Workflow

**File:** `.github/workflows/ci-cd.yml`

**Triggers:**
- Push to `main`, `staging`, or `develop`
- Pull requests to `main` or `staging`

**Pipeline Stages:**

1. **Validate** (5 min)
   - Check required files
   - Validate YAML syntax
   - Shell script syntax

2. **Test API** (10 min)
   - Setup PostgreSQL + Redis
   - Run database migrations
   - Execute tests
   - Lint code

3. **Test Frontend** (10 min)
   - Install dependencies
   - Build React app
   - Run tests

4. **Security Scan** (5 min)
   - npm audit
   - Check for exposed secrets

5. **Validate Migrations** (5 min)
   - Dry-run migrations
   - Verify database state

6. **Build Docker** (15 min)
   - Build API image
   - Build frontend image
   - Cache layers

7. **Deploy** (10 min, main only)
   - Run pre-deployment validation
   - Trigger Render auto-deploy
   - Health checks
   - Smoke tests

**Total pipeline time:** ~15 minutes (parallel execution)

### Required GitHub Secrets

```bash
# Add in GitHub repo settings > Secrets and variables > Actions

RENDER_API_KEY          # Render API key (optional, for CLI)
RENDER_API_URL          # https://morse-api.onrender.com
RENDER_FRONTEND_URL     # https://morse-frontend.onrender.com
```

### Deployment Flow

```
┌─────────────┐
│ Push to main│
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Validate   │ ◄── Fast fail (30s)
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│  Run Tests (parallel)│ ◄── API, Frontend, Security (10min)
└──────┬──────────────┘
       │
       ▼
┌─────────────┐
│Build Docker │ ◄── Validate images (15min)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Deploy    │ ◄── Render auto-deploy
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│Health Check     │ ◄── Verify deployment (2min)
│& Smoke Tests    │
└─────────────────┘
```

---

## Troubleshooting

### Common Issues

#### 1. Deployment Fails - Migration Error

**Symptoms:** Database migration fails during deployment

**Solution:**
```bash
# Validate migrations locally
just validate-migrations

# Test migrations on local database
export DATABASE_URL="postgresql://user:pass@localhost/morse"
just migrate

# Check migration logs in Render dashboard
render logs -s morse-api | grep -i migration
```

#### 2. Health Check Fails After Deployment

**Symptoms:** /health endpoint returns 500 or times out

**Solution:**
```bash
# Check API logs
render logs -s morse-api --tail 100

# Common causes:
# - Database connection failed (check DATABASE_URL)
# - Redis connection failed (check REDIS_HOST/PORT/PASSWORD)
# - Missing environment variables
# - Migration not completed

# Verify environment variables in Render dashboard
render services list
```

#### 3. High Response Times

**Symptoms:** P95 >150ms, slow API responses

**Solution:**
```bash
# Monitor performance
just monitor

# Check database query performance
# Add logging in morse-backend/services/api/src/routes/

# Consider:
# - Add database indexes
# - Implement caching
# - Upgrade Render plan (more CPU/RAM)
```

#### 4. Smoke Tests Fail

**Symptoms:** User registration/login fails in tests

**Solution:**
```bash
# Check if database is accessible
curl https://your-api.onrender.com/health

# Verify JWT_SECRET is set
# Render dashboard > morse-api > Environment

# Check logs for errors
render logs -s morse-api | grep -i error
```

#### 5. Frontend Can't Connect to API

**Symptoms:** Frontend shows connection errors

**Solution:**
```bash
# Verify REACT_APP_API_URL is set correctly
# Should be: https://morse-api.onrender.com (external URL)

# Check CORS settings in morse-backend/services/api/src/app.js
# Should allow frontend domain

# Test API directly
curl https://morse-api.onrender.com/health
```

### Debug Checklist

When deployment fails:

- [ ] Check Render dashboard for service status
- [ ] Review deployment logs: `render logs -s [service]`
- [ ] Verify environment variables are set
- [ ] Confirm database migrations completed
- [ ] Test health endpoints manually
- [ ] Check for recent code changes
- [ ] Review CI/CD pipeline logs
- [ ] Check external service status (Render status page)

### Getting Help

1. **Check logs:**
   ```bash
   render logs -s morse-api --tail 500
   render logs -s morse-frontend --tail 500
   ```

2. **Run local diagnostics:**
   ```bash
   just validate
   just health
   just smoke
   ```

3. **Review recent changes:**
   ```bash
   git log --oneline -10
   git diff HEAD~1
   ```

4. **Emergency rollback:**
   ```bash
   just emergency-rollback morse-api
   ```

---

## Performance Targets

| Metric | Target | Monitoring |
|--------|--------|------------|
| **Deployment Time** | <5 min | GitHub Actions |
| **Test Suite** | <3 min | CI pipeline |
| **Smoke Tests** | <60 sec | scripts/smoke-test.sh |
| **Health Check** | <30 sec | scripts/health-check.sh |
| **Rollback Time** | <2 min | scripts/rollback.sh |
| **API Response (p95)** | <150ms | monitor-deployment.sh |
| **Frontend LCP** | <2.5s | monitor-deployment.sh |
| **Error Rate** | <1% | Real User Monitoring |

---

## Best Practices

### Before Every Deployment

1. Run full validation:
   ```bash
   just pre-deploy
   ```

2. Review changes:
   ```bash
   git diff main
   ```

3. Update changelog (if applicable)

4. Notify team of deployment

### During Deployment

1. Monitor in real-time:
   ```bash
   just monitor
   ```

2. Watch Render dashboard

3. Be ready to rollback:
   ```bash
   # In another terminal, have ready:
   just emergency-rollback morse-api
   ```

### After Deployment

1. Run smoke tests:
   ```bash
   just smoke
   ```

2. Check error rates (15-30 min window)

3. Review logs for warnings

4. Verify new features work as expected

### Emergency Procedures

**If deployment causes outage:**

```bash
# Immediate rollback
just emergency-rollback morse-api

# Verify rollback success
just health

# Investigate issue offline
git checkout -b hotfix/issue-name

# Fix and test locally
just test

# Deploy hotfix
just deploy-msg "Hotfix: [description]"
```

---

## Summary

The MORSE deployment automation provides:

- **One-command deployment:** `just deploy-full`
- **Fast feedback:** Tests complete in <3 minutes
- **Automated validation:** Pre-flight checks catch issues early
- **Real-time monitoring:** Track performance during deployment
- **Quick rollback:** <2 minutes to previous version
- **CI/CD pipeline:** Automatic testing and deployment
- **Production-ready:** Health checks, smoke tests, error handling

**You can deploy with confidence, knowing:**
- All tests pass before deployment
- Migrations are validated
- Health checks verify the deployment
- Smoke tests confirm critical paths work
- Monitoring alerts on issues
- Rollback is automated and fast

---

## Next Steps

1. **Setup GitHub Secrets:**
   - Add RENDER_API_URL and RENDER_FRONTEND_URL

2. **Enable Auto-Deploy:**
   - Render dashboard > Settings > Auto-Deploy: ON

3. **Configure Monitoring:**
   - Setup UptimeRobot for health checks
   - (Optional) Add Sentry for error tracking

4. **First Deployment:**
   ```bash
   just deploy-full
   ```

5. **Monitor for 15-30 minutes after first deployment**

---

**Questions or Issues?**
- Check the Troubleshooting section
- Review Render logs: `render logs -s morse-api`
- Run diagnostics: `just validate && just health`
