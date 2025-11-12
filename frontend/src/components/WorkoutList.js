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
import { motion } from 'framer-motion';
import api from '../services/api';

const MotionPaper = motion(Paper);
const MotionAccordion = motion(Accordion);
const MotionBox = motion(Box);

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

  // Format a single set's details (weight x reps)
  const formatSetDetails = (set) => {
    const parts = [];

    // Weight x Reps format (most common for strength training)
    if (set.weight_lbs && set.weight_lbs.length > 0 && set.reps && set.reps.length > 0) {
      const weight = set.weight_lbs[0];
      const reps = set.reps[0];
      return `${weight} lbs × ${reps} reps`;
    }

    // Just reps (bodyweight exercises)
    if (set.reps && set.reps.length > 0) {
      return `${set.reps[0]} reps`;
    }

    // Duration based (cardio)
    if (set.duration_minutes) {
      parts.push(`${set.duration_minutes} min`);
    }

    // Distance based
    if (set.distance_miles) {
      parts.push(`${set.distance_miles} miles`);
    }

    return parts.length > 0 ? parts.join(' • ') : 'Completed';
  };

  // Group sets by exercise name
  const groupSetsByExercise = (sets) => {
    const grouped = {};

    if (!sets || sets.length === 0) return grouped;

    sets.forEach((set) => {
      const name = set.exercise_name;
      if (!grouped[name]) {
        grouped[name] = {
          exercise_name: name,
          exercise_type: set.exercise_type,
          muscle_groups: set.muscle_groups,
          notes: set.notes,
          sets: []
        };
      }
      grouped[name].sets.push(set);
    });

    return grouped;
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

          {workouts.map((workout, workoutIndex) => {
            const groupedExercises = groupSetsByExercise(workout.sets || []);
            const exerciseNames = Object.keys(groupedExercises);

            return (
              <MotionAccordion
                key={`${workout.workout_date}-${workoutIndex}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: workoutIndex * 0.05 }}
                sx={{
                  mb: 3,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: '12px !important',
                  '&:before': { display: 'none' },
                  '&.Mui-expanded': {
                    margin: '0 0 24px 0'
                  },
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    borderColor: 'text.secondary',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)'
                  }
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  sx={{
                    px: 3,
                    py: 2
                  }}
                >
                  <Box sx={{ flexGrow: 1 }}>
                    <Grid container alignItems="center" spacing={2}>
                      <Grid item xs={12} md={4}>
                        <Box display="flex" alignItems="center" gap={1.5}>
                          <CalendarToday sx={{ fontSize: 20, color: 'text.secondary' }} />
                          <Box>
                            <Typography
                              variant="h6"
                              sx={{
                                fontWeight: 700,
                                letterSpacing: '-0.01em',
                                mb: 0.25
                              }}
                            >
                              {formatDate(workout.workout_date)}
                            </Typography>
                            {workout.workout_start_time && (
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                Started at {formatTime(workout.workout_start_time)}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </Grid>

                      <Grid item xs={12} sm={4} md={3}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <FitnessCenter sx={{ fontSize: 20, color: 'text.secondary' }} />
                          <Box>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>
                              {workout.total_sets || 0} sets
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              {exerciseNames.length} exercises
                            </Typography>
                          </Box>
                        </Box>
                      </Grid>

                      <Grid item xs={12} sm={4} md={3}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Timer sx={{ fontSize: 20, color: 'text.secondary' }} />
                          <Box>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>
                              {formatDuration(workout.workout_duration_minutes)}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              total duration
                            </Typography>
                          </Box>
                        </Box>
                      </Grid>

                      <Grid item xs={12} sm={4} md={2}>
                        <Chip
                          label={`${workout.recording_count || 1} recording${workout.recording_count > 1 ? 's' : ''}`}
                          size="small"
                          sx={{
                            backgroundColor: 'grey.100',
                            color: 'text.secondary',
                            fontWeight: 500,
                            fontSize: '0.75rem'
                          }}
                        />
                      </Grid>
                    </Grid>
                  </Box>
                </AccordionSummary>

                <AccordionDetails sx={{ px: 3, pb: 3 }}>
                  <Box>
                    {/* Display exercises grouped by name with their sets */}
                    {exerciseNames.length > 0 ? (
                      <Box>
                        {exerciseNames.map((exerciseName, exerciseIndex) => {
                          const exercise = groupedExercises[exerciseName];

                          return (
                            <MotionBox
                              key={exerciseName}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.2, delay: exerciseIndex * 0.05 }}
                              sx={{ mb: 3 }}
                            >
                              <Box
                                sx={{
                                  p: 3,
                                  border: '1px solid',
                                  borderColor: 'divider',
                                  borderRadius: 2,
                                  backgroundColor: 'background.paper',
                                  transition: 'all 0.2s',
                                  '&:hover': {
                                    borderColor: 'text.secondary',
                                    backgroundColor: 'rgba(0, 0, 0, 0.01)'
                                  }
                                }}
                              >
                                {/* Exercise header */}
                                <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                                  <Typography
                                    variant="h6"
                                    sx={{
                                      fontWeight: 700,
                                      letterSpacing: '-0.01em'
                                    }}
                                  >
                                    {exerciseName}
                                  </Typography>
                                  {exercise.exercise_type && (
                                    <Chip
                                      label={exercise.exercise_type}
                                      size="small"
                                      sx={{
                                        backgroundColor: 'grey.900',
                                        color: 'white',
                                        fontWeight: 500,
                                        fontSize: '0.7rem',
                                        height: 22,
                                        borderRadius: 1
                                      }}
                                    />
                                  )}
                                </Box>

                                {/* Sets list */}
                                <Box sx={{ ml: 0, mb: 2 }}>
                                  {exercise.sets.map((set, setIndex) => (
                                    <Box
                                      key={set.id}
                                      sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        py: 1,
                                        borderBottom: setIndex < exercise.sets.length - 1 ? '1px solid' : 'none',
                                        borderColor: 'divider'
                                      }}
                                    >
                                      <Box
                                        sx={{
                                          minWidth: 60,
                                          mr: 2
                                        }}
                                      >
                                        <Typography
                                          variant="caption"
                                          sx={{
                                            color: 'text.secondary',
                                            fontWeight: 600,
                                            fontSize: '0.75rem',
                                            letterSpacing: '0.05em'
                                          }}
                                        >
                                          SET {setIndex + 1}
                                        </Typography>
                                      </Box>
                                      <Typography
                                        variant="body1"
                                        sx={{
                                          fontWeight: 600,
                                          color: 'text.primary',
                                          fontVariantNumeric: 'tabular-nums'
                                        }}
                                      >
                                        {formatSetDetails(set)}
                                      </Typography>
                                      {set.effort_level && (
                                        <Chip
                                          label={`RPE ${set.effort_level}`}
                                          size="small"
                                          sx={{
                                            ml: 'auto',
                                            height: 20,
                                            fontSize: '0.7rem',
                                            backgroundColor: 'grey.100',
                                            color: 'text.secondary',
                                            fontWeight: 500
                                          }}
                                        />
                                      )}
                                    </Box>
                                  ))}
                                </Box>

                                {/* Muscle groups */}
                                {exercise.muscle_groups && exercise.muscle_groups.length > 0 && (
                                  <Box sx={{ mb: 2 }}>
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        color: 'text.secondary',
                                        fontWeight: 600,
                                        fontSize: '0.7rem',
                                        letterSpacing: '0.1em',
                                        textTransform: 'uppercase',
                                        display: 'block',
                                        mb: 1
                                      }}
                                    >
                                      Muscle Groups
                                    </Typography>
                                    <Box display="flex" gap={0.5} flexWrap="wrap">
                                      {exercise.muscle_groups.map((muscle, idx) => (
                                        <Chip
                                          key={idx}
                                          label={muscle}
                                          size="small"
                                          variant="outlined"
                                          sx={{
                                            borderColor: 'grey.300',
                                            color: 'text.secondary',
                                            fontSize: '0.7rem',
                                            fontWeight: 500,
                                            height: 22,
                                            borderRadius: 1
                                          }}
                                        />
                                      ))}
                                    </Box>
                                  </Box>
                                )}

                                {/* Exercise notes */}
                                {exercise.notes && (
                                  <Box
                                    sx={{
                                      mt: 2,
                                      p: 2,
                                      backgroundColor: 'grey.50',
                                      borderRadius: 1.5,
                                      border: '1px solid',
                                      borderColor: 'grey.200'
                                    }}
                                  >
                                    <Typography
                                      variant="body2"
                                      sx={{
                                        color: 'text.primary',
                                        fontStyle: 'italic',
                                        lineHeight: 1.6
                                      }}
                                    >
                                      {exercise.notes}
                                    </Typography>
                                  </Box>
                                )}
                              </Box>
                            </MotionBox>
                          );
                        })}
                      </Box>
                    ) : (
                      <Box
                        sx={{
                          textAlign: 'center',
                          py: 4,
                          color: 'text.secondary'
                        }}
                      >
                        <FitnessCenter sx={{ fontSize: 48, mb: 2, opacity: 0.3 }} />
                        <Typography variant="body2">
                          No exercise data recorded for this day
                        </Typography>
                      </Box>
                    )}

                    {/* Show recordings if multiple */}
                    {workout.recordings && workout.recordings.length > 1 && (
                      <Box sx={{ mt: 3 }}>
                        <Divider sx={{ mb: 2 }} />
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'text.secondary',
                            fontWeight: 600,
                            fontSize: '0.7rem',
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                            display: 'block',
                            mb: 1.5
                          }}
                        >
                          Audio Recordings ({workout.recordings.length})
                        </Typography>
                        <Grid container spacing={1.5}>
                          {workout.recordings.map((recording, idx) => (
                            <Grid item xs={12} sm={6} key={recording.workout_id}>
                              <Card
                                sx={{
                                  p: 1.5,
                                  bgcolor: 'grey.50',
                                  border: '1px solid',
                                  borderColor: 'grey.200',
                                  borderRadius: 1.5
                                }}
                              >
                                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                                  Recording {idx + 1}
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5, fontSize: '0.8rem' }}>
                                  {recording.audio_filename}
                                </Typography>
                                {recording.transcription && (
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      color: 'text.secondary',
                                      fontStyle: 'italic',
                                      display: 'block',
                                      fontSize: '0.7rem',
                                      lineHeight: 1.4
                                    }}
                                  >
                                    "{recording.transcription.substring(0, 80)}..."
                                  </Typography>
                                )}
                              </Card>
                            </Grid>
                          ))}
                        </Grid>
                      </Box>
                    )}
                  </Box>
                </AccordionDetails>
              </MotionAccordion>
            );
          })}
          
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