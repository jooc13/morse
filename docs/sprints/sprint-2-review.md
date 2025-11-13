# Sprint 2 – Review

**Sprint:** 2  
**Dates:** 2025-10-30 → 2025-11-12  

## Sprint Goal

Deliver an integrated, functioning pipeline that accepts audio uploads, runs them through transcription and LLM parsing, persists structured workouts, and displays results on the staging dashboard.

**Result:** Goal **achieved**. A user can upload an audio file on staging and see structured workouts rendered in the UI, backed by PostgreSQL.

Staging URL (password-less for demo):  
`http://18.188.230.181:32746/login`

---

## Completed User Stories (Demo Notes)

1. **Upload endpoint and file validation – #3 & #4 (5 pts)** ✅  
   - Implemented `POST /api/upload` with multipart form support.  
   - Validates file type (MP3/M4A/WAV) and rejects files >10MB.  
   - Saves files with `{deviceUuid}_{timestamp}` naming convention and queues a processing job.  
   - Demo: Uploads from the dashboard show a progress bar and “Upload successful” toast, with job status visible in logs.

2. **PostgreSQL schema + storage layer – #7 (5 pts)** ✅  
   - Normalized schema: `users`, `devices`, `workouts`, `exercises`, `sets`.  
   - Migrations created and applied via the database/migrations folder.  
   - Insert path wired from worker: parsed JSON is transformed into relational rows.  
   - Demo: After upload + processing, workouts appear in the DB and are queryable via `/api/workouts/:deviceUuid`.

3. **LLM parsing and schema validation – #6 (5 pts)** ✅  
   - Worker now calls an LLM service (Claude/Gemini behind an abstraction) with a strict JSON schema prompt.  
   - JSON is validated; malformed output triggers a retry with a simplified fallback prompt.  
   - Demo: Example script (“3×10 push-ups, 4×8 pull-ups, 15 min run, 3×12 squats at 50 lbs”) produces the expected structured JSON.

4. **Basic dashboard visualization – minimal slice from #9 + #10 (3 pts)** ✅  
   - React frontend deployed to AWS shows:  
     - Upload section with file selector + progress bar  
     - Minimal workouts view grouped by date with exercises, sets, reps, and weights  
   - Styling: simple B&W theme with General Sans; focuses on readability, not flash.  
   - Demo: Uploading a test file, waiting for processing, then seeing a new workout card appear.

5. **Transcription service integration – #5 (8 pts)** ⚠️ _Partially completed_  
   - Implemented a transcription abstraction; currently using Google Gemini / Whisper via the Python worker.  
   - Handles MP3 and M4A formats; retries once on 4xx/5xx from the provider.  
   - Latency and occasional 400-level errors remain; we don’t yet meet the “<10s consistently” target or have full observability.  
   - For that reason, the story is **not** marked Done, and remaining work is moved into Sprint 3.

---

## Incomplete / Deferred Stories

1. **Transcription service integration – #5 (8 pts)**  
   - **Status:** In progress  
   - **Reason:** Model/provider thrash (Gemini vs Deepgram vs Whisper) and tuning the prompt/parameters ate more time than expected.  
   - **Disposition:**  
     - Remaining tasks split into two Sprint 3 issues:  
       - “Transcription reliability & latency hardening”  
       - “Add metrics and dashboards for transcription errors/latency”

2. **Queue-based job handling – #8 (5 pts, not originally committed but touched)**  
   - Basic Redis queue works, but we don’t yet expose queue stats or dead-letter behavior.  
   - The full story remains in the backlog and is explicitly slotted into Sprint 3.

---

## Sprint 2 Metrics

- **Planned story points:** 26  
- **Completed story points:** 23  
- **Velocity:** 23  
- **Completion rate:** 23 / 26 ≈ **88%**

This establishes a realistic working velocity around ~20–24 points for a two-dev sprint.

---

## Demo Screenshots (for reference in submission)

_You can drop these into the LMS or a Google Doc if needed; not stored here physically:_

1. **Staging login screen** at `http://18.188.230.181:32746/login`  
2. **Upload panel** showing file selection + progress bar  
3. **Workout timeline** with at least one parsed workout card  
4. **Database view** (e.g., `psql` or GUI) showing inserted workouts/exercises for the same device UUID

---

## Product Backlog Updates

New / updated issues created during the sprint:

- **Error handling & retry logic – #15**  
  - Centralized error handler in worker + exponential backoff retries.

- **Health check endpoint – #13**  
  - `/health` includes checks for DB connectivity, Redis reachability, and worker heartbeat.

- **Authentication setup – #14**  
  - Basic email-based login or token-based device auth for later sprints.

- **Edit error in type of exercise – #2**  
  - Fix inconsistent naming and type handling in LLM output mapping.

- **Device sync simulation – #17**  
  - Simulate BLE device uploads via the dashboard to mimic hardware behavior.

These are now in the backlog with Sprint 3 set for: health checks, error handling, and auth.
