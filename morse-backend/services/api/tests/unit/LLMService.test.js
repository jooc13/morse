const LLMService = require('../../src/services/LLMService');

describe('LLMService', () => {
  let llmService;
  let mockOpenAI;
  let mockAnthropic;

  beforeAll(() => {
    // Mock OpenAI
    mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    };
    jest.mock('openai', () => jest.fn(() => mockOpenAI));

    // Mock Anthropic
    mockAnthropic = {
      messages: {
        create: jest.fn()
      }
    };
    jest.mock('@anthropic-ai/sdk', () => jest.fn(() => mockAnthropic));

    llmService = new LLMService();
  });

  describe('constructor', () => {
    it('should initialize with default OpenAI provider', () => {
      expect(llmService.provider).toBe('openai');
    });

    it('should initialize with custom config', () => {
      const customConfig = {
        provider: 'anthropic',
        model: 'claude-3-sonnet',
        maxTokens: 4000
      };
      const service = new LLMService(customConfig);
      expect(service.provider).toBe('anthropic');
      expect(service.config.model).toBe('claude-3-sonnet');
    });
  });

  describe('extractWorkoutData', () => {
    const mockTranscription = `
      Today I did a great workout. I started with bench press - did 3 sets of 10 reps at 150 pounds.
      Then I moved to squats - 4 sets of 12 reps with 200 pounds.
      Finally, I ran on the treadmill for 30 minutes.
    `;

    beforeEach(() => {
      mockOpenAI.chat.completions.create.mockClear();
      mockAnthropic.messages.create.mockClear();
    });

    it('should extract workout data using OpenAI', async () => {
      const expectedWorkout = {
        title: 'Strength and Cardio Workout',
        exercises: [
          {
            name: 'Bench Press',
            category: 'strength',
            sets: 3,
            reps: 10,
            weight: 150,
            unit: 'lbs'
          },
          {
            name: 'Squats',
            category: 'strength',
            sets: 4,
            reps: 12,
            weight: 200,
            unit: 'lbs'
          },
          {
            name: 'Treadmill Run',
            category: 'cardio',
            duration_seconds: 1800,
            unit: 'seconds'
          }
        ]
      };

      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify(expectedWorkout)
          }
        }]
      });

      const result = await llmService.extractWorkoutData(mockTranscription);

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o-mini',
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system'
            }),
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining(mockTranscription)
            })
          ])
        })
      );

      expect(result).toEqual({
        success: true,
        workout: expectedWorkout,
        provider: 'openai'
      });
    });

    it('should handle malformed JSON response', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'Invalid JSON response'
          }
        }]
      });

      const result = await llmService.extractWorkoutData(mockTranscription);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to parse workout data');
    });

    it('should extract workout data using Anthropic', async () => {
      llmService.switchProvider('anthropic');

      const expectedWorkout = {
        title: 'Morning Workout',
        exercises: [{
          name: 'Push-ups',
          category: 'strength',
          sets: 3,
          reps: 15
        }]
      };

      mockAnthropic.messages.create.mockResolvedValueOnce({
        content: [{
          type: 'text',
          text: JSON.stringify(expectedWorkout)
        }]
      });

      const result = await llmService.extractWorkoutData(mockTranscription);

      expect(mockAnthropic.messages.create).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        workout: expectedWorkout,
        provider: 'anthropic'
      });
    });

    it('should handle API quota errors', async () => {
      const quotaError = new Error('Insufficient quota');
      quotaError.status = 429;
      mockOpenAI.chat.completions.create.mockRejectedValueOnce(quotaError);

      const result = await llmService.extractWorkoutData(mockTranscription);

      expect(result.success).toBe(false);
      expect(result.retryable).toBe(true);
      expect(result.retryAfter).toBeDefined();
    });

    it('should normalize exercise data', async () => {
      const workoutWithVariations = {
        title: 'Workout',
        exercises: [
          {
            exercise_name: 'Bench Press',
            exercise_type: 'strength',
            sets: 3,
            repetitions: 10,
            weight_lbs: 150,
            duration_min: 5
          },
          {
            name: 'Running',
            category: 'cardio',
            duration: 1800,
            distance: 5,
            distance_unit: 'km'
          }
        ]
      };

      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify(workoutWithVariations)
          }
        }]
      });

      const result = await llmService.extractWorkoutData(mockTranscription);

      expect(result.workout.exercises[0]).toMatchObject({
        name: 'Bench Press',
        category: 'strength',
        sets: 3,
        reps: 10,
        weight: 150,
        duration_seconds: 300
      });
    });
  });

  describe('generateWorkoutSummary', () => {
    const mockWorkouts = [
      {
        title: 'Morning Workout',
        date_completed: '2025-01-10',
        exercises: [
          { name: 'Bench Press', sets: 3, reps: 10, weight: 150 },
          { name: 'Squats', sets: 4, reps: 12, weight: 200 }
        ]
      },
      {
        title: 'Evening Workout',
        date_completed: '2025-01-12',
        exercises: [
          { name: 'Deadlifts', sets: 3, reps: 8, weight: 250 }
        ]
      }
    ];

    it('should generate workout summary', async () => {
      const expectedSummary = {
        totalWorkouts: 2,
        totalExercises: 3,
        frequency: '2 workouts in 3 days',
        insights: ['You are making good progress', 'Keep up the consistency']
      };

      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify(expectedSummary)
          }
        }]
      });

      const result = await llmService.generateWorkoutSummary(mockWorkouts);

      expect(result.success).toBe(true);
      expect(result.summary).toEqual(expectedSummary);
    });

    it('should handle empty workout history', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify({
              totalWorkouts: 0,
              message: 'No workouts found'
            })
          }
        }]
      });

      const result = await llmService.generateWorkoutSummary([]);

      expect(result.success).toBe(true);
      expect(result.summary.totalWorkouts).toBe(0);
    });
  });

  describe('switchProvider', () => {
    it('should switch to OpenAI', () => {
      llmService.switchProvider('openai');
      expect(llmService.provider).toBe('openai');
    });

    it('should switch to Anthropic', () => {
      llmService.switchProvider('anthropic');
      expect(llmService.provider).toBe('anthropic');
    });

    it('should throw error for invalid provider', () => {
      expect(() => {
        llmService.switchProvider('invalid');
      }).toThrow('Invalid provider: invalid');
    });
  });

  describe('validateWorkoutData', () => {
    it('should validate correct workout data', () => {
      const validWorkout = {
        title: 'Test Workout',
        exercises: [{
          name: 'Bench Press',
          category: 'strength',
          sets: 3,
          reps: 10
        }]
      };

      const isValid = llmService.validateWorkoutData(validWorkout);
      expect(isValid).toBe(true);
    });

    it('should reject invalid workout data', () => {
      const invalidWorkout = {
        title: '',
        exercises: []
      };

      const isValid = llmService.validateWorkoutData(invalidWorkout);
      expect(isValid).toBe(false);
    });
  });
});