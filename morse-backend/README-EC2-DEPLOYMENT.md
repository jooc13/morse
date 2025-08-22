# Morse EC2 K3s Deployment Guide

Complete guide for deploying Morse workout tracker on AWS EC2 with K3s.

## Prerequisites

- AWS Account with EC2 access
- Local machine with Docker and kubectl
- Domain name (optional, for public SSL access)

## Step 1: Launch EC2 Instance

### Instance Configuration
- **AMI**: Ubuntu Server 22.04 LTS (Free Tier eligible)
- **Instance Type**: `t3.small` (2 vCPU, 2GB RAM) - minimum for full stack
- **Storage**: 20GB gp3 SSD
- **Key Pair**: Create new or use existing `.pem` file

### Security Group Rules
Create security group with these inbound rules:
```
SSH (22)           - Your IP only
HTTP (80)          - 0.0.0.0/0
HTTPS (443)        - 0.0.0.0/0 
K3s API (6443)     - Your IP only
NodePort (30000-32767) - 0.0.0.0/0
```

### Optional: Elastic IP
Recommended to assign Elastic IP so instance IP doesn't change on restart.

## Step 2: Install K3s on EC2

SSH into your instance:
```bash
ssh -i your-key.pem ubuntu@YOUR-EC2-IP
```

Install K3s with public IP support:
```bash
# Install K3s with TLS SAN for your public IP
curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--disable traefik --tls-san YOUR-EC2-PUBLIC-IP" sh -

# Wait for startup
sleep 30

# Set up kubeconfig
mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown ubuntu:ubuntu ~/.kube/config

# Test installation
kubectl get nodes
```

Install Helm:
```bash
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

## Step 3: Build and Deploy Images

### Build AMD64 Images Locally
On your **local machine** (required for architecture compatibility):

```bash
# Build AMD64 images for EC2 deployment
docker build --platform linux/amd64 -t morse/api:amd64 -f services/api/Dockerfile services/api
docker build --platform linux/amd64 -t morse/worker:amd64 -f services/worker/Dockerfile services/worker  
docker build --platform linux/amd64 -t morse/frontend:amd64 -f services/frontend/Dockerfile services/frontend

# Export images
docker save morse/api:amd64 | gzip > morse-api-amd64.tar.gz
docker save morse/worker:amd64 | gzip > morse-worker-amd64.tar.gz
docker save morse/frontend:amd64 | gzip > morse-frontend-amd64.tar.gz

# Upload to EC2
scp -i your-key.pem morse-*-amd64.tar.gz ubuntu@YOUR-EC2-IP:~
scp -i your-key.pem -r helm ubuntu@YOUR-EC2-IP:~
```

### Load Images on EC2
SSH back into EC2:
```bash
# Import images into K3s
sudo k3s ctr images import morse-api-amd64.tar.gz
sudo k3s ctr images import morse-worker-amd64.tar.gz
sudo k3s ctr images import morse-frontend-amd64.tar.gz

# Verify images loaded
sudo k3s ctr images ls | grep morse

# Clean up image files
rm -f morse-*-amd64.tar.gz
```

## Step 4: Configure Deployment

Create optimized values file for t3.small:
```yaml
# values-ec2.yaml
api:
  image:
    repository: morse/api
    tag: "amd64"
  service:
    type: NodePort
    port: 3000
    nodePort: 30080
  resources:
    limits:
      cpu: 300m
      memory: 256Mi
    requests:
      cpu: 100m
      memory: 128Mi

worker:
  image:
    repository: morse/worker
    tag: "amd64"
  resources:
    limits:
      cpu: 500m
      memory: 512Mi
    requests:
      cpu: 200m
      memory: 256Mi

frontend:
  image:
    repository: morse/frontend
    tag: "amd64"
  service:
    type: NodePort
    port: 3001
    nodePort: 30081
  resources:
    limits:
      cpu: 100m
      memory: 128Mi
    requests:
      cpu: 50m
      memory: 64Mi

postgresql:
  enabled: true
  auth:
    postgresPassword: "morse_admin_pass"
    username: "morse_user" 
    password: "morse_pass"
    database: "morse_db"
  primary:
    persistence:
      enabled: true
      size: 5Gi
    resources:
      limits:
        cpu: 200m
        memory: 256Mi
      requests:
        cpu: 100m
        memory: 128Mi

