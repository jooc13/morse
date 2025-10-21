import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  ButtonGroup
} from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
  Add,
  Search,
  Groups
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { groupWorkoutsBySession } from '../utils/workoutGrouping';

const SimpleWorkoutDashboard = ({ user }) => {
  const navigate = useNavigate();
  const [workouts, setWorkouts] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('day'); // day, week, month
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    loadWorkouts();
  }, []);

  const loadWorkouts = async () => {
    try {
      setLoading(true);
      const result = await api.getClaimedWorkouts({ limit: 200 });
      const workoutsData = result.workouts || [];
      setWorkouts(workoutsData);
      
      // Always group into sessions - fix the duplicate bug
      const groupedSessions = groupWorkoutsBySession(workoutsData);
      setSessions(groupedSessions);
      
    } catch (error) {
      console.error('Failed to load workouts:', error);
    } finally {
      setLoading(false);
    }
  };

  const getWorkoutsForPeriod = () => {
    const data = sessions; // Always use sessions
    
    if (viewMode === 'day') {
      const dateStr = currentDate.toISOString().split('T')[0];
      return data.filter(item => 
        item.workout_date && item.workout_date.startsWith(dateStr)
      );
    } else if (viewMode === 'week') {
      const weekStart = new Date(currentDate);
      weekStart.setDate(currentDate.getDate() - currentDate.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      return data.filter(item => {
        const workoutDate = new Date(item.workout_date);
        return workoutDate >= weekStart && workoutDate <= weekEnd;
      });
    } else { // month
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      
      return data.filter(item => {
        const workoutDate = new Date(item.workout_date);
        return workoutDate >= monthStart && workoutDate <= monthEnd;
      });
    }
  };

  const navigatePeriod = (direction) => {
    const newDate = new Date(currentDate);
    if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() + direction);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + (direction * 7));
    } else {
      newDate.setMonth(newDate.getMonth() + direction);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const formatPeriodHeader = () => {
    if (viewMode === 'day') {
      const today = new Date();
      if (currentDate.toDateString() === today.toDateString()) {
        return 'Today';
      }
      return currentDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric' 
      });
    } else if (viewMode === 'week') {
      const weekStart = new Date(currentDate);
      weekStart.setDate(currentDate.getDate() - currentDate.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    } else {
      return currentDate.toLocaleDateString('en-US', { 
        month: 'long', 
        year: 'numeric' 
      });
    }
  };

  const getAllExercises = (workouts) => {
    const exercises = [];
    workouts.forEach(workout => {
      workout.exercises?.forEach(exercise => {
        exercises.push({
          ...exercise,
          workout_date: workout.workout_date,
          workout_time: workout.session_start_time || workout.workout_start_time
        });
      });
    });
    return exercises.sort((a, b) => new Date(`${b.workout_date}T${b.workout_time || '00:00'}`) - new Date(`${a.workout_date}T${a.workout_time || '00:00'}`));
  };

  const periodWorkouts = getWorkoutsForPeriod();
  const allExercises = getAllExercises(periodWorkouts);

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Simple Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          Workouts
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" size="small" onClick={() => navigate('/search')}>
            <Search sx={{ fontSize: 18 }} />
          </Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/teams')}>
            <Groups sx={{ fontSize: 18 }} />
          </Button>
          <Button variant="contained" size="small" onClick={() => navigate('/upload-test')}>
            <Add sx={{ fontSize: 18 }} />
          </Button>
        </Box>
      </Box>

      {/* Period Navigation */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <ButtonGroup size="small">
            <Button 
              variant={viewMode === 'day' ? 'contained' : 'outlined'}
              onClick={() => setViewMode('day')}
            >
              Day
            </Button>
            <Button 
              variant={viewMode === 'week' ? 'contained' : 'outlined'}
              onClick={() => setViewMode('week')}
            >
              Week
            </Button>
            <Button 
              variant={viewMode === 'month' ? 'contained' : 'outlined'}
              onClick={() => setViewMode('month')}
            >
              Month
            </Button>
          </ButtonGroup>
          
          <IconButton onClick={() => navigatePeriod(-1)} size="small">
            <ChevronLeft />
          </IconButton>
          
          <Typography variant="h6" sx={{ minWidth: 200, textAlign: 'center' }}>
            {formatPeriodHeader()}
          </Typography>
          
          <IconButton onClick={() => navigatePeriod(1)} size="small">
            <ChevronRight />
          </IconButton>
          
          {currentDate.toDateString() !== new Date().toDateString() && (
            <Button size="small" onClick={goToToday}>
              Today
            </Button>
          )}
        </Box>
        
        <Typography variant="body2" color="text.secondary">
          {periodWorkouts.length} sessions • {allExercises.length} exercises
        </Typography>
      </Box>

      {/* Exercise Table - Simple and Clean */}
      {allExercises.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary">
            No workouts in this {viewMode}
          </Typography>
          <Button 
            variant="contained" 
            startIcon={<Add />} 
            onClick={() => navigate('/upload-test')}
            sx={{ mt: 2 }}
          >
            Add Workout
          </Button>
        </Box>
      ) : (
        <TableContainer component={Paper} sx={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Exercise</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Sets</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Reps</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Weight</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Volume</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {allExercises.map((exercise, index) => {
                const avgReps = exercise.reps ? 
                  exercise.reps.reduce((sum, r) => sum + r, 0) / exercise.reps.length : 0;
                const avgWeight = exercise.weight_lbs ? 
                  exercise.weight_lbs.reduce((sum, w) => sum + w, 0) / exercise.weight_lbs.length : 0;
                const volume = (exercise.sets || 0) * avgReps * avgWeight;
                
                return (
                  <TableRow key={index} hover>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {new Date(exercise.workout_date).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </Typography>
                        {exercise.workout_time && (
                          <Typography variant="caption" color="text.secondary">
                            {exercise.workout_time}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {exercise.exercise_name}
                        </Typography>
                        {exercise.exercise_type && exercise.exercise_type !== 'strength' && (
                          <Chip 
                            label={exercise.exercise_type} 
                            size="small" 
                            variant="outlined"
                            sx={{ mt: 0.5, height: 16, fontSize: '0.65rem' }}
                          />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {exercise.sets || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2">
                        {exercise.reps ? (
                          exercise.reps.length === 1 ? exercise.reps[0] : 
                          `${Math.min(...exercise.reps)}-${Math.max(...exercise.reps)}`
                        ) : '-'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2">
                        {exercise.weight_lbs ? (
                          exercise.weight_lbs.length === 1 ? `${exercise.weight_lbs[0]}` : 
                          `${Math.min(...exercise.weight_lbs)}-${Math.max(...exercise.weight_lbs)}`
                        ) : '-'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {volume > 0 ? Math.round(volume).toLocaleString() : '-'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default SimpleWorkoutDashboard;