# MORSE Render Deployment Guide

## The Simplest Possible Deployment

This setup uses Render's infrastructure-as-code to deploy everything with one click. No Kubernetes, no complex orchestration, just Docker containers and managed services.

## Architecture

```
morse-frontend (Web Service)
  ├─ Serves React build on port 3001
  └─ Proxies /api/* to morse-api

morse-api (Web Service)
  ├─ Runs Express API on port 3000
  ├─ Connects to morse-db (PostgreSQL)
  └─ Connects to morse-redis (Redis)

morse-db (Managed PostgreSQL)
  └─ Runs migrations automatically before deploy

morse-redis (Managed Redis)
  └─ Used for job queues and caching
```

## Prerequisites

1. GitHub account with this repo
2. Render account (free at https://render.com)
3. Google Gemini API key (from https://ai.google.dev)

## Deployment Steps

### 1. Push Your Code to GitHub

```bash
git add .
git commit -m "Add Render deployment configuration"
git push origin main
```

### 2. Deploy via Render Dashboard

1. Go to https://dashboard.render.com
2. Click "New" → "Blueprint"
3. Connect your GitHub account if not already connected
4. Select the `morse` repository
5. Render will automatically detect `render.yaml`
6. Click "Apply"

### 3. Set Manual Environment Variables

Render will create all services, but you need to set one manual variable:

1. Go to your `morse-api` service in the dashboard
2. Click "Environment"
3. Add:
   - **Key**: `GEMINI_API_KEY`
   - **Value**: Your Google Gemini API key from https://ai.google.dev

4. Click "Save Changes" (service will auto-redeploy)

### 4. Wait for Deployment

- PostgreSQL: ~2 minutes (runs migrations automatically)
- Redis: ~1 minute
- Backend API: ~3-5 minutes (Docker build)
- Frontend: ~3-5 minutes (Docker build + React build)

Total time: **~10 minutes**

### 5. Access Your Application

Once deployed, Render provides URLs:
- **Frontend**: `https://morse-frontend.onrender.com` (your main app)
- **API**: `https://morse-api.onrender.com` (backend, used internally)

## Cost Breakdown

### Free Tier (First 90 days)
- Frontend: $0 (free tier)
- Backend: $0 (free tier)
- PostgreSQL: $0 (90-day trial)
- Redis: $0 (25MB free tier)

**Total: $0/month**

### After Free Tier
- Frontend: $7/month (Starter plan)
- Backend: $7/month (Starter plan)
- PostgreSQL: $7/month (Starter plan)
- Redis: $0 (25MB free tier sufficient)

**Total: $21/month**

## Database Migrations

Migrations run automatically before each deploy via `preDeployCommand` in `render.yaml`:

```bash
./init-db.sh
```

The script runs migrations in order:
1. `001_initial_schema.sql` - Base tables, indexes
2. `002_workout_tables.sql` - Workout data structures
3. `003_workout_sessions.sql` - Session tracking
4. `004_auth_refactor.sql` - Authentication system
5. `005_teams.sql` - Team features
6. `006_device_linking_system.sql` - Device management

**Test data is NOT loaded in production** (005_test_data.sql is skipped).

## Environment Variables

All environment variables are automatically configured via `render.yaml`:

### Backend (morse-api)
- `DATABASE_URL` - Auto-populated from morse-db
- `REDIS_HOST` - Auto-populated from morse-redis
- `REDIS_PORT` - Auto-populated from morse-redis
- `REDIS_PASSWORD` - Auto-populated from morse-redis
- `GEMINI_API_KEY` - **MANUAL: Set in Render dashboard**
- `NODE_ENV=production`
- `PORT=3000`

### Frontend (morse-frontend)
- `REACT_APP_API_URL` - Auto-populated from morse-api host
- `NODE_ENV=production`
- `PORT=3001`

## Health Checks

Render automatically monitors service health:

- **Backend**: `GET /health` - Returns JSON with status and timestamp
- **Frontend**: `GET /` - Returns React app

If health checks fail, Render automatically restarts the service.

## Logs and Monitoring

View logs in real-time:
1. Go to Render Dashboard
2. Click on any service
3. Click "Logs" tab

Logs show:
- Application startup
- HTTP requests (via Morgan middleware)
- Database connections
- Redis connections
- Errors and stack traces

## Scaling

### Vertical Scaling (More Resources)
1. Go to service in dashboard
2. Click "Settings"
3. Change plan (Starter → Standard → Pro)

### Horizontal Scaling (More Instances)
Only available on Standard plan and above:
1. Go to service settings
2. Adjust "Instances" slider

**Recommendation**: Start with free/starter tier. Monitor usage. Scale only when needed.

## Troubleshooting

### Database Connection Errors
- Check that `DATABASE_URL` is set correctly in morse-api environment
- Verify morse-db is running and healthy
- Check logs for specific PostgreSQL errors

### Redis Connection Errors
The app has fallback mode - Redis errors won't crash the app:
```javascript
// QueueService.js handles Redis gracefully
handleRedisError(error) {
  console.log('Redis not available, using in-memory fallback');
  this.redisClient = null;
}
```

### API Proxy Errors (502 Bad Gateway)
- Ensure morse-api is deployed and healthy
- Check REACT_APP_API_URL in frontend environment variables
- Verify backend URL format: `https://morse-api.onrender.com` (no /api suffix)

### Migration Failures
If migrations fail:
1. Go to morse-db service
2. Click "Shell" tab
3. Manually run migrations:
```bash
psql $DATABASE_URL -f morse-backend/database/migrations/001_initial_schema.sql
# ... etc
```

### Deployment Stuck
- Check build logs for errors
- Verify Dockerfiles are correct
- Ensure all dependencies are in package.json
- Check that file paths in render.yaml are correct

## Rolling Back

If a deployment breaks:
1. Go to service in dashboard
2. Click "Deploys" tab
3. Find last working deploy
4. Click "..." → "Rollback"

## Zero-Downtime Deploys

Render does this automatically:
1. Builds new version
2. Runs health checks on new version
3. Only switches traffic once new version is healthy
4. Old version stays running until switch completes

## What's NOT Included

1. **Worker Service**: Removed - transcription happens in API service via Google Gemini API
2. **Kubernetes**: Removed - Render handles container orchestration
3. **Custom nginx**: Removed - Render handles load balancing
4. **Separate transcription pipeline**: Removed - API calls Gemini directly

## Custom Domain (Optional)

To use your own domain:
1. Go to morse-frontend service
2. Click "Settings" → "Custom Domain"
3. Add your domain (e.g., `app.morse.com`)
4. Update DNS records as instructed by Render
5. Render provides free SSL certificate via Let's Encrypt

## Backup Strategy

### Database Backups
Render automatically backs up PostgreSQL:
- **Free tier**: No automated backups (manual backups via pg_dump)
- **Paid tier**: Daily automated backups, 7-day retention

Manual backup:
```bash
# Download backup
render psql morse-db pg_dump > backup.sql

# Restore backup
psql $DATABASE_URL < backup.sql
```

### File Storage Note
This app stores uploaded audio files in the container filesystem (`/app/uploads`). **These are ephemeral and lost on redeploy.**

For production, recommend migrating to:
- AWS S3
- Cloudflare R2
- Render Disks (persistent storage add-on)

## Monitoring and Alerts

Set up alerts in Render dashboard:
1. Go to service settings
2. Scroll to "Notifications"
3. Add email/Slack/webhook for:
   - Deploy failures
   - Service crashes
   - High CPU/memory usage

## Development vs Production

### Development (Local)
```bash
cd morse-backend/services/api
npm run dev  # Nodemon with hot reload

cd morse-backend/services/frontend
npm start    # React dev server
```

### Production (Render)
- Uses production Dockerfiles
- Minified React build
- Production dependencies only
- Health checks enabled
- Auto-restart on failure

## Next Steps

After deployment:
1. Test the app at your frontend URL
2. Create a test user account
3. Upload a workout audio file
4. Verify transcription works (check Gemini API key is set)
5. Monitor logs for any errors
6. Set up custom domain (optional)
7. Configure backup strategy

## Support

- Render Docs: https://render.com/docs
- Render Status: https://status.render.com
- Community Forum: https://community.render.com
