-- Workout and exercise data tables

-- Transcriptions table
CREATE TABLE transcriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    audio_file_id UUID NOT NULL REFERENCES audio_files(id) ON DELETE CASCADE,
    raw_text TEXT NOT NULL,
    confidence_score DECIMAL(5,4),
    processing_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Workouts table
CREATE TABLE workouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    audio_file_id UUID NOT NULL REFERENCES audio_files(id) ON DELETE CASCADE,
    transcription_id UUID NOT NULL REFERENCES transcriptions(id) ON DELETE CASCADE,
    workout_date DATE NOT NULL,
    workout_start_time TIME,
    workout_duration_minutes INTEGER,
    total_exercises INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Exercises table
CREATE TABLE exercises (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    exercise_name VARCHAR(255) NOT NULL,
    exercise_type VARCHAR(100), -- strength, cardio, flexibility, etc.
    muscle_groups TEXT[], -- array of muscle groups
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

-- Exercise templates/library for consistency
CREATE TABLE exercise_library (
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

-- User progress tracking
CREATE TABLE user_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exercise_name VARCHAR(255) NOT NULL,
    metric_type VARCHAR(50) NOT NULL, -- weight, reps, duration, distance
    metric_value DECIMAL(10,2) NOT NULL,
    recorded_date DATE NOT NULL,
    workout_id UUID REFERENCES workouts(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_transcriptions_audio_file_id ON transcriptions(audio_file_id);
CREATE INDEX idx_workouts_user_id ON workouts(user_id);
CREATE INDEX idx_workouts_date ON workouts(workout_date);
CREATE INDEX idx_exercises_workout_id ON exercises(workout_id);
CREATE INDEX idx_exercises_name ON exercises(exercise_name);
CREATE INDEX idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX idx_user_progress_exercise ON user_progress(exercise_name);
CREATE INDEX idx_user_progress_date ON user_progress(recorded_date);

-- Insert some common exercises into the library
INSERT INTO exercise_library (name, category, primary_muscle_groups, secondary_muscle_groups, difficulty_level) VALUES
('Push-ups', 'Bodyweight', ARRAY['Chest', 'Triceps'], ARRAY['Shoulders', 'Core'], 2),
('Pull-ups', 'Bodyweight', ARRAY['Lats', 'Biceps'], ARRAY['Rhomboids', 'Middle traps'], 4),
('Squats', 'Bodyweight', ARRAY['Quadriceps', 'Glutes'], ARRAY['Hamstrings', 'Calves'], 2),
('Deadlifts', 'Barbell', ARRAY['Hamstrings', 'Glutes', 'Lower back'], ARRAY['Traps', 'Rhomboids'], 4),
('Bench Press', 'Barbell', ARRAY['Chest', 'Triceps'], ARRAY['Shoulders'], 3),
('Bicep Curls', 'Dumbbell', ARRAY['Biceps'], ARRAY['Forearms'], 2),
('Plank', 'Bodyweight', ARRAY['Core'], ARRAY['Shoulders'], 2),
('Running', 'Cardio', ARRAY['Legs'], ARRAY['Core', 'Cardiovascular'], 2),
('Overhead Press', 'Barbell', ARRAY['Shoulders', 'Triceps'], ARRAY['Core'], 3),
('Rows', 'Barbell', ARRAY['Lats', 'Rhomboids'], ARRAY['Biceps', 'Middle traps'], 3);