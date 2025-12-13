#!/bin/bash

# Production Deployment Script for Morse Backend
# Uses cpenny49 Docker registry with Bitnami PostgreSQL and Redis

set -e

echo "🚀 Starting Morse Backend Production Deployment..."

# Load environment variables
if [ -f .env.production ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
    echo "✅ Loaded .env.production"
else
    echo "❌ .env.production file not found!"
    exit 1
fi

# Pull latest images from cpenny49 registry
echo "📦 Pulling Docker images from cpenny49 registry..."
docker pull cpenny49/morse-api:amd64
docker pull cpenny49/morse-worker:amd64
docker pull cpenny49/morse-frontend:amd64

# Pull Bitnami images
echo "📦 Pulling Bitnami images..."
docker pull bitnami/postgresql:latest
docker pull bitnami/redis:latest

echo "✅ All images pulled successfully"

# Stop existing containers if running
echo "🛑 Stopping existing containers..."
docker-compose -f docker-compose.production.yml down --remove-orphans || true

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p database/migrations
mkdir -p logs

# Start services with health checks
echo "🏃 Starting services..."
docker-compose -f docker-compose.production.yml up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
timeout 300 bash -c '
while true; do
    if docker-compose -f docker-compose.production.yml ps | grep -E "(healthy|Up)" | wc -l | grep -q "5"; then
        echo "✅ All services are healthy!"
        break
    fi
    echo "⏳ Waiting for services to be ready..."
    sleep 5
done
'

# Display service status
echo "📊 Service Status:"
docker-compose -f docker-compose.production.yml ps

# Display access information
echo ""
echo "🎉 Deployment Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Frontend:    http://localhost"
echo "API:         http://localhost:3000"
echo "Health:      http://localhost:3000/health"
echo "PostgreSQL:  localhost:5432 (morse_user/morse_password)"
echo "Redis:       localhost:6379"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Next Steps:"
echo "1. Update .env.production with your actual API keys"
echo "2. Run database migrations if needed"
echo "3. Test the application at http://localhost"
echo ""
echo "🔧 Useful Commands:"
echo "  View logs: docker-compose -f docker-compose.production.yml logs -f"
echo "  Stop:      docker-compose -f docker-compose.production.yml down"
echo "  Restart:   ./deploy-production.sh"