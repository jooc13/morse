const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/morse_db',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-change-in-production';
const SALT_ROUNDS = 12;

// User registration
router.post('/register', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { passphrase } = req.body;
    
    if (!passphrase || passphrase.length < 6) {
      return res.status(400).json({ 
        error: 'Passphrase must be at least 6 characters long' 
      });
    }
    
    // Hash the passphrase
    const passphraseHash = await bcrypt.hash(passphrase, SALT_ROUNDS);
    
    // Create new user
    const result = await client.query(
      'INSERT INTO app_users (passphrase_hash) VALUES ($1) RETURNING id, created_at',
      [passphraseHash]
    );
    
    const user = result.rows[0];
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, type: 'app_user' },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        created_at: user.created_at
      },
      token
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      error: 'Failed to register user',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

// User login
router.post('/login', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { passphrase } = req.body;
    
    if (!passphrase) {
      return res.status(400).json({ error: 'Passphrase is required' });
    }
    
    // Find user by checking all passphrase hashes (since we don't have usernames)
    const result = await client.query(
      'SELECT id, passphrase_hash, created_at, last_login FROM app_users WHERE is_active = true'
    );
    
    let authenticatedUser = null;
    
    // Check passphrase against all users (since no username)
    for (const user of result.rows) {
      const isValid = await bcrypt.compare(passphrase, user.passphrase_hash);
      if (isValid) {
        authenticatedUser = user;
        break;
      }
    }
    
    if (!authenticatedUser) {
      return res.status(401).json({ error: 'Invalid passphrase' });
    }
    
    // Update last login
    await client.query(
      'UPDATE app_users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [authenticatedUser.id]
    );
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: authenticatedUser.id, type: 'app_user' },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    res.json({
      message: 'Login successful',
      user: {
        id: authenticatedUser.id,
        created_at: authenticatedUser.created_at,
        last_login: new Date().toISOString()
      },
      token
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      error: 'Failed to authenticate user',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

// Verify token middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  // Handle auth bypass token for development
  if (token === 'dev-bypass-token' || token === 'dev-bypass-token') {
    req.user = {
      id: 'dev-user-123',
      created_at: new Date(),
      last_login: new Date()
    };
    return next();
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Verify user still exists and is active
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT id, created_at, last_login FROM app_users WHERE id = $1 AND is_active = true',
        [decoded.userId]
      );
      
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'User not found or inactive' });
      }
      
      req.user = result.rows[0];
      next();
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Get current user profile with real-time stats calculation
router.get('/profile', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    // Get basic user info
    const userResult = await client.query(`
      SELECT id, created_at, last_login
      FROM app_users
      WHERE id = $1
    `, [req.user.id]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userResult.rows[0];
    
    // Calculate real-time stats
    const statsResult = await client.query(`
      SELECT
        -- Total claimed workouts
        (SELECT COUNT(*) FROM workout_claims WHERE user_id = $1) as total_claimed_workouts,
        
        -- Linked devices count
        (SELECT COUNT(*) FROM user_devices WHERE user_id = $1 AND is_active = true) as linked_devices,
        
        -- Voice profiles count
        (SELECT COUNT(*) FROM voice_profiles WHERE user_id = $1 AND is_active = true) as voice_profiles_count,
        
        -- Last workout claimed
        (SELECT MAX(claimed_at) FROM workout_claims WHERE user_id = $1) as last_workout_claimed,
        
        -- Last device activity
        (SELECT MAX(last_seen) FROM user_devices WHERE user_id = $1) as last_device_activity
    `, [req.user.id]);
    
    const stats = statsResult.rows[0];
    
    res.json({
      user,
      stats: {
        total_claimed_workouts: parseInt(stats.total_claimed_workouts) || 0,
        linked_devices: parseInt(stats.linked_devices) || 0,
        voice_profiles_count: parseInt(stats.voice_profiles_count) || 0,
        last_workout_claimed: stats.last_workout_claimed,
        last_device_activity: stats.last_device_activity
      }
    });
    
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch user profile',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

// Search devices by last 4 UUID digits
router.get('/devices/search/:last4', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { last4 } = req.params;
    
    if (!/^[0-9a-f]{4}$/i.test(last4)) {
      return res.status(400).json({ error: 'Invalid format. Provide 4 hexadecimal characters.' });
    }
    
    const result = await client.query(
      'SELECT * FROM search_devices_by_last4($1)',
      [last4.toLowerCase()]
    );
    
    res.json({
      search_term: last4,
      devices: result.rows
    });
    
  } catch (error) {
    console.error('Device search error:', error);
    res.status(500).json({ 
      error: 'Failed to search devices',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

// Get unclaimed workouts for a device
router.get('/devices/:deviceUuid/workouts', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { deviceUuid } = req.params;
    
    const result = await client.query(
      'SELECT * FROM get_unclaimed_workouts_for_device($1)',
      [deviceUuid]
    );
    
    res.json({
      device_uuid: deviceUuid,
      unclaimed_workouts: result.rows
    });
    
  } catch (error) {
    console.error('Unclaimed workouts fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch unclaimed workouts',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

// Claim a workout
router.post('/workouts/:workoutId/claim', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { workoutId } = req.params;
    const userId = req.user.id;
    
    await client.query('BEGIN');
    
    // First get the audio file info and device info for linking
    const audioResult = await client.query(`
      SELECT 
        af.file_path, 
        af.voice_embedding, 
        af.voice_quality_score,
        u.device_uuid,
        w.id as workout_id
      FROM workouts w
      JOIN audio_files af ON w.audio_file_id = af.id
      JOIN users u ON w.user_id = u.id
      WHERE w.id = $1
    `, [workoutId]);
    
    if (audioResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Workout or audio file not found' });
    }
    
    const { voice_embedding, voice_quality_score, device_uuid, workout_id } = audioResult.rows[0];
    
    // Try using the claim_workout function, fallback to manual claiming
    let claimSuccess = false;
    try {
      const result = await client.query(
        'SELECT claim_workout($1, $2, $3) as success',
        [userId, workoutId, 'manual']
      );
      claimSuccess = result.rows[0].success;
    } catch (funcError) {
      console.log('Using fallback workout claiming');
      // Fallback: Manual claim process
      
      // Check if already claimed
      const existingClaim = await client.query(
        'SELECT id FROM workout_claims WHERE workout_id = $1',
        [workoutId]
      );
      
      if (existingClaim.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Workout already claimed' });
      }
      
      // Claim the workout
      await client.query(`
        INSERT INTO workout_claims (user_id, workout_id, claim_method, voice_match_confidence)
        VALUES ($1, $2, 'manual', NULL)
      `, [userId, workoutId]);
      
      // Update workout status
      await client.query(
        'UPDATE workouts SET claim_status = $1 WHERE id = $2',
        ['claimed', workoutId]
      );
      
      claimSuccess = true;
    }
    
    // Additional processing after successful claim
    console.log(`Workout claim result: success=${claimSuccess}, userId=${userId}`);
    
    if (claimSuccess) {
      console.log(`Starting device linking for device ${device_uuid} to user ${userId}`);
      
      // DEVICE LINKING - Simple direct approach
      try {
        const deviceLinkResult = await client.query(`
          INSERT INTO user_devices (user_id, device_uuid, device_name, is_active, last_seen)
          VALUES ($1, $2, $3, true, CURRENT_TIMESTAMP)
          ON CONFLICT (user_id, device_uuid) 
          DO UPDATE SET 
            last_seen = CURRENT_TIMESTAMP,
            is_active = true
          RETURNING id, device_name
        `, [userId, device_uuid, `Device ${device_uuid.slice(-4).toUpperCase()}`]);
        
        console.log('✅ Device linked successfully:', deviceLinkResult.rows[0]);
      } catch (deviceError) {
        console.error('❌ Device linking failed:', deviceError.message);
      }
      
      // VOICE PROFILE CREATION
      try {
        // First check if user already has a voice profile
        const existingProfile = await client.query(`
          SELECT id FROM voice_profiles WHERE user_id = $1 AND is_active = true
        `, [userId]);
        
        let voiceProfileResult;
        if (existingProfile.rows.length > 0) {
          // Update existing profile
          voiceProfileResult = await client.query(`
            UPDATE voice_profiles 
            SET embedding_vector = $2, confidence_score = $3, created_from_workout_id = $4
            WHERE user_id = $1 AND is_active = true
            RETURNING id
          `, [
            userId, 
            voice_embedding || Array(192).fill(0),
            voice_quality_score || 0.7,
            workoutId
          ]);
        } else {
          // Create new profile
          voiceProfileResult = await client.query(`
            INSERT INTO voice_profiles (user_id, embedding_vector, confidence_score, created_from_workout_id, is_active)
            VALUES ($1, $2, $3, $4, true)
            RETURNING id
          `, [
            userId, 
            voice_embedding || Array(192).fill(0),
            voice_quality_score || 0.7,
            workoutId
          ]);
        }
        
        console.log('✅ Voice profile created/updated:', voiceProfileResult.rows[0]);
      } catch (voiceError) {
        console.error('❌ Voice profile creation failed:', voiceError.message);
      }
      
      await client.query('COMMIT');
      
      res.json({
        message: 'Workout claimed successfully',
        workout_id: workoutId,
        user_id: userId,
        claimed_at: new Date().toISOString(),
        voice_profile_created: voice_embedding && voice_quality_score > 0.6
      });
    } else {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'Failed to claim workout' });
    }
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Workout claim error:', error);
    
    if (error.message.includes('already claimed')) {
      res.status(409).json({ error: 'Workout already claimed by another user' });
    } else if (error.message.includes('not found')) {
      res.status(404).json({ error: 'Workout not found' });
    } else {
      res.status(500).json({ 
        error: 'Failed to claim workout',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  } finally {
    client.release();
  }
});

// Get user's workouts (simplified - no claiming system)
// Works with auth bypass by using device_uuid from user profile
router.get('/workouts/claimed', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { limit = 200, offset = 0 } = req.query;
    const userId = req.user.id;
    
    // Get user's device UUID - for auth bypass, use test device UUID
    let deviceUuid;
    if (userId === 'dev-user-123' || userId.includes('dev-')) {
      // Auth bypass mode - use test device UUID
      deviceUuid = process.env.TEST_DEVICE_UUID || 'f47ac10b-58cc-4372-a567-0e02b2c4c4a9';
    } else {
      // Real auth - get device UUID from user
      const userResult = await client.query(
        'SELECT device_uuid FROM users WHERE id = $1',
        [userId]
      );
      if (userResult.rows.length === 0) {
        return res.json({ workouts: [], pagination: { total: 0, limit: parseInt(limit), offset: parseInt(offset), hasMore: false } });
      }
      deviceUuid = userResult.rows[0].device_uuid;
    }
    
    // Get workouts directly by device UUID (no claiming needed)
    const result = await client.query(`
      SELECT
        w.id,
        w.date_completed as workout_date,
        w.duration_seconds,
        w.total_exercises,
        w.notes,
        w.created_at,
        af.original_filename,
        u.device_uuid,
        COALESCE(
          json_agg(
            json_build_object(
              'id', e.id,
              'exercise_name', e.name,
              'exercise_type', e.category,
              'sets', e.sets,
              'reps', e.reps,
              'weight', e.weight,
              'duration_seconds', e.duration_seconds,
              'distance', e.distance,
              'notes', e.notes
            )
          ) FILTER (WHERE e.id IS NOT NULL),
          '[]'
        ) as exercises
      FROM workouts w
      LEFT JOIN audio_files af ON w.audio_file_id = af.id
      JOIN users u ON w.user_id = u.id
      LEFT JOIN exercises e ON w.id = e.workout_id
      WHERE u.device_uuid = $1
      GROUP BY w.id, w.date_completed, w.duration_seconds,
               w.total_exercises, w.notes, w.created_at, af.original_filename, u.device_uuid
      ORDER BY w.date_completed DESC, w.created_at DESC
      LIMIT $2 OFFSET $3
    `, [deviceUuid, parseInt(limit), parseInt(offset)]);
    
    const countResult = await client.query(
      `SELECT COUNT(*) FROM workouts w 
       JOIN users u ON w.user_id = u.id 
       WHERE u.device_uuid = $1`,
      [deviceUuid]
    );
    
    res.json({
      workouts: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < parseInt(countResult.rows[0].count)
      }
    });
    
  } catch (error) {
    console.error('Workouts fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch workouts',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

// Delete a workout
router.delete('/workouts/:workoutId', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { workoutId } = req.params;
    const userId = req.user.id;
    
    // Get user's device UUID for auth bypass
    let deviceUuid;
    if (userId === 'dev-user-123' || userId.includes('dev-')) {
      deviceUuid = process.env.TEST_DEVICE_UUID || 'f47ac10b-58cc-4372-a567-0e02b2c4c4a9';
    } else {
      const userResult = await client.query(
        'SELECT device_uuid FROM users WHERE id = $1',
        [userId]
      );
      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      deviceUuid = userResult.rows[0].device_uuid;
    }
    
    // Verify the workout belongs to this user's device
    const workoutCheck = await client.query(`
      SELECT w.id 
      FROM workouts w
      JOIN users u ON w.user_id = u.id
      WHERE w.id = $1 AND u.device_uuid = $2
    `, [workoutId, deviceUuid]);
    
    if (workoutCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Workout not found or access denied' });
    }
    
    // Delete the workout (exercises will cascade delete automatically)
    await client.query('DELETE FROM workouts WHERE id = $1', [workoutId]);
    
    res.json({
      message: 'Workout deleted successfully',
      workoutId
    });
    
  } catch (error) {
    console.error('Workout delete error:', error);
    res.status(500).json({ 
      error: 'Failed to delete workout',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

// Device Linking Endpoints

// Get user's linked devices (fallback for migration compatibility)
router.get('/devices/linked', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const userId = req.user.id;
    
    // Try the new function first, fallback to basic query
    let result;
    try {
      result = await client.query(
        'SELECT * FROM get_user_linked_devices($1)',
        [userId]
      );
    } catch (funcError) {
      console.log('Using fallback query for linked devices');
      // Fallback: Use existing user_devices table if function doesn't exist
      result = await client.query(`
        SELECT 
          device_uuid,
          device_name,
          first_claimed_at as linked_at,
          last_seen as last_activity,
          0 as recent_workouts_count,
          0 as pending_workouts_count
        FROM user_devices 
        WHERE user_id = $1 AND is_active = true
        ORDER BY last_seen DESC
      `, [userId]);
    }
    
    res.json({
      linked_devices: result.rows
    });
    
  } catch (error) {
    console.error('Linked devices fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch linked devices',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

// Link a device to user account (fallback for migration compatibility)
router.post('/devices/:deviceUuid/link', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { deviceUuid } = req.params;
    const { deviceName } = req.body;
    const userId = req.user.id;
    
    // Validate device UUID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(deviceUuid)) {
      return res.status(400).json({ error: 'Invalid device UUID format' });
    }
    
    // Check if device exists
    const deviceCheck = await client.query(
      'SELECT id FROM users WHERE device_uuid = $1',
      [deviceUuid]
    );
    
    if (deviceCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Device UUID not found. Device must have uploaded audio files first.' });
    }
    
    // Try using new function, fallback to existing table
    try {
      const result = await client.query(
        'SELECT link_user_to_device($1, $2, $3) as link_id',
        [userId, deviceUuid, deviceName || null]
      );
      
      if (!result.rows[0].link_id) {
        return res.status(400).json({ error: 'Failed to link device' });
      }
    } catch (funcError) {
      console.log('Using fallback device linking');
      // Fallback: Insert into user_devices table
      await client.query(`
        INSERT INTO user_devices (user_id, device_uuid, device_name)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, device_uuid) 
        DO UPDATE SET 
          device_name = COALESCE($3, user_devices.device_name),
          last_seen = CURRENT_TIMESTAMP,
          is_active = true
      `, [userId, deviceUuid, deviceName || `Device ${deviceUuid.slice(-4).toUpperCase()}`]);
    }
    
    res.status(201).json({
      message: 'Device linked successfully',
      device: { device_uuid: deviceUuid, device_name: deviceName }
    });
    
  } catch (error) {
    console.error('Device linking error:', error);
    res.status(500).json({ 
      error: 'Failed to link device',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

// Unlink a device from user account
router.delete('/devices/:deviceUuid/link', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { deviceUuid } = req.params;
    const userId = req.user.id;
    
    // Try new table first, fallback to existing
    let result;
    try {
      result = await client.query(
        'UPDATE device_links SET is_active = false WHERE user_id = $1 AND device_uuid = $2 RETURNING id',
        [userId, deviceUuid]
      );
    } catch (error) {
      result = await client.query(
        'UPDATE user_devices SET is_active = false WHERE user_id = $1 AND device_uuid = $2 RETURNING id',
        [userId, deviceUuid]
      );
    }
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Device link not found' });
    }
    
    res.json({
      message: 'Device unlinked successfully'
    });
    
  } catch (error) {
    console.error('Device unlinking error:', error);
    res.status(500).json({ 
      error: 'Failed to unlink device',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

// Search available devices (not yet linked by this user)
router.get('/devices/available/:last4', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { last4 } = req.params;
    const userId = req.user.id;
    
    if (!/^[0-9a-f]{4}$/i.test(last4)) {
      return res.status(400).json({ error: 'Invalid format. Provide 4 hexadecimal characters.' });
    }
    
    // Find devices that have uploaded audio but are not linked to this user
    // Check both device_links (new) and user_devices (existing) tables
    const result = await client.query(`
      SELECT DISTINCT
        u.device_uuid,
        COUNT(DISTINCT w.id) as total_workouts,
        COUNT(DISTINCT CASE WHEN w.claim_status = 'unclaimed' THEN w.id END) as unclaimed_workouts,
        MAX(af.upload_timestamp) as last_activity
      FROM users u
      JOIN audio_files af ON u.id = af.user_id
      LEFT JOIN workouts w ON af.id = w.audio_file_id
      WHERE RIGHT(u.device_uuid, 4) = $1
        AND NOT EXISTS (
          SELECT 1 FROM user_devices ud 
          WHERE ud.device_uuid = u.device_uuid 
          AND ud.user_id = $2 
          AND ud.is_active = true
        )
        AND af.upload_timestamp > CURRENT_TIMESTAMP - INTERVAL '30 days'
      GROUP BY u.device_uuid
      ORDER BY last_activity DESC
    `, [last4.toLowerCase(), userId]);
    
    res.json({
      search_term: last4,
      available_devices: result.rows
    });
    
  } catch (error) {
    console.error('Available devices search error:', error);
    res.status(500).json({ 
      error: 'Failed to search available devices',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

module.exports = { router, authenticateToken };