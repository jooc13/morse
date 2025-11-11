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
  CircularProgress,
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
import api from '../services/api';

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
      case 'weight': return '#8884d8';
      case 'reps': return '#82ca9d';
      case 'duration': return '#ffc658';
      case 'distance': return '#ff7300';
      default: return '#8dd1e1';
    }
  };

  const chartData = prepareChartData();

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Progress Tracking
      </Typography>

      {/* Controls */}
      <Paper sx={{ p: 3, mb: 3 }}>
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
      </Paper>

      {/* Summary Stats */}
      {progressData?.summary && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Total Workouts
                </Typography>
                <Typography variant="h4">
                  {progressData.summary.total_workouts || 0}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Last {selectedDays} days
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Unique Exercises
                </Typography>
                <Typography variant="h4">
                  {progressData.summary.unique_exercises || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Avg Duration
                </Typography>
                <Typography variant="h4">
                  {progressData.summary.avg_workout_duration ? 
                    `${Math.round(progressData.summary.avg_workout_duration)}m` : 'N/A'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Last Workout
                </Typography>
                <Typography variant="h6">
                  {progressData.summary.last_workout_date ? 
                    formatDate(progressData.summary.last_workout_date) : 'None'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Charts */}
      {chartData.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <Typography variant="h6" color="textSecondary" gutterBottom>
            No progress data available
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {selectedExercise 
              ? `No data found for "${selectedExercise}" in the selected time period.`
              : 'Complete some workouts to see your progress here!'
            }
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {selectedExercise ? (
            // Specific exercise progress over time
            <Grid item xs={12}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  {selectedExercise} Progress Over Time
                </Typography>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {chartData.length > 0 && Object.keys(chartData[0])
                      .filter(key => key !== 'date')
                      .map((metric, index) => (
                        <Line
                          key={metric}
                          type="monotone"
                          dataKey={metric}
                          stroke={getMetricColor(metric)}
                          strokeWidth={2}
                          dot={{ r: 4 }}
                        />
                      ))}
                  </LineChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
          ) : (
            // Overview of all exercises
            <>
              <Grid item xs={12} lg={8}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Exercise Frequency
                  </Typography>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={chartData.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="exercise_name" 
                        angle={-45}
                        textAnchor="end"
                        height={100}
                      />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="total_records" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </Paper>
              </Grid>
              
              <Grid item xs={12} lg={4}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Recent Exercises
                  </Typography>
                  <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                    {chartData
                      .sort((a, b) => new Date(b.last_recorded) - new Date(a.last_recorded))
                      .slice(0, 10)
                      .map((exercise, index) => (
                        <Box key={exercise.exercise_name} sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                          <Typography variant="subtitle1" gutterBottom>
                            {exercise.exercise_name}
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            {exercise.total_records} times • Last: {formatDate(exercise.last_recorded)}
                          </Typography>
                          <Box sx={{ mt: 1 }}>
                            {exercise.max_weight && (
                              <Chip label={`${exercise.max_weight} lbs`} size="small" sx={{ mr: 0.5 }} />
                            )}
                            {exercise.max_reps && (
                              <Chip label={`${exercise.max_reps} reps`} size="small" sx={{ mr: 0.5 }} />
                            )}
                            {exercise.max_duration && (
                              <Chip label={`${exercise.max_duration} min`} size="small" sx={{ mr: 0.5 }} />
                            )}
                          </Box>
                        </Box>
                      ))}
                  </Box>
                </Paper>
              </Grid>
            </>
          )}
        </Grid>
      )}
    </Box>
  );
};

export default ProgressChart;