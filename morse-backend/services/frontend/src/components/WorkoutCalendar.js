import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  ButtonGroup,
  Button,
  Badge,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Divider,
  Stack,
  Avatar
} from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
  Today,
  FitnessCenter,
  Schedule,
  TrendingUp,
  CalendarMonth,
  ViewWeek,
  ViewDay,
  MonitorWeight,
  Timer,
  EmojiEvents,
  ArrowBack
} from '@mui/icons-material';
import api from '../services/api';

const WorkoutCalendar = () => {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('day'); // 'day', 'week', 'month' - default to day
  const [workouts, setWorkouts] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayWorkouts, setDayWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});

  useEffect(() => {
    loadWorkouts();
  }, [currentDate, viewMode]);

  const loadWorkouts = async () => {
    try {
      setLoading(true);
      const response = await api.getClaimedWorkouts({ limit: 200 });
      const workoutsData = response.workouts || [];
      setWorkouts(workoutsData);
      calculateStats(workoutsData);
    } catch (error) {
      console.error('Failed to load workouts:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (workoutsData) => {
    const thisMonth = workoutsData.filter(w => 
      w.workout_date && new Date(w.workout_date).getMonth() === currentDate.getMonth()
    );
    
    const totalWorkouts = thisMonth.length;
    const totalExercises = thisMonth.reduce((sum, w) => sum + (w.total_exercises || 0), 0);
    const totalMinutes = thisMonth.reduce((sum, w) => sum + (w.workout_duration_minutes || 0), 0);
    const avgDuration = totalWorkouts > 0 ? Math.round(totalMinutes / totalWorkouts) : 0;
    
    setStats({
      totalWorkouts,
      totalExercises,
      totalMinutes,
      avgDuration,
      streak: calculateStreak(workoutsData)
    });
  };

  const calculateStreak = (workoutsData) => {
    const sortedDates = [...new Set(workoutsData.map(w => w.workout_date?.split('T')[0]))]
      .sort().reverse();
    
    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < sortedDates.length; i++) {
      const workoutDate = new Date(sortedDates[i]);
      workoutDate.setHours(0, 0, 0, 0);
      
      const diffDays = Math.floor((currentDate - workoutDate) / (1000 * 60 * 60 * 24));
      
      if (diffDays === streak) {
        streak++;
        currentDate = new Date(workoutDate);
      } else {
        break;
      }
    }
    
    return streak;
  };

  const getWorkoutsForDate = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    return workouts.filter(workout => 
      workout.workout_date && workout.workout_date.startsWith(dateStr)
    );
  };

  const getWorkoutIntensity = (workout) => {
    if (!workout.exercises || workout.exercises.length === 0) return 'low';
    
    const avgEffort = workout.exercises.reduce((sum, ex) => sum + (ex.effort_level || 5), 0) / workout.exercises.length;
    if (avgEffort >= 8) return 'high';
    if (avgEffort >= 6) return 'medium';
    return 'low';
  };

  const getIntensityColor = (intensity) => {
    switch (intensity) {
      case 'high': return '#ff4444';
      case 'medium': return '#ff8800';
      case 'low': return '#00e5ff';
      default: return '#666';
    }
  };

  const handleNavigation = (direction) => {
    const newDate = new Date(currentDate);
    
    switch (viewMode) {
      case 'day':
        newDate.setDate(newDate.getDate() + direction);
        break;
      case 'week':
        newDate.setDate(newDate.getDate() + (direction * 7));
        break;
      case 'month':
        newDate.setMonth(newDate.getMonth() + direction);
        break;
    }
    
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleDayClick = (date) => {
    const workoutsForDay = getWorkoutsForDate(date);
    setSelectedDay(date);
    setDayWorkouts(workoutsForDay);
  };

  const formatDateHeader = () => {
    switch (viewMode) {
      case 'day':
        return currentDate.toLocaleDateString('en-US', { 
          weekday: 'long', 
          month: 'long', 
          day: 'numeric', 
          year: 'numeric' 
        });
      case 'week':
        const weekStart = new Date(currentDate);
        weekStart.setDate(currentDate.getDate() - currentDate.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      case 'month':
        return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
  };

  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
      <Grid container spacing={1}>
        {/* Day headers */}
        {weekDays.map(day => (
          <Grid item xs={12/7} key={day}>
            <Box textAlign="center" py={1}>
              <Typography variant="body2" color="text.secondary" fontWeight={600}>
                {day}
              </Typography>
            </Box>
          </Grid>
        ))}
        
        {/* Calendar days */}
        {days.map((date, index) => {
          const dayWorkouts = date ? getWorkoutsForDate(date) : [];
          const hasWorkouts = dayWorkouts.length > 0;
          const isToday = date && date.toDateString() === new Date().toDateString();
          
          return (
            <Grid item xs={12/7} key={index}>
              <Box
                sx={{
                  minHeight: 120,
                  p: 1,
                  cursor: date ? 'pointer' : 'default',
                  borderRadius: 2,
                  backgroundColor: date && isToday ? 'rgba(0, 229, 255, 0.1)' : 'transparent',
                  border: date && isToday ? '2px solid rgba(0, 229, 255, 0.3)' : '1px solid rgba(255,255,255,0.1)',
                  '&:hover': date ? {
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255,255,255,0.2)'
                  } : {},
                  transition: 'all 0.2s ease'
                }}
                onClick={() => date && handleDayClick(date)}
              >
                {date && (
                  <>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontWeight: isToday ? 600 : 400,
                        color: isToday ? 'primary.main' : 'text.primary',
                        mb: 1
                      }}
                    >
                      {date.getDate()}
                    </Typography>
                    
                    {hasWorkouts && (
                      <Stack spacing={0.5}>
                        {dayWorkouts.slice(0, 3).map((workout, idx) => {
                          const intensity = getWorkoutIntensity(workout);
                          return (
                            <Box
                              key={idx}
                              sx={{
                                height: 4,
                                borderRadius: 1,
                                backgroundColor: getIntensityColor(intensity),
                                opacity: 0.8
                              }}
                            />
                          );
                        })}
                        {dayWorkouts.length > 3 && (
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
                            +{dayWorkouts.length - 3} more
                          </Typography>
                        )}
                        
                        <Box display="flex" justifyContent="space-between" alignItems="center" mt={1}>
                          <FitnessCenter sx={{ fontSize: 12, color: 'primary.main' }} />
                          <Typography variant="caption" color="primary.main">
                            {dayWorkouts.length}
                          </Typography>
                        </Box>
                      </Stack>
                    )}
                  </>
                )}
              </Box>
            </Grid>
          );
        })}
      </Grid>
    );
  };

  const renderWeekView = () => {
    const weekStart = new Date(currentDate);
    weekStart.setDate(currentDate.getDate() - currentDate.getDay());
    
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      weekDays.push(day);
    }

    return (
      <Grid container spacing={1}>
        {weekDays.map((date, index) => {
          const dayWorkouts = getWorkoutsForDate(date);
          const isToday = date.toDateString() === new Date().toDateString();
          
          return (
            <Grid item xs={12/7} key={index}>
              <Paper 
                sx={{ 
                  minHeight: 400,
                  p: 2,
                  cursor: 'pointer',
                  backgroundColor: isToday ? 'rgba(0, 229, 255, 0.05)' : 'transparent',
                  border: isToday ? '2px solid rgba(0, 229, 255, 0.3)' : '1px solid rgba(255,255,255,0.1)',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.02)'
                  }
                }}
                onClick={() => handleDayClick(date)}
              >
                <Typography 
                  variant="h6" 
                  sx={{ 
                    fontWeight: isToday ? 600 : 400,
                    color: isToday ? 'primary.main' : 'text.primary',
                    mb: 1
                  }}
                >
                  {date.getDate()}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {date.toLocaleDateString('en-US', { weekday: 'short' })}
                </Typography>
                
                <Stack spacing={1}>
                  {dayWorkouts.map((workout, idx) => {
                    const intensity = getWorkoutIntensity(workout);
                    return (
                      <Card 
                        key={idx} 
                        sx={{ 
                          backgroundColor: `${getIntensityColor(intensity)}20`,
                          border: `1px solid ${getIntensityColor(intensity)}60`
                        }}
                      >
                        <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                          <Typography variant="caption" fontWeight={600}>
                            {workout.total_exercises} exercises
                          </Typography>
                          {workout.workout_duration_minutes && (
                            <Typography variant="caption" display="block" color="text.secondary">
                              {workout.workout_duration_minutes}min
                            </Typography>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </Stack>
              </Paper>
            </Grid>
          );
        })}
      </Grid>
    );
  };

  const renderDayView = () => {
    const dayWorkouts = getWorkoutsForDate(currentDate);
    
    return (
      <Box>
        <Grid container spacing={3}>
          {dayWorkouts.length === 0 ? (
            <Grid item xs={12}>
              <Box textAlign="center" py={8}>
                <FitnessCenter sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h5" color="text.secondary" gutterBottom>
                  No workouts on this day
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Time to get moving!
                </Typography>
              </Box>
            </Grid>
          ) : (
            dayWorkouts.map((workout, index) => {
              const intensity = getWorkoutIntensity(workout);
              return (
                <Grid item xs={12} md={6} key={workout.id}>
                  <Card 
                    sx={{ 
                      backgroundColor: `${getIntensityColor(intensity)}10`,
                      border: `1px solid ${getIntensityColor(intensity)}40`,
                      height: '100%'
                    }}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Box display="flex" justifyContent="between" alignItems="flex-start" mb={2}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Avatar 
                            sx={{ 
                              backgroundColor: getIntensityColor(intensity),
                              width: 32,
                              height: 32
                            }}
                          >
                            <FitnessCenter sx={{ fontSize: 18 }} />
                          </Avatar>
                          <Typography variant="h6" fontWeight={600}>
                            Workout {index + 1}
                          </Typography>
                        </Box>
                        <Chip 
                          label={intensity.toUpperCase()} 
                          size="small" 
                          sx={{ 
                            backgroundColor: getIntensityColor(intensity),
                            color: 'white',
                            fontWeight: 600
                          }}
                        />
                      </Box>
                      
                      <Grid container spacing={2} sx={{ mb: 2 }}>
                        <Grid item xs={6}>
                          <Box display="flex" alignItems="center" gap={1}>
                            <FitnessCenter sx={{ fontSize: 16, color: 'text.secondary' }} />
                            <Typography variant="body2" color="text.secondary">
                              {workout.total_exercises} exercises
                            </Typography>
                          </Box>
                        </Grid>
                        {workout.workout_duration_minutes && (
                          <Grid item xs={6}>
                            <Box display="flex" alignItems="center" gap={1}>
                              <Schedule sx={{ fontSize: 16, color: 'text.secondary' }} />
                              <Typography variant="body2" color="text.secondary">
                                {workout.workout_duration_minutes} minutes
                              </Typography>
                            </Box>
                          </Grid>
                        )}
                      </Grid>
                      
                      {workout.exercises && workout.exercises.length > 0 && (
                        <Box>
                          <Typography variant="subtitle2" gutterBottom>
                            Exercises:
                          </Typography>
                          <Box display="flex" gap={0.5} flexWrap="wrap">
                            {workout.exercises.slice(0, 8).map((exercise, idx) => (
                              <Chip 
                                key={idx}
                                label={`${exercise.exercise_name} ${exercise.sets ? `(${exercise.sets}x${exercise.reps || exercise.weight_lbs || '?'})` : ''}`}
                                size="small"
                                variant="outlined"
                                sx={{ mb: 0.5 }}
                              />
                            ))}
                            {workout.exercises.length > 8 && (
                              <Chip 
                                label={`+${workout.exercises.length - 8} more`}
                                size="small"
                                variant="outlined"
                              />
                            )}
                          </Box>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              );
            })
          )}
        </Grid>
      </Box>
    );
  };

  return (
    <Box>
      {/* Stats Overview */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ backgroundColor: 'rgba(0, 229, 255, 0.1)', border: '1px solid rgba(0, 229, 255, 0.3)' }}>
            <CardContent sx={{ textAlign: 'center', p: 2 }}>
              <EmojiEvents sx={{ fontSize: 32, color: '#00e5ff', mb: 1 }} />
              <Typography variant="h4" color="#00e5ff" fontWeight={700}>
                {stats.totalWorkouts || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Workouts This Month
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ backgroundColor: 'rgba(255, 107, 107, 0.1)', border: '1px solid rgba(255, 107, 107, 0.3)' }}>
            <CardContent sx={{ textAlign: 'center', p: 2 }}>
              <Timer sx={{ fontSize: 32, color: '#ff6b6b', mb: 1 }} />
              <Typography variant="h4" color="#ff6b6b" fontWeight={700}>
                {stats.totalMinutes || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Minutes Trained
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ backgroundColor: 'rgba(76, 175, 80, 0.1)', border: '1px solid rgba(76, 175, 80, 0.3)' }}>
            <CardContent sx={{ textAlign: 'center', p: 2 }}>
              <MonitorWeight sx={{ fontSize: 32, color: '#4caf50', mb: 1 }} />
              <Typography variant="h4" color="#4caf50" fontWeight={700}>
                {stats.totalExercises || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Exercises
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ backgroundColor: 'rgba(255, 152, 0, 0.1)', border: '1px solid rgba(255, 152, 0, 0.3)' }}>
            <CardContent sx={{ textAlign: 'center', p: 2 }}>
              <TrendingUp sx={{ fontSize: 32, color: '#ff9800', mb: 1 }} />
              <Typography variant="h4" color="#ff9800" fontWeight={700}>
                {stats.streak || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Day Streak
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Calendar Controls */}
      <Paper sx={{ p: 3 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
          <Box display="flex" alignItems="center" gap={2}>
            <IconButton 
              onClick={() => navigate('/')}
              sx={{ 
                backgroundColor: 'rgba(0, 229, 255, 0.1)',
                border: '1px solid rgba(0, 229, 255, 0.3)',
                '&:hover': {
                  backgroundColor: 'rgba(0, 229, 255, 0.2)'
                }
              }}
            >
              <ArrowBack />
            </IconButton>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              Workout Calendar
            </Typography>
          </Box>
          
          <Box display="flex" alignItems="center" gap={2}>
            {/* View Mode Selector */}
            <ButtonGroup variant="outlined" size="small">
              <Button 
                variant={viewMode === 'day' ? 'contained' : 'outlined'}
                onClick={() => setViewMode('day')}
                startIcon={<ViewDay />}
              >
                Day
              </Button>
              <Button 
                variant={viewMode === 'week' ? 'contained' : 'outlined'}
                onClick={() => setViewMode('week')}
                startIcon={<ViewWeek />}
              >
                Week
              </Button>
              <Button 
                variant={viewMode === 'month' ? 'contained' : 'outlined'}
                onClick={() => setViewMode('month')}
                startIcon={<CalendarMonth />}
              >
                Month
              </Button>
            </ButtonGroup>
            
            {/* Navigation */}
            <Box display="flex" alignItems="center" gap={1}>
              <IconButton onClick={() => handleNavigation(-1)}>
                <ChevronLeft />
              </IconButton>
              <Button 
                onClick={goToToday}
                startIcon={<Today />}
                size="small"
              >
                Today
              </Button>
              <IconButton onClick={() => handleNavigation(1)}>
                <ChevronRight />
              </IconButton>
            </Box>
          </Box>
        </Box>

        {/* Date Header */}
        <Typography variant="h6" sx={{ mb: 3, textAlign: 'center', fontWeight: 500 }}>
          {formatDateHeader()}
        </Typography>

        {loading ? (
          <Box>
            <LinearProgress sx={{ mb: 2 }} />
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Loading workouts...
            </Typography>
          </Box>
        ) : (
          <>
            {viewMode === 'month' && renderMonthView()}
            {viewMode === 'week' && renderWeekView()}
            {viewMode === 'day' && renderDayView()}
          </>
        )}
      </Paper>

      {/* Day Detail Dialog */}
      <Dialog 
        open={!!selectedDay} 
        onClose={() => setSelectedDay(null)}
        maxWidth="lg" 
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <FitnessCenter color="primary" />
            Workouts for {selectedDay?.toLocaleDateString('en-US', { 
              weekday: 'long', 
              month: 'long', 
              day: 'numeric', 
              year: 'numeric' 
            })}
          </Box>
        </DialogTitle>
        <DialogContent>
          {dayWorkouts.length === 0 ? (
            <Box textAlign="center" py={4}>
              <FitnessCenter sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                No workouts on this day
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                A perfect day for some exercise!
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={2}>
              {dayWorkouts.map((workout, index) => {
                const intensity = getWorkoutIntensity(workout);
                return (
                  <Grid item xs={12} md={6} key={workout.id}>
                    <Card 
                      sx={{ 
                        backgroundColor: `${getIntensityColor(intensity)}15`,
                        border: `1px solid ${getIntensityColor(intensity)}40`
                      }}
                    >
                      <CardContent>
                        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                          <Typography variant="h6" fontWeight={600}>
                            Workout {index + 1}
                          </Typography>
                          <Chip 
                            label={intensity} 
                            size="small" 
                            sx={{ 
                              backgroundColor: getIntensityColor(intensity),
                              color: 'white'
                            }}
                          />
                        </Box>
                        
                        <Stack spacing={1} sx={{ mb: 2 }}>
                          <Box display="flex" alignItems="center" gap={1}>
                            <FitnessCenter sx={{ fontSize: 16 }} />
                            <Typography variant="body2">
                              {workout.total_exercises} exercises
                            </Typography>
                          </Box>
                          
                          {workout.workout_duration_minutes && (
                            <Box display="flex" alignItems="center" gap={1}>
                              <Schedule sx={{ fontSize: 16 }} />
                              <Typography variant="body2">
                                {workout.workout_duration_minutes} minutes
                              </Typography>
                            </Box>
                          )}
                        </Stack>
                        
                        {workout.exercises && workout.exercises.length > 0 && (
                          <Box>
                            <Typography variant="subtitle2" gutterBottom>
                              Exercises:
                            </Typography>
                            <Box display="flex" gap={0.5} flexWrap="wrap">
                              {workout.exercises.map((exercise, idx) => (
                                <Chip 
                                  key={idx}
                                  label={exercise.exercise_name}
                                  size="small"
                                  variant="outlined"
                                />
                              ))}
                            </Box>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedDay(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default WorkoutCalendar;