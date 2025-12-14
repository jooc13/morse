-- Fix workouts table schema to match the application code

-- Add missing columns if they don't exist
ALTER TABLE workouts
ADD COLUMN IF NOT EXISTS date_completed DATE,
ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;

-- Migrate data from old columns if they exist
UPDATE workouts
SET date_completed = workout_date
WHERE date_completed IS NULL AND workout_date IS NOT NULL;

UPDATE workouts
SET duration_seconds = workout_duration_minutes * 60
WHERE duration_seconds IS NULL AND workout_duration_minutes IS NOT NULL;

-- Drop old columns if they exist (optional - comment out if you want to keep them)
-- ALTER TABLE workouts DROP COLUMN IF EXISTS workout_date;
-- ALTER TABLE workouts DROP COLUMN IF EXISTS workout_start_time;
-- ALTER TABLE workouts DROP COLUMN IF EXISTS workout_duration_minutes;

-- Add device_uuid to sessions table if it doesn't exist
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS device_uuid VARCHAR(255);

-- Update sessions that don't have device_uuid but have user_id
UPDATE sessions s
SET device_uuid = u.device_uuid
FROM users u
WHERE s.user_id = u.id AND s.device_uuid IS NULL;

-- Make device_uuid NOT NULL if all sessions have it
-- ALTER TABLE sessions ALTER COLUMN device_uuid SET NOT NULL;

-- Update audio_files table to match expected schema
ALTER TABLE audio_files
DROP COLUMN IF EXISTS upload_timestamp,
DROP COLUMN IF EXISTS processed,
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'uploaded';

-- Migrate data from old columns
UPDATE audio_files
SET status = CASE
    WHEN transcription_status = 'completed' THEN 'completed'
    WHEN transcription_status = 'processing' THEN 'processing'
    WHEN transcription_status = 'failed' THEN 'failed'
    ELSE 'uploaded'
END
WHERE status = 'uploaded' AND transcription_status IS NOT NULL;

-- Ensure exercises table has correct columns
ALTER TABLE exercises
RENAME COLUMN IF EXISTS exercise_name TO name,
RENAME COLUMN IF EXISTS exercise_type TO category;

-- Add comments for documentation
COMMENT ON COLUMN workouts.date_completed IS 'The date the workout was completed';
COMMENT ON COLUMN workouts.duration_seconds IS 'Duration of workout in seconds';
COMMENT ON COLUMN sessions.device_uuid IS 'Unique identifier for the user device';
COMMENT ON COLUMN audio_files.status IS 'Current status: uploaded, processing, completed, or failed';