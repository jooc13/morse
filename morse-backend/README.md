# Morse Workout Tracker

I built this to track workouts by just talking to my phone. Record yourself saying "did 3 sets of 10 push-ups, then 4 sets of 8 pull-ups" and it automatically extracts all the exercise data.

## How it works

- **Frontend**: React app with clean table view of all your workouts
- **API**: Node.js handles file uploads and serves data
- **Worker**: Python processes audio with Whisper transcription + Claude LLM
- **Database**: PostgreSQL stores everything
- **Queue**: Redis manages the background processing

## Running Locally

You need Docker Desktop with Kubernetes, Helm, and an Anthropic API key.

```bash
cd morse-backend

# Setup environment variables
cp .env .env.local
# Edit .env.local with your API key and docker registry name
source .env.local

# Build the images
docker build -t $DOCKER_REGISTRY/morse-api:$IMAGE_TAG services/api/
docker build -t $DOCKER_REGISTRY/morse-worker:$IMAGE_TAG services/worker/  
docker build -t $DOCKER_REGISTRY/morse-frontend:$IMAGE_TAG services/frontend/

# Setup helm dependencies
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update
helm dependency update helm/

# Deploy everything
helm upgrade --install morse helm/ \
  --set secrets.anthropicApiKey="$ANTHROPIC_API_KEY" \
  --set image.repository="$DOCKER_REGISTRY" \
  --set image.tag="$IMAGE_TAG"

# Open the app
open http://localhost:3001
```

### Useful commands

```bash
# Check if everything is running
kubectl get pods

# Watch the logs
kubectl logs -l app.kubernetes.io/component=api -f
kubectl logs -l app.kubernetes.io/component=worker -f

# Update the deployment
helm upgrade morse helm/ --set secrets.anthropicApiKey="$ANTHROPIC_API_KEY"

# Blow it all away
helm uninstall morse
```

## Deploying to AWS EC2

I run this on a t3.small instance (2GB RAM). Launch Ubuntu 22.04, open ports 22, 80, 443, and 30000-32767.

```bash
# SSH in and install K3s
ssh -i your-key.pem ubuntu@YOUR-EC2-IP

curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--disable traefik --tls-san YOUR-EC2-PUBLIC-IP" sh -

# Setup kubectl
mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown ubuntu:ubuntu ~/.kube/config

# Install helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

kubectl get nodes  # should show your node
```

### Deploy the app

Build AMD64 images on your local machine and push to Docker Hub:

```bash
# Use your environment variables
source .env.local

docker build --platform linux/amd64 -t $DOCKER_REGISTRY/morse-api:amd64 services/api/
docker build --platform linux/amd64 -t $DOCKER_REGISTRY/morse-worker:amd64 services/worker/
docker build --platform linux/amd64 -t $DOCKER_REGISTRY/morse-frontend:amd64 services/frontend/

docker push $DOCKER_REGISTRY/morse-api:amd64
docker push $DOCKER_REGISTRY/morse-worker:amd64  
docker push $DOCKER_REGISTRY/morse-frontend:amd64
```

Then on EC2:

```bash
# Setup helm dependencies
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update
helm dependency update helm/

# Deploy with NodePort for EC2 (use your own port numbers)
helm upgrade --install morse ./helm \
  --set secrets.anthropicApiKey="your_api_key_here" \
  --set image.repository="your_docker_registry" \
  --set image.tag="amd64" \
  --set api.service.type=NodePort \
  --set frontend.service.type=NodePort

# Check what ports were assigned
kubectl get services

# Access at whatever ports Kubernetes assigned:
# Frontend: http://YOUR-EC2-IP:PORT
# API: http://YOUR-EC2-IP:PORT
```

## How to use it

1. Upload an MP3 of yourself describing your workout
2. The system transcribes it and extracts exercise data 
3. View everything in a clean table showing sets, reps, weight
4. Navigate by day/week/month to see progress

## Common stuff

Check if everything is running:
```bash
kubectl get pods
kubectl logs -l app.kubernetes.io/name=morse
```

Check queue processing:
```bash
curl http://YOUR-EC2-IP:PORT/api/upload/queue/stats  # EC2 (use your actual port)
curl http://localhost:3000/api/upload/queue/stats    # Local
```

Update frontend after code changes:
```bash
source .env.local
docker build --platform linux/amd64 -t $DOCKER_REGISTRY/morse-frontend:amd64 services/frontend/
docker push $DOCKER_REGISTRY/morse-frontend:amd64
kubectl delete pod -l app.kubernetes.io/component=frontend
```

Reset everything:
```bash
kubectl delete pvc data-morse-postgresql-0
helm upgrade morse helm/ --set secrets.anthropicApiKey="$ANTHROPIC_API_KEY"
```

Edit `helm/values.yaml` to change resource limits, database settings, etc.