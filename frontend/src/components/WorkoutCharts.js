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
  CardContent,
  Skeleton
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
import { TrendingUp, FitnessCenter, Timeline, BarChart as BarChartIcon } from '@mui/icons-material';
import { motion } from 'framer-motion';
import api from '../services/api';
import LLMSummary from './LLMSummary';

const MotionPaper = motion(Paper);
const MotionCard = motion(Card);

// Monochrome color palette for charts
const MONOCHROME_COLORS = [
  '#000000', // Pure black
  '#1a1a1a', // Very dark gray
  '#333333', // Dark gray
  '#4d4d4d', // Medium-dark gray
  '#666666', // Medium gray
  '#808080', // True gray
  '#999999', // Medium-light gray
  '#b3b3b3', // Light gray
  '#cccccc', // Very light gray
  '#e6e6e6', // Extra light gray
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
            {formatDate(label)}
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

  const CustomPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    if (percent < 0.05) return null; // Hide labels for very small slices

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        style={{
          fontSize: '12px',
          fontWeight: 600,
          textShadow: '0 0 3px rgba(0,0,0,0.5)'
        }}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  if (loading) {
    return (
      <Box>
        <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2, mb: 2 }} />
        <Grid container spacing={2}>
          <Grid item xs={12} md={8}>
            <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2 }} />
          </Grid>
          <Grid item xs={12} md={4}>
            <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2 }} />
          </Grid>
        </Grid>
      </Box>
    );
  }

  const safeWorkoutTrends = workoutTrends?.trends?.filter(item => item && item.period) || [];
  const safeMuscleGroups = muscleGroups?.muscle_groups?.filter(item => item && item.muscle_group) || [];
  const safePerformance = performance?.performance?.filter(item => item && item.exercise_name) || [];

  return (
    <Box>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={3}
          flexWrap="wrap"
          gap={2}
        >
          <Box display="flex" alignItems="center" gap={1.5}>
            <Timeline sx={{ fontSize: 28, color: 'text.primary' }} />
            <Typography
              variant="h5"
              sx={{
                fontWeight: 700,
                letterSpacing: '-0.01em',
                color: 'text.primary'
              }}
            >
              Workout Analytics
            </Typography>
          </Box>

          <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
            <ToggleButtonGroup
              value={period}
              exclusive
              onChange={(e, newPeriod) => newPeriod && setPeriod(newPeriod)}
              size="small"
              sx={{
                '& .MuiToggleButton-root': {
                  px: 2,
                  py: 0.75,
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  border: '1.5px solid',
                  borderColor: 'divider',
                  color: 'text.secondary',
                  '&.Mui-selected': {
                    backgroundColor: 'text.primary',
                    color: 'background.paper',
                    borderColor: 'text.primary',
                    '&:hover': {
                      backgroundColor: 'text.secondary',
                    }
                  },
                  '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.04)'
                  }
                }
              }}
            >
              <ToggleButton value="weekly">Weekly</ToggleButton>
              <ToggleButton value="monthly">Monthly</ToggleButton>
            </ToggleButtonGroup>

            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Time Range</InputLabel>
              <Select
                value={chartDays}
                label="Time Range"
                onChange={(e) => setChartDays(e.target.value)}
                sx={{
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderWidth: '1.5px'
                  }
                }}
              >
                <MenuItem value={30}>30 Days</MenuItem>
                <MenuItem value={90}>90 Days</MenuItem>
                <MenuItem value={180}>6 Months</MenuItem>
                <MenuItem value={365}>1 Year</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Box>
      </motion.div>

      <Grid container spacing={3}>
        {/* Workout Volume Trends */}
        <Grid item xs={12} lg={8}>
          <MotionPaper
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            sx={{
              p: 3,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2
            }}
          >
            <Box display="flex" alignItems="center" gap={1} mb={3}>
              <TrendingUp sx={{ fontSize: 20, color: 'text.secondary' }} />
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 600,
                  letterSpacing: '-0.01em'
                }}
              >
                Workout Volume Trends
              </Typography>
            </Box>

            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={safeWorkoutTrends}>
                <defs>
                  <linearGradient id="colorWorkouts" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#000000" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#000000" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorExercises" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#666666" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#666666" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis
                  dataKey="period"
                  tickFormatter={formatDate}
                  tick={{ fill: '#666666', fontSize: 12 }}
                  stroke="#e0e0e0"
                />
                <YAxis
                  tick={{ fill: '#666666', fontSize: 12 }}
                  stroke="#e0e0e0"
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: '20px' }}
                  iconType="circle"
                />
                <Area
                  type="monotone"
                  dataKey="workout_count"
                  stroke="#000000"
                  strokeWidth={2}
                  fill="url(#colorWorkouts)"
                  name="Workouts"
                />
                <Area
                  type="monotone"
                  dataKey="total_exercises"
                  stroke="#666666"
                  strokeWidth={2}
                  fill="url(#colorExercises)"
                  name="Total Exercises"
                />
              </AreaChart>
            </ResponsiveContainer>
          </MotionPaper>
        </Grid>

        {/* Muscle Group Distribution */}
        <Grid item xs={12} lg={4}>
          <MotionPaper
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            sx={{
              p: 3,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2
            }}
          >
            <Box display="flex" alignItems="center" gap={1} mb={3}>
              <FitnessCenter sx={{ fontSize: 20, color: 'text.secondary' }} />
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 600,
                  letterSpacing: '-0.01em'
                }}
              >
                Muscle Groups
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 2 }}>
              Last 30 days
            </Typography>

            {safeMuscleGroups.length === 0 ? (
              <Box display="flex" justifyContent="center" alignItems="center" height={300}>
                <Typography variant="body2" color="text.secondary">
                  No muscle group data available
                </Typography>
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={safeMuscleGroups}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={CustomPieLabel}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="exercise_count"
                    nameKey="muscle_group"
                  >
                    {safeMuscleGroups.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={MONOCHROME_COLORS[index % MONOCHROME_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <Paper sx={{ p: 1.5, border: '1px solid', borderColor: 'divider' }}>
                            <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>
                              {payload[0].name}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              {payload[0].value} exercises
                            </Typography>
                          </Paper>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </MotionPaper>
        </Grid>

        {/* Performance Overview */}
        <Grid item xs={12}>
          <MotionPaper
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
            sx={{
              p: 3,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2
            }}
          >
            <Box display="flex" alignItems="center" gap={1} mb={3}>
              <BarChartIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 600,
                  letterSpacing: '-0.01em'
                }}
              >
                Exercise Performance Overview
              </Typography>
            </Box>

            {safePerformance.length === 0 ? (
              <Box display="flex" justifyContent="center" alignItems="center" height={400}>
                <Typography variant="body2" color="text.secondary">
                  No performance data available
                </Typography>
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={safePerformance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis
                    dataKey="exercise_name"
                    angle={-45}
                    textAnchor="end"
                    height={120}
                    tick={{ fill: '#666666', fontSize: 11 }}
                    stroke="#e0e0e0"
                  />
                  <YAxis
                    yAxisId="frequency"
                    orientation="left"
                    tick={{ fill: '#666666', fontSize: 12 }}
                    stroke="#e0e0e0"
                    label={{ value: 'Frequency', angle: -90, position: 'insideLeft', style: { fill: '#666666' } }}
                  />
                  <YAxis
                    yAxisId="weight"
                    orientation="right"
                    tick={{ fill: '#666666', fontSize: 12 }}
                    stroke="#e0e0e0"
                    label={{ value: 'Max Weight (lbs)', angle: 90, position: 'insideRight', style: { fill: '#666666' } }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" />
                  <Bar
                    yAxisId="frequency"
                    dataKey="frequency"
                    fill="#000000"
                    name="Frequency"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    yAxisId="weight"
                    dataKey="max_weight"
                    fill="#666666"
                    name="Max Weight (lbs)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </MotionPaper>
        </Grid>

        {/* Quick Stats Cards */}
        <Grid item xs={12}>
          <Grid container spacing={2}>
            {safeWorkoutTrends.length > 0 && (
              <>
                <Grid item xs={12} sm={6} md={3}>
                  <MotionCard
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2, delay: 0.2 }}
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      transition: 'border-color 0.2s',
                      '&:hover': {
                        borderColor: 'text.secondary'
                      }
                    }}
                  >
                    <CardContent>
                      <Typography
                        variant="overline"
                        sx={{
                          color: 'text.secondary',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          letterSpacing: '0.1em'
                        }}
                      >
                        Recent Period
                      </Typography>
                      <Typography variant="h4" sx={{ fontWeight: 700, mt: 1, mb: 0.5 }}>
                        {safeWorkoutTrends[0]?.workout_count || 0}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        Workouts
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
                      transition: 'border-color 0.2s',
                      '&:hover': {
                        borderColor: 'text.secondary'
                      }
                    }}
                  >
                    <CardContent>
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
                      <Typography variant="h4" sx={{ fontWeight: 700, mt: 1, mb: 0.5 }}>
                        {Math.round(safeWorkoutTrends[0]?.avg_duration || 0)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        Minutes
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
                      transition: 'border-color 0.2s',
                      '&:hover': {
                        borderColor: 'text.secondary'
                      }
                    }}
                  >
                    <CardContent>
                      <Typography
                        variant="overline"
                        sx={{
                          color: 'text.secondary',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          letterSpacing: '0.1em'
                        }}
                      >
                        Muscle Groups
                      </Typography>
                      <Typography variant="h4" sx={{ fontWeight: 700, mt: 1, mb: 0.5 }}>
                        {safeMuscleGroups.length || 0}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        Targeted
                      </Typography>
                    </CardContent>
                  </MotionCard>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <MotionCard
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2, delay: 0.35 }}
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      transition: 'border-color 0.2s',
                      '&:hover': {
                        borderColor: 'text.secondary'
                      }
                    }}
                  >
                    <CardContent>
                      <Typography
                        variant="overline"
                        sx={{
                          color: 'text.secondary',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          letterSpacing: '0.1em'
                        }}
                      >
                        Avg Audio
                      </Typography>
                      <Typography variant="h4" sx={{ fontWeight: 700, mt: 1, mb: 0.5 }}>
                        {Math.round(safeWorkoutTrends[0]?.avg_audio_duration || 0)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        Minutes
                      </Typography>
                    </CardContent>
                  </MotionCard>
                </Grid>
              </>
            )}
          </Grid>
        </Grid>

        {/* LLM Summary */}
        <Grid item xs={12}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.4 }}
          >
            <LLMSummary deviceUuid={deviceUuid} />
          </motion.div>
        </Grid>
      </Grid>
    </Box>
  );
};

export default WorkoutCharts;
