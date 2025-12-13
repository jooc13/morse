# MORSE Workout Tracker - Render Deployment

> The simplest possible deployment strategy for a production-ready workout tracking application.

## What Is This?

A complete, automated deployment configuration for deploying the MORSE workout tracker to Render.com with:

- Zero manual infrastructure setup
- One-click deployment from GitHub
- Free for 90 days, then $21/month
- Complete in ~10 minutes
- Zero-downtime updates

## Quick Start

```bash
# 1. Validate everything is ready
./validate-render-config.sh

# 2. Push to GitHub
git add .
git commit -m "Add Render deployment"
git push origin main

# 3. Deploy via Render Dashboard
# https://dashboard.render.com/blueprints → New Blueprint
# Select: morse repository → Apply

# 4. Set Google Gemini API key
# morse-api service → Environment → Add GEMINI_API_KEY

# Done! App is live.
```

**Full instructions**: See [QUICK_START.md](QUICK_START.md)

## Documentation Index

Start here based on your needs:

| Document | Purpose | Read Time |
|----------|---------|-----------|
| **[QUICK_START.md](QUICK_START.md)** | Deploy right now | 2 min |
| **[DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md)** | Executive overview | 5 min |
| **[DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)** | Step-by-step with checkboxes | 10 min |
| **[RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md)** | Complete guide + troubleshooting | 20 min |
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | Technical deep dive | 30 min |

## Files Created

### Core Deployment Files
- **`render.yaml`** - Infrastructure-as-code blueprint for Render
- **`init-db.sh`** - Automated database migration script

### Validation & Templates
- **`validate-render-config.sh`** - Pre-deployment configuration checker
- **`.env.example`** - Environment variables template for local dev

### Documentation
- **`QUICK_START.md`** - 30-second summary + 10-minute deployment
- **`DEPLOYMENT_SUMMARY.md`** - Executive summary with costs and timeline
- **`DEPLOYMENT_CHECKLIST.md`** - Interactive deployment checklist
- **`RENDER_DEPLOYMENT.md`** - Comprehensive deployment guide
- **`ARCHITECTURE.md`** - System architecture and design decisions

## Architecture Overview

```
User → morse-frontend (React) → morse-api (Node.js) → PostgreSQL
                                                     → Redis
                                                     → Google Gemini API
```

**4 Services, Zero Complexity**:
1. Frontend - Serves React app + proxies API
2. Backend - REST API + authentication + transcription
3. PostgreSQL - Database (managed)
4. Redis - Job queue (managed)

## What Was Simplified

Deleted from Kubernetes version:
- ❌ 15+ YAML files → ✅ 1 render.yaml
- ❌ Manual LoadBalancer config → ✅ Auto-configured
- ❌ Manual SSL certificates → ✅ Free, auto-renewing
- ❌ Manual environment variables → ✅ Auto-linked
- ❌ Complex migration scripts → ✅ Simple bash script
- ❌ Separate worker service → ✅ Transcription in API
- ❌ Manual scaling → ✅ One-click scaling

**Result**: 95% less configuration, same functionality.

## Cost Breakdown

| Phase | Duration | Cost | Notes |
|-------|----------|------|-------|
| **Trial** | 90 days | **$0/month** | Everything free |
| **Production** | Ongoing | **$21/month** | After trial ends |

**Breakdown after trial**:
- Frontend: $7/month (Starter plan)
- Backend: $7/month (Starter plan)
- PostgreSQL: $7/month (Starter, 10GB)
- Redis: $0/month (Free tier, 25MB)

## Deployment Timeline

| Time | Event |
|------|-------|
| 0:00 | Click "Apply" in Render |
| 0:30 | PostgreSQL & Redis provisioned |
| 2:00 | Database migrations complete |
| 5:00 | Backend API deployed |
| 8:00 | Frontend deployed |
| 9:00 | All services healthy |
| **10:00** | **App is live!** |

## Environment Variables

