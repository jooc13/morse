import React, { useState, useEffect } from 'react';
import { 
  Paper, 
  Typography, 
  Box, 
  Alert, 
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { Assignment, CheckCircle, Schedule, ArrowBack } from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

function WorkoutClaiming({ onProfileUpdate }) {
  const { deviceUuid } = useParams();
  const navigate = useNavigate();
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmDialog, setConfirmDialog] = useState({ open: false, workout: null });

  useEffect(() => {
    loadUnclaimedWorkouts();
  }, [deviceUuid]);

  const loadUnclaimedWorkouts = async () => {
    try {
      setLoading(true);
      const result = await api.getUnclaimedWorkouts(deviceUuid);
      setWorkouts(result.unclaimed_workouts);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load workouts');
    } finally {
      setLoading(false);
    }
  };

  const handleClaimWorkout = (workout) => {
    setConfirmDialog({ open: true, workout });
  };

  const confirmClaim = async () => {
    const workout = confirmDialog.workout;
    setConfirmDialog({ open: false, workout: null });
    
    if (!workout) return;

    try {
      setClaiming(workout.workout_id);
      setError('');
      setSuccess('');

      await api.claimWorkout(workout.workout_id);
      
      setSuccess(`Successfully claimed workout from ${formatDate(workout.workout_date)}`);
      
      // Remove claimed workout from list
      setWorkouts(prev => prev.filter(w => w.workout_id !== workout.workout_id));
      
      // Update user profile
      if (onProfileUpdate) {
        onProfileUpdate();
      }

    } catch (err) {
      setError(err.response?.data?.error || 'Failed to claim workout');
    } finally {
      setClaiming(null);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString();
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/devices')}
          sx={{ mr: 2 }}
        >
          Back to Device Search
        </Button>
      </Box>
      
      <Typography variant="h4" component="h1" gutterBottom>
        <Assignment sx={{ mr: 1, verticalAlign: 'middle' }} />
        Claim Workouts
      </Typography>

      <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
        Device: ...{deviceUuid.slice(-8)}
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Review and claim workouts from this device. Once claimed, you'll create a voice profile for automatic linking of future workouts.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Paper elevation={3} sx={{ p: 3 }}>
        {workouts.length === 0 ? (
          <Alert severity="info">
            No unclaimed workouts available for this device.
            <Button 
              variant="text" 
              onClick={() => navigate('/search')} 
              sx={{ ml: 2 }}
            >
              Search Other Devices
            </Button>
          </Alert>
        ) : (
          <>
            <Typography variant="h6" gutterBottom>
              Available Workouts ({workouts.length})
            </Typography>
            
            <List>
              {workouts.map((workout, index) => (
                <ListItem key={workout.workout_id} divider={index < workouts.length - 1}>
                  <ListItemText
                    primary={
                      <Box>
                        <Typography variant="subtitle1">
                          Workout - {formatDate(workout.workout_date)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Recorded: {formatTime(workout.created_at)}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Box sx={{ mt: 1 }}>
                        <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                          {workout.total_exercises > 0 && (
                            <Chip 
                              label={`${workout.total_exercises} exercises`} 
                              size="small" 
                              color="primary"
                            />
                          )}
                          {workout.duration_minutes && (
                            <Chip 
                              label={`${workout.duration_minutes} min`} 
                              size="small" 
                              color="secondary"
                            />
                          )}
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          Audio: {workout.audio_filename}
                        </Typography>
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Button
                      variant="contained"
                      onClick={() => handleClaimWorkout(workout)}
                      disabled={claiming === workout.workout_id}
                      startIcon={
                        claiming === workout.workout_id ? 
                        <CircularProgress size={20} /> : 
                        <CheckCircle />
                      }
                    >
                      {claiming === workout.workout_id ? 'Claiming...' : 'Claim'}
                    </Button>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </>
        )}
      </Paper>

      {/* Confirmation Dialog */}
      <Dialog 
        open={confirmDialog.open} 
        onClose={() => setConfirmDialog({ open: false, workout: null })}
      >
        <DialogTitle>Confirm Workout Claim</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to claim this workout from {confirmDialog.workout && formatDate(confirmDialog.workout.workout_date)}?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            This will create a voice profile from this audio for automatic linking of future workouts.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ open: false, workout: null })}>
            Cancel
          </Button>
          <Button onClick={confirmClaim} variant="contained">
            Claim Workout
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default WorkoutClaiming;