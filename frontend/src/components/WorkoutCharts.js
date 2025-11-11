import React, { useState, useEffect } from 'react';
import {
  Grid,
  Paper,
  Typography,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ToggleButtonGroup,
  ToggleButton,
  Card,
  CardContent
} from '@mui/material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { TrendingUp, FitnessCenter, Timeline } from '@mui/icons-material';
import api from '../services/api';
import LLMSummary from './LLMSummary';

const COLORS = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', 
  '#d084d0', '#ffb347', '#87ceeb', '#dda0dd', '#98fb98'
];

const WorkoutCharts = ({ deviceUuid }) => {
  const [workoutTrends, setWorkoutTrends] = useState(null);
  const [muscleGroups, setMuscleGroups] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [period, setPeriod] = useState('weekly');
  const [chartDays, setChartDays] = useState(90);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChartData();
  }, [deviceUuid, period, chartDays]);

  const loadChartData = async () => {
    try {
      setLoading(true);
      const [trendsData, muscleData, performanceData] = await Promise.all([
        api.getWorkoutTrends(deviceUuid, { period, days: chartDays }),
        api.getMuscleGroupData(deviceUuid, { days: 30 }),
        api.getPerformanceData(deviceUuid, { days: chartDays })
      ]);
      
      setWorkoutTrends(trendsData);
      setMuscleGroups(muscleData);
      setPerformance(performanceData);
    } catch (error) {
      console.error('Failed to load chart data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return period === 'monthly' 
      ? date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <Box sx={{ 
          bgcolor: 'background.paper', 
          border: 1, 
          borderColor: 'grey.300',
          borderRadius: 1,
          p: 1,
          boxShadow: 2 
        }}>
          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
            {formatDate(label)}
          </Typography>
          {payload.map((entry, index) => (
            <Typography key={index} variant="body2" sx={{ color: entry.color }}>
              {`${entry.name}: ${entry.value}`}
            </Typography>
          ))}
        </Box>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height={400}>
        <Typography variant="h6">Loading charts...</Typography>
      </Box>
    );
  }

  // Safety check to prevent crashes with malformed data
  const safeWorkoutTrends = workoutTrends?.trends?.filter(item => item && item.period) || [];
  const safeMuscleGroups = muscleGroups?.muscle_groups?.filter(item => item && item.muscle_group) || [];
  const safePerformance = performance?.performance?.filter(item => item && item.exercise_name) || [];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Timeline />
          Workout Analytics
        </Typography>
        
        <Box display="flex" gap={2} alignItems="center">
          <ToggleButtonGroup
            value={period}
            exclusive
            onChange={(e, newPeriod) => newPeriod && setPeriod(newPeriod)}
            size="small"
          >
            <ToggleButton value="weekly">Weekly</ToggleButton>
            <ToggleButton value="monthly">Monthly</ToggleButton>
          </ToggleButtonGroup>
          
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Time Range</InputLabel>
            <Select
              value={chartDays}
              label="Time Range"
              onChange={(e) => setChartDays(e.target.value)}
            >
              <MenuItem value={30}>30 Days</MenuItem>
              <MenuItem value={90}>90 Days</MenuItem>
              <MenuItem value={180}>6 Months</MenuItem>
              <MenuItem value={365}>1 Year</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Workout Volume Trends */}
        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TrendingUp />
              Workout Volume Trends
            </Typography>
            
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={safeWorkoutTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="period" 
                  tickFormatter={formatDate}
                />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="workout_count"
                  stackId="1"
                  stroke="#8884d8"
                  fill="#8884d8"
                  name="Workouts"
                />
                <Area
                  type="monotone"
                  dataKey="total_exercises"
                  stackId="1"
                  stroke="#82ca9d"
                  fill="#82ca9d"
                  name="Total Exercises"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Muscle Group Distribution */}
        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FitnessCenter />
              Muscle Groups (30 days)
            </Typography>
            
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={safeMuscleGroups}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="exercise_count"
                  nameKey="muscle_group"
                >
                  {safeMuscleGroups.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Performance Overview */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Exercise Performance Overview
            </Typography>
            
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={safePerformance}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="exercise_name" 
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis yAxisId="frequency" orientation="left" />
                <YAxis yAxisId="weight" orientation="right" />
                <Tooltip />
                <Legend />
                <Bar
                  yAxisId="frequency"
                  dataKey="frequency"
                  fill="#8884d8"
                  name="Frequency"
                />
                <Bar
                  yAxisId="weight"
                  dataKey="max_weight"
                  fill="#82ca9d"
                  name="Max Weight (lbs)"
                />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Quick Stats Cards */}
        <Grid item xs={12}>
          <Grid container spacing={2}>
            {safeWorkoutTrends.length > 0 && (
              <>
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        Recent Week
                      </Typography>
                      <Typography variant="h4">
                        {safeWorkoutTrends[0]?.workout_count || 0}
                      </Typography>
                      <Typography variant="body2">
                        Workouts
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
                        {Math.round(safeWorkoutTrends[0]?.avg_duration || 0)}
                      </Typography>
                      <Typography variant="body2">
                        Minutes
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        Muscle Groups
                      </Typography>
                      <Typography variant="h4">
                        {safeMuscleGroups.length || 0}
                      </Typography>
                      <Typography variant="body2">
                        Targeted
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        Avg Audio
                      </Typography>
                      <Typography variant="h4">
                        {Math.round(safeWorkoutTrends[0]?.avg_audio_duration || 0)}
                      </Typography>
                      <Typography variant="body2">
                        Minutes
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </>
            )}
          </Grid>
        </Grid>

        {/* LLM Summary */}
        <Grid item xs={12}>
          <LLMSummary deviceUuid={deviceUuid} />
        </Grid>
      </Grid>
    </Box>
  );
};

export default WorkoutCharts;