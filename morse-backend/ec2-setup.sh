#!/bin/bash

# EC2 K3s Setup Script - Run this ON your EC2 instance
# SSH in first: ssh -i ~/Downloads/morse.pem ubuntu@3.19.222.77

echo "🚀 Setting up K3s on EC2..."

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker (needed for our images)
sudo apt install -y docker.io
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker ubuntu

# Install K3s with specific settings for t2.micro
echo "📦 Installing K3s..."
curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--disable traefik --node-taint node.kubernetes.io/memory.available:NoSchedule=false" sh -

# Wait for K3s to be ready
sudo systemctl enable k3s
sleep 30

# Set up kubeconfig for ubuntu user
sudo chmod 644 /etc/rancher/k3s/k3s.yaml
mkdir -p /home/ubuntu/.kube
sudo cp /etc/rancher/k3s/k3s.yaml /home/ubuntu/.kube/config
sudo chown ubuntu:ubuntu /home/ubuntu/.kube/config

# Install helm
echo "⚓ Installing Helm..."
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Check K3s status
echo "✅ Checking K3s status..."
sudo kubectl get nodes
sudo kubectl get pods -A

echo ""
echo "🎉 K3s installation complete!"
echo ""
echo "Next steps:"
echo "1. Copy this kubeconfig to your local machine"
echo "2. Deploy Morse application"
echo ""
echo "To copy kubeconfig, run from your LOCAL machine:"
echo "scp -i ~/Downloads/morse.pem ubuntu@3.19.222.77:/home/ubuntu/.kube/config ./k3s-kubeconfig.yaml"