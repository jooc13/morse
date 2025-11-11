const express = require('express');
const { Pool } = require('pg');
const axios = require('axios');

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/morse_db',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

router.get('/:deviceUuid', async (req, res) => {
  try {
    const { deviceUuid } = req.params;
    const { limit = 20, offset = 0, startDate, endDate } = req.query;

    const client = await pool.connect();

    const user = await client.query(
      'SELECT id FROM users WHERE device_uuid = $1',
      [deviceUuid]
    );

    if (user.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'User not found' });
    }

    const userId = user.rows[0].id;

    let dateFilter = '';
    let queryParams = [userId, parseInt(limit), parseInt(offset)];
    let paramCount = 3;

    if (startDate) {
      paramCount++;
      dateFilter += ` AND w.workout_date >= $${paramCount}`;
      queryParams.push(startDate);
    }

    if (endDate) {
      paramCount++;
      dateFilter += ` AND w.workout_date <= $${paramCount}`;
      queryParams.push(endDate);
    }

    const workoutsQuery = `
      SELECT 
        w.id,
        w.workout_date,
        w.workout_start_time,
        w.workout_duration_minutes,
        w.total_exercises,
        w.notes,
        w.created_at,
        af.original_filename,
        t.raw_text as transcription,
        COALESCE(
          json_agg(
            json_build_object(
              'id', e.id,
              'exercise_name', e.exercise_name,
              'exercise_type', e.exercise_type,
              'muscle_groups', e.muscle_groups,
              'sets', e.sets,
              'reps', e.reps,
              'weight_lbs', e.weight_lbs,
              'duration_minutes', e.duration_minutes,
              'distance_miles', e.distance_miles,
              'effort_level', e.effort_level,
              'rest_seconds', e.rest_seconds,
              'notes', e.notes,
              'order_in_workout', e.order_in_workout
            ) ORDER BY e.order_in_workout
          ) FILTER (WHERE e.id IS NOT NULL), 
          '[]'
        ) as exercises
      FROM workouts w
      JOIN audio_files af ON w.audio_file_id = af.id
      LEFT JOIN transcriptions t ON w.transcription_id = t.id
      LEFT JOIN exercises e ON w.id = e.workout_id
      WHERE w.user_id = $1 ${dateFilter}
      GROUP BY w.id, w.workout_date, w.workout_start_time, w.workout_duration_minutes, 
               w.total_exercises, w.notes, w.created_at, af.original_filename, t.raw_text
      ORDER BY w.workout_date DESC, w.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const workouts = await client.query(workoutsQuery, queryParams);

    const totalCountQuery = `
      SELECT COUNT(*) 
      FROM workouts w 
      WHERE w.user_id = $1 ${dateFilter}
    `;
    const totalCountParams = [userId];
    if (startDate) totalCountParams.push(startDate);
    if (endDate) totalCountParams.push(endDate);
    
    const totalCount = await client.query(totalCountQuery, totalCountParams);

    client.release();

    res.json({
      workouts: workouts.rows,
      pagination: {
        total: parseInt(totalCount.rows[0].count),
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < parseInt(totalCount.rows[0].count)
      }
    });

  } catch (error) {
    console.error('Get workouts error:', error);
    res.status(500).json({ error: 'Failed to retrieve workouts' });
  }
});

router.get('/:deviceUuid/progress', async (req, res) => {
  try {
    const { deviceUuid } = req.params;
    const { exercise, days = 30 } = req.query;

    const client = await pool.connect();

    const user = await client.query(
      'SELECT id FROM users WHERE device_uuid = $1',
      [deviceUuid]
    );

    if (user.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'User not found' });
    }

    const userId = user.rows[0].id;

    let progressQuery;
    let queryParams;

    if (exercise) {
      progressQuery = `
        SELECT 
          up.recorded_date,
          up.exercise_name,
          up.metric_type,
          up.metric_value,
          w.workout_date
        FROM user_progress up
        JOIN workouts w ON up.workout_id = w.id
        WHERE up.user_id = $1 
          AND up.exercise_name ILIKE $2
          AND up.recorded_date >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
        ORDER BY up.recorded_date DESC, up.created_at DESC
      `;
      queryParams = [userId, `%${exercise}%`];
    } else {
      progressQuery = `
        SELECT DISTINCT
          up.exercise_name,
          up.metric_type,
          MAX(up.metric_value) as max_value,
          MAX(up.recorded_date) as last_recorded,
          COUNT(*) as total_records
        FROM user_progress up
        WHERE up.user_id = $1 
          AND up.recorded_date >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
        GROUP BY up.exercise_name, up.metric_type
        ORDER BY last_recorded DESC
      `;
      queryParams = [userId];
    }

    const progress = await client.query(progressQuery, queryParams);

    const summaryQuery = `
      SELECT 
        COUNT(DISTINCT w.id) as total_workouts,
        COUNT(DISTINCT e.exercise_name) as unique_exercises,
        AVG(w.workout_duration_minutes) as avg_workout_duration,
        MAX(w.workout_date) as last_workout_date
      FROM workouts w
      LEFT JOIN exercises e ON w.id = e.workout_id
      WHERE w.user_id = $1 
        AND w.workout_date >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
    `;

    const summary = await client.query(summaryQuery, [userId]);

    client.release();

    res.json({
      progress: progress.rows,
      summary: summary.rows[0],
      period_days: parseInt(days),
      exercise_filter: exercise || null
    });

  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({ error: 'Failed to retrieve progress data' });
  }
});

router.get('/:deviceUuid/stats', async (req, res) => {
  try {
    const { deviceUuid } = req.params;

    const client = await pool.connect();

    const user = await client.query(
      'SELECT id, device_uuid, created_at, last_seen, total_workouts FROM users WHERE device_uuid = $1',
      [deviceUuid]
    );

    if (user.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'User not found' });
    }

    const userId = user.rows[0].id;

    const statsQuery = `
      SELECT 
        COUNT(DISTINCT w.id) as total_workouts,
        COUNT(DISTINCT af.id) as total_audio_files,
        COUNT(DISTINCT e.exercise_name) as unique_exercises,
        AVG(w.workout_duration_minutes) as avg_workout_duration,
        SUM(af.file_size) as total_audio_size_bytes,
        MIN(w.workout_date) as first_workout_date,
        MAX(w.workout_date) as last_workout_date
      FROM users u
      LEFT JOIN workouts w ON u.id = w.user_id
      LEFT JOIN audio_files af ON u.id = af.user_id
      LEFT JOIN exercises e ON w.id = e.workout_id
      WHERE u.id = $1
    `;

    const recentActivity = `
      SELECT 
        w.workout_date,
        w.total_exercises,
        w.workout_duration_minutes
      FROM workouts w
      WHERE w.user_id = $1
      ORDER BY w.workout_date DESC
      LIMIT 7
    `;

    const topExercises = `
      SELECT 
        e.exercise_name,
        COUNT(*) as frequency,
        AVG(e.effort_level) as avg_effort,
        MAX(CASE WHEN e.weight_lbs IS NOT NULL THEN e.weight_lbs[array_upper(e.weight_lbs, 1)] END) as max_weight
      FROM exercises e
      JOIN workouts w ON e.workout_id = w.id
      WHERE w.user_id = $1
      GROUP BY e.exercise_name
      ORDER BY frequency DESC
      LIMIT 10
    `;

    const [stats, recent, exercises] = await Promise.all([
      client.query(statsQuery, [userId]),
      client.query(recentActivity, [userId]),
      client.query(topExercises, [userId])
    ]);

    client.release();

    res.json({
      user: user.rows[0],
      stats: stats.rows[0],
      recent_activity: recent.rows,
      top_exercises: exercises.rows
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to retrieve user statistics' });
  }
});

// Cool charts endpoints
router.get('/:deviceUuid/charts/workout-trends', async (req, res) => {
  try {
    const { deviceUuid } = req.params;
    const { period = 'weekly', days = 90 } = req.query;

    const client = await pool.connect();
    const user = await client.query('SELECT id FROM users WHERE device_uuid = $1', [deviceUuid]);

    if (user.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'User not found' });
    }

    const userId = user.rows[0].id;

    let groupBy = period === 'monthly' ? 
      "date_trunc('month', w.workout_date)" : 
      "date_trunc('week', w.workout_date)";

    const trendsQuery = `
      SELECT 
        ${groupBy} as period,
        COUNT(*) as workout_count,
        AVG(w.workout_duration_minutes) as avg_duration,
        SUM(w.total_exercises) as total_exercises,
        AVG(af.duration_seconds / 60.0) as avg_audio_duration
      FROM workouts w
      JOIN audio_files af ON w.audio_file_id = af.id
      WHERE w.user_id = $1 
        AND w.workout_date >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
      GROUP BY ${groupBy}
      ORDER BY period DESC
      LIMIT 20
    `;

    const trends = await client.query(trendsQuery, [userId]);
    client.release();

    res.json({
      period: period,
      days: parseInt(days),
      trends: trends.rows
    });
  } catch (error) {
    console.error('Get workout trends error:', error);
    res.status(500).json({ error: 'Failed to retrieve workout trends' });
  }
});

router.get('/:deviceUuid/charts/muscle-groups', async (req, res) => {
  try {
    const { deviceUuid } = req.params;
    const { days = 30 } = req.query;

    const client = await pool.connect();
    const user = await client.query('SELECT id FROM users WHERE device_uuid = $1', [deviceUuid]);

    if (user.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'User not found' });
    }

    const userId = user.rows[0].id;

    const muscleGroupsQuery = `
      SELECT 
        unnest(e.muscle_groups) as muscle_group,
        COUNT(*) as exercise_count,
        COUNT(DISTINCT w.id) as workout_count,
        AVG(e.effort_level) as avg_effort
      FROM exercises e
      JOIN workouts w ON e.workout_id = w.id
      WHERE w.user_id = $1 
        AND w.workout_date >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
        AND e.muscle_groups IS NOT NULL 
        AND array_length(e.muscle_groups, 1) > 0
      GROUP BY muscle_group
      ORDER BY exercise_count DESC
    `;

    const muscleGroups = await client.query(muscleGroupsQuery, [userId]);
    client.release();

    res.json({
      days: parseInt(days),
      muscle_groups: muscleGroups.rows
    });
  } catch (error) {
    console.error('Get muscle groups error:', error);
    res.status(500).json({ error: 'Failed to retrieve muscle group data' });
  }
});

router.get('/:deviceUuid/charts/performance', async (req, res) => {
  try {
    const { deviceUuid } = req.params;
    const { exercise, metric = 'weight', days = 90 } = req.query;

    const client = await pool.connect();
    const user = await client.query('SELECT id FROM users WHERE device_uuid = $1', [deviceUuid]);

    if (user.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'User not found' });
    }

    const userId = user.rows[0].id;

    let performanceQuery;
    let queryParams;

    if (exercise) {
      // Specific exercise performance over time
      performanceQuery = `
        SELECT 
          w.workout_date,
          e.exercise_name,
          CASE 
            WHEN $3 = 'weight' AND e.weight_lbs IS NOT NULL THEN e.weight_lbs[array_upper(e.weight_lbs, 1)]
            WHEN $3 = 'reps' AND e.reps IS NOT NULL THEN e.reps[array_upper(e.reps, 1)]
            WHEN $3 = 'effort' THEN e.effort_level
            ELSE NULL
          END as metric_value,
          e.sets,
          e.effort_level
        FROM exercises e
        JOIN workouts w ON e.workout_id = w.id
        WHERE w.user_id = $1 
          AND e.exercise_name ILIKE $2
          AND w.workout_date >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
        ORDER BY w.workout_date ASC
      `;
      queryParams = [userId, `%${exercise}%`, metric];
    } else {
      // Top exercises performance summary
      performanceQuery = `
        SELECT DISTINCT
          e.exercise_name,
          COUNT(*) as frequency,
          AVG(e.effort_level) as avg_effort,
          MAX(CASE WHEN e.weight_lbs IS NOT NULL THEN e.weight_lbs[array_upper(e.weight_lbs, 1)] END) as max_weight,
          MAX(CASE WHEN e.reps IS NOT NULL THEN e.reps[array_upper(e.reps, 1)] END) as max_reps
        FROM exercises e
        JOIN workouts w ON e.workout_id = w.id
        WHERE w.user_id = $1 
          AND w.workout_date >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
        GROUP BY e.exercise_name
        ORDER BY frequency DESC
        LIMIT 10
      `;
      queryParams = [userId];
    }

    const performance = await client.query(performanceQuery, queryParams);
    client.release();

    res.json({
      exercise: exercise || null,
      metric: metric,
      days: parseInt(days),
      performance: performance.rows
    });
  } catch (error) {
    console.error('Get performance error:', error);
    res.status(500).json({ error: 'Failed to retrieve performance data' });
  }
});

// LLM Workout Summary endpoint
router.get('/:deviceUuid/llm-summary', async (req, res) => {
  try {
    const { deviceUuid } = req.params;
    const { days = 365 } = req.query; // Use 1 year default to capture data

    // Check if either API key is available
    if (!process.env.GOOGLE_API_KEY && !process.env.ANTHROPIC_API_KEY) {
      return res.status(400).json({ error: 'LLM service not configured' });
    }

    const client = await pool.connect();
    const user = await client.query('SELECT id FROM users WHERE device_uuid = $1', [deviceUuid]);

    if (user.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'User not found' });
    }

    const userId = user.rows[0].id;

    // Get comprehensive workout data for analysis
    const workoutSummary = await client.query(`
      SELECT 
        COUNT(DISTINCT w.id) as total_workouts,
        COUNT(DISTINCT e.exercise_name) as unique_exercises,
        AVG(w.workout_duration_minutes) as avg_duration,
        AVG(af.duration_seconds / 60.0) as avg_audio_duration,
        array_agg(DISTINCT e.exercise_name) FILTER (WHERE e.exercise_name IS NOT NULL) as all_exercises
      FROM workouts w
      JOIN audio_files af ON w.audio_file_id = af.id
      LEFT JOIN exercises e ON w.id = e.workout_id
      WHERE w.user_id = $1 
        AND w.workout_date >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
    `, [userId]);

    // Get muscle groups separately
    const muscleGroupQuery = await client.query(`
      SELECT DISTINCT unnest(e.muscle_groups) as muscle_group
      FROM exercises e
      JOIN workouts w ON e.workout_id = w.id
      WHERE w.user_id = $1 
        AND w.workout_date >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
        AND e.muscle_groups IS NOT NULL
    `, [userId]);

    const recentWorkouts = await client.query(`
      SELECT 
        w.workout_date,
        w.workout_duration_minutes,
        w.total_exercises,
        array_agg(
          json_build_object(
            'name', e.exercise_name,
            'type', e.exercise_type,
            'effort', e.effort_level,
            'sets', e.sets
          )
        ) as exercises
      FROM workouts w
      LEFT JOIN exercises e ON w.id = e.workout_id
      WHERE w.user_id = $1 
        AND w.workout_date >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
      GROUP BY w.id, w.workout_date, w.workout_duration_minutes, w.total_exercises
      ORDER BY w.workout_date DESC
      LIMIT 10
    `, [userId]);

    const progressData = await client.query(`
      SELECT 
        e.exercise_name,
        COUNT(*) as frequency,
        AVG(e.effort_level) as avg_effort,
        MAX(CASE WHEN e.weight_lbs IS NOT NULL THEN e.weight_lbs[array_upper(e.weight_lbs, 1)] END) as max_weight
      FROM exercises e
      JOIN workouts w ON e.workout_id = w.id
      WHERE w.user_id = $1 
        AND w.workout_date >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
      GROUP BY e.exercise_name
      ORDER BY frequency DESC
      LIMIT 5
    `, [userId]);

    client.release();

    const summary = workoutSummary.rows[0];
    if (!summary || summary.total_workouts == 0) {
      return res.json({
        summary: "No workout data available for the selected period. Start uploading your workout audio to get personalized insights!",
        days: parseInt(days)
      });
    }

    // Add muscle groups to summary
    summary.muscle_groups = muscleGroupQuery.rows.map(row => row.muscle_group);

    // Prepare data for Claude
    const promptData = {
      summary: summary,
      recent_workouts: recentWorkouts.rows,
      top_exercises: progressData.rows,
      period_days: parseInt(days)
    };

    // Try to call LLM API with auto-selection (Google first, then Anthropic)
    let summaryText = '';
    let llmProvider = 'none';

    const promptText = `As a fitness expert AI, analyze this user's workout data and provide personalized insights and recommendations. Be encouraging, specific, and actionable.

User's Workout Data (last ${parseInt(days)} days):
${JSON.stringify(promptData, null, 2)}

Please provide:
1. **Key Patterns**: What workout patterns do you notice?
2. **Strengths**: What is this person doing well?
3. **Opportunities**: Areas for improvement or growth
4. **Recommendations**: 2-3 specific, actionable suggestions
5. **Motivation**: Encouraging message about their progress

Format your response as a friendly, conversational summary that feels personal and motivating. Keep it concise but insightful.`;

    try {
      // Try Google Gemini first (free)
      if (process.env.GOOGLE_API_KEY) {
        console.log('Calling Google Gemini API for workout summary...');
        llmProvider = 'google';

        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.0-pro' });

        const result = await model.generateContent(promptText);
        const response = await result.response;
        summaryText = response.text();
        console.log('Google Gemini API call successful');

      } else if (process.env.ANTHROPIC_API_KEY) {
        console.log('Calling Anthropic Claude API for workout summary...');
        llmProvider = 'anthropic';

        const claudeResponse = await axios.post('https://api.anthropic.com/v1/messages', {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 800,
          temperature: 0.7,
          messages: [{
            role: 'user',
            content: promptText
          }]
        }, {
          headers: {
            'Authorization': `Bearer ${process.env.ANTHROPIC_API_KEY}`,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01'
          }
        });

        summaryText = claudeResponse.data.content[0].text;
        console.log('Anthropic Claude API call successful');
      }
      
    } catch (llmError) {
      console.error(`${llmProvider} API failed:`, llmError.response?.status, llmError.response?.data);
      
      // Provide a fallback summary based on the data
      summaryText = `**Workout Summary (${parseInt(days)} days)**

**Key Patterns**: You've completed ${summary.total_workouts} workouts with ${summary.unique_exercises} different exercises. ${summary.avg_duration ? `Your average workout duration is ${Math.round(summary.avg_duration)} minutes.` : ''}

**Strengths**: Great job staying consistent with your fitness routine! ${summary.total_workouts > 1 ? 'You\'ve built a solid workout habit.' : ''} ${summary.muscle_groups?.length > 3 ? `You're targeting ${summary.muscle_groups.length} different muscle groups, showing good variety.` : ''}

**Opportunities**: ${summary.total_workouts < 7 ? 'Consider increasing workout frequency for better results.' : ''} ${summary.unique_exercises < 5 ? 'Try adding more exercise variety to challenge different muscle groups.' : ''}

**Recommendations**: 
- Keep tracking your workouts consistently
- ${summary.avg_audio_duration ? `Your audio recordings average ${Math.round(summary.avg_audio_duration)} minutes - great detail!` : 'Consider adding more details about your workouts'}
- Focus on progressive overload by gradually increasing weights or reps

**Motivation**: Every workout counts! You're building healthy habits that will benefit you long-term. Keep up the excellent work! 💪

*Note: AI insights temporarily unavailable - this is a basic analysis of your workout data.*`;
    }

    res.json({
      summary: summaryText,
      days: parseInt(days),
      data_points: {
        total_workouts: summary.total_workouts,
        unique_exercises: summary.unique_exercises,
        avg_duration: Math.round(summary.avg_duration || 0),
        muscle_groups_targeted: summary.muscle_groups?.length || 0
      }
    });

  } catch (error) {
    console.error('LLM summary error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to generate workout summary',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;