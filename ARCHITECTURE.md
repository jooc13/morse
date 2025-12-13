# MORSE Architecture on Render

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         Internet                            │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ HTTPS
                      │
              ┌───────▼────────┐
              │  Render CDN    │
              │  Load Balancer │
              └───────┬────────┘
                      │
         ┌────────────┴────────────┐
         │                         │
    ┌────▼─────┐            ┌─────▼──────┐
    │ Frontend │            │  API       │
    │ Service  │◄───────────│  Service   │
    │          │  Internal  │            │
    │ Port     │  Network   │ Port 3000  │
    │ 3001     │            │            │
    └────┬─────┘            └─────┬──────┘
         │                        │
         │                   ┌────┴─────┬────────┐
         │                   │          │        │
         │              ┌────▼───┐ ┌───▼────┐   │
         │              │ Postgres│ │ Redis  │   │
         │              │   DB    │ │ Queue  │   │
         │              └─────────┘ └────────┘   │
         │                                       │
         │                                  ┌────▼────────┐
         │                                  │ Google      │
         └──────────────────────────────────│ Gemini API  │
                   Client Requests          └─────────────┘
```

## Components

### 1. Frontend Service (`morse-frontend`)
- **Technology**: React 18 + Express
- **Port**: 3001
- **Purpose**:
  - Serves static React build
  - Proxies `/api/*` requests to backend
  - Single-page application (SPA)
- **Resources**:
  - 512MB RAM (free tier)
  - 0.1 CPU (free tier)
- **Build**: Docker multi-stage build
  - Stage 1: Build React app
  - Stage 2: Production Express server

### 2. API Service (`morse-api`)
- **Technology**: Node.js + Express
- **Port**: 3000
- **Purpose**:
  - REST API endpoints
  - Audio file uploads
  - User authentication
  - Workout data management
  - Team features
  - Transcription via Gemini API
- **Resources**:
  - 512MB RAM (free tier)
  - 0.1 CPU (free tier)
- **Dependencies**:
  - PostgreSQL (database)
  - Redis (job queue)
  - Google Gemini API (transcription)

### 3. PostgreSQL Database (`morse-db`)
- **Technology**: Managed PostgreSQL 14+
- **Storage**: 1GB (free tier for 90 days)
- **Purpose**:
  - User data
  - Workout sessions
  - Exercise data
  - Team data
  - Audio file metadata
- **Migrations**: Auto-run on deploy via `preDeployCommand`

### 4. Redis Cache (`morse-redis`)
- **Technology**: Managed Redis 6+
- **Storage**: 25MB (free tier)
- **Purpose**:
  - Job queue (Bull)
  - Caching
  - Session management
- **Eviction**: `allkeys-lru` (removes oldest keys when full)
- **Fallback**: App runs without Redis if unavailable

## Data Flow

### User Uploads Workout Audio

```
1. User uploads audio file
   │
   ▼
2. Frontend → POST /api/upload
   │
   ▼
3. API receives file
   │
   ├──► Saves to /app/uploads (ephemeral)
   │
   ├──► Creates audio_files record in PostgreSQL
   │
   └──► Adds transcription job to Redis queue
        │
        ▼
4. Background worker processes job
   │
   ├──► Calls Google Gemini API
   │
   ├──► Receives transcription text
   │
   ├──► Parses workout data
   │
   ├──► Saves to PostgreSQL:
   │     - transcriptions table
   │     - workouts table
   │     - exercises table
   │
   └──► Updates audio_files.transcription_status = 'completed'
        │
        ▼
5. Frontend polls GET /api/workouts/{userId}
   │
   ▼
6. Displays workout data in dashboard
```

### User Views Workout History

```
1. User navigates to dashboard
   │
   ▼
2. Frontend → GET /api/workouts/{userId}
   │
   ▼
3. API queries PostgreSQL
   │
   ├──► Joins workouts + exercises + transcriptions
   │
   └──► Returns JSON response
        │
        ▼
4. Frontend renders workout cards with charts
```

## Database Schema

### Core Tables

1. **users** - User accounts (device-based auth)
2. **audio_files** - Uploaded audio metadata
3. **transcriptions** - AI-generated transcripts
4. **workouts** - Workout sessions
5. **exercises** - Individual exercises within workouts
6. **workout_sessions** - Session tracking
7. **teams** - Team management
8. **team_members** - Team membership

### Relationships

```
users (1) ──────► (many) audio_files
audio_files (1) ─► (1) transcriptions
audio_files (1) ─► (1) workouts
workouts (1) ────► (many) exercises
users (1) ───────► (many) team_members
teams (1) ───────► (many) team_members
```

## Environment Variables

### Frontend (`morse-frontend`)
- `NODE_ENV=production`
- `PORT=3001`
- `REACT_APP_API_URL=http://morse-api:3000`

### Backend (`morse-api`)
- `NODE_ENV=production`
- `PORT=3000`
- `DATABASE_URL=postgresql://...` (auto-populated)
- `REDIS_HOST=...` (auto-populated)
- `REDIS_PORT=...` (auto-populated)
- `REDIS_PASSWORD=...` (auto-populated)
- `GEMINI_API_KEY=...` (manual)

## Network Communication

### External (Internet → Render)
- HTTPS on port 443
- Render provides free SSL certificates
- Automatic HTTPS redirect from HTTP

### Internal (Service → Service)
- HTTP on internal network
- DNS-based service discovery
- Format: `http://{service-name}:{port}`
- Example: `http://morse-api:3000`

### Service → Database
- PostgreSQL wire protocol
- Connection pooling via `pg` library
- SSL/TLS encrypted connections

### Service → Redis
- Redis protocol (RESP)
- Password authentication
- Graceful fallback if unavailable

### API → External APIs
- HTTPS to Google Gemini API
- API key authentication
- Rate limiting handled by Google

## Deployment Pipeline

```
1. Developer pushes to GitHub
   │
   ▼
2. Render detects commit
   │
   ▼
3. Builds services in parallel:
   │
   ├──► Frontend Docker build
   │     └─► npm install
   │         └─► npm run build
   │             └─► Copy to production image
   │
   └──► Backend Docker build
         └─► npm install --production
             └─► Copy source files
   │
   ▼
4. Run preDeployCommand (database migrations)
   │
   ▼
5. Health checks
   │
   ├──► Frontend: GET /
   └──► Backend: GET /health
   │
   ▼
6. Zero-downtime deployment
   │
   ├──► Start new instances
   ├──► Wait for healthy
   ├──► Switch traffic
   └──► Shutdown old instances
```

## Scaling Strategy

### Vertical Scaling (More Resources Per Service)
- Free → Starter ($7/mo): 512MB → 2GB RAM
- Starter → Standard ($25/mo): 2GB → 4GB RAM
- Standard → Pro ($85/mo): 4GB → 8GB RAM

### Horizontal Scaling (More Instances)
- Not available on free tier
- Standard+: 1-10 instances
- Load balanced automatically

### Database Scaling
- Free (90 days): 1GB storage
- Starter ($7/mo): 10GB storage
- Standard ($50/mo): 50GB storage, high availability

### When to Scale?
1. Monitor metrics in Render dashboard
2. If CPU > 80% for 10+ minutes → vertical scale
3. If memory > 90% → vertical scale
4. If response time > 2s → horizontal scale
5. If database connections maxed → upgrade database plan

## Cost Breakdown

### Free Tier (First 90 Days)
```
Frontend:     $0  (512MB RAM, free tier)
Backend:      $0  (512MB RAM, free tier)
PostgreSQL:   $0  (1GB storage, 90-day trial)
Redis:        $0  (25MB storage, always free)
───────────────────
Total:        $0/month
```

### After Free Trial
```
Frontend:     $7/month  (Starter)
Backend:      $7/month  (Starter)
PostgreSQL:   $7/month  (Starter, 10GB)
Redis:        $0/month  (Free tier)
───────────────────────
Total:        $21/month
```

## Security

### Network Security
- All external traffic HTTPS only
- Internal traffic HTTP (private network)
- No public database access
- No public Redis access

### Application Security
- Helmet.js (security headers)
- CORS enabled
- Rate limiting (10,000 req/15min)
- File upload limits (10MB)
- JWT authentication
- bcrypt password hashing

### Database Security
- Encrypted connections (SSL/TLS)
- User-level permissions
- Automated backups (paid tier)
- Password rotation supported

### Secrets Management
- Environment variables encrypted at rest
- No secrets in git repository
- Manual secrets (GEMINI_API_KEY) set via dashboard
- Auto-generated database credentials

## Monitoring

### Health Checks
- Frontend: `GET /` every 30 seconds
- Backend: `GET /health` every 30 seconds
- Auto-restart on 3 consecutive failures

### Logs
- Stdout/stderr captured automatically
- Searchable in dashboard
- Morgan HTTP request logging
- Error stack traces included
- Retention: 7 days (free), 30 days (paid)

### Metrics (Paid Tier Only)
- CPU usage
- Memory usage
- Request rate
- Response time
- Error rate

## Limitations

### Free Tier Limits
- Services sleep after 15 minutes of inactivity
- 750 hours/month per service
- No horizontal scaling
- No autoscaling
- 7-day log retention

### Known Issues
1. **Ephemeral Storage**: Uploaded audio files lost on redeploy
   - **Solution**: Migrate to S3/R2 for production
2. **Cold Starts**: Free tier services sleep when idle
   - **Impact**: First request after sleep takes 30-60s
   - **Solution**: Upgrade to paid tier or use cron job to keep warm
3. **Database Trial**: PostgreSQL free for 90 days only
   - **Solution**: Budget for $7/month or migrate to different host

## Future Improvements

1. **Persistent Storage**: Add Render Disk or S3 for audio files
2. **CDN**: Use Cloudflare for static assets
3. **Caching**: Add Redis caching layer for API responses
4. **Monitoring**: Add Sentry for error tracking
5. **Analytics**: Add PostHog or Mixpanel
6. **Email**: Add SendGrid for notifications
7. **Background Jobs**: Separate worker service for transcription
8. **WebSockets**: Add real-time updates for transcription progress
