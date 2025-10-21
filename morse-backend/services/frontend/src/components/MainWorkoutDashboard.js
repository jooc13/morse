import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Stack,
  Avatar,
  LinearProgress,
  IconButton,
  Divider,
  Switch,
  FormControlLabel,
  Alert
} from '@mui/material';
import {
  FitnessCenter,
  TrendingUp,
  Add,
  ChevronRight,
  ChevronLeft,
  Today,
  EmojiEvents,
  MonitorWeight,
  Timeline,
  GroupWork,
  ViewList,
  Refresh
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import NotionStyleWorkoutCard from './NotionStyleWorkoutCard';
import { groupWorkoutsBySession, generateRecommendations, getWorkoutInsights } from '../utils/workoutGrouping';

const MainWorkoutDashboard = ({ user }) => {
  const navigate = useNavigate();
  const [workouts, setWorkouts] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groupWorkouts, setGroupWorkouts] = useState(true);
  const [currentDateOffset, setCurrentDateOffset] = useState(0); // Days from today
  const [recommendations, setRecommendations] = useState([]);
  const [insights, setInsights] = useState({});

  useEffect(() => {
    loadAllWorkouts();
  }, []);

  const loadAllWorkouts = async () => {
    try {
      setLoading(true);
      const result = await api.getClaimedWorkouts({ limit: 200 });
      const workoutsData = result.workouts || [];
      setWorkouts(workoutsData);
      
      // Process into sessions
      const groupedSessions = groupWorkoutsBySession(workoutsData);
      setSessions(groupedSessions);
      
      // Generate recommendations
      const recs = generateRecommendations(workoutsData, groupedSessions.slice(-5));
      setRecommendations(recs);
      
      // Get insights
      const workoutInsights = getWorkoutInsights(groupedSessions);
      setInsights(workoutInsights);
      
    } catch (error) {
      console.error('Failed to load workouts:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get current viewing date
  const getCurrentDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + currentDateOffset);
    return date;
  };

  // Get workouts for current viewing date
  const getWorkoutsForCurrentDate = () => {
    const currentDate = getCurrentDate();
    const dateStr = currentDate.toISOString().split('T')[0];
    
    const data = groupWorkouts ? sessions : workouts;
    return data.filter(item => 
      item.workout_date && item.workout_date.startsWith(dateStr)
    );
  };

  // Get recent workouts (last 7 days)
  const getRecentWorkouts = () => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const data = groupWorkouts ? sessions : workouts;
    return data
      .filter(item => new Date(item.workout_date) >= sevenDaysAgo)
      .sort((a, b) => new Date(b.workout_date) - new Date(a.workout_date))
      .slice(0, 10);
  };

  const navigateDate = (direction) => {
    setCurrentDateOffset(prev => prev + direction);
  };

  const goToToday = () => {
    setCurrentDateOffset(0);
  };

  const formatDateHeader = (date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return "Tomorrow";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  const currentDate = getCurrentDate();
  const currentDateWorkouts = getWorkoutsForCurrentDate();
  const recentWorkouts = getRecentWorkouts();
  const isToday = currentDateOffset === 0;

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>Loading Workouts...</Typography>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header with Navigation */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography 
            variant="h4" 
            sx={{ 
              fontWeight: 600,
              color: 'text.primary',
              mb: 0.5
            }}
          >
            Workouts
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {workouts.length === 0 ? 'Start tracking your fitness journey' : `${groupWorkouts ? sessions.length : workouts.length} ${groupWorkouts ? 'sessions' : 'workouts'} recorded`}
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => navigate('/search')}
          >
            Link Device
          </Button>
          <Button
            variant="outlined" 
            size="small"
            onClick={() => navigate('/teams')}
          >
            Teams
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={<Add />}
            onClick={() => navigate('/upload-test')}
          >
            Add Workout
          </Button>
        </Box>
      </Box>

      {/* Simple Progress Summary */}
      {workouts.length > 0 && (
        <Box sx={{ mb: 3, display: 'flex', gap: 3, alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography variant="body2" color="text.secondary">
            <strong>{groupWorkouts ? sessions.length : workouts.length}</strong> {groupWorkouts ? 'sessions' : 'workouts'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            <strong>{Math.round(insights.workouts_per_week || 0)}</strong> per week
          </Typography>
          <Typography variant="body2" color="text.secondary">
            <strong>{insights.total_exercises || 0}</strong> total exercises
          </Typography>
        </Box>
      )}

      {/* Simple Recommendations */}
      {recommendations.length > 0 && (
        <Box sx={{ mb: 3, p: 2, backgroundColor: 'rgba(255, 255, 255, 0.02)', borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Suggestions for next time:
          </Typography>
          {recommendations.slice(0, 2).map((rec, index) => (
            <Typography key={index} variant="body2" sx={{ mb: 0.5 }}>
              • {rec.exercise_name}: {rec.reason}
            </Typography>
          ))}
        </Box>
      )}

      <Grid container spacing={3}>
        {/* Current Day Focus */}
        <Grid item xs={12} lg={8}>
          {/* Date Navigation */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <IconButton onClick={() => navigateDate(-1)}>
                    <ChevronLeft />
                  </IconButton>
                  <Box sx={{ textAlign: 'center', minWidth: 200 }}>
                    <Typography variant="h5" sx={{ fontWeight: 600 }}>
                      {formatDateHeader(currentDate)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {currentDate.toLocaleDateString('en-US', { 
                        month: 'long', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                    </Typography>
                  </Box>
                  <IconButton onClick={() => navigateDate(1)}>
                    <ChevronRight />
                  </IconButton>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {!isToday && (
                    <Button 
                      onClick={goToToday}
                      startIcon={<Today />}
                      size="small"
                    >
                      Today
                    </Button>
                  )}
                  <IconButton onClick={loadAllWorkouts}>
                    <Refresh />
                  </IconButton>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Current Day's Workouts */}
          <Box sx={{ mb: 3 }}>
            {currentDateWorkouts.length === 0 ? (
              <Card sx={{ backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                <CardContent sx={{ textAlign: 'center', py: 6 }}>
                  <FitnessCenter sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h5" color="text.secondary" gutterBottom>
                    {isToday ? 'No workout today' : 'No workout on this day'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    {isToday ? 'Time to get moving!' : 'Check another day or start tracking workouts.'}
                  </Typography>
                  {isToday && (
                    <Button
                      variant="contained"
                      startIcon={<Add />}
                      onClick={() => navigate('/upload-test')}
                    >
                      Start Workout
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Box>
                {currentDateWorkouts.map((workout) => (
                  <NotionStyleWorkoutCard 
                    key={workout.session_id || workout.workout_id} 
                    workout={workout}
                  />
                ))}
              </Box>
            )}
          </Box>
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} lg={4}>
          {/* View Toggle */}
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ py: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={groupWorkouts}
                    onChange={(e) => setGroupWorkouts(e.target.checked)}
                    color="primary"
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {groupWorkouts ? <GroupWork /> : <ViewList />}
                    <Typography variant="body2">
                      {groupWorkouts ? 'Grouped Sessions' : 'Individual Workouts'}
                    </Typography>
                  </Box>
                }
              />
              <Typography variant="caption" color="text.secondary" sx={{ ml: 4, display: 'block' }}>
                {groupWorkouts ? 
                  'Audio files within 3 hours are combined into workout sessions' : 
                  'Show each audio file as a separate workout'
                }
              </Typography>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Timeline color="primary" />
                Recent Activity
              </Typography>
              <Stack spacing={2}>
                {recentWorkouts.slice(0, 5).map((workout, index) => {
                  const workoutDate = new Date(workout.workout_date);
                  const isToday = workoutDate.toDateString() === new Date().toDateString();
                  const isThisWeek = workoutDate > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                  
                  return (
                    <Box 
                      key={workout.session_id || workout.workout_id}
                      sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 2,
                        p: 1.5,
                        borderRadius: 1,
                        backgroundColor: isToday ? 'rgba(76, 175, 80, 0.1)' : 
                                        isThisWeek ? 'rgba(0, 229, 255, 0.05)' : 
                                        'rgba(255, 255, 255, 0.02)',
                        border: `1px solid ${isToday ? 'rgba(76, 175, 80, 0.3)' : 
                                               isThisWeek ? 'rgba(0, 229, 255, 0.1)' : 
                                               'rgba(255, 255, 255, 0.1)'}`,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          backgroundColor: 'rgba(0, 229, 255, 0.1)',
                          borderColor: 'rgba(0, 229, 255, 0.3)'
                        }
                      }}
                      onClick={() => {
                        const daysDiff = Math.floor((workoutDate - new Date()) / (1000 * 60 * 60 * 24));
                        setCurrentDateOffset(daysDiff);
                      }}
                    >
                      <Avatar sx={{ 
                        bgcolor: isToday ? '#4caf50' : isThisWeek ? 'primary.main' : 'text.secondary',
                        width: 32, 
                        height: 32 
                      }}>
                        <FitnessCenter sx={{ fontSize: 16 }} />
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {workoutDate.toLocaleDateString('en-US', { 
                            weekday: 'short', 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                          {isToday && <Chip label="Today" size="small" color="success" sx={{ ml: 1 }} />}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {workout.total_exercises || 0} exercises
                          {workout.session_duration_minutes && ` • ${workout.session_duration_minutes}min`}
                        </Typography>
                      </Box>
                      <ChevronRight sx={{ color: 'text.secondary' }} />
                    </Box>
                  );
                })}
              </Stack>
              
              {recentWorkouts.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                  No recent workouts. Start tracking to see your progress!
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default MainWorkoutDashboard;