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
      // Default session timeout - 60 minutes between workouts
      const timeoutMinutes = 60;

      // Look for recent sessions (within the last timeout period)
      const recentSessionsResult = await client.query(`
        SELECT
          s.id as session_id,
          s.created_at as session_created_at,
          EXTRACT(EPOCH FROM ($1::timestamp - s.created_at)) / 60 as minutes_since_session
        FROM sessions s
        WHERE s.user_id = $2
          AND s.created_at >= ($1::timestamp - INTERVAL '${timeoutMinutes} minutes')
          AND s.status = 'active'
        ORDER BY s.created_at DESC
        LIMIT 1
      `, [uploadTimestamp, userId]);

      let sessionId;
      let isNewSession = true;
      let timeGapMinutes = 0;

      if (recentSessionsResult.rows.length > 0) {
        const recentSession = recentSessionsResult.rows[0];
        const minutesSince = recentSession.minutes_since_session;

        // If there's a session within the timeout period, use it
        if (minutesSince <= timeoutMinutes) {
          sessionId = recentSession.session_id;
          isNewSession = false;
          timeGapMinutes = Math.round(minutesSince);

          console.log(`Adding audio file ${audioFileId} to existing session ${sessionId} (gap: ${timeGapMinutes} minutes)`);

          // Update session to mark as recently active
          await client.query(
            'UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
            [sessionId]
          );
        }
      }

      // If no suitable session found, create a new one
      if (!sessionId) {
        console.log(`Creating new session for audio file ${audioFileId}`);

        const newSessionResult = await client.query(`
          INSERT INTO sessions (user_id, status, created_at, updated_at)
          VALUES ($1, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING id
        `, [userId]);

        sessionId = newSessionResult.rows[0].id;
        isNewSession = true;
        timeGapMinutes = 0;
      }

      // Update audio file with session reference
      await client.query(
        'UPDATE audio_files SET session_id = $1 WHERE id = $2',
        [sessionId, audioFileId]
      );

      return {
        sessionId,
        isNewSession,
        timeGapMinutes
      };

    } catch (error) {
      console.error('Session detection error:', error);
      // Return null if session detection fails - upload can continue without session
      return null;
    } finally {
      client.release();
    }
  }

  /**
   * Gets all audio files in a session, ordered by creation time
   */
  async getSessionAudioFiles(sessionId) {
    const client = await this.pool.connect();

    try {
      const result = await client.query(`
        SELECT
          af.id,
          af.original_filename,
          af.file_path,
          af.status as transcription_status,
          af.created_at as upload_timestamp,
          t.raw_text as transcription,
          t.confidence_score
        FROM audio_files af
        LEFT JOIN transcriptions t ON af.id = t.audio_file_id
        WHERE af.session_id = $1
        ORDER BY af.created_at ASC
      `, [sessionId]);

      return result.rows;

    } finally {
      client.release();
    }
  }

  /**
   * Gets session details
   */
  async getSession(sessionId) {
    const client = await this.pool.connect();

    try {
      const result = await client.query(`
        SELECT
          s.id,
          s.user_id,
          s.status,
          s.created_at,
          s.updated_at,
          s.completed_at,
          COUNT(DISTINCT af.id) as audio_file_count,
          COUNT(DISTINCT w.id) as workout_count
        FROM sessions s
        LEFT JOIN audio_files af ON s.id = af.session_id
        LEFT JOIN workouts w ON s.id = w.session_id
        WHERE s.id = $1
        GROUP BY s.id, s.user_id, s.status, s.created_at, s.updated_at, s.completed_at
      `, [sessionId]);

      return result.rows[0] || null;

    } finally {
      client.release();
    }
  }

  /**
   * Completes a session
   */
  async completeSession(sessionId) {
    const client = await this.pool.connect();

    try {
      await client.query(
        'UPDATE sessions SET status = $1, completed_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['completed', sessionId]
      );

      return true;
    } catch (error) {
      console.error('Error completing session:', error);
      return false;
    } finally {
      client.release();
    }
  }

  /**
   * Gets session summary with audio files and workouts
   */
  async getSessionSummary(sessionId) {
    const client = await this.pool.connect();

    try {
      // Get session details
      const sessionResult = await client.query(
        'SELECT * FROM sessions WHERE id = $1',
        [sessionId]
      );

      if (sessionResult.rows.length === 0) {
        return null;
      }

      const session = sessionResult.rows[0];

      // Get audio files
      const audioFilesResult = await client.query(`
        SELECT
          af.id,
          af.original_filename,
          af.status as transcription_status,
          af.created_at as upload_timestamp,
          t.raw_text as transcription,
          t.confidence_score
        FROM audio_files af
        LEFT JOIN transcriptions t ON af.id = t.audio_file_id
        WHERE af.session_id = $1
        ORDER BY af.created_at ASC
      `, [sessionId]);

      // Get workouts
      const workoutsResult = await client.query(`
        SELECT
          w.id,
          w.workout_date,
          w.workout_start_time,
          w.duration_seconds,
          w.total_exercises,
          w.created_at
        FROM workouts w
        WHERE w.session_id = $1
        ORDER BY w.created_at ASC
      `, [sessionId]);

      return {
        session,
        audioFiles: audioFilesResult.rows,
        workouts: workoutsResult.rows
      };

    } catch (error) {
      console.error('Error getting session summary:', error);
      return null;
    } finally {
      client.release();
    }
  }

  /**
   * Checks if a session is ready for processing
   */
  async isSessionReadyForProcessing(sessionId) {
    const client = await this.pool.connect();

    try {
      // Check if session exists and has audio files
      const result = await client.query(`
        SELECT
          s.id,
          s.status,
          COUNT(DISTINCT af.id) as audio_count,
          COUNT(DISTINCT CASE WHEN af.status = 'completed' THEN af.id END) as transcribed_count
        FROM sessions s
        LEFT JOIN audio_files af ON s.id = af.session_id
        WHERE s.id = $1
        GROUP BY s.id, s.status
      `, [sessionId]);

      if (result.rows.length === 0) {
        return { ready: false, reason: 'Session not found' };
      }

      const session = result.rows[0];

      if (session.status !== 'active') {
        return { ready: false, reason: 'Session not active' };
      }

      if (session.audio_count === 0) {
        return { ready: false, reason: 'No audio files' };
      }

      return { ready: true };

    } catch (error) {
      console.error('Error checking session readiness:', error);
      return { ready: false, reason: 'Error checking session' };
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
      let query = 'UPDATE sessions SET status = $1, updated_at = CURRENT_TIMESTAMP';
      const params = [status];

      if (notes) {
        query += ', notes = $2';
        params.push(notes);
      }

      query += ' WHERE id = $' + (params.length + 1);
      params.push(sessionId);

      await client.query(query, params);
      return true;

    } catch (error) {
      console.error('Error updating session status:', error);
      return false;
    } finally {
      client.release();
    }
  }

  /**
   * Auto-completes old sessions
   */
  async autoCompleteOldSessions(maxAgeHours = 24) {
    const client = await this.pool.connect();

    try {
      const result = await client.query(`
        UPDATE sessions
        SET status = 'completed', completed_at = CURRENT_TIMESTAMP
        WHERE status = 'active'
          AND updated_at < NOW() - INTERVAL '${maxAgeHours} hours'
        RETURNING id
      `);

      return {
        completed: result.rows.length,
        sessionIds: result.rows.map(row => row.id)
      };

    } catch (error) {
      console.error('Error auto-completing sessions:', error);
      return { completed: 0, sessionIds: [] };
    } finally {
      client.release();
    }
  }
}

module.exports = new SessionService();