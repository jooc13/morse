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
  Badge
} from '@mui/material';
import {
  Groups,
  Add,
  Link as LinkIcon,
  Settings,
  People,
  ArrowBack,
  ContentCopy,
  AdminPanelSettings,
  PersonAdd,
  Visibility,
  VisibilityOff,
  ExitToApp,
  FitnessCenter,
  TrendingUp,
  Share
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

function Teams() {
  const navigate = useNavigate();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState(0);

  // Dialog states
  const [createDialog, setCreateDialog] = useState(false);
  const [joinDialog, setJoinDialog] = useState(false);
  const [settingsDialog, setSettingsDialog] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);

  // Form states
  const [createForm, setCreateForm] = useState({
    teamName: '',
    teamDescription: '',
    allowPublicView: false
  });
  const [joinForm, setJoinForm] = useState({
    inviteCode: '',
    displayName: ''
  });

  useEffect(() => {
    loadTeams();
  }, []);

  const loadTeams = async () => {
    try {
      setLoading(true);
      const result = await api.getMyTeams();
      setTeams(result.teams || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load teams');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeam = async () => {
    try {
      if (!createForm.teamName.trim()) {
        setError('Team name is required');
        return;
      }

      await api.createTeam(createForm);
      setSuccess('Team created successfully!');
      setCreateDialog(false);
      setCreateForm({ teamName: '', teamDescription: '', allowPublicView: false });
      await loadTeams();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create team');
    }
  };

  const handleJoinTeam = async () => {
    try {
      if (!joinForm.inviteCode.trim()) {
        setError('Invite code is required');
        return;
      }

      await api.joinTeam(joinForm.inviteCode, joinForm.displayName || null);
      setSuccess('Joined team successfully!');
      setJoinDialog(false);
      setJoinForm({ inviteCode: '', displayName: '' });
      await loadTeams();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to join team');
    }
  };

  const handleUpdateTeamSettings = async (teamId, settings) => {
    try {
      await api.updateTeamSettings(teamId, settings);
      setSuccess('Team settings updated!');
      setSettingsDialog(false);
      await loadTeams();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update team settings');
    }
  };

  const handleLeaveTeam = async (teamId) => {
    if (!window.confirm('Are you sure you want to leave this team? This action cannot be undone.')) {
      return;
    }

    try {
      await api.leaveTeam(teamId);
      setSuccess('Left team successfully');
      await loadTeams();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to leave team');
    }
  };

  const copyInviteLink = (inviteCode) => {
    const inviteUrl = `${window.location.origin}/teams/join/${inviteCode}`;
    navigator.clipboard.writeText(inviteUrl);
    setSuccess('Invite link copied to clipboard!');
  };

  const TeamCard = ({ team }) => (
    <Card 
      sx={{ 
        mb: 2,
        '&:hover': { boxShadow: 4, transform: 'translateY(-1px)' },
        transition: 'all 0.2s ease-in-out',
        cursor: 'pointer'
      }}
      onClick={() => navigate(`/teams/${team.teamId}`)}
    >
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Groups color="primary" />
              {team.teamName}
              {team.role === 'admin' && (
                <Chip 
                  icon={<AdminPanelSettings />} 
                  label="Admin" 
                  size="small" 
                  color="secondary" 
                />
              )}
            </Typography>
            {team.teamDescription && (
              <Typography variant="body2" color="text.secondary">
                {team.teamDescription}
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Badge badgeContent={team.memberCount} color="primary">
              <People />
            </Badge>
            {team.allowPublicView ? (
              <Tooltip title="Public View Enabled">
                <Visibility color="success" />
              </Tooltip>
            ) : (
              <Tooltip title="Private Team">
                <VisibilityOff color="disabled" />
              </Tooltip>
            )}
          </Box>
        </Box>

        {/* Team Info */}
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <People sx={{ fontSize: 20, color: 'text.secondary' }} />
              <Box>
                <Typography variant="body2" color="text.secondary">Members</Typography>
                <Typography variant="h6">{team.memberCount}</Typography>
              </Box>
            </Box>
          </Grid>
          <Grid item xs={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Joined {new Date(team.joinedAt).toLocaleDateString()}
              </Typography>
            </Box>
          </Grid>
        </Grid>

        {/* Admin Controls */}
        {team.role === 'admin' && (
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                startIcon={<Share />}
                onClick={(e) => {
                  e.stopPropagation();
                  copyInviteLink(team.inviteCode);
                }}
              >
                Share Invite
              </Button>
              <Button
                size="small"
                startIcon={<Settings />}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedTeam(team);
                  setSettingsDialog(true);
                }}
              >
                Settings
              </Button>
            </Stack>
          </Box>
        )}

        {/* Display name if set */}
        {team.displayName && (
          <Box sx={{ mt: 1 }}>
            <Chip 
              label={`Display name: ${team.displayName}`} 
              size="small" 
              variant="outlined" 
            />
          </Box>
        )}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>Loading teams...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Navigation */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/dashboard')}
          sx={{ mr: 2 }}
        >
          Back to Dashboard
        </Button>
      </Box>

      {/* Header */}
      <Typography variant="h4" component="h1" gutterBottom>
        <Groups sx={{ mr: 1, verticalAlign: 'middle' }} />
        Teams
      </Typography>

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

      {/* Action Buttons */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setCreateDialog(true)}
        >
          Create Team
        </Button>
        <Button
          variant="outlined"
          startIcon={<PersonAdd />}
          onClick={() => setJoinDialog(true)}
        >
          Join Team
        </Button>
      </Box>

      {/* Teams List */}
      {teams.length === 0 ? (
        <Paper elevation={1} sx={{ p: 4, textAlign: 'center' }}>
          <Groups sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            No Teams Yet
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            Create a team to start collaborating or join an existing team with an invite code.
          </Typography>
          <Stack direction="row" spacing={2} justifyContent="center">
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setCreateDialog(true)}
            >
              Create Your First Team
            </Button>
            <Button
              variant="outlined"
              startIcon={<PersonAdd />}
              onClick={() => setJoinDialog(true)}
            >
              Join a Team
            </Button>
          </Stack>
        </Paper>
      ) : (
        <Box>
          <Typography variant="h6" gutterBottom>
            Your Teams ({teams.length})
          </Typography>
          {teams.map((team) => (
            <TeamCard key={team.teamId} team={team} />
          ))}
        </Box>
      )}

      {/* Create Team Dialog */}
      <Dialog open={createDialog} onClose={() => setCreateDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Team</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Team Name"
              value={createForm.teamName}
              onChange={(e) => setCreateForm({ ...createForm, teamName: e.target.value })}
              sx={{ mb: 2 }}
              required
            />
            <TextField
              fullWidth
              label="Team Description"
              multiline
              rows={3}
              value={createForm.teamDescription}
              onChange={(e) => setCreateForm({ ...createForm, teamDescription: e.target.value })}
              sx={{ mb: 2 }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={createForm.allowPublicView}
                  onChange={(e) => setCreateForm({ ...createForm, allowPublicView: e.target.checked })}
                />
              }
              label="Allow all members to see everyone's workouts"
            />
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
              If disabled, only you (as admin) will be able to see all members' workouts. 
              Members will only see their own workouts.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialog(false)}>Cancel</Button>
          <Button onClick={handleCreateTeam} variant="contained">Create Team</Button>
        </DialogActions>
      </Dialog>

      {/* Join Team Dialog */}
      <Dialog open={joinDialog} onClose={() => setJoinDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Join Team</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Invite Code"
              value={joinForm.inviteCode}
              onChange={(e) => setJoinForm({ ...joinForm, inviteCode: e.target.value.toUpperCase() })}
              sx={{ mb: 2 }}
              required
              inputProps={{ maxLength: 8 }}
              helperText="Enter the 8-character invite code"
            />
            <TextField
              fullWidth
              label="Display Name (Optional)"
              value={joinForm.displayName}
              onChange={(e) => setJoinForm({ ...joinForm, displayName: e.target.value })}
              helperText="How you want to be identified in this team. Leave blank to use your user ID."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setJoinDialog(false)}>Cancel</Button>
          <Button onClick={handleJoinTeam} variant="contained">Join Team</Button>
        </DialogActions>
      </Dialog>

      {/* Team Settings Dialog */}
      <Dialog 
        open={settingsDialog} 
        onClose={() => setSettingsDialog(false)} 
        maxWidth="sm" 
        fullWidth
      >
        <DialogTitle>Team Settings</DialogTitle>
        <DialogContent>
          {selectedTeam && (
            <Box sx={{ pt: 1 }}>
              <TextField
                fullWidth
                label="Team Name"
                defaultValue={selectedTeam.teamName}
                sx={{ mb: 2 }}
                id="settings-team-name"
              />
              <TextField
                fullWidth
                label="Team Description"
                multiline
                rows={3}
                defaultValue={selectedTeam.teamDescription}
                sx={{ mb: 2 }}
                id="settings-team-description"
              />
              <FormControlLabel
                control={
                  <Switch
                    defaultChecked={selectedTeam.allowPublicView}
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
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsDialog(false)}>Cancel</Button>
          <Button 
            onClick={() => {
              const teamName = document.getElementById('settings-team-name').value;
              const teamDescription = document.getElementById('settings-team-description').value;
              const allowPublicView = document.getElementById('settings-public-view').checked;
              
              handleUpdateTeamSettings(selectedTeam.teamId, {
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
    </Box>
  );
}

export default Teams;