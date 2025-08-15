import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Box,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  LinearProgress,
  Alert
} from '@mui/material';
import {
  FitnessCenter,
  TrendingUp,
  Timer,
  CalendarToday,
  Upload as UploadIcon
} from '@mui/icons-material';
import api from '../services/api';
import WorkoutCharts from './WorkoutCharts';

const Dashboard = ({ deviceUuid, userStats, onStatsUpdate }) => {
  const navigate = useNavigate();
  const [recentWorkouts, setRecentWorkouts] = useState([]);
  const [queueStats, setQueueStats] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadQueueStats, 10000); // Update queue stats every 10 seconds
    return () => clearInterval(interval);
  }, [deviceUuid]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [workoutsData, queueData] = await Promise.all([
        api.getWorkouts(deviceUuid, { limit: 5 }),
        api.getQueueStats()
      ]);
      
      setRecentWorkouts(workoutsData.workouts || []);
      setQueueStats(queueData);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadQueueStats = async () => {
    try {
      const queueData = await api.getQueueStats();
      setQueueStats(queueData);
    } catch (error) {
      console.error('Failed to load queue stats:', error);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.mp3')) {
      setUploadStatus({ type: 'error', message: 'Please select an MP3 file' });
      return;
    }

    // Generate a test filename with current timestamp
    const timestamp = Date.now();
    const testFilename = `${deviceUuid}_${timestamp}.mp3`;
    
    // Create a new file with the correct name
    const renamedFile = new File([file], testFilename, { type: file.type });

    try {
      setUploading(true);
      setUploadStatus({ type: 'info', message: 'Uploading audio file...' });
      
      const result = await api.uploadAudio(renamedFile);
      
      setUploadStatus({ 
        type: 'success', 
        message: `File uploaded successfully! Processing started.` 
      });
      
      // Refresh data
      setTimeout(() => {
        loadDashboardData();
        onStatsUpdate();
      }, 1000);
      
      // Clear status after 5 seconds
      setTimeout(() => setUploadStatus(null), 5000);
      
    } catch (error) {
      setUploadStatus({ 
        type: 'error', 
        message: `Upload failed: ${error.response?.data?.error || error.message}` 
      });
    } finally {
      setUploading(false);
      event.target.value = ''; // Clear file input
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatDuration = (minutes) => {
    if (!minutes) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const StatCard = ({ title, value, icon, subtitle, color = 'primary' }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography color="textSecondary" gutterBottom variant="body2">
              {title}
            </Typography>
            <Typography variant="h4" component="div" color={color}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="textSecondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box color={`${color}.main`}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>Loading Dashboard...</Typography>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Workout Dashboard
      </Typography>
      
      {uploadStatus && (
        <Alert severity={uploadStatus.type} sx={{ mb: 3 }} onClose={() => setUploadStatus(null)}>
          {uploadStatus.message}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Upload Section */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Upload Workout Audio
            </Typography>
            <Box display="flex" alignItems="center" gap={2}>
              <Button
                variant="contained"
                component="label"
                startIcon={<UploadIcon />}
                disabled={uploading}
              >
                {uploading ? 'Uploading...' : 'Select MP3 File'}
                <input
                  type="file"
                  accept=".mp3,audio/mpeg"
                  onChange={handleFileUpload}
                  hidden
                />
              </Button>
              <Typography variant="body2" color="textSecondary">
                Upload MP3 recordings of your workout descriptions
              </Typography>
            </Box>
          </Paper>
        </Grid>

        {/* Stats Cards */}
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Workouts"
            value={userStats?.stats?.total_workouts || 0}
            icon={<FitnessCenter fontSize="large" />}
            subtitle={`Since ${userStats?.user?.created_at ? formatDate(userStats.user.created_at) : 'N/A'}`}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Unique Exercises"
            value={userStats?.stats?.unique_exercises || 0}
            icon={<TrendingUp fontSize="large" />}
            color="secondary"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Avg Duration"
            value={formatDuration(userStats?.stats?.avg_workout_duration)}
            icon={<Timer fontSize="large" />}
            color="success"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Last Workout"
            value={userStats?.stats?.last_workout_date ? formatDate(userStats.stats.last_workout_date) : 'None'}
            icon={<CalendarToday fontSize="large" />}
            color="info"
          />
        </Grid>

        {/* Processing Queue Status */}
        {queueStats && (
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Processing Status
              </Typography>
              <Box display="flex" gap={2} flexWrap="wrap">
                <Chip 
                  label={`${queueStats.waiting} Waiting`} 
                  color={queueStats.waiting > 0 ? 'warning' : 'default'} 
                />
                <Chip 
                  label={`${queueStats.active} Processing`} 
                  color={queueStats.active > 0 ? 'info' : 'default'} 
                />
                <Chip 
                  label={`${queueStats.completed} Completed`} 
                  color="success" 
                />
                <Chip 
                  label={`${queueStats.failed} Failed`} 
                  color={queueStats.failed > 0 ? 'error' : 'default'} 
                />
              </Box>
            </Paper>
          </Grid>
        )}

        {/* Recent Workouts */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: 400 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Recent Workouts</Typography>
              <Button onClick={() => navigate('/workouts')} size="small">
                View All
              </Button>
            </Box>
            
            {recentWorkouts.length === 0 ? (
              <Box display="flex" justifyContent="center" alignItems="center" height="200px">
                <Typography color="textSecondary">
                  No workouts yet. Upload an audio file to get started!
                </Typography>
              </Box>
            ) : (
              <List>
                {recentWorkouts.map((workout) => (
                  <ListItem key={workout.id} divider>
                    <ListItemText
                      primary={formatDate(workout.workout_date)}
                      secondary={
                        <Box>
                          <Typography variant="body2">
                            {workout.total_exercises} exercises • {formatDuration(workout.workout_duration_minutes)}
                          </Typography>
                          {workout.exercises?.slice(0, 3).map((exercise, idx) => (
                            <Chip
                              key={idx}
                              label={exercise.exercise_name}
                              size="small"
                              sx={{ mr: 0.5, mt: 0.5 }}
                            />
                          ))}
                          {workout.exercises?.length > 3 && (
                            <Chip
                              label={`+${workout.exercises.length - 3} more`}
                              size="small"
                              variant="outlined"
                              sx={{ mt: 0.5 }}
                            />
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>

        {/* Top Exercises */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: 400 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Top Exercises</Typography>
              <Button onClick={() => navigate('/progress')} size="small">
                View Progress
              </Button>
            </Box>
            
            {!userStats?.top_exercises || userStats.top_exercises.length === 0 ? (
              <Box display="flex" justifyContent="center" alignItems="center" height="200px">
                <Typography color="textSecondary">
                  No exercise data yet
                </Typography>
              </Box>
            ) : (
              <List>
                {userStats.top_exercises.slice(0, 5).map((exercise, index) => (
                  <ListItem key={exercise.exercise_name} divider>
                    <ListItemText
                      primary={exercise.exercise_name}
                      secondary={
                        <Box>
                          <Typography variant="body2">
                            {exercise.frequency} times • Avg effort: {typeof exercise.avg_effort === 'number' ? exercise.avg_effort.toFixed(1) : 'N/A'}
                          </Typography>
                          {exercise.max_weight && (
                            <Typography variant="body2" color="primary">
                              Max weight: {exercise.max_weight} lbs
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                    <Box sx={{ minWidth: 35 }}>
                      <Typography variant="h6" color="primary">
                        #{index + 1}
                      </Typography>
                    </Box>
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>

        {/* Workout Charts */}
        <Grid item xs={12}>
          <WorkoutCharts deviceUuid={deviceUuid} />
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;