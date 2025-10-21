// Utility functions for grouping workouts and calculating progressive overload

export const groupWorkoutsBySession = (workouts, maxGapHours = 3) => {
  if (!workouts || workouts.length === 0) return [];

  // Sort workouts by date and time
  const sortedWorkouts = [...workouts].sort((a, b) => {
    const dateA = new Date(`${a.workout_date}T${a.workout_start_time || '00:00:00'}`);
    const dateB = new Date(`${b.workout_date}T${b.workout_start_time || '00:00:00'}`);
    return dateA - dateB;
  });

  const sessions = [];
  let currentSession = [];

  for (const workout of sortedWorkouts) {
    if (currentSession.length === 0) {
      currentSession.push(workout);
    } else {
      const lastWorkout = currentSession[currentSession.length - 1];
      const lastWorkoutTime = new Date(`${lastWorkout.workout_date}T${lastWorkout.workout_start_time || '00:00:00'}`);
      const currentWorkoutTime = new Date(`${workout.workout_date}T${workout.workout_start_time || '00:00:00'}`);
      
      const timeDiffHours = (currentWorkoutTime - lastWorkoutTime) / (1000 * 60 * 60);
      
      if (timeDiffHours <= maxGapHours) {
        // Within the gap, add to current session
        currentSession.push(workout);
      } else {
        // Gap too large, start new session
        sessions.push(createSession(currentSession));
        currentSession = [workout];
      }
    }
  }

  // Don't forget the last session
  if (currentSession.length > 0) {
    sessions.push(createSession(currentSession));
  }

  return sessions;
};

const createSession = (workouts) => {
  if (workouts.length === 0) return null;

  // Combine all exercises from all workouts in the session
  const allExercises = workouts.flatMap(w => w.exercises || []);
  
  // Calculate session start and end times
  const sessionStart = workouts[0].workout_start_time;
  const lastWorkout = workouts[workouts.length - 1];
  const sessionEnd = lastWorkout.workout_start_time;
  
  // Calculate total duration
  let totalDuration = 0;
  workouts.forEach(w => {
    if (w.workout_duration_minutes) {
      totalDuration += w.workout_duration_minutes;
    }
  });

  // If no individual durations, estimate from start/end times
  if (totalDuration === 0 && sessionStart && sessionEnd && workouts.length > 1) {
    const start = new Date(`2000-01-01T${sessionStart}`);
    const end = new Date(`2000-01-01T${sessionEnd}`);
    totalDuration = (end - start) / (1000 * 60); // Convert to minutes
    totalDuration = Math.max(totalDuration, 30); // Minimum 30 minutes
  }

  return {
    session_id: `session_${workouts[0].workout_date}_${sessionStart}`,
    workout_date: workouts[0].workout_date,
    session_start_time: sessionStart,
    session_end_time: sessionEnd,
    session_duration_minutes: totalDuration || workouts.length * 45, // Fallback estimation
    total_exercises: allExercises.length,
    exercises: allExercises,
    workout_count: workouts.length,
    original_workouts: workouts,
    // Aggregate transcriptions
    transcription: workouts.map(w => w.transcription).filter(Boolean).join(' ... ')
  };
};

export const calculateProgressiveOverload = (exerciseHistory, exerciseName) => {
  if (!exerciseHistory || exerciseHistory.length === 0) return null;

  // Filter for the specific exercise and sort by date
  const exerciseInstances = exerciseHistory
    .filter(session => 
      session.exercises?.some(ex => 
        ex.exercise_name.toLowerCase().includes(exerciseName.toLowerCase())
      )
    )
    .flatMap(session => 
      session.exercises
        .filter(ex => ex.exercise_name.toLowerCase().includes(exerciseName.toLowerCase()))
        .map(ex => ({
          ...ex,
          date: session.workout_date
        }))
    )
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (exerciseInstances.length < 2) return null;

  const latest = exerciseInstances[exerciseInstances.length - 1];
  const previous = exerciseInstances[exerciseInstances.length - 2];

  // Calculate volume (sets × reps × weight)
  const calculateVolume = (exercise) => {
    const sets = exercise.sets || 0;
    const avgReps = exercise.reps ? 
      exercise.reps.reduce((sum, r) => sum + r, 0) / exercise.reps.length : 0;
    const avgWeight = exercise.weight_lbs ? 
      exercise.weight_lbs.reduce((sum, w) => sum + w, 0) / exercise.weight_lbs.length : 0;
    return sets * avgReps * avgWeight;
  };

  const latestVolume = calculateVolume(latest);
  const previousVolume = calculateVolume(previous);
  const volumeIncrease = latestVolume - previousVolume;
  const volumeIncreasePercent = previousVolume > 0 ? (volumeIncrease / previousVolume) * 100 : 0;

  // Get max weight progression
  const latestMaxWeight = latest.weight_lbs ? Math.max(...latest.weight_lbs) : 0;
  const previousMaxWeight = previous.weight_lbs ? Math.max(...previous.weight_lbs) : 0;
  const weightIncrease = latestMaxWeight - previousMaxWeight;

  return {
    exercise_name: latest.exercise_name,
    latest_session: latest,
    previous_session: previous,
    volume_increase: volumeIncrease,
    volume_increase_percent: volumeIncreasePercent,
    weight_increase: weightIncrease,
    progression_detected: volumeIncrease > 0 || weightIncrease > 0
  };
};