redis:
  enabled: true
  auth:
    enabled: false
  master:
    persistence:
      enabled: true
      size: 1Gi
    resources:
      limits:
        cpu: 100m
        memory: 64Mi
      requests:
        cpu: 50m
        memory: 32Mi
  replica:
    replicaCount: 0  # Disable replicas on small instance

ingress:
  enabled: false  # Use NodePort for simplicity

secrets:
  anthropicApiKey: "your-anthropic-api-key"
```

## Step 5: Deploy Application

```bash
# Deploy Morse
helm upgrade --install morse ./helm --values values-ec2.yaml --wait --timeout=15m

# Check deployment
kubectl get pods
kubectl get services

# Get external access URLs
echo "API: http://YOUR-EC2-IP:30080"
echo "Frontend: http://YOUR-EC2-IP:30081"
```

## Step 6: Test Deployment

```bash
# Check pod logs
kubectl logs -f deployment/morse-api
kubectl logs -f deployment/morse-worker

# Test API health
curl http://YOUR-EC2-IP:30080/queue/stats

# Test frontend
curl http://YOUR-EC2-IP:30081
```

## Monitoring and Maintenance

### View Logs
```bash
kubectl logs -f deployment/morse-api
kubectl logs -f deployment/morse-worker
kubectl get pods --watch
```

### Update Application
```bash
# Build new images locally
docker build --platform linux/amd64 -t morse/api:v2 -f services/api/Dockerfile services/api

# Export and upload
docker save morse/api:v2 | gzip > morse-api-v2.tar.gz
scp -i your-key.pem morse-api-v2.tar.gz ubuntu@YOUR-EC2-IP:~

# Import and upgrade on EC2
sudo k3s ctr images import morse-api-v2.tar.gz
helm upgrade morse ./helm --values values-ec2.yaml --set api.image.tag=v2
```

### Resource Monitoring
```bash
# Check resource usage
kubectl top nodes
kubectl top pods

# Check storage
df -h
kubectl get pvc
```

## Troubleshooting

### Pod Crashes
```bash
# Check pod status
kubectl get pods
kubectl describe pod POD-NAME
kubectl logs POD-NAME --previous
```

### Architecture Issues
- Ensure images are built with `--platform linux/amd64`
- Verify with: `docker inspect morse/api:amd64 | grep Architecture`

### Memory Issues (t2.micro)
- Consider upgrading to t3.small (2GB RAM)
- Reduce resource limits in values file
- Disable Redis replicas

### Database Issues
```bash
# Check PostgreSQL pod
kubectl logs morse-postgresql-0
kubectl exec -it morse-postgresql-0 -- psql -U morse_user -d morse_db
```

## Cost Optimization

### Instance Types
- **t3.nano** (0.5GB): Too small, will crash
- **t3.micro** (1GB): Minimal deployment only
- **t3.small** (2GB): Recommended minimum - ~$15/month
- **t3.medium** (4GB): Comfortable - ~$30/month

### Storage
- Use gp3 SSD for better performance
- 20GB minimum for OS + app data
- Additional EBS volumes for large file storage

## Security Considerations

- Keep security groups restrictive (your IP only for SSH/K3s)
- Use Elastic IP to avoid IP changes
- Regular system updates: `sudo apt update && sudo apt upgrade`
- Consider AWS Systems Manager for secure access
- Rotate API keys regularly

## Domain Setup (Optional)

1. Point domain A record to EC2 Elastic IP
2. Install cert-manager for SSL:
```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.12.0/cert-manager.yaml
```
3. Configure ingress with SSL in values file
4. Access via https://yourdomain.com

## Backup Strategy

### Database Backup
```bash
kubectl exec morse-postgresql-0 -- pg_dump -U morse_user morse_db > backup.sql
```

### Full Cluster Backup
```bash
# Backup K3s state
sudo cp -r /var/lib/rancher/k3s/server/db /backup/
```

This completes a production-ready deployment of Morse on AWS EC2 with K3s!