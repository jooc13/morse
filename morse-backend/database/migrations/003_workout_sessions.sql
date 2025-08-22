-- Workout Session Grouping Migration
-- This migration enables intelligent grouping of multiple audio recordings into single workout sessions

-- First, create the new workout_sessions table
CREATE TABLE workout_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_date DATE NOT NULL,
    session_start_time TIMESTAMP WITH TIME ZONE,
    session_end_time TIMESTAMP WITH TIME ZONE,
    session_duration_minutes INTEGER,
    total_recordings INTEGER DEFAULT 0,
    total_exercises INTEGER DEFAULT 0,
    session_status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create junction table for audio files to session relationship
CREATE TABLE session_audio_files (
    session_id UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
    audio_file_id UUID NOT NULL REFERENCES audio_files(id) ON DELETE CASCADE,
    recording_order INTEGER NOT NULL,
    time_offset_minutes DECIMAL(8,2), -- minutes from session start
    PRIMARY KEY (session_id, audio_file_id)
);

-- Update workouts table to reference sessions instead of individual audio files
ALTER TABLE workouts ADD COLUMN session_id UUID REFERENCES workout_sessions(id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX idx_workout_sessions_user_id ON workout_sessions(user_id);
CREATE INDEX idx_workout_sessions_date ON workout_sessions(session_date);
CREATE INDEX idx_workout_sessions_status ON workout_sessions(session_status);
CREATE INDEX idx_session_audio_files_session_id ON session_audio_files(session_id);
CREATE INDEX idx_session_audio_files_audio_file_id ON session_audio_files(audio_file_id);
CREATE INDEX idx_workouts_session_id ON workouts(session_id);

-- Add trigger to update session updated_at timestamp
CREATE OR REPLACE FUNCTION update_session_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_session_updated_at
    BEFORE UPDATE ON workout_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_session_updated_at();

-- Add session detection configuration table
CREATE TABLE session_detection_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_timeout_minutes INTEGER DEFAULT 60, -- max gap between recordings in same session
    min_session_recordings INTEGER DEFAULT 1,
    auto_complete_sessions BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default configuration for existing users
INSERT INTO session_detection_config (user_id)
SELECT id FROM users;

-- Create function to detect potential session groupings
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

-- Create stored procedure to add audio file to session
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
    VALUES (p_session_id, p_audio_file_id, v_recording_order, v_time_offset);
    
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

-- Create function to create new session
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

-- Add session tracking to audio_files table
ALTER TABLE audio_files ADD COLUMN session_id UUID REFERENCES workout_sessions(id);
CREATE INDEX idx_audio_files_session_id ON audio_files(session_id);

-- Create view for session summaries
CREATE VIEW session_summaries AS
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