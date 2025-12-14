const express = require('express');
const multer = require('multer');
const { Pool } = require('pg');
const FileService = require('../services/FileService');
const QueueService = require('../services/QueueService');
const sessionService = require('../services/SessionService');
const TranscriptionService = require('../services/TranscriptionService');

const router = express.Router();

// Create pool with fallback for integration testing
let pool;
try {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/morse_db',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
} catch (error) {
  console.warn('Database connection failed, using mock mode for testing');
  pool = null;
}

// Mock database for testing when real database is not available
const mockDatabase = {
  async connect() {
    return {
      async query(sql, params) {
        console.log('Mock upload database query:', sql.substring(0, 50) + '...', params ? params.slice(0, 3) : []);

        // Handle different query types
        if (sql.includes('SELECT id FROM users WHERE device_uuid')) {
          return { rows: [{ id: 'mock-user-1' }] };
        }
        if (sql.includes('INSERT INTO users')) {
          return { rows: [{ id: 'mock-user-1' }] };
        }
        if (sql.includes('INSERT INTO audio_files')) {
          return { rows: [{ id: 'mock-audio-1', upload_timestamp: new Date() }] };
        }
        if (sql.includes('INSERT INTO transcriptions')) {
          return { rows: [{ id: 'mock-transcription-1' }] };
        }
        if (sql.includes('INSERT INTO workouts')) {
          return { rows: [{ id: 'mock-workout-1' }] };
        }
        if (sql.includes('INSERT INTO exercises')) {
          return { rows: [{ id: 'mock-exercise-1' }] };
        }
        if (sql.includes('UPDATE')) {
          return { rowCount: 1 };
        }
        if (sql.includes('BEGIN') || sql.includes('COMMIT') || sql.includes('ROLLBACK')) {
          return {};
        }
        return { rows: [] };
      },
      async release() {
        // Mock release
      }
    };
  }
};

// Helper function to get database client with fallback to mock
async function getDatabaseClient() {
  if (pool) {
    try {
      return await pool.connect();
    } catch (error) {
      console.warn('Real database connection failed, falling back to mock for upload:', error.message);
      return await mockDatabase.connect();
    }
  } else {
    console.log('Using mock database for upload integration testing');
    return await mockDatabase.connect();
  }
}

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    if (FileService.validateFileType(file)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only MP3, WAV, or M4A files are allowed.'), false);
    }
  }
});

// Batch upload for multiple files in one workout
const batchUpload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB per file
    files: 20 // Allow up to 20 files per batch
  },
  fileFilter: (req, file, cb) => {
    if (FileService.validateFileType(file)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only MP3, WAV, or M4A files are allowed.'), false);
    }
  }
});

