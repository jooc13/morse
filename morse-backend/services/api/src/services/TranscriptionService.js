const OpenAI = require('openai');
const fs = require('fs');
const fsPromises = require('fs').promises;

class TranscriptionService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.provider = process.env.TRANSCRIPTION_PROVIDER || 'openai';
  }

  /**
   * Transcribe audio file using external API
   */
  async transcribeAudio(filePath, audioFileId, deviceUuid = null, userId = null, audioBuffer = null) {
    try {
      if (this.provider === 'openai') {
        return await this.transcribeWithWhisper(filePath, audioFileId, audioBuffer);
      } else if (this.provider === 'worker') {
        return await this.transcribeWithWorker(filePath, audioFileId, deviceUuid, userId, audioBuffer);
      } else {
        throw new Error(`Unsupported transcription provider: ${this.provider}`);
      }
    } catch (error) {
      console.error('Transcription error:', error);
      throw error;
    }
  }

  /**
   * Transcribe using OpenAI Whisper API
   */
  async transcribeWithWhisper(filePath, audioFileId, audioBuffer = null) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    let audioFile;
    let tempFilePath = null;

    try {
      // Handle in-memory buffer
      if (filePath.startsWith('memory://') && audioBuffer) {
        // Create a temporary file for OpenAI API
        tempFilePath = `/tmp/temp-audio-${audioFileId}.mp3`;
        await fsPromises.writeFile(tempFilePath, audioBuffer);
        audioFile = fs.createReadStream(tempFilePath);
      } else if (Buffer.isBuffer(audioBuffer)) {
        // Direct buffer input
        tempFilePath = `/tmp/temp-audio-${audioFileId}.mp3`;
        await fsPromises.writeFile(tempFilePath, audioBuffer);
        audioFile = fs.createReadStream(tempFilePath);
      } else {
        // Regular file path
        audioFile = fs.createReadStream(filePath);
      }

      console.log(`Starting Whisper transcription for audio file: ${audioFileId}`);

      const transcription = await this.openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: 'en', // Optional: specify language for better accuracy
        response_format: 'text',
        temperature: 0.0, // Lower temperature for more deterministic output
      });

      // Clean up temporary file if created
      if (tempFilePath) {
        try {
          await fsPromises.unlink(tempFilePath);
        } catch (error) {
          console.warn('Failed to delete temp file:', tempFilePath, error.message);
        }
      }

      if (!transcription || transcription.trim().length === 0) {
        throw new Error('No transcription text returned from OpenAI Whisper');
      }

      return {
        success: true,
        text: transcription.trim(),
        confidence: 0.95, // Whisper doesn't provide confidence, but it's generally accurate
        processing_time_ms: 0, // Could track this if needed
        language: 'en',
        provider: 'openai'
      };
    } catch (error) {
      // Clean up temporary file on error
      if (tempFilePath) {
        try {
          await fsPromises.unlink(tempFilePath);
        } catch (cleanupError) {
          console.warn('Failed to delete temp file during cleanup:', tempFilePath, cleanupError.message);
        }
      }

      console.error('OpenAI Whisper transcription error:', error.message);

      // Check if it's a quota or rate limit error
      const errorMessage = error.message || '';
      const isQuotaError = errorMessage.includes('quota') ||
                          errorMessage.includes('rate limit') ||
                          errorMessage.includes('insufficient_quota') ||
                          error.status === 429 ||
                          error.status === 402;

      if (isQuotaError) {
        return {
          success: false,
          error: "API quota exceeded. The transcription service has reached its limit. Please try again later or contact support.",
          retryable: true,
          retryAfter: 3600 // Default 1 hour for quota errors
        };
      }

      throw new Error(`OpenAI Whisper transcription failed: ${errorMessage}`);
    }
  }

  /**
   * Transcribe using worker service (Whisper) - fallback option
   */
  async transcribeWithWorker(filePath, audioFileId, deviceUuid, userId, audioBuffer = null) {
    try {
      // For in-memory files, we can't use the worker since it expects files on disk
      // Fall back to direct transcription with OpenAI
      if (filePath.startsWith('memory://')) {
        console.log('In-memory file detected, falling back to direct OpenAI transcription');
        return await this.transcribeWithWhisper(filePath, audioFileId, audioBuffer);
      }

      // Queue the audio file for transcription by the worker
      const queueService = require('../services/QueueService');

      const jobData = {
        type: 'transcription',
        audioFileId: audioFileId,
        filePath: filePath,
        timestamp: new Date().toISOString(),
        userId: userId || 'anonymous',
        deviceUuid: deviceUuid || 'test-device',
        sessionId: null,
        fileName: require('path').basename(filePath)
      };

      const result = await queueService.addTranscriptionJob(jobData);

      console.log(`Audio file ${audioFileId} queued for worker transcription`);

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
   * Get audio duration (helper method)
   */
  async getAudioDuration(filePath) {
    // This is a placeholder - you might want to use a library like 'node-ffprobe' or 'ffmpeg-static'
    return 0;
  }
}

module.exports = new TranscriptionService();