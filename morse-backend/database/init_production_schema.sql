-- ============================================================================
-- MORSE Workout Tracker - Consolidated Production Database Schema
-- ============================================================================
-- This script creates the complete database schema for Render PostgreSQL
-- deployment. It consolidates all migration files into a single,
-- idempotent, transactional initialization script.
--
-- Features:
-- - Idempotent: Safe to run multiple times (uses IF NOT EXISTS)
-- - Transactional: All or nothing execution
-- - Optimized indexes for PostgreSQL performance
-- - Proper foreign key relationships and constraints
-- - Production-ready with error handling
--
-- Version: 1.0.0 (Consolidates migrations 001-006)
-- ============================================================================

-- Start transaction for atomic execution
BEGIN;

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CORE TABLES - Users and Authentication
-- ============================================================================

-- Legacy device-based users table (for backward compatibility)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_uuid VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    total_workouts INTEGER DEFAULT 0,
    migrated_to_app_user_id UUID,
    migration_status VARCHAR(50) DEFAULT 'pending'
);

-- Modern passphrase-based users table
CREATE TABLE IF NOT EXISTS app_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    passphrase_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true
);

-- Add foreign key constraint if not exists (for migrated users)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_users_app_users'
        AND table_name = 'users'
    ) THEN
        ALTER TABLE users
        ADD CONSTRAINT fk_users_app_users
        FOREIGN KEY (migrated_to_app_user_id)
        REFERENCES app_users(id);
    END IF;
END $$;

-- ============================================================================
-- VOICE AUTHENTICATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS voice_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    embedding_vector FLOAT8[] NOT NULL,
    confidence_score DECIMAL(5,4) NOT NULL,
    created_from_workout_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS speaker_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    audio_file_id UUID NOT NULL,
    voice_profile_id UUID REFERENCES voice_profiles(id) ON DELETE SET NULL,
    similarity_score DECIMAL(5,4) NOT NULL,
    confidence_level VARCHAR(20) NOT NULL,
    auto_linked BOOLEAN DEFAULT false,
    verified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- DEVICE MANAGEMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    device_uuid VARCHAR(255) NOT NULL,
    first_claimed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    device_name VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    UNIQUE(user_id, device_uuid)
);

CREATE TABLE IF NOT EXISTS device_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    device_uuid VARCHAR(255) NOT NULL,
    device_name VARCHAR(255),
    linked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(user_id, device_uuid)
);

-- ============================================================================
-- AUDIO FILES AND TRANSCRIPTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS audio_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    original_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    duration_seconds DECIMAL(10,2),
    upload_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed BOOLEAN DEFAULT FALSE,
    transcription_status VARCHAR(50) DEFAULT 'pending',
    session_id UUID,
    voice_embedding FLOAT8[],
    voice_extracted BOOLEAN DEFAULT false,
    voice_quality_score DECIMAL(5,4)
);

CREATE TABLE IF NOT EXISTS transcriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    audio_file_id UUID NOT NULL REFERENCES audio_files(id) ON DELETE CASCADE,
    raw_text TEXT NOT NULL,
    confidence_score DECIMAL(5,4),
    processing_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- WORKOUT SESSIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS workout_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_date DATE NOT NULL,
    session_start_time TIMESTAMP WITH TIME ZONE,
    session_end_time TIMESTAMP WITH TIME ZONE,
    session_duration_minutes INTEGER,
    total_recordings INTEGER DEFAULT 0,
    total_exercises INTEGER DEFAULT 0,
    session_status VARCHAR(50) DEFAULT 'pending',
    claim_status VARCHAR(50) DEFAULT 'unclaimed',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS session_audio_files (
    session_id UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
    audio_file_id UUID NOT NULL REFERENCES audio_files(id) ON DELETE CASCADE,
    recording_order INTEGER NOT NULL,
    time_offset_minutes DECIMAL(8,2),
    PRIMARY KEY (session_id, audio_file_id)
);

