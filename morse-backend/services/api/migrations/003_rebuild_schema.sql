-- Complete database schema rebuild to match the create-tables.sql file
-- This migration will add missing columns, tables, and fix data types

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Fix users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Create user_profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    full_name VARCHAR(255),
    bio TEXT,
    age_range VARCHAR(50),
    fitness_level VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Fix sessions table
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS exercise_count INTEGER DEFAULT 0;

-- Fix audio_files table
ALTER TABLE audio_files
ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS device_uuid VARCHAR(255) NOT NULL DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS file_path VARCHAR(1000) NOT NULL,
ADD COLUMN IF NOT EXISTS file_size BIGINT,
ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS embedding_vector VECTOR(1536),
ADD COLUMN IF NOT EXISTS embedding_quality_score DECIMAL(3,2);

-- Fix transcriptions table
ALTER TABLE transcriptions
ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en',
ADD COLUMN IF NOT EXISTS provider VARCHAR(50) DEFAULT 'whisper',
ADD COLUMN IF NOT EXISTS model_version VARCHAR(100);

-- Fix workouts table to match exactly
-- First, let's ensure all required columns exist
ALTER TABLE workouts
ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS device_uuid VARCHAR(255) NOT NULL DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS title VARCHAR(500),
ADD COLUMN IF NOT EXISTS estimated_calories INTEGER,
ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS auto_linked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS speaker_verification_id UUID;

-- Update any NULL device_uuid values
UPDATE workouts
SET device_uuid = u.device_uuid
FROM users u
WHERE workouts.user_id = u.id AND workouts.device_uuid = 'unknown';

-- Drop foreign key constraints if they exist to recreate them properly
ALTER TABLE workouts DROP CONSTRAINT IF EXISTS workouts_transcription_id_fkey;

-- Add the foreign key constraint correctly
ALTER TABLE workouts
ADD CONSTRAINT workouts_transcription_id_fkey
FOREIGN KEY (transcription_id) REFERENCES transcriptions(id);

-- Fix exercises table to match the schema
ALTER TABLE exercises
ADD COLUMN IF NOT EXISTS category VARCHAR(100),
ADD COLUMN IF NOT EXISTS duration_seconds INTEGER,
ADD COLUMN IF NOT EXISTS distance DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false;

-- Convert exercise columns to match the expected types
UPDATE exercises
SET name = COALESCE(exercise_name, name),
    category = COALESCE(exercise_type, category);

-- Create voice_profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS voice_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    device_uuid VARCHAR(255) UNIQUE NOT NULL,
    embedding_vectors VECTOR(1536)[],
    voice_fingerprint VARCHAR(1000),
    is_active BOOLEAN DEFAULT true,
    sample_count INTEGER DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create speaker_verifications table if it doesn't exist
CREATE TABLE IF NOT EXISTS speaker_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audio_file_id UUID REFERENCES audio_files(id) ON DELETE CASCADE,
    voice_profile_id UUID REFERENCES voice_profiles(id) ON DELETE SET NULL,
    similarity_score DECIMAL(5,4),
    confidence_level VARCHAR(50),
    match_found BOOLEAN DEFAULT false,
    embedding_vector VECTOR(1536),
    quality_score DECIMAL(3,2),
    verification_method VARCHAR(50) DEFAULT 'cosine_similarity',
    threshold DECIMAL(3,2) DEFAULT 0.85,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_audio_files_session_id ON audio_files(session_id);
CREATE INDEX IF NOT EXISTS idx_workouts_device_uuid ON workouts(device_uuid);
CREATE INDEX IF NOT EXISTS idx_workouts_date_completed ON workouts(date_completed);
CREATE INDEX IF NOT EXISTS idx_voice_profiles_device_uuid ON voice_profiles(device_uuid);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sessions_updated_at ON sessions;
CREATE TRIGGER update_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_audio_files_updated_at ON audio_files;
CREATE TRIGGER update_audio_files_updated_at
    BEFORE UPDATE ON audio_files
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_workouts_updated_at ON workouts;
CREATE TRIGGER update_workouts_updated_at
    BEFORE UPDATE ON workouts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_exercises_updated_at ON exercises;
CREATE TRIGGER update_exercises_updated_at
    BEFORE UPDATE ON exercises
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();