import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Grid, Chip } from '@mui/material';
import { FitnessCenter, CalendarToday } from '@mui/icons-material';
import api from '../services/api';

const MinimalWorkoutDisplay = ({ deviceUuid }) => {
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWorkouts();
  }, [deviceUuid]);

  const loadWorkouts = async () => {
    try {
      setLoading(true);
      const response = await api.getWorkouts(deviceUuid, { limit: 100 });
      setWorkouts(response.workouts || []);
    } catch (error) {
      console.error('Failed to load workouts:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  if (workouts.length === 0) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography color="text.secondary">No workouts found</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, maxWidth: 600, mx: 'auto' }}>
      {workouts.map((workout, workoutIndex) => (
        <Paper
          key={workoutIndex}
          sx={{
            p: 2,
            mb: 2,
            backgroundColor: '#ffffff',
            border: '1px solid #e0e0e0'
          }}
        >
          {/* Date Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <CalendarToday sx={{ fontSize: 18, mr: 1, color: '#666' }} />
            <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 600 }}>
              {formatDate(workout.workout_date)}
            </Typography>
            <Chip
              label={`${workout.total_sets} set${workout.total_sets !== '1' ? 's' : ''}`}
              size="small"
              sx={{ ml: 'auto', backgroundColor: '#f5f5f5' }}
            />
          </Box>

          {/* Sets/Exercises */}
          <Box>
            {workout.sets.map((set, setIndex) => {
              // Calculate set number for this exercise
              const exerciseSets = workout.sets.filter(s => s.exercise_name === set.exercise_name);
              const currentSetNumber = exerciseSets.findIndex(s => s.order_in_workout === set.order_in_workout) + 1;

              return (
                <Box
                  key={set.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    py: 1.5,
                    borderBottom: setIndex < workout.sets.length - 1 ? '1px solid #f0f0f0' : 'none'
                  }}
                >
                  {/* Order - Small */}
                  <Typography
                    variant="body2"
                    sx={{
                      minWidth: 30,
                      fontSize: '0.75rem',
                      color: '#999',
                      textAlign: 'center'
                    }}
                  >
                    {set.order_in_workout}
                  </Typography>

                  {/* Exercise Name */}
                  <Box sx={{ display: 'flex', alignItems: 'center', ml: 2, minWidth: 140 }}>
                    <FitnessCenter sx={{ fontSize: 16, mr: 1, color: '#666' }} />
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {set.exercise_name}
                    </Typography>
                  </Box>

                  {/* Set Number */}
                  <Typography
                    variant="body2"
                    sx={{
                      ml: 2,
                      minWidth: 60,
                      color: '#666'
                    }}
                  >
                    Set {currentSetNumber}
                  </Typography>

                  {/* Weight and Reps */}
                  <Box sx={{ ml: 'auto', textAlign: 'right' }}>
                    {set.weight_lbs && set.weight_lbs.length > 0 && set.reps && set.reps.length > 0 ? (
                      set.weight_lbs.map((weight, i) => (
                        <Typography key={i} variant="body1" sx={{ fontWeight: 600 }}>
                          {weight} lbs × {set.reps[i]} reps
                        </Typography>
                      ))
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No data
                      </Typography>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Paper>
      ))}
    </Box>
  );
};

export default MinimalWorkoutDisplay;