### Auto-Configured (No Action Required)
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` - Redis connection
- `REACT_APP_API_URL` - Frontend → Backend routing
- `NODE_ENV=production` - Production mode
- `PORT` - Service ports (3000, 3001)

### Manual (Set Once in Dashboard)
- `GEMINI_API_KEY` - Google Gemini API key for transcription

That's it. One variable to set manually.

## Production Readiness

✅ **Ready for Production**:
- Dockerized services
- Automated migrations
- Health checks
- Zero-downtime deploys
- HTTPS/SSL
- Rate limiting
- Security headers
- Error handling
- Structured logging

⚠️ **Known Limitation**:
- Audio files stored in ephemeral container storage
- **Impact**: Files deleted on redeploy
- **Fix**: Migrate to S3/R2 when ready for production (2-3 hours work)

## Scaling Strategy

**Start small, scale when needed:**

1. **Free/Starter tier** until 100+ active users
2. **Monitor** CPU, memory, response times in Render dashboard
3. **Scale vertically** (bigger instances) when CPU > 80%
4. **Scale horizontally** (more instances) when response time > 2s
5. **Upgrade database** when connections maxed out

**Don't scale prematurely.** Wait for actual usage data.

## Deployment Process

### Option 1: Blueprint (Recommended)
1. Push code to GitHub
2. Render Dashboard → New Blueprint
3. Select repository → Apply
4. Set GEMINI_API_KEY
5. Done

### Option 2: Manual (Not Recommended)
Create each service manually. Much slower. Don't do this.

## Troubleshooting

### Services won't start
**Check**: Build logs in Render dashboard
**Common cause**: Missing dependencies in package.json

### Database connection fails
**Check**: morse-api logs for "DATABASE_URL"
**Fix**: Verify morse-db service is running and healthy

### Transcription doesn't work
**Check**: GEMINI_API_KEY is set in morse-api environment
**Fix**: Add the variable in dashboard, save changes

### 502 Bad Gateway
**Check**: Is morse-api service showing "Live" status?
**Fix**: Wait 2 more minutes or restart service

### Full troubleshooting guide
See [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md) section "Troubleshooting"

## Monitoring

### Real-Time Logs
1. Go to service in dashboard
2. Click "Logs" tab
3. See live stdout/stderr

### Health Checks
- Frontend: `GET /` every 30s
- Backend: `GET /health` every 30s
- Auto-restart on 3 consecutive failures

### Alerts (Optional)
Settings → Notifications → Add email/Slack webhook

## Backup & Recovery

### Database Backups
- **Free tier**: No automated backups (manual via pg_dump)
- **Paid tier**: Daily automated backups, 7-day retention

### Rollback
1. Service → Deploys tab
2. Find last working deploy
3. Click "..." → Rollback

## Security

- ✅ HTTPS only (auto SSL certificates)
- ✅ Helmet.js security headers
- ✅ Rate limiting (10,000 req/15min)
- ✅ CORS enabled
- ✅ Encrypted database connections
- ✅ Environment variables encrypted at rest
- ✅ JWT authentication
- ✅ bcrypt password hashing

## Support Resources

- **Render Docs**: https://render.com/docs
- **Render Community**: https://community.render.com
- **Render Status**: https://status.render.com
- **Google Gemini**: https://ai.google.dev/docs

## Next Steps After Deployment

1. ✅ Deploy and verify everything works
2. ✅ Test with real workout audio files
3. ✅ Invite beta users
4. ⚠️ Monitor usage and costs
5. ⚠️ Plan S3 migration for file storage (before production)
6. ⚠️ Set up error monitoring (Sentry)
7. ⚠️ Add custom domain (optional)
8. ⚠️ Configure backup strategy

## Development Workflow

### Local Development
```bash
# Backend
cd morse-backend/services/api
npm install
npm run dev  # Uses .env file

# Frontend
cd morse-backend/services/frontend
npm install
npm start    # React dev server
```

### Production Deployment
```bash
git add .
git commit -m "Update feature"
git push origin main
# Render auto-deploys via GitHub integration
```

## Contributing to Deployment Config

If you improve the deployment:

1. Update relevant docs
2. Run `./validate-render-config.sh`
3. Test on Render
4. Commit changes
5. Update this README

## License

See main project LICENSE file.

## Questions?

1. Check [QUICK_START.md](QUICK_START.md) for immediate deployment
2. Read [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) for step-by-step
3. See [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md) for deep troubleshooting
4. Review [ARCHITECTURE.md](ARCHITECTURE.md) for technical details
5. Ask in Render Community: https://community.render.com

---

**TL;DR**: Run `./validate-render-config.sh`, push to GitHub, click "Blueprint" in Render, set one API key. Your app is live in 10 minutes.
