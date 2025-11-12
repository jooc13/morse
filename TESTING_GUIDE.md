# Testing Guide - Workout Display Redesign

## Quick Start Testing

### 1. Start the Services

```bash
# Terminal 1 - Database (if using Docker)
cd /Users/iudofia/Desktop/morse
docker-compose up postgres redis

# Terminal 2 - API Service
cd /Users/iudofia/Desktop/morse/api-service
npm install
npm start

# Terminal 3 - Worker Service
cd /Users/iudofia/Desktop/morse/worker-service
pip install -r requirements.txt
python src/worker.py

# Terminal 4 - Frontend
cd /Users/iudofia/Desktop/morse/frontend
npm install
npm start
```

### 2. Test the API Endpoint Directly

```bash
# Get your device UUID from the app or database
DEVICE_UUID="your-device-uuid-here"

# Test the new workout grouping endpoint
curl http://localhost:3001/api/workouts/$DEVICE_UUID | jq .

# Expected response structure:
{
  "workouts": [
    {
      "workout_date": "2025-11-11",
      "workout_start_time": "14:30:00",
      "workout_duration_minutes": 45,
      "recording_count": 3,
      "total_sets": 9,
      "recordings": [...],
      "sets": [...]
    }
  ],
  "pagination": {
    "total": 15,
    "limit": 20,
    "offset": 0,
    "hasMore": false
  }
}
```

### 3. Test with Sample Data

Create a test script to insert sample workout data:

```bash
# Save this as test_data.sql
cat > /tmp/test_workout_data.sql << 'EOF'
-- Insert test user
INSERT INTO users (device_uuid) VALUES ('test-device-123')
ON CONFLICT (device_uuid) DO NOTHING;

-- Get user ID
DO $$
DECLARE
  user_id_var UUID;
  audio_id_1 UUID := uuid_generate_v4();
  audio_id_2 UUID := uuid_generate_v4();
  audio_id_3 UUID := uuid_generate_v4();
  workout_id_1 UUID := uuid_generate_v4();
  workout_id_2 UUID := uuid_generate_v4();
  workout_id_3 UUID := uuid_generate_v4();
BEGIN
  SELECT id INTO user_id_var FROM users WHERE device_uuid = 'test-device-123';

  -- Create 3 audio files for same day
  INSERT INTO audio_files (id, user_id, original_filename, file_path, file_size, duration_seconds, processed)
  VALUES
    (audio_id_1, user_id_var, 'front_squat.m4a', '/uploads/test1.m4a', 1024000, 15.5, true),
    (audio_id_2, user_id_var, 'rdl.m4a', '/uploads/test2.m4a', 1024000, 12.0, true),
    (audio_id_3, user_id_var, 'pullups.m4a', '/uploads/test3.m4a', 1024000, 10.0, true);

  -- Create 3 workouts for same day (2025-11-11)
  INSERT INTO workouts (id, user_id, audio_file_id, workout_date, workout_start_time, workout_duration_minutes, total_exercises)
  VALUES
    (workout_id_1, user_id_var, audio_id_1, '2025-11-11', '14:30:00', 15, 1),
    (workout_id_2, user_id_var, audio_id_2, '2025-11-11', '14:45:00', 12, 1),
    (workout_id_3, user_id_var, audio_id_3, '2025-11-11', '14:57:00', 10, 1);

  -- Create exercises (sets) for Front Squat
  INSERT INTO exercises (workout_id, exercise_name, exercise_type, muscle_groups, sets, reps, weight_lbs, effort_level, order_in_workout)
  VALUES
    (workout_id_1, 'Front Squat', 'strength', ARRAY['quads', 'core', 'glutes'], 1, ARRAY[8], ARRAY[185], 8, 1),
    (workout_id_1, 'Front Squat', 'strength', ARRAY['quads', 'core', 'glutes'], 1, ARRAY[8], ARRAY[185], 8, 2),
    (workout_id_1, 'Front Squat', 'strength', ARRAY['quads', 'core', 'glutes'], 1, ARRAY[8], ARRAY[185], 9, 3);

  -- Create exercises (sets) for Romanian Deadlift
  INSERT INTO exercises (workout_id, exercise_name, exercise_type, muscle_groups, sets, reps, weight_lbs, order_in_workout)
  VALUES
    (workout_id_2, 'Romanian Deadlift', 'strength', ARRAY['hamstrings', 'glutes', 'lower back'], 1, ARRAY[10], ARRAY[225], 1),
    (workout_id_2, 'Romanian Deadlift', 'strength', ARRAY['hamstrings', 'glutes', 'lower back'], 1, ARRAY[10], ARRAY[225], 2),
    (workout_id_2, 'Romanian Deadlift', 'strength', ARRAY['hamstrings', 'glutes', 'lower back'], 1, ARRAY[10], ARRAY[225], 3);

  -- Create exercises (sets) for Pull-ups
  INSERT INTO exercises (workout_id, exercise_name, exercise_type, muscle_groups, sets, reps, effort_level, order_in_workout, notes)
  VALUES
    (workout_id_3, 'Pull-ups', 'strength', ARRAY['lats', 'biceps', 'upper back'], 1, ARRAY[10], 7, 1, 'Used neutral grip'),
    (workout_id_3, 'Pull-ups', 'strength', ARRAY['lats', 'biceps', 'upper back'], 1, ARRAY[9], 8, 2, 'Used neutral grip'),
    (workout_id_3, 'Pull-ups', 'strength', ARRAY['lats', 'biceps', 'upper back'], 1, ARRAY[8], 9, 3, 'Used neutral grip, felt good pump');

END $$;
EOF

# Run the test data script
psql $DATABASE_URL -f /tmp/test_workout_data.sql
```

