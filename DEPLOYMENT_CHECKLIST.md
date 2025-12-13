# Render Deployment Checklist

## Pre-Deployment

- [ ] Code is committed to git
- [ ] Code is pushed to GitHub (main branch)
- [ ] You have a Render account (https://render.com)
- [ ] You have a Google Gemini API key (https://ai.google.dev)

## Deployment

- [ ] Go to https://dashboard.render.com
- [ ] Click "New" → "Blueprint"
- [ ] Connect GitHub repository
- [ ] Select `morse` repository
- [ ] Render detects `render.yaml`
- [ ] Click "Apply"
- [ ] Wait for services to build (~10 minutes)

## Post-Deployment Configuration

- [ ] Go to `morse-api` service
- [ ] Click "Environment" tab
- [ ] Add `GEMINI_API_KEY` with your API key
- [ ] Click "Save Changes" (auto-redeploys)
- [ ] Wait for redeploy (~3 minutes)

## Verification

- [ ] Check all services are "Live" (green status)
- [ ] Visit frontend URL (e.g., `https://morse-frontend.onrender.com`)
- [ ] App loads without errors
- [ ] Create test user account
- [ ] Upload test audio file
- [ ] Check that transcription completes
- [ ] View workout data in dashboard

## Monitoring

- [ ] Check logs in each service
- [ ] Verify database connection (no connection errors)
- [ ] Verify Redis connection (or graceful fallback)
- [ ] Set up notification alerts (optional)

## Cost Optimization

### First 90 Days (Free)
- All services on free tier
- PostgreSQL free trial (90 days)
- Redis free tier (25MB)
- Total: $0/month

### After 90 Days
- [ ] Decide if you want to continue with paid tier ($21/month)
- [ ] OR migrate to different hosting
- [ ] OR shutdown services

## Common Issues

### Issue: "Database connection failed"
**Fix**:
1. Check morse-db service is running
2. Verify DATABASE_URL is set in morse-api environment
3. Check database logs for errors

### Issue: "Redis connection timeout"
**Fix**:
1. Check morse-redis service is running
2. App should fallback to in-memory mode gracefully
3. Check logs for "Redis not available, using in-memory fallback"

### Issue: "502 Bad Gateway on /api routes"
**Fix**:
1. Check morse-api service is running
2. Verify REACT_APP_API_URL in frontend: `http://morse-api:3000`
3. Check API health endpoint: `https://morse-api.onrender.com/health`

### Issue: "Transcription not working"
**Fix**:
1. Verify GEMINI_API_KEY is set in morse-api environment
2. Check API key is valid at https://ai.google.dev
3. Check API logs for Gemini API errors

### Issue: "Migration failed"
**Fix**:
1. Go to morse-db in dashboard
2. Click "Shell" tab
3. Manually run migrations:
   ```bash
   psql $DATABASE_URL -f morse-backend/database/migrations/001_initial_schema.sql
   # Continue with 002, 003, 004, 005, 006
   ```

## Rollback Plan

If deployment fails:
1. Go to service in dashboard
2. Click "Deploys" tab
3. Find last working deploy
4. Click "..." → "Rollback"

## Support Resources

- **Render Docs**: https://render.com/docs
- **Render Community**: https://community.render.com
- **Render Status**: https://status.render.com
- **GitHub Issues**: (your repo)/issues

## Service URLs (Fill in after deployment)

- Frontend: `____________________________`
- API: `____________________________`
- Database: (internal only)
- Redis: (internal only)

## API Keys (Store securely)

- Gemini API Key: `____________________________`
- JWT Secret: (auto-generated or set manually)

## Notes

```
(Add deployment date, issues encountered, customizations, etc.)




```
