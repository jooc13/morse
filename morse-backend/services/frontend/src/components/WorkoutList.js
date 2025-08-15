import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  Chip,
  Grid,
  Card,
  CardContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Button,
  TextField,
  CircularProgress
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  FitnessCenter,
  Timer,
  CalendarToday
} from '@mui/icons-material';
import api from '../services/api';

const WorkoutList = ({ deviceUuid }) => {
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ total: 0, limit: 20, offset: 0, hasMore: false });
  const [filters, setFilters] = useState({ startDate: '', endDate: '' });
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    loadWorkouts(true);
  }, [deviceUuid, filters]);

  const loadWorkouts = async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const offset = reset ? 0 : pagination.offset + pagination.limit;
      const response = await api.getWorkouts(deviceUuid, {
        limit: pagination.limit,
        offset: offset,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined
      });

      if (reset) {
        setWorkouts(response.workouts || []);
      } else {
        setWorkouts(prev => [...prev, ...(response.workouts || [])]);
      }
      
      setPagination({
        ...response.pagination,
        offset: offset
      });

    } catch (error) {
      console.error('Failed to load workouts:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleDateFilter = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (timeString) => {
    if (!timeString) return null;
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDuration = (minutes) => {
    if (!minutes) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const formatExerciseDetails = (exercise) => {
    const details = [];
    
    if (exercise.sets) {
      details.push(`${exercise.sets} sets`);
    }
    
    if (exercise.reps && exercise.reps.length > 0) {
      const repsStr = exercise.reps.length === 1 
        ? `${exercise.reps[0]} reps`
        : `${exercise.reps.join(', ')} reps`;
      details.push(repsStr);
    }
    
    if (exercise.weight_lbs && exercise.weight_lbs.length > 0) {
      const weightStr = exercise.weight_lbs.length === 1
        ? `${exercise.weight_lbs[0]} lbs`
        : `${exercise.weight_lbs.join(', ')} lbs`;
      details.push(weightStr);
    }
    
    if (exercise.duration_minutes) {
      details.push(`${exercise.duration_minutes} min`);
    }
    
    if (exercise.distance_miles) {
      details.push(`${exercise.distance_miles} miles`);
    }
    
    if (exercise.effort_level) {
      details.push(`Effort: ${exercise.effort_level}/10`);
    }
    
    return details.join(' • ');
  };

  const getExerciseTypeColor = (type) => {
    switch (type?.toLowerCase()) {
      case 'strength': return 'primary';
      case 'cardio': return 'error';
      case 'flexibility': return 'success';
      default: return 'default';
    }
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
      <Typography variant="h4" gutterBottom>
        Workout History
      </Typography>

      {/* Filters */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Filters
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Start Date"
              type="date"
              value={filters.startDate}
              onChange={(e) => handleDateFilter('startDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="End Date"
              type="date"
              value={filters.endDate}
              onChange={(e) => handleDateFilter('endDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button 
              variant="outlined" 
              onClick={() => setFilters({ startDate: '', endDate: '' })}
              fullWidth
            >
              Clear Filters
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Workout List */}
      {workouts.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <FitnessCenter sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="textSecondary" gutterBottom>
            No workouts found
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {filters.startDate || filters.endDate 
              ? 'Try adjusting your date filters or upload some workout audio files.'
              : 'Upload some workout audio files to see them here!'
            }
          </Typography>
        </Paper>
      ) : (
        <Box>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Showing {workouts.length} of {pagination.total} workouts
          </Typography>
          
          {workouts.map((workout) => (
            <Accordion key={workout.id} sx={{ mb: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ flexGrow: 1 }}>
                  <Grid container alignItems="center" spacing={2}>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box display="flex" alignItems="center">
                        <CalendarToday sx={{ mr: 1, fontSize: 20 }} />
                        <Typography variant="h6">
                          {formatDate(workout.workout_date)}
                        </Typography>
                      </Box>
                    </Grid>
                    
                    <Grid item xs={12} sm={6} md={3}>
                      <Box display="flex" alignItems="center">
                        <FitnessCenter sx={{ mr: 1, fontSize: 20 }} />
                        <Typography variant="body1">
                          {workout.total_exercises} exercises
                        </Typography>
                      </Box>
                    </Grid>
                    
                    <Grid item xs={12} sm={6} md={3}>
                      <Box display="flex" alignItems="center">
                        <Timer sx={{ mr: 1, fontSize: 20 }} />
                        <Typography variant="body1">
                          {formatDuration(workout.workout_duration_minutes)}
                        </Typography>
                      </Box>
                    </Grid>
                    
                    <Grid item xs={12} sm={6} md={3}>
                      {workout.workout_start_time && (
                        <Typography variant="body2" color="textSecondary">
                          Started: {formatTime(workout.workout_start_time)}
                        </Typography>
                      )}
                    </Grid>
                  </Grid>
                </Box>
              </AccordionSummary>
              
              <AccordionDetails>
                <Box>
                  {workout.transcription && (
                    <Card sx={{ mb: 2, bgcolor: 'grey.50' }}>
                      <CardContent>
                        <Typography variant="subtitle2" gutterBottom>
                          Original Audio Transcription:
                        </Typography>
                        <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                          "{workout.transcription}"
                        </Typography>
                      </CardContent>
                    </Card>
                  )}
                  
                  {workout.exercises && workout.exercises.length > 0 ? (
                    <List>
                      {workout.exercises.map((exercise, index) => (
                        <div key={exercise.id}>
                          <ListItem sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                            <Box sx={{ width: '100%', mb: 1 }}>
                              <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                                <Typography variant="h6">
                                  {exercise.exercise_name}
                                </Typography>
                                <Box>
                                  <Chip
                                    label={exercise.exercise_type || 'other'}
                                    color={getExerciseTypeColor(exercise.exercise_type)}
                                    size="small"
                                    sx={{ mr: 1 }}
                                  />
                                  <Typography variant="body2" component="span" color="textSecondary">
                                    #{exercise.order_in_workout}
                                  </Typography>
                                </Box>
                              </Box>
                              
                              <Typography variant="body1" sx={{ mb: 1 }}>
                                {formatExerciseDetails(exercise)}
                              </Typography>
                              
                              {exercise.muscle_groups && exercise.muscle_groups.length > 0 && (
                                <Box sx={{ mb: 1 }}>
                                  {exercise.muscle_groups.map((muscle, idx) => (
                                    <Chip
                                      key={idx}
                                      label={muscle}
                                      size="small"
                                      variant="outlined"
                                      sx={{ mr: 0.5, mb: 0.5 }}
                                    />
                                  ))}
                                </Box>
                              )}
                              
                              {exercise.notes && (
                                <Typography variant="body2" color="textSecondary" sx={{ fontStyle: 'italic' }}>
                                  Notes: {exercise.notes}
                                </Typography>
                              )}
                            </Box>
                          </ListItem>
                          {index < workout.exercises.length - 1 && <Divider />}
                        </div>
                      ))}
                    </List>
                  ) : (
                    <Typography color="textSecondary" sx={{ textAlign: 'center', py: 2 }}>
                      No exercise details available
                    </Typography>
                  )}
                  
                  {workout.notes && (
                    <Card sx={{ mt: 2, bgcolor: 'info.light', color: 'info.contrastText' }}>
                      <CardContent>
                        <Typography variant="subtitle2" gutterBottom>
                          Workout Notes:
                        </Typography>
                        <Typography variant="body2">
                          {workout.notes}
                        </Typography>
                      </CardContent>
                    </Card>
                  )}
                </Box>
              </AccordionDetails>
            </Accordion>
          ))}
          
          {pagination.hasMore && (
            <Box textAlign="center" mt={3}>
              <Button
                variant="outlined"
                onClick={() => loadWorkouts(false)}
                disabled={loadingMore}
              >
                {loadingMore ? <CircularProgress size={24} /> : 'Load More Workouts'}
              </Button>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default WorkoutList;