import os
import logging
import numpy as np
import torch
import torchaudio
from typing import List, Optional, Tuple, Dict, Any
from speechbrain.pretrained import EncoderClassifier
from sklearn.metrics.pairwise import cosine_similarity
import librosa
import soundfile as sf

logger = logging.getLogger(__name__)

class SpeakerVerifier:
    def __init__(self):
        self.model = None
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.embedding_dim = 192  # ECAPA-TDNN embedding dimension
        self.confidence_threshold = 0.95  # 95% confidence threshold
        self.voice_quality_threshold = 0.6  # Minimum quality score for voice samples
        
        # Initialize the model
        self._load_model()
    
    def _load_model(self):
        """Load the SpeechBrain ECAPA-TDNN model for speaker verification"""
        try:
            logger.info("Loading SpeechBrain ECAPA-TDNN model...")
            # Use the pre-trained ECAPA-TDNN model from SpeechBrain
            self.model = EncoderClassifier.from_hparams(
                source="speechbrain/spkrec-ecapa-voxceleb",
                savedir="/app/pretrained_models/spkrec-ecapa-voxceleb"
            )
            logger.info("Speaker verification model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load speaker verification model: {e}")
            raise
    
    def extract_voice_embedding(self, audio_file_path: str) -> Dict[str, Any]:
        """
        Extract voice embedding from audio file
        
        Returns:
            Dict containing:
            - embedding: numpy array of voice embedding
            - quality_score: float indicating voice sample quality
            - success: boolean
            - error: error message if failed
        """
        try:
            logger.info(f"Extracting voice embedding from: {audio_file_path}")
            
            # Load and preprocess audio
            audio_data, sample_rate = self._load_and_preprocess_audio(audio_file_path)
            
            if audio_data is None:
                return {
                    'success': False,
                    'error': 'Failed to load audio file',
                    'embedding': None,
                    'quality_score': 0.0
                }
            
            # Calculate voice quality score
            quality_score = self._calculate_voice_quality(audio_data, sample_rate)
            
            if quality_score < self.voice_quality_threshold:
                logger.warning(f"Low voice quality score: {quality_score:.3f}")
                # Still proceed but flag the quality
            
            # Extract embedding using SpeechBrain model
            with torch.no_grad():
                # Convert to tensor and move to device
                audio_tensor = torch.from_numpy(audio_data).unsqueeze(0).to(self.device)
                
                # Extract embedding
                embeddings = self.model.encode_batch(audio_tensor)
                embedding = embeddings.squeeze().cpu().numpy()
                
                # Normalize embedding
                embedding = embedding / np.linalg.norm(embedding)
                
            logger.info(f"Successfully extracted voice embedding (dim: {len(embedding)}, quality: {quality_score:.3f})")
            
            return {
                'success': True,
                'embedding': embedding.tolist(),  # Convert to list for JSON serialization
                'quality_score': float(quality_score),
                'error': None
            }
            
        except Exception as e:
            logger.error(f"Error extracting voice embedding: {e}")
            return {
                'success': False,
                'error': str(e),
                'embedding': None,
                'quality_score': 0.0
            }
    
    def compare_embeddings(self, embedding1: List[float], embedding2: List[float]) -> float:
        """
        Compare two voice embeddings using cosine similarity
        
        Returns:
            Similarity score between 0 and 1 (1 = identical)
        """
        try:
            # Convert to numpy arrays
            emb1 = np.array(embedding1).reshape(1, -1)
            emb2 = np.array(embedding2).reshape(1, -1)
            
            # Calculate cosine similarity
            similarity = cosine_similarity(emb1, emb2)[0][0]
            
            # Convert to 0-1 range (cosine similarity is -1 to 1)
            similarity_score = (similarity + 1) / 2
            
            return float(similarity_score)
            
        except Exception as e:
            logger.error(f"Error comparing embeddings: {e}")
            return 0.0
    
    def verify_speaker(self, test_embedding: List[float], known_embeddings: List[List[float]]) -> Dict[str, Any]:
        """
        Verify if test embedding matches any of the known embeddings
        
        Returns:
            Dict containing:
            - match_found: boolean
            - best_match_index: index of best matching embedding
            - similarity_score: float similarity score
            - confidence_level: string (high/medium/low/no_match)
        """
        try:
            if not known_embeddings:
                return {
                    'match_found': False,
                    'best_match_index': None,
                    'similarity_score': 0.0,
                    'confidence_level': 'no_match'
                }
            
            best_similarity = 0.0
            best_match_index = -1
            
            # Compare with each known embedding
            for i, known_embedding in enumerate(known_embeddings):
                similarity = self.compare_embeddings(test_embedding, known_embedding)
                
                if similarity > best_similarity:
                    best_similarity = similarity
                    best_match_index = i
            
            # Determine confidence level
            if best_similarity >= self.confidence_threshold:
                confidence_level = 'high'
                match_found = True
            elif best_similarity >= 0.85:
                confidence_level = 'medium'
                match_found = False  # Not confident enough for auto-linking
            elif best_similarity >= 0.7:
                confidence_level = 'low'
                match_found = False
            else:
                confidence_level = 'no_match'
                match_found = False
            
            logger.info(f"Speaker verification result: similarity={best_similarity:.3f}, confidence={confidence_level}")
            
            return {
                'match_found': match_found,
                'best_match_index': best_match_index if best_match_index >= 0 else None,
                'similarity_score': float(best_similarity),
                'confidence_level': confidence_level
            }
            
        except Exception as e:
            logger.error(f"Error in speaker verification: {e}")
            return {
                'match_found': False,
                'best_match_index': None,
                'similarity_score': 0.0,
                'confidence_level': 'no_match'
            }
    
    def _load_and_preprocess_audio(self, audio_file_path: str) -> Tuple[Optional[np.ndarray], int]:
        """Load and preprocess audio file for speaker verification"""
        try:
            # Check if file exists
            if not os.path.exists(audio_file_path):
                logger.error(f"Audio file not found: {audio_file_path}")
                return None, 0
            
            # Load audio using librosa (handles various formats)
            audio_data, sample_rate = librosa.load(audio_file_path, sr=16000)  # Resample to 16kHz
            
            # Ensure minimum length (at least 1 second for reliable speaker verification)
            min_length = sample_rate * 1  # 1 second
            if len(audio_data) < min_length:
                logger.warning(f"Audio too short for reliable speaker verification: {len(audio_data)/sample_rate:.2f}s")
                # Pad with zeros if too short
                audio_data = np.pad(audio_data, (0, min_length - len(audio_data)), mode='constant')
            
            # Limit maximum length to 30 seconds for efficiency
            max_length = sample_rate * 30
            if len(audio_data) > max_length:
                audio_data = audio_data[:max_length]
            
            # Normalize audio
            audio_data = audio_data / np.max(np.abs(audio_data))
            
            return audio_data, sample_rate
            
        except Exception as e:
            logger.error(f"Error loading audio file {audio_file_path}: {e}")
            return None, 0
    
    def _calculate_voice_quality(self, audio_data: np.ndarray, sample_rate: int) -> float:
        """
        Calculate voice quality score based on audio characteristics
        
        Returns:
            Quality score between 0 and 1 (1 = best quality)
        """
        try:
            # Calculate various audio quality metrics
            
            # 1. Signal-to-noise ratio estimate
            frame_length = 2048
            hop_length = 512
            
            # Calculate energy per frame
            stft = librosa.stft(audio_data, n_fft=frame_length, hop_length=hop_length)
            magnitude = np.abs(stft)
            energy = np.sum(magnitude ** 2, axis=0)
            
            # Estimate SNR (simple approach)
            if len(energy) > 0:
                energy_mean = np.mean(energy)
                energy_std = np.std(energy)
                snr_estimate = energy_mean / (energy_std + 1e-8)
                snr_score = min(snr_estimate / 10.0, 1.0)  # Normalize to 0-1
            else:
                snr_score = 0.0
            
            # 2. Voice activity detection (simple energy-based)
            energy_threshold = np.percentile(energy, 30)  # Bottom 30% considered silence
            voice_frames = np.sum(energy > energy_threshold)
            voice_ratio = voice_frames / len(energy) if len(energy) > 0 else 0
            
            # 3. Spectral characteristics
            spectral_centroid = librosa.feature.spectral_centroid(y=audio_data, sr=sample_rate)[0]
            spectral_rolloff = librosa.feature.spectral_rolloff(y=audio_data, sr=sample_rate)[0]
            
            # Check if spectral characteristics are in typical speech range
            speech_centroid_range = (500, 4000)  # Typical speech frequency range
            centroid_score = 1.0 if np.mean(spectral_centroid) > speech_centroid_range[0] else 0.5
            
            # 4. Duration score
            duration = len(audio_data) / sample_rate
            duration_score = min(duration / 5.0, 1.0)  # Prefer longer samples up to 5 seconds
            
            # Combine scores
            quality_score = (
                snr_score * 0.3 +
                voice_ratio * 0.3 +
                centroid_score * 0.2 +
                duration_score * 0.2
            )
            
            return float(quality_score)
            
        except Exception as e:
            logger.error(f"Error calculating voice quality: {e}")
            return 0.5  # Return neutral score on error
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get information about the loaded model"""
        return {
            'model_name': 'SpeechBrain ECAPA-TDNN',
            'embedding_dimension': self.embedding_dim,
            'confidence_threshold': self.confidence_threshold,
            'voice_quality_threshold': self.voice_quality_threshold,
            'device': str(self.device),
            'model_loaded': self.model is not None
        }