CREATE TABLE IF NOT EXISTS session_detection_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_timeout_minutes INTEGER DEFAULT 60,
    min_session_recordings INTEGER DEFAULT 1,
    auto_complete_sessions BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add session_id foreign key to audio_files if column exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_audio_files_session'
        AND table_name = 'audio_files'
    ) THEN
        ALTER TABLE audio_files
        ADD CONSTRAINT fk_audio_files_session
        FOREIGN KEY (session_id)
        REFERENCES workout_sessions(id);
    END IF;
END $$;

-- Add speaker_verifications foreign key to audio_files
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_speaker_verifications_audio'
        AND table_name = 'speaker_verifications'
    ) THEN
        ALTER TABLE speaker_verifications
        ADD CONSTRAINT fk_speaker_verifications_audio
        FOREIGN KEY (audio_file_id)
        REFERENCES audio_files(id) ON DELETE CASCADE;
    END IF;
END $$;

-- ============================================================================
-- WORKOUTS AND EXERCISES
-- ============================================================================

CREATE TABLE IF NOT EXISTS workouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    audio_file_id UUID NOT NULL REFERENCES audio_files(id) ON DELETE CASCADE,
    transcription_id UUID REFERENCES transcriptions(id) ON DELETE SET NULL,
    session_id UUID REFERENCES workout_sessions(id) ON DELETE CASCADE,
    workout_date DATE NOT NULL,
    workout_start_time TIME,
    workout_duration_minutes INTEGER,
    total_exercises INTEGER DEFAULT 0,
    claim_status VARCHAR(50) DEFAULT 'unclaimed',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exercises (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    exercise_name VARCHAR(255) NOT NULL,
    exercise_type VARCHAR(100),
    muscle_groups TEXT[],
    sets INTEGER,
    reps INTEGER[],
    weight_lbs DECIMAL[],
    duration_minutes DECIMAL(8,2),
    distance_miles DECIMAL(8,2),
    effort_level INTEGER CHECK (effort_level >= 1 AND effort_level <= 10),
    rest_seconds INTEGER,
    notes TEXT,
    order_in_workout INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exercise_library (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    category VARCHAR(100),
    primary_muscle_groups TEXT[],
    secondary_muscle_groups TEXT[],
    equipment_needed TEXT[],
    instructions TEXT,
    difficulty_level INTEGER CHECK (difficulty_level >= 1 AND difficulty_level <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- PROGRESS TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exercise_name VARCHAR(255) NOT NULL,
    metric_type VARCHAR(50) NOT NULL,
    metric_value DECIMAL(10,2) NOT NULL,
    recorded_date DATE NOT NULL,
    workout_id UUID REFERENCES workouts(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- WORKOUT CLAIMING SYSTEM
-- ============================================================================

CREATE TABLE IF NOT EXISTS workout_claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    claimed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    claim_method VARCHAR(50) NOT NULL,
    voice_match_confidence DECIMAL(5,4),
    UNIQUE(workout_id)
);

CREATE TABLE IF NOT EXISTS session_claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
    claimed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    claim_method VARCHAR(50) NOT NULL,
    voice_match_confidence DECIMAL(5,4),
    UNIQUE(session_id)
);

-- ============================================================================
-- TEAMS FEATURE
-- ============================================================================

CREATE TABLE IF NOT EXISTS teams (
    team_id SERIAL PRIMARY KEY,
    team_name VARCHAR(255) NOT NULL,
    team_description TEXT,
    creator_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    invite_code VARCHAR(32) UNIQUE NOT NULL,
    allow_public_view BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS team_memberships (
    membership_id SERIAL PRIMARY KEY,
    team_id INTEGER NOT NULL REFERENCES teams(team_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    display_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team_id, user_id)
);

-- ============================================================================
-- INDEXES - Optimized for PostgreSQL Performance
-- ============================================================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_device_uuid ON users(device_uuid);
CREATE INDEX IF NOT EXISTS idx_users_migration_status ON users(migration_status);

-- App users indexes
CREATE INDEX IF NOT EXISTS idx_app_users_passphrase ON app_users(passphrase_hash);
CREATE INDEX IF NOT EXISTS idx_app_users_active ON app_users(is_active) WHERE is_active = true;

-- Voice profiles indexes
CREATE INDEX IF NOT EXISTS idx_voice_profiles_user_id ON voice_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_profiles_active ON voice_profiles(is_active) WHERE is_active = true;

-- Device indexes
CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_device_uuid ON user_devices(device_uuid);
CREATE INDEX IF NOT EXISTS idx_user_devices_active ON user_devices(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_devices_device_uuid_suffix ON user_devices(RIGHT(device_uuid, 4));
CREATE INDEX IF NOT EXISTS idx_device_links_user_id ON device_links(user_id);
CREATE INDEX IF NOT EXISTS idx_device_links_device_uuid ON device_links(device_uuid);
CREATE INDEX IF NOT EXISTS idx_device_links_active ON device_links(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_device_links_last4 ON device_links(RIGHT(device_uuid, 4));

-- Audio files indexes
CREATE INDEX IF NOT EXISTS idx_audio_files_user_id ON audio_files(user_id);
CREATE INDEX IF NOT EXISTS idx_audio_files_processed ON audio_files(processed);
CREATE INDEX IF NOT EXISTS idx_audio_files_upload_timestamp ON audio_files(upload_timestamp);
CREATE INDEX IF NOT EXISTS idx_audio_files_transcription_status ON audio_files(transcription_status);
CREATE INDEX IF NOT EXISTS idx_audio_files_session_id ON audio_files(session_id);
CREATE INDEX IF NOT EXISTS idx_audio_files_voice_extracted ON audio_files(voice_extracted);

-- Transcriptions indexes
CREATE INDEX IF NOT EXISTS idx_transcriptions_audio_file_id ON transcriptions(audio_file_id);

-- Workout sessions indexes
CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_id ON workout_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_date ON workout_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_status ON workout_sessions(session_status);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_claim_status ON workout_sessions(claim_status);
CREATE INDEX IF NOT EXISTS idx_session_audio_files_session_id ON session_audio_files(session_id);
CREATE INDEX IF NOT EXISTS idx_session_audio_files_audio_file_id ON session_audio_files(audio_file_id);

-- Workouts indexes
CREATE INDEX IF NOT EXISTS idx_workouts_user_id ON workouts(user_id);
CREATE INDEX IF NOT EXISTS idx_workouts_date ON workouts(workout_date);
CREATE INDEX IF NOT EXISTS idx_workouts_session_id ON workouts(session_id);
CREATE INDEX IF NOT EXISTS idx_workouts_claim_status ON workouts(claim_status);

-- Exercises indexes
CREATE INDEX IF NOT EXISTS idx_exercises_workout_id ON exercises(workout_id);
CREATE INDEX IF NOT EXISTS idx_exercises_name ON exercises(exercise_name);
CREATE INDEX IF NOT EXISTS idx_exercises_muscle_groups ON exercises USING GIN(muscle_groups);

-- User progress indexes
CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_exercise ON user_progress(exercise_name);
CREATE INDEX IF NOT EXISTS idx_user_progress_date ON user_progress(recorded_date);

-- Workout claims indexes
CREATE INDEX IF NOT EXISTS idx_workout_claims_user_id ON workout_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_claims_workout_id ON workout_claims(workout_id);
CREATE INDEX IF NOT EXISTS idx_session_claims_user_id ON session_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_session_claims_session_id ON session_claims(session_id);

-- Speaker verifications indexes
CREATE INDEX IF NOT EXISTS idx_speaker_verifications_audio_file_id ON speaker_verifications(audio_file_id);
CREATE INDEX IF NOT EXISTS idx_speaker_verifications_voice_profile_id ON speaker_verifications(voice_profile_id);

-- Teams indexes
CREATE INDEX IF NOT EXISTS idx_teams_invite_code ON teams(invite_code);
CREATE INDEX IF NOT EXISTS idx_teams_creator ON teams(creator_user_id);
CREATE INDEX IF NOT EXISTS idx_team_memberships_team_id ON team_memberships(team_id);
CREATE INDEX IF NOT EXISTS idx_team_memberships_user_id ON team_memberships(user_id);

-- Commit the transaction
COMMIT;
