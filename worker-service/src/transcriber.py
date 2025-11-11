import os
import time
import logging
import whisper
import torch
import asyncio
import soundfile as sf
from typing import Dict, Any
from pathlib import Path

logger = logging.getLogger(__name__)

class WhisperTranscriber:
    def __init__(self):
        self.model = None
        self.model_name = os.getenv('WHISPER_MODEL', 'base')
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        logger.info(f"Using device: {self.device}")
        self._load_model()

    def _load_model(self):
        """Load the Whisper model"""
        try:
            logger.info(f"Loading Whisper model: {self.model_name}")
            self.model = whisper.load_model(self.model_name, device=self.device)
            logger.info("Whisper model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load Whisper model: {e}")
            raise

    async def transcribe_audio(self, file_path: str) -> Dict[str, Any]:
        """Transcribe an audio file using Whisper"""
        try:
            if not os.path.exists(file_path):
                return {
                    'success': False,
                    'error': f'Audio file not found: {file_path}'
                }

            logger.info(f"Starting transcription of: {file_path}")
            start_time = time.time()

            # Get audio duration first
            duration_seconds = self._get_audio_duration(file_path)

            # Run transcription in a thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None, 
                self._transcribe_sync, 
                file_path
            )

            processing_time = int((time.time() - start_time) * 1000)
            
            if result is None:
                return {
                    'success': False,
                    'error': 'Transcription returned no result'
                }

            # Extract text and segments
            text = result['text'].strip()
            segments = result.get('segments', [])
            
            # Calculate average confidence from segments
            confidence = 0.0
            if segments:
                confidence_scores = [
                    segment.get('avg_logprob', 0.0) 
                    for segment in segments 
                    if 'avg_logprob' in segment
                ]
                if confidence_scores:
                    # Convert log probabilities to confidence (0-1 scale)
                    confidence = max(0.0, min(1.0, (sum(confidence_scores) / len(confidence_scores) + 1.0) / 2.0))

            logger.info(f"Transcription completed in {processing_time}ms")
            logger.info(f"Transcribed text: {text[:100]}...")
            
            return {
                'success': True,
                'text': text,
                'confidence': confidence,
                'processing_time_ms': processing_time,
                'segments': segments,
                'language': result.get('language', 'unknown'),
                'duration_seconds': duration_seconds
            }

        except Exception as e:
            logger.error(f"Transcription error: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    def _get_audio_duration(self, file_path: str) -> float:
        """Get audio file duration in seconds"""
        try:
            data, samplerate = sf.read(file_path)
            duration = len(data) / samplerate
            logger.info(f"Audio duration: {duration:.2f} seconds")
            return round(duration, 2)
        except Exception as e:
            logger.warning(f"Could not get audio duration: {e}")
            return 0.0

    def _transcribe_sync(self, file_path: str):
        """Synchronous transcription method"""
        try:
            # Whisper transcription options
            options = {
                'language': 'en',  # Assuming English for workout audio
                'task': 'transcribe',
                'temperature': 0.0,  # More deterministic results
                'best_of': 1,
                'beam_size': 5,
                'patience': 1.0,
                'length_penalty': 1.0,
                'suppress_tokens': "-1",
                'initial_prompt': "This is a recording of someone describing their workout exercises, including reps, sets, weights, and effort levels."
            }
            
            result = self.model.transcribe(file_path, **options)
            return result
            
        except Exception as e:
            logger.error(f"Sync transcription error: {e}")
            raise

    def get_model_info(self) -> Dict[str, Any]:
        """Get information about the loaded model"""
        return {
            'model_name': self.model_name,
            'device': self.device,
            'model_loaded': self.model is not None
        }

    async def health_check(self) -> bool:
        """Check if the transcriber is working properly"""
        try:
            if self.model is None:
                return False
            
            # Could add a test transcription here if needed
            return True
            
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return False