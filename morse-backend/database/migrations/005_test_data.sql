-- Test data population script
-- This can be easily disabled by setting POPULATE_TEST_DATA=false

-- Create test users with specific device UUIDs for testing
-- These will only be inserted if POPULATE_TEST_DATA is not explicitly set to false

DO $$
BEGIN
    -- Check if we should populate test data (default: true, unless explicitly disabled)
    IF current_setting('app.populate_test_data', true) != 'false' THEN
        
        -- Insert test users with predictable UUIDs for device search testing
        INSERT INTO users (device_uuid, created_at) VALUES 
        ('f47ac10b-58cc-4372-a567-0e02b2c4c4p9', NOW() - INTERVAL '7 days'),   -- Main test UUID ending in c4p9
        ('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', NOW() - INTERVAL '5 days'),   -- Searchable by 4c5d
        ('9876543f-210a-4bcd-ef12-3456789abc12', NOW() - INTERVAL '3 days'),   -- Searchable by c12
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
        FROM test_users tu;

        RAISE NOTICE 'Test data populated successfully. Use device search with last 4 characters: c4p9, 4c5d, bc12, 9012, cdef';
        
    ELSE
        RAISE NOTICE 'Test data population skipped (POPULATE_TEST_DATA=false)';
    END IF;
END $$;