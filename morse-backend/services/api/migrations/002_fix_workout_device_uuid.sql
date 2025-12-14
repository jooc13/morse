-- Add device_uuid to workouts table
ALTER TABLE workouts
ADD COLUMN IF NOT EXISTS device_uuid VARCHAR(255);

-- Update workouts that don't have device_uuid
-- Get device_uuid from the user who owns the workout
UPDATE workouts w
SET device_uuid = u.device_uuid
FROM users u
WHERE w.user_id = u.id AND w.device_uuid IS NULL;

-- If there are still NULL values, set a default
UPDATE workouts
SET device_uuid = 'unknown-device'
WHERE device_uuid IS NULL;

-- Make the column nullable if it has a NOT NULL constraint
ALTER TABLE workouts ALTER COLUMN device_uuid DROP NOT NULL;