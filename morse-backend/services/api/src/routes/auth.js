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

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const result = await client.query(`
      SELECT 
        au.id,
        au.created_at,
        au.last_login,
        uws.total_claimed_workouts,
        uws.linked_devices,
        uws.voice_profiles_count,
        uws.last_workout_claimed,
        uws.last_device_activity
      FROM app_users au
      LEFT JOIN user_workout_summaries uws ON au.id = uws.user_id
      WHERE au.id = $1
    `, [req.user.id]);
    
    const profile = result.rows[0];
    
    res.json({
      user: profile,
      stats: {
        total_claimed_workouts: profile.total_claimed_workouts || 0,
        linked_devices: profile.linked_devices || 0,
        voice_profiles_count: profile.voice_profiles_count || 0,
        last_workout_claimed: profile.last_workout_claimed,
        last_device_activity: profile.last_device_activity
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
    
    // First get the audio file path for voice profile creation
    const audioResult = await client.query(`
      SELECT af.file_path, af.voice_embedding, af.voice_quality_score
      FROM workouts w
      JOIN audio_files af ON w.audio_file_id = af.id
      WHERE w.id = $1
    `, [workoutId]);
    
    if (audioResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Workout or audio file not found' });
    }
    
    const audioFile = audioResult.rows[0];
    
    // Claim the workout
    const result = await client.query(
      'SELECT claim_workout($1, $2, $3) as success',
      [userId, workoutId, 'manual']
    );
    
    if (result.rows[0].success) {
      // Create voice profile if we have voice embedding and good quality
      if (audioFile.voice_embedding && audioFile.voice_quality_score > 0.6) {
        await client.query(`
          INSERT INTO voice_profiles (user_id, embedding_vector, confidence_score, created_from_workout_id)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT DO NOTHING
        `, [userId, audioFile.voice_embedding, audioFile.voice_quality_score, workoutId]);
      }
      
      await client.query('COMMIT');
      
      res.json({
        message: 'Workout claimed successfully',
        workout_id: workoutId,
        user_id: userId,
        claimed_at: new Date().toISOString(),
        voice_profile_created: audioFile.voice_embedding && audioFile.voice_quality_score > 0.6
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

// Get user's claimed workouts
router.get('/workouts/claimed', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { limit = 20, offset = 0 } = req.query;
    const userId = req.user.id;
    
    const result = await client.query(`
      SELECT 
        w.id,
        w.workout_date,
        w.workout_duration_minutes,
        w.total_exercises,
        w.notes,
        w.created_at,
        af.original_filename,
        wc.claimed_at,
        wc.claim_method,
        u.device_uuid,
        COALESCE(
          json_agg(
            json_build_object(
              'id', e.id,
              'exercise_name', e.exercise_name,
              'exercise_type', e.exercise_type,
              'sets', e.sets,
              'reps', e.reps,
              'weight_lbs', e.weight_lbs,
              'effort_level', e.effort_level
            ) ORDER BY e.order_in_workout
          ) FILTER (WHERE e.id IS NOT NULL), 
          '[]'
        ) as exercises
      FROM workout_claims wc
      JOIN workouts w ON wc.workout_id = w.id
      JOIN audio_files af ON w.audio_file_id = af.id
      JOIN users u ON w.user_id = u.id
      LEFT JOIN exercises e ON w.id = e.workout_id
      WHERE wc.user_id = $1
      GROUP BY w.id, w.workout_date, w.workout_duration_minutes, w.total_exercises, 
               w.notes, w.created_at, af.original_filename, wc.claimed_at, 
               wc.claim_method, u.device_uuid
      ORDER BY wc.claimed_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, parseInt(limit), parseInt(offset)]);
    
    const countResult = await client.query(
      'SELECT COUNT(*) FROM workout_claims WHERE user_id = $1',
      [userId]
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
    console.error('Claimed workouts fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch claimed workouts',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

module.exports = { router, authenticateToken };