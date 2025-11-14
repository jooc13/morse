import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Grid,
  IconButton,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Collapse
} from '@mui/material';
import {
  AccessTime,
  FitnessCenter,
  EmojiEvents,
  Delete,
  ExpandMore
} from '@mui/icons-material';

const WorkoutCard = ({ workout, onClick, onDelete }) => {
  const [expandedExercises, setExpandedExercises] = useState({});
  
  const workoutDate = new Date(workout.workout_date);
  const isToday = workoutDate.toDateString() === new Date().toDateString();
  const isThisWeek = workoutDate > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const toggleExercise = (exerciseIndex) => {
    setExpandedExercises(prev => ({
      ...prev,
      [exerciseIndex]: !prev[exerciseIndex]
    }));
  };

  // Calculate best set (highest volume: weight × reps) for an exercise
  const getBestSet = (exercise) => {
    const reps = Array.isArray(exercise.reps) && exercise.reps.length > 0
      ? exercise.reps 
      : [];
    const weights = Array.isArray(exercise.weight_lbs) && exercise.weight_lbs.length > 0
      ? exercise.weight_lbs 
      : [];
    
    if (reps.length === 0 || weights.length === 0) return null;
    
    let bestVolume = 0;
    let bestSet = null;
    
    // Find the set with highest volume
    for (let i = 0; i < Math.max(reps.length, weights.length); i++) {
      const weight = weights[i] || 0;
      const rep = reps[i] || 0;
      const volume = weight * rep;
      
      if (volume > bestVolume) {
        bestVolume = volume;
        bestSet = { weight, reps: rep };
      }
    }
    
    return bestSet;
  };


  // Group exercises by name and combine sets
  const groupExercisesByName = (exercises) => {
    if (!exercises || exercises.length === 0) return [];
    
    const grouped = {};
    
    exercises.forEach((exercise) => {
      const name = exercise.exercise_name?.toLowerCase().trim();
      if (!name) return;
      
      if (!grouped[name]) {
        // First occurrence - initialize
        grouped[name] = {
          ...exercise,
          exercise_name: exercise.exercise_name, // Keep original casing
          reps: Array.isArray(exercise.reps) ? [...exercise.reps] : (exercise.reps ? [exercise.reps] : []),
          weight_lbs: Array.isArray(exercise.weight_lbs) ? [...exercise.weight_lbs] : (exercise.weight_lbs ? [exercise.weight_lbs] : []),
          effort_level: Array.isArray(exercise.effort_level) ? [...exercise.effort_level] : (exercise.effort_level ? [exercise.effort_level] : []),
          sets: exercise.sets || 1
        };
      } else {
        // Combine with existing exercise
        const existing = grouped[name];
        
        // Combine reps
        if (Array.isArray(exercise.reps)) {
          existing.reps.push(...exercise.reps);
        } else if (exercise.reps) {
          existing.reps.push(exercise.reps);
        }
        
        // Combine weights
        if (Array.isArray(exercise.weight_lbs)) {
          existing.weight_lbs.push(...exercise.weight_lbs);
        } else if (exercise.weight_lbs) {
          existing.weight_lbs.push(exercise.weight_lbs);
        }
        
        // Combine RPE (use array if multiple, otherwise repeat single value)
        if (Array.isArray(exercise.effort_level)) {
          existing.effort_level.push(...exercise.effort_level);
        } else if (exercise.effort_level) {
          existing.effort_level.push(exercise.effort_level);
        }
        
        // Update sets count
        existing.sets = (existing.sets || 0) + (exercise.sets || 1);
      }
    });
    
    return Object.values(grouped);
  };

  const groupedExercises = groupExercisesByName(workout.exercises);

  // Calculate total weight moved (sum of all weight × reps)
  const getTotalWeightMoved = () => {
    if (!groupedExercises || groupedExercises.length === 0) return 0;
    return groupedExercises.reduce((total, exercise) => {
      const reps = Array.isArray(exercise.reps) && exercise.reps.length > 0
        ? exercise.reps 
        : [];
      const weights = Array.isArray(exercise.weight_lbs) && exercise.weight_lbs.length > 0
        ? exercise.weight_lbs 
        : [];
      
      const exerciseTotal = reps.reduce((sum, rep, index) => {
        const weight = weights[index] || 0;
        return sum + (weight * (rep || 0));
      }, 0);
      
      return total + exerciseTotal;
    }, 0);
  };


  return (
    <Card 
      sx={{ 
        mb: 2,
        borderLeft: isToday ? '4px solid #4caf50' : isThisWeek ? '4px solid #1976d2' : '4px solid rgba(0,0,0,0.12)',
        backgroundColor: '#ffffff',
        transition: 'all 0.2s ease',
        '&:hover': { 
          boxShadow: '0 4px 20px rgba(25, 118, 210, 0.15)', 
          transform: 'translateY(-2px)',
          borderLeftColor: '#1976d2'
        }
      }}
    >
      <CardContent sx={{ p: 3 }}>
        {/* Header Row */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box>
            {/* Title - Date in "Xday, Month Date" format */}
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
              {workoutDate.toLocaleDateString('en', { 
                weekday: 'long', 
                month: 'long', 
                day: 'numeric' 
              })}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {onDelete && (
              <IconButton 
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm('Are you sure you want to delete this workout? This action cannot be undone.')) {
                    onDelete(workout.id || workout.workout_id);
                  }
                }}
                sx={{ 
                  color: 'error.main',
                  '&:hover': {
                    backgroundColor: 'error.light',
                    color: 'error.dark'
                  }
                }}
                size="small"
              >
                <Delete />
              </IconButton>
            )}
          </Box>
        </Box>

        {/* Stats Row */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={4}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <AccessTime sx={{ color: 'text.secondary', fontSize: 24 }} />
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Time
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  —
                </Typography>
              </Box>
            </Box>
          </Grid>
          <Grid item xs={4}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <FitnessCenter sx={{ color: 'text.secondary', fontSize: 24 }} />
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Total Weight
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {Math.round(getTotalWeightMoved()).toLocaleString()} lbs
                </Typography>
              </Box>
            </Box>
          </Grid>
          <Grid item xs={4}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <EmojiEvents sx={{ color: 'text.secondary', fontSize: 24 }} />
              <Box>
                <Typography variant="body2" color="text.secondary">
                  PRs
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  —
                </Typography>
              </Box>
            </Box>
          </Grid>
        </Grid>

        <Divider sx={{ mb: 2 }} />

        {/* Exercise Table - Two Columns */}
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: 'rgba(25, 118, 210, 0.08)' }}>
                <TableCell sx={{ fontWeight: 600 }}>Exercise</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Best Set</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {groupedExercises && groupedExercises.length > 0 ? (
                groupedExercises.map((exercise, index) => {
                  const numSets = exercise.sets || 
                    Math.max(
                      exercise.reps?.length || 0,
                      exercise.weight_lbs?.length || 0,
                      1
                    );
                  const bestSet = getBestSet(exercise);
                  const isExpanded = expandedExercises[index];
                  
                  // Get arrays for reps, weights, and RPE
                  const reps = Array.isArray(exercise.reps) && exercise.reps.length > 0
                    ? exercise.reps 
                    : [];
                  const weights = Array.isArray(exercise.weight_lbs) && exercise.weight_lbs.length > 0
                    ? exercise.weight_lbs 
                    : [];
                  const rpe = Array.isArray(exercise.effort_level) && exercise.effort_level.length > 0
                    ? exercise.effort_level
                    : exercise.effort_level
                      ? [exercise.effort_level]
                      : [];
                  
                  // Determine number of sets from the longest array
                  const actualNumSets = Math.max(
                    reps.length,
                    weights.length,
                    rpe.length,
                    numSets
                  );
                  
                  // Pad shorter arrays with null
                  const paddedReps = [...reps];
                  const paddedWeights = [...weights];
                  const paddedRpe = [...rpe];
                  while (paddedReps.length < actualNumSets) paddedReps.push(null);
                  while (paddedWeights.length < actualNumSets) paddedWeights.push(null);
                  while (paddedRpe.length < actualNumSets) paddedRpe.push(null);
                  
                  return (
                    <React.Fragment key={index}>
                      <TableRow 
                        sx={{ 
                          cursor: 'pointer',
                          '&:hover': {
                            backgroundColor: 'rgba(25, 118, 210, 0.04)'
                          }
                        }}
                        onClick={() => toggleExercise(index)}
                      >
                        <TableCell sx={{ fontWeight: 500 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <IconButton 
                              size="small"
                              sx={{ 
                                padding: 0.5,
                                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                transition: 'transform 0.2s'
                              }}
                            >
                              <ExpandMore />
                            </IconButton>
                            {numSets} × {exercise.exercise_name}
                          </Box>
                        </TableCell>
                        <TableCell>
                          {bestSet ? (
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {bestSet.weight} lbs × {bestSet.reps} reps
                            </Typography>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              —
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell 
                          style={{ paddingBottom: 0, paddingTop: 0 }} 
                          colSpan={2}
                        >
                          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                            <Box sx={{ margin: 2 }}>
                              <TableContainer component={Paper} variant="outlined">
                                <Table size="small">
                                  <TableHead>
                                    <TableRow sx={{ backgroundColor: 'rgba(25, 118, 210, 0.08)' }}>
                                      <TableCell sx={{ fontWeight: 600 }}>Set</TableCell>
                                      <TableCell sx={{ fontWeight: 600 }}>Weight (lbs)</TableCell>
                                      <TableCell sx={{ fontWeight: 600 }}>Reps</TableCell>
                                      <TableCell sx={{ fontWeight: 600 }}>RPE</TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {Array.from({ length: actualNumSets }, (_, i) => (
                                      <TableRow key={i}>
                                        <TableCell>{i + 1}</TableCell>
                                        <TableCell>
                                          {paddedWeights[i] !== null && paddedWeights[i] !== undefined ? paddedWeights[i] : '—'}
                                        </TableCell>
                                        <TableCell>
                                          {paddedReps[i] !== null && paddedReps[i] !== undefined ? paddedReps[i] : '—'}
                                        </TableCell>
                                        <TableCell>
                                          {paddedRpe[i] !== null && paddedRpe[i] !== undefined ? `${paddedRpe[i]}/10` : '—'}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </TableContainer>
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={2} sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>
                    No exercises recorded
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
};

export default WorkoutCard;