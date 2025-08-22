#!/bin/bash

# Run test data migration script
# This script applies the test data migration if POPULATE_TEST_DATA is enabled

DB_HOST="${DATABASE_HOST:-morse-postgresql}"
DB_PORT="${DATABASE_PORT:-5432}"
DB_NAME="${DATABASE_NAME:-morse_db}"
DB_USER="${DATABASE_USER:-morse_user}"
DB_PASSWORD="${DATABASE_PASSWORD:-morse_pass}"
POPULATE_TEST_DATA="${POPULATE_TEST_DATA:-true}"

echo "Checking if test data should be populated..."
echo "POPULATE_TEST_DATA: $POPULATE_TEST_DATA"

if [ "$POPULATE_TEST_DATA" = "true" ]; then
    echo "Populating test data..."
    
    # Run the test data SQL with the configuration setting
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << EOF
SET app.populate_test_data = 'true';

-- Test data population script
-- Create test users with specific device UUIDs for testing

DO \$\$
BEGIN
    -- Check if we should populate test data (default: true, unless explicitly disabled)
    IF current_setting('app.populate_test_data', true) != 'false' THEN
        
        -- Insert test users with predictable UUIDs for device search testing
        INSERT INTO users (device_uuid, created_at) VALUES 
        ('f47ac10b-58cc-4372-a567-0e02b2c4c4p9', NOW() - INTERVAL '7 days'),   -- Main test UUID ending in c4p9
        ('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', NOW() - INTERVAL '5 days'),   -- Searchable by 4c5d
        ('9876543f-210a-4bcd-ef12-3456789abc12', NOW() - INTERVAL '3 days'),   -- Searchable by bc12
        ('deadbeef-cafe-4bad-face-123456789012', NOW() - INTERVAL '2 days'),   -- Searchable by 9012
        ('12345678-90ab-4cde-f123-456789abcdef', NOW() - INTERVAL '1 day')     -- Searchable by cdef
        ON CONFLICT (device_uuid) DO NOTHING;

        -- Add some sample audio files for the test devices to make them searchable
        WITH test_users AS (
            SELECT id, device_uuid FROM users 
            WHERE device_uuid IN (
                'f47ac10b-58cc-4372-a567-0e02b2c4c4p9',
                'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
                '9876543f-210a-4bcd-ef12-3456789abc12'
            )
        )
        INSERT INTO audio_files (
            user_id, 
            original_filename, 
            file_path, 
            file_size, 
            upload_timestamp, 
            transcription_status,
            transcription_text
        )
        SELECT 
            tu.id,
            tu.device_uuid || '_' || extract(epoch from (NOW() - (random() * INTERVAL '24 hours')))::bigint || '.mp3',
            '/uploads/test_' || tu.device_uuid || '.mp3',
            1024000 + (random() * 5000000)::int,
            NOW() - (random() * INTERVAL '24 hours'),
            'completed',
            'Test transcription for device ' || tu.device_uuid || '. This is sample workout data for testing purposes.'
        FROM test_users tu
        ON CONFLICT DO NOTHING;

        -- Create some test workouts for these devices
        WITH test_audio_files AS (
            SELECT af.id as audio_file_id, af.user_id 
            FROM audio_files af
            JOIN users u ON af.user_id = u.id
            WHERE u.device_uuid IN (
                'f47ac10b-58cc-4372-a567-0e02b2c4c4p9',
                'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
                '9876543f-210a-4bcd-ef12-3456789abc12'
            )
        )
        INSERT INTO workouts (
            user_id,
            audio_file_id,
            workout_date,
            workout_start_time,
            workout_duration_minutes,
            total_exercises,
            notes,
            claim_status
        )
        SELECT 
            taf.user_id,
            taf.audio_file_id,
            CURRENT_DATE - (random() * 7)::int,
            '08:00:00'::time + (random() * INTERVAL '12 hours'),
            30 + (random() * 60)::int,
            3 + (random() * 5)::int,
            'Test workout generated for testing device search and claiming functionality',
            'unclaimed'
        FROM test_audio_files taf
        ON CONFLICT DO NOTHING;

        RAISE NOTICE 'Test data populated successfully. Use device search with last 4 characters: c4p9, 4c5d, bc12, 9012, cdef';
        
    ELSE
        RAISE NOTICE 'Test data population skipped (POPULATE_TEST_DATA=false)';
    END IF;
END \$\$;
EOF

    echo "Test data migration completed."
else
    echo "Test data population disabled (POPULATE_TEST_DATA=false)"
fi