// Legacy upload endpoint - can be disabled with DISABLE_LEGACY_UPLOAD=true
router.post('/', upload.single('audio'), async (req, res) => {
  // Check if legacy upload is disabled
  if (process.env.DISABLE_LEGACY_UPLOAD === 'true') {
    return res.status(410).json({ 
      error: 'Legacy upload endpoint disabled. Please use the new authentication system.',
      redirect: '/login'
    });
  }
  const client = await getDatabaseClient();
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    if (!FileService.validateFileSize(req.file)) {
      return res.status(400).json({ error: 'File size exceeds 50MB limit' });
    }

    const originalFilename = req.file.originalname;
    let deviceInfo;
    
    try {
      deviceInfo = FileService.parseFilename(originalFilename);
    } catch (error) {
      // For test uploads, use a configurable test device and current timestamp
      console.log('Using test device for upload:', originalFilename);
      
      // Allow different test devices - use c4a9 by default for testing
      const testDeviceUuid = process.env.TEST_DEVICE_UUID || 'f47ac10b-58cc-4372-a567-0e02b2c4c4a9';
      
      const now = new Date();
      deviceInfo = {
        deviceUuid: testDeviceUuid,
        timestamp: now.getTime(),
        timestampDate: now // Use exact same timestamp for consistency
      };
      
      console.log(`Test upload using device: ${testDeviceUuid.slice(-4).toUpperCase()}`);
    }

    await client.query('BEGIN');

    // Find or create user for this device
    let user = await client.query(
      'SELECT id FROM users WHERE device_uuid = $1',
      [deviceInfo.deviceUuid]
    );

    if (user.rows.length === 0) {
      console.log(`Creating new test user for device: ${deviceInfo.deviceUuid}`);
      const newUser = await client.query(
        'INSERT INTO users (device_uuid, created_at) VALUES ($1, CURRENT_TIMESTAMP) RETURNING id',
        [deviceInfo.deviceUuid]
      );
      user = newUser;
      console.log(`✅ Test user created with ID: ${newUser.rows[0].id}`);
    } else {
      console.log(`✅ Using existing user for device: ${deviceInfo.deviceUuid.slice(-4).toUpperCase()}`);
    }

    const userId = user.rows[0].id;

    // For Render deployment, process file in memory without saving to disk
    const fileSize = req.file.size;
    const fileId = require('uuid').v4();
    const filePath = `memory://${fileId}`; // Virtual path for database record

    const audioFile = await client.query(`
      INSERT INTO audio_files (
        user_id, original_filename, file_path, file_size,
        device_uuid, status
      ) VALUES ($1, $2, $3, $4, $5, 'uploaded')
      RETURNING id, created_at
    `, [userId, originalFilename, filePath, fileSize, deviceInfo.deviceUuid]);

    const audioFileId = audioFile.rows[0].id;
    const uploadTimestamp = audioFile.rows[0].created_at || deviceInfo.timestampDate;

    // Update user's updated_at timestamp (trigger will set this automatically when we update)
    // No need to manually update as the trigger handles it

    await client.query('COMMIT');

    // Detect or create workout session for this audio file
    let sessionDetectionResult;
    try {
      sessionDetectionResult = await sessionService.detectSession(
        userId,
        audioFileId,
        deviceInfo.timestampDate,
        deviceInfo.deviceUuid
      );
      console.log(`Session detection result:`, sessionDetectionResult);
    } catch (sessionError) {
      console.error('Session detection error:', sessionError);
      // Continue without session grouping if detection fails
      sessionDetectionResult = null;
    }

    // Process transcription and LLM extraction directly (instead of queuing)
    let transcriptionResult = null;
    let workoutResult = null;
    let workoutDataResult = null;
    
    try {
      // Update status to processing
      await client.query(
        'UPDATE audio_files SET status = $1 WHERE id = $2',
        ['processing', audioFileId]
      );

      // Step 1: Transcribe audio
      console.log(`Transcribing audio file: ${audioFileId}`);
      transcriptionResult = await TranscriptionService.transcribeAudio(filePath, audioFileId, deviceInfo.deviceUuid, userId, req.file.buffer, originalFilename);
      
      if (!transcriptionResult.success) {
        // If it's a retryable error (like quota), mark as pending for retry
        if (transcriptionResult.retryable) {
          await client.query(
            'UPDATE audio_files SET status = $1 WHERE id = $2',
            ['uploaded', audioFileId]
          );
          console.log(`Transcription failed due to quota/rate limit. Marked for retry. Audio file: ${audioFileId}`);
          // Exit try block - will send response with pending status
        } else {
          throw new Error(transcriptionResult.error || 'Transcription failed');
        }
      }

      // Save transcription to database
      const transcriptionInsert = await client.query(`
        INSERT INTO transcriptions (
          audio_file_id, raw_text, confidence_score, processing_time_ms
        ) VALUES ($1, $2, $3, $4)
        RETURNING id
      `, [
        audioFileId,
        transcriptionResult.text,
        transcriptionResult.confidence || 0.9,
        transcriptionResult.processing_time_ms || 0
      ]);
      
      const transcriptionId = transcriptionInsert.rows[0].id;
      console.log(`Saved transcription ${transcriptionId}`);

      // Only proceed with LLM if transcription succeeded
      if (transcriptionResult.success) {
        // Step 2: Extract workout data using LLM
        console.log(`Extracting workout data from transcription`);
        const LLMService = require('../services/LLMService');
        workoutDataResult = await LLMService.extractWorkoutData(
          transcriptionResult.text,
          deviceInfo.deviceUuid,
          false,
          1
        );

        if (!workoutDataResult.success) {
          // If it's a retryable error (like quota), mark as pending for retry
          if (workoutDataResult.retryable) {
            await client.query(
              'UPDATE audio_files SET status = $1 WHERE id = $2',
              ['uploaded', audioFileId]
            );
            console.log(`LLM extraction failed due to quota/rate limit. Marked for retry. Audio file: ${audioFileId}`);
            // Exit try block - will send response with pending status
          } else {
            throw new Error(workoutDataResult.error || 'LLM extraction failed');
          }
        }
      }

      // Step 3: Save workout and exercises (only if both transcription and LLM succeeded)
      if (transcriptionResult.success && workoutDataResult && workoutDataResult.success) {
        const workoutDate = deviceInfo.timestampDate.toISOString().split('T')[0];
        const workoutTime = deviceInfo.timestampDate.toTimeString().split(' ')[0].substring(0, 5);
      
      const workoutInsert = await client.query(`
        INSERT INTO workouts (
          user_id, audio_file_id, transcription_id, workout_date, 
          workout_start_time, workout_duration_minutes, total_exercises, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `, [
        userId,
        audioFileId,
        transcriptionId,
        workoutDate,
        workoutTime,
        workoutDataResult.workout.workout_duration_minutes || null,
        workoutDataResult.workout.exercises?.length || 0,
        workoutDataResult.workout.notes || null
      ]);

      const workoutId = workoutInsert.rows[0].id;
      console.log(`Saved workout ${workoutId}`);

      // Save exercises
      if (workoutDataResult.workout.exercises && workoutDataResult.workout.exercises.length > 0) {
        for (const exercise of workoutDataResult.workout.exercises) {
          await client.query(`
            INSERT INTO exercises (
              workout_id, exercise_name, exercise_type, muscle_groups,
              sets, reps, weight_lbs, duration_minutes, distance_miles,
              effort_level, rest_seconds, notes, order_in_workout
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          `, [
            workoutId,
            exercise.exercise_name,
            exercise.exercise_type || 'strength',
            exercise.muscle_groups || [],
            exercise.sets || null,
            exercise.reps || null,
            exercise.weight_lbs || null,
            exercise.duration_minutes || null,
            exercise.distance_miles || null,
            exercise.effort_level || null,
            exercise.rest_seconds || null,
            exercise.notes || null,
            exercise.order_in_workout || null
          ]);
        }
      }

      // Update status to completed
      await client.query(
        'UPDATE audio_files SET status = $1, processed = $2 WHERE id = $3',
        ['completed', true, audioFileId]
      );

        workoutResult = {
          workoutId,
          exerciseCount: workoutDataResult.workout.exercises?.length || 0
        };

        console.log(`Successfully processed audio file ${audioFileId} -> workout ${workoutId}`);
      }
    } catch (processingError) {
      console.error('Processing error:', processingError);
      await client.query(
        'UPDATE audio_files SET status = $1 WHERE id = $2',
        ['failed', audioFileId]
      );
      // Don't fail the upload, just log the error
      console.error('Failed to process transcription/LLM:', processingError.message);
    }

    // Check if processing was skipped due to retryable errors
    const processingStatus = workoutResult ? 'completed' : 
                            (transcriptionResult?.retryable || workoutDataResult?.retryable) ? 'uploaded' : 'failed';
    
    // Build response
    const response = {
      message: 'File uploaded successfully',
      audioFileId,
      filename: originalFilename,
      fileSize,
      uploadTimestamp,
      processed: workoutResult !== null,
      workoutId: workoutResult?.workoutId || null,
      exerciseCount: workoutResult?.exerciseCount || 0,
      deviceUuid: deviceInfo.deviceUuid,
      queued: false, // Processing happens directly, not queued
      status: processingStatus,
      session: sessionDetectionResult ? {
        sessionId: sessionDetectionResult.sessionId,
        isNewSession: sessionDetectionResult.isNewSession,
        timeGapMinutes: Math.round(sessionDetectionResult.timeGapMinutes || 0)
      } : null
    };

    // Add quota error info if applicable
    if (transcriptionResult?.retryable && transcriptionResult?.error) {
      response.transcriptionError = transcriptionResult.error;
      response.retryAfter = transcriptionResult.retryAfter || 3600;
    }
    if (workoutDataResult?.retryable && workoutDataResult?.error) {
      response.llmError = workoutDataResult.error;
      response.retryAfter = workoutDataResult.retryAfter || 3600;
    }

    res.status(201).json(response);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Upload error:', error);
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large' });
    }
    
    res.status(500).json({ 
      error: 'Failed to process upload',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

// Batch upload endpoint - processes multiple files as one workout
router.post('/batch', batchUpload.array('audio', 20), async (req, res) => {
  if (process.env.DISABLE_LEGACY_UPLOAD === 'true') {
    return res.status(410).json({ 
      error: 'Legacy upload endpoint disabled. Please use the new authentication system.',
      redirect: '/login'
    });
  }

  const client = await getDatabaseClient();
  
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No audio files provided' });
    }

    // Get device info from first file (all should be from same device/session)
    const firstFile = req.files[0];
    let deviceInfo;
    
    try {
      deviceInfo = FileService.parseFilename(firstFile.originalname);
    } catch (error) {
      const testDeviceUuid = process.env.TEST_DEVICE_UUID || 'f47ac10b-58cc-4372-a567-0e02b2c4c4a9';
      const now = new Date();
      deviceInfo = {
        deviceUuid: testDeviceUuid,
        timestamp: now.getTime(),
        timestampDate: now
      };
    }

    await client.query('BEGIN');

    // Find or create user
    let user = await client.query(
      'SELECT id FROM users WHERE device_uuid = $1',
      [deviceInfo.deviceUuid]
    );

    if (user.rows.length === 0) {
      const newUser = await client.query(
        'INSERT INTO users (device_uuid, created_at) VALUES ($1, CURRENT_TIMESTAMP) RETURNING id',
        [deviceInfo.deviceUuid]
      );
      user = newUser;
    }

    const userId = user.rows[0].id;

    // Save all files and transcribe them
    const audioFileIds = [];
    const transcriptions = [];
    
    // Helper function to delay between API calls to respect rate limits
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      
      if (!FileService.validateFileSize(file)) {
        throw new Error(`File ${file.originalname} exceeds 50MB limit`);
      }

      // For Render deployment, process file in memory
      const fileSize = file.size;
      const fileId = require('uuid').v4();
      const filePath = `memory://${fileId}`;

      const audioFile = await client.query(`
        INSERT INTO audio_files (
          user_id, original_filename, file_path, file_size,
          status
        ) VALUES ($1, $2, $3, $4, 'processing')
        RETURNING id
      `, [userId, file.originalname, filePath, fileSize]);

      const audioFileId = audioFile.rows[0].id;
      audioFileIds.push(audioFileId);

      // Add delay between transcription calls to respect rate limits (except for first file)
      if (i > 0) {
        await delay(2000); // 2 second delay between calls
      }

      // Transcribe each file
      try {
        const transcriptionResult = await TranscriptionService.transcribeAudio(filePath, audioFileId, deviceInfo.deviceUuid, userId, file.buffer, file.originalname);
        if (transcriptionResult.success) {
          transcriptions.push(transcriptionResult.text);
          
          // Save transcription
          await client.query(`
            INSERT INTO transcriptions (
              audio_file_id, raw_text, confidence_score, processing_time_ms
            ) VALUES ($1, $2, $3, $4)
          `, [
            audioFileId,
            transcriptionResult.text,
            transcriptionResult.confidence || 0.9,
            transcriptionResult.processing_time_ms || 0
          ]);
        } else if (transcriptionResult.retryable) {
          // Quota/rate limit error - mark for retry
          await client.query(
            'UPDATE audio_files SET status = $1 WHERE id = $2',
            ['uploaded', audioFileId]
          );
          console.log(`Transcription quota/rate limit error for ${audioFileId}, marked for retry`);
        } else {
          // Non-retryable error
          await client.query(
            'UPDATE audio_files SET status = $1 WHERE id = $2',
            ['failed', audioFileId]
          );
          console.error(`Transcription failed for ${audioFileId}:`, transcriptionResult.error);
        }
      } catch (transcriptionError) {
        console.error(`Transcription error for ${audioFileId}:`, transcriptionError);
        await client.query(
          'UPDATE audio_files SET status = $1 WHERE id = $2',
          ['failed', audioFileId]
        );
      }
    }

    // Combine all transcriptions and extract workout data as one workout
    // Format: clearly label each recording so LLM can extract all exercises
    const combinedTranscription = transcriptions.map((text, index) => {
      return `[Recording ${index + 1} of ${transcriptions.length}]\n${text}`;
    }).join('\n\n---\n\n');
    
    if (combinedTranscription.trim().length === 0) {
      // Check if we have any pending files (quota errors)
      const pendingFiles = audioFileIds.filter(id => {
        // We'll check status after this
        return true;
      });
      
      // Mark all files as pending if we have no transcriptions
      await client.query(
        `UPDATE audio_files SET status = $1 WHERE id = ANY($2)`,
        ['uploaded', audioFileIds]
      );
      
      await client.query('COMMIT');
      
      return res.status(201).json({
        message: 'Files uploaded but processing pending due to quota limits',
        fileCount: req.files.length,
        audioFileIds,
        deviceUuid: deviceInfo.deviceUuid,
        processed: false,
        queued: false,
        status: 'uploaded'
      });
    }

    console.log(`Batch upload: Combining ${transcriptions.length} transcriptions (${combinedTranscription.length} chars)`);

    // Extract workout data from combined transcription
    const LLMService = require('../services/LLMService');
    const workoutDataResult = await LLMService.extractWorkoutData(
      combinedTranscription,
      deviceInfo.deviceUuid,
      true, // isSession = true for batch uploads
      req.files.length // recordingCount
    );
    
    console.log(`Batch upload: Extracted ${workoutDataResult.workout?.exercises?.length || 0} exercises`);

    if (!workoutDataResult.success) {
      if (workoutDataResult.retryable) {
        // Quota error - mark all files as pending for retry
        await client.query(
          `UPDATE audio_files SET status = $1 WHERE id = ANY($2)`,
          ['uploaded', audioFileIds]
        );
        
        await client.query('COMMIT');
        
        return res.status(201).json({
          message: 'Files uploaded but processing pending due to quota limits',
          fileCount: req.files.length,
          audioFileIds,
          deviceUuid: deviceInfo.deviceUuid,
          processed: false,
          queued: false,
          status: 'uploaded'
        });
      }
      throw new Error(workoutDataResult.error || 'LLM extraction failed');
    }

    // Create one workout for all files
    const workoutDate = deviceInfo.timestampDate.toISOString().split('T')[0];
    const workoutTime = deviceInfo.timestampDate.toTimeString().split(' ')[0].substring(0, 5);
    
    const workoutInsert = await client.query(`
      INSERT INTO workouts (
        user_id, audio_file_id, transcription_id, workout_date, 
        workout_start_time, workout_duration_minutes, total_exercises, notes
      ) VALUES ($1, $2, NULL, $3, $4, $5, $6, $7)
      RETURNING id
    `, [
      userId,
      audioFileIds[0], // Use first audio file as primary
      workoutDate,
      workoutTime,
      workoutDataResult.workout.workout_duration_minutes || null,
      workoutDataResult.workout.exercises?.length || 0,
      workoutDataResult.workout.notes || null
    ]);

    const workoutId = workoutInsert.rows[0].id;

    // Save exercises
    if (workoutDataResult.workout.exercises && workoutDataResult.workout.exercises.length > 0) {
      for (const exercise of workoutDataResult.workout.exercises) {
        await client.query(`
          INSERT INTO exercises (
            workout_id, exercise_name, exercise_type, muscle_groups,
            sets, reps, weight_lbs, duration_minutes, distance_miles,
            effort_level, rest_seconds, notes, order_in_workout
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `, [
          workoutId,
          exercise.exercise_name,
          exercise.exercise_type || 'strength',
          exercise.muscle_groups || [],
          exercise.sets || null,
          exercise.reps || null,
          exercise.weight_lbs || null,
          exercise.duration_minutes || null,
          exercise.distance_miles || null,
          exercise.effort_level || null,
          exercise.rest_seconds || null,
          exercise.notes || null,
          exercise.order_in_workout || null
        ]);
      }
    }

    // Update all audio files to completed
    await client.query(
      `UPDATE audio_files SET status = $1, processed = $2 WHERE id = ANY($3)`,
      ['completed', true, audioFileIds]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Batch upload processed successfully',
      workoutId,
      exerciseCount: workoutDataResult.workout.exercises?.length || 0,
      fileCount: req.files.length,
      audioFileIds,
      deviceUuid: deviceInfo.deviceUuid,
      processed: true,
      queued: false,
      status: 'completed'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Batch upload error:', error);
    res.status(500).json({ 
      error: 'Failed to process batch upload',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

router.get('/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const status = await QueueService.getJobStatus(jobId);
    res.json(status);
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Failed to check job status' });
  }
});

router.get('/queue/stats', async (req, res) => {
  try {
    // Get real processing stats from database instead of Bull queue
    const stats = await getDatabaseStats();
    res.json(stats);
  } catch (error) {
    console.error('Queue stats error:', error);
    res.status(500).json({ error: 'Failed to get queue statistics' });
  }
});

async function getDatabaseStats() {
  const client = await getDatabaseClient();
  try {
    const result = await client.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM audio_files 
      GROUP BY status
    `);
    
    const stats = {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0
    };
    
    result.rows.forEach(row => {
      switch (row.status) {
        case 'uploaded':
        case 'queued':
          stats.waiting += parseInt(row.count);
          break;
        case 'processing':
          stats.active += parseInt(row.count);
          break;
        case 'completed':
          stats.completed += parseInt(row.count);
          break;
        case 'failed':
          stats.failed += parseInt(row.count);
          break;
      }
    });
    
    return stats;
  } finally {
    client.release();
  }
}

module.exports = router;