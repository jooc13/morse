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
  LinearProgress
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  FitnessCenter,
  Timer,
  CalendarToday,
  List as ListIcon
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';

const MotionPaper = motion(Paper);
const MotionAccordion = motion(Accordion);

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
      <Box>
        <LinearProgress
          sx={{
            height: 2,
            backgroundColor: 'grey.100',
            '& .MuiLinearProgress-bar': {
              backgroundColor: 'text.primary'
            }
          }}
        />
      </Box>
    );
  }

  return (
    <Box>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ListIcon sx={{ fontSize: 28, color: 'text.primary' }} />
          <Box>
            <Typography
              variant="h3"
              sx={{
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: 'text.primary'
              }}
            >
              Workout History
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', mt: 0.5 }}>
              Detailed view of all your recorded workouts
            </Typography>
          </Box>
        </Box>
      </motion.div>

      {/* Filters */}
      <MotionPaper
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        sx={{
          p: 3,
          mb: 3,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2
        }}
      >
        <Typography
          variant="overline"
          sx={{
            color: 'text.secondary',
            fontSize: '0.7rem',
            fontWeight: 600,
            letterSpacing: '0.1em'
          }}
        >
          Filters
        </Typography>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Start Date"
              type="date"
              value={filters.startDate}
              onChange={(e) => handleDateFilter('startDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              sx={{
                '& .MuiOutlinedInput-root': {
                  '&:hover fieldset': {
                    borderColor: 'text.secondary',
                  },
                },
              }}
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
              sx={{
                '& .MuiOutlinedInput-root': {
                  '&:hover fieldset': {
                    borderColor: 'text.secondary',
                  },
                },
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
              <Button
                variant="outlined"
                onClick={() => setFilters({ startDate: '', endDate: '' })}
                fullWidth
                sx={{
                  borderWidth: '1.5px',
                  color: 'text.primary',
                  borderColor: 'divider',
                  '&:hover': {
                    borderWidth: '1.5px',
                    borderColor: 'text.primary',
                    backgroundColor: 'rgba(0, 0, 0, 0.02)'
                  }
                }}
              >
                Clear Filters
              </Button>
            </motion.div>
          </Grid>
        </Grid>
      </MotionPaper>

      {/* Workout List */}
      {workouts.length === 0 ? (
        <MotionPaper
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          sx={{
            p: 6,
            textAlign: 'center',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2
          }}
        >
          <FitnessCenter sx={{ fontSize: 64, color: 'grey.300', mb: 2 }} />
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, color: 'text.primary' }}>
            No workouts found
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {filters.startDate || filters.endDate
              ? 'Try adjusting your date filters or upload some workout audio files.'
              : 'Upload some workout audio files to see them here!'
            }
          </Typography>
        </MotionPaper>
      ) : (
        <Box>
          <Typography
            variant="caption"
            sx={{
              mb: 3,
              display: 'block',
              color: 'text.secondary',
              fontSize: '0.8rem',
              fontWeight: 500
            }}
          >
            Showing {workouts.length} of {pagination.total} workouts
          </Typography>

          {workouts.map((workout, index) => (
            <MotionAccordion
              key={workout.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
              sx={{
                mb: 2,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: '12px !important',
                '&:before': { display: 'none' },
                '&.Mui-expanded': {
                  margin: '0 0 16px 0'
                },
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  borderColor: 'text.secondary',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)'
                }
              }}
            >
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
                    <Card
                      sx={{
                        mb: 2,
                        bgcolor: 'grey.50',
                        border: '1px solid',
                        borderColor: 'grey.200',
                        borderRadius: 2
                      }}
                    >
                      <CardContent>
                        <Typography
                          variant="overline"
                          sx={{
                            color: 'text.secondary',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            letterSpacing: '0.1em'
                          }}
                        >
                          Original Audio Transcription
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            fontStyle: 'italic',
                            color: 'text.primary',
                            mt: 1,
                            lineHeight: 1.6
                          }}
                        >
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
                                      sx={{
                                        mr: 0.5,
                                        mb: 0.5,
                                        borderColor: 'grey.300',
                                        color: 'text.secondary',
                                        fontSize: '0.75rem',
                                        fontWeight: 500,
                                        borderRadius: 1.5
                                      }}
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
                    <Card
                      sx={{
                        mt: 2,
                        bgcolor: 'grey.900',
                        color: 'white',
                        border: '1px solid',
                        borderColor: 'grey.800',
                        borderRadius: 2
                      }}
                    >
                      <CardContent>
                        <Typography
                          variant="overline"
                          sx={{
                            color: 'grey.300',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            letterSpacing: '0.1em'
                          }}
                        >
                          Workout Notes
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ color: 'white', mt: 1, lineHeight: 1.6 }}
                        >
                          {workout.notes}
                        </Typography>
                      </CardContent>
                    </Card>
                  )}
                </Box>
              </AccordionDetails>
            </MotionAccordion>
          ))}
          
          {pagination.hasMore && (
            <Box textAlign="center" mt={3}>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  variant="outlined"
                  onClick={() => loadWorkouts(false)}
                  disabled={loadingMore}
                  sx={{
                    px: 4,
                    py: 1.5,
                    borderWidth: '1.5px',
                    borderColor: 'text.primary',
                    color: 'text.primary',
                    fontWeight: 600,
                    '&:hover': {
                      borderWidth: '1.5px',
                      backgroundColor: 'text.primary',
                      color: 'background.paper'
                    },
                    '&.Mui-disabled': {
                      borderColor: 'grey.300',
                      color: 'grey.400'
                    }
                  }}
                >
                  {loadingMore ? (
                    <Box display="flex" alignItems="center" gap={1}>
                      <LinearProgress
                        sx={{
                          width: 100,
                          height: 2,
                          backgroundColor: 'grey.200'
                        }}
                      />
                    </Box>
                  ) : (
                    'Load More Workouts'
                  )}
                </Button>
              </motion.div>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default WorkoutList;