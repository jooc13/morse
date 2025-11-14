const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class TranscriptionService {
  constructor() {
    this.apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    this.provider = process.env.TRANSCRIPTION_PROVIDER || 'gemini'; // gemini, openai, assemblyai, etc.
  }

  /**
   * Transcribe audio file using external API
   */
  async transcribeAudio(filePath, audioFileId) {
    try {
      if (this.provider === 'gemini') {
        return await this.transcribeWithGemini(filePath, audioFileId);
      } else {
        throw new Error(`Unsupported transcription provider: ${this.provider}`);
      }
    } catch (error) {
      console.error('Transcription error:', error);
      throw error;
    }
  }

  /**
   * Transcribe using Google Gemini Pro API
   */
  async transcribeWithGemini(filePath, audioFileId) {
    if (!this.apiKey) {
      throw new Error('GOOGLE_GEMINI_API_KEY or GEMINI_API_KEY environment variable is required');
    }

    try {
      // Read the audio file
      const audioData = await fs.readFile(filePath);
      const audioBase64 = audioData.toString('base64');
      
      // Determine MIME type from file extension
      const ext = path.extname(filePath).toLowerCase();
      let mimeType = 'audio/mpeg';
      if (ext === '.m4a') {
        mimeType = 'audio/mp4';
      } else if (ext === '.wav') {
        mimeType = 'audio/wav';
      }

      // Call Gemini API for transcription
      // Using gemini-2.0-flash-exp or gemini-1.5-pro for audio support
      const model = 'gemini-2.0-flash-exp'; // or 'gemini-1.5-pro' if 2.0 not available
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`,
        {
          contents: [{
            parts: [
              {
                text: "Transcribe this audio recording of someone describing their workout. Extract the spoken text verbatim. Return only the transcription text, no additional commentary or formatting."
              },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: audioBase64
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.0,
            maxOutputTokens: 8192,
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 120000 // 120 second timeout for audio processing
        }
      );

      const transcriptionText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      if (!transcriptionText) {
        throw new Error('No transcription text returned from Gemini API');
      }

      return {
        success: true,
        text: transcriptionText.trim(),
        confidence: 0.9, // Gemini doesn't provide confidence scores
        processing_time_ms: 0, // Could track this if needed
        language: 'en',
        provider: 'gemini'
      };
    } catch (error) {
      console.error('Gemini transcription error:', error.response?.data || error.message);
      const errorMessage = error.response?.data?.error?.message || error.message;
      
      // Check if it's a quota error - these should be retried later
      const isQuotaError = errorMessage.includes('quota') || 
                          errorMessage.includes('rate limit') ||
                          error.response?.status === 429;
      
      if (isQuotaError) {
        return {
          success: false,
          error: errorMessage,
          retryable: true,
          retryAfter: error.response?.data?.error?.retryAfter || 60 // Default 60 seconds
        };
      }
      
      throw new Error(`Gemini transcription failed: ${errorMessage}`);
    }
  }

  /**
   * Get audio duration (helper method)
   */
  async getAudioDuration(filePath) {
    // This is a placeholder - you might want to use a library like 'node-ffprobe' or 'ffmpeg-static'
    // For now, return 0 and let the database handle it
    return 0;
  }
}

module.exports = new TranscriptionService();

