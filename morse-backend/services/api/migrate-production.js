const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: 'postgresql://morse:d5szdJe3YGhR6qCuY9NSFowTS17p5vzc@dpg-d4udng8gjchc73c71nkg-a/morse',
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    console.log('Starting migration...');

    // Enable pgvector extension
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');
    console.log('✓ Enabled pgvector extension');

    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE,
        password_hash VARCHAR(255),
        device_uuid VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT true
      )
    `);
    console.log('✓ Created users table');

    // Create user_profiles table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        full_name VARCHAR(255),
        bio TEXT,
        age_range VARCHAR(50),
        fitness_level VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Created user_profiles table');

    // Create sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        device_uuid VARCHAR(255) NOT NULL,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP WITH TIME ZONE,
        exercise_count INTEGER DEFAULT 0,
        notes TEXT
      )
    `);
    console.log('✓ Created sessions table');

    // Create audio_files table
    await client.query(`
      CREATE TABLE IF NOT EXISTS audio_files (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        device_uuid VARCHAR(255) NOT NULL,
        file_path VARCHAR(1000) NOT NULL,
        original_filename VARCHAR(500),
        file_size BIGINT,
        duration_seconds DECIMAL(10,2),
        mime_type VARCHAR(100),
        status VARCHAR(50) DEFAULT 'uploaded',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP WITH TIME ZONE,
        transcription_id UUID,
        embedding_vector VECTOR(1536),
        embedding_quality_score DECIMAL(3,2)
      )
    `);
    console.log('✓ Created audio_files table');

    // Create transcriptions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS transcriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        audio_file_id UUID REFERENCES audio_files(id) ON DELETE CASCADE,
        raw_text TEXT NOT NULL,
        confidence_score DECIMAL(3,2),
        processing_time_ms INTEGER,
        language VARCHAR(10) DEFAULT 'en',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        provider VARCHAR(50) DEFAULT 'whisper',
        model_version VARCHAR(100)
      )
    `);
    console.log('✓ Created transcriptions table');

    // Create workouts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS workouts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        session_id UUID REFERENCES sessions(id) ON DELETE NULL,
        audio_file_id UUID REFERENCES audio_files(id) ON DELETE SET NULL,
        device_uuid VARCHAR(255) NOT NULL,
        title VARCHAR(500),
        notes TEXT,
        date_completed DATE NOT NULL,
        total_exercises INTEGER DEFAULT 0,
        estimated_calories INTEGER,
        duration_seconds INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        transcription_id UUID REFERENCES transcriptions(id),
        claimed_at TIMESTAMP WITH TIME ZONE,
        auto_linked BOOLEAN DEFAULT false,
        speaker_verification_id UUID
      )
    `);
    console.log('✓ Created workouts table');

    // Create exercises table
    await client.query(`
      CREATE TABLE IF NOT EXISTS exercises (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workout_id UUID REFERENCES workouts(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100),
        sets INTEGER,
        reps INTEGER,
        weight DECIMAL(10,2),
        duration_seconds INTEGER,
        distance DECIMAL(10,2),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        verified BOOLEAN DEFAULT false
      )
    `);
    console.log('✓ Created exercises table');

    // Create voice_profiles table
    await client.query(`
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
      )
    `);
    console.log('✓ Created voice_profiles table');

    // Create speaker_verifications table
    await client.query(`
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
      )
    `);
    console.log('✓ Created speaker_verifications table');

    // Create indexes
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_users_device_uuid ON users(device_uuid)',
      'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
      'CREATE INDEX IF NOT EXISTS idx_sessions_device_uuid ON sessions(device_uuid)',
      'CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)',
      'CREATE INDEX IF NOT EXISTS idx_audio_files_session_id ON audio_files(session_id)',
      'CREATE INDEX IF NOT EXISTS idx_audio_files_status ON audio_files(status)',
      'CREATE INDEX IF NOT EXISTS idx_workouts_user_id ON workouts(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_workouts_device_uuid ON workouts(device_uuid)',
      'CREATE INDEX IF NOT EXISTS idx_workouts_date_completed ON workouts(date_completed)',
      'CREATE INDEX IF NOT EXISTS idx_exercises_workout_id ON exercises(workout_id)',
      'CREATE INDEX IF NOT EXISTS idx_voice_profiles_device_uuid ON voice_profiles(device_uuid)'
    ];

    for (const indexSql of indexes) {
      await client.query(indexSql);
    }
    console.log('✓ Created indexes');

    // Create updated_at trigger function
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql'
    `);
    console.log('✓ Created update_updated_at function');

    // Create triggers for updated_at
    const triggers = [
      'DROP TRIGGER IF EXISTS update_users_updated_at ON users; CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
      'DROP TRIGGER IF EXISTS update_sessions_updated_at ON sessions; CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
      'DROP TRIGGER IF EXISTS update_audio_files_updated_at ON audio_files; CREATE TRIGGER update_audio_files_updated_at BEFORE UPDATE ON audio_files FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
      'DROP TRIGGER IF EXISTS update_workouts_updated_at ON workouts; CREATE TRIGGER update_workouts_updated_at BEFORE UPDATE ON workouts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
      'DROP TRIGGER IF EXISTS update_exercises_updated_at ON exercises; CREATE TRIGGER update_exercises_updated_at BEFORE UPDATE ON exercises FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()'
    ];

    for (const triggerSql of triggers) {
      await client.query(triggerSql);
    }
    console.log('✓ Created triggers');

    await client.query('COMMIT');
    console.log('\n✅ Migration completed successfully!');

    // Check created tables
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('\nCreated tables:', result.rows.map(r => r.table_name).join(', '));

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();