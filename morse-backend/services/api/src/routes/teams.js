const express = require('express');
const { Pool } = require('pg');
const { authenticateToken } = require('./auth');
const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/morse_db',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Create a new team
router.post('/create', authenticateToken, async (req, res) => {
  try {
    const { teamName, teamDescription, allowPublicView = false } = req.body;
    
    if (!teamName || teamName.trim().length === 0) {
      return res.status(400).json({ error: 'Team name is required' });
    }

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Create the team
      const teamResult = await client.query(
        `INSERT INTO teams (team_name, team_description, creator_user_id, allow_public_view) 
         VALUES ($1, $2, $3, $4) RETURNING team_id, invite_code`,
        [teamName.trim(), teamDescription?.trim() || null, req.user.id, allowPublicView]
      );
      
      const team = teamResult.rows[0];
      
      // Add creator as admin member
      await client.query(
        `INSERT INTO team_memberships (team_id, user_id, role) 
         VALUES ($1, $2, 'admin')`,
        [team.team_id, req.user.id]
      );
      
      await client.query('COMMIT');
      
      res.json({
        success: true,
        team: {
          teamId: team.team_id,
          teamName,
          teamDescription,
          inviteCode: team.invite_code,
          allowPublicView,
          role: 'admin'
        }
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error creating team:', error);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

// Join team via invite code
router.post('/join/:inviteCode', authenticateToken, async (req, res) => {
  try {
    const { inviteCode } = req.params;
    const { displayName } = req.body; // Optional display name for this team
    
    if (!inviteCode || inviteCode.length !== 8) {
      return res.status(400).json({ error: 'Invalid invite code' });
    }

    const client = await pool.connect();
    
    try {
      // Check if team exists
      const teamResult = await client.query(
        'SELECT team_id, team_name, team_description, allow_public_view FROM teams WHERE invite_code = $1',
        [inviteCode.toUpperCase()]
      );
      
      if (teamResult.rows.length === 0) {
        return res.status(404).json({ error: 'Invalid invite code' });
      }
      
      const team = teamResult.rows[0];
      
      // Check if user is already a member
      const membershipResult = await client.query(
        'SELECT membership_id FROM team_memberships WHERE team_id = $1 AND user_id = $2',
        [team.team_id, req.user.id]
      );
      
      if (membershipResult.rows.length > 0) {
        return res.status(400).json({ error: 'You are already a member of this team' });
      }
      
      // Add user to team
      await client.query(
        `INSERT INTO team_memberships (team_id, user_id, display_name, role) 
         VALUES ($1, $2, $3, 'member')`,
        [team.team_id, req.user.id, displayName?.trim() || null]
      );
      
      res.json({
        success: true,
        team: {
          teamId: team.team_id,
          teamName: team.team_name,
          teamDescription: team.team_description,
          allowPublicView: team.allow_public_view,
          role: 'member',
          displayName: displayName?.trim() || null
        }
      });
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error joining team:', error);
    res.status(500).json({ error: 'Failed to join team' });
  }
});

// Get user's teams
router.get('/my-teams', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        t.team_id,
        t.team_name,
        t.team_description,
        t.allow_public_view,
        t.created_at,
        tm.role,
        tm.display_name,
        tm.joined_at,
        t.invite_code,
        (SELECT COUNT(*) FROM team_memberships WHERE team_id = t.team_id) as member_count
      FROM teams t
      JOIN team_memberships tm ON t.team_id = tm.team_id
      WHERE tm.user_id = $1
      ORDER BY tm.joined_at DESC`,
      [req.user.id]
    );
    
    res.json({
      success: true,
      teams: result.rows.map(row => ({
        teamId: row.team_id,
        teamName: row.team_name,
        teamDescription: row.team_description,
        allowPublicView: row.allow_public_view,
        createdAt: row.created_at,
        role: row.role,
        displayName: row.display_name,
        joinedAt: row.joined_at,
        inviteCode: row.role === 'admin' ? row.invite_code : undefined,
        memberCount: parseInt(row.member_count)
      }))
    });
    
  } catch (error) {
    console.error('Error fetching user teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// Get team details (for members)
router.get('/:teamId', authenticateToken, async (req, res) => {
  try {
    const { teamId } = req.params;
    
    // Check if user is a member of this team
    const membershipResult = await pool.query(
      `SELECT tm.role, tm.display_name, t.team_name, t.team_description, t.allow_public_view, t.invite_code, t.created_at
       FROM team_memberships tm
       JOIN teams t ON tm.team_id = t.team_id
       WHERE tm.team_id = $1 AND tm.user_id = $2`,
      [teamId, req.user.id]
    );
    
    if (membershipResult.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const membership = membershipResult.rows[0];
    
    res.json({
      success: true,
      team: {
        teamId: parseInt(teamId),
        teamName: membership.team_name,
        teamDescription: membership.team_description,
        allowPublicView: membership.allow_public_view,
        createdAt: membership.created_at,
        userRole: membership.role,
        userDisplayName: membership.display_name,
        inviteCode: membership.role === 'admin' ? membership.invite_code : undefined
      }
    });
    
  } catch (error) {
    console.error('Error fetching team details:', error);
    res.status(500).json({ error: 'Failed to fetch team details' });
  }
});

// Get team members and their workouts
router.get('/:teamId/members', authenticateToken, async (req, res) => {
  try {
    const { teamId } = req.params;
    
    // Check if user is a member of this team
    const membershipResult = await pool.query(
      `SELECT tm.role, t.allow_public_view
       FROM team_memberships tm
       JOIN teams t ON tm.team_id = t.team_id
       WHERE tm.team_id = $1 AND tm.user_id = $2`,
      [teamId, req.user.id]
    );
    
    if (membershipResult.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const { role, allow_public_view } = membershipResult.rows[0];
    const isAdmin = role === 'admin';
    
    // Determine what data to show based on permissions
    let membersQuery;
    let membersParams;
    
    if (isAdmin) {
      // Admin can see everything
      membersQuery = `
        SELECT 
          tm.user_id,
          tm.display_name,
          tm.role,
          tm.joined_at,
          COUNT(DISTINCT wc.workout_id) as total_workouts,
          COUNT(DISTINCT CASE WHEN w.workout_date >= CURRENT_DATE - INTERVAL '7 days' THEN wc.workout_id END) as workouts_this_week,
          MAX(w.workout_date) as last_workout_date
        FROM team_memberships tm
        LEFT JOIN workout_claims wc ON tm.user_id = wc.user_id
        LEFT JOIN workouts w ON wc.workout_id = w.id
        WHERE tm.team_id = $1
        GROUP BY tm.user_id, tm.display_name, tm.role, tm.joined_at
        ORDER BY tm.role DESC, tm.joined_at ASC`;
      membersParams = [teamId];
    } else if (allow_public_view) {
      // Public view enabled - members can see everyone
      membersQuery = `
        SELECT 
          tm.user_id,
          tm.display_name,
          tm.role,
          tm.joined_at,
          COUNT(DISTINCT wc.workout_id) as total_workouts,
          COUNT(DISTINCT CASE WHEN w.workout_date >= CURRENT_DATE - INTERVAL '7 days' THEN wc.workout_id END) as workouts_this_week,
          MAX(w.workout_date) as last_workout_date
        FROM team_memberships tm
        LEFT JOIN workout_claims wc ON tm.user_id = wc.user_id
        LEFT JOIN workouts w ON wc.workout_id = w.id
        WHERE tm.team_id = $1
        GROUP BY tm.user_id, tm.display_name, tm.role, tm.joined_at
        ORDER BY tm.role DESC, tm.joined_at ASC`;
      membersParams = [teamId];
    } else {
      // Private view - only show current user
      membersQuery = `
        SELECT 
          tm.user_id,
          tm.display_name,
          tm.role,
          tm.joined_at,
          COUNT(DISTINCT wc.workout_id) as total_workouts,
          COUNT(DISTINCT CASE WHEN w.workout_date >= CURRENT_DATE - INTERVAL '7 days' THEN wc.workout_id END) as workouts_this_week,
          MAX(w.workout_date) as last_workout_date
        FROM team_memberships tm
        LEFT JOIN workout_claims wc ON tm.user_id = wc.user_id
        LEFT JOIN workouts w ON wc.workout_id = w.id
        WHERE tm.team_id = $1 AND tm.user_id = $2
        GROUP BY tm.user_id, tm.display_name, tm.role, tm.joined_at
        ORDER BY tm.role DESC, tm.joined_at ASC`;
      membersParams = [teamId, req.user.id];
    }
    
    const membersResult = await pool.query(membersQuery, membersParams);
    
    res.json({
      success: true,
      members: membersResult.rows.map(row => ({
        userId: row.user_id,
        displayName: row.display_name || `User ${row.user_id.substr(-8)}`,
        role: row.role,
        joinedAt: row.joined_at,
        totalWorkouts: parseInt(row.total_workouts) || 0,
        workoutsThisWeek: parseInt(row.workouts_this_week) || 0,
        lastWorkoutDate: row.last_workout_date,
        isCurrentUser: row.user_id === req.user.id
      })),
      viewPermissions: {
        canSeeAll: isAdmin || allow_public_view,
        isAdmin,
        allowPublicView: allow_public_view
      }
    });
    
  } catch (error) {
    console.error('Error fetching team members:', error);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

// Update team settings (admin only)
router.put('/:teamId/settings', authenticateToken, async (req, res) => {
  try {
    const { teamId } = req.params;
    const { teamName, teamDescription, allowPublicView } = req.body;
    
    // Check if user is admin of this team
    const adminCheck = await pool.query(
      'SELECT role FROM team_memberships WHERE team_id = $1 AND user_id = $2 AND role = $3',
      [teamId, req.user.id, 'admin']
    );
    
    if (adminCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    // Update team settings
    await pool.query(
      `UPDATE teams 
       SET team_name = $1, team_description = $2, allow_public_view = $3, updated_at = CURRENT_TIMESTAMP
       WHERE team_id = $4`,
      [teamName?.trim(), teamDescription?.trim() || null, allowPublicView, teamId]
    );
    
    res.json({ success: true, message: 'Team settings updated' });
    
  } catch (error) {
    console.error('Error updating team settings:', error);
    res.status(500).json({ error: 'Failed to update team settings' });
  }
});

// Update user's display name in team
router.put('/:teamId/my-display-name', authenticateToken, async (req, res) => {
  try {
    const { teamId } = req.params;
    const { displayName } = req.body;
    
    // Update display name
    await pool.query(
      'UPDATE team_memberships SET display_name = $1 WHERE team_id = $2 AND user_id = $3',
      [displayName?.trim() || null, teamId, req.user.id]
    );
    
    res.json({ success: true, message: 'Display name updated' });
    
  } catch (error) {
    console.error('Error updating display name:', error);
    res.status(500).json({ error: 'Failed to update display name' });
  }
});

// Leave team
router.delete('/:teamId/leave', authenticateToken, async (req, res) => {
  try {
    const { teamId } = req.params;
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check if user is the only admin
      const adminCheck = await client.query(
        `SELECT COUNT(*) as admin_count, 
         SUM(CASE WHEN user_id = $2 THEN 1 ELSE 0 END) as is_current_user_admin
         FROM team_memberships 
         WHERE team_id = $1 AND role = 'admin'`,
        [teamId, req.user.id]
      );
      
      const { admin_count, is_current_user_admin } = adminCheck.rows[0];
      
      if (parseInt(admin_count) === 1 && parseInt(is_current_user_admin) === 1) {
        // User is the only admin - delete the entire team
        await client.query('DELETE FROM teams WHERE team_id = $1', [teamId]);
      } else {
        // Just remove the user from the team
        await client.query(
          'DELETE FROM team_memberships WHERE team_id = $1 AND user_id = $2',
          [teamId, req.user.id]
        );
      }
      
      await client.query('COMMIT');
      
      res.json({ success: true, message: 'Left team successfully' });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error leaving team:', error);
    res.status(500).json({ error: 'Failed to leave team' });
  }
});

module.exports = router;