import os
import sys
import time
import json
import logging
import asyncio
from typing import Dict, Any
from dotenv import load_dotenv

import redis
from transcriber import WhisperTranscriber
from llm_processor_unified import WorkoutLLMProcessor
from database import DatabaseManager

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class WorkoutProcessor:
    def __init__(self):
        self.db = DatabaseManager()
        self.transcriber = WhisperTranscriber()
        self.llm_processor = WorkoutLLMProcessor()
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
        
        # Start polling for new jobs
        if self.redis_client:
            logger.info("Starting job polling...")
            await self.poll_for_jobs()
        else:
            logger.info("No Redis connection - checking for pending files periodically")
            while self.running:
                await self.process_pending_files()
                await asyncio.sleep(30)  # Check every 30 seconds

    async def stop(self):
        """Stop the worker process"""
        logger.info("Stopping workout processor...")
        self.running = False
        await self.db.close_pool()

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