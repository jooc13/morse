const TranscriptionService = require('../../src/services/TranscriptionService');
const fs = require('fs');
const path = require('path');

describe('TranscriptionService', () => {
  let transcriptionService;
  let testAudioBuffer;

  beforeAll(() => {
    // Mock OpenAI API
    jest.mock('openai', () => {
      return jest.fn().mockImplementation(() => ({
        audio: {
          transcriptions: {
            create: jest.fn()
          }
        }
      }));
    });

    transcriptionService = new TranscriptionService();

    // Create a mock audio buffer for testing
    testAudioBuffer = Buffer.from('fake audio data');
  });

  describe('constructor', () => {
    it('should initialize with OpenAI provider', () => {
      expect(transcriptionService.provider).toBe('openai');
    });

    it('should have default configuration', () => {
      expect(transcriptionService.config).toBeDefined();
      expect(transcriptionService.config.model).toBe('whisper-1');
    });
  });

  describe('transcribeAudio', () => {
    let mockCreate;

    beforeEach(() => {
      const OpenAI = require('openai');
      mockCreate = new OpenAI().audio.transcriptions.create;
      mockCreate.mockClear();
    });

    it('should successfully transcribe audio file with OpenAI', async () => {
      // Mock successful OpenAI response
      mockCreate.mockResolvedValueOnce({
        text: 'I did 10 reps of bench press at 150 pounds'
      });

      const result = await transcriptionService.transcribeAudio(
        testAudioBuffer,
        'test-file.mp3'
      );

      expect(mockCreate).toHaveBeenCalledWith({
        file: expect.any(Object),
        model: 'whisper-1',
        language: 'en',
        response_format: 'json'
      });

      expect(result).toEqual({
        success: true,
        text: 'I did 10 reps of bench press at 150 pounds',
        provider: 'openai'
      });
    });

    it('should handle OpenAI API errors gracefully', async () => {
      // Mock OpenAI API error
      const apiError = new Error('OpenAI API Error');
      apiError.status = 429;
      mockCreate.mockRejectedValueOnce(apiError);

      const result = await transcriptionService.transcribeAudio(
        testAudioBuffer,
        'test-file.mp3'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.retryable).toBe(true);
    });

    it('should validate file format', async () => {
      const invalidFile = Buffer.from('not audio');

      // Mock the file type check
      jest.spyOn(fs, 'readFileSync').mockReturnValueOnce(invalidFile);

      const result = await transcriptionService.transcribeAudio(
        invalidFile,
        'test-file.txt'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid file format');
    });

    it('should handle empty audio buffer', async () => {
      const emptyBuffer = Buffer.alloc(0);

      const result = await transcriptionService.transcribeAudio(
        emptyBuffer,
        'test-file.mp3'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Empty audio file');
    });

    it('should detect language from filename', async () => {
      mockCreate.mockResolvedValueOnce({
        text: 'Text in Spanish'
      });

      // Override the language detection
      const service = new TranscriptionService({
        detectLanguage: true
      });

      await service.transcribeAudio(
        testAudioBuffer,
        'spanish-audio.mp3'
      );

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          language: 'auto'
        })
      );
    });
  });

  describe('switchProvider', () => {
    it('should switch to Gemini provider', () => {
      transcriptionService.switchProvider('gemini');
      expect(transcriptionService.provider).toBe('gemini');
    });

    it('should handle invalid provider', () => {
      expect(() => {
        transcriptionService.switchProvider('invalid');
      }).toThrow('Invalid provider: invalid');
    });
  });

  describe('getSupportedFormats', () => {
    it('should return supported audio formats', () => {
      const formats = transcriptionService.getSupportedFormats();
      expect(formats).toContain('.mp3');
      expect(formats).toContain('.wav');
      expect(formats).toContain('.m4a');
    });
  });

  describe('validateAudioFile', () => {
    it('should validate MP3 files', () => {
      const isValid = transcriptionService.validateAudioFile('test.mp3');
      expect(isValid).toBe(true);
    });

    it('should validate WAV files', () => {
      const isValid = transcriptionService.validateAudioFile('test.wav');
      expect(isValid).toBe(true);
    });

    it('should reject unsupported files', () => {
      const isValid = transcriptionService.validateAudioFile('test.txt');
      expect(isValid).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle network errors', async () => {
      const networkError = new Error('Network Error');
      networkError.code = 'ECONNRESET';
      mockCreate.mockRejectedValueOnce(networkError);

      const result = await transcriptionService.transcribeAudio(
        testAudioBuffer,
        'test-file.mp3'
      );

      expect(result.success).toBe(false);
      expect(result.retryable).toBe(true);
    });

    it('should handle quota exceeded errors', async () => {
      const quotaError = new Error('Quota exceeded');
      quotaError.status = 402;
      mockCreate.mockRejectedValueOnce(quotaError);

      const result = await transcriptionService.transcribeAudio(
        testAudioBuffer,
        'test-file.mp3'
      );

      expect(result.success).toBe(false);
      expect(result.retryable).toBe(true);
      expect(result.retryAfter).toBeDefined();
    });
  });
});