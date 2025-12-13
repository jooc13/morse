const axios = require('axios');
const path = require('path');
const fs = require('fs').promises;

class TranscriptionService {
  constructor() {
    this.anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    this.geminiApiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    this.provider = process.env.TRANSCRIPTION_PROVIDER || 'anthropic'; // anthropic, gemini, openai, assemblyai, etc.
  }

  /**
   * Transcribe audio file using external API
   */
  async transcribeAudio(filePath, audioFileId, deviceUuid = null, userId = null) {
    try {
      if (this.provider === 'worker') {
        return await this.transcribeWithWorker(filePath, audioFileId, deviceUuid, userId);
      } else if (this.provider === 'anthropic') {
        return await this.transcribeWithAnthropic(filePath, audioFileId);
      } else if (this.provider === 'gemini') {
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
   * Transcribe using worker service (Whisper)
   */
  async transcribeWithWorker(filePath, audioFileId, deviceUuid, userId) {
    try {
      // Queue the audio file for transcription by the worker
      const queueService = require('../services/QueueService');

      // Add job to transcription queue
      const jobData = {
        type: 'transcription',
        audioFileId: audioFileId,
        filePath: filePath, // This will be the host path, mounted at /app/uploads in container
        timestamp: new Date().toISOString(),
        userId: userId || 'anonymous', // Use provided userId or default
        deviceUuid: deviceUuid || 'test-device', // Use provided deviceUuid or default
        sessionId: null, // No session context for pure transcription
        fileName: path.basename(filePath)
      };

      const result = await queueService.addTranscriptionJob(jobData);

      console.log(`Audio file ${audioFileId} queued for worker transcription`);

      // Return a placeholder response - the actual transcription will be processed asynchronously
      return {
        success: true,
        text: null, // Will be filled by worker
        confidence: 0,
        processing_time_ms: 0,
        language: 'en',
        provider: 'worker',
        queued: result.queued,
        jobId: result.jobId,
        message: 'Audio file queued for transcription processing'
      };
    } catch (error) {
      console.error('Worker transcription error:', error);
      throw new Error(`Worker transcription failed: ${error.message}`);
    }
  }

  /**
   * Transcribe using Anthropic Claude API
   */
  async transcribeWithAnthropic(filePath, audioFileId) {
    if (!this.anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
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
      } else if (ext === '.mp3') {
        mimeType = 'audio/mpeg';
      }

      // Call Anthropic Claude API for transcription
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4096,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Transcribe this audio recording of someone describing their workout. Extract the spoken text verbatim. Return only the transcription text, no additional commentary or formatting.'
                },
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: mimeType,
                    data: audioBase64
                  }
                }
              ]
            }
          ]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.anthropicApiKey,
            'anthropic-version': '2023-06-01'
          },
          timeout: 180000 // 3 minute timeout for audio processing
        }
      );

      const transcriptionText = response.data?.content?.[0]?.text || '';

      if (!transcriptionText) {
        throw new Error('No transcription text returned from Anthropic API');
      }

      return {
        success: true,
        text: transcriptionText.trim(),
        confidence: 0.95, // Claude typically provides high quality transcriptions
        processing_time_ms: 0, // Could track this if needed
        language: 'en',
        provider: 'anthropic'
      };
    } catch (error) {
      console.error('Anthropic transcription error:', error.response?.data || error.message);
      const errorMessage = error.response?.data?.error?.message || error.message;

      // Check if it's a quota error - these should be retried later
      const isQuotaError = errorMessage.includes('quota') ||
                          errorMessage.includes('rate limit') ||
                          errorMessage.includes('credit') ||
                          error.response?.status === 429;

      if (isQuotaError) {
        return {
          success: false,
          error: errorMessage,
          retryable: true,
          retryAfter: error.response?.data?.error?.retryAfter || 120 // Default 2 minutes
        };
      }

      throw new Error(`Anthropic transcription failed: ${errorMessage}`);
    }
  }

  /**
   * Transcribe using Google Gemini Pro API
   */
  async transcribeWithGemini(filePathOrBuffer, audioFileId, fileName = '') {
    if (!this.geminiApiKey) {
      throw new Error('GOOGLE_GEMINI_API_KEY or GEMINI_API_KEY environment variable is required');
    }

    try {
      // Handle both file path and buffer
      let audioData;
      let mimeType = 'audio/mpeg';

      if (Buffer.isBuffer(filePathOrBuffer)) {
        audioData = filePathOrBuffer;
        // Determine MIME type from filename if provided
        if (fileName) {
          const ext = path.extname(fileName).toLowerCase();
          if (ext === '.m4a') mimeType = 'audio/mp4';
          else if (ext === '.wav') mimeType = 'audio/wav';
        }
      } else {
        // For backward compatibility, read from file path
        const fs = require('fs').promises;
        audioData = await fs.readFile(filePathOrBuffer);
        const ext = path.extname(filePathOrBuffer).toLowerCase();
        if (ext === '.m4a') mimeType = 'audio/mp4';
        else if (ext === '.wav') mimeType = 'audio/wav';
      }

      const audioBase64 = audioData.toString('base64');

      // Call Gemini API for transcription
      // Using gemini-2.0-flash-exp or gemini-1.5-pro for audio support
      const model = 'gemini-2.0-flash-exp'; // or 'gemini-1.5-pro' if 2.0 not available
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.geminiApiKey}`,
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