export const generateRecommendations = (exerciseHistory, recentSessions) => {
  if (!recentSessions || recentSessions.length === 0) return [];

  const recommendations = [];
  
  // Get unique exercises from recent sessions
  const recentExercises = new Set();
  recentSessions.forEach(session => {
    session.exercises?.forEach(ex => {
      recentExercises.add(ex.exercise_name.toLowerCase());
    });
  });

  // For each recent exercise, calculate progression and suggest improvements
  Array.from(recentExercises).forEach(exerciseName => {
    const progression = calculateProgressiveOverload(recentSessions, exerciseName);
    
    if (progression) {
      const latest = progression.latest_session;
      
      // Weight progression recommendation
      if (latest.weight_lbs && latest.weight_lbs.length > 0) {
        const maxWeight = Math.max(...latest.weight_lbs);
        const recommendedWeight = maxWeight + (maxWeight * 0.025); // 2.5% increase
        
        recommendations.push({
          type: 'weight_progression',
          exercise_name: latest.exercise_name,
          current_weight: maxWeight,
          recommended_weight: Math.round(recommendedWeight * 2) / 2, // Round to nearest 0.5
          reason: 'Progressive overload - increase weight by 2.5%'
        });
      }

      // Volume progression recommendation
      if (latest.sets && latest.reps) {
        const currentSets = latest.sets;
        const avgReps = latest.reps.reduce((sum, r) => sum + r, 0) / latest.reps.length;
        
        if (avgReps >= 12 && currentSets < 4) {
          recommendations.push({
            type: 'volume_progression',
            exercise_name: latest.exercise_name,
            current_sets: currentSets,
            recommended_sets: currentSets + 1,
            reason: 'High rep performance - add another set'
          });
        } else if (avgReps < 6 && currentSets > 1) {
          recommendations.push({
            type: 'rep_progression',
            exercise_name: latest.exercise_name,
            current_reps: Math.round(avgReps),
            recommended_reps: Math.round(avgReps) + 2,
            reason: 'Low rep count - focus on adding reps before weight'
          });
        }
      }
    }
  });

  // Frequency recommendations
  const daysSinceLastWorkout = recentSessions.length > 0 ? 
    (new Date() - new Date(recentSessions[recentSessions.length - 1].workout_date)) / (1000 * 60 * 60 * 24) : 0;
  
  if (daysSinceLastWorkout > 3) {
    recommendations.push({
      type: 'frequency',
      reason: `It's been ${Math.round(daysSinceLastWorkout)} days since your last workout - time to get back in there!`,
      recommended_action: 'Schedule your next workout session'
    });
  }

  return recommendations.slice(0, 5); // Limit to top 5 recommendations
};

export const getWorkoutInsights = (sessions) => {
  if (!sessions || sessions.length === 0) return {};

  const totalWorkouts = sessions.length;
  const totalExercises = sessions.reduce((sum, s) => sum + (s.total_exercises || 0), 0);
  const totalDuration = sessions.reduce((sum, s) => sum + (s.session_duration_minutes || 0), 0);
  const avgDuration = totalWorkouts > 0 ? Math.round(totalDuration / totalWorkouts) : 0;

  // Calculate workout frequency (workouts per week)
  const dateRange = sessions.length > 1 ? 
    (new Date(sessions[sessions.length - 1].workout_date) - new Date(sessions[0].workout_date)) / (1000 * 60 * 60 * 24 * 7) : 1;
  const workoutsPerWeek = dateRange > 0 ? totalWorkouts / dateRange : totalWorkouts;

  // Get most frequent exercises
  const exerciseFrequency = {};
  sessions.forEach(session => {
    session.exercises?.forEach(ex => {
      const name = ex.exercise_name.toLowerCase();
      exerciseFrequency[name] = (exerciseFrequency[name] || 0) + 1;
    });
  });

  const topExercises = Object.entries(exerciseFrequency)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  return {
    total_workouts: totalWorkouts,
    total_exercises: totalExercises,
    total_duration_minutes: totalDuration,
    avg_duration_minutes: avgDuration,
    workouts_per_week: Math.round(workoutsPerWeek * 10) / 10,
    top_exercises: topExercises,
    consistency_score: Math.min(workoutsPerWeek * 25, 100) // Simple consistency scoring
  };
};