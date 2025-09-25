-- Device Linking System Migration
-- Simplifies the user-device relationship and enables seamless workout routing

-- Create a proper device linking table to replace the complex user_devices approach
CREATE TABLE IF NOT EXISTS device_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    device_uuid VARCHAR(255) NOT NULL,
    device_name VARCHAR(255),
    linked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    -- Allow multiple users per device, but track the relationship
    UNIQUE(user_id, device_uuid)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_device_links_user_id ON device_links(user_id);
CREATE INDEX IF NOT EXISTS idx_device_links_device_uuid ON device_links(device_uuid);
CREATE INDEX IF NOT EXISTS idx_device_links_active ON device_links(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_device_links_last4 ON device_links(RIGHT(device_uuid, 4));

-- Function to link a user to a device
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

-- Function to get linked devices for a user
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
        -- Count recent workouts from this device claimed by this user
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
        -- Count unclaimed workouts from this device
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

-- Function to auto-assign workouts based on voice matching for linked devices
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
    
    -- Only auto-assign if user is linked to the device
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
        -- Claim the workout automatically
        INSERT INTO workout_claims (user_id, workout_id, claim_method, voice_match_confidence)
        VALUES (v_user_id, v_workout_id, 'voice_match', p_similarity_score)
        ON CONFLICT (workout_id) DO NOTHING; -- Don't override existing claims
        
        -- Update workout status
        UPDATE workouts 
        SET claim_status = 'claimed' 
        WHERE id = v_workout_id AND claim_status = 'unclaimed';
        
        -- Record the speaker verification result
        INSERT INTO speaker_verifications (
            audio_file_id, 
            voice_profile_id, 
            similarity_score, 
            confidence_level, 
            auto_linked
        ) VALUES (
            p_audio_file_id, 
            p_matched_profile_id, 
            p_similarity_score, 
            v_confidence_level, 
            true
        );
        
        RETURN TRUE;
    END IF;
    
    -- Record the verification but don't auto-assign
    INSERT INTO speaker_verifications (
        audio_file_id, 
        voice_profile_id, 
        similarity_score, 
        confidence_level, 
        auto_linked
    ) VALUES (
        p_audio_file_id, 
        p_matched_profile_id, 
        p_similarity_score, 
        v_confidence_level, 
        false
    );
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Update the user workout summaries view to use device_links
DROP VIEW IF EXISTS user_workout_summaries;
CREATE VIEW user_workout_summaries AS
SELECT 
    au.id as user_id,
    COUNT(DISTINCT wc.workout_id) as total_claimed_workouts,
    COUNT(DISTINCT dl.device_uuid) as linked_devices,
    COUNT(DISTINCT vp.id) as voice_profiles_count,
    MAX(wc.claimed_at) as last_workout_claimed,
    MAX(dl.last_activity) as last_device_activity,
    -- Add stats for better dashboard display
    COUNT(DISTINCT CASE WHEN wc.claimed_at > CURRENT_TIMESTAMP - INTERVAL '7 days' THEN wc.workout_id END) as workouts_this_week,
    COUNT(DISTINCT CASE WHEN wc.claim_method = 'voice_match' THEN wc.workout_id END) as auto_matched_workouts
FROM app_users au
LEFT JOIN workout_claims wc ON au.id = wc.user_id
LEFT JOIN device_links dl ON au.id = dl.user_id AND dl.is_active = true
LEFT JOIN voice_profiles vp ON au.id = vp.user_id AND vp.is_active = true
GROUP BY au.id;

-- Comments
COMMENT ON TABLE device_links IS 'Links users to devices for automatic workout routing';
COMMENT ON FUNCTION link_user_to_device(UUID, VARCHAR, VARCHAR) IS 'Link a user to a device UUID';
COMMENT ON FUNCTION get_user_linked_devices(UUID) IS 'Get all devices linked to a user with stats';
COMMENT ON FUNCTION auto_assign_workout_to_user(UUID, DECIMAL, UUID) IS 'Automatically assign workout based on voice match for linked devices';