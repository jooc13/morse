import React, { useState, useEffect } from 'react';
import { 
  Paper, 
  Typography, 
  Box, 
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  CircularProgress,
  Alert,
  LinearProgress,
  Tabs,
  Tab,
  IconButton,
  Avatar,
  Divider,
  List,
  ListItem,
  ListItemText,
  Stack,
  CardActionArea,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Badge
} from '@mui/material';
import { 
  FitnessCenter, 
  ArrowBack,
  ChevronLeft, 
  ChevronRight,
  TrendingUp,
  Assessment,
  Timeline,
  CalendarToday,
  Psychology,
  Star,
  ExpandMore,
  Schedule,
  MonitorWeight,
  Repeat,
  FlashOn,
  PlayArrow,
  BarChart,
  History,
  EmojiEvents
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

function ClaimedWorkouts() {
  const navigate = useNavigate();
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [viewMode, setViewMode] = useState('workouts'); // workouts, analytics, history
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const [progressInsights, setProgressInsights] = useState(null);
  const [expandedWorkout, setExpandedWorkout] = useState(null);

  useEffect(() => {
    loadClaimedWorkouts();
    loadProgressInsights();
  }, [currentWeek]);

  const loadClaimedWorkouts = async () => {
    try {
      setLoading(true);
      const result = await api.getClaimedWorkouts();
      setWorkouts(result.workouts || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load workouts');
    } finally {
      setLoading(false);
    }
  };

  const loadProgressInsights = async () => {
    try {
      // We'll implement this API call for LLM insights
      // const insights = await api.getProgressInsights();
      // setProgressInsights(insights);
    } catch (err) {
      console.error('Failed to load progress insights:', err);
    }
  };

  // Utility functions
  const getWeekStart = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  };

  const getWeekEnd = (date) => {
    const start = getWeekStart(date);
    return new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
  };

  const getWorkoutsForWeek = (week) => {
    const start = getWeekStart(week);
    const end = getWeekEnd(week);
    return workouts.filter(w => {
      const workoutDate = new Date(w.workout_date);
      return workoutDate >= start && workoutDate <= end;
    });
  };

  const calculateProgressiveOverloadScore = (weekWorkouts) => {
    if (weekWorkouts.length === 0) return 0;
    
    // Simple algorithm: base score + workout frequency + total exercises + duration
    let score = 30; // Base score
    score += Math.min(weekWorkouts.length * 15, 30); // Frequency (max 30 points)
    score += Math.min(weekWorkouts.reduce((sum, w) => sum + (w.total_exercises || 0), 0) * 2, 25); // Exercise variety
    score += Math.min(weekWorkouts.reduce((sum, w) => sum + (w.workout_duration_minutes || 0), 0) / 10, 15); // Duration
    
    return Math.min(Math.round(score), 100);
  };

  const getScoreColor = (score) => {
    if (score >= 80) return '#4caf50'; // Green
    if (score >= 60) return '#ff9800'; // Orange  
    if (score >= 40) return '#f44336'; // Red
    return '#9e9e9e'; // Gray
  };

  const navigateWeek = (direction) => {
    const newWeek = new Date(currentWeek);
    newWeek.setDate(newWeek.getDate() + (direction * 7));
    setCurrentWeek(newWeek);
  };

  // Utility functions for workout analysis
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

  const getWorkoutPRs = (workout) => {
    if (!workout.exercises) return [];
    return workout.exercises.filter(exercise => {
      const maxWeight = exercise.weight_lbs ? Math.max(...exercise.weight_lbs) : 0;
      return maxWeight > 0; // Simple PR detection - in real app would compare to history
    });
  };

  const getMuscleGroupsWorked = (workout) => {
    if (!workout.exercises) return [];
    const allMuscleGroups = workout.exercises.flatMap(exercise => exercise.muscle_groups || []);
    return [...new Set(allMuscleGroups)];
  };

  const WorkoutCard = ({ workout, onClick }) => {
    const volume = getWorkoutVolume(workout);
    const prs = getWorkoutPRs(workout);
    const muscleGroups = getMuscleGroupsWorked(workout);
    const workoutDate = new Date(workout.workout_date);
    const isToday = workoutDate.toDateString() === new Date().toDateString();
    const isThisWeek = workoutDate > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    return (
      <Card 
        sx={{ 
          mb: 2, 
          position: 'relative',
          borderLeft: isToday ? '4px solid #4caf50' : isThisWeek ? '4px solid #2196f3' : '4px solid transparent',
          '&:hover': { 
            boxShadow: 4, 
            transform: 'translateY(-2px)',
            transition: 'all 0.2s ease-in-out'
          }
        }}
      >
        <CardActionArea onClick={onClick}>
          <CardContent>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
              <Box>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <FitnessCenter color="primary" />
                  {workoutDate.toLocaleDateString('en', { 
                    weekday: 'long', 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                  {isToday && <Chip label="Today" size="small" color="success" />}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {workout.workout_start_time && (
                    <>{workout.workout_start_time} • </>
                  )}
                  {workout.workout_duration_minutes ? `${workout.workout_duration_minutes} min` : 'Duration not recorded'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {prs.length > 0 && (
                  <Badge badgeContent={prs.length} color="error">
                    <EmojiEvents sx={{ color: '#ffd700' }} />
                  </Badge>
                )}
                <Chip 
                  label={`${workout.total_exercises || 0} exercises`} 
                  size="small" 
                  color="primary" 
                  variant="outlined"
                />
              </Box>
            </Box>

            {/* Exercise Summary */}
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <MonitorWeight sx={{ fontSize: 20, color: 'text.secondary' }} />
                  <Box>
                    <Typography variant="body2" color="text.secondary">Volume</Typography>
                    <Typography variant="h6">{Math.round(volume).toLocaleString()} lbs</Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <FlashOn sx={{ fontSize: 20, color: 'text.secondary' }} />
                  <Box>
                    <Typography variant="body2" color="text.secondary">Intensity</Typography>
                    <Typography variant="h6">
                      {workout.exercises?.find(e => e.effort_level)?.effort_level || 'N/A'}/10
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            </Grid>

            {/* Muscle Groups */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Muscle Groups
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {muscleGroups.slice(0, 4).map((group, index) => (
                  <Chip 
                    key={index}
                    label={group}
                    size="small" 
                    variant="outlined"
                    sx={{ fontSize: '0.7rem', height: 20 }}
                  />
                ))}
                {muscleGroups.length > 4 && (
                  <Chip 
                    label={`+${muscleGroups.length - 4}`}
                    size="small" 
                    variant="outlined"
                    sx={{ fontSize: '0.7rem', height: 20 }}
                  />
                )}
              </Box>
            </Box>

            {/* Exercise Preview */}
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Exercises
              </Typography>
              <Stack spacing={0.5}>
                {workout.exercises?.slice(0, 3).map((exercise, index) => (
                  <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {exercise.exercise_name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {exercise.sets ? `${exercise.sets} sets` : ''}
                      {exercise.weight_lbs && exercise.weight_lbs[0] ? ` × ${exercise.weight_lbs[0]}lbs` : ''}
                    </Typography>
                  </Box>
                )) || (
                  <Typography variant="body2" color="text.secondary">
                    No exercise details available
                  </Typography>
                )}
                {workout.exercises && workout.exercises.length > 3 && (
                  <Typography variant="body2" color="primary" sx={{ fontStyle: 'italic' }}>
                    +{workout.exercises.length - 3} more exercises
                  </Typography>
                )}
              </Stack>
            </Box>
          </CardContent>
        </CardActionArea>
      </Card>
    );
  };

  const WorkoutsView = () => {
    const sortedWorkouts = [...workouts].sort((a, b) => new Date(b.workout_date) - new Date(a.workout_date));
    
    return (
      <Box>
        {/* Quick Stats */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} md={3}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="primary">{workouts.length}</Typography>
                <Typography variant="body2" color="text.secondary">Total Workouts</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={3}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="secondary">
                  {workouts.reduce((sum, w) => sum + (w.total_exercises || 0), 0)}
                </Typography>
                <Typography variant="body2" color="text.secondary">Total Exercises</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={3}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="info.main">
                  {Math.round(workouts.reduce((sum, w) => sum + getWorkoutVolume(w), 0) / 1000)}k
                </Typography>
                <Typography variant="body2" color="text.secondary">Total Volume</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={3}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" sx={{ color: '#ffd700' }}>
                  {workouts.reduce((sum, w) => sum + getWorkoutPRs(w).length, 0)}
                </Typography>
                <Typography variant="body2" color="text.secondary">Personal Records</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Workout List */}
        {sortedWorkouts.length === 0 ? (
          <Paper elevation={1} sx={{ p: 4, textAlign: 'center' }}>
            <FitnessCenter sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              No Workouts Yet
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Start tracking your workouts to see them here!
            </Typography>
          </Paper>
        ) : (
          <Box>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <History color="primary" />
              Recent Workouts
            </Typography>
            {sortedWorkouts.map((workout) => (
              <WorkoutCard 
                key={workout.workout_id} 
                workout={workout}
                onClick={() => setExpandedWorkout(
                  expandedWorkout === workout.workout_id ? null : workout.workout_id
                )}
              />
            ))}
          </Box>
        )}
      </Box>
    );
  };

  const WeeklyView = () => {
    const weekWorkouts = getWorkoutsForWeek(currentWeek);
    const progressScore = calculateProgressiveOverloadScore(weekWorkouts);
    const weekStart = getWeekStart(currentWeek);
    const weekEnd = getWeekEnd(currentWeek);

    return (
      <Box>
        {/* Week Navigation */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={() => navigateWeek(-1)}>
            <ChevronLeft />
          </IconButton>
          <Typography variant="h5">
            {weekStart.toLocaleDateString()} - {weekEnd.toLocaleDateString()}
          </Typography>
          <IconButton onClick={() => navigateWeek(1)}>
            <ChevronRight />
          </IconButton>
        </Box>

        {/* Weekly Stats Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                    <FitnessCenter />
                  </Avatar>
                  <Typography variant="h6">Workouts</Typography>
                </Box>
                <Typography variant="h4">{weekWorkouts.length}</Typography>
                <Typography variant="body2" color="text.secondary">
                  This week
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Avatar sx={{ bgcolor: 'secondary.main', mr: 2 }}>
                    <Assessment />
                  </Avatar>
                  <Typography variant="h6">Total Exercises</Typography>
                </Box>
                <Typography variant="h4">
                  {weekWorkouts.reduce((sum, w) => sum + (w.total_exercises || 0), 0)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Across all workouts
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Avatar sx={{ bgcolor: 'info.main', mr: 2 }}>
                    <Timeline />
                  </Avatar>
                  <Typography variant="h6">Total Time</Typography>
                </Box>
                <Typography variant="h4">
                  {weekWorkouts.reduce((sum, w) => sum + (w.workout_duration_minutes || 0), 0)}m
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Training volume
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Avatar sx={{ bgcolor: getScoreColor(progressScore), mr: 2 }}>
                    <TrendingUp />
                  </Avatar>
                  <Typography variant="h6">Progress Score</Typography>
                </Box>
                <Typography variant="h4">{progressScore}/100</Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={progressScore} 
                  sx={{ mt: 1, height: 8, borderRadius: 4 }}
                />
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Daily Workout Grid */}
        <Grid container spacing={2} sx={{ mb: 4 }}>
          {Array.from({ length: 7 }, (_, i) => {
            const day = new Date(weekStart);
            day.setDate(weekStart.getDate() + i);
            const dayWorkouts = weekWorkouts.filter(w => 
              new Date(w.workout_date).toDateString() === day.toDateString()
            );
            
            return (
              <Grid item xs={12/7} key={i}>
                <Paper 
                  elevation={dayWorkouts.length > 0 ? 3 : 1}
                  sx={{ 
                    p: 2, 
                    textAlign: 'center',
                    bgcolor: dayWorkouts.length > 0 ? 'primary.light' : 'grey.100',
                    color: dayWorkouts.length > 0 ? 'primary.contrastText' : 'text.secondary',
                    cursor: dayWorkouts.length > 0 ? 'pointer' : 'default',
                    minHeight: 80
                  }}
                  onClick={() => dayWorkouts.length > 0 && setExpandedWorkout(dayWorkouts[0].workout_id)}
                >
                  <Typography variant="caption">
                    {day.toLocaleDateString('en', { weekday: 'short' })}
                  </Typography>
                  <Typography variant="h6">
                    {day.getDate()}
                  </Typography>
                  {dayWorkouts.length > 0 && (
                    <Chip size="small" label={`${dayWorkouts.length}`} />
                  )}
                </Paper>
              </Grid>
            );
          })}
        </Grid>

        {/* Weekly Insights */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Psychology sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="h6">Weekly Insights</Typography>
            </Box>
            <Typography variant="body1" sx={{ mb: 2 }}>
              {weekWorkouts.length === 0 && "No workouts this week. Time to get moving! 💪"}
              {weekWorkouts.length === 1 && "Great start with 1 workout! Consistency is key - try to add 1-2 more sessions."}
              {weekWorkouts.length === 2 && "Nice work with 2 workouts! You're building good momentum."}
              {weekWorkouts.length >= 3 && weekWorkouts.length <= 4 && "Excellent consistency! You're in the sweet spot for sustainable progress."}
              {weekWorkouts.length >= 5 && "Outstanding dedication! Make sure you're allowing adequate recovery time."}
            </Typography>
            
            {progressScore >= 80 && (
              <Chip 
                icon={<Star />} 
                label="Outstanding Progress!" 
                color="success" 
                sx={{ mr: 1, mb: 1 }} 
              />
            )}
            {progressScore >= 60 && progressScore < 80 && (
              <Chip 
                icon={<TrendingUp />} 
                label="Good Progress" 
                color="primary" 
                sx={{ mr: 1, mb: 1 }} 
              />
            )}
            {progressScore < 60 && progressScore > 0 && (
              <Chip 
                label="Room for Improvement" 
                color="warning" 
                sx={{ mr: 1, mb: 1 }} 
              />
            )}
          </CardContent>
        </Card>
      </Box>
    );
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>Loading your workouts...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => navigate('/dashboard')}
            sx={{ mr: 2 }}
          >
            Back to Dashboard
          </Button>
        </Box>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      {/* Navigation */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/dashboard')}
          sx={{ mr: 2 }}
        >
          Back to Dashboard
        </Button>
      </Box>

      {/* Header */}
      <Typography variant="h4" component="h1" gutterBottom>
        <FitnessCenter sx={{ mr: 1, verticalAlign: 'middle' }} />
        Workout Analytics
      </Typography>

      {/* View Mode Tabs */}
      <Tabs 
        value={viewMode} 
        onChange={(e, newValue) => setViewMode(newValue)} 
        sx={{ mb: 3 }}
      >
        <Tab 
          icon={<History />} 
          label="Workouts" 
          value="workouts" 
        />
        <Tab 
          icon={<BarChart />} 
          label="Analytics" 
          value="analytics" 
        />
        <Tab 
          icon={<TrendingUp />} 
          label="Progress" 
          value="progress" 
          disabled 
        />
      </Tabs>

      {/* Content */}
      {loading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {viewMode === 'workouts' && <WorkoutsView />}
          {viewMode === 'analytics' && <WeeklyView />}
        </>
      )}

      {/* Expanded Workout Detail */}
      {expandedWorkout && workouts.find(w => w.workout_id === expandedWorkout)?.exercises && (
        <Card sx={{ mt: 3, border: '2px solid', borderColor: 'primary.main' }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Workout Details</Typography>
              <Button onClick={() => setExpandedWorkout(null)}>Close</Button>
            </Box>
            <Divider sx={{ mb: 2 }} />
            {workouts.find(w => w.workout_id === expandedWorkout)?.exercises.map((exercise, index) => (
              <Accordion key={index} sx={{ mb: 1 }}>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', pr: 2 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {exercise.exercise_name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {exercise.sets} sets • {exercise.exercise_type}
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Set Details
                      </Typography>
                      {exercise.reps && exercise.weight_lbs ? (
                        <List dense>
                          {Array.from({ length: exercise.sets || 0 }, (_, setIndex) => (
                            <ListItem key={setIndex} sx={{ py: 0.5 }}>
                              <ListItemText 
                                primary={`Set ${setIndex + 1}`}
                                secondary={`${exercise.reps[setIndex] || exercise.reps[0] || 0} reps × ${exercise.weight_lbs[setIndex] || exercise.weight_lbs[0] || 0} lbs`}
                              />
                            </ListItem>
                          ))}
                        </List>
                      ) : (
                        <Typography variant="body2">No detailed set information available</Typography>
                      )}
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Stack spacing={1}>
                        {exercise.muscle_groups && exercise.muscle_groups.length > 0 && (
                          <Box>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                              Muscle Groups
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                              {exercise.muscle_groups.map((group, i) => (
                                <Chip key={i} label={group} size="small" variant="outlined" />
                              ))}
                            </Box>
                          </Box>
                        )}
                        {exercise.effort_level && (
                          <Box>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                              Effort Level
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <LinearProgress 
                                variant="determinate" 
                                value={exercise.effort_level * 10} 
                                sx={{ flexGrow: 1, height: 8, borderRadius: 4 }}
                              />
                              <Typography variant="body2">{exercise.effort_level}/10</Typography>
                            </Box>
                          </Box>
                        )}
                        {exercise.duration_minutes && (
                          <Box>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                              Duration
                            </Typography>
                            <Typography variant="body2">{exercise.duration_minutes} minutes</Typography>
                          </Box>
                        )}
                        {exercise.notes && (
                          <Box>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                              Notes
                            </Typography>
                            <Typography variant="body2">{exercise.notes}</Typography>
                          </Box>
                        )}
                      </Stack>
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>
            ))}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

export default ClaimedWorkouts;