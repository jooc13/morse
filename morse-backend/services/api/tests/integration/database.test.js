describe('Database Integration Tests', () => {
  let pool;

  beforeAll(() => {
    pool = global.testUtils.testPool;
  });

  beforeEach(async () => {
    await global.testUtils.clearTables();
  });

  afterAll(async () => {
    await global.testUtils.clearTables();
  });

  describe('Users Table', () => {
    it('should create a new user', async () => {
      const userData = {
        device_uuid: 'test-user-123',
        email: 'test@example.com',
        password_hash: 'hashed-password',
        is_active: true
      };

      const result = await pool.query(`
        INSERT INTO users (device_uuid, email, password_hash, is_active)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [userData.device_uuid, userData.email, userData.password_hash, userData.is_active]);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].device_uuid).toBe(userData.device_uuid);
      expect(result.rows[0].email).toBe(userData.email);
      expect(result.rows[0].is_active).toBe(true);
      expect(result.rows[0].id).toBeDefined();
    });

    it('should enforce unique device_uuid constraint', async () => {
      const deviceUuid = 'duplicate-device';

      await pool.query(
        'INSERT INTO users (device_uuid) VALUES ($1)',
        [deviceUuid]
      );

      await expect(pool.query(
        'INSERT INTO users (device_uuid) VALUES ($1)',
        [deviceUuid]
      )).rejects.toThrow();
    });

    it('should update user profile', async () => {
      const user = await global.testUtils.createTestUser();

      const result = await pool.query(`
        UPDATE users
        SET email = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `, ['updated@example.com', user.id]);

      expect(result.rows[0].email).toBe('updated@example.com');
    });
  });

  describe('Workouts Table', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await global.testUtils.createTestUser();
    });

    it('should create a new workout', async () => {
      const workoutData = {
        user_id: testUser.id,
        device_uuid: 'test-device',
        title: 'Morning Workout',
        date_completed: new Date().toISOString(),
        duration_seconds: 1800,
        estimated_calories: 300
      };

      const result = await pool.query(`
        INSERT INTO workouts
          (user_id, device_uuid, title, date_completed, duration_seconds, estimated_calories)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [
        workoutData.user_id,
        workoutData.device_uuid,
        workoutData.title,
        workoutData.date_completed,
        workoutData.duration_seconds,
        workoutData.estimated_calories
      ]);

      expect(result.rows[0].title).toBe(workoutData.title);
      expect(result.rows[0].duration_seconds).toBe(workoutData.duration_seconds);
    });

    it('should link workout to user', async () => {
      const workout = await global.testUtils.createTestWorkout(testUser.id);

      const result = await pool.query(
        'SELECT * FROM workouts WHERE user_id = $1',
        [testUser.id]
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].id).toBe(workout.id);
    });

    it('should handle workout with exercises', async () => {
      const workout = await global.testUtils.createTestWorkout(testUser.id);

      const exerciseData = [
        {
          workout_id: workout.id,
          name: 'Bench Press',
          category: 'strength',
          sets: 3,
          reps: 10,
          weight: 150
        },
        {
          workout_id: workout.id,
          name: 'Squats',
          category: 'strength',
          sets: 4,
          reps: 12,
          weight: 200
        }
      ];

      for (const exercise of exerciseData) {
        await pool.query(`
          INSERT INTO exercises (workout_id, name, category, sets, reps, weight)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          exercise.workout_id,
          exercise.name,
          exercise.category,
          exercise.sets,
          exercise.reps,
          exercise.weight
        ]);
      }

      const result = await pool.query(
        'SELECT * FROM exercises WHERE workout_id = $1 ORDER BY name',
        [workout.id]
      );

      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].name).toBe('Bench Press');
      expect(result.rows[1].name).toBe('Squats');
    });
  });

  describe('Audio Files Table', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await global.testUtils.createTestUser();
    });

    it('should create an audio file record', async () => {
      const fileData = {
        user_id: testUser.id,
        device_uuid: 'test-device',
        filename: 'workout-recording.mp3',
        file_path: '/uploads/123.mp3',
        file_size: 1024000,
        mime_type: 'audio/mpeg',
        status: 'processing'
      };

      const result = await pool.query(`
        INSERT INTO audio_files
          (user_id, device_uuid, filename, file_path, file_size, mime_type, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        fileData.user_id,
        fileData.device_uuid,
        fileData.filename,
        fileData.file_path,
        fileData.file_size,
        fileData.mime_type,
        fileData.status
      ]);

      expect(result.rows[0].filename).toBe(fileData.filename);
      expect(result.rows[0].status).toBe(fileData.status);
    });

    it('should link audio file to transcription', async () => {
      const audioFile = await global.testUtils.createTestAudioFile(testUser.id);

      const transcription = await pool.query(`
        INSERT INTO transcriptions (audio_file_id, text, language, provider)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [audioFile.id, 'Sample transcription text', 'en', 'whisper']);

      expect(transcription.rows[0].audio_file_id).toBe(audioFile.id);

      const linkedResult = await pool.query(`
        SELECT t.text, a.filename
        FROM transcriptions t
        JOIN audio_files a ON t.audio_file_id = a.id
        WHERE t.id = $1
      `, [transcription.rows[0].id]);

      expect(linkedResult.rows[0].filename).toBe(audioFile.filename);
    });

    it('should update file status', async () => {
      const audioFile = await global.testUtils.createTestAudioFile(testUser.id, {
        status: 'processing'
      });

      const result = await pool.query(`
        UPDATE audio_files
        SET status = $1, processed_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `, ['completed', audioFile.id]);

      expect(result.rows[0].status).toBe('completed');
      expect(result.rows[0].processed_at).toBeDefined();
    });
  });

  describe('Sessions Table', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await global.testUtils.createTestUser();
    });

    it('should create a workout session', async () => {
      const sessionData = {
        user_id: testUser.id,
        device_uuid: 'test-device',
        status: 'active'
      };

      const result = await pool.query(`
        INSERT INTO sessions (user_id, device_uuid, status)
        VALUES ($1, $2, $3)
        RETURNING *
      `, [sessionData.user_id, sessionData.device_uuid, sessionData.status]);

      expect(result.rows[0].device_uuid).toBe(sessionData.device_uuid);
      expect(result.rows[0].status).toBe(sessionData.status);
    });

    it('should complete a session', async () => {
      const session = await pool.query(`
        INSERT INTO sessions (user_id, device_uuid, status)
        VALUES ($1, $2, $3)
        RETURNING *
      `, [testUser.id, 'test-device', 'active']);

      const result = await pool.query(`
        UPDATE sessions
        SET status = $1, completed_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `, ['completed', session.rows[0].id]);

      expect(result.rows[0].status).toBe('completed');
      expect(result.rows[0].completed_at).toBeDefined();
    });

    it('should count exercises in session', async () => {
      const session = await pool.query(`
        INSERT INTO sessions (user_id, device_uuid, status)
        VALUES ($1, $2, $3)
        RETURNING *
      `, [testUser.id, 'test-device', 'active']);

      const workout = await global.testUtils.createTestWorkout(testUser.id, {
        session_id: session.rows[0].id
      });

      // Add exercises to workout
      await pool.query(`
        INSERT INTO exercises (workout_id, name, sets, reps)
        VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)
      `, [
        workout.id, 'Exercise 1', 3, 10,
        workout.id, 'Exercise 2', 4, 12
      ]);

      // Update session exercise count
      await pool.query(`
        UPDATE sessions
        SET exercise_count = (
          SELECT COUNT(*)
          FROM exercises e
          JOIN workouts w ON e.workout_id = w.id
          WHERE w.session_id = $1
        )
        WHERE id = $1
      `, [session.rows[0].id]);

      const finalSession = await pool.query(
        'SELECT exercise_count FROM sessions WHERE id = $1',
        [session.rows[0].id]
      );

      expect(finalSession.rows[0].exercise_count).toBe(2);
    });
  });

  describe('Voice Profiles Table', () => {
    it('should create a voice profile', async () => {
      const testUser = await global.testUtils.createTestUser();

      const profileData = {
        user_id: testUser.id,
        device_uuid: 'voice-test-device',
        voice_fingerprint: 'fingerprint-123',
        is_active: true,
        sample_count: 10
      };

      const result = await pool.query(`
        INSERT INTO voice_profiles
          (user_id, device_uuid, voice_fingerprint, is_active, sample_count)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [
        profileData.user_id,
        profileData.device_uuid,
        profileData.voice_fingerprint,
        profileData.is_active,
        profileData.sample_count
      ]);

      expect(result.rows[0].device_uuid).toBe(profileData.device_uuid);
      expect(result.rows[0].voice_fingerprint).toBe(profileData.voice_fingerprint);
    });

    it('should enforce unique device_uuid', async () => {
      const testUser = await global.testUtils.createTestUser();
      const deviceUuid = 'unique-voice-device';

      await pool.query(
        'INSERT INTO voice_profiles (user_id, device_uuid) VALUES ($1, $2)',
        [testUser.id, deviceUuid]
      );

      await expect(pool.query(
        'INSERT INTO voice_profiles (user_id, device_uuid) VALUES ($1, $2)',
        [testUser.id, deviceUuid]
      )).rejects.toThrow();
    });
  });

  describe('Complex Queries', () => {
    it('should fetch workouts with exercises', async () => {
      const testUser = await global.testUtils.createTestUser();
      const workout = await global.testUtils.createTestWorkout(testUser.id);

      // Add exercises
      await pool.query(`
        INSERT INTO exercises (workout_id, name, category, sets, reps, weight)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [workout.id, 'Bench Press', 'strength', 3, 10, 150]);

      const result = await pool.query(`
        SELECT
          w.id as workout_id,
          w.title,
          w.date_completed,
          json_agg(
            json_build_object(
              'name', e.name,
              'category', e.category,
              'sets', e.sets,
              'reps', e.reps,
              'weight', e.weight
            )
          ) as exercises
        FROM workouts w
        LEFT JOIN exercises e ON w.id = e.workout_id
        WHERE w.user_id = $1
        GROUP BY w.id, w.title, w.date_completed
      `, [testUser.id]);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].exercises).toHaveLength(1);
      expect(result.rows[0].exercises[0].name).toBe('Bench Press');
    });

    it('should calculate user statistics', async () => {
      const testUser = await global.testUtils.createTestUser();

      // Create multiple workouts
      await global.testUtils.createTestWorkout(testUser.id, {
        title: 'Workout 1',
        duration_seconds: 1800
      });
      await global.testUtils.createTestWorkout(testUser.id, {
        title: 'Workout 2',
        duration_seconds: 2400
      });

      const stats = await pool.query(`
        SELECT
          COUNT(*) as total_workouts,
          SUM(duration_seconds) as total_duration,
          AVG(duration_seconds) as avg_duration
        FROM workouts
        WHERE user_id = $1
      `, [testUser.id]);

      expect(stats.rows[0].total_workouts).toBe('2');
      expect(parseInt(stats.rows[0].total_duration)).toBe(4200);
      expect(Math.round(parseInt(stats.rows[0].avg_duration))).toBe(2100);
    });
  });

  describe('Data Integrity', () => {
    it('should maintain foreign key constraints', async () => {
      await expect(pool.query(
        'INSERT INTO exercises (workout_id, name) VALUES ($1, $2)',
        ['nonexistent-workout-id', 'Test Exercise']
      )).rejects.toThrow();
    });

    it('should handle cascade deletes', async () => {
      const testUser = await global.testUtils.createTestUser();
      const workout = await global.testUtils.createTestWorkout(testUser.id);

      // Add exercise
      await pool.query(
        'INSERT INTO exercises (workout_id, name) VALUES ($1, $2)',
        [workout.id, 'Test Exercise']
      );

      // Delete workout
      await pool.query('DELETE FROM workouts WHERE id = $1', [workout.id]);

      // Check if exercise was deleted
      const exercises = await pool.query(
        'SELECT * FROM exercises WHERE workout_id = $1',
        [workout.id]
      );

      expect(exercises.rows).toHaveLength(0);
    });
  });
});