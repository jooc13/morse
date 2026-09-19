const Queue = require('bull');
const Redis = require('redis');

class QueueService {
  constructor() {
    this.redisClient = null;
    this.transcriptionQueue = null;
    this.init();
  }

  async init() {
    try {
      const redisHost = process.env.REDIS_HOST || 'localhost';
      const redisPort = process.env.REDIS_PORT || 6379;
      
      console.log(`Connecting to Redis at ${redisHost}:${redisPort}`);
      
      this.redisClient = Redis.createClient({
        socket: {
          host: redisHost,
          port: parseInt(redisPort)
        },
        password: process.env.REDIS_PASSWORD || undefined,
        retryDelayOnFailover: 100
      });

      this.redisClient.on('error', (err) => {
        console.error('Redis Client Error:', err);
        this.handleRedisError(err);
      });

      this.redisClient.on('connect', () => {
        console.log('Connected to Redis successfully');
      });

      await this.redisClient.connect();

      this.transcriptionQueue = new Queue('audio transcription', {
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: process.env.REDIS_PORT || 6379,
          password: process.env.REDIS_PASSWORD || undefined
        }
      });

      console.log('Queue service initialized');
    } catch (error) {
      console.error('Failed to initialize queue service:', error);
      this.handleRedisError(error);
    }
  }

  handleRedisError(error) {
    console.log('Redis not available, using in-memory fallback');
    this.redisClient = null;
    this.transcriptionQueue = null;
  }

  async addTranscriptionJob(audioFileData) {
    try {
      if (!this.transcriptionQueue) {
        console.log('Queue not available, job will be processed later');
        return { jobId: null, queued: false };
      }

      const job = await this.transcriptionQueue.add('transcribe', audioFileData, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        removeOnComplete: 10,
        removeOnFail: 5
      });

      console.log(`Added transcription job ${job.id} for file ${audioFileData.audioFileId}`);
      
      return {
        jobId: job.id,
        queued: true
      };
    } catch (error) {
      console.error('Failed to add transcription job:', error);
      return { jobId: null, queued: false, error: error.message };
    }
  }

  async getJobStatus(jobId) {
    try {
      if (!this.transcriptionQueue) {
        return { status: 'unknown', progress: 0 };
      }

      const job = await this.transcriptionQueue.getJob(jobId);
      if (!job) {
        return { status: 'not_found', progress: 0 };
      }

      return {
        status: await job.getState(),
        progress: job.progress(),
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        failedReason: job.failedReason
      };
    } catch (error) {
      console.error('Failed to get job status:', error);
      return { status: 'error', progress: 0, error: error.message };
    }
  }

  async getQueueStats() {
    try {
      if (!this.transcriptionQueue) {
        return { waiting: 0, active: 0, completed: 0, failed: 0 };
      }

      const [waiting, active, completed, failed] = await Promise.all([
        this.transcriptionQueue.getWaiting(),
        this.transcriptionQueue.getActive(),
        this.transcriptionQueue.getCompleted(),
        this.transcriptionQueue.getFailed()
      ]);

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length
      };
    } catch (error) {
      console.error('Failed to get queue stats:', error);
      return { waiting: 0, active: 0, completed: 0, failed: 0, error: error.message };
    }
  }

  async close() {
    try {
      if (this.transcriptionQueue) {
        await this.transcriptionQueue.close();
      }
      if (this.redisClient) {
        await this.redisClient.quit();
      }
      console.log('Queue service closed');
    } catch (error) {
      console.error('Error closing queue service:', error);
    }
  }
}

module.exports = new QueueService();