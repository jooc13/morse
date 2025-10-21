import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Grid,
  Chip,
  Button,
  Avatar,
  Stack,
  Divider,
  LinearProgress,
  IconButton
} from '@mui/material';
import {
  FitnessCenter,
  TrendingUp,
  Schedule,
  MonitorWeight,
  EmojiEvents,
  ChevronRight,
  Add,
  PlayArrow
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { groupWorkoutsBySession, generateRecommendations } from '../utils/workoutGrouping';

const TodaysWorkout = () => {
  const navigate = useNavigate();
  const [todaysWorkouts, setTodaysWorkouts] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTodaysWorkout();
  }, []);

  const loadTodaysWorkout = async () => {
    try {
      setLoading(true);
      const result = await api.getClaimedWorkouts({ limit: 50 });
      const workouts = result.workouts || [];
      
      // Filter for today's workouts
      const today = new Date().toISOString().split('T')[0];
      const todaysData = workouts.filter(w => 
        w.workout_date && w.workout_date.startsWith(today)
      );
      
      setTodaysWorkouts(todaysData);
      
      // Group and get recommendations
      const sessions = groupWorkoutsBySession(workouts);
      const recs = generateRecommendations(workouts, sessions.slice(-3));
      setRecommendations(recs.slice(0, 2));
      
    } catch (error) {
      console.error('Failed to load today\'s workout:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTotalVolume = (workouts) => {
    return workouts.reduce((total, workout) => {
      if (!workout.exercises) return total;
      return total + workout.exercises.reduce((exerciseTotal, exercise) => {
        const sets = exercise.sets || 0;
        const avgWeight = exercise.weight_lbs ? 
          exercise.weight_lbs.reduce((sum, w) => sum + w, 0) / exercise.weight_lbs.length : 0;
        const avgReps = exercise.reps ? 
          exercise.reps.reduce((sum, r) => sum + r, 0) / exercise.reps.length : 0;
        return exerciseTotal + (sets * avgWeight * avgReps);
      }, 0);
    }, 0);
  };

  const getTotalExercises = (workouts) => {
    return workouts.reduce((total, w) => total + (w.total_exercises || 0), 0);
  };

  const getTotalDuration = (workouts) => {
    return workouts.reduce((total, w) => total + (w.workout_duration_minutes || 0), 0);
  };

  const getUniqueExercises = (workouts) => {
    const exerciseNames = new Set();
    workouts.forEach(workout => {
      workout.exercises?.forEach(ex => {
        exerciseNames.add(ex.exercise_name);
      });
    });
    return Array.from(exerciseNames);
  };

  if (loading) {
    return (
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
              <FitnessCenter />
            </Avatar>
            <Typography variant="h6">Today's Workout</Typography>
          </Box>
          <LinearProgress />
        </CardContent>
      </Card>
    );
  }

  if (todaysWorkouts.length === 0) {
    return (
      <Card sx={{ mb: 3, backgroundColor: 'rgba(0, 229, 255, 0.05)', border: '1px solid rgba(0, 229, 255, 0.2)' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                <FitnessCenter />
              </Avatar>
              <Typography variant="h6">Today's Workout</Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => navigate('/upload-test')}
              size="small"
            >
              Start Workout
            </Button>
          </Box>
          
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            No workout recorded today. Time to get moving! 💪
          </Typography>

          {recommendations.length > 0 && (
            <Box>
              <Typography variant="subtitle2" gutterBottom sx={{ color: 'primary.main' }}>
                Recommended for today:
              </Typography>
              <Stack spacing={1}>
                {recommendations.map((rec, index) => (
                  <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TrendingUp sx={{ fontSize: 16, color: 'success.main' }} />
                    <Typography variant="body2">
                      {rec.exercise_name}: {rec.reason}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}
        </CardContent>
      </Card>
    );
  }

  const uniqueExercises = getUniqueExercises(todaysWorkouts);
  const totalVolume = getTotalVolume(todaysWorkouts);
  const totalExercises = getTotalExercises(todaysWorkouts);
  const totalDuration = getTotalDuration(todaysWorkouts);

  return (
    <Card sx={{ mb: 3, backgroundColor: 'rgba(76, 175, 80, 0.05)', border: '1px solid rgba(76, 175, 80, 0.2)' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Avatar sx={{ bgcolor: 'success.main', mr: 2 }}>
              <EmojiEvents />
            </Avatar>
            <Box>
              <Typography variant="h6" sx={{ color: 'success.main' }}>
                Great Work Today! 🎉
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {todaysWorkouts.length} workout{todaysWorkouts.length > 1 ? 's' : ''} completed
              </Typography>
            </Box>
          </Box>
          <IconButton
            onClick={() => navigate('/workouts')}
            sx={{ 
              backgroundColor: 'rgba(76, 175, 80, 0.1)',
              border: '1px solid rgba(76, 175, 80, 0.3)'
            }}
          >
            <ChevronRight />
          </IconButton>
        </Box>

        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h5" sx={{ color: 'success.main', fontWeight: 700 }}>
                {totalExercises}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Exercises
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h5" sx={{ color: 'primary.main', fontWeight: 700 }}>
                {Math.round(totalVolume / 1000)}k
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Volume
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h5" sx={{ color: 'secondary.main', fontWeight: 700 }}>
                {totalDuration}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Minutes
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h5" sx={{ color: '#ff9800', fontWeight: 700 }}>
                {uniqueExercises.length}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Types
              </Typography>
            </Box>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />

        <Box>
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
            Exercises Completed:
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {uniqueExercises.slice(0, 6).map((exercise, index) => (
              <Chip 
                key={index}
                label={exercise}
                size="small"
                variant="outlined"
                sx={{ 
                  borderColor: 'success.main',
                  color: 'success.main'
                }}
              />
            ))}
            {uniqueExercises.length > 6 && (
              <Chip 
                label={`+${uniqueExercises.length - 6} more`}
                size="small"
                variant="outlined"
                sx={{ 
                  borderColor: 'success.main',
                  color: 'success.main'
                }}
              />
            )}
          </Box>
        </Box>

        {recommendations.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom sx={{ color: 'primary.main' }}>
              For next time:
            </Typography>
            <Stack spacing={0.5}>
              {recommendations.slice(0, 2).map((rec, index) => (
                <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TrendingUp sx={{ fontSize: 14, color: 'primary.main' }} />
                  <Typography variant="caption" color="text.secondary">
                    {rec.exercise_name}: {rec.reason}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default TodaysWorkout;