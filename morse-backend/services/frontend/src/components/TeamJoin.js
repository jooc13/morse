import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  CircularProgress,
  Alert,
  Paper,
  Stack
} from '@mui/material';
import {
  Groups,
  PersonAdd,
  ArrowBack
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

function TeamJoin() {
  const { inviteCode } = useParams();
  const navigate = useNavigate();
  
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleJoinTeam = async () => {
    try {
      setLoading(true);
      setError('');
      
      const result = await api.joinTeam(inviteCode, displayName || null);
      
      setSuccess(`Successfully joined ${result.team.teamName}!`);
      
      // Redirect to the team page after a brief delay
      setTimeout(() => {
        navigate(`/teams/${result.team.teamId}`);
      }, 2000);
      
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to join team');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      bgcolor: 'grey.50',
      p: 2 
    }}>
      <Paper elevation={4} sx={{ p: 4, maxWidth: 500, width: '100%' }}>
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Groups sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
          <Typography variant="h4" gutterBottom>
            Join Team
          </Typography>
          <Typography variant="body1" color="text.secondary">
            You've been invited to join a team with invite code: 
            <strong> {inviteCode}</strong>
          </Typography>
        </Box>

        {/* Alerts */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
            <Typography variant="body2" sx={{ mt: 1 }}>
              Redirecting to team page...
            </Typography>
          </Alert>
        )}

        {/* Join Form */}
        {!success && (
          <Box>
            <TextField
              fullWidth
              label="Display Name (Optional)"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="How do you want to be identified in this team?"
              sx={{ mb: 3 }}
              helperText="Leave blank to use your user ID"
            />

            <Stack spacing={2}>
              <Button
                variant="contained"
                size="large"
                onClick={handleJoinTeam}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : <PersonAdd />}
                fullWidth
              >
                {loading ? 'Joining Team...' : 'Join Team'}
              </Button>
              
              <Button
                variant="outlined"
                startIcon={<ArrowBack />}
                onClick={() => navigate('/teams')}
                disabled={loading}
                fullWidth
              >
                Back to Teams
              </Button>
            </Stack>
          </Box>
        )}

        {/* Info Section */}
        <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
            Don't have an account? You'll need to register first before joining teams.
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}

export default TeamJoin;