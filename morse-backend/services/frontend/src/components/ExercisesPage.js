import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Avatar,
  IconButton,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  InputAdornment,
  Fab,
  Stack,
  useTheme,
  alpha,
  Pagination,
  LinearProgress
} from '@mui/material';
import {
  Search,
  FitnessCenter,
  Timer,
  MonitorWeight,
  ExpandMore,
  FilterList,
  TrendingUp,
  Star
} from '@mui/icons-material';

const ExercisesPage = () => {
  const theme = useTheme();
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterMuscle, setFilterMuscle] = useState('all');
  const [page, setPage] = useState(1);
  const [exercisesPerPage, setExercisesPerPage] = useState(20);
  const [stats, setStats] = useState({ total: 0, unique: 0, categories: {} });
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    fetchExercises();
    fetchStats();
  }, []);

  const fetchExercises = async () => {
    try {
      setLoading(true);
      // Get device UUID from localStorage or wherever it's stored
      const deviceUuid = localStorage.getItem('deviceUuid') || 'test-device-123';

      // Fetch all workouts for this device
      const response = await fetch(`/api/workouts/device/${deviceUuid}?limit=100`);
      const data = await response.json();

      if (response.ok && data.workouts) {
        // Flatten all exercises from all workouts
        const allExercises = [];
        data.workouts.forEach(workout => {
          if (workout.exercises && Array.isArray(workout.exercises)) {
            workout.exercises.forEach(exercise => {
              allExercises.push({
                ...exercise,
                workoutId: workout.id,
                workoutDate: workout.date_completed || workout.workout_date,
                workoutStartTime: workout.workout_start_time,
                workoutDuration: workout.duration_seconds || workout.workout_duration_minutes
              });
            });
          }
        });

        // Sort by date (most recent first)
        allExercises.sort((a, b) => new Date(b.workoutDate) - new Date(a.workoutDate));
        setExercises(allExercises);
      }
    } catch (error) {
      console.error('Error fetching exercises:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const deviceUuid = localStorage.getItem('deviceUuid') || 'test-device-123';
      const response = await fetch(`/api/workouts/stats/device/${deviceUuid}`);
      const data = await response.json();

      if (response.ok && data.exerciseStats) {
        setStats(data.exerciseStats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const filteredExercises = exercises.filter(exercise => {
    const matchesSearch = !searchTerm ||
      exercise.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exercise.exercise_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = filterCategory === 'all' ||
      exercise.category === filterCategory ||
      exercise.exercise_type === filterCategory;

    // Note: muscle_groups filtering would need backend implementation
    const matchesMuscle = filterMuscle === 'all'; // For now, skip muscle filter

    return matchesSearch && matchesCategory && matchesMuscle;
  });

  const handleExpandClick = (index) => {
    setExpanded(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const getMuscleGroups = (muscleGroups) => {
    if (!muscleGroups || !Array.isArray(muscleGroups)) return [];
    return muscleGroups;
  };

  const formatWeight = (weight) => {
    if (!weight || weight === 0) return null;
    return `${weight} lbs`;
  };

  const formatReps = (reps) => {
    if (!reps || reps === 0) return null;
    return `${reps} reps`;
  };

  const formatDuration = (seconds) => {
    if (!seconds || seconds === 0) return null;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  };

  const getEffortColor = (level) => {
    if (!level) return theme.palette.grey[500];
    if (level >= 9) return theme.palette.error.main;
    if (level >= 7) return theme.palette.warning.main;
    if (level >= 5) return theme.palette.info.main;
    return theme.palette.success.main;
  };

  const getCategoryIcon = (category) => {
    switch (category?.toLowerCase()) {
      case 'cardio':
        return '🏃';
      case 'strength':
        return '💪';
      case 'flexibility':
        return '🧘';
      case 'balance':
        return '⚖️';
      case 'sports':
        return '⚽';
      default:
        return '🏋️';
    }
  };

  const uniqueExercises = [...new Set(exercises.map(e => e.name || e.exercise_name))].length;

  const totalPages = Math.ceil(filteredExercises.length / exercisesPerPage);
  const paginatedExercises = filteredExercises.slice(
    (page - 1) * exercisesPerPage,
    page * exercisesPerPage
  );

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" sx={{ fontWeight: 700, mb: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
          <FitnessCenter sx={{ fontSize: 32 }} />
          Exercise Library
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Track your exercise history and see your progress over time
        </Typography>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{
            p: 2,
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
          }}>
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: theme.palette.primary.main }}>
                {filteredExercises.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Exercises
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{
            p: 2,
            background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.1)} 0%, ${alpha(theme.palette.success.main, 0.05)} 100%)`,
            border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`
          }}>
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: theme.palette.success.main }}>
                {uniqueExercises}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Unique Exercises
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{
            p: 2,
            background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.1)} 0%, ${alpha(theme.palette.warning.main, 0.05)} 100%)`,
            border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`
          }}>
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: theme.palette.warning.main }}>
                {stats.totalWorkouts || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Workouts
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{
            p: 2,
            background: `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.1)} 0%, ${alpha(theme.palette.info.main, 0.05)} 100%)`,
            border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`
          }}>
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: theme.palette.info.main }}>
                {Math.round((exercises.reduce((sum, ex) => sum + (ex.sets || 0), 0) / exercises.length) * 10) / 10}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Avg Sets
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Card sx={{ mb: 3, p: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Search exercises..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 250 }}
          />

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Category</InputLabel>
            <Select
              value={filterCategory}
              label="Category"
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <MenuItem value="all">All Categories</MenuItem>
              <MenuItem value="strength">Strength</MenuItem>
              <MenuItem value="cardio">Cardio</MenuItem>
              <MenuItem value="flexibility">Flexibility</MenuItem>
              <MenuItem value="balance">Balance</MenuItem>
              <MenuItem value="sports">Sports</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Muscle Group</InputLabel>
            <Select
              value={filterMuscle}
              label="Muscle Group"
              onChange={(e) => setFilterMuscle(e.target.value)}
            >
              <MenuItem value="all">All Muscles</MenuItem>
              <MenuItem value="chest">Chest</MenuItem>
              <MenuItem value="back">Back</MenuItem>
              <MenuItem value="legs">Legs</MenuItem>
              <MenuItem value="shoulders">Shoulders</MenuItem>
              <MenuItem value="arms">Arms</MenuItem>
              <MenuItem value="core">Core</MenuItem>
            </Select>
          </FormControl>

          <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
            {filteredExercises.length} exercises found
          </Typography>
        </Box>
      </Card>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Exercise List */}
      <Grid container spacing={2}>
        {paginatedExercises.map((exercise, index) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={`${exercise.workoutId}-${exercise.name || exercise.exercise_name}-${index}`}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.2s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: theme.shadows[8]
                }
              }}
            >
              <CardContent sx={{ flex: 1 }}>
                {/* Exercise Header */}
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ bgcolor: getEffortColor(exercise.effort_level) }}>
                      {getCategoryIcon(exercise.category || exercise.exercise_type)}
                    </Avatar>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                        {exercise.name || exercise.exercise_name}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                        <Chip
                          label={exercise.category || exercise.exercise_type || 'strength'}
                          size="small"
                          color={
                            exercise.category === 'cardio' ? 'error' :
                            exercise.category === 'flexibility' ? 'warning' : 'primary'
                          }
                          variant="outlined"
                        />
                        {exercise.verified && (
                          <Chip
                            icon={<Star />}
                            label="Verified"
                            size="small"
                            color="success"
                            variant="outlined"
                          />
                        )}
                      </Box>
                    </Box>
                  </Box>
                  <IconButton
                    size="small"
                    onClick={() => handleExpandClick(index)}
                    sx={{
                      transform: expanded[index] ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s'
                    }}
                  >
                    <ExpandMore />
                  </IconButton>
                </Box>

                {/* Quick Stats */}
                <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                  {exercise.sets && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">Sets:</Typography>
                      <Typography variant="body2" fontWeight={600}>{exercise.sets}</Typography>
                    </Box>
                  )}
                  {formatReps(exercise.reps) && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">Reps:</Typography>
                      <Typography variant="body2" fontWeight={600}>{formatReps(exercise.reps)}</Typography>
                    </Box>
                  )}
                  {formatWeight(exercise.weight) && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">Weight:</Typography>
                      <Typography variant="body2" fontWeight={600}>{formatWeight(exercise.weight)}</Typography>
                    </Box>
                  )}
                  {formatDuration(exercise.duration_seconds) && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Timer sx={{ fontSize: 16 }} />
                      <Typography variant="body2" fontWeight={600}>{formatDuration(exercise.duration_seconds)}</Typography>
                    </Box>
                  )}
                </Stack>

                {/* Expanded Details */}
                {expanded[index] && (
                  <Box sx={{
                      mt: 2,
                      p: 2,
                      backgroundColor: alpha(theme.palette.background.paper, 0.5),
                      borderRadius: 1,
                      border: `1px solid ${alpha(theme.palette.divider, 0.1)}`
                    }}>
                    {getMuscleGroups(exercise.muscle_groups).length > 0 && (
                      <Box sx={{ mb: 1.5 }}>
                        <Typography variant="caption" color="text.secondary">Muscle Groups:</Typography>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                          {getMuscleGroups(exercise.muscle_groups).map((muscle, i) => (
                            <Chip key={i} label={muscle} size="small" variant="outlined" />
                          ))}
                        </Box>
                      </Box>
                    )}

                    {exercise.notes && (
                      <Box sx={{ mb: 1.5 }}>
                        <Typography variant="caption" color="text.secondary">Notes:</Typography>
                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                          {exercise.notes}
                        </Typography>
                      </Box>
                    )}

                    <Typography variant="caption" color="text.secondary">
                      Workout: {new Date(exercise.workoutDate).toLocaleDateString()} • {exercise.workoutStartTime || 'No time'}
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Pagination */}
      {!loading && filteredExercises.length > exercisesPerPage && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(e, newPage) => setPage(newPage)}
            color="primary"
            size="large"
          />
        </Box>
      )}

      {!loading && filteredExercises.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <FitnessCenter sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            No exercises found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Try adjusting your search or filters
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default ExercisesPage;