import os
import logging
import asyncio
from typing import Dict, Any, List, Optional
import asyncpg
from datetime import datetime, date
from dateutil import parser

logger = logging.getLogger(__name__)

class DatabaseManager:
    def __init__(self):
        self.connection_pool = None
        self.database_url = os.getenv('DATABASE_URL', 'postgresql://localhost:5432/morse_db')

    async def get_connection(self):
        """Get a database connection from the pool"""
        if not self.connection_pool:
            await self.initialize_pool()
        if not self.connection_pool:
            raise RuntimeError("Database connection pool not initialized")
        return await self.connection_pool.acquire()

    async def initialize_pool(self):
        """Initialize the connection pool"""
        try:
            logger.info(f"Initializing database pool with URL: {self.database_url}")
            self.connection_pool = await asyncpg.create_pool(
                self.database_url,
                min_size=2,
                max_size=10,
                command_timeout=30
            )
            # Test the pool immediately
            async with self.connection_pool.acquire() as conn:
                await conn.fetchval("SELECT 1")
            logger.info("Database connection pool initialized and tested successfully")
        except Exception as e:
            logger.error(f"Failed to initialize database pool: {e}")
            self.connection_pool = None
            raise

    async def close_pool(self):
        """Close the connection pool"""
        if self.connection_pool:
            await self.connection_pool.close()
            logger.info("Database connection pool closed")

    async def update_audio_file_status(self, audio_file_id: str, status: str):
        """Update the transcription status of an audio file"""
        conn = await self.get_connection()
        try:
            await conn.execute(
                "UPDATE audio_files SET transcription_status = $1 WHERE id = $2",
                status, audio_file_id
            )
            logger.info(f"Updated audio file {audio_file_id} status to {status}")
        finally:
            await self.connection_pool.release(conn)

    async def mark_audio_file_processed(self, audio_file_id: str):
        """Mark an audio file as processed"""
        conn = await self.get_connection()
        try:
            await conn.execute(
                "UPDATE audio_files SET processed = true WHERE id = $1",
                audio_file_id
            )
        finally:
            await self.connection_pool.release(conn)

    async def update_audio_file_duration(self, audio_file_id: str, duration_seconds: float):
        """Update the duration of an audio file"""
        conn = await self.get_connection()
        try:
            await conn.execute(
                "UPDATE audio_files SET duration_seconds = $1 WHERE id = $2",
                duration_seconds, audio_file_id
            )
            logger.info(f"Updated audio file {audio_file_id} duration to {duration_seconds}s")
        finally:
            await self.connection_pool.release(conn)

    async def save_transcription(self, audio_file_id: str, text: str, confidence: float, processing_time: int) -> str:
        """Save transcription data and return the transcription ID"""
        conn = await self.get_connection()
        try:
            result = await conn.fetchrow(
                """INSERT INTO transcriptions 
                   (audio_file_id, raw_text, confidence_score, processing_time_ms) 
                   VALUES ($1, $2, $3, $4) 
                   RETURNING id""",
                audio_file_id, text, confidence, processing_time
            )
            return result['id']
        finally:
            await self.connection_pool.release(conn)

    async def save_workout_data(self, user_id: str, audio_file_id: str, transcription_id: str, workout_data: Dict[str, Any]) -> str:
        """Save workout and exercise data, return workout ID"""
        conn = await self.get_connection()
        try:
            async with conn.transaction():
                # Save workout
                # Parse workout_date if it's a string
                workout_date = workout_data.get('workout_date')
                if isinstance(workout_date, str):
                    try:
                        workout_date = parser.parse(workout_date).date()
                    except (ValueError, TypeError):
                        workout_date = date.today()
                
                # Parse workout_start_time if it's a string
                workout_start_time = workout_data.get('workout_start_time')
                if isinstance(workout_start_time, str):
                    try:
                        workout_start_time = parser.parse(workout_start_time).time()
                    except (ValueError, TypeError):
                        workout_start_time = None
                
                workout_result = await conn.fetchrow(
                    """INSERT INTO workouts 
                       (user_id, audio_file_id, transcription_id, workout_date, 
                        workout_start_time, workout_duration_minutes, total_exercises, notes) 
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
                       RETURNING id""",
                    user_id,
                    audio_file_id, 
                    transcription_id,
                    workout_date,
                    workout_start_time,
                    workout_data.get('workout_duration_minutes'),
                    workout_data.get('total_exercises', 0),
                    workout_data.get('notes')
                )
                
                workout_id = workout_result['id']
                
                # Save exercises
                exercises = workout_data.get('exercises', [])
                for exercise in exercises:
                    await conn.execute(
                        """INSERT INTO exercises 
                           (workout_id, exercise_name, exercise_type, muscle_groups, sets, 
                            reps, weight_lbs, duration_minutes, distance_miles, effort_level, 
                            rest_seconds, notes, order_in_workout) 
                           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)""",
                        workout_id,
                        exercise.get('exercise_name'),
                        exercise.get('exercise_type'),
                        exercise.get('muscle_groups', []),
                        exercise.get('sets'),
                        exercise.get('reps', []),
                        exercise.get('weight_lbs', []),
                        exercise.get('duration_minutes'),
                        exercise.get('distance_miles'),
                        exercise.get('effort_level'),
                        exercise.get('rest_seconds'),
                        exercise.get('notes'),
                        exercise.get('order_in_workout', 1)
                    )
                    
                    # Save progress tracking data
                    await self._save_exercise_progress(
                        conn, user_id, workout_id, exercise, workout_date
                    )
                
                # Update user total workouts
                await conn.execute(
                    "UPDATE users SET total_workouts = total_workouts + 1 WHERE id = $1",
                    user_id
                )
                
                logger.info(f"Saved workout {workout_id} with {len(exercises)} exercises")
                return workout_id
        finally:
            await self.connection_pool.release(conn)

    async def _save_exercise_progress(self, conn, user_id: str, workout_id: str, exercise: Dict, workout_date: str):
        """Save exercise progress tracking data"""
        exercise_name = exercise.get('exercise_name')
        if not exercise_name:
            return
            
        # Save weight progress
        weights = exercise.get('weight_lbs', [])
        if weights and isinstance(weights, list):
            # Filter out null/None values and find max
            valid_weights = [w for w in weights if w is not None and w != 0]
            if valid_weights:
                max_weight = max(valid_weights)
                await conn.execute(
                    """INSERT INTO user_progress
                       (user_id, exercise_name, metric_type, metric_value, recorded_date, workout_id)
                       VALUES ($1, $2, 'weight', $3, $4, $5)""",
                    user_id, exercise_name, max_weight, workout_date, workout_id
                )
        
        # Save reps progress
        reps = exercise.get('reps', [])
        if reps and isinstance(reps, list):
            max_reps = max(reps)
            await conn.execute(
                """INSERT INTO user_progress 
                   (user_id, exercise_name, metric_type, metric_value, recorded_date, workout_id) 
                   VALUES ($1, $2, 'reps', $3, $4, $5)""",
                user_id, exercise_name, max_reps, workout_date, workout_id
            )
        
        # Save duration progress
        duration = exercise.get('duration_minutes')
        if duration:
            await conn.execute(
                """INSERT INTO user_progress 
                   (user_id, exercise_name, metric_type, metric_value, recorded_date, workout_id) 
                   VALUES ($1, $2, 'duration', $3, $4, $5)""",
                user_id, exercise_name, duration, workout_date, workout_id
            )
        
        # Save distance progress
        distance = exercise.get('distance_miles')
        if distance:
            await conn.execute(
                """INSERT INTO user_progress 
                   (user_id, exercise_name, metric_type, metric_value, recorded_date, workout_id) 
                   VALUES ($1, $2, 'distance', $3, $4, $5)""",
                user_id, exercise_name, distance, workout_date, workout_id
            )

    async def get_pending_audio_files(self) -> List[Dict[str, Any]]:
        """Get audio files that need processing"""
        conn = await self.get_connection()
        try:
            results = await conn.fetch(
                """SELECT af.id, af.user_id, af.file_path, af.original_filename, u.device_uuid
                   FROM audio_files af
                   JOIN users u ON af.user_id = u.id
                   WHERE af.processed = false 
                   AND af.transcription_status IN ('pending', 'failed')
                   ORDER BY af.upload_timestamp ASC
                   LIMIT 50"""
            )
            
            return [dict(row) for row in results]
        finally:
            await self.connection_pool.release(conn)

    async def get_user_workout_history(self, user_id: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Get recent workout history for a user"""
        conn = await self.get_connection()
        try:
            results = await conn.fetch(
                """SELECT w.workout_date, w.workout_duration_minutes, w.total_exercises,
                          array_agg(DISTINCT e.exercise_name) as exercise_names
                   FROM workouts w
                   LEFT JOIN exercises e ON w.id = e.workout_id
                   WHERE w.user_id = $1
                   GROUP BY w.id, w.workout_date, w.workout_duration_minutes, w.total_exercises
                   ORDER BY w.workout_date DESC
                   LIMIT $2""",
                user_id, limit
            )
            
            return [dict(row) for row in results]
        finally:
            await self.connection_pool.release(conn)

    async def health_check(self) -> bool:
        """Check database connectivity"""
        try:
            if not self.connection_pool:
                await self.initialize_pool()

            conn = await self.get_connection()
            try:
                await conn.fetchval("SELECT 1")
            finally:
                await self.connection_pool.release(conn)
            return True
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return False

    async def init_processing_stages(self, audio_file_id: str):
        """Initialize processing stages for a file"""
        conn = await self.get_connection()
        try:
            stages = ['transcription', 'llm_processing', 'data_saving']
            for stage in stages:
                await conn.execute(
                    """INSERT INTO file_processing_progress
                       (audio_file_id, stage, status)
                       VALUES ($1, $2, 'pending')
                       ON CONFLICT (audio_file_id, stage) DO NOTHING""",
                    audio_file_id, stage
                )
            logger.info(f"Initialized processing stages for file {audio_file_id}")
        finally:
            await self.connection_pool.release(conn)

    async def update_stage_progress(self, audio_file_id: str, stage: str, progress: int,
                                   status: str = 'in_progress', message: str = None):
        """Update progress for a specific processing stage"""
        conn = await self.get_connection()
        try:
            # Update the stage progress
            await conn.execute(
                """UPDATE file_processing_progress
                   SET progress_percent = $3, status = $4, message = $5,
                       started_at = CASE WHEN started_at IS NULL AND $4 = 'in_progress' THEN NOW() ELSE started_at END,
                       completed_at = CASE WHEN $4 = 'completed' THEN NOW() ELSE NULL END
                   WHERE audio_file_id = $1 AND stage = $2""",
                audio_file_id, stage, progress, status, message
            )

            # Update overall file progress and stage
            overall_progress = await self._calculate_overall_progress(conn, audio_file_id)
            await conn.execute(
                """UPDATE audio_files
                   SET processing_progress = $2, processing_stage = $3, processing_message = $4
                   WHERE id = $1""",
                audio_file_id, overall_progress, stage, message
            )

            logger.info(f"Updated {stage} progress for file {audio_file_id}: {progress}% ({status})")
        finally:
            await self.connection_pool.release(conn)

    async def _calculate_overall_progress(self, conn, audio_file_id: str) -> int:
        """Calculate overall progress based on all stages"""
        result = await conn.fetchrow(
            """SELECT AVG(progress_percent) as avg_progress
               FROM file_processing_progress
               WHERE audio_file_id = $1""",
            audio_file_id
        )
        return int(result['avg_progress'] or 0)

    async def complete_stage(self, audio_file_id: str, stage: str, message: str = None):
        """Mark a processing stage as completed"""
        await self.update_stage_progress(audio_file_id, stage, 100, 'completed', message)

    async def fail_stage(self, audio_file_id: str, stage: str, error_message: str):
        """Mark a processing stage as failed"""
        await self.update_stage_progress(audio_file_id, stage, 0, 'failed', error_message)