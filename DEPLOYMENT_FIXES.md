# Quick Deployment Fixes - Action Plan

This guide provides the **exact code changes** needed to fix critical and high-priority issues before deploying to Render.

---

## CRITICAL FIX #1: Remove Conflicting Build Commands from render.yaml

**File:** `/Users/iudofia/Documents/GitHub/morse/render.yaml`

### Current Code (WRONG):
```yaml
services:
  - type: web
    name: morse-api
    runtime: docker
    dockerfilePath: ./morse-backend/services/api/Dockerfile
    dockerContext: ./morse-backend/services/api
    envVars:
      # ... env vars ...
    healthCheckPath: /health
    autoDeploy: true
    buildCommand: npm install --only=production  # ❌ REMOVE THIS
    startCommand: dumb-init node src/app.js      # ❌ REMOVE THIS
```

### Fixed Code (CORRECT):
```yaml
services:
  - type: web
    name: morse-api
    runtime: docker
    dockerfilePath: ./morse-backend/services/api/Dockerfile
    dockerContext: ./morse-backend/services/api
    envVars:
      # ... env vars ...
    healthCheckPath: /health
    autoDeploy: true
    # ✅ No buildCommand - Dockerfile handles it
    # ✅ No startCommand - Use Dockerfile CMD
```

### Also Fix Frontend Service:
```yaml
  - type: web
    name: morse-frontend
    runtime: docker
    dockerfilePath: ./morse-backend/services/frontend/Dockerfile
    dockerContext: ./morse-backend/services/frontend
    envVars:
      # ... env vars ...
    healthCheckPath: /
    autoDeploy: true
    # ✅ Remove buildCommand: npm install && npm run build
    # ✅ Remove startCommand: node server.js
```

**Why:** When using `runtime: docker`, Render should execute the Dockerfile CMD directly. The buildCommand and startCommand override this and cause conflicts.

---

## CRITICAL FIX #2: Fix File Storage (Ephemeral Filesystem Issue)

**Recommended Solution:** Process files from memory buffer instead of saving to disk.

### Step 1: Update TranscriptionService.js

**File:** `/Users/iudofia/Documents/GitHub/morse/morse-backend/services/api/src/services/TranscriptionService.js`

**Change the transcribeWithGemini method signature:**

```javascript
// OLD signature:
async transcribeWithGemini(filePath, audioFileId)

// NEW signature:
async transcribeWithGemini(audioBuffer, mimeType, audioFileId)
```

**Full updated method:**
```javascript
async transcribeWithGemini(audioBuffer, mimeType, audioFileId) {
  if (!this.apiKey) {
    throw new Error('GOOGLE_GEMINI_API_KEY or GEMINI_API_KEY environment variable is required');
  }

  try {
    // Convert buffer to base64 (no file reading needed)
    const audioBase64 = audioBuffer.toString('base64');

    // Call Gemini API for transcription
    const model = 'gemini-2.0-flash-exp';
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`,
      {
        contents: [{
          parts: [
            {
              text: "Transcribe this audio recording of someone describing their workout. Extract the spoken text verbatim. Return only the transcription text, no additional commentary or formatting."
            },
            {
              inline_data: {
                mime_type: mimeType,
                data: audioBase64
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.0,
          maxOutputTokens: 8192,
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 120000
      }
    );

    const transcriptionText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!transcriptionText) {
      throw new Error('No transcription text returned from Gemini API');
    }

    return {
      success: true,
      text: transcriptionText.trim(),
      confidence: 0.9,
      processing_time_ms: 0,
      language: 'en',
      provider: 'gemini'
    };
  } catch (error) {
    console.error('Gemini transcription error:', error.response?.data || error.message);
    const errorMessage = error.response?.data?.error?.message || error.message;

    const isQuotaError = errorMessage.includes('quota') ||
                        errorMessage.includes('rate limit') ||
                        error.response?.status === 429;

    if (isQuotaError) {
      return {
        success: false,
        error: errorMessage,
        retryable: true,
        retryAfter: error.response?.data?.error?.retryAfter || 60
      };
    }

    throw new Error(`Gemini transcription failed: ${errorMessage}`);
  }
}
```

### Step 2: Update upload.js to Use Buffers

**File:** `/Users/iudofia/Documents/GitHub/morse/morse-backend/services/api/src/routes/upload.js`

**Find this section (around line 114-163):**
```javascript
const { filePath, fileSize, fileId } = await FileService.saveFile(req.file, originalFilename);

const audioFile = await client.query(`...`);
```

**Replace with:**
```javascript
// Don't save file to disk - use buffer directly
const fileSize = req.file.size;
const mimeType = req.file.mimetype;

// Store null for file_path since we're not saving to disk
const audioFile = await client.query(`
  INSERT INTO audio_files (
    user_id, original_filename, file_path, file_size,
    upload_timestamp, transcription_status
  ) VALUES ($1, $2, $3, $4, $5, 'pending')
  RETURNING id, upload_timestamp
`, [userId, originalFilename, 'memory://buffer', fileSize, deviceInfo.timestampDate]);
```

**Then update the transcription call (around line 162):**
```javascript
// OLD:
transcriptionResult = await TranscriptionService.transcribeAudio(filePath, audioFileId);

// NEW:
transcriptionResult = await TranscriptionService.transcribeAudio(
  req.file.buffer,
  mimeType,
  audioFileId
);
```

**Also update the batch upload endpoint (around line 419):**
```javascript
// OLD:
const transcriptionResult = await TranscriptionService.transcribeAudio(filePath, audioFileId);

// NEW:
const transcriptionResult = await TranscriptionService.transcribeAudio(
  file.buffer,
  file.mimetype,
  audioFileId
);
```

**Remove the file saving logic entirely:**
```javascript
// DELETE these lines (around line 114 and 400):
const { filePath, fileSize, fileId } = await FileService.saveFile(req.file, originalFilename);
const { filePath, fileSize } = await FileService.saveFile(file, file.originalname);
```

### Step 3: Remove uploads directory creation from Dockerfile

**File:** `/Users/iudofia/Documents/GitHub/morse/morse-backend/services/api/Dockerfile`

**Find and REMOVE this line:**
```dockerfile
RUN mkdir -p uploads && chown -R node:node uploads
```

**Why:** We're no longer using the uploads directory.

---

## HIGH PRIORITY FIX #1: Create Shared Database Pool

**Create new file:** `/Users/iudofia/Documents/GitHub/morse/morse-backend/services/api/src/db/pool.js`

```javascript
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/morse_db',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,                      // Maximum 10 connections (Render free tier has 20 total)
  min: 2,                       // Minimum 2 connections
  idleTimeoutMillis: 30000,     // Close idle connections after 30s
  connectionTimeoutMillis: 5000, // Timeout after 5s if no connection available
});

