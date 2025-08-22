const express = require('express');
const { Pool } = require('pg');
const SessionService = require('../services/SessionService');

const router = express.Router();
const sessionService = new SessionService();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/morse_db',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Get session details
router.get('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const sessionSummary = await sessionService.getSessionSummary(sessionId);
    
    if (!sessionSummary) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json(sessionSummary);
    
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ error: 'Failed to retrieve session details' });
  }
});

// Get sessions for a user
router.get('/user/:deviceUuid', async (req, res) => {
  try {
    const { deviceUuid } = req.params;
    const { limit = 20, offset = 0, status } = req.query;
    
    const client = await pool.connect();
    
    // Get user
    const user = await client.query(
      'SELECT id FROM users WHERE device_uuid = $1',
      [deviceUuid]
    );
    
    if (user.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = user.rows[0].id;
    
    // Build query filters
    let statusFilter = '';
    let queryParams = [userId, parseInt(limit), parseInt(offset)];
    let paramCount = 3;
    
    if (status) {
      paramCount++;
      statusFilter = ` AND ws.session_status = $${paramCount}`;
      queryParams.push(status);
    }
    
    // Get sessions with audio file details
    const sessionsQuery = `
      SELECT 
        ws.id,
        ws.session_date,
        ws.session_start_time,
        ws.session_end_time,
        ws.session_duration_minutes,
        ws.total_recordings,
        ws.total_exercises,
        ws.session_status,
        ws.notes,
        ws.created_at,
        ws.updated_at,
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
      WHERE ws.user_id = $1 ${statusFilter}
      GROUP BY ws.id, ws.session_date, ws.session_start_time, ws.session_end_time,
               ws.session_duration_minutes, ws.total_recordings, ws.total_exercises,
               ws.session_status, ws.notes, ws.created_at, ws.updated_at
      ORDER BY ws.session_date DESC, ws.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const sessions = await client.query(sessionsQuery, queryParams);
    
    // Get total count
    const totalCountQuery = `
      SELECT COUNT(*) FROM workout_sessions ws 
      WHERE ws.user_id = $1 ${statusFilter}
    `;
    const totalCountParams = [userId];
    if (status) totalCountParams.push(status);
    
    const totalCount = await client.query(totalCountQuery, totalCountParams);
    
    client.release();
    
    res.json({
      sessions: sessions.rows,
      pagination: {
        total: parseInt(totalCount.rows[0].count),
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < parseInt(totalCount.rows[0].count)
      }
    });
    
  } catch (error) {
    console.error('Get user sessions error:', error);
    res.status(500).json({ error: 'Failed to retrieve user sessions' });
  }
});

// Get session readiness status
router.get('/:sessionId/readiness', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const readyStatus = await sessionService.isSessionReadyForProcessing(sessionId);
    
    res.json({
      sessionId,
      ...readyStatus
    });
    
  } catch (error) {
    console.error('Check session readiness error:', error);
    res.status(500).json({ error: 'Failed to check session readiness' });
  }
});

// Force process a session (admin endpoint)
router.post('/:sessionId/process', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { force = false } = req.body;
    
    const readyStatus = await sessionService.isSessionReadyForProcessing(sessionId);
    
    if (!readyStatus.ready && !force) {
      return res.status(400).json({
        error: 'Session not ready for processing',
        ...readyStatus
      });
    }
    
    // Update session status to trigger processing
    await sessionService.updateSessionStatus(sessionId, 'pending', 'Manual processing trigger');
    
    res.json({
      message: 'Session queued for processing',
      sessionId,
      forced: force
    });
    
  } catch (error) {
    console.error('Force process session error:', error);
    res.status(500).json({ error: 'Failed to queue session for processing' });
  }
});

// Get session statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const client = await pool.connect();
    
    const statsQuery = `
      SELECT 
        COUNT(*) as total_sessions,
        COUNT(CASE WHEN session_status = 'pending' THEN 1 END) as pending_sessions,
        COUNT(CASE WHEN session_status = 'processing' THEN 1 END) as processing_sessions,
        COUNT(CASE WHEN session_status = 'completed' THEN 1 END) as completed_sessions,
        COUNT(CASE WHEN session_status = 'failed' THEN 1 END) as failed_sessions,
        AVG(total_recordings) as avg_recordings_per_session,
        AVG(session_duration_minutes) as avg_session_duration,
        COUNT(DISTINCT user_id) as active_users
      FROM workout_sessions
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
    `;
    
    const stats = await client.query(statsQuery);
    
    // Get recent activity
    const recentActivityQuery = `
      SELECT 
        ws.session_date,
        COUNT(*) as session_count,
        AVG(ws.total_recordings) as avg_recordings,
        AVG(ws.session_duration_minutes) as avg_duration
      FROM workout_sessions ws
      WHERE ws.created_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY ws.session_date
      ORDER BY ws.session_date DESC
    `;
    
    const recentActivity = await client.query(recentActivityQuery);
    
    client.release();
    
    res.json({
      overview: stats.rows[0],
      recent_activity: recentActivity.rows
    });
    
  } catch (error) {
    console.error('Get session stats error:', error);
    res.status(500).json({ error: 'Failed to retrieve session statistics' });
  }
});

// Clean up old sessions (maintenance endpoint)
router.post('/maintenance/cleanup', async (req, res) => {
  try {
    const { maxAgeHours = 2, dryRun = false } = req.body;
    
    if (dryRun) {
      // Just report what would be cleaned up
      const client = await pool.connect();
      
      const previewQuery = `
        SELECT 
          id, 
          session_status, 
          total_recordings, 
          created_at,
          EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at)) / 3600 as age_hours
        FROM workout_sessions 
        WHERE session_status = 'pending' 
          AND created_at < CURRENT_TIMESTAMP - INTERVAL '${maxAgeHours} hours'
        ORDER BY created_at ASC
      `;
      
      const preview = await client.query(previewQuery);
      client.release();
      
      return res.json({
        dryRun: true,
        maxAgeHours,
        sessionsToCleanup: preview.rows.length,
        sessions: preview.rows
      });
    }
    
    // Actually clean up
    const cleanedUp = await sessionService.autoCompleteOldSessions(maxAgeHours);
    
    res.json({
      message: 'Session cleanup completed',
      maxAgeHours,
      cleanedUpSessions: cleanedUp.length,
      sessions: cleanedUp
    });
    
  } catch (error) {
    console.error('Session cleanup error:', error);
    res.status(500).json({ error: 'Failed to clean up sessions' });
  }
});

module.exports = router;