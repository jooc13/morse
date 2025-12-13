const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
require('dotenv').config();

const uploadRoutes = require('./routes/upload');
const workoutRoutes = require('./routes/workouts');
const { router: authRoutes } = require('./routes/auth');
const teamsRoutes = require('./routes/teams');
const analyticsRoutes = require('./routes/analytics');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(compression());
app.use(morgan('combined'));
app.use(cors());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000, // massive limit for dev/mvp
  skip: (req) => req.path === '/health' // Skip rate limiting for health checks
});
app.use(limiter);

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // massive limit for uploads
  message: 'Too many uploads, please try again later'
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/upload', uploadLimiter, uploadRoutes);
app.use('/api/workouts', workoutRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/f513a0a', analyticsRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.get('/', (req, res) => {
  res.json({ 
    message: 'Morse API Service',
    version: '1.0.0',
    endpoints: [
      'GET /health',
      'POST /api/upload',
      'GET /api/workouts/:userId',
      'GET /api/workouts/:userId/progress',
      'POST /api/auth/register',
      'POST /api/auth/login',
      'GET /api/auth/profile',
      'GET /api/auth/devices/search/:last4',
      'POST /api/auth/workouts/:workoutId/claim',
      'POST /api/teams/create',
      'POST /api/teams/join/:inviteCode',
      'GET /api/teams/my-teams',
      'GET /api/teams/:teamId',
      'GET /api/teams/:teamId/members',
      'GET /f513a0a'
    ]
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    requestId: req.id
  });
});

app.listen(PORT, () => {
  console.log(`Morse API server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});