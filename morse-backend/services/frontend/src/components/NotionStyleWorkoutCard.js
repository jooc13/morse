import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Grid,
  Chip,
  Stack,
  Collapse,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Divider
} from '@mui/material';
import {
  FitnessCenter,
  ExpandMore,
  Schedule,
  MonitorWeight,
  EmojiEvents,
  KeyboardArrowDown,
  KeyboardArrowUp
} from '@mui/icons-material';

const NotionStyleWorkoutCard = ({ workout }) => {
  const [expanded, setExpanded] = useState(false);
  
  const workoutDate = new Date(workout.workout_date);
  const isToday = workoutDate.toDateString() === new Date().toDateString();
  const isThisWeek = workoutDate > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const getTotalVolume = () => {
    if (!workout.exercises) return 0;
    return workout.exercises.reduce((total, exercise) => {
      const sets = exercise.sets || 0;
      const avgWeight = exercise.weight_lbs ? 
        exercise.weight_lbs.reduce((sum, w) => sum + w, 0) / exercise.weight_lbs.length : 0;
      const avgReps = exercise.reps ? 
        exercise.reps.reduce((sum, r) => sum + r, 0) / exercise.reps.length : 0;
      return total + (sets * avgWeight * avgReps);
    }, 0);
  };

  const getWorkoutSummary = () => {
    if (!workout.exercises || workout.exercises.length === 0) return 'No exercises recorded';
    
    const exerciseGroups = {};
    workout.exercises.forEach(ex => {
      const type = ex.exercise_type || 'strength';
      if (!exerciseGroups[type]) exerciseGroups[type] = 0;
      exerciseGroups[type] += 1;
    });
    
    return Object.entries(exerciseGroups)
      .map(([type, count]) => `${count} ${type}`)
      .join(' • ');
  };

  const formatWeight = (weights) => {
    if (!weights || weights.length === 0) return '-';
    if (weights.length === 1) return `${weights[0]}lbs`;
    return `${Math.min(...weights)}-${Math.max(...weights)}lbs`;
  };

  const formatReps = (reps) => {
    if (!reps || reps.length === 0) return '-';
    if (reps.length === 1) return `${reps[0]}`;
    return `${Math.min(...reps)}-${Math.max(...reps)}`;
  };

  return (
    <Card 
      sx={{ 
        mb: 2,
        borderLeft: isToday ? '4px solid #4caf50' : isThisWeek ? '4px solid #00e5ff' : '1px solid rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(255,255,255,0.02)',
        transition: 'all 0.2s ease',
        '&:hover': { 
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          backgroundColor: 'rgba(255,255,255,0.05)'
        }
      }}
    >
      <CardContent sx={{ p: 0 }}>
        {/* Header */}
        <Box sx={{ p: 3, pb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                {workoutDate.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  month: 'long', 
                  day: 'numeric' 
                })}
                {isToday && <Chip label="Today" size="small" color="success" sx={{ ml: 1 }} />}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {workout.workout_start_time && `${workout.workout_start_time} • `}
                {workout.session_duration_minutes || workout.workout_duration_minutes ? 
                  `${workout.session_duration_minutes || workout.workout_duration_minutes} min` : 
                  'Duration not recorded'
                } • {getWorkoutSummary()}
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {Math.round(getTotalVolume()).toLocaleString()} lbs
              </Typography>
              <IconButton 
                onClick={() => setExpanded(!expanded)}
                size="small"
                sx={{ 
                  transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s'
                }}
              >
                <KeyboardArrowDown />
              </IconButton>
            </Box>
          </Box>

          {/* Exercise Summary */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {workout.exercises?.slice(0, 4).map((exercise, index) => (
              <Chip 
                key={index}
                label={exercise.exercise_name}
                size="small"
                variant="outlined"
                sx={{ 
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  borderColor: 'rgba(255,255,255,0.2)'
                }}
              />
            ))}
            {workout.exercises && workout.exercises.length > 4 && (
              <Chip 
                label={`+${workout.exercises.length - 4} more`}
                size="small"
                variant="outlined"
                sx={{ 
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  borderColor: 'rgba(255,255,255,0.2)'
                }}
              />
            )}
          </Box>
        </Box>

        {/* Detailed Exercise Table */}
        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <Divider />
          <Box sx={{ p: 3, pt: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
              Exercise Details
            </Typography>
            
            {workout.exercises && workout.exercises.length > 0 ? (
              <TableContainer component={Paper} variant="outlined" sx={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Exercise</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 600 }}>Sets</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 600 }}>Reps</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 600 }}>Weight</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 600 }}>Effort</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {workout.exercises.map((exercise, index) => (
                      <TableRow key={index} hover>
                        <TableCell>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {exercise.exercise_name}
                            </Typography>
                            {exercise.exercise_type && (
                              <Chip 
                                label={exercise.exercise_type} 
                                size="small" 
                                variant="outlined"
                                color={exercise.exercise_type === 'cardio' ? 'error' : 'primary'}
                                sx={{ mt: 0.5, height: 18, fontSize: '0.7rem' }}
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
                            {formatReps(exercise.reps)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Typography variant="body2">
                            {formatWeight(exercise.weight_lbs)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          {exercise.effort_level ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Typography variant="body2" sx={{ mr: 1 }}>
                                {exercise.effort_level}/10
                              </Typography>
                              <Box sx={{ 
                                width: 40, 
                                height: 4, 
                                backgroundColor: 'rgba(255,255,255,0.1)', 
                                borderRadius: 2,
                                overflow: 'hidden'
                              }}>
                                <Box sx={{ 
                                  height: '100%', 
                                  width: `${(exercise.effort_level / 10) * 100}%`,
                                  backgroundColor: exercise.effort_level >= 8 ? '#ff4444' : 
                                                 exercise.effort_level >= 6 ? '#ff8800' : '#00e5ff',
                                  transition: 'width 0.3s ease'
                                }} />
                              </Box>
                            </Box>
                          ) : (
                            <Typography variant="body2" color="text.secondary">-</Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                No exercise details available
              </Typography>
            )}

            {/* Additional Notes */}
            {workout.transcription && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                  Original Recording
                </Typography>
                <Box sx={{ 
                  p: 2, 
                  backgroundColor: 'rgba(255,255,255,0.03)', 
                  borderRadius: 1,
                  border: '1px solid rgba(255,255,255,0.1)'
                }}>
                  <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                    "{workout.transcription}"
                  </Typography>
                </Box>
              </Box>
            )}

            {/* Session Info for Grouped Workouts */}
            {workout.workout_count && workout.workout_count > 1 && (
              <Box sx={{ mt: 2, p: 2, backgroundColor: 'rgba(0, 229, 255, 0.05)', borderRadius: 1 }}>
                <Typography variant="caption" color="primary">
                  📎 This session combines {workout.workout_count} audio recordings from your workout
                </Typography>
              </Box>
            )}
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
};

export default NotionStyleWorkoutCard;