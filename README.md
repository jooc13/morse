# MORSE - Workout Tracker

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![React Version](https://img.shields.io/badge/react-%3E%3D18.0.0-blue)](https://reactjs.org/)

**MORSE** is an innovative voice-powered workout tracker that uses AI-powered audio transcription to automatically log your gym sessions. Simply record your workout sessions and let MORSE do the rest - transforming spoken workout data into structured, trackable fitness information.

## 🎯 Problem Statement

Tracking workouts manually is tedious and prone to human error. MORSE solves this by:

- **Voice-to-Text Conversion**: Automatically transcribes your spoken workout sessions from audio recordings
- **AI-Powered Data Extraction**: Uses Google Gemini AI to parse workout data (exercises, sets, reps, weights) from transcriptions
- **Seamless Integration**: Works with existing workout equipment that supports audio recording
- **Device-Based Authentication**: Simple UUID-based authentication for quick setup
- **Team Collaboration**: Share and collaborate with workout buddies and fitness groups

## ✨ Features Overview

### Core Features
1. **🎙️ Audio Upload & Transcription**
   - Support for multiple audio formats (MP3, WAV, M4A)
   - Batch processing for multi-file workouts
   - Real-time transcription with Google Gemini API
   - Intelligent file parsing from smart devices

2. **🤖 AI-Powered Workout Extraction**
   - Automatic exercise identification from spoken workout descriptions
   - Extraction of sets, reps, weights, duration, and effort levels
   - Muscle group categorization
   - Exercise type classification (strength, cardio, flexibility)

3. **📊 Comprehensive Analytics**
   - Workout progress tracking and trends
   - Performance charts and visualizations
   - Muscle group targeting analysis
   - Exercise frequency and volume tracking

4. **👥 Team & Social Features**
   - Team creation and management
   - Workout sharing capabilities
   - Collaborative goal setting
   - Member activity tracking

5. **📱 Modern Web Interface**
   - Responsive React-based dashboard
   - Interactive charts with Recharts
   - Workout calendar and history views
   - Progress visualization

### Advanced Features
- **Session Detection**: Automatically groups multiple audio recordings into single workout sessions
- **Workout Claiming**: Claim unclaimed workouts via voice verification
- **LLM Workout Summaries**: AI-generated personalized fitness insights and recommendations
- **Device Linking**: Link workout recordings to user profiles
- **A/B Testing Analytics**: Built-in analytics system for user experience testing

## 🏗️ Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Internet                            │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTPS/HTTP
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    Render Platform                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌───────────┐   │
│  │  Load Balancer │  │   CDN           │  │   Redis   │   │
│  │                 │  │                 │  │   Queue   │   │
│  └─────────────────┘  └─────────────────┘  └───────────┘   │
└─────────────────────┬───────────────────────────────────────┘
                      │ Internal Network
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                      Application Services                     │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │   Frontend     │  │     API         │                   │
│  │  Service       │  │   Service       │                   │
│  │                 │  │                 │                   │
│  │ • React 18      │  │ • Node.js/Express│                   │
│  │ • Express Proxy │  │ • JWT Auth      │                   │
│  │ • Material-UI  │  │ • File Uploads  │                   │
│  │ • Charts        │  │ • Rate Limiting │                   │
│  └─────────────────┘  └─────────────────┘                   │
│                                                             │
└─────────────────────┬───────────────────────────────────────┘
                      │ Database Connections
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                      Data Layer                              │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │   PostgreSQL    │  │     Redis       │                   │
│  │                 │  │                 │                   │
│  │ • Users/Devices │  │ • Job Queues    │                   │
│  │ • Workouts      │  │ • Session Cache │                   │
│  │ • Exercises     │  │ • Rate Limiting │                   │
│  │ • Teams         │  │                 │                   │
│  └─────────────────┘  └─────────────────┘                   │
│                                                             │
└─────────────────────┬───────────────────────────────────────┘
                      │ External APIs
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   External Services                          │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │  Google Gemini  │  │   cuicui.day    │                   │
│  │     API         │  │    Analytics    │                   │
│  │                 │  │                 │                   │
│  │ • Audio Transcription│     • A/B Testing│                   │
│  │ • LLM Analysis  │  │     Events      │                   │
│  │ • Workout Parsing│  │                 │                   │
│  └─────────────────┘  └─────────────────┘                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start Guide

### Prerequisites
- Node.js 18.0.0 or higher
- PostgreSQL database (local or remote)
- Redis server (for job queue)
- Google Gemini API key

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/morse.git
cd morse
```

### 2. Set Up Environment Variables

```bash
cp .env.example .env
```

Edit `.env` file with your configuration:

```bash
# Backend API Service
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://localhost:5432/morse_db
REDIS_HOST=localhost
REDIS_PORT=6379
GEMINI_API_KEY=your_gemini_api_key_here
JWT_SECRET=your_jwt_secret_here

# Frontend Service
REACT_APP_API_URL=http://localhost:3000
```

### 3. Set Up Database

```bash
# Create database
createdb morse_db

# Navigate to database directory
cd morse-backend/database

# Initialize database
./init_database.sh --with-test-data

# Verify setup
./verify_database.sh
```

### 4. Install Dependencies

```bash
# Backend API
cd morse-backend/services/api
npm install

# Frontend
cd ../services/frontend
npm install

# Worker (if running separately)
cd ../../services/worker
pip install -r requirements.txt
```

### 5. Start Development Servers

```bash
# Start API server (port 3000)
cd morse-backend/services/api
npm run dev

# Start frontend (port 3001)
cd ../services/frontend
npm start

# Upload test audio
curl -X POST -H "Content-Type: application/json" \
  -d '{"test": true}' \
  http://localhost:3000/api/upload \
  -F "audio=@test_workout.mp3"
```

### 6. Access the Application

- **Frontend Dashboard**: http://localhost:3001
- **API Health Check**: http://localhost:3000/health
- **API Documentation**: http://localhost:3000

## ⚙️ Environment Setup

### Backend Dependencies (Node.js)

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "multer": "^1.4.5-lts.1",
    "pg": "^8.11.0",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "compression": "^1.7.4",
    "dotenv": "^16.0.3",
    "uuid": "^9.0.0",
    "bull": "^4.10.4",
    "redis": "^4.6.7",
    "express-rate-limit": "^6.7.0",
    "morgan": "^1.10.0",
    "axios": "^1.4.0",
    "bcrypt": "^5.1.0",
    "jsonwebtoken": "^9.0.0"
  },
  "devDependencies": {
    "nodemon": "^2.0.22",
    "jest": "^29.5.0",
    "supertest": "^6.3.3"
  }
}
```

### Frontend Dependencies (React)

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.8.1",
    "axios": "^1.4.0",
    "recharts": "^2.6.2",
    "date-fns": "^2.30.0",
    "react-datepicker": "^4.11.0",
    "styled-components": "^5.3.10",
    "@mui/material": "^5.12.3",
    "@mui/icons-material": "^5.12.3"
  }
}
```

### Python Dependencies (Worker)

```txt
openai-whisper==20231117
torch==2.0.1
torchaudio==2.0.2
asyncpg==0.29.0
redis==4.5.5
python-dotenv==1.0.0
anthropic==0.64.0
requests==2.31.0
numpy==1.24.3
soundfile==0.12.1
python-dateutil==2.8.2
speechbrain==0.5.16
librosa==0.10.1
scikit-learn==1.3.0
```

## 🔌 API Documentation

### Authentication Endpoints

```bash
POST /api/auth/register       # Register new user
POST /api/auth/login          # User login
GET  /api/auth/profile       # Get user profile
GET  /api/auth/devices/search/:last4  # Search devices
POST /api/auth/workouts/:workoutId/claim  # Claim workout
```

### Workout Management

```bash
POST /api/upload              # Upload audio file
POST /api/upload/batch        # Batch upload multiple files
GET  /api/workouts/:deviceUuid    # Get user workouts
GET  /api/workouts/:deviceUuid/progress  # Get progress data
GET  /api/workouts/:deviceUuid/stats    # Get user statistics
GET  /api/workouts/:deviceUuid/llm-summary  # Get AI workout summary
```

### Charts & Analytics

```bash
GET  /api/workouts/:deviceUuid/charts/workout-trends
GET  /api/workouts/:deviceUuid/charts/muscle-groups
GET  /api/workouts/:deviceUuid/charts/performance
```

### Team Management

```bash
POST /api/teams/create             # Create team
POST /api/teams/join/:inviteCode   # Join team
GET  /api/teams/my-teams           # Get user teams
GET  /api/teams/:teamId            # Get team details
GET  /api/teams/:teamId/members    # Get team members
```

### Health & Status

```bash
GET  /health                       # Health check
GET  /                            # API information
GET  /f513a0a                     # A/B test analytics endpoint
```

## 🚀 Deployment Information

### Environment URLs

#### Staging Environment (Integration Branch)
- **Frontend**: https://morse-frontend.onrender.com
- **API**: https://morse-api.onrender.com
- **Database**: Render-managed PostgreSQL
- **Branch**: `integration-656-vibecode`
- **Auto-deploy**: Enabled on branch push

#### Production Environment
- **Frontend**: https://morse-prod-frontend.onrender.com
- **API**: https://morse-prod-api.onrender.com
- **Database**: Render-managed PostgreSQL
- **Branch**: `main`
- **Manual deployment**: Via Render dashboard

### Deployment Process

#### Automatic Deployment (Recommended)

1. **Push to Integration Branch**
   ```bash
   git checkout integration-656-vibecode
   git push origin integration-656-vibecode
   ```

2. **Monitor Deployment**
   - Check Render dashboard for deployment status
   - Services will auto-deploy in parallel
   - Database migrations run automatically

3. **Post-Deployment Setup**
   ```bash
   # Access service shell
   render shell -s morse-api

   # Navigate to database directory
   cd /app/morse-backend/database

   # Initialize database (first time only)
   ./init_database.sh
   ```

#### Manual Deployment

1. **Update Render Dashboard**
   - Go to Render dashboard
   - Select service (morse-api or morse-frontend)
   - Click "Manual Deploy" → "Production Branch"

2. **Database Initialization**
   ```bash
   render shell -s morse-api
   cd /app/morse-backend/database
   ./init_database.sh
   ```

### Environment Variables for Production

#### Required Variables
- `GEMINI_API_KEY`: Google Gemini API key (set manually in Render dashboard)
- `JWT_SECRET`: JWT signing secret (auto-generated if not set)
- `DATABASE_URL`: PostgreSQL connection string (auto-populated)
- `REDIS_HOST`/`REDIS_PORT`: Redis configuration (auto-populated)

#### Optional Variables
- `LOG_LEVEL`: Logging level (default: info)
- `DISABLE_LEGACY_UPLOAD`: Disable legacy upload endpoint (default: false)
- `TEST_DEVICE_UUID`: Test device UUID for development

## 👥 Team Member Contributions

### Core Team
- **jooc13** (Repository Owner & Lead Developer)
  - Backend architecture and API development
  - Database design and migrations
  - DevOps and deployment automation
  - Code quality and technical standards

- **C13** (Core Contributor)
  - Frontend development and UI/UX
  - React component architecture
  - Integration testing and debugging
  - Performance optimization

- **Morse Dev** (Frontend Specialist)
  - React/Material-UI development
  - User experience design
  - Responsive layout implementation
  - Interactive chart components

### Key Contributors
- **Voice AI Integration**: Google Gemini API integration and transcription pipeline
- **Database Architecture**: PostgreSQL schema design and optimization
- **Infrastructure**: Render deployment automation and CI/CD
- **UI/UX**: Modern dashboard design with Material-UI components

## 🛠️ Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL 14+
- **Cache/Queue**: Redis 6+
- **Authentication**: JWT with bcrypt
- **File Upload**: Multer with memory storage
- **Security**: Helmet, CORS, Rate Limiting
- **Logging**: Morgan with custom formatting
- **Testing**: Jest + Supertest

### Frontend
- **Framework**: React 18
- **UI Library**: Material-UI v5
- **Charts**: Recharts
- **Routing**: React Router v6
- **HTTP Client**: Axios
- **Styling**: Styled Components + Emotion
- **Date Handling**: date-fns
- **Forms**: React DatePicker
- **Testing**: React Testing Library

### AI Services
- **Transcription**: Google Gemini API
- **Language Model**: Gemini 2.0 Flash
- **Audio Processing**: Whisper-compatible pipeline
- **Data Extraction**: Custom LLM prompts

### Infrastructure
- **Platform**: Render PaaS
- **Database**: Managed PostgreSQL
- **Cache**: Managed Redis
- **SSL**: Automatic HTTPS with Let's Encrypt
- **Monitoring**: Built-in health checks and logging

### Development Tools
- **Containerization**: Docker (multi-stage builds)
- **Code Quality**: ESLint, Prettier
- **Git Hooks**: Pre-commit hooks
- **CI/CD**: GitHub Actions (via Render)
- **Database Management**: Custom migration scripts

## 🧪 How to Compute and Access the A/B Test Endpoint (/f513a0a)

### Overview
The `/f513a0a` endpoint is a dedicated A/B testing analytics dashboard designed to test user interface variations and gather engagement metrics.

### Access Method
```bash
# Direct access to the A/B test dashboard
curl -X GET https://morse-api.onrender.com/f513a0a

