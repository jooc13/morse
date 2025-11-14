# Database Structure & Data Flow Walkthrough

## Overview
Yes, everything is stored in PostgreSQL! Here's how it all works:

---

## Database Schema

### Core Tables

#### 1. **`users`** - User accounts (device-based)
```sql
- id (UUID) - Primary key
- device_uuid (VARCHAR) - Unique device identifier
- created_at (TIMESTAMP)
- last_seen (TIMESTAMP)
- total_workouts (INTEGER)
```
**Purpose**: One row per device/user. Your device UUID (from filename) maps to a user ID.

---

#### 2. **`audio_files`** - Uploaded audio recordings
```sql
- id (UUID) - Primary key
- user_id (UUID) - Foreign key to users
- original_filename (VARCHAR) - e.g., "f47ac10b-58cc-4372-a567-0e02b2c4c4a9_1702345678.mp3"
- file_path (VARCHAR) - Where file is stored on disk
- file_size (BIGINT) - File size in bytes
- upload_timestamp (TIMESTAMP)
- processed (BOOLEAN) - Has it been fully processed?
- transcription_status (VARCHAR) - 'pending', 'processing', 'completed', 'failed'
```
**Purpose**: Tracks every audio file you upload, its status, and links it to your user.

---

#### 3. **`transcriptions`** - Speech-to-text results
```sql
- id (UUID) - Primary key
- audio_file_id (UUID) - Foreign key to audio_files
- raw_text (TEXT) - The transcribed text from Gemini
- confidence_score (DECIMAL)
- processing_time_ms (INTEGER)
- created_at (TIMESTAMP)
```
**Purpose**: Stores the text transcription of your audio recordings (from Google Gemini).

---

#### 4. **`workouts`** - Workout sessions
```sql
- id (UUID) - Primary key
- user_id (UUID) - Foreign key to users
- audio_file_id (UUID) - Foreign key to audio_files (first file for batch uploads)
- transcription_id (UUID) - Foreign key to transcriptions
- workout_date (DATE) - e.g., "2024-12-16"
- workout_start_time (TIME) - e.g., "14:30:00"
- workout_duration_minutes (INTEGER)
- total_exercises (INTEGER)
- notes (TEXT)
- created_at (TIMESTAMP)
```
**Purpose**: One workout = one complete training session. If you upload 5 files together, they become ONE workout.

---

#### 5. **`exercises`** - Individual exercises within a workout
```sql
- id (UUID) - Primary key
- workout_id (UUID) - Foreign key to workouts
- exercise_name (VARCHAR) - e.g., "Bench Press"
- exercise_type (VARCHAR) - 'strength', 'cardio', etc.
- muscle_groups (TEXT[]) - Array like ['chest', 'triceps', 'shoulders']
- sets (INTEGER) - Number of sets
- reps (INTEGER[]) - Array like [8, 8, 6, 6]
- weight_lbs (DECIMAL[]) - Array like [185, 185, 205, 205]
- effort_level (INTEGER) - RPE 1-10
- rest_seconds (INTEGER)
- notes (TEXT)
- order_in_workout (INTEGER) - Which exercise number in the workout
```
**Purpose**: Each row = one exercise. Arrays store multiple sets (one value per set).

---

## Data Flow: Upload → Display

### Step 1: **File Upload** (`POST /api/upload/batch`)

1. **Frontend** (`UploadTest.js`) sends files to backend
2. **Backend** (`routes/upload.js`):
   - Saves files to disk via `FileService.saveFile()`
   - Creates/gets user in `users` table based on device UUID
   - Inserts row into `audio_files` table:
     ```sql
     INSERT INTO audio_files (user_id, original_filename, file_path, ...)
     VALUES (...)
     ```

### Step 2: **Transcription** (Gemini API)

3. **Backend** calls `TranscriptionService.transcribeAudio()`
   - Sends audio to Google Gemini Pro API
   - Gets back text transcription
   - Saves to `transcriptions` table:
     ```sql
     INSERT INTO transcriptions (audio_file_id, raw_text, ...)
     VALUES (...)
     ```

### Step 3: **Workout Extraction** (Gemini LLM)

4. **Backend** calls `LLMService.extractWorkoutData()`
   - Sends transcription text to Gemini
   - Gemini returns JSON with exercises, sets, reps, weights, etc.
   - Creates workout in `workouts` table:
     ```sql
     INSERT INTO workouts (user_id, audio_file_id, transcription_id, workout_date, ...)
     VALUES (...)
     ```
   - For each exercise from LLM, inserts into `exercises` table:
     ```sql
     INSERT INTO exercises (workout_id, exercise_name, sets, reps, weight_lbs, ...)
     VALUES (...)
     ```
   - The `reps` and `weight_lbs` columns use PostgreSQL arrays, so:
     - `reps`: `[8, 8, 6, 6]` (4 sets)
     - `weight_lbs`: `[185, 185, 205, 205]` (4 sets)

### Step 4: **Batch Uploads** (Multiple Files = One Workout)

For batch uploads:
- Each file gets its own `audio_files` row
- Each file gets transcribed separately → multiple `transcriptions` rows
- All transcriptions are **combined** into one text
- One LLM call extracts all exercises from combined transcription
- One `workouts` row is created
- All exercises go into `exercises` table with the same `workout_id`

---

## Data Flow: Database → Frontend Display

### Step 5: **Fetching Workouts** (`GET /api/auth/workouts/claimed`)

1. **Frontend** (`HistoryPage.js`) calls `api.getClaimedWorkouts()`
2. **Backend** (`routes/auth.js`) runs this SQL:

```sql
SELECT 
  w.id,
  w.workout_date,
  w.workout_start_time,
  w.workout_duration_minutes,
  w.total_exercises,
  w.notes,
  -- ... workout fields ...
  COALESCE(
    json_agg(
      json_build_object(
        'id', e.id,
        'exercise_name', e.exercise_name,
        'exercise_type', e.exercise_type,
        'muscle_groups', e.muscle_groups,
        'sets', e.sets,
        'reps', e.reps,              -- This is an array [8, 8, 6, 6]
        'weight_lbs', e.weight_lbs,   -- This is an array [185, 185, 205, 205]
        'effort_level', e.effort_level,
        -- ... other exercise fields ...
      ) ORDER BY e.order_in_workout
    ) FILTER (WHERE e.id IS NOT NULL), 
    '[]'
  ) as exercises
FROM workouts w
JOIN audio_files af ON w.audio_file_id = af.id
JOIN users u ON w.user_id = u.id
LEFT JOIN exercises e ON w.id = e.workout_id
WHERE u.device_uuid = $1
GROUP BY w.id, ...
ORDER BY w.workout_date DESC
```

3. **PostgreSQL** returns one row per workout, with `exercises` as a JSON array

4. **Frontend** receives data like:
```json
{
  "workouts": [
    {
      "id": "abc-123",
      "workout_date": "2024-12-16",
      "exercises": [
        {
          "exercise_name": "Bench Press",
          "sets": 4,
          "reps": [8, 8, 6, 6],
          "weight_lbs": [185, 185, 205, 205],
          "effort_level": [7, 7, 8, 8]
        },
        {
          "exercise_name": "Bicep Curl",
          "sets": 2,
          "reps": [8, 8],
          "weight_lbs": [20, 20]
        }
      ]
    }
  ]
}
```

5. **Frontend** (`WorkoutCard.js`):
   - Groups exercises by name (e.g., if "Bicep Curl" appears twice, combines them)
   - Displays in the table with expandable sets
   - When you expand, shows all sets from the arrays

---

## Key Database Relationships

```
users (1) ──→ (many) audio_files
audio_files (1) ──→ (1) transcriptions
users (1) ──→ (many) workouts
workouts (1) ──→ (many) exercises
audio_files (1) ──→ (1) workouts (primary audio file)
```

---

## Array Columns in PostgreSQL

The `exercises` table uses PostgreSQL arrays for storing sets:

- **`reps INTEGER[]`** - Stores `[8, 8, 6, 6]` for 4 sets
- **`weight_lbs DECIMAL[]`** - Stores `[185, 185, 205, 205]` for 4 sets
- **`muscle_groups TEXT[]`** - Stores `['chest', 'triceps', 'shoulders']`

When fetched by the API, these arrays are automatically converted to JavaScript arrays.

---

## Example: Complete Data Flow

**You upload 3 audio files:**
1. File 1: "bench press 185x8, 185x8, 205x6"
2. File 2: "bicep curl 20x8, 20x8"
3. File 3: "bicep curl 20x8" (continued)

**Database entries:**

`audio_files` table:
- Row 1: `id=abc, user_id=xyz, original_filename="...file1.mp3"`
- Row 2: `id=def, user_id=xyz, original_filename="...file2.mp3"`
- Row 3: `id=ghi, user_id=xyz, original_filename="...file3.mp3"`

`transcriptions` table:
- Row 1: `audio_file_id=abc, raw_text="bench press 185x8..."`
- Row 2: `audio_file_id=def, raw_text="bicep curl 20x8..."`
- Row 3: `audio_file_id=ghi, raw_text="bicep curl 20x8..."`

`workouts` table:
- Row 1: `id=workout1, user_id=xyz, audio_file_id=abc, workout_date="2024-12-16"`

`exercises` table:
- Row 1: `workout_id=workout1, exercise_name="Bench Press", reps=[8,8,6], weight_lbs=[185,185,205]`
- Row 2: `workout_id=workout1, exercise_name="Bicep Curl", reps=[8,8], weight_lbs=[20,20]`
- Row 3: `workout_id=workout1, exercise_name="Bicep Curl", reps=[8], weight_lbs=[20]`

**Frontend groups Row 2 + Row 3** into one "Bicep Curl" entry with 3 total sets.

---

## Deletion Flow

When you click delete on a workout:

1. **Frontend** calls `api.deleteWorkout(workoutId)`
2. **Backend** (`DELETE /api/auth/workouts/:workoutId`):
   - Verifies you own the workout (by device UUID)
   - Runs: `DELETE FROM workouts WHERE id = $1`
   - PostgreSQL CASCADE deletes all related `exercises` rows automatically
   - (Audio files and transcriptions remain for now, but could be cleaned up)

---

## Connection Details

- **Database**: PostgreSQL (running in Kubernetes via Helm chart)
- **Connection**: Node.js backend uses `pg` (node-postgres) library
- **Connection String**: `process.env.DATABASE_URL` or default `postgresql://localhost:5432/morse_db`
- **Pool**: Connection pooling for concurrent requests

---

This is all stored persistently in PostgreSQL. Every workout, every exercise, every set is in the database!