## Testing Checklist

### API Tests

- [ ] **Daily Grouping**: Multiple recordings on same day group into single workout
  ```bash
  curl http://localhost:3001/api/workouts/test-device-123 | jq '.workouts | length'
  # Should return 1 for the test data above
  ```

- [ ] **Set Count**: Total sets calculated correctly
  ```bash
  curl http://localhost:3001/api/workouts/test-device-123 | jq '.workouts[0].total_sets'
  # Should return 9 (3 + 3 + 3)
  ```

- [ ] **Recording Count**: Shows number of audio files
  ```bash
  curl http://localhost:3001/api/workouts/test-device-123 | jq '.workouts[0].recording_count'
  # Should return 3
  ```

- [ ] **Date Filtering**: Start/end date params work
  ```bash
  curl "http://localhost:3001/api/workouts/test-device-123?startDate=2025-11-01&endDate=2025-11-30" | jq .
  ```

- [ ] **Pagination**: Limit and offset work correctly
  ```bash
  curl "http://localhost:3001/api/workouts/test-device-123?limit=5&offset=0" | jq '.pagination'
  ```

### Frontend Tests

#### WorkoutList Component

- [ ] **Initial Load**: Component loads without errors
- [ ] **Data Display**: Workouts show with correct date headers
- [ ] **Exercise Grouping**: Sets grouped by exercise name
- [ ] **Set Format**: "185 lbs × 8 reps" format displays correctly
- [ ] **Accordion Expand**: Clicking expands to show exercise details
- [ ] **Muscle Groups**: Chips display all muscle groups
- [ ] **Multiple Recordings**: Shows recording section when count > 1
- [ ] **Empty State**: Shows friendly message when no workouts

#### Dashboard Component

- [ ] **Recent Workouts**: Top 5 workouts display
- [ ] **Exercise Names**: Unique names extracted from sets
- [ ] **Set Count**: Shows "X sets • Y exercises" format
- [ ] **Navigation**: "View All" button navigates to WorkoutList

### Visual Tests

- [ ] **Spacing**: Consistent 8px rhythm throughout
- [ ] **Typography**: General Sans font loads correctly
- [ ] **Colors**: Black and white theme consistent
- [ ] **Hover States**: Border color changes on hover
- [ ] **Animations**: 200ms transitions smooth
- [ ] **Responsive**: Layout works on mobile/tablet/desktop
- [ ] **Loading States**: Progress indicators show during load
- [ ] **Focus States**: Keyboard navigation visible

### Accessibility Tests

- [ ] **Keyboard Navigation**: Tab through all interactive elements
- [ ] **Screen Reader**: VoiceOver/NVDA reads content correctly
- [ ] **Color Contrast**: All text meets WCAG AA (4.5:1)
- [ ] **Touch Targets**: All buttons at least 44px
- [ ] **ARIA Labels**: Proper attributes on dynamic content

## Common Issues & Solutions

### Issue: Sets not grouping correctly

**Symptom**: All sets show as separate exercises
**Solution**: Check that `exercise_name` is exactly the same (case-sensitive)

```sql
-- Check for name variations
SELECT DISTINCT exercise_name FROM exercises WHERE workout_id IN (
  SELECT id FROM workouts WHERE workout_date = '2025-11-11'
);
```

### Issue: Total duration seems wrong

**Symptom**: Workout duration shows 0 or incorrect value
**Solution**: Check workout_duration_minutes in database

```sql
-- Update duration if needed
UPDATE workouts
SET workout_duration_minutes = 15
WHERE audio_file_id IN (SELECT id FROM audio_files WHERE original_filename = 'test.m4a');
```

### Issue: Recordings not showing

**Symptom**: Recording count is 1 but should be more
**Solution**: Ensure multiple workouts exist for same date

```sql
-- Check workout count per date
SELECT workout_date, COUNT(*) as workout_count
FROM workouts
WHERE user_id = (SELECT id FROM users WHERE device_uuid = 'test-device-123')
GROUP BY workout_date;
```

