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

    # Session-related database methods
    
    async def get_pending_sessions(self) -> List[Dict[str, Any]]:
        """Get sessions ready for processing"""
        conn = await self.get_connection()
        try:
            query = """
                SELECT DISTINCT
                    ws.id,
                    ws.user_id,
                    ws.session_date,
                    ws.total_recordings,
                    ws.session_status,
                    ws.created_at,
                    u.device_uuid
                FROM workout_sessions ws
                JOIN users u ON ws.user_id = u.id
                WHERE ws.session_status = 'pending'
                    AND EXISTS (
                        SELECT 1 FROM session_audio_files saf
                        JOIN audio_files af ON saf.audio_file_id = af.id
                        WHERE saf.session_id = ws.id
                            AND af.transcription_status = 'completed'
                    )
                ORDER BY ws.created_at ASC
            """
            rows = await conn.fetch(query)
            return [dict(row) for row in rows]
        finally:
            await self.connection_pool.release(conn)
    
    async def update_session_status(self, session_id: str, status: str, notes: str = None):
        """Update session status and notes"""
        conn = await self.get_connection()
        try:
            if notes:
                await conn.execute(
                    """UPDATE workout_sessions 
                       SET session_status = $2, notes = $3, updated_at = CURRENT_TIMESTAMP 
                       WHERE id = $1""",
                    session_id, status, notes
                )
            else:
                await conn.execute(
                    """UPDATE workout_sessions 
                       SET session_status = $2, updated_at = CURRENT_TIMESTAMP 
                       WHERE id = $1""",
                    session_id, status
                )
        finally:
            await self.connection_pool.release(conn)
    
    async def get_combined_session_transcription(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get combined transcription data for a session"""
        conn = await self.get_connection()
        try:
            query = """
                SELECT 
                    af.id,
                    af.original_filename,
                    af.file_path,
                    af.transcription_status,
                    af.upload_timestamp,
                    saf.recording_order,
                    saf.time_offset_minutes,
                    t.raw_text as transcription,
                    t.confidence_score
                FROM session_audio_files saf
                JOIN audio_files af ON saf.audio_file_id = af.id
                LEFT JOIN transcriptions t ON af.id = t.audio_file_id
                WHERE saf.session_id = $1
                ORDER BY saf.recording_order ASC
            """
            rows = await conn.fetch(query, session_id)
            
            if not rows:
                return None
                
            audio_files = [dict(row) for row in rows]
            
            # Build combined transcription with context
            combined_text = ''
            
            if len(audio_files) == 1:
                # Single recording - use as-is
                combined_text = audio_files[0]['transcription'] or ''
            else:
                # Multiple recordings - add context and ordering
                combined_text = f"Workout session with {len(audio_files)} recordings:\n\n"
                
                for i, file_info in enumerate(audio_files):
                    recording_number = i + 1
                    time_offset = file_info['time_offset_minutes']
                    time_context = f" ({round(time_offset)} min into session)" if time_offset else ""
                    
                    combined_text += f"Recording {recording_number}{time_context}: {file_info['transcription'] or '[No transcription]'}\n\n"
            
            return {
                'combinedText': combined_text,
                'audioFiles': [
                    {
                        'id': f['id'],
                        'filename': f['original_filename'],
                        'order': f['recording_order'],
                        'timeOffset': f['time_offset_minutes'],
                        'confidence': f['confidence_score']
                    }
                    for f in audio_files
                ],
                'totalRecordings': len(audio_files),
                'averageConfidence': sum(f['confidence_score'] or 0 for f in audio_files) / len(audio_files) if audio_files else 0
            }
            
        finally:
            await self.connection_pool.release(conn)
    
    async def get_session_info(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get basic session information"""
        conn = await self.get_connection()
        try:
            query = """
                SELECT 
                    id,
                    user_id,
                    session_date,
                    session_status,
                    total_recordings,
                    total_exercises
                FROM workout_sessions 
                WHERE id = $1
            """
            row = await conn.fetchrow(query, session_id)
            return dict(row) if row else None
        finally:
            await self.connection_pool.release(conn)
    
    async def save_session_workout_data(self, user_id: str, session_id: str, workout_data: Dict[str, Any]) -> str:
        """Save workout data for a session"""
        conn = await self.get_connection()
        try:
            async with conn.transaction():
                # Create workout record with session reference
                workout_query = """
                    INSERT INTO workouts (
                        user_id, session_id, workout_date, workout_start_time,
                        workout_duration_minutes, total_exercises, notes
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                    RETURNING id
                """
                
                workout_date = parser.parse(workout_data.get('workout_date', str(date.today()))).date()
                workout_start_time = workout_data.get('workout_start_time')
                workout_duration = workout_data.get('workout_duration_minutes')
                notes = workout_data.get('notes')
                exercises = workout_data.get('exercises', [])
                
                workout_id = await conn.fetchval(
                    workout_query,
                    user_id, session_id, workout_date, workout_start_time,
                    workout_duration, len(exercises), notes
                )
                
                # Save exercises
                for exercise in exercises:
                    exercise_query = """
                        INSERT INTO exercises (
                            workout_id, exercise_name, exercise_type, muscle_groups,
                            sets, reps, weight_lbs, duration_minutes, distance_miles,
                            effort_level, rest_seconds, notes, order_in_workout
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                    """
                    
                    await conn.execute(
                        exercise_query,
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
                
                # Update user's total workout count
                await conn.execute(
                    "UPDATE users SET total_workouts = total_workouts + 1 WHERE id = $1",
                    user_id
                )
                
                return str(workout_id)
                
        finally:
            await self.connection_pool.release(conn)
    
    async def update_session_exercise_count(self, session_id: str, exercise_count: int):
        """Update the total exercises count for a session"""
        conn = await self.get_connection()
        try:
            await conn.execute(
                "UPDATE workout_sessions SET total_exercises = $2 WHERE id = $1",
                session_id, exercise_count
            )
        finally:
            await self.connection_pool.release(conn)

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
            max_weight = max(weights)
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

    # Speaker verification and voice profile methods
    
    async def save_voice_embedding(self, audio_file_id: str, embedding: List[float], quality_score: float) -> bool:
        """Save voice embedding to audio_files table"""
        conn = await self.get_connection()
        try:
            await conn.execute(
                """UPDATE audio_files 
                   SET voice_embedding = $1, voice_extracted = true, voice_quality_score = $2
                   WHERE id = $3""",
                embedding, quality_score, audio_file_id
            )
            return True
        except Exception as e:
            logger.error(f"Error saving voice embedding: {e}")
            return False
        finally:
            await self.connection_pool.release(conn)
    
    async def get_all_voice_profiles(self) -> List[Dict[str, Any]]:
        """Get all active voice profiles for speaker verification"""
        conn = await self.get_connection()
        try:
            results = await conn.fetch(
                """SELECT vp.id, vp.user_id, vp.embedding_vector, vp.confidence_score
                   FROM voice_profiles vp
                   WHERE vp.is_active = true
                   ORDER BY vp.created_at DESC"""
            )
            return [dict(row) for row in results]
        except Exception as e:
            logger.error(f"Error fetching voice profiles: {e}")
            return []
        finally:
            await self.connection_pool.release(conn)
    
    async def create_voice_profile(self, user_id: str, embedding: List[float], 
                                 confidence_score: float, workout_id: str = None) -> str:
        """Create a new voice profile for a user"""
        conn = await self.get_connection()
        try:
            result = await conn.fetchrow(
                """INSERT INTO voice_profiles 
                   (user_id, embedding_vector, confidence_score, created_from_workout_id)
                   VALUES ($1, $2, $3, $4)
                   RETURNING id""",
                user_id, embedding, confidence_score, workout_id
            )
            return result['id']
        except Exception as e:
            logger.error(f"Error creating voice profile: {e}")
            return None
        finally:
            await self.connection_pool.release(conn)
    
    async def save_speaker_verification_result(self, audio_file_id: str, voice_profile_id: str,
                                             similarity_score: float, confidence_level: str, 
                                             auto_linked: bool = False) -> str:
        """Save speaker verification result"""
        conn = await self.get_connection()
        try:
            result = await conn.fetchrow(
                """INSERT INTO speaker_verifications 
                   (audio_file_id, voice_profile_id, similarity_score, confidence_level, auto_linked)
                   VALUES ($1, $2, $3, $4, $5)
                   RETURNING id""",
                audio_file_id, voice_profile_id, similarity_score, confidence_level, auto_linked
            )
            return result['id']
        except Exception as e:
            logger.error(f"Error saving speaker verification result: {e}")
            return None
        finally:
            await self.connection_pool.release(conn)
    
    async def auto_link_workout_to_user(self, workout_id: str, user_id: str, 
                                      similarity_score: float) -> bool:
        """Automatically link a workout to a user based on voice match"""
        conn = await self.get_connection()
        try:
            async with conn.transaction():
                # Check if workout is still unclaimed
                workout_status = await conn.fetchrow(
                    "SELECT claim_status FROM workouts WHERE id = $1",
                    workout_id
                )
                
                if not workout_status or workout_status['claim_status'] != 'unclaimed':
                    logger.warning(f"Workout {workout_id} is not available for auto-linking")
                    return False
                
                # Use the claim_workout function with voice_match method
                result = await conn.fetchval(
                    "SELECT claim_workout($1, $2, $3, $4)",
                    user_id, workout_id, 'voice_match', similarity_score
                )
                
                return result is True
                
        except Exception as e:
            logger.error(f"Error auto-linking workout: {e}")
            return False
        finally:
            await self.connection_pool.release(conn)
    
    async def get_workout_id_from_audio_file(self, audio_file_id: str) -> str:
        """Get workout ID associated with an audio file"""
        conn = await self.get_connection()
        try:
            result = await conn.fetchrow(
                "SELECT id FROM workouts WHERE audio_file_id = $1",
                audio_file_id
            )
            return result['id'] if result else None
        except Exception as e:
            logger.error(f"Error fetching workout ID: {e}")
            return None
        finally:
            await self.connection_pool.release(conn)
    
    async def cleanup_expired_workouts(self) -> int:
        """Clean up workouts older than 30 days that are unclaimed"""
        conn = await self.get_connection()
        try:
            result = await conn.fetchval("SELECT expire_old_unclaimed_workouts()")
            logger.info(f"Expired {result} old unclaimed workouts")
            return result
        except Exception as e:
            logger.error(f"Error cleaning up expired workouts: {e}")
            return 0
        finally:
            await self.connection_pool.release(conn)