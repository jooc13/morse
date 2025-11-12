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
  Alert,
  Fade
} from '@mui/material';
import {
  FitnessCenter,
  TrendingUp,
  Timer,
  CalendarToday,
  Upload as UploadIcon,
  CheckCircleOutline,
  ArrowForward
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import WorkoutCharts from './WorkoutCharts';

const MotionPaper = motion(Paper);
const MotionCard = motion(Card);

const Dashboard = ({ deviceUuid, userStats, onStatsUpdate }) => {
  const navigate = useNavigate();
  const [recentWorkouts, setRecentWorkouts] = useState([]);
  const [queueStats, setQueueStats] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadQueueStats, 10000);
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

    const validExtensions = ['.mp3', '.m4a'];
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!validExtensions.includes(fileExtension)) {
      setUploadStatus({ type: 'error', message: 'Please select an MP3 or M4A file' });
      return;
    }

    const timestamp = Date.now();
    const testFilename = `${deviceUuid}_${timestamp}${fileExtension}`;
    const renamedFile = new File([file], testFilename, { type: file.type });

    try {
      setUploading(true);
      setUploadStatus({ type: 'info', message: 'Uploading audio file...' });

      const result = await api.uploadAudio(renamedFile);

      setUploadStatus({
        type: 'success',
        message: 'File uploaded successfully! Processing started.'
      });

      setTimeout(() => {
        loadDashboardData();
        onStatsUpdate();
      }, 1000);

      setTimeout(() => setUploadStatus(null), 5000);

    } catch (error) {
      setUploadStatus({
        type: 'error',
        message: `Upload failed: ${error.response?.data?.error || error.message}`
      });
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      const fakeEvent = { target: { files: [file] } };
      handleFileUpload(fakeEvent);
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

  const StatCard = ({ title, value, icon, subtitle, delay = 0 }) => (
    <MotionCard
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      sx={{
        height: '100%',
        border: '1px solid',
        borderColor: 'divider',
        transition: 'border-color 0.2s',
        '&:hover': {
          borderColor: 'text.secondary',
        }
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box display="flex" alignItems="flex-start" justifyContent="space-between">
          <Box sx={{ flex: 1 }}>
            <Typography
              variant="overline"
              sx={{
                color: 'text.secondary',
                fontSize: '0.7rem',
                fontWeight: 600,
                letterSpacing: '0.1em'
              }}
            >
              {title}
            </Typography>
            <Typography
              variant="h3"
              component="div"
              sx={{
                mt: 1,
                mb: 0.5,
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: 'text.primary'
              }}
            >
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box
            sx={{
              color: 'text.secondary',
              opacity: 0.3,
              transition: 'opacity 0.2s',
              '.MuiCard-root:hover &': {
                opacity: 0.5
              }
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </MotionCard>
  );

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
        <Box sx={{ mb: 4 }}>
          <Typography
            variant="h3"
            sx={{
              fontWeight: 700,
              letterSpacing: '-0.02em',
              mb: 1,
              color: 'text.primary'
            }}
          >
            Dashboard
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            Track your fitness journey with voice-powered insights
          </Typography>
        </Box>
      </motion.div>

      <AnimatePresence>
        {uploadStatus && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <Alert
              severity={uploadStatus.type}
              onClose={() => setUploadStatus(null)}
              icon={uploadStatus.type === 'success' ? <CheckCircleOutline /> : undefined}
              sx={{
                mb: 3,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider'
              }}
            >
              {uploadStatus.message}
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      <Grid container spacing={3}>
        {/* Upload Section */}
        <Grid item xs={12}>
          <MotionPaper
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            sx={{
              p: 4,
              border: '2px dashed',
              borderColor: isDragging ? 'text.primary' : 'divider',
              borderRadius: 3,
              backgroundColor: isDragging ? 'rgba(0, 0, 0, 0.02)' : 'background.paper',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              cursor: 'pointer',
              '&:hover': {
                borderColor: 'text.secondary',
                backgroundColor: 'rgba(0, 0, 0, 0.01)'
              }
            }}
          >
            <Box display="flex" alignItems="center" gap={3} flexWrap="wrap">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  variant="contained"
                  component="label"
                  startIcon={<UploadIcon />}
                  disabled={uploading}
                  sx={{
                    backgroundColor: 'text.primary',
                    color: 'background.paper',
                    px: 3,
                    py: 1.5,
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    '&:hover': {
                      backgroundColor: 'text.secondary',
                    },
                    '&.Mui-disabled': {
                      backgroundColor: 'grey.300',
                      color: 'grey.500'
                    }
                  }}
                >
                  {uploading ? 'Uploading...' : 'Select Audio File'}
                  <input
                    type="file"
                    accept=".mp3,.m4a,audio/mpeg,audio/mp4,audio/m4a"
                    onChange={handleFileUpload}
                    hidden
                  />
                </Button>
              </motion.div>
              <Box>
                <Typography variant="body1" sx={{ fontWeight: 500, color: 'text.primary' }}>
                  Upload workout audio
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                  Drop MP3 or M4A files here, or click to browse
                </Typography>
              </Box>
            </Box>
          </MotionPaper>
        </Grid>

        {/* Stats Cards */}
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Workouts"
            value={userStats?.stats?.total_workouts || 0}
            icon={<FitnessCenter sx={{ fontSize: 40 }} />}
            subtitle={`Since ${userStats?.user?.created_at ? formatDate(userStats.user.created_at) : 'N/A'}`}
            delay={0.1}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Unique Exercises"
            value={userStats?.stats?.unique_exercises || 0}
            icon={<TrendingUp sx={{ fontSize: 40 }} />}
            delay={0.15}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Avg Duration"
            value={formatDuration(userStats?.stats?.avg_workout_duration)}
            icon={<Timer sx={{ fontSize: 40 }} />}
            delay={0.2}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Last Workout"
            value={userStats?.stats?.last_workout_date ? formatDate(userStats.stats.last_workout_date) : 'None'}
            icon={<CalendarToday sx={{ fontSize: 40 }} />}
            delay={0.25}
          />
        </Grid>

        {/* Processing Queue Status */}
        {queueStats && (
          <Grid item xs={12}>
            <MotionPaper
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
              sx={{
                p: 3,
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
                Processing Status
              </Typography>
              <Box display="flex" gap={1.5} flexWrap="wrap" sx={{ mt: 2 }}>
                <Chip
                  label={`${queueStats.waiting} Waiting`}
                  sx={{
                    backgroundColor: queueStats.waiting > 0 ? 'rgba(0, 0, 0, 0.08)' : 'grey.100',
                    color: 'text.primary',
                    fontWeight: 500,
                    borderRadius: 1.5
                  }}
                />
                <Chip
                  label={`${queueStats.active} Processing`}
                  sx={{
                    backgroundColor: queueStats.active > 0 ? 'rgba(0, 0, 0, 0.08)' : 'grey.100',
                    color: 'text.primary',
                    fontWeight: 500,
                    borderRadius: 1.5
                  }}
                />
                <Chip
                  label={`${queueStats.completed} Completed`}
                  sx={{
                    backgroundColor: 'grey.900',
                    color: 'white',
                    fontWeight: 500,
                    borderRadius: 1.5
                  }}
                />
                <Chip
                  label={`${queueStats.failed} Failed`}
                  sx={{
                    backgroundColor: queueStats.failed > 0 ? 'rgba(0, 0, 0, 0.08)' : 'grey.100',
                    color: 'text.primary',
                    fontWeight: 500,
                    borderRadius: 1.5
                  }}
                />
              </Box>
            </MotionPaper>
          </Grid>
        )}

        {/* Recent Workouts */}
        <Grid item xs={12} md={6}>
          <MotionPaper
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.35 }}
            sx={{
              p: 3,
              height: 450,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography
                variant="h6"
                sx={{ fontWeight: 600, letterSpacing: '-0.01em' }}
              >
                Recent Workouts
              </Typography>
              <motion.div whileHover={{ x: 2 }} whileTap={{ scale: 0.95 }}>
                <Button
                  onClick={() => navigate('/workouts')}
                  size="small"
                  endIcon={<ArrowForward sx={{ fontSize: 16 }} />}
                  sx={{
                    color: 'text.secondary',
                    fontWeight: 500,
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.02)',
                      color: 'text.primary'
                    }
                  }}
                >
                  View All
                </Button>
              </motion.div>
            </Box>

            {recentWorkouts.length === 0 ? (
              <Box
                display="flex"
                flexDirection="column"
                justifyContent="center"
                alignItems="center"
                flex={1}
              >
                <FitnessCenter sx={{ fontSize: 48, color: 'grey.300', mb: 2 }} />
                <Typography color="textSecondary" align="center">
                  No workouts yet. Upload an audio file to get started!
                </Typography>
              </Box>
            ) : (
              <List sx={{ flex: 1, overflow: 'auto' }}>
                {recentWorkouts.map((workout, index) => {
                  // Extract unique exercise names from sets
                  const exerciseNames = workout.sets
                    ? [...new Set(workout.sets.map(set => set.exercise_name))]
                    : [];

                  return (
                    <motion.div
                      key={`${workout.workout_date}-${index}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, delay: index * 0.05 }}
                    >
                      <ListItem
                        sx={{
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 2,
                          mb: 1.5,
                          transition: 'all 0.2s',
                          '&:hover': {
                            borderColor: 'text.secondary',
                            backgroundColor: 'rgba(0, 0, 0, 0.01)'
                          }
                        }}
                      >
                        <ListItemText
                          primary={
                            <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
                              {formatDate(workout.workout_date)}
                            </Typography>
                          }
                          secondary={
                            <Box>
                              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                                {workout.total_sets || 0} sets • {exerciseNames.length} exercises • {formatDuration(workout.workout_duration_minutes)}
                              </Typography>
                              <Box display="flex" gap={0.5} flexWrap="wrap">
                                {exerciseNames.slice(0, 3).map((name, idx) => (
                                  <Chip
                                    key={idx}
                                    label={name}
                                    size="small"
                                    sx={{
                                      height: 22,
                                      fontSize: '0.7rem',
                                      backgroundColor: 'grey.100',
                                      fontWeight: 500,
                                      borderRadius: 1
                                    }}
                                  />
                                ))}
                                {exerciseNames.length > 3 && (
                                  <Chip
                                    label={`+${exerciseNames.length - 3}`}
                                    size="small"
                                    sx={{
                                      height: 22,
                                      fontSize: '0.7rem',
                                      backgroundColor: 'grey.900',
                                      color: 'white',
                                      fontWeight: 500,
                                      borderRadius: 1
                                    }}
                                  />
                                )}
                              </Box>
                            </Box>
                          }
                        />
                      </ListItem>
                    </motion.div>
                  );
                })}
              </List>
            )}
          </MotionPaper>
        </Grid>

        {/* Top Exercises */}
        <Grid item xs={12} md={6}>
          <MotionPaper
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.4 }}
            sx={{
              p: 3,
              height: 450,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography
                variant="h6"
                sx={{ fontWeight: 600, letterSpacing: '-0.01em' }}
              >
                Top Exercises
              </Typography>
              <motion.div whileHover={{ x: 2 }} whileTap={{ scale: 0.95 }}>
                <Button
                  onClick={() => navigate('/progress')}
                  size="small"
                  endIcon={<ArrowForward sx={{ fontSize: 16 }} />}
                  sx={{
                    color: 'text.secondary',
                    fontWeight: 500,
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.02)',
                      color: 'text.primary'
                    }
                  }}
                >
                  View Progress
                </Button>
              </motion.div>
            </Box>

            {!userStats?.top_exercises || userStats.top_exercises.length === 0 ? (
              <Box
                display="flex"
                flexDirection="column"
                justifyContent="center"
                alignItems="center"
                flex={1}
              >
                <TrendingUp sx={{ fontSize: 48, color: 'grey.300', mb: 2 }} />
                <Typography color="textSecondary">
                  No exercise data yet
                </Typography>
              </Box>
            ) : (
              <List sx={{ flex: 1, overflow: 'auto' }}>
                {userStats.top_exercises.slice(0, 5).map((exercise, index) => (
                  <motion.div
                    key={exercise.exercise_name}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.05 }}
                  >
                    <ListItem
                      sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2,
                        mb: 1.5,
                        transition: 'all 0.2s',
                        '&:hover': {
                          borderColor: 'text.secondary',
                          backgroundColor: 'rgba(0, 0, 0, 0.01)'
                        }
                      }}
                    >
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: 1.5,
                          backgroundColor: index === 0 ? 'grey.900' : 'grey.100',
                          color: index === 0 ? 'white' : 'text.secondary',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.875rem',
                          mr: 2
                        }}
                      >
                        #{index + 1}
                      </Box>
                      <ListItemText
                        primary={
                          <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
                            {exercise.exercise_name}
                          </Typography>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                              {exercise.frequency} times • Avg effort: {typeof exercise.avg_effort === 'number' ? exercise.avg_effort.toFixed(1) : 'N/A'}
                            </Typography>
                            {exercise.max_weight && (
                              <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500, mt: 0.5 }}>
                                Max weight: {exercise.max_weight} lbs
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                    </ListItem>
                  </motion.div>
                ))}
              </List>
            )}
          </MotionPaper>
        </Grid>

        {/* Workout Charts */}
        <Grid item xs={12}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.45 }}
          >
            <WorkoutCharts deviceUuid={deviceUuid} />
          </motion.div>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
