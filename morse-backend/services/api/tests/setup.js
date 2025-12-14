// Test setup file
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Test database configuration
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:password@localhost:5432/morse_test';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.GEMINI_API_KEY = 'test-gemini-key';
process.env.OPENAI_API_KEY = 'test-openai-key';

// Create test database connection pool
const testPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

// Global test setup
beforeAll(async () => {
  console.log('Setting up test environment...');

  // Run database migrations for tests
  try {
    const migrationPath = path.join(__dirname, '../database/migrations/001_schema.sql');
    if (fs.existsSync(migrationPath)) {
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      await testPool.query(migrationSQL);
    }
  } catch (error) {
    console.log('Migration already exists or failed:', error.message);
  }
});

// Global test teardown
afterAll(async () => {
  console.log('Cleaning up test environment...');

  // Clean up test data
  try {
    await testPool.query(`
      TRUNCATE TABLE
        exercises,
        workouts,
        audio_files,
        transcriptions,
        sessions,
        users,
        voice_profiles,
        speaker_verifications
      RESTART IDENTITY CASCADE;
    `);
  } catch (error) {
    console.error('Cleanup error:', error.message);
  }

  // Close database connection
  await testPool.end();
});

// Export test utilities
global.testUtils = {
  testPool,

  // Helper to create test user
  async createTestUser(overrides = {}) {
    const defaultUser = {
      device_uuid: 'test-device-123',
      is_active: true
    };

    const userData = { ...defaultUser, ...overrides };
    const result = await testPool.query(
      'INSERT INTO users (device_uuid, is_active) VALUES ($1, $2) RETURNING *',
      [userData.device_uuid, userData.is_active]
    );

    return result.rows[0];
  },

  // Helper to create test workout
  async createTestWorkout(userId, overrides = {}) {
    const defaultWorkout = {
      user_id: userId,
      device_uuid: 'test-device-123',
      title: 'Test Workout',
      date_completed: new Date().toISOString(),
      duration_seconds: 1800
    };

    const workoutData = { ...defaultWorkout, ...overrides };
    const result = await testPool.query(
      `INSERT INTO workouts (user_id, device_uuid, title, date_completed, duration_seconds)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [workoutData.user_id, workoutData.device_uuid, workoutData.title,
       workoutData.date_completed, workoutData.duration_seconds]
    );

    return result.rows[0];
  },

  // Helper to create test audio file
  async createTestAudioFile(userId, overrides = {}) {
    const defaultFile = {
      user_id: userId,
      device_uuid: 'test-device-123',
      filename: 'test-audio.mp3',
      file_path: '/tmp/test-audio.mp3',
      file_size: 1024000,
      mime_type: 'audio/mpeg',
      status: 'completed'
    };

    const fileData = { ...defaultFile, ...overrides };
    const result = await testPool.query(
      `INSERT INTO audio_files (user_id, device_uuid, filename, file_path, file_size, mime_type, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [fileData.user_id, fileData.device_uuid, fileData.filename, fileData.file_path,
       fileData.file_size, fileData.mime_type, fileData.status]
    );

    return result.rows[0];
  },

  // Helper to clear tables
  async clearTables() {
    await testPool.query(`
      TRUNCATE TABLE
        exercises,
        workouts,
        audio_files,
        transcriptions,
        sessions,
        users,
        voice_profiles,
        speaker_verifications
      RESTART IDENTITY CASCADE;
    `);
  }
};