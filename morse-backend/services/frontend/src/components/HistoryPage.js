import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Stack
} from '@mui/material';
import {
  Add,
  FitnessCenter
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import WorkoutCard from './WorkoutCard';

const HistoryPage = ({ user }) => {
  const navigate = useNavigate();
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadWorkouts();
  }, []);

  const loadWorkouts = async () => {
    try {
      setLoading(true);
      setError('');
      const result = await api.getClaimedWorkouts({ limit: 200 });
      const workoutsData = result.workouts || [];
      
      // Sort by date, most recent first
      const sortedWorkouts = workoutsData.sort((a, b) => {
        const dateA = new Date(`${a.workout_date}T${a.workout_start_time || '00:00'}`);
        const dateB = new Date(`${b.workout_date}T${b.workout_start_time || '00:00'}`);
        return dateB - dateA;
      });
      
      setWorkouts(sortedWorkouts);
    } catch (err) {
      console.error('Failed to load workouts:', err);
      // If it's an auth error and we're in dev mode, just show empty state
      if (err.response?.status === 401 || err.response?.status === 403) {
        setWorkouts([]);
        setError('');
      } else {
        setError(err.response?.data?.error || 'Failed to load workouts');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button variant="contained" onClick={loadWorkouts}>
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
            Workout History
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {workouts.length} {workouts.length === 1 ? 'workout' : 'workouts'} recorded
          </Typography>
        </Box>
        
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => navigate('/upload-test')}
          sx={{
            backgroundColor: '#1976d2',
            '&:hover': {
              backgroundColor: '#1565c0',
            },
          }}
        >
          Log New Workout
        </Button>
      </Box>

      {/* Workout List */}
      {workouts.length === 0 ? (
        <Box
          sx={{
            textAlign: 'center',
            py: 8,
            px: 3,
            border: '2px dashed rgba(0,0,0,0.12)',
            borderRadius: 2,
            backgroundColor: 'rgba(0,0,0,0.02)',
          }}
        >
          <FitnessCenter
            sx={{
              fontSize: 64,
              color: 'rgba(0,0,0,0.2)',
              mb: 2,
            }}
          />
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
            No workouts yet
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 400, mx: 'auto' }}>
            Start tracking your fitness journey by logging your first workout. Upload an audio recording or manually enter your exercises.
          </Typography>
          <Button
            variant="contained"
            size="large"
            startIcon={<Add />}
            onClick={() => navigate('/upload-test')}
            sx={{
              backgroundColor: '#1976d2',
              '&:hover': {
                backgroundColor: '#1565c0',
              },
            }}
          >
            Log Your First Workout
          </Button>
        </Box>
      ) : (
        <Stack spacing={3}>
          {workouts.map((workout, index) => {
            // Group workouts by date - add date header if this is a new date
            const workoutDate = new Date(workout.workout_date);
            const prevWorkoutDate = index > 0 ? new Date(workouts[index - 1].workout_date) : null;
            const isNewDate = !prevWorkoutDate || 
              workoutDate.toDateString() !== prevWorkoutDate.toDateString();
            
            const dateStr = workoutDate.toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            });
            
            return (
              <Box key={workout.id || workout.workout_id}>
                {isNewDate && (
                  <Box sx={{ mb: 2, mt: index > 0 ? 4 : 0 }}>
                    <Typography 
                      variant="h6" 
                      sx={{ 
                        fontWeight: 600,
                        color: '#1976d2',
                        borderBottom: '2px solid #1976d2',
                        pb: 1,
                        mb: 2
                      }}
                    >
                      {dateStr}
                    </Typography>
                  </Box>
                )}
                <WorkoutCard
                  workout={workout}
                  onClick={() => {
                    console.log('Workout clicked:', workout);
                  }}
                  onDelete={async (workoutId) => {
                    try {
                      await api.deleteWorkout(workoutId);
                      // Reload workouts after deletion
                      loadWorkouts();
                    } catch (err) {
                      console.error('Failed to delete workout:', err);
                      alert(err.response?.data?.error || 'Failed to delete workout');
                    }
                  }}
                />
              </Box>
            );
          })}
        </Stack>
      )}
    </Box>
  );
};

export default HistoryPage;

