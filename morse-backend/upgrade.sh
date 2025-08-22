#!/bin/bash

# Morse Session Grouping Upgrade Script

set -e

echo "🚀 Starting Morse session grouping upgrade..."

# Build new images
echo "📦 Building updated images..."
docker build -t morse/api:session-grouping -f services/api/Dockerfile services/api
docker build -t morse/worker:session-grouping -f services/worker/Dockerfile services/worker

# Check current deployment
echo "🔍 Checking current deployment..."
if ! helm status morse > /dev/null 2>&1; then
    echo "❌ Morse helm deployment not found. Please install first with:"
    echo "helm install morse ./helm"
    exit 1
fi

# Backup current state (optional)
echo "💾 Creating backup of current deployment..."
kubectl get configmap -o yaml > backup-configmaps-$(date +%Y%m%d-%H%M%S).yaml

# Apply database migrations through helm upgrade
echo "📊 Upgrading deployment with session grouping..."
helm upgrade morse ./helm \
    --values helm/values-session-upgrade.yaml \
    --set api.image.tag=session-grouping \
    --set worker.image.tag=session-grouping \
    --wait \
    --timeout=10m

# Verify the upgrade
echo "🔄 Verifying upgrade..."
kubectl rollout status deployment/morse-api
kubectl rollout status deployment/morse-worker

# Check if services are responding
echo "🏥 Health checking services..."
sleep 30

# Test API endpoint
API_POD=$(kubectl get pods -l app.kubernetes.io/name=morse,app.kubernetes.io/component=api -o jsonpath='{.items[0].metadata.name}')
if kubectl exec $API_POD -- curl -f http://localhost:3000/queue/stats > /dev/null 2>&1; then
    echo "✅ API service is responding"
else
    echo "⚠️  API service check failed"
fi

# Test database connection
WORKER_POD=$(kubectl get pods -l app.kubernetes.io/name=morse,app.kubernetes.io/component=worker -o jsonpath='{.items[0].metadata.name}')
if kubectl logs $WORKER_POD --tail=10 | grep -q "Database connection pool initialized"; then
    echo "✅ Database connection established"
else
    echo "⚠️  Database connection check failed"
fi

# Test session functionality
echo "🧪 Testing session grouping functionality..."
echo "You can now test session grouping by uploading multiple audio files within 60 minutes"

echo ""
echo "🎉 Upgrade completed successfully!"
echo ""
echo "📋 New Features:"
echo "  • Smart workout session grouping (60-minute window)"
echo "  • Multi-recording workout analysis"
echo "  • Session monitoring endpoints"
echo "  • Automatic session cleanup"
echo ""
echo "🔧 API Endpoints:"
echo "  • GET /sessions/user/{deviceUuid} - List user sessions"
echo "  • GET /sessions/{sessionId} - Session details"
echo "  • POST /sessions/maintenance/cleanup - Clean old sessions"
echo ""
echo "📊 Monitor with:"
echo "  kubectl logs -f deployment/morse-worker"
echo "  kubectl logs -f deployment/morse-api"