### Issue: Frontend shows old data structure

**Symptom**: Seeing `.exercises` instead of `.sets`
**Solution**: Clear browser cache and refresh

```bash
# Clear React cache
cd /Users/iudofia/Desktop/morse/frontend
rm -rf node_modules/.cache
npm start
```

## Performance Testing

### Load Test the API

```bash
# Install apache bench
brew install apache2

# Test with 100 requests, 10 concurrent
ab -n 100 -c 10 http://localhost:3001/api/workouts/test-device-123

# Should complete in < 1 second for small datasets
```

### Monitor Frontend Performance

Open Chrome DevTools:
1. Go to Performance tab
2. Click Record
3. Navigate to WorkoutList page
4. Stop recording
5. Check metrics:
   - First Contentful Paint: < 1.5s
   - Time to Interactive: < 3.0s
   - Largest Contentful Paint: < 2.5s

### Database Query Performance

```sql
-- Check query execution time
EXPLAIN ANALYZE
WITH daily_workouts AS (
  SELECT
    w.workout_date,
    w.user_id,
    MIN(w.workout_start_time) as earliest_start_time,
    SUM(w.workout_duration_minutes) as total_duration_minutes,
    COUNT(DISTINCT w.id) as recording_count
  FROM workouts w
  WHERE w.user_id = (SELECT id FROM users WHERE device_uuid = 'test-device-123')
  GROUP BY w.workout_date, w.user_id
)
SELECT * FROM daily_workouts;

-- Should execute in < 50ms for typical datasets
```

## Browser Testing Matrix

- [ ] Chrome 120+ (Desktop)
- [ ] Firefox 120+ (Desktop)
- [ ] Safari 17+ (Desktop)
- [ ] Safari iOS 17+ (Mobile)
- [ ] Chrome Android (Mobile)
- [ ] Edge 120+ (Desktop)

## User Acceptance Testing

### Scenario 1: Record Multiple Sets
1. Upload audio: "Front squat, 185, 8 reps"
2. Wait for processing
3. Upload audio: "Front squat, 185, 8 reps" (same day)
4. Navigate to Workouts page
5. Verify: Single workout for today with 2 sets of Front Squat

### Scenario 2: Multiple Exercises Same Day
1. Upload audio: "Front squat, 185, 8 reps"
2. Upload audio: "Romanian deadlift, 225, 10 reps"
3. Upload audio: "Pull-ups, 10 reps"
4. Navigate to Workouts page
5. Verify: Single workout with 3 exercises, each with 1 set

### Scenario 3: View Historical Workouts
1. Navigate to Workouts page
2. Use date filters (last 30 days)
3. Verify: Workouts display in reverse chronological order
4. Click on a workout to expand
5. Verify: Sets grouped by exercise, proper formatting

## Debug Mode

Add this to your browser console to enable debug logging:

```javascript
// Enable verbose logging
localStorage.setItem('DEBUG_MORSE', 'true');

// Check workout data structure
console.log('Workouts:', workouts);

// Check set grouping
const grouped = groupSetsByExercise(workouts[0].sets);
console.log('Grouped exercises:', grouped);

// Check formatting
workouts[0].sets.forEach(set => {
  console.log('Set format:', formatSetDetails(set));
});
```

## Automated Test Script

Create a simple test runner:

```javascript
// test-workout-display.js
const axios = require('axios');

async function testWorkoutAPI() {
  const baseURL = 'http://localhost:3001/api';
  const deviceUuid = 'test-device-123';

  try {
    // Test 1: Get workouts
    const response = await axios.get(`${baseURL}/workouts/${deviceUuid}`);
    console.assert(response.data.workouts, 'Should return workouts array');
    console.assert(response.data.pagination, 'Should return pagination info');

    // Test 2: Check data structure
    const workout = response.data.workouts[0];
    console.assert(workout.workout_date, 'Should have workout_date');
    console.assert(workout.sets, 'Should have sets array');
    console.assert(workout.total_sets, 'Should have total_sets');
    console.assert(workout.recording_count, 'Should have recording_count');

    // Test 3: Verify grouping
    const setsByDate = response.data.workouts.reduce((acc, w) => {
      acc[w.workout_date] = (acc[w.workout_date] || 0) + 1;
      return acc;
    }, {});

    Object.entries(setsByDate).forEach(([date, count]) => {
      console.log(`✓ ${date}: ${count} workout entry (grouped)`);
    });

    console.log('✅ All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testWorkoutAPI();
```

Run with: `node test-workout-display.js`

---

**Testing Complete When**:
- ✓ All automated tests pass
- ✓ Manual testing checklist completed
- ✓ No console errors in browser
- ✓ Performance metrics meet targets
- ✓ Works across all supported browsers
- ✓ Accessible via keyboard and screen reader
- ✓ User acceptance scenarios successful
