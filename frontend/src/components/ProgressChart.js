import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  LinearProgress,
  Chip
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Timeline, TrendingUp, ShowChart } from '@mui/icons-material';
import { motion } from 'framer-motion';
import api from '../services/api';

const MotionPaper = motion(Paper);
const MotionCard = motion(Card);

// Professional monochrome color palette for charts
const MONOCHROME_COLORS = [
  '#000000', // Pure black
  '#1a1a1a', // Very dark gray
  '#2a2a2a', // Dark gray
  '#404040', // Medium-dark gray
  '#606060', // Medium gray
  '#787878', // Medium-light gray
  '#9e9e9e', // Light gray
  '#b3b3b3', // Very light gray
  '#cccccc', // Extra light gray
  '#e0e0e0', // Lightest gray
];

const ProgressChart = ({ deviceUuid }) => {
  const [progressData, setProgressData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedExercise, setSelectedExercise] = useState('');
  const [selectedDays, setSelectedDays] = useState(30);
  const [availableExercises, setAvailableExercises] = useState([]);

  useEffect(() => {
    loadProgressData();
  }, [deviceUuid, selectedExercise, selectedDays]);

  const loadProgressData = async () => {
    try {
      setLoading(true);
      const response = await api.getProgress(deviceUuid, {
        exercise: selectedExercise || undefined,
        days: selectedDays
      });
      
      setProgressData(response);
      
      // Extract unique exercises for the dropdown
      if (!selectedExercise && response.progress) {
        const exercises = [...new Set(response.progress.map(p => p.exercise_name))];
        setAvailableExercises(exercises);
      }
      
    } catch (error) {
      console.error('Failed to load progress data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const prepareChartData = () => {
    if (!progressData?.progress) return [];
    
    if (selectedExercise) {
      // For specific exercise, show progress over time
      const exerciseData = progressData.progress
        .filter(p => p.exercise_name.toLowerCase().includes(selectedExercise.toLowerCase()))
        .sort((a, b) => new Date(a.recorded_date) - new Date(b.recorded_date));
      
      const groupedByDate = exerciseData.reduce((acc, item) => {
        const date = item.recorded_date;
        if (!acc[date]) {
          acc[date] = { date: formatDate(date) };
        }
        acc[date][item.metric_type] = item.metric_value;
        return acc;
      }, {});
      
      return Object.values(groupedByDate);
    } else {
      // Show overview of all exercises
      const groupedByExercise = progressData.progress.reduce((acc, item) => {
        const exercise = item.exercise_name;
        if (!acc[exercise]) {
          acc[exercise] = { exercise_name: exercise, total_records: 0 };
        }
        acc[exercise].total_records = item.total_records;
        acc[exercise][`max_${item.metric_type}`] = item.max_value;
        acc[exercise].last_recorded = item.last_recorded;
        return acc;
      }, {});
      
      return Object.values(groupedByExercise);
    }
  };

  const getMetricColor = (metric) => {
    switch (metric) {
      case 'weight': return '#000000';
      case 'reps': return '#2a2a2a';
      case 'duration': return '#404040';
      case 'distance': return '#606060';
      default: return '#1a1a1a';
    }
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <Paper
          sx={{
            p: 1.5,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1.5,
            backgroundColor: 'background.paper',
            boxShadow: 2
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
            {label}
          </Typography>
          {payload.map((entry, index) => (
            <Typography
              key={index}
              variant="caption"
              sx={{
                color: entry.color || 'text.primary',
                display: 'block',
                fontWeight: 500
              }}
            >
              {`${entry.name}: ${entry.value}`}
            </Typography>
          ))}
        </Paper>
      );
    }
    return null;
  };

  const chartData = prepareChartData();

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
          <Timeline sx={{ fontSize: 28, color: 'text.primary' }} />
          <Box>
            <Typography
              variant="h3"
              sx={{
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: 'text.primary'
              }}
            >
              Progress Tracking
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', mt: 0.5 }}>
              Track your performance and improvements over time
            </Typography>
          </Box>
        </Box>
      </motion.div>

      {/* Controls */}
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
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={4}>
            <FormControl fullWidth>
              <InputLabel>Time Period</InputLabel>
              <Select
                value={selectedDays}
                label="Time Period"
                onChange={(e) => setSelectedDays(e.target.value)}
              >
                <MenuItem value={7}>Last 7 days</MenuItem>
                <MenuItem value={30}>Last 30 days</MenuItem>
                <MenuItem value={90}>Last 3 months</MenuItem>
                <MenuItem value={365}>Last year</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={6} md={4}>
            <FormControl fullWidth>
              <InputLabel>Exercise (Optional)</InputLabel>
              <Select
                value={selectedExercise}
                label="Exercise (Optional)"
                onChange={(e) => setSelectedExercise(e.target.value)}
              >
                <MenuItem value="">All Exercises</MenuItem>
                {availableExercises.map((exercise) => (
                  <MenuItem key={exercise} value={exercise}>
                    {exercise}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </MotionPaper>

      {/* Summary Stats */}
      {progressData?.summary && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <MotionCard
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, delay: 0.15 }}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                transition: 'all 0.2s',
                '&:hover': {
                  borderColor: 'text.secondary',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)'
                }
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Typography
                  variant="overline"
                  sx={{
                    color: 'text.secondary',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    letterSpacing: '0.1em'
                  }}
                >
                  Total Workouts
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 700, mt: 1, mb: 0.5 }}>
                  {progressData.summary.total_workouts || 0}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Last {selectedDays} days
                </Typography>
              </CardContent>
            </MotionCard>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <MotionCard
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, delay: 0.2 }}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                transition: 'all 0.2s',
                '&:hover': {
                  borderColor: 'text.secondary',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)'
                }
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Typography
                  variant="overline"
                  sx={{
                    color: 'text.secondary',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    letterSpacing: '0.1em'
                  }}
                >
                  Unique Exercises
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 700, mt: 1 }}>
                  {progressData.summary.unique_exercises || 0}
                </Typography>
              </CardContent>
            </MotionCard>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <MotionCard
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, delay: 0.25 }}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                transition: 'all 0.2s',
                '&:hover': {
                  borderColor: 'text.secondary',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)'
                }
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Typography
                  variant="overline"
                  sx={{
                    color: 'text.secondary',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    letterSpacing: '0.1em'
                  }}
                >
                  Avg Duration
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 700, mt: 1 }}>
                  {progressData.summary.avg_workout_duration ?
                    `${Math.round(progressData.summary.avg_workout_duration)}m` : 'N/A'}
                </Typography>
              </CardContent>
            </MotionCard>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <MotionCard
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, delay: 0.3 }}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                transition: 'all 0.2s',
                '&:hover': {
                  borderColor: 'text.secondary',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)'
                }
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Typography
                  variant="overline"
                  sx={{
                    color: 'text.secondary',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    letterSpacing: '0.1em'
                  }}
                >
                  Last Workout
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 600, mt: 1 }}>
                  {progressData.summary.last_workout_date ?
                    formatDate(progressData.summary.last_workout_date) : 'None'}
                </Typography>
              </CardContent>
            </MotionCard>
          </Grid>
        </Grid>
      )}

      {/* Charts */}
      {chartData.length === 0 ? (
        <MotionPaper
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.35 }}
          sx={{
            p: 6,
            textAlign: 'center',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2
          }}
        >
          <ShowChart sx={{ fontSize: 64, color: 'grey.300', mb: 2 }} />
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, color: 'text.primary' }}>
            No progress data available
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {selectedExercise
              ? `No data found for "${selectedExercise}" in the selected time period.`
              : 'Complete some workouts to see your progress here!'
            }
          </Typography>
        </MotionPaper>
      ) : (
        <Grid container spacing={3}>
          {selectedExercise ? (
            // Specific exercise progress over time
            <Grid item xs={12}>
              <MotionPaper
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.35 }}
                sx={{
                  p: 3,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2
                }}
              >
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 600, mb: 3, letterSpacing: '-0.01em' }}
                >
                  {selectedExercise} Progress Over Time
                </Typography>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#666666', fontSize: 12 }}
                      stroke="#e0e0e0"
                    />
                    <YAxis
                      tick={{ fill: '#666666', fontSize: 12 }}
                      stroke="#e0e0e0"
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" />
                    {chartData.length > 0 && Object.keys(chartData[0])
                      .filter(key => key !== 'date')
                      .map((metric, index) => (
                        <Line
                          key={metric}
                          type="monotone"
                          dataKey={metric}
                          stroke={getMetricColor(metric)}
                          strokeWidth={2}
                          dot={{ r: 4, fill: getMetricColor(metric) }}
                          activeDot={{ r: 6 }}
                        />
                      ))}
                  </LineChart>
                </ResponsiveContainer>
              </MotionPaper>
            </Grid>
          ) : (
            // Overview of all exercises
            <>
              <Grid item xs={12} lg={8}>
                <MotionPaper
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.35 }}
                  sx={{
                    p: 3,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2
                  }}
                >
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 600, mb: 3, letterSpacing: '-0.01em' }}
                  >
                    Exercise Frequency
                  </Typography>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={chartData.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                      <XAxis
                        dataKey="exercise_name"
                        angle={-45}
                        textAnchor="end"
                        height={100}
                        tick={{ fill: '#666666', fontSize: 11 }}
                        stroke="#e0e0e0"
                      />
                      <YAxis
                        tick={{ fill: '#666666', fontSize: 12 }}
                        stroke="#e0e0e0"
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar
                        dataKey="total_records"
                        fill="#000000"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </MotionPaper>
              </Grid>
              
              <Grid item xs={12} lg={4}>
                <MotionPaper
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.4 }}
                  sx={{
                    p: 3,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2
                  }}
                >
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 600, mb: 3, letterSpacing: '-0.01em' }}
                  >
                    Recent Exercises
                  </Typography>
                  <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                    {chartData
                      .sort((a, b) => new Date(b.last_recorded) - new Date(a.last_recorded))
                      .slice(0, 10)
                      .map((exercise, index) => (
                        <motion.div
                          key={exercise.exercise_name}
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.2, delay: index * 0.05 }}
                        >
                          <Box
                            sx={{
                              mb: 2,
                              p: 2,
                              bgcolor: 'grey.50',
                              borderRadius: 2,
                              border: '1px solid',
                              borderColor: 'grey.100',
                              transition: 'all 0.2s',
                              '&:hover': {
                                borderColor: 'grey.300',
                                backgroundColor: 'grey.100'
                              }
                            }}
                          >
                            <Typography
                              variant="subtitle1"
                              sx={{ fontWeight: 600, mb: 0.5 }}
                            >
                              {exercise.exercise_name}
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                              {exercise.total_records} times • Last: {formatDate(exercise.last_recorded)}
                            </Typography>
                            <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                              {exercise.max_weight && (
                                <Chip
                                  label={`${exercise.max_weight} lbs`}
                                  size="small"
                                  sx={{
                                    fontSize: '0.7rem',
                                    height: 22,
                                    backgroundColor: 'grey.900',
                                    color: 'white',
                                    fontWeight: 500
                                  }}
                                />
                              )}
                              {exercise.max_reps && (
                                <Chip
                                  label={`${exercise.max_reps} reps`}
                                  size="small"
                                  sx={{
                                    fontSize: '0.7rem',
                                    height: 22,
                                    backgroundColor: 'grey.200',
                                    color: 'text.primary',
                                    fontWeight: 500
                                  }}
                                />
                              )}
                              {exercise.max_duration && (
                                <Chip
                                  label={`${exercise.max_duration} min`}
                                  size="small"
                                  sx={{
                                    fontSize: '0.7rem',
                                    height: 22,
                                    backgroundColor: 'grey.200',
                                    color: 'text.primary',
                                    fontWeight: 500
                                  }}
                                />
                              )}
                            </Box>
                          </Box>
                        </motion.div>
                      ))}
                  </Box>
                </MotionPaper>
              </Grid>
            </>
          )}
        </Grid>
      )}
    </Box>
  );
};

export default ProgressChart;