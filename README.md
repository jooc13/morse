# Morse Workout Tracker

An AI-powered fitness tracking application that converts voice recordings of workouts into structured data using Whisper transcription and Claude LLM processing.

## 🏗️ Architecture Overview

Morse consists of several microservices designed for scalability and separation of concerns:

- **API Service** (Node.js): Handles file uploads, serves workout data, and manages the job queue
- **Worker Service** (Python): Processes audio files with Whisper transcription and Claude LLM
- **Frontend** (React): Beautiful dashboard for viewing workout progress and uploading files
- **Database** (PostgreSQL): Stores user data, workouts, exercises, and progress tracking
- **Queue** (Redis): Manages background processing jobs

## 🚀 Quick Start (Kubernetes with Helm)

### Prerequisites

- Docker Desktop with Kubernetes enabled
- Helm 3.x installed
- An Anthropic API key (for Claude LLM processing)

### 1. Clone and Setup

```bash
git clone <your-repo-url>
cd morse-backend

# Set your Anthropic API key (required)
export ANTHROPIC_API_KEY="your_actual_api_key_here"
```

### 2. Build Docker Images

```bash
# Build all service images
docker build -t morse/api:latest services/api/
docker build -t morse/worker:latest services/worker/
docker build -t morse/frontend:latest services/frontend/
```

### 3. Deploy with Helm

```bash
# Add required Helm repositories
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# Install chart dependencies
helm dependency update helm/

# Deploy to Kubernetes
helm upgrade --install morse helm/ \
  --set secrets.anthropicApiKey="$ANTHROPIC_API_KEY"
```

### 4. Access the Application

```bash
# Frontend will be available at:
# http://localhost:3001 (via LoadBalancer service)

# API health check (requires port-forward):
kubectl port-forward service/morse-api 3000:3000 &
curl http://localhost:3000/health
```

## 📱 How to Use

1. **Access the Dashboard**: Open http://localhost:3001 in your browser
2. **Upload Workout Audio**: Click "Select MP3 File" and upload an MP3 recording
3. **Describe Your Workout**: Record yourself saying something like:
   ```
   "Today I did 3 sets of 10 push-ups, then 4 sets of 8 pull-ups at 7 effort level. 
   I also did 20 minutes of running and finished with 3 sets of 12 squats with 50 pounds."
   ```
4. **View Results**: The system will transcribe your audio and extract structured workout data
5. **Track Progress**: Use the dashboard to view your workout history and progress charts

## 🔧 Development

### Project Structure

```
morse-backend/
├── services/
│   ├── api/                    # Node.js API service
│   │   ├── src/
│   │   │   ├── app.js         # Express server
│   │   │   ├── routes/        # API endpoints
│   │   │   └── services/      # Business logic
│   │   └── Dockerfile
│   ├── worker/                 # Python worker service
│   │   ├── src/
│   │   │   ├── main.py        # Worker entry point
│   │   │   ├── transcriber.py # Whisper integration
│   │   │   ├── llm_processor.py # Claude integration
│   │   │   └── database.py    # Database operations
│   │   └── Dockerfile
│   └── frontend/               # React frontend
│       ├── src/
│       │   ├── components/    # React components
│       │   └── services/      # API client
│       └── Dockerfile
├── database/
│   └── migrations/            # SQL schema files
├── helm/                      # Kubernetes deployment
└── docker-compose.yml        # Legacy local development
```

### Running Individual Services (Local Development)

#### Frontend with npm dev
```bash
cd services/frontend
npm install
npm run dev  # Uses local API at localhost:3000
```

#### API Service
```bash
cd services/api
npm install
npm run dev
```

#### Worker Service
```bash
cd services/worker
pip install -r requirements.txt
python src/main.py
```

### Helm Operations

```bash
# View current deployment status
helm status morse

# Upgrade deployment with new settings
helm upgrade morse helm/ \
  --set secrets.anthropicApiKey="$ANTHROPIC_API_KEY" \
  --set frontend.replicaCount=2

# Uninstall deployment
helm uninstall morse

# View all Kubernetes resources
kubectl get all -l app.kubernetes.io/name=morse
```

## 📊 API Endpoints

### Upload Audio
```bash
POST /api/upload
Content-Type: multipart/form-data

# Upload file with device UUID in filename: {uuid}_{timestamp}.mp3
curl -X POST -F "audio=@test_device_1234567890.mp3" http://localhost:3000/api/upload
```

### Get Workouts
```bash
GET /api/workouts/{deviceUuid}?limit=20&offset=0&startDate=2024-01-01&endDate=2024-12-31
```

### Get Progress
```bash
GET /api/workouts/{deviceUuid}/progress?days=30&exercise=push-ups
```

### Get User Stats
```bash
GET /api/workouts/{deviceUuid}/stats
```

## 🐳 Production Deployment

### Docker Registry

Build and push images to your registry:

