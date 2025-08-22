-- Authentication Refactor Migration
-- This migration transforms the system from device-based to user-based authentication
-- with speaker verification and workout claiming functionality

-- Create new users table with passphrase authentication
CREATE TABLE app_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    passphrase_hash VARCHAR(255) NOT NULL, -- bcrypt hash of passphrase
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true
);

-- Voice profiles for speaker verification
CREATE TABLE voice_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    embedding_vector FLOAT8[] NOT NULL, -- 192-dim ECAPA-TDNN embeddings
    confidence_score DECIMAL(5,4) NOT NULL, -- confidence when profile was created
    created_from_workout_id UUID, -- reference to workout used for enrollment
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Device ownership tracking (users can claim devices)
CREATE TABLE user_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    device_uuid VARCHAR(255) NOT NULL,
    first_claimed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    device_name VARCHAR(255), -- user-friendly name for device
    is_active BOOLEAN DEFAULT true,
    UNIQUE(user_id, device_uuid)
);

-- Workout ownership/claiming system
CREATE TABLE workout_claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    claimed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    claim_method VARCHAR(50) NOT NULL, -- 'manual', 'voice_match', 'device_link'
    voice_match_confidence DECIMAL(5,4), -- if claimed via voice matching
    UNIQUE(workout_id) -- each workout can only be claimed once
);

-- Session ownership/claiming (extends workout claims to sessions)
CREATE TABLE session_claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
    claimed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    claim_method VARCHAR(50) NOT NULL, -- 'manual', 'voice_match', 'device_link'
    voice_match_confidence DECIMAL(5,4),
    UNIQUE(session_id) -- each session can only be claimed once
);

-- Speaker verification results for incoming audio
CREATE TABLE speaker_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    audio_file_id UUID NOT NULL REFERENCES audio_files(id) ON DELETE CASCADE,
    voice_profile_id UUID REFERENCES voice_profiles(id) ON DELETE SET NULL,
    similarity_score DECIMAL(5,4) NOT NULL, -- cosine similarity score
    confidence_level VARCHAR(20) NOT NULL, -- 'high', 'medium', 'low', 'no_match'
    auto_linked BOOLEAN DEFAULT false, -- whether this resulted in auto-linking
    verified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add status tracking for unclaimed workouts
ALTER TABLE workouts ADD COLUMN claim_status VARCHAR(50) DEFAULT 'unclaimed'; -- unclaimed, claimed, expired
ALTER TABLE workout_sessions ADD COLUMN claim_status VARCHAR(50) DEFAULT 'unclaimed';

-- Add voice embedding storage to audio files
ALTER TABLE audio_files ADD COLUMN voice_embedding FLOAT8[];
ALTER TABLE audio_files ADD COLUMN voice_extracted BOOLEAN DEFAULT false;
ALTER TABLE audio_files ADD COLUMN voice_quality_score DECIMAL(5,4); -- quality of voice sample

-- Update users table to track legacy device relationships
ALTER TABLE users ADD COLUMN migrated_to_app_user_id UUID REFERENCES app_users(id);
ALTER TABLE users ADD COLUMN migration_status VARCHAR(50) DEFAULT 'pending'; -- pending, migrated, orphaned

-- Indexes for performance
CREATE INDEX idx_app_users_passphrase ON app_users(passphrase_hash);
CREATE INDEX idx_voice_profiles_user_id ON voice_profiles(user_id);
CREATE INDEX idx_voice_profiles_active ON voice_profiles(is_active) WHERE is_active = true;
CREATE INDEX idx_user_devices_user_id ON user_devices(user_id);
CREATE INDEX idx_user_devices_device_uuid ON user_devices(device_uuid);
CREATE INDEX idx_user_devices_active ON user_devices(is_active) WHERE is_active = true;
CREATE INDEX idx_workout_claims_user_id ON workout_claims(user_id);
CREATE INDEX idx_workout_claims_workout_id ON workout_claims(workout_id);
CREATE INDEX idx_session_claims_user_id ON session_claims(user_id);
CREATE INDEX idx_session_claims_session_id ON session_claims(session_id);
CREATE INDEX idx_speaker_verifications_audio_file_id ON speaker_verifications(audio_file_id);
CREATE INDEX idx_speaker_verifications_voice_profile_id ON speaker_verifications(voice_profile_id);
CREATE INDEX idx_workouts_claim_status ON workouts(claim_status);
CREATE INDEX idx_workout_sessions_claim_status ON workout_sessions(claim_status);
CREATE INDEX idx_audio_files_voice_extracted ON audio_files(voice_extracted);

