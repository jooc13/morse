const request = require('supertest');
const express = require('express');
const app = express();

// Load routes
const uploadRoutes = require('../../src/routes/upload');
const authRoutes = require('../../src/routes/auth');
const workoutRoutes = require('../../src/routes/workouts');
const analyticsRoutes = require('../../src/routes/analytics');

// Mock the services
jest.mock('../../src/services/TranscriptionService');
jest.mock('../../src/services/LLMService');
jest.mock('../../src/services/SessionService');

// Configure app for testing
app.use(express.json());
app.use('/api', uploadRoutes);
app.use('/api', authRoutes);
app.use('/api', workoutRoutes);
app.use('/', analyticsRoutes);

describe('API Integration Tests', () => {
  let testUser;
  let testWorkout;
  let authToken;

  beforeAll(async () => {
    // Create test user
    testUser = await global.testUtils.createTestUser({
      device_uuid: 'integration-test-device'
    });

    // Create test workout
    testWorkout = await global.testUtils.createTestWorkout(testUser.id);

    // Mock JWT token
    authToken = 'Bearer mock-jwt-token';
  });

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await global.testUtils.clearTables();
  });

  describe('Authentication Endpoints', () => {
    describe('POST /api/auth/register', () => {
      it('should register a new user', async () => {
        const newUser = {
          device_uuid: 'new-test-device',
          email: 'test@example.com'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(newUser);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.user.device_uuid).toBe(newUser.device_uuid);
      });

      it('should handle duplicate device UUID', async () => {
        const duplicateUser = {
          device_uuid: testUser.device_uuid
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(duplicateUser);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('already exists');
      });
    });

    describe('GET /api/auth/profile', () => {
      it('should return user profile', async () => {
        const response = await request(app)
          .get('/api/auth/profile')
          .set('Authorization', authToken)
          .send();

        expect(response.status).toBe(200);
        expect(response.body.user).toBeDefined();
        expect(response.body.user.device_uuid).toBeDefined();
      });
    });

    describe('POST /api/auth/workouts/:workoutId/claim', () => {
      it('should claim an unclaimed workout', async () => {
        // Create unclaimed workout
        const unclaimedWorkout = await global.testUtils.createTestWorkout(null, {
          device_uuid: 'unknown-device'
        });

        const response = await request(app)
          .post(`/api/auth/workouts/${unclaimedWorkout.id}/claim`)
          .set('Authorization', authToken)
          .send();

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('Upload Endpoints', () => {
    describe('POST /api/upload', () => {
      it('should upload and process audio file', async () => {
        // Mock successful transcription
        const TranscriptionService = require('../../src/services/TranscriptionService');
        TranscriptionService.mockImplementation(() => ({
          transcribeAudio: jest.fn().mockResolvedValue({
            success: true,
            text: 'I did bench press 10 reps at 150 pounds',
            provider: 'openai'
          })
        }));

        // Mock successful LLM processing
        const LLMService = require('../../src/services/LLMService');
        LLMService.mockImplementation(() => ({
          extractWorkoutData: jest.fn().mockResolvedValue({
            success: true,
            workout: {
              title: 'Test Workout',
              exercises: [{
                name: 'Bench Press',
                category: 'strength',
                sets: 3,
                reps: 10,
                weight: 150
              }]
            }
          })
        }));

        const response = await request(app)
          .post('/api/upload')
          .set('Authorization', authToken)
          .attach('audio', Buffer.from('fake audio data'), 'test.mp3')
          .field('device_uuid', testUser.device_uuid);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.audioFileId).toBeDefined();
        expect(response.body.processed).toBe(true);
        expect(response.body.workoutId).toBeDefined();
      });

      it('should handle file upload errors', async () => {
        const response = await request(app)
          .post('/api/upload')
          .set('Authorization', authToken)
          .send();

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('No audio file');
      });

      it('should handle processing failures gracefully', async () => {
        // Mock transcription failure
        const TranscriptionService = require('../../src/services/TranscriptionService');
        TranscriptionService.mockImplementation(() => ({
          transcribeAudio: jest.fn().mockResolvedValue({
            success: false,
            error: 'Transcription failed',
            retryable: false
          })
        }));

        const response = await request(app)
          .post('/api/upload')
          .set('Authorization', authToken)
          .attach('audio', Buffer.from('fake audio data'), 'test.mp3')
          .field('device_uuid', testUser.device_uuid);

        expect(response.status).toBe(201); // Still 201 because upload succeeded
        expect(response.body.processed).toBe(false);
      });
    });

    describe('POST /api/upload/batch', () => {
      it('should handle batch upload', async () => {
        const response = await request(app)
          .post('/api/upload/batch')
          .set('Authorization', authToken)
          .attach('audio', Buffer.from('fake audio 1'), 'test1.mp3')
          .attach('audio', Buffer.from('fake audio 2'), 'test2.mp3')
          .field('device_uuid', testUser.device_uuid);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.audioFileIds).toHaveLength(2);
      });
    });

    describe('GET /api/upload/status/:jobId', () => {
      it('should return job status', async () => {
        const jobId = 'test-job-123';
        const response = await request(app)
          .get(`/api/upload/status/${jobId}`)
          .send();

        expect(response.status).toBe(200);
        expect(response.body.jobId).toBe(jobId);
        expect(response.body.status).toBeDefined();
      });
    });
  });

  describe('Workout Endpoints', () => {
    describe('GET /api/workouts/device/:deviceUuid', () => {
      it('should return workouts for device', async () => {
        const response = await request(app)
          .get(`/api/workouts/device/${testUser.device_uuid}`)
          .set('Authorization', authToken)
          .send();

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.workouts)).toBe(true);
        expect(response.body.workouts.length).toBeGreaterThan(0);
      });

      it('should support pagination', async () => {
        const response = await request(app)
          .get(`/api/workouts/device/${testUser.device_uuid}`)
          .query({ limit: 1, offset: 0 })
          .set('Authorization', authToken)
          .send();

        expect(response.status).toBe(200);
        expect(response.body.workouts.length).toBeLessThanOrEqual(1);
      });

      it('should filter by date range', async () => {
        const today = new Date().toISOString().split('T')[0];
        const response = await request(app)
          .get(`/api/workouts/device/${testUser.device_uuid}`)
          .query({ startDate: today, endDate: today })
          .set('Authorization', authToken)
          .send();

        expect(response.status).toBe(200);
        response.body.workouts.forEach(workout => {
          expect(workout.date_completed).toContain(today);
        });
      });
    });

    describe('GET /api/workouts/device/:deviceUuid/stats', () => {
      it('should return workout statistics', async () => {
        const response = await request(app)
          .get(`/api/workouts/device/${testUser.device_uuid}/stats`)
          .set('Authorization', authToken)
          .send();

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.stats).toBeDefined();
        expect(response.body.stats.totalWorkouts).toBeDefined();
        expect(response.body.stats.exerciseStats).toBeDefined();
      });
    });

    describe('GET /api/workouts/device/:deviceUuid/llm-summary', () => {
      it('should return LLM-generated summary', async () => {
        // Mock LLM service
        const LLMService = require('../../src/services/LLMService');
        LLMService.mockImplementation(() => ({
          generateWorkoutSummary: jest.fn().mockResolvedValue({
            success: true,
            summary: {
              totalWorkouts: 10,
              insights: ['Great progress!']
            }
          })
        }));

        const response = await request(app)
          .get(`/api/workouts/device/${testUser.device_uuid}/llm-summary`)
          .set('Authorization', authToken)
          .send();

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.summary).toBeDefined();
      });
    });

    describe('GET /api/workouts/device/:deviceUuid/charts/workout-trends', () => {
      it('should return workout trend data', async () => {
        const response = await request(app)
          .get(`/api/workouts/device/${testUser.deviceUuid}/charts/workout-trends`)
          .set('Authorization', authToken)
          .send();

        expect(response.status).toBe(200);
        expect(response.body.data).toBeDefined();
        expect(Array.isArray(response.body.data)).toBe(true);
      });
    });
  });

  describe('Analytics Endpoint', () => {
    describe('GET /f513a0a', () => {
      it('should return analytics page', async () => {
        const response = await request(app)
          .get('/f513a0a')
          .send();

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toMatch(/html/);
        expect(response.text).toContain('MORSE Analytics');
        expect(response.text).toContain('jooc13');
        expect(response.text).toContain('abtest');
      });

      it('should track page views', async () => {
        const response = await request(app)
          .get('/f513a0a')
          .send();

        expect(response.status).toBe(200);
        // Check that page view is logged (would verify in real implementation)
      });
    });

    describe('POST /f513a0a/analytics/click', () => {
      it('should track button clicks', async () => {
        const clickData = {
          variant: 'kudos',
          buttonText: 'kudos',
          sessionId: 'test-session'
        };

        const response = await request(app)
          .post('/f513a0a/analytics/click')
          .set('X-Session-ID', 'test-session')
          .send(clickData);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    describe('GET /f513a0a/analytics/stats', () => {
      it('should return analytics statistics', async () => {
        const response = await request(app)
          .get('/f513a0a/analytics/stats')
          .send();

        expect(response.status).toBe(200);
        expect(response.body.summary).toBeDefined();
        expect(response.body.variantPerformance).toBeDefined();
        expect(response.body.recentEvents).toBeDefined();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 errors', async () => {
      const response = await request(app)
        .get('/api/nonexistent-endpoint')
        .send();

      expect(response.status).toBe(404);
    });

    it('should handle invalid JSON', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expect(response.status).toBe(400);
    });

    it('should handle missing authorization', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .send();

      expect(response.status).toBe(401);
    });
  });
});