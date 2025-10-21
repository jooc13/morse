import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Grid,
  Collapse,
  IconButton,
  Stack,
  Avatar,
  Divider,
  Badge
} from '@mui/material';
import {
  FitnessCenter,
  ExpandMore,
  Schedule,
  MonitorWeight,
  Repeat,
  TrendingUp,
  EmojiEvents
} from '@mui/icons-material';

const WorkoutCard = ({ workout, onClick }) => {
  const [expanded, setExpanded] = useState(false);
  
  const workoutDate = new Date(workout.workout_date);
  const isToday = workoutDate.toDateString() === new Date().toDateString();
  const isThisWeek = workoutDate > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const formatExerciseDetail = (exercise) => {
    const parts = [];
    if (exercise.sets) parts.push(`${exercise.sets} sets`);
    if (exercise.reps && exercise.reps.length > 0) {
      const avgReps = Math.round(exercise.reps.reduce((sum, r) => sum + r, 0) / exercise.reps.length);
      parts.push(`${avgReps} reps`);
    }
    if (exercise.weight_lbs && exercise.weight_lbs.length > 0) {
      const maxWeight = Math.max(...exercise.weight_lbs);
      parts.push(`${maxWeight}lbs`);
    }
    return parts.join(' × ');
  };

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

  const getPRCount = () => {
    if (!workout.exercises) return 0;
    return workout.exercises.filter(exercise => {
      const maxWeight = exercise.weight_lbs ? Math.max(...exercise.weight_lbs) : 0;
      return maxWeight > 200; // Simple PR detection - would be based on user history in real app
    }).length;
  };

  const getIntensityColor = (effort) => {
    if (effort >= 8) return '#ff4444';
    if (effort >= 6) return '#ff8800';
    if (effort >= 4) return '#00e5ff';
    return '#9e9e9e';
  };

  const avgEffort = workout.exercises?.length > 0 
    ? workout.exercises.reduce((sum, ex) => sum + (ex.effort_level || 5), 0) / workout.exercises.length 
    : 0;

  return (
    <Card 
      sx={{ 
        mb: 2,
        borderLeft: isToday ? '4px solid #4caf50' : isThisWeek ? '4px solid #00e5ff' : '4px solid rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(255,255,255,0.02)',
        transition: 'all 0.2s ease',
        '&:hover': { 
          boxShadow: '0 4px 20px rgba(0,229,255,0.15)', 
          transform: 'translateY(-2px)',
          borderLeftColor: '#00e5ff'
        }
      }}
    >
      <CardContent sx={{ p: 3 }}>
        {/* Header Row */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
                <FitnessCenter sx={{ fontSize: 18 }} />
              </Avatar>
              {workoutDate.toLocaleDateString('en', { 
                weekday: 'long', 
                month: 'short', 
                day: 'numeric' 
              })}
              {isToday && <Chip label="Today" size="small" color="success" />}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {workout.workout_start_time && (
                <>
                  <Schedule sx={{ fontSize: 16 }} />
                  {workout.workout_start_time}
                </>
              )}
              {workout.workout_duration_minutes && (
                <>
                  {workout.workout_start_time && ' • '}
                  {workout.workout_duration_minutes} min
                </>
              )}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {getPRCount() > 0 && (
              <Badge badgeContent={getPRCount()} color="error">
                <EmojiEvents sx={{ color: '#ffd700', fontSize: 24 }} />
              </Badge>
            )}
            <IconButton 
              onClick={() => setExpanded(!expanded)}
              sx={{ 
                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s'
              }}
            >
              <ExpandMore />
            </IconButton>
          </Box>
        </Box>

        {/* Quick Stats Row */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h5" color="primary" sx={{ fontWeight: 700 }}>
                {workout.total_exercises || 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Exercises
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h5" color="secondary" sx={{ fontWeight: 700 }}>
                {Math.round(getTotalVolume() / 1000) || 0}k
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Volume
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h5" sx={{ color: getIntensityColor(avgEffort), fontWeight: 700 }}>
                {Math.round(avgEffort) || 'N/A'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Intensity
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h5" sx={{ color: '#ffd700', fontWeight: 700 }}>
                {getPRCount()}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                PRs
              </Typography>
            </Box>
          </Grid>
        </Grid>

        {/* Exercise Preview - Always visible */}
        <Box>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 600 }}>
            Exercises
          </Typography>
          <Stack spacing={1}>
            {workout.exercises?.slice(0, 3).map((exercise, index) => (
              <Box 
                key={index} 
                sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  p: 1.5,
                  borderRadius: 1,
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Avatar sx={{ 
                    bgcolor: exercise.exercise_type === 'strength' ? 'primary.main' : 
                             exercise.exercise_type === 'cardio' ? 'error.main' : 'success.main',
                    width: 24, 
                    height: 24 
                  }}>
                    <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 700 }}>
                      {index + 1}
                    </Typography>
                  </Avatar>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {exercise.exercise_name}
                  </Typography>
                </Box>
                <Typography variant="body2" color="primary" sx={{ fontWeight: 600 }}>
                  {formatExerciseDetail(exercise)}
                </Typography>
              </Box>
            )) || (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                No exercise details available
              </Typography>
            )}
            {workout.exercises && workout.exercises.length > 3 && (
              <Box sx={{ textAlign: 'center', py: 1 }}>
                <Typography variant="body2" color="primary" sx={{ fontStyle: 'italic' }}>
                  +{workout.exercises.length - 3} more exercises
                </Typography>
              </Box>
            )}
          </Stack>
        </Box>

        {/* Expanded Details */}
        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
            Complete Exercise Breakdown
          </Typography>
          <Stack spacing={2}>
            {workout.exercises?.map((exercise, index) => (
              <Card key={index} variant="outlined" sx={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                <CardContent sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {exercise.exercise_name}
                    </Typography>
                    <Chip 
                      label={exercise.exercise_type || 'strength'} 
                      size="small" 
                      color={exercise.exercise_type === 'cardio' ? 'error' : 'primary'}
                    />
                  </Box>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={6} md={3}>
                      <Box sx={{ textAlign: 'center', p: 1, backgroundColor: 'rgba(0,229,255,0.1)', borderRadius: 1 }}>
                        <Typography variant="h6" color="primary">{exercise.sets || 0}</Typography>
                        <Typography variant="caption">Sets</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Box sx={{ textAlign: 'center', p: 1, backgroundColor: 'rgba(255,107,107,0.1)', borderRadius: 1 }}>
                        <Typography variant="h6" color="secondary">
                          {exercise.reps ? exercise.reps.join(', ') : 'N/A'}
                        </Typography>
                        <Typography variant="caption">Reps</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Box sx={{ textAlign: 'center', p: 1, backgroundColor: 'rgba(76,175,80,0.1)', borderRadius: 1 }}>
                        <Typography variant="h6" sx={{ color: '#4caf50' }}>
                          {exercise.weight_lbs ? exercise.weight_lbs.join(', ') : 'N/A'}
                        </Typography>
                        <Typography variant="caption">Weight (lbs)</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Box sx={{ textAlign: 'center', p: 1, backgroundColor: 'rgba(255,152,0,0.1)', borderRadius: 1 }}>
                        <Typography variant="h6" sx={{ color: '#ff9800' }}>
                          {exercise.effort_level || 'N/A'}/10
                        </Typography>
                        <Typography variant="caption">Effort</Typography>
                      </Box>
                    </Grid>
                  </Grid>

                  {exercise.muscle_groups && exercise.muscle_groups.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                        Muscle Groups:
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {exercise.muscle_groups.map((muscle, idx) => (
                          <Chip
                            key={idx}
                            label={muscle}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.7rem', height: 20 }}
                          />
                        ))}
                      </Box>
                    </Box>
                  )}

                  {exercise.notes && (
                    <Box sx={{ mt: 2, p: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 1 }}>
                      <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                        Notes:
                      </Typography>
                      <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                        {exercise.notes}
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            ))}
          </Stack>

          {workout.transcription && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                Original Audio Transcription
              </Typography>
              <Box sx={{ 
                p: 2, 
                backgroundColor: 'rgba(255,255,255,0.05)', 
                borderRadius: 1,
                border: '1px solid rgba(255,255,255,0.1)'
              }}>
                <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                  "{workout.transcription}"
                </Typography>
              </Box>
            </Box>
          )}
        </Collapse>
      </CardContent>
    </Card>
  );
};

export default WorkoutCard;