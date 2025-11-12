-- Add progress tracking to audio files table
ALTER TABLE audio_files ADD COLUMN IF NOT EXISTS processing_progress INTEGER DEFAULT 0;
ALTER TABLE audio_files ADD COLUMN IF NOT EXISTS processing_stage VARCHAR(50) DEFAULT 'uploaded';
ALTER TABLE audio_files ADD COLUMN IF NOT EXISTS processing_message TEXT;

-- Add progress tracking table for detailed step-by-step progress
CREATE TABLE IF NOT EXISTS file_processing_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    audio_file_id UUID NOT NULL REFERENCES audio_files(id) ON DELETE CASCADE,
    stage VARCHAR(50) NOT NULL, -- 'transcription', 'llm_processing', 'data_saving'
    progress_percent INTEGER NOT NULL DEFAULT 0, -- 0-100
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'failed'
    message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_processing_progress_audio_file_id ON file_processing_progress(audio_file_id);
CREATE INDEX IF NOT EXISTS idx_processing_progress_status ON file_processing_progress(status);

-- Add unique constraint to prevent duplicate stage records per file
ALTER TABLE file_processing_progress ADD CONSTRAINT IF NOT EXISTS unique_file_stage UNIQUE (audio_file_id, stage);

-- Insert default processing stages for any existing pending files
INSERT INTO file_processing_progress (audio_file_id, stage, status)
SELECT
    id,
    stage_name,
    'pending'
FROM
    audio_files,
    (VALUES ('transcription'), ('llm_processing'), ('data_saving')) AS stages(stage_name)
WHERE
    transcription_status IN ('pending', 'queued', 'processing')
    AND NOT EXISTS (
        SELECT 1 FROM file_processing_progress
        WHERE audio_file_id = audio_files.id AND stage = stages.stage_name
    );