#!/bin/bash

# Morse K3s Deployment Script for EC2

set -e

EC2_IP=""  # Fill this in after EC2 launch
DOMAIN=""  # Fill this in with your domain

echo "🚀 Deploying Morse to K3s on EC2..."

if [ -z "$EC2_IP" ] || [ -z "$DOMAIN" ]; then
    echo "❌ Please set EC2_IP and DOMAIN variables at the top of this script"
    exit 1
fi

# Step 1: Copy kubeconfig from EC2
echo "📋 Getting kubeconfig from EC2..."
scp -i ~/.ssh/your-key.pem ubuntu@$EC2_IP:/etc/rancher/k3s/k3s.yaml ./k3s-kubeconfig.yaml

# Update server IP in kubeconfig
sed -i.bak "s/127.0.0.1/$EC2_IP/g" k3s-kubeconfig.yaml

# Set kubeconfig
export KUBECONFIG=./k3s-kubeconfig.yaml

echo "✅ Connected to K3s cluster"

# Step 2: Install cert-manager for SSL
echo "🔒 Installing cert-manager..."
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.12.0/cert-manager.yaml

# Wait for cert-manager
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=cert-manager -n cert-manager --timeout=300s

# Step 3: Create ClusterIssuer for Let's Encrypt
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@example.com  # Change this
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF

# Step 4: Install nginx ingress
echo "🌐 Installing nginx ingress..."
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.1/deploy/static/provider/cloud/deploy.yaml

# Wait for nginx ingress
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=300s

# Step 5: Create values file for public deployment
cat > values-k3s.yaml <<EOF
# K3s deployment values
api:
  image:
    tag: "session-grouping"
  service:
    type: ClusterIP  # Use ClusterIP since we have ingress

worker:
  image:
    tag: "session-grouping"

frontend:
  image:
    tag: "fixed-tofixed"
  service:
    type: ClusterIP  # Use ClusterIP since we have ingress

# Use smaller resources for t3.small
api:
  resources:
    limits:
      cpu: 300m
      memory: 256Mi
    requests:
      cpu: 100m
      memory: 128Mi

worker:
  resources:
    limits:
      cpu: 800m
      memory: 1Gi
    requests:
      cpu: 200m
      memory: 512Mi

frontend:
  resources:
    limits:
      cpu: 100m
      memory: 128Mi
    requests:
      cpu: 50m
      memory: 64Mi

postgresql:
  primary:
    resources:
      limits:
        cpu: 400m
        memory: 512Mi
      requests:
        cpu: 100m
        memory: 256Mi
    persistence:
      size: 10Gi

redis:
  master:
    resources:
      limits:
        cpu: 100m
        memory: 128Mi
      requests:
        cpu: 50m
        memory: 64Mi
    persistence:
      size: 2Gi

# Public ingress
ingress:
  enabled: true
  className: "nginx"
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
  hosts:
    - host: $DOMAIN
      paths:
        - path: /
          pathType: Prefix
          service: frontend
        - path: /api
          pathType: Prefix
          service: api
  tls:
    - secretName: morse-tls
      hosts:
        - $DOMAIN
EOF

# Step 6: Deploy Morse
echo "🎯 Deploying Morse application..."
helm upgrade --install morse ./helm --values values-k3s.yaml --wait --timeout=10m

# Step 7: Get status
echo "📊 Deployment status:"
kubectl get pods -l app.kubernetes.io/name=morse
kubectl get ingress

echo ""
echo "🎉 Deployment completed!"
echo ""
echo "📡 Your Morse app will be available at: https://$DOMAIN"
echo "🔐 SSL certificate will be issued automatically by Let's Encrypt"
echo ""
echo "🔧 To check status:"
echo "  kubectl get pods"
echo "  kubectl get ingress"
echo "  kubectl logs -f deployment/morse-worker"
echo ""
echo "⏰ Note: SSL cert may take 5-10 minutes to issue"
EOF