import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Grid,
  Card,
  CardContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
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
    
    return details.join(' • ');
  };

  const getWorkoutIntensity = (workout) => {
    if (!workout.exercises || workout.exercises.length === 0) return 0;
    const efforts = workout.exercises
      .map(e => e.effort_level)
      .filter(e => e !== null && e !== undefined);
    return efforts.length > 0 ? Math.round(efforts.reduce((a, b) => a + b, 0) / efforts.length) : 0;
  };

  const getWorkoutVolume = (workout) => {
    if (!workout.exercises) return 0;
    return workout.exercises.reduce((total, exercise) => {
      const sets = exercise.sets || 0;
      const avgWeight = exercise.weight_lbs ? 
        exercise.weight_lbs.reduce((sum, w) => sum + (w || 0), 0) / exercise.weight_lbs.length : 0;
      const avgReps = exercise.reps ? 
        exercise.reps.reduce((sum, r) => sum + (r || 0), 0) / exercise.reps.length : 0;
      return total + (sets * avgWeight * avgReps);
    }, 0);
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
            <Accordion key={workout.id} sx={{ 
              mb: 2,
              '&:before': { display: 'none' },
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              border: '1px solid rgba(255,255,255,0.1)',
              '&.Mui-expanded': {
                boxShadow: '0 4px 12px rgba(0,229,255,0.15)',
                borderColor: 'rgba(0,229,255,0.3)'
              }
            }}>
              <AccordionSummary 
                expandIcon={<ExpandMoreIcon />}
                sx={{ 
                  '& .MuiAccordionSummary-content': { 
                    margin: '16px 0' 
                  }
                }}
              >
                <Box sx={{ flexGrow: 1 }}>
                  <Grid container alignItems="center" spacing={2}>
                    <Grid item xs={12} sm={8} md={6}>
                      <Box>
                        <Box display="flex" alignItems="center" mb={0.5}>
                          <CalendarToday sx={{ mr: 1, fontSize: 18, color: 'primary.main' }} />
                          <Typography variant="h6" sx={{ mr: 2 }}>
                            {formatDate(workout.workout_date)}
                          </Typography>
                          {workout.workout_start_time && (
                            <Typography variant="body2" color="text.secondary">
                              {formatTime(workout.workout_start_time)}
                            </Typography>
                          )}
                        </Box>
                        <Box display="flex" alignItems="center" gap={2}>
                          <Box display="flex" alignItems="center">
                            <FitnessCenter sx={{ mr: 0.5, fontSize: 16, color: 'text.secondary' }} />
                            <Typography variant="body2" color="text.secondary">
                              {workout.total_exercises} exercises
                            </Typography>
                          </Box>
                          <Box display="flex" alignItems="center">
                            <Timer sx={{ mr: 0.5, fontSize: 16, color: 'text.secondary' }} />
                            <Typography variant="body2" color="text.secondary">
                              {formatDuration(workout.workout_duration_minutes)}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                    </Grid>
                    
                    <Grid item xs={12} sm={4} md={6}>
                      <Box display="flex" justifyContent="flex-end" alignItems="center" gap={2}>
                        {getWorkoutIntensity(workout) > 0 && (
                          <Box display="flex" alignItems="center">
                            <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
                              Intensity
                            </Typography>
                            <Box sx={{ 
                              display: 'flex', 
                              gap: 0.25,
                              alignItems: 'center'
                            }}>
                              {[...Array(5)].map((_, i) => (
                                <Box
                                  key={i}
                                  sx={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: '50%',
                                    backgroundColor: i < Math.ceil(getWorkoutIntensity(workout) / 2) 
                                      ? 'primary.main' 
                                      : 'rgba(255,255,255,0.2)'
                                  }}
                                />
                              ))}
                              <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                                {getWorkoutIntensity(workout)}/10
                              </Typography>
                            </Box>
                          </Box>
                        )}
                        {getWorkoutVolume(workout) > 0 && (
                          <Typography variant="caption" color="text.secondary">
                            {Math.round(getWorkoutVolume(workout)/1000)}k lbs
                          </Typography>
                        )}
                      </Box>
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
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                        Exercise Details
                      </Typography>
                      <Grid container spacing={2}>
                        {workout.exercises.map((exercise) => (
                          <Grid item xs={12} md={6} key={exercise.id}>
                            <Paper sx={{ 
                              p: 2, 
                              bgcolor: 'rgba(255,255,255,0.02)',
                              border: '1px solid rgba(255,255,255,0.1)',
                              position: 'relative'
                            }}>
                              <Box display="flex" alignItems="flex-start" justifyContent="space-between" mb={1}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }}>
                                  {exercise.exercise_name}
                                </Typography>
                                <Box display="flex" alignItems="center" gap={1}>
                                  <Chip
                                    label={exercise.exercise_type || 'other'}
                                    color={getExerciseTypeColor(exercise.exercise_type)}
                                    size="small"
                                    sx={{ fontSize: '0.7rem', height: 20 }}
                                  />
                                  <Typography variant="caption" color="text.secondary">
                                    #{exercise.order_in_workout}
                                  </Typography>
                                </Box>
                              </Box>
                              
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                {formatExerciseDetails(exercise)}
                              </Typography>
                              
                              {exercise.effort_level && (
                                <Box sx={{ mb: 1 }}>
                                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={0.5}>
                                    <Typography variant="caption" color="text.secondary">
                                      Effort
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {exercise.effort_level}/10
                                    </Typography>
                                  </Box>
                                  <Box sx={{ 
                                    height: 4, 
                                    backgroundColor: 'rgba(255,255,255,0.1)', 
                                    borderRadius: 2,
                                    overflow: 'hidden'
                                  }}>
                                    <Box sx={{ 
                                      height: '100%', 
                                      width: `${(exercise.effort_level / 10) * 100}%`,
                                      backgroundColor: 'primary.main',
                                      transition: 'width 0.3s ease'
                                    }} />
                                  </Box>
                                </Box>
                              )}
                              
                              {exercise.muscle_groups && exercise.muscle_groups.length > 0 && (
                                <Box sx={{ mb: 1 }}>
                                  <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                                    Muscle Groups
                                  </Typography>
                                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                    {exercise.muscle_groups.slice(0, 3).map((muscle, idx) => (
                                      <Chip
                                        key={idx}
                                        label={muscle}
                                        size="small"
                                        variant="outlined"
                                        sx={{ 
                                          fontSize: '0.65rem', 
                                          height: 18,
                                          '& .MuiChip-label': { px: 0.5 }
                                        }}
                                      />
                                    ))}
                                    {exercise.muscle_groups.length > 3 && (
                                      <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                                        +{exercise.muscle_groups.length - 3}
                                      </Typography>
                                    )}
                                  </Box>
                                </Box>
                              )}
                              
                              {exercise.notes && (
                                <Typography variant="caption" color="text.secondary" sx={{ 
                                  fontStyle: 'italic',
                                  display: 'block',
                                  mt: 1,
                                  p: 1,
                                  backgroundColor: 'rgba(255,255,255,0.05)',
                                  borderRadius: 1
                                }}>
                                  {exercise.notes}
                                </Typography>
                              )}
                            </Paper>
                          </Grid>
                        ))}
                      </Grid>
                    </Box>
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