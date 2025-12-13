-- ============================================================================
-- MORSE Workout Tracker - Database Functions and Triggers
-- ============================================================================
-- This script creates all stored procedures, functions, triggers, and views
-- required for the MORSE application functionality.
--
-- Run this AFTER init_production_schema.sql
-- ============================================================================

BEGIN;

-- ============================================================================
-- SESSION MANAGEMENT FUNCTIONS
-- ============================================================================

-- Update session timestamp trigger
CREATE OR REPLACE FUNCTION update_session_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_session_updated_at ON workout_sessions;
CREATE TRIGGER trigger_update_session_updated_at
    BEFORE UPDATE ON workout_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_session_updated_at();

-- Detect potential session candidates
CREATE OR REPLACE FUNCTION detect_session_candidates(
    p_user_id UUID,
    p_audio_file_id UUID,
    p_upload_timestamp TIMESTAMP WITH TIME ZONE,
    p_timeout_minutes INTEGER DEFAULT 60
)
RETURNS TABLE(
    candidate_session_id UUID,
    time_gap_minutes DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ws.id as candidate_session_id,
        EXTRACT(EPOCH FROM (p_upload_timestamp - ws.session_end_time)) / 60.0 as time_gap_minutes
    FROM workout_sessions ws
    WHERE ws.user_id = p_user_id
        AND ws.session_status IN ('pending', 'processing')
        AND DATE(ws.session_date) = DATE(p_upload_timestamp)
        AND EXTRACT(EPOCH FROM (p_upload_timestamp - ws.session_end_time)) / 60.0 <= p_timeout_minutes
    ORDER BY ws.session_end_time DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Add audio file to session
CREATE OR REPLACE FUNCTION add_audio_to_session(
    p_session_id UUID,
    p_audio_file_id UUID,
    p_upload_timestamp TIMESTAMP WITH TIME ZONE
)
RETURNS VOID AS $$
DECLARE
    v_recording_order INTEGER;
    v_time_offset DECIMAL(8,2);
    v_session_start TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Get current recording order
    SELECT COALESCE(MAX(recording_order), 0) + 1
    INTO v_recording_order
    FROM session_audio_files
    WHERE session_id = p_session_id;

    -- Get session start time for offset calculation
    SELECT session_start_time INTO v_session_start
    FROM workout_sessions
    WHERE id = p_session_id;

    -- Calculate time offset from session start
    v_time_offset := EXTRACT(EPOCH FROM (p_upload_timestamp - v_session_start)) / 60.0;

    -- Insert audio file into session
    INSERT INTO session_audio_files (session_id, audio_file_id, recording_order, time_offset_minutes)
    VALUES (p_session_id, p_audio_file_id, v_recording_order, v_time_offset)
    ON CONFLICT DO NOTHING;

    -- Update session metadata
    UPDATE workout_sessions
    SET
        total_recordings = total_recordings + 1,
        session_end_time = GREATEST(session_end_time, p_upload_timestamp),
        session_duration_minutes = EXTRACT(EPOCH FROM (GREATEST(session_end_time, p_upload_timestamp) - session_start_time)) / 60.0,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_session_id;
END;
$$ LANGUAGE plpgsql;

-- Create new session
CREATE OR REPLACE FUNCTION create_new_session(
    p_user_id UUID,
    p_audio_file_id UUID,
    p_upload_timestamp TIMESTAMP WITH TIME ZONE
)
RETURNS UUID AS $$
DECLARE
    v_session_id UUID;
BEGIN
    -- Create new session
    INSERT INTO workout_sessions (
        user_id,
        session_date,
        session_start_time,
        session_end_time,
        session_duration_minutes,
        total_recordings
    )
    VALUES (
        p_user_id,
        DATE(p_upload_timestamp),
        p_upload_timestamp,
        p_upload_timestamp,
        0,
        1
    )
    RETURNING id INTO v_session_id;

    -- Add audio file to session
    INSERT INTO session_audio_files (session_id, audio_file_id, recording_order, time_offset_minutes)
    VALUES (v_session_id, p_audio_file_id, 1, 0);

    RETURN v_session_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- DEVICE MANAGEMENT FUNCTIONS
-- ============================================================================

-- Update device last_seen when audio files arrive
CREATE OR REPLACE FUNCTION update_device_last_seen()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE user_devices
    SET last_seen = NEW.upload_timestamp
    WHERE device_uuid = (
        SELECT device_uuid FROM users WHERE id = NEW.user_id
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_device_last_seen ON audio_files;
CREATE TRIGGER trigger_update_device_last_seen
    AFTER INSERT ON audio_files
    FOR EACH ROW
    EXECUTE FUNCTION update_device_last_seen();

-- Link user to device
CREATE OR REPLACE FUNCTION link_user_to_device(
    p_user_id UUID,
    p_device_uuid VARCHAR(255),
    p_device_name VARCHAR(255) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    link_id UUID;
    device_exists BOOLEAN;
BEGIN
    -- Check if device exists in the legacy users table
    SELECT EXISTS(SELECT 1 FROM users WHERE device_uuid = p_device_uuid) INTO device_exists;

    IF NOT device_exists THEN
        RAISE EXCEPTION 'Device UUID % not found. Device must have uploaded audio files first.', p_device_uuid;
    END IF;

    -- Insert or update the device link
    INSERT INTO device_links (user_id, device_uuid, device_name)
    VALUES (p_user_id, p_device_uuid, COALESCE(p_device_name, 'Device ' || RIGHT(p_device_uuid, 4)))
    ON CONFLICT (user_id, device_uuid)
    DO UPDATE SET
        device_name = COALESCE(p_device_name, device_links.device_name),
        last_activity = CURRENT_TIMESTAMP,
        is_active = true
    RETURNING id INTO link_id;

    RETURN link_id;
END;
$$ LANGUAGE plpgsql;

-- Get linked devices for a user
CREATE OR REPLACE FUNCTION get_user_linked_devices(p_user_id UUID)
RETURNS TABLE(
    device_uuid VARCHAR(255),
    device_name VARCHAR(255),
    linked_at TIMESTAMP WITH TIME ZONE,
    last_activity TIMESTAMP WITH TIME ZONE,
    recent_workouts_count BIGINT,
    pending_workouts_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        dl.device_uuid,
        dl.device_name,
        dl.linked_at,
        dl.last_activity,
        COALESCE(recent.count, 0) as recent_workouts_count,
        COALESCE(pending.count, 0) as pending_workouts_count
    FROM device_links dl
    LEFT JOIN (
        SELECT
            u.device_uuid,
            COUNT(*) as count
        FROM workout_claims wc
        JOIN workouts w ON wc.workout_id = w.id
        JOIN users u ON w.user_id = u.id
        WHERE wc.user_id = p_user_id
            AND wc.claimed_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
        GROUP BY u.device_uuid
    ) recent ON dl.device_uuid = recent.device_uuid
    LEFT JOIN (
        SELECT
            u.device_uuid,
            COUNT(*) as count
        FROM workouts w
        JOIN users u ON w.user_id = u.id
        WHERE w.claim_status = 'unclaimed'
            AND w.created_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
        GROUP BY u.device_uuid
    ) pending ON dl.device_uuid = pending.device_uuid
    WHERE dl.user_id = p_user_id
        AND dl.is_active = true
    ORDER BY dl.last_activity DESC;
END;
$$ LANGUAGE plpgsql;

-- Search devices by last 4 UUID digits
CREATE OR REPLACE FUNCTION search_devices_by_last4(last4_digits VARCHAR(4))
RETURNS TABLE(
    device_uuid VARCHAR(255),
    device_name VARCHAR(255),
    last_seen TIMESTAMP WITH TIME ZONE,
    unclaimed_workouts_count BIGINT,
    unclaimed_sessions_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT
        u.device_uuid,
        CAST('Device ' || RIGHT(u.device_uuid, 4) AS VARCHAR(255)) as device_name,
        u.last_seen,
        COALESCE(w_count.count, 0) as unclaimed_workouts_count,
        COALESCE(s_count.count, 0) as unclaimed_sessions_count
    FROM users u
    LEFT JOIN (
        SELECT
            u.device_uuid,
            COUNT(*) as count
        FROM users u
        JOIN workouts w ON u.id = w.user_id
        WHERE w.claim_status = 'unclaimed'
        GROUP BY u.device_uuid
    ) w_count ON u.device_uuid = w_count.device_uuid
    LEFT JOIN (
        SELECT
            u.device_uuid,
            COUNT(*) as count
        FROM users u
        JOIN workout_sessions ws ON u.id = ws.user_id
        WHERE ws.claim_status = 'unclaimed'
        GROUP BY u.device_uuid
    ) s_count ON u.device_uuid = s_count.device_uuid
    WHERE RIGHT(u.device_uuid, 4) = last4_digits
    ORDER BY u.last_seen DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- WORKOUT CLAIMING FUNCTIONS
-- ============================================================================

-- Get unclaimed workouts for a device
CREATE OR REPLACE FUNCTION get_unclaimed_workouts_for_device(target_device_uuid VARCHAR(255))
RETURNS TABLE(
    workout_id UUID,
    workout_date DATE,
    total_exercises INTEGER,
    duration_minutes INTEGER,
    audio_filename VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        w.id as workout_id,
        w.workout_date,
        w.total_exercises,
        w.workout_duration_minutes as duration_minutes,
        af.original_filename as audio_filename,
        w.created_at
    FROM workouts w
    JOIN users u ON w.user_id = u.id
    JOIN audio_files af ON w.audio_file_id = af.id
    WHERE u.device_uuid = target_device_uuid
        AND w.claim_status = 'unclaimed'
        AND w.created_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
    ORDER BY w.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Claim a workout
CREATE OR REPLACE FUNCTION claim_workout(
    p_user_id UUID,
    p_workout_id UUID,
    p_claim_method VARCHAR(50) DEFAULT 'manual',
    p_voice_confidence DECIMAL(5,4) DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_workout_exists BOOLEAN;
    v_already_claimed BOOLEAN;
BEGIN
    -- Check if workout exists and is unclaimed
    SELECT
        (w.id IS NOT NULL) as exists,
        (w.claim_status != 'unclaimed') as claimed
    INTO v_workout_exists, v_already_claimed
    FROM workouts w
    WHERE w.id = p_workout_id;

    IF NOT v_workout_exists THEN
        RAISE EXCEPTION 'Workout not found';
    END IF;

    IF v_already_claimed THEN
        RAISE EXCEPTION 'Workout already claimed';
    END IF;

    -- Claim the workout
    INSERT INTO workout_claims (user_id, workout_id, claim_method, voice_match_confidence)
    VALUES (p_user_id, p_workout_id, p_claim_method, p_voice_confidence);

    -- Update workout status
    UPDATE workouts SET claim_status = 'claimed' WHERE id = p_workout_id;

    -- Link device to user if first claim from this device
    INSERT INTO user_devices (user_id, device_uuid, device_name)
    SELECT DISTINCT p_user_id, u.device_uuid, 'Claimed Device'
    FROM workouts w
    JOIN users u ON w.user_id = u.id
    WHERE w.id = p_workout_id
    ON CONFLICT (user_id, device_uuid) DO UPDATE SET
        last_seen = CURRENT_TIMESTAMP,
        is_active = true;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Auto-expire old unclaimed workouts
CREATE OR REPLACE FUNCTION expire_old_unclaimed_workouts()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE workouts
    SET claim_status = 'expired'
    WHERE claim_status = 'unclaimed'
        AND created_at < CURRENT_TIMESTAMP - INTERVAL '30 days';

    GET DIAGNOSTICS expired_count = ROW_COUNT;

    UPDATE workout_sessions
    SET claim_status = 'expired'
    WHERE claim_status = 'unclaimed'
        AND created_at < CURRENT_TIMESTAMP - INTERVAL '30 days';

    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SPEAKER VERIFICATION FUNCTIONS
-- ============================================================================

-- Auto-assign workout based on voice match
CREATE OR REPLACE FUNCTION auto_assign_workout_to_user(
    p_audio_file_id UUID,
    p_similarity_score DECIMAL(5,4),
    p_matched_profile_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
    v_workout_id UUID;
    v_device_uuid VARCHAR(255);
    v_device_linked BOOLEAN;
    v_confidence_level VARCHAR(20);
BEGIN
    -- Get the user ID from the matched voice profile
    SELECT user_id INTO v_user_id
    FROM voice_profiles
    WHERE id = p_matched_profile_id AND is_active = true;

    IF v_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Get the device UUID and workout ID for this audio file
    SELECT
        u.device_uuid,
        w.id as workout_id
    INTO v_device_uuid, v_workout_id
    FROM audio_files af
    JOIN users u ON af.user_id = u.id
    JOIN workouts w ON af.id = w.audio_file_id
    WHERE af.id = p_audio_file_id;

    -- Check if this user is linked to this device
    SELECT EXISTS(
        SELECT 1 FROM device_links
        WHERE user_id = v_user_id
        AND device_uuid = v_device_uuid
        AND is_active = true
    ) INTO v_device_linked;

    IF NOT v_device_linked THEN
        RETURN FALSE;
    END IF;

    -- Determine confidence level
    IF p_similarity_score >= 0.85 THEN
        v_confidence_level = 'high';
    ELSIF p_similarity_score >= 0.70 THEN
        v_confidence_level = 'medium';
    ELSE
        v_confidence_level = 'low';
    END IF;

    -- Only auto-assign if confidence is high or medium
    IF v_confidence_level IN ('high', 'medium') THEN
        INSERT INTO workout_claims (user_id, workout_id, claim_method, voice_match_confidence)
        VALUES (v_user_id, v_workout_id, 'voice_match', p_similarity_score)
        ON CONFLICT (workout_id) DO NOTHING;

        UPDATE workouts
        SET claim_status = 'claimed'
        WHERE id = v_workout_id AND claim_status = 'unclaimed';

        INSERT INTO speaker_verifications (
            audio_file_id, voice_profile_id, similarity_score,
            confidence_level, auto_linked
        ) VALUES (
            p_audio_file_id, p_matched_profile_id, p_similarity_score,
            v_confidence_level, true
        );

        RETURN TRUE;
    END IF;

    -- Record verification but don't auto-assign
    INSERT INTO speaker_verifications (
        audio_file_id, voice_profile_id, similarity_score,
        confidence_level, auto_linked
    ) VALUES (
        p_audio_file_id, p_matched_profile_id, p_similarity_score,
        v_confidence_level, false
    );

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TEAMS FUNCTIONS
-- ============================================================================

-- Generate random invite codes
CREATE OR REPLACE FUNCTION generate_invite_code() RETURNS VARCHAR(32) AS $$
DECLARE
    code VARCHAR(32);
    exists_check INTEGER;
BEGIN
    LOOP
        code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
        SELECT COUNT(*) INTO exists_check FROM teams WHERE invite_code = code;
        IF exists_check = 0 THEN
            RETURN code;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Auto-generate invite codes for new teams
CREATE OR REPLACE FUNCTION set_invite_code() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.invite_code IS NULL OR NEW.invite_code = '' THEN
        NEW.invite_code := generate_invite_code();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS teams_invite_code_trigger ON teams;
CREATE TRIGGER teams_invite_code_trigger
    BEFORE INSERT ON teams
    FOR EACH ROW EXECUTE FUNCTION set_invite_code();

-- Update teams timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS teams_updated_at_trigger ON teams;
CREATE TRIGGER teams_updated_at_trigger
    BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Session summaries view
CREATE OR REPLACE VIEW session_summaries AS
SELECT
    ws.id,
    ws.user_id,
    ws.session_date,
    ws.session_start_time,
    ws.session_end_time,
    ws.session_duration_minutes,
    ws.total_recordings,
    ws.total_exercises,
    ws.session_status,
    ws.notes,
    COALESCE(
        json_agg(
            json_build_object(
                'audio_file_id', saf.audio_file_id,
                'original_filename', af.original_filename,
                'recording_order', saf.recording_order,
                'time_offset_minutes', saf.time_offset_minutes,
                'transcription_status', af.transcription_status
            ) ORDER BY saf.recording_order
        ) FILTER (WHERE saf.audio_file_id IS NOT NULL),
        '[]'::json
    ) as audio_files
FROM workout_sessions ws
LEFT JOIN session_audio_files saf ON ws.id = saf.session_id
LEFT JOIN audio_files af ON saf.audio_file_id = af.id
GROUP BY ws.id, ws.user_id, ws.session_date, ws.session_start_time,
         ws.session_end_time, ws.session_duration_minutes, ws.total_recordings,
         ws.total_exercises, ws.session_status, ws.notes;

-- User workout summaries view
CREATE OR REPLACE VIEW user_workout_summaries AS
SELECT
    au.id as user_id,
    COUNT(DISTINCT wc.workout_id) as total_claimed_workouts,
    COUNT(DISTINCT dl.device_uuid) as linked_devices,
    COUNT(DISTINCT vp.id) as voice_profiles_count,
    MAX(wc.claimed_at) as last_workout_claimed,
    MAX(dl.last_activity) as last_device_activity,
    COUNT(DISTINCT CASE WHEN wc.claimed_at > CURRENT_TIMESTAMP - INTERVAL '7 days' THEN wc.workout_id END) as workouts_this_week,
    COUNT(DISTINCT CASE WHEN wc.claim_method = 'voice_match' THEN wc.workout_id END) as auto_matched_workouts
FROM app_users au
LEFT JOIN workout_claims wc ON au.id = wc.user_id
LEFT JOIN device_links dl ON au.id = dl.user_id AND dl.is_active = true
LEFT JOIN voice_profiles vp ON au.id = vp.user_id AND vp.is_active = true
GROUP BY au.id;

-- ============================================================================
-- TABLE COMMENTS (for documentation)
-- ============================================================================

COMMENT ON TABLE app_users IS 'Application users with passphrase authentication';
COMMENT ON TABLE voice_profiles IS 'Speaker verification profiles using ECAPA-TDNN embeddings';
COMMENT ON TABLE user_devices IS 'Devices linked to user accounts through workout claiming';
COMMENT ON TABLE device_links IS 'Links users to devices for automatic workout routing';
COMMENT ON TABLE workout_claims IS 'Tracks which workouts have been claimed by which users';
COMMENT ON TABLE speaker_verifications IS 'Results of speaker verification for incoming audio files';
COMMENT ON COLUMN voice_profiles.embedding_vector IS '192-dimensional ECAPA-TDNN voice embeddings';
COMMENT ON COLUMN workout_claims.claim_method IS 'How the workout was claimed: manual, voice_match, or device_link';

COMMIT;
