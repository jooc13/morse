const { Pool } = require('pg');

class SessionService {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/morse_db',
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  }

  /**
   * Detects if an audio file should be grouped with an existing session
   * or if a new session should be created
   */
  async detectSession(userId, audioFileId, uploadTimestamp) {
    const client = await this.pool.connect();
    
    try {
      // Get user's session detection configuration
      const configResult = await client.query(
        'SELECT session_timeout_minutes FROM session_detection_config WHERE user_id = $1',
        [userId]
      );
      
      const timeoutMinutes = configResult.rows[0]?.session_timeout_minutes || 60;
      
      // Look for candidate sessions
      const candidates = await client.query(`
        SELECT * FROM detect_session_candidates($1, $2, $3, $4)
      `, [userId, audioFileId, uploadTimestamp, timeoutMinutes]);
      
      let sessionId;
      
      if (candidates.rows.length > 0) {
        // Add to existing session
        const candidateSessionId = candidates.rows[0].candidate_session_id;
        const timeGap = candidates.rows[0].time_gap_minutes;
        
        console.log(`Adding audio file ${audioFileId} to existing session ${candidateSessionId} (gap: ${timeGap} minutes)`);
        
        await client.query(`
          SELECT add_audio_to_session($1, $2, $3)
        `, [candidateSessionId, audioFileId, uploadTimestamp]);
        
        sessionId = candidateSessionId;
      } else {
        // Create new session
        console.log(`Creating new session for audio file ${audioFileId}`);
        
        const newSessionResult = await client.query(`
          SELECT create_new_session($1, $2, $3) as session_id
        `, [userId, audioFileId, uploadTimestamp]);
        
        sessionId = newSessionResult.rows[0].session_id;
      }
      
      // Update audio file with session reference
      await client.query(
        'UPDATE audio_files SET session_id = $1 WHERE id = $2',
        [sessionId, audioFileId]
      );
      
      return {
        sessionId,
        isNewSession: candidates.rows.length === 0,
        timeGapMinutes: candidates.rows[0]?.time_gap_minutes || 0
      };
      
    } finally {
      client.release();
    }
  }

  /**
   * Gets all audio files in a session, ordered by recording time
   */
  async getSessionAudioFiles(sessionId) {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(`
        SELECT 
          af.id,
          af.original_filename,
          af.file_path,
          af.transcription_status,
          af.upload_timestamp,
          saf.recording_order,
          saf.time_offset_minutes,
          t.raw_text as transcription,
          t.confidence_score
        FROM session_audio_files saf
        JOIN audio_files af ON saf.audio_file_id = af.id
        LEFT JOIN transcriptions t ON af.id = t.audio_file_id
        WHERE saf.session_id = $1
        ORDER BY saf.recording_order ASC
      `, [sessionId]);
      
      return result.rows;
      
    } finally {
      client.release();
    }
  }

  /**
   * Checks if a session is ready for processing (all audio files transcribed)
   */
  async isSessionReadyForProcessing(sessionId) {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(`
        SELECT 
          COUNT(*) as total_files,
          COUNT(CASE WHEN af.transcription_status = 'completed' THEN 1 END) as transcribed_files,
          COUNT(CASE WHEN af.transcription_status = 'failed' THEN 1 END) as failed_files
        FROM session_audio_files saf
        JOIN audio_files af ON saf.audio_file_id = af.id
        WHERE saf.session_id = $1
      `, [sessionId]);
      
      const stats = result.rows[0];
      const totalFiles = parseInt(stats.total_files);
      const transcribedFiles = parseInt(stats.transcribed_files);
      const failedFiles = parseInt(stats.failed_files);
      
      return {
        ready: transcribedFiles + failedFiles === totalFiles && totalFiles > 0,
        totalFiles,
        transcribedFiles,
        failedFiles,
        pendingFiles: totalFiles - transcribedFiles - failedFiles
      };
      
    } finally {
      client.release();
    }
  }

  /**
   * Gets sessions that need processing
   */
  async getPendingSessions() {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(`
        SELECT DISTINCT
          ws.id,
          ws.user_id,
          ws.session_date,
          ws.total_recordings,
          ws.session_status,
          u.device_uuid
        FROM workout_sessions ws
        JOIN users u ON ws.user_id = u.id
        WHERE ws.session_status = 'pending'
          AND EXISTS (
            SELECT 1 FROM session_audio_files saf
            JOIN audio_files af ON saf.audio_file_id = af.id
            WHERE saf.session_id = ws.id
              AND af.transcription_status = 'completed'
          )
        ORDER BY ws.created_at ASC
      `);
      
      const sessions = [];
      
      for (const row of result.rows) {
        const readyStatus = await this.isSessionReadyForProcessing(row.id);
        if (readyStatus.ready) {
          sessions.push({
            ...row,
            readyStatus
          });
        }
      }
      
      return sessions;
      
    } finally {
      client.release();
    }
  }

  /**
   * Updates session status
   */
  async updateSessionStatus(sessionId, status, notes = null) {
    const client = await this.pool.connect();
    
    try {
      const updateFields = ['session_status = $2', 'updated_at = CURRENT_TIMESTAMP'];
      const params = [sessionId, status];
      
      if (notes !== null) {
        updateFields.push('notes = $3');
        params.push(notes);
      }
      
      await client.query(`
        UPDATE workout_sessions 
        SET ${updateFields.join(', ')}
        WHERE id = $1
      `, params);
      
    } finally {
      client.release();
    }
  }

  /**
   * Gets session summary with all related data
   */
  async getSessionSummary(sessionId) {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(`
        SELECT * FROM session_summaries WHERE id = $1
      `, [sessionId]);
      
      return result.rows[0] || null;
      
    } finally {
      client.release();
    }
  }

  /**
   * Auto-completes old pending sessions (safety mechanism)
   */
  async autoCompleteOldSessions(maxAgeHours = 2) {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(`
        UPDATE workout_sessions 
        SET 
          session_status = 'completed',
          updated_at = CURRENT_TIMESTAMP,
          notes = COALESCE(notes || '; ', '') || 'Auto-completed due to age'
        WHERE session_status = 'pending' 
          AND created_at < CURRENT_TIMESTAMP - INTERVAL '${maxAgeHours} hours'
        RETURNING id, user_id, total_recordings
      `);
      
      return result.rows;
      
    } finally {
      client.release();
    }
  }

  /**
   * Combines transcriptions from all audio files in a session
   */
  async getCombinedSessionTranscription(sessionId) {
    const audioFiles = await this.getSessionAudioFiles(sessionId);
    
    if (audioFiles.length === 0) {
      return null;
    }
    
    // Build combined transcription with context
    let combinedText = '';
    
    if (audioFiles.length === 1) {
      // Single recording - use as-is
      combinedText = audioFiles[0].transcription || '';
    } else {
      // Multiple recordings - add context and ordering
      combinedText = `Workout session with ${audioFiles.length} recordings:\n\n`;
      
      audioFiles.forEach((file, index) => {
        const recordingNumber = index + 1;
        const timeOffset = file.time_offset_minutes ? ` (${Math.round(file.time_offset_minutes)} min into session)` : '';
        
        combinedText += `Recording ${recordingNumber}${timeOffset}: ${file.transcription || '[No transcription]'}\n\n`;
      });
    }
    
    return {
      combinedText,
      audioFiles: audioFiles.map(f => ({
        id: f.id,
        filename: f.original_filename,
        order: f.recording_order,
        timeOffset: f.time_offset_minutes,
        confidence: f.confidence_score
      })),
      totalRecordings: audioFiles.length,
      averageConfidence: audioFiles.reduce((sum, f) => sum + (f.confidence_score || 0), 0) / audioFiles.length
    };
  }

  /**
   * Health check for session service
   */
  async healthCheck() {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      return true;
    } catch (error) {
      console.error('SessionService health check failed:', error);
      return false;
    }
  }
}

module.exports = SessionService;