```bash
# Build images
docker build -t your-registry/morse-api:latest services/api/
docker build -t your-registry/morse-worker:latest services/worker/
docker build -t your-registry/morse-frontend:latest services/frontend/

# Push images
docker push your-registry/morse-api:latest
docker push your-registry/morse-worker:latest
docker push your-registry/morse-frontend:latest
```

### Kubernetes with Helm

```bash
# Deploy to production
helm upgrade --install morse helm/ \
  --set secrets.anthropicApiKey="your_api_key_here" \
  --set image.registry="your-registry/" \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host="morse.yourdomain.com"
```

### Environment Variables

Required for production:

```bash
# API Service
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/morse_db
REDIS_HOST=redis-host
ANTHROPIC_API_KEY=your_key_here

# Worker Service
DATABASE_URL=postgresql://user:pass@host:5432/morse_db
REDIS_HOST=redis-host
ANTHROPIC_API_KEY=your_key_here
WHISPER_MODEL=base  # or small, medium, large

# Frontend
REACT_APP_API_URL=https://api.yourdomain.com/api
```

## 🔍 Monitoring & Troubleshooting

### Health Checks

- API: `GET /health`
- Queue Stats: `GET /api/upload/queue/stats`
- Job Status: `GET /api/upload/status/{jobId}`

### Kubernetes Logs

```bash
# View all morse pods
kubectl get pods -l app.kubernetes.io/name=morse

# View specific service logs
kubectl logs -l app.kubernetes.io/component=api -f
kubectl logs -l app.kubernetes.io/component=worker -f
kubectl logs -l app.kubernetes.io/component=frontend -f

# Check deployment status
kubectl describe deployment morse-api
kubectl describe deployment morse-worker
kubectl describe deployment morse-frontend
```

### Common Issues

#### 1. Worker Not Processing Files
- Check Redis connection: `kubectl logs -l app.kubernetes.io/component=worker`
- Verify Anthropic API key is set in secrets
- Check queue stats: `curl http://localhost:3000/api/upload/queue/stats`

#### 2. Database Connection Issues
- Verify PostgreSQL pod is running: `kubectl get pods -l app.kubernetes.io/name=postgresql`
- Check database logs: `kubectl logs -l app.kubernetes.io/name=postgresql`

#### 3. Frontend Not Accessible
- Check LoadBalancer service: `kubectl get service morse-frontend`
- Verify port 3001 is accessible: `curl http://localhost:3001`

### Performance Tuning

#### Worker Service
- Increase `worker.replicaCount` in Helm values
- Use larger Whisper model for better accuracy (base → small → medium)
- Increase worker resources for faster processing

#### API Service
- Increase `api.replicaCount` in Helm values
- Increase connection pool sizes
- Add caching layer (Redis)

## 🧪 Testing

### Manual Testing

1. **Upload Test File**:
```bash
# Port forward to API service
kubectl port-forward service/morse-api 3000:3000 &

# Create a test MP3 file and upload
curl -X POST -F "audio=@test_device-123_1703123456.mp3" http://localhost:3000/api/upload
```

2. **Check Processing**:
```bash
# Monitor queue
curl http://localhost:3000/api/upload/queue/stats

# Check user stats
curl http://localhost:3000/api/workouts/device-123/stats
```

### Sample Audio Script

Record yourself saying:
> "I just finished my workout. I did 3 sets of 10 push-ups with about 7 effort level. Then I did 4 sets of 8 pull-ups, really challenging at 9 effort. Finished with 15 minutes of running and 3 sets of 12 squats using 45 pounds."

Expected extraction:
```json
{
  "exercises": [
    {
      "exercise_name": "Push-ups",
      "sets": 3,
      "reps": [10, 10, 10],
      "effort_level": 7
    },
    {
      "exercise_name": "Pull-ups", 
      "sets": 4,
      "reps": [8, 8, 8, 8],
      "effort_level": 9
    },
    {
      "exercise_name": "Running",
      "duration_minutes": 15
    },
    {
      "exercise_name": "Squats",
      "sets": 3,
      "reps": [12, 12, 12],
      "weight_lbs": [45, 45, 45]
    }
  ]
}
```

## 🔐 Security Considerations

- API keys are stored in Kubernetes secrets
- File uploads are validated for type and size
- Database connections use connection pooling
- All services run as non-root users
- CORS is configured for frontend domain

## 🚀 Future Enhancements

- [ ] Real-time workout streaming from wearable devices
- [ ] Exercise form analysis using computer vision
- [ ] Social features and workout sharing
- [ ] Nutrition tracking integration
- [ ] Personal trainer AI recommendations
- [ ] Mobile app development
- [ ] Multi-user support with proper authentication

## 📞 Support

For issues and feature requests:
1. Check the logs using the commands above
2. Review common issues in this README
3. Create an issue with detailed logs and steps to reproduce

## 📄 License

This project is licensed under the MIT License.