# View analytics statistics
curl -X GET https://morse-api.onrender.com/f513a0a/analytics/stats
```

### A/B Test Configuration
The endpoint uses a 50/50 split between two variants:
- **Variant A**: "kudos" button
- **Variant B**: "thanks" button

### Session-Based Assignment
```javascript
// Algorithm for variant assignment:
function getVariant(sessionId) {
  const hash = sessionId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const percentile = hash % 100;

  if (percentile < 50) {
    return 'kudos';  // 50% of users
  } else {
    return 'thanks'; // 50% of users
  }
}
```

### Analytics Tracking
The endpoint tracks:
- Page views with session ID
- Button clicks with variant information
- User engagement metrics (time on page, mouse movements, scroll depth)
- Browser and device information
- Real-time analytics sent to cuicui.day

### SHA1 Verification
The endpoint ID `f513a0a` is the SHA1 hash of "jooc13", ensuring the endpoint's authenticity and preventing unauthorized access.

### Data Export
Analytics data is automatically exported to:
- **Local storage**: In-memory event tracking
- **External service**: cuicui.day webhook integration
- **Real-time console**: Browser and server logging

## 🤝 Contributing Guidelines

### Development Workflow

1. **Fork the Repository**
   ```bash
   git clone https://github.com/your-username/morse.git
   cd morse
   ```

2. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Set Up Development Environment**
   ```bash
   cp .env.example .env
   # Configure environment variables
   npm install
   ```

4. **Code Standards**
   - Follow ESLint configuration
   - Use meaningful commit messages
   - Include tests for new features
   - Update documentation as needed

5. **Testing**
   ```bash
   # Run backend tests
   cd morse-backend/services/api
   npm test

   # Test API endpoints
   npm run test:api
   ```

6. **Submit Pull Request**
   - Include detailed description of changes
   - Link to related issues
   - Ensure all tests pass
   - Update README if needed

### Code Style Guide

#### JavaScript/TypeScript
- Use ES6+ syntax
- Prefer arrow functions
- Use descriptive variable names
- Implement proper error handling
- Include JSDoc comments for complex functions

#### React Components
- Use functional components with hooks
- Implement proper PropTypes/TypeScript interfaces
- Follow Material-UI component patterns
- Use styled-components for custom styling

#### Database Schema
- Use UUID primary keys
- Follow naming conventions (snake_case)
- Include proper indexes for performance
- Use foreign key constraints
- Document all table relationships

### Git Workflow

#### Branch Strategy
- `main`: Production-ready code
- `integration-656-vibecode`: Integration testing branch
- `feature/*`: Feature development branches
- `bugfix/*`: Bug fix branches
- `hotfix/*`: Emergency production fixes

#### Commit Guidelines
```bash
# Format: type(scope): description
# Examples:
feat(api): add new workout endpoint
fix(frontend): resolve chart rendering issue
docs(readme): update installation instructions
test(api): add unit tests for upload endpoint
```

### Pull Request Template

```markdown
## Description
Brief description of changes made.

## Changes Made
- [ ] Added new feature
- [ ] Fixed bug
- [ ] Updated documentation
- [ ] Added tests

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Breaking Changes
- [ ] Yes
- [ ] No

## Related Issues
Closes #[issue-number]
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

### License Summary
- **Commercial Use**: ✅ Permitted
- **Modification**: ✅ Permitted
- **Distribution**: ✅ Permitted
- **Private Use**: ✅ Permitted
- **Patent Use**: ❌ Not granted
- **Liability**: ❌ Not provided
- **Warranty**: ❌ Not provided

### License Terms
> The MIT License is a permissive free software license originating at the Massachusetts Institute of Technology (MIT). It puts only very limited restriction on reuse and has, therefore, an excellent license compatibility.

### Third-Party Licenses
- **Google Gemini API**: Subject to Google's terms of service
- **Material-UI**: MIT License
- **Redis**: BSD License
- **Node.js**: MIT License
- **React**: MIT License

## 🙏 Acknowledgments

### Technology Credits
- **Google Gemini**: AI-powered transcription and analysis
- **Material-UI**: React component library
- **Render**: PaaS deployment platform
- **PostgreSQL**: Open source relational database
- **Redis**: Open source in-memory data store

### Special Thanks
- Fitness community for feedback and inspiration
- Contributors who helped shape the project
- Users who provided real-world testing scenarios

---

**MORSE** - Transforming the way you track your fitness journey, one workout at a time. 💪

---

*For support, questions, or contributions, please open an issue or contact the team.*