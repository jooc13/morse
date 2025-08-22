import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  FormControlLabel,
  Tabs,
  Tab,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Divider,
  Paper,
  Stack,
  Tooltip,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  Groups,
  ArrowBack,
  People,
  Settings,
  Share,
  ContentCopy,
  AdminPanelSettings,
  ExitToApp,
  FitnessCenter,
  TrendingUp,
  Visibility,
  VisibilityOff,
  Edit,
  Timeline,
  CalendarToday,
  MonitorWeight,
  EmojiEvents,
  Star,
  Person
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

function TeamView() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  
  const [team, setTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [viewPermissions, setViewPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  
  // Dialog states
  const [settingsDialog, setSettingsDialog] = useState(false);
  const [displayNameDialog, setDisplayNameDialog] = useState(false);
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    loadTeamData();
  }, [teamId]);

  const loadTeamData = async () => {
    try {
      setLoading(true);
      const [teamResult, membersResult] = await Promise.all([
        api.getTeamDetails(teamId),
        api.getTeamMembers(teamId)
      ]);
      
      setTeam(teamResult.team);
      setMembers(membersResult.members || []);
      setViewPermissions(membersResult.viewPermissions || {});
      setDisplayName(teamResult.team.userDisplayName || '');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load team data');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateDisplayName = async () => {
    try {
      await api.updateMyDisplayName(teamId, displayName);
      setSuccess('Display name updated!');
      setDisplayNameDialog(false);
      await loadTeamData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update display name');
    }
  };

  const handleUpdateTeamSettings = async (settings) => {
    try {
      await api.updateTeamSettings(teamId, settings);
      setSuccess('Team settings updated!');
      setSettingsDialog(false);
      await loadTeamData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update team settings');
    }
  };

  const handleLeaveTeam = async () => {
    if (!window.confirm('Are you sure you want to leave this team? This action cannot be undone.')) {
      return;
    }

    try {
      await api.leaveTeam(teamId);
      setSuccess('Left team successfully');
      navigate('/teams');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to leave team');
    }
  };

  const copyInviteLink = () => {
    const inviteUrl = `${window.location.origin}/teams/join/${team.inviteCode}`;
    navigator.clipboard.writeText(inviteUrl);
    setSuccess('Invite link copied to clipboard!');
  };

  const formatWorkoutDisplay = (member) => {
    if (member.totalWorkouts === 0) {
      return 'No workouts recorded';
    }
    
    const parts = [];
    parts.push(`${member.totalWorkouts} total workout${member.totalWorkouts === 1 ? '' : 's'}`);
    
    if (member.workoutsThisWeek > 0) {
      parts.push(`${member.workoutsThisWeek} this week`);
    }
    
    if (member.lastWorkoutDate) {
      const lastWorkout = new Date(member.lastWorkoutDate);
      const now = new Date();
      const daysDiff = Math.floor((now - lastWorkout) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === 0) {
        parts.push('last workout today');
      } else if (daysDiff === 1) {
        parts.push('last workout yesterday');
      } else if (daysDiff <= 7) {
        parts.push(`last workout ${daysDiff} days ago`);
      } else {
        parts.push(`last workout ${lastWorkout.toLocaleDateString()}`);
      }
    }
    
    return parts.join(' • ');
  };

  const getPerformanceChip = (member) => {
    const { workoutsThisWeek, totalWorkouts } = member;
    
    if (workoutsThisWeek >= 4) {
      return <Chip icon={<Star />} label="On Fire!" color="warning" size="small" />;
    } else if (workoutsThisWeek >= 2) {
      return <Chip icon={<TrendingUp />} label="Consistent" color="success" size="small" />;
    } else if (totalWorkouts > 10 && workoutsThisWeek === 0) {
      return <Chip label="Needs Motivation" color="error" size="small" />;
    } else if (totalWorkouts > 0) {
      return <Chip label="Getting Started" color="info" size="small" />;
    } else {
      return <Chip label="New Member" color="default" size="small" />;
    }
  };

  const MemberCard = ({ member }) => (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
            {member.isCurrentUser ? <Person /> : <FitnessCenter />}
          </Avatar>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {member.displayName}
              {member.isCurrentUser && (
                <Chip label="You" size="small" color="primary" />
              )}
              {member.role === 'admin' && (
                <Chip icon={<AdminPanelSettings />} label="Admin" size="small" color="secondary" />
              )}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Joined {new Date(member.joinedAt).toLocaleDateString()}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {getPerformanceChip(member)}
          </Box>
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={12} md={8}>
            <Typography variant="body2" color="text.secondary">
              {formatWorkoutDisplay(member)}
            </Typography>
          </Grid>
          <Grid item xs={12} md={4}>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              <Chip 
                icon={<FitnessCenter />} 
                label={member.totalWorkouts} 
                size="small" 
                variant="outlined" 
              />
              {member.workoutsThisWeek > 0 && (
                <Chip 
                  icon={<Timeline />} 
                  label={`${member.workoutsThisWeek} this week`} 
                  size="small" 
                  color="primary" 
                  variant="outlined" 
                />
              )}
            </Stack>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>Loading team...</Typography>
      </Box>
    );
  }

  if (!team) {
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => navigate('/teams')}
            sx={{ mr: 2 }}
          >
            Back to Teams
          </Button>
        </Box>
        <Alert severity="error">Team not found</Alert>
      </Box>
    );
  }

  return (
    <Box>
      {/* Navigation */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/teams')}
          sx={{ mr: 2 }}
        >
          Back to Teams
        </Button>
      </Box>

      {/* Alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* Team Header */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box>
              <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Groups color="primary" />
                {team.teamName}
                {team.userRole === 'admin' && (
                  <Chip icon={<AdminPanelSettings />} label="Admin" color="secondary" />
                )}
              </Typography>
              {team.teamDescription && (
                <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                  {team.teamDescription}
                </Typography>
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {team.allowPublicView ? (
                <Tooltip title="All members can see everyone's workouts">
                  <Visibility color="success" />
                </Tooltip>
              ) : (
                <Tooltip title="Only admins can see all workouts">
                  <VisibilityOff color="disabled" />
                </Tooltip>
              )}
            </Box>
          </Box>

          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={6} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="primary">
                  {members.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Members
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="secondary">
                  {members.reduce((sum, m) => sum + m.totalWorkouts, 0)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Workouts
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="success.main">
                  {members.reduce((sum, m) => sum + m.workoutsThisWeek, 0)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  This Week
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" sx={{ color: '#ffd700' }}>
                  {members.filter(m => m.workoutsThisWeek >= 3).length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Active Members
                </Typography>
              </Box>
            </Grid>
          </Grid>

          {/* Action Buttons */}
          <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
            <Button
              startIcon={<Edit />}
              onClick={() => setDisplayNameDialog(true)}
              variant="outlined"
              size="small"
            >
              Edit Display Name
            </Button>
            {team.userRole === 'admin' && (
              <>
                <Button
                  startIcon={<Share />}
                  onClick={copyInviteLink}
                  variant="outlined"
                  size="small"
                >
                  Share Invite
                </Button>
                <Button
                  startIcon={<Settings />}
                  onClick={() => setSettingsDialog(true)}
                  variant="outlined"
                  size="small"
                >
                  Settings
                </Button>
              </>
            )}
            <Button
              startIcon={<ExitToApp />}
              onClick={handleLeaveTeam}
              color="error"
              variant="outlined"
              size="small"
            >
              Leave Team
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Team Content */}
      <Box sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab icon={<People />} label="Members" />
          <Tab icon={<FitnessCenter />} label="Workouts" disabled />
          <Tab icon={<TrendingUp />} label="Progress" disabled />
        </Tabs>
      </Box>

      {/* Members Tab */}
      {activeTab === 0 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6">
              Team Members ({members.length})
            </Typography>
            {!viewPermissions.canSeeAll && (
              <Alert severity="info" sx={{ flexGrow: 1, ml: 2 }}>
                Private team - only showing your own data
              </Alert>
            )}
          </Box>

          {members.length === 0 ? (
            <Paper elevation={1} sx={{ p: 4, textAlign: 'center' }}>
              <People sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                No Members Found
              </Typography>
            </Paper>
          ) : (
            <Box>
              {members.map((member) => (
                <MemberCard key={member.userId} member={member} />
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* Display Name Dialog */}
      <Dialog open={displayNameDialog} onClose={() => setDisplayNameDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Display Name</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Display Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              helperText="How you want to be identified in this team. Leave blank to use your user ID."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDisplayNameDialog(false)}>Cancel</Button>
          <Button onClick={handleUpdateDisplayName} variant="contained">Update</Button>
        </DialogActions>
      </Dialog>

      {/* Settings Dialog (Admin Only) */}
      {team.userRole === 'admin' && (
        <Dialog open={settingsDialog} onClose={() => setSettingsDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Team Settings</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 1 }}>
              <TextField
                fullWidth
                label="Team Name"
                defaultValue={team.teamName}
                sx={{ mb: 2 }}
                id="settings-team-name"
              />
              <TextField
                fullWidth
                label="Team Description"
                multiline
                rows={3}
                defaultValue={team.teamDescription}
                sx={{ mb: 2 }}
                id="settings-team-description"
              />
              <FormControlLabel
                control={
                  <Switch
                    defaultChecked={team.allowPublicView}
                    id="settings-public-view"
                  />
                }
                label="Allow all members to see everyone's workouts"
              />
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                When enabled, all team members can see each other's workouts. 
                When disabled, only you can see all workouts.
              </Typography>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSettingsDialog(false)}>Cancel</Button>
            <Button 
              onClick={() => {
                const teamName = document.getElementById('settings-team-name').value;
                const teamDescription = document.getElementById('settings-team-description').value;
                const allowPublicView = document.getElementById('settings-public-view').checked;
                
                handleUpdateTeamSettings({
                  teamName,
                  teamDescription,
                  allowPublicView
                });
              }}
              variant="contained"
            >
              Update Settings
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}

export default TeamView;