-- Partial index for device UUID last 4 digits search
CREATE INDEX idx_user_devices_device_uuid_suffix ON user_devices(RIGHT(device_uuid, 4));

-- GIN index for voice embedding similarity search (requires vector extension in future)
-- CREATE INDEX idx_voice_profiles_embedding ON voice_profiles USING GIN(embedding_vector);

-- Create function to search devices by last 4 UUID digits
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
        ud.device_uuid,
        ud.device_name,
        ud.last_seen,
        COALESCE(w_count.count, 0) as unclaimed_workouts_count,
        COALESCE(s_count.count, 0) as unclaimed_sessions_count
    FROM user_devices ud
    LEFT JOIN (
        SELECT 
            u.device_uuid,
            COUNT(*) as count
        FROM users u
        JOIN workouts w ON u.id = w.user_id
        WHERE w.claim_status = 'unclaimed'
        GROUP BY u.device_uuid
    ) w_count ON ud.device_uuid = w_count.device_uuid
    LEFT JOIN (
        SELECT 
            u.device_uuid,
            COUNT(*) as count
        FROM users u
        JOIN workout_sessions ws ON u.id = ws.user_id
        WHERE ws.claim_status = 'unclaimed'
        GROUP BY u.device_uuid
    ) s_count ON ud.device_uuid = s_count.device_uuid
    WHERE RIGHT(ud.device_uuid, 4) = last4_digits
        AND ud.is_active = true
    ORDER BY ud.last_seen DESC;
END;
$$ LANGUAGE plpgsql;

-- Create function to get unclaimed workouts for a device
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
        AND w.created_at > CURRENT_TIMESTAMP - INTERVAL '30 days' -- only show recent unclaimed
    ORDER BY w.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Create function to claim a workout
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
    
    -- If this is the first workout claimed from this device, link the device to user
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

-- Create function to auto-expire unclaimed workouts after 30 days
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

-- Create trigger to update user_devices last_seen when new audio files arrive
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

CREATE TRIGGER trigger_update_device_last_seen
    AFTER INSERT ON audio_files
    FOR EACH ROW
    EXECUTE FUNCTION update_device_last_seen();

-- Create view for user workout summaries
CREATE VIEW user_workout_summaries AS
SELECT 
    au.id as user_id,
    COUNT(DISTINCT wc.workout_id) as total_claimed_workouts,
    COUNT(DISTINCT ud.device_uuid) as linked_devices,
    COUNT(DISTINCT vp.id) as voice_profiles_count,
    MAX(wc.claimed_at) as last_workout_claimed,
    MAX(ud.last_seen) as last_device_activity
FROM app_users au
LEFT JOIN workout_claims wc ON au.id = wc.user_id
LEFT JOIN user_devices ud ON au.id = ud.user_id AND ud.is_active = true
LEFT JOIN voice_profiles vp ON au.id = vp.user_id AND vp.is_active = true
GROUP BY au.id;

-- Comments for documentation
COMMENT ON TABLE app_users IS 'Application users with passphrase authentication';
COMMENT ON TABLE voice_profiles IS 'Speaker verification profiles using ECAPA-TDNN embeddings';
COMMENT ON TABLE user_devices IS 'Devices linked to user accounts through workout claiming';
COMMENT ON TABLE workout_claims IS 'Tracks which workouts have been claimed by which users';
COMMENT ON TABLE speaker_verifications IS 'Results of speaker verification for incoming audio files';
COMMENT ON COLUMN voice_profiles.embedding_vector IS '192-dimensional ECAPA-TDNN voice embeddings';
COMMENT ON COLUMN workout_claims.claim_method IS 'How the workout was claimed: manual, voice_match, or device_link';
COMMENT ON FUNCTION search_devices_by_last4(VARCHAR) IS 'Search for devices by last 4 digits of UUID';
COMMENT ON FUNCTION get_unclaimed_workouts_for_device(VARCHAR) IS 'Get unclaimed workouts for a specific device';
COMMENT ON FUNCTION claim_workout(UUID, UUID, VARCHAR, DECIMAL) IS 'Claim a workout for a user';
COMMENT ON FUNCTION expire_old_unclaimed_workouts() IS 'Expire unclaimed workouts older than 30 days';