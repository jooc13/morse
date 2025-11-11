const express = require('express');
const multer = require('multer');
const { Pool } = require('pg');
const FileService = require('../services/FileService');
const QueueService = require('../services/QueueService');

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/morse_db',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

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
      cb(new Error('Invalid file type. Only MP3 files are allowed.'), false);
    }
  }
});

router.post('/', upload.single('audio'), async (req, res) => {
  const client = await pool.connect();
  
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
      return res.status(400).json({ error: error.message });
    }

    await client.query('BEGIN');

    let user = await client.query(
      'SELECT id FROM users WHERE device_uuid = $1',
      [deviceInfo.deviceUuid]
    );

    if (user.rows.length === 0) {
      const newUser = await client.query(
        'INSERT INTO users (device_uuid) VALUES ($1) RETURNING id',
        [deviceInfo.deviceUuid]
      );
      user = newUser;
    }

    const userId = user.rows[0].id;

    const { filePath, fileSize, fileId } = await FileService.saveFile(req.file, originalFilename);

    const audioFile = await client.query(`
      INSERT INTO audio_files (
        user_id, original_filename, file_path, file_size, 
        upload_timestamp, transcription_status
      ) VALUES ($1, $2, $3, $4, $5, 'pending') 
      RETURNING id, upload_timestamp
    `, [userId, originalFilename, filePath, fileSize, deviceInfo.timestampDate]);

    const audioFileId = audioFile.rows[0].id;
    const uploadTimestamp = audioFile.rows[0].upload_timestamp;

    await client.query(
      'UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = $1',
      [userId]
    );

    await client.query('COMMIT');

    const queueResult = await QueueService.addTranscriptionJob({
      audioFileId,
      userId,
      filePath,
      originalFilename,
      deviceUuid: deviceInfo.deviceUuid,
      uploadTimestamp: deviceInfo.timestamp
    });

    if (queueResult.queued) {
      await client.query(
        'UPDATE audio_files SET transcription_status = $1 WHERE id = $2',
        ['queued', audioFileId]
      );
    }

    res.status(201).json({
      message: 'File uploaded successfully',
      audioFileId,
      filename: originalFilename,
      fileSize,
      uploadTimestamp,
      queued: queueResult.queued,
      jobId: queueResult.jobId,
      deviceUuid: deviceInfo.deviceUuid
    });

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
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        transcription_status,
        COUNT(*) as count
      FROM audio_files 
      GROUP BY transcription_status
    `);
    
    const stats = {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0
    };
    
    result.rows.forEach(row => {
      switch (row.transcription_status) {
        case 'pending':
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