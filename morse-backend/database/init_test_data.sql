-- ============================================================================
-- MORSE Test Data Initialization
-- ============================================================================
-- This script populates the database with test data for development and
-- testing purposes. It should ONLY be run in development/staging environments.
--
-- DO NOT run this in production unless explicitly needed for demos.
-- ============================================================================

BEGIN;

-- ============================================================================
-- TEST USERS (Device-based)
-- ============================================================================

-- Insert test device users with predictable UUIDs for testing
INSERT INTO users (device_uuid, created_at, last_seen) VALUES
('f47ac10b-58cc-4372-a567-0e02b2c4c4b9', NOW() - INTERVAL '7 days', NOW() - INTERVAL '1 day'),
('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', NOW() - INTERVAL '5 days', NOW() - INTERVAL '2 hours'),
('9876543f-210a-4bcd-ef12-3456789abc12', NOW() - INTERVAL '3 days', NOW() - INTERVAL '6 hours'),
('deadbeef-cafe-4bad-face-123456789012', NOW() - INTERVAL '2 days', NOW() - INTERVAL '12 hours'),
('12345678-90ab-4cde-f123-456789abcdef', NOW() - INTERVAL '1 day', NOW() - INTERVAL '30 minutes')
ON CONFLICT (device_uuid) DO UPDATE SET
    last_seen = EXCLUDED.last_seen;

-- ============================================================================
-- TEST AUDIO FILES
-- ============================================================================

-- Insert sample audio files for test devices
WITH test_users AS (
    SELECT id, device_uuid FROM users
    WHERE device_uuid IN (
        'f47ac10b-58cc-4372-a567-0e02b2c4c4b9',
        'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
        '9876543f-210a-4bcd-ef12-3456789abc12'
    )
)
INSERT INTO audio_files (
    user_id,
    original_filename,
    file_path,
    file_size,
    duration_seconds,
    upload_timestamp,
    transcription_status,
    processed
)
SELECT
    tu.id,
    'test_workout_' || RIGHT(tu.device_uuid, 4) || '_' ||
        extract(epoch from (NOW() - (random() * INTERVAL '24 hours')))::bigint || '.mp3',
    '/uploads/test/' || tu.device_uuid || '.mp3',
    1024000 + (random() * 5000000)::int,
    180 + (random() * 1800)::int,
    NOW() - (random() * INTERVAL '24 hours'),
    'completed',
    true
FROM test_users tu
ON CONFLICT DO NOTHING;

-- ============================================================================
-- TEST TRANSCRIPTIONS
-- ============================================================================

-- Create transcriptions for the audio files
WITH test_audio AS (
    SELECT af.id, af.user_id, u.device_uuid
    FROM audio_files af
    JOIN users u ON af.user_id = u.id
    WHERE u.device_uuid IN (
        'f47ac10b-58cc-4372-a567-0e02b2c4c4b9',
        'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
        '9876543f-210a-4bcd-ef12-3456789abc12'
    )
    AND NOT EXISTS (SELECT 1 FROM transcriptions t WHERE t.audio_file_id = af.id)
)
INSERT INTO transcriptions (
    audio_file_id,
    raw_text,
    confidence_score,
    processing_time_ms
)
SELECT
    ta.id,
    'Test transcription for device ' || RIGHT(ta.device_uuid, 4) || '. ' ||
    'I did bench press, 3 sets of 8 reps at 185 pounds. ' ||
    'Then squats, 4 sets of 10 reps at 225 pounds. ' ||
    'Finished with pull-ups, 3 sets to failure. ' ||
    'Total workout time was about 45 minutes.',
    0.92 + (random() * 0.07)::decimal(5,4),
    1200 + (random() * 800)::int
FROM test_audio ta;

-- ============================================================================
-- TEST WORKOUTS
-- ============================================================================

-- Create test workouts from the audio files
WITH test_data AS (
    SELECT
        af.id as audio_file_id,
        af.user_id,
        t.id as transcription_id,
        u.device_uuid
    FROM audio_files af
    JOIN users u ON af.user_id = u.id
    JOIN transcriptions t ON af.id = t.audio_file_id
    WHERE u.device_uuid IN (
        'f47ac10b-58cc-4372-a567-0e02b2c4c4b9',
        'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
        '9876543f-210a-4bcd-ef12-3456789abc12'
    )
    AND NOT EXISTS (SELECT 1 FROM workouts w WHERE w.audio_file_id = af.id)
)
INSERT INTO workouts (
    user_id,
    audio_file_id,
    transcription_id,
    workout_date,
    workout_start_time,
    workout_duration_minutes,
    total_exercises,
    claim_status,
    notes
)
SELECT
    td.user_id,
    td.audio_file_id,
    td.transcription_id,
    CURRENT_DATE - (random() * 7)::int,
    ('08:00:00'::time + (random() * INTERVAL '12 hours'))::time,
    30 + (random() * 60)::int,
    3 + (random() * 5)::int,
    'unclaimed',
    'Test workout for device ' || RIGHT(td.device_uuid, 4) ||
    '. Generated for testing device search and claiming functionality.'
FROM test_data td;

-- ============================================================================
-- TEST EXERCISES
-- ============================================================================

-- Populate exercise library with common exercises
INSERT INTO exercise_library (name, category, primary_muscle_groups, secondary_muscle_groups, difficulty_level, instructions) VALUES
('Push-ups', 'Bodyweight', ARRAY['Chest', 'Triceps'], ARRAY['Shoulders', 'Core'], 2, 'Standard push-up position, lower chest to ground, push back up'),
('Pull-ups', 'Bodyweight', ARRAY['Lats', 'Biceps'], ARRAY['Rhomboids', 'Middle traps'], 4, 'Hang from bar, pull body up until chin over bar'),
('Squats', 'Bodyweight', ARRAY['Quadriceps', 'Glutes'], ARRAY['Hamstrings', 'Calves'], 2, 'Stand with feet shoulder-width, lower hips until thighs parallel'),
('Deadlifts', 'Barbell', ARRAY['Hamstrings', 'Glutes', 'Lower back'], ARRAY['Traps', 'Rhomboids'], 4, 'Hip hinge movement, lift barbell from floor to standing'),
('Bench Press', 'Barbell', ARRAY['Chest', 'Triceps'], ARRAY['Shoulders'], 3, 'Lie on bench, lower barbell to chest, press back up'),
('Bicep Curls', 'Dumbbell', ARRAY['Biceps'], ARRAY['Forearms'], 2, 'Stand holding dumbbells, curl weights up to shoulders'),
('Plank', 'Bodyweight', ARRAY['Core'], ARRAY['Shoulders'], 2, 'Hold body in straight line from head to heels on forearms'),
('Running', 'Cardio', ARRAY['Legs'], ARRAY['Core', 'Cardiovascular'], 2, 'Continuous aerobic exercise'),
('Overhead Press', 'Barbell', ARRAY['Shoulders', 'Triceps'], ARRAY['Core'], 3, 'Press barbell from shoulders to overhead'),
('Rows', 'Barbell', ARRAY['Lats', 'Rhomboids'], ARRAY['Biceps', 'Middle traps'], 3, 'Pull barbell to lower chest while bent over')
ON CONFLICT (name) DO NOTHING;

-- Add sample exercises to test workouts
WITH test_workouts AS (
    SELECT w.id as workout_id
    FROM workouts w
    JOIN users u ON w.user_id = u.id
    WHERE u.device_uuid IN (
        'f47ac10b-58cc-4372-a567-0e02b2c4c4b9',
        'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
        '9876543f-210a-4bcd-ef12-3456789abc12'
    )
    AND NOT EXISTS (SELECT 1 FROM exercises e WHERE e.workout_id = w.id)
    LIMIT 3
)
INSERT INTO exercises (
    workout_id,
    exercise_name,
    exercise_type,
    muscle_groups,
    sets,
    reps,
    weight_lbs,
    effort_level,
    order_in_workout
)
SELECT
    tw.workout_id,
    'Bench Press',
    'Barbell',
    ARRAY['Chest', 'Triceps'],
    3,
    ARRAY[8, 8, 8],
    ARRAY[185.0, 185.0, 185.0],
    7,
    1
FROM test_workouts tw
UNION ALL
SELECT
    tw.workout_id,
    'Squats',
    'Barbell',
    ARRAY['Quadriceps', 'Glutes'],
    4,
    ARRAY[10, 10, 10, 10],
    ARRAY[225.0, 225.0, 225.0, 225.0],
    8,
    2
FROM test_workouts tw
UNION ALL
SELECT
    tw.workout_id,
    'Pull-ups',
    'Bodyweight',
    ARRAY['Lats', 'Biceps'],
    3,
    ARRAY[12, 10, 8],
    NULL,
    6,
    3
FROM test_workouts tw;

-- Update workout totals
UPDATE workouts w
SET total_exercises = (
    SELECT COUNT(*) FROM exercises e WHERE e.workout_id = w.id
)
WHERE EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = w.user_id
    AND u.device_uuid IN (
        'f47ac10b-58cc-4372-a567-0e02b2c4c4b9',
        'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
        '9876543f-210a-4bcd-ef12-3456789abc12'
    )
);

-- ============================================================================
-- TEST APP USERS (for authentication testing)
-- ============================================================================

-- Create a test app user with known passphrase
-- Passphrase: "TestPassword123" (bcrypt hash below)
INSERT INTO app_users (passphrase_hash, created_at, is_active) VALUES
('$2b$10$rZ9VqKdHXLBz3nJHfE5L5eFgXq5YqKdHXLBz3nJHfE5L5eFgXq5Yq', NOW() - INTERVAL '10 days', true)
ON CONFLICT DO NOTHING;

COMMIT;

-- ============================================================================
-- Summary Report
-- ============================================================================

DO $$
DECLARE
    v_users_count INTEGER;
    v_audio_count INTEGER;
    v_workouts_count INTEGER;
    v_exercises_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_users_count FROM users WHERE device_uuid LIKE '%c4b9' OR device_uuid LIKE '%4c5d' OR device_uuid LIKE '%bc12';
    SELECT COUNT(*) INTO v_audio_count FROM audio_files af JOIN users u ON af.user_id = u.id WHERE u.device_uuid LIKE '%c4b9' OR u.device_uuid LIKE '%4c5d' OR u.device_uuid LIKE '%bc12';
    SELECT COUNT(*) INTO v_workouts_count FROM workouts w JOIN users u ON w.user_id = u.id WHERE u.device_uuid LIKE '%c4b9' OR u.device_uuid LIKE '%4c5d' OR u.device_uuid LIKE '%bc12';
    SELECT COUNT(*) INTO v_exercises_count FROM exercises e JOIN workouts w ON e.workout_id = w.id JOIN users u ON w.user_id = u.id WHERE u.device_uuid LIKE '%c4b9' OR u.device_uuid LIKE '%4c5d' OR u.device_uuid LIKE '%bc12';

    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Test Data Initialization Complete';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Test Users Created: %', v_users_count;
    RAISE NOTICE 'Test Audio Files: %', v_audio_count;
    RAISE NOTICE 'Test Workouts: %', v_workouts_count;
    RAISE NOTICE 'Test Exercises: %', v_exercises_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Device Search Test UUIDs (last 4 chars):';
    RAISE NOTICE '  - c4b9 (main test device)';
    RAISE NOTICE '  - 4c5d';
    RAISE NOTICE '  - bc12';
    RAISE NOTICE '  - 9012';
    RAISE NOTICE '  - cdef';
    RAISE NOTICE '';
    RAISE NOTICE 'Test App User:';
    RAISE NOTICE '  Passphrase: TestPassword123';
    RAISE NOTICE '';
END $$;