pool.on('error', (err, client) => {
  console.error('Unexpected database pool error:', err);
  process.exit(-1);
});

pool.on('connect', (client) => {
  console.log('Database connection established');
});

module.exports = pool;
```

### Update all route files to use shared pool:

**Files to update:**
- `/Users/iudofia/Documents/GitHub/morse/morse-backend/services/api/src/routes/upload.js`
- `/Users/iudofia/Documents/GitHub/morse/morse-backend/services/api/src/routes/workouts.js`
- `/Users/iudofia/Documents/GitHub/morse/morse-backend/services/api/src/routes/auth.js`
- `/Users/iudofia/Documents/GitHub/morse/morse-backend/services/api/src/routes/teams.js`
- `/Users/iudofia/Documents/GitHub/morse/morse-backend/services/api/src/routes/sessions.js`

**In each file, replace:**
```javascript
// OLD:
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/morse_db',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// NEW:
const pool = require('../db/pool');
```

### Also update SessionService.js:

**File:** `/Users/iudofia/Documents/GitHub/morse/morse-backend/services/api/src/services/SessionService.js`

```javascript
// OLD:
const { Pool } = require('pg');

class SessionService {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/morse_db',
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  }
  // ...
}

// NEW:
const pool = require('../db/pool');

class SessionService {
  constructor() {
    this.pool = pool;
  }
  // ...
}
```

---

## HIGH PRIORITY FIX #2: Add Environment Variable Validation

**File:** `/Users/iudofia/Documents/GitHub/morse/morse-backend/services/api/src/app.js`

**Add this at the top of the file (after line 7: require('dotenv').config()):**

```javascript
require('dotenv').config();

// ===== ADD THIS SECTION =====
// Validate required environment variables on startup
function validateEnvironment() {
  const required = ['DATABASE_URL'];
  const optional = ['GEMINI_API_KEY', 'JWT_SECRET', 'REDIS_HOST'];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('❌ FATAL: Missing required environment variables:', missing.join(', '));
    console.error('Application cannot start without these variables.');
    process.exit(1);
  }

  console.log('✅ All required environment variables are set');

  // Warn about optional variables
  optional.forEach(key => {
    if (!process.env[key]) {
      console.warn(`⚠️  Optional env var not set: ${key} (some features may not work)`);
    }
  });
}

validateEnvironment();
// ===== END NEW SECTION =====

const uploadRoutes = require('./routes/upload');
// ... rest of code
```

---

## HIGH PRIORITY FIX #3: Configure CORS Properly

**File:** `/Users/iudofia/Documents/GitHub/morse/morse-backend/services/api/src/app.js`

**Replace line 20:**
```javascript
// OLD:
app.use(cors());

// NEW:
const corsOptions = {
  origin: process.env.FRONTEND_URL || ['http://localhost:3001', 'http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
```

**Then add to render.yaml (in API service envVars):**
```yaml
envVars:
  # ... existing vars ...
  - key: FRONTEND_URL
    fromService:
      type: web
      name: morse-frontend
      envVarKey: RENDER_EXTERNAL_URL
```

---

## MEDIUM PRIORITY FIX: Remove Proxy from package.json

**File:** `/Users/iudofia/Documents/GitHub/morse/morse-backend/services/frontend/package.json`

**Remove line 51:**
```json
// DELETE THIS LINE:
"proxy": "http://morse-api:3000"
```

**Why:** The server.js already handles proxying, and this proxy setting doesn't work in production.

---

## MEDIUM PRIORITY FIX: Generate package-lock.json

**Run these commands:**
```bash
cd /Users/iudofia/Documents/GitHub/morse/morse-backend/services/api
npm install
git add package-lock.json
git commit -m "Add package-lock.json for consistent API dependencies"
```

---

## OPTIONAL: Remove or Simplify Redis Queue Service

Since your application processes transcriptions **synchronously** (not via queue), you have two options:

### Option A: Make Redis Clearly Optional
**File:** `/Users/iudofia/Documents/GitHub/morse/morse-backend/services/api/src/services/QueueService.js`

**Add at the top of the class:**
```javascript
class QueueService {
  constructor() {
    this.redisClient = null;
    this.transcriptionQueue = null;
    this.isEnabled = process.env.ENABLE_REDIS === 'true'; // ✅ Add this

    if (this.isEnabled) {
      this.init();
    } else {
      console.log('⚠️  Redis queue disabled (ENABLE_REDIS not set to "true")');
    }
  }
  // ...
}
```

### Option B: Remove Redis Entirely
If you're not using the queue (which you aren't), you can remove:
- QueueService.js
- All references to QueueService in routes
- The Redis service from render.yaml
- The `bull` and `redis` dependencies from package.json

**I recommend Option A** - keep it but make it clearly optional.

---

## Summary of Changes

### Files to Modify:
1. ✅ `/Users/iudofia/Documents/GitHub/morse/render.yaml` - Remove buildCommand/startCommand
2. ✅ `/Users/iudofia/Documents/GitHub/morse/morse-backend/services/api/Dockerfile` - Remove uploads directory
3. ✅ `/Users/iudofia/Documents/GitHub/morse/morse-backend/services/api/src/services/TranscriptionService.js` - Process from buffer
4. ✅ `/Users/iudofia/Documents/GitHub/morse/morse-backend/services/api/src/routes/upload.js` - Use buffer instead of file path
5. ✅ `/Users/iudofia/Documents/GitHub/morse/morse-backend/services/api/src/app.js` - Add env validation, fix CORS
6. ✅ `/Users/iudofia/Documents/GitHub/morse/morse-backend/services/api/src/routes/*.js` - Use shared pool
7. ✅ `/Users/iudofia/Documents/GitHub/morse/morse-backend/services/frontend/package.json` - Remove proxy

### Files to Create:
1. ✅ `/Users/iudofia/Documents/GitHub/morse/morse-backend/services/api/src/db/pool.js` - Shared DB pool

### Commands to Run:
```bash
cd /Users/iudofia/Documents/GitHub/morse/morse-backend/services/api
npm install
git add .
git commit -m "Fix critical deployment issues for Render"
git push origin integration-656-vibecode
```

---

## Testing Locally Before Deployment

### 1. Test with environment variables:
```bash
export NODE_ENV=production
export DATABASE_URL="postgresql://localhost:5432/morse_db"
export GEMINI_API_KEY="your_key_here"
export REDIS_HOST="localhost"

cd /Users/iudofia/Documents/GitHub/morse/morse-backend/services/api
npm start
```

### 2. Test file upload:
```bash
curl -X POST http://localhost:3000/api/upload \
  -F "audio=@test_audio.mp3"
```

### 3. Check health endpoint:
```bash
curl http://localhost:3000/health
```

Should return:
```json
{
  "status": "healthy",
  "timestamp": "2025-12-12T...",
  "version": "1.0.0"
}
```

---

## Post-Deployment Steps

After deploying to Render:

1. **Set GEMINI_API_KEY in Render Dashboard**
   - Go to morse-api service settings
   - Add environment variable: `GEMINI_API_KEY`

2. **Initialize Database**
   ```bash
   # SSH into morse-api service via Render dashboard
   cd /app/morse-backend/database
   ./init_database.sh
   ```

3. **Verify Services**
   - API Health: `https://morse-api.onrender.com/health`
   - Frontend: `https://morse-frontend.onrender.com/`

4. **Monitor Logs**
   - Watch for "✅ All required environment variables are set"
   - Watch for "Database connection established"
   - Watch for any errors during first upload

---

**Estimated Time to Implement All Fixes:** 2-3 hours
**Priority:** Complete Critical and High Priority fixes before deploying
