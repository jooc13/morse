import os
import sys
import time
import json
import logging
import asyncio
from typing import Dict, Any, List
from dotenv import load_dotenv

import redis
from transcriber import WhisperTranscriber
from llm_processor import WorkoutLLMProcessor
from database import DatabaseManager

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

try:
    from speaker_verifier import SpeakerVerifier
    SPEAKER_VERIFIER_AVAILABLE = True
except Exception as e:
    logger.warning(f"Speaker verifier not available: {e}")
    SPEAKER_VERIFIER_AVAILABLE = False

class WorkoutProcessor:
    def __init__(self):
        self.db = DatabaseManager()
        self.transcriber = WhisperTranscriber()
        self.llm_processor = WorkoutLLMProcessor()
        self.speaker_verifier = SpeakerVerifier() if SPEAKER_VERIFIER_AVAILABLE else None
        self.redis_client = None
        self.running = False
        
        try:
            self.redis_client = redis.Redis(
                host=os.getenv('REDIS_HOST', 'localhost'),
                port=int(os.getenv('REDIS_PORT', 6379)),
                password=os.getenv('REDIS_PASSWORD'),
                decode_responses=True
            )
            self.redis_client.ping()
            logger.info("Connected to Redis")
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}")
            logger.info("Running without Redis queue - processing files directly")

    async def process_audio_file(self, job_data: Dict[str, Any]) -> bool:
        """Process a single audio file through the transcription and LLM pipeline"""
        try:
            audio_file_id = job_data['audioFileId']
            file_path = job_data['filePath']
            user_id = job_data['userId']
            device_uuid = job_data['deviceUuid']

            # Convert host path to container path for mounted uploads directory
            if '/services/api/uploads/' in file_path:
                filename = os.path.basename(file_path)
                file_path = f'/app/uploads/{filename}'
                logger.info(f"Translated host path to container path: {file_path}")
            
            logger.info(f"Processing audio file {audio_file_id} for user {device_uuid}")
            
            # Update status to processing
            logger.info("Updating audio file status to processing...")
            await self.db.update_audio_file_status(audio_file_id, 'processing')
            
            # Step 1: Transcribe audio
            logger.info(f"Transcribing audio file: {file_path}")
            transcription_result = await self.transcriber.transcribe_audio(file_path)
            
            if not transcription_result['success']:
                logger.error(f"Transcription failed: {transcription_result['error']}")
                await self.db.update_audio_file_status(audio_file_id, 'failed')
                return False
            
            # Save transcription to database
            transcription_id = await self.db.save_transcription(
                audio_file_id,
                transcription_result['text'],
                transcription_result.get('confidence', 0.0),
                transcription_result.get('processing_time_ms', 0)
            )
            
            # Update audio file with duration
            duration_seconds = transcription_result.get('duration_seconds', 0.0)
            if duration_seconds > 0:
                await self.db.update_audio_file_duration(audio_file_id, duration_seconds)
            
            logger.info(f"Saved transcription {transcription_id}")
            
            # Step 2: Process with LLM to extract workout data
            logger.info("Processing transcription with LLM")
            workout_data = await self.llm_processor.extract_workout_data(
                transcription_result['text'],
                device_uuid
            )
            
            if not workout_data['success']:
                logger.error(f"LLM processing failed: {workout_data['error']}")
                await self.db.update_audio_file_status(audio_file_id, 'failed')
                return False
            
            # Step 3: Save workout and exercise data
            workout_id = await self.db.save_workout_data(
                user_id,
                audio_file_id,
                transcription_id,
                workout_data['workout']
            )
            
            logger.info(f"Saved workout {workout_id}")
            
            # Step 4: Extract voice embedding and perform speaker verification
            await self.process_speaker_verification(audio_file_id, file_path, workout_id)
            
            # Update status to completed
            await self.db.update_audio_file_status(audio_file_id, 'completed')
            await self.db.mark_audio_file_processed(audio_file_id)
            
            logger.info(f"Successfully processed audio file {audio_file_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error processing audio file: {str(e)}")
            try:
                await self.db.update_audio_file_status(job_data['audioFileId'], 'failed')
            except:
                pass
            return False

    async def poll_for_jobs(self):
        """Poll Redis for new transcription jobs"""
        while self.running:
            try:
                if not self.redis_client:
                    await asyncio.sleep(5)
                    continue
                
                # Try to get a job from the queue
                job_data = self.redis_client.blpop('bull:audio transcription:wait', timeout=5)
                
                if job_data:
                    try:
                        # blpop returns [queue_name, job_id] where job_id is the actual data we need
                        job_id = job_data[1].decode() if isinstance(job_data[1], bytes) else job_data[1]
                        
                        # Get the full job data from Redis hash
                        job_hash = self.redis_client.hgetall(f'bull:audio transcription:{job_id}')
                        if not job_hash:
                            logger.error(f"Job {job_id} not found in Redis")
                            continue
                        
                        # Parse the job data
                        job_data_str = job_hash.get('data', '{}')
                        if isinstance(job_data_str, bytes):
                            job_data_str = job_data_str.decode()
                        
                        job_payload = json.loads(job_data_str)
                        
                        logger.info(f"Processing job: {job_id}")
                        success = await self.process_audio_file(job_payload)
                        
                        if success:
                            logger.info("Job completed successfully")
                        else:
                            logger.error("Job failed")
                            
                    except json.JSONDecodeError as e:
                        logger.error(f"Failed to parse job data: {e}")
                    except Exception as e:
                        logger.error(f"Error processing job: {e}")
                        
            except Exception as e:
                logger.error(f"Error polling for jobs: {e}")
                await asyncio.sleep(10)

    async def process_pending_sessions(self):
        """Process complete workout sessions that are ready for LLM analysis"""
        try:
            pending_sessions = await self.db.get_pending_sessions()
            
            for session_info in pending_sessions:
                logger.info(f"Processing pending session: {session_info['id']}")
                await self.process_workout_session(session_info['id'], session_info['device_uuid'])
                
        except Exception as e:
            logger.error(f"Error processing pending sessions: {e}")

    async def process_pending_files(self):
        """Process any pending audio files that weren't processed through the queue"""
        try:
            pending_files = await self.db.get_pending_audio_files()
            
            for file_info in pending_files:
                logger.info(f"Processing pending file: {file_info['id']}")
                
                job_data = {
                    'audioFileId': file_info['id'],
                    'filePath': file_info['file_path'],
                    'userId': file_info['user_id'],
                    'deviceUuid': file_info['device_uuid'],
                    'originalFilename': file_info['original_filename']
                }
                
                await self.process_audio_file(job_data)
                
        except Exception as e:
            logger.error(f"Error processing pending files: {e}")

    async def start(self):
        """Start the worker process"""
        logger.info("Starting Morse workout processor...")
        self.running = True
        
        # Initialize database connection pool
        logger.info("About to initialize database connection pool...")
        try:
            await self.db.initialize_pool()
            logger.info("Database connection pool initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize database connection pool: {e}")
            logger.error(f"Exception type: {type(e).__name__}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise
        
        # Process any pending files first
        await self.process_pending_files()
        
        # Process any pending sessions
        await self.process_pending_sessions()
        
        # Start polling for new jobs
        if self.redis_client:
            logger.info("Starting job polling...")
            await self.poll_for_jobs()
        else:
            logger.info("No Redis connection - checking for pending files and sessions periodically")
            while self.running:
                await self.process_pending_files()
                await self.process_pending_sessions()
                await asyncio.sleep(30)  # Check every 30 seconds

    async def stop(self):
        """Stop the worker process"""
        logger.info("Stopping workout processor...")
        self.running = False
        await self.db.close_pool()

    async def process_workout_session(self, session_id: str, device_uuid: str) -> bool:
        """Process a complete workout session with multiple recordings"""
        try:
            logger.info(f"Processing workout session {session_id}")
            
            # Update session status to processing
            await self.db.update_session_status(session_id, 'processing')
            
            # Get combined transcription data
            session_data = await self.db.get_combined_session_transcription(session_id)
            
            if not session_data:
                logger.error(f"No transcription data found for session {session_id}")
                await self.db.update_session_status(session_id, 'failed', 'No transcription data')
                return False
            
            # Process with LLM
            logger.info(f"Processing session with {session_data['totalRecordings']} recordings")
            workout_data = await self.llm_processor.extract_session_workout_data(
                session_data, device_uuid
            )
            
            if not workout_data['success']:
                logger.error(f"LLM processing failed for session {session_id}: {workout_data['error']}")
                await self.db.update_session_status(session_id, 'failed', workout_data['error'])
                return False
            
            # Get user ID from session
            session_info = await self.db.get_session_info(session_id)
            if not session_info:
                logger.error(f"Session {session_id} not found")
                await self.db.update_session_status(session_id, 'failed', 'Session not found')
                return False
            
            user_id = session_info['user_id']
            
            # Save workout data with session reference
            workout_id = await self.db.save_session_workout_data(
                user_id,
                session_id,
                workout_data['workout']
            )
            
            # Update session status and exercise count
            total_exercises = len(workout_data['workout'].get('exercises', []))
            await self.db.update_session_status(
                session_id, 
                'completed',
                f'Processed {total_exercises} exercises from {session_data["totalRecordings"]} recordings'
            )
            await self.db.update_session_exercise_count(session_id, total_exercises)
            
            logger.info(f"Successfully processed session {session_id} -> workout {workout_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error processing session {session_id}: {str(e)}")
            try:
                await self.db.update_session_status(session_id, 'failed', str(e))
            except:
                pass
            return False

    async def process_speaker_verification(self, audio_file_id: str, file_path: str, workout_id: str) -> bool:
        """Process speaker verification for an audio file"""
        try:
            if not self.speaker_verifier:
                logger.info("Speaker verifier not available - skipping speaker verification")
                return True

            logger.info(f"Starting speaker verification for audio file {audio_file_id}")

            # Extract voice embedding from audio
            embedding_result = self.speaker_verifier.extract_voice_embedding(file_path)

            if not embedding_result['success']:
                logger.warning(f"Voice embedding extraction failed: {embedding_result['error']}")
                return False

            embedding = embedding_result['embedding']
            quality_score = embedding_result['quality_score']

            # Save embedding to audio_files table
            await self.db.save_voice_embedding(audio_file_id, embedding, quality_score)
            logger.info(f"Saved voice embedding (quality: {quality_score:.3f})")

            # Get all existing voice profiles for comparison
            voice_profiles = await self.db.get_all_voice_profiles()

            if not voice_profiles:
                logger.info("No existing voice profiles found - workout remains unclaimed")
                return True

            # Prepare embeddings for comparison
            known_embeddings = [profile['embedding_vector'] for profile in voice_profiles]

            # Perform speaker verification
            verification_result = self.speaker_verifier.verify_speaker(embedding, known_embeddings)

            logger.info(f"Speaker verification result: {verification_result}")

            # Save verification result
            best_match_profile = None
            if verification_result['best_match_index'] is not None:
                best_match_profile = voice_profiles[verification_result['best_match_index']]

                await self.db.save_speaker_verification_result(
                    audio_file_id,
                    best_match_profile['id'],
                    verification_result['similarity_score'],
                    verification_result['confidence_level'],
                    verification_result['match_found']
                )

            # Auto-link workout if high confidence match
            if verification_result['match_found'] and best_match_profile:
                user_id = best_match_profile['user_id']
                similarity_score = verification_result['similarity_score']

                success = await self.db.auto_link_workout_to_user(workout_id, user_id, similarity_score)

                if success:
                    logger.info(f"Auto-linked workout {workout_id} to user {user_id} (similarity: {similarity_score:.3f})")
                else:
                    logger.warning(f"Failed to auto-link workout {workout_id} - may already be claimed")
            else:
                logger.info(f"No high-confidence voice match - workout remains unclaimed")

            return True

        except Exception as e:
            logger.error(f"Error in speaker verification: {e}")
            return False

    async def cleanup_expired_workouts_task(self):
        """Periodic task to clean up expired workouts"""
        try:
            expired_count = await self.db.cleanup_expired_workouts()
            if expired_count > 0:
                logger.info(f"Cleaned up {expired_count} expired workouts")
        except Exception as e:
            logger.error(f"Error cleaning up expired workouts: {e}")

async def main():
    processor = WorkoutProcessor()
    
    try:
        await processor.start()
    except KeyboardInterrupt:
        logger.info("Received interrupt signal")
    finally:
        await processor.stop()
        logger.info("Workout processor stopped")

if __name__ == "__main__":
    asyncio.run(main())