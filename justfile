# MORSE Deployment Automation
# Simple commands for development, testing, and deployment
# Install just: brew install just (macOS) or cargo install just

# Default recipe - show available commands
default:
    @just --list

# Development commands
# ====================

# Start local development environment
dev:
    @echo "Starting MORSE development environment..."
    @docker-compose up -d postgres redis
    @echo "Waiting for services to start..."
    @sleep 3
    @cd morse-backend/services/api && npm install && npm run dev &
    @cd morse-backend/services/frontend && npm install && npm start &
    @echo "✓ Development environment running"
    @echo "  - API: http://localhost:3000"
    @echo "  - Frontend: http://localhost:3001"
    @echo "  - Press Ctrl+C to stop"

# Stop local development environment
dev-stop:
    @echo "Stopping development environment..."
    @docker-compose down
    @pkill -f "node.*morse-backend" || true
    @echo "✓ Development environment stopped"

# Install all dependencies
install:
    @echo "Installing dependencies..."
    @cd morse-backend/services/api && npm install
    @cd morse-backend/services/frontend && npm install
    @echo "✓ Dependencies installed"

# Run database migrations locally
migrate:
    @echo "Running database migrations..."
    @chmod +x init-db.sh
    @./init-db.sh
    @echo "✓ Migrations complete"

# Testing commands
# ================

# Run all validation and tests (completes in <3 minutes)
test: validate test-api test-frontend smoke

# Validate deployment configuration
validate:
    @echo "Running deployment validation..."
    @chmod +x scripts/validate-deployment.sh
    @scripts/validate-deployment.sh

# Validate database migrations
validate-migrations:
    @echo "Validating database migrations..."
    @chmod +x scripts/validate-migrations.sh
    @scripts/validate-migrations.sh

# Run API tests
test-api:
    @echo "Running API tests..."
    @cd morse-backend/services/api && npm test

# Run frontend tests
test-frontend:
    @echo "Running frontend tests..."
    @cd morse-backend/services/frontend && npm test

# Run smoke tests (end-to-end critical paths)
smoke:
    @echo "Running smoke tests..."
    @chmod +x scripts/smoke-test.sh
    @scripts/smoke-test.sh

# Run health checks
health:
    @echo "Running health checks..."
    @chmod +x scripts/health-check.sh
    @scripts/health-check.sh

# Deployment commands
# ===================

# Deploy to production (validates first)
deploy: validate
    @echo "Deploying to Render..."
    @echo "This will trigger auto-deploy from GitHub"
    @git status
    @read -p "Commit and push to main? (y/N) " -n 1 -r; \
    if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
        git add .; \
        git commit -m "Deploy: $(date '+%Y-%m-%d %H:%M:%S')"; \
        git push origin main; \
        echo "✓ Changes pushed to main - deployment triggered"; \
        just monitor; \
    else \
        echo "Deployment cancelled"; \
    fi

# Deploy with custom commit message
deploy-msg MESSAGE: validate
    @echo "Deploying with message: {{MESSAGE}}"
    @git add .
    @git commit -m "{{MESSAGE}}"
    @git push origin main
    @echo "✓ Changes pushed - deployment triggered"
    @just monitor

# Monitor deployment in real-time
monitor:
    @echo "Monitoring deployment..."
    @chmod +x scripts/monitor-deployment.sh
    @scripts/monitor-deployment.sh

# Rollback to previous deployment
rollback SERVICE="morse-api":
    @echo "Rolling back {{SERVICE}}..."
    @chmod +x scripts/rollback.sh
    @scripts/rollback.sh {{SERVICE}}

# Docker commands
# ===============

# Build Docker images locally
build:
    @echo "Building Docker images..."
    @docker build -t morse-api:local morse-backend/services/api
    @docker build -t morse-frontend:local morse-backend/services/frontend
    @echo "✓ Images built"

# Build and test Docker images
build-test: build
    @echo "Testing Docker images..."
    @docker run --rm morse-api:local node -v
    @docker run --rm morse-frontend:local node -v
    @echo "✓ Images tested"

# Utility commands
# ================

# Clean up temporary files and caches
clean:
    @echo "Cleaning up..."
    @find . -name "node_modules" -type d -prune -exec rm -rf {} +
    @find . -name ".next" -type d -prune -exec rm -rf {} +
    @find . -name "build" -type d -prune -exec rm -rf {} +
    @rm -rf .migration-checksums
    @rm -f rollback-*.log
    @echo "✓ Cleanup complete"

# Show deployment status
status:
    @echo "Checking deployment status..."
    @if command -v render &> /dev/null; then \
        render services list; \
        render deploys list -s morse-api --limit 5; \
    else \
        echo "Render CLI not installed"; \
        echo "Visit: https://dashboard.render.com"; \
    fi

# View logs from production
logs SERVICE="morse-api":
    @if command -v render &> /dev/null; then \
        render logs -s {{SERVICE}}; \
    else \
        echo "Render CLI not installed"; \
        echo "Install: npm install -g render-cli"; \
    fi

# Setup commands
# ==============

# Initial setup for new developers
setup:
    @echo "Setting up MORSE development environment..."
    @just install
    @cp .env.example .env || echo "No .env.example found"
    @echo ""
    @echo "✓ Setup complete!"
    @echo ""
    @echo "Next steps:"
    @echo "  1. Edit .env with your configuration"
    @echo "  2. Run 'just dev' to start development"
    @echo "  3. Visit http://localhost:3001"

# Check prerequisites
check:
    @echo "Checking prerequisites..."
    @command -v node >/dev/null 2>&1 && echo "✓ Node.js installed" || echo "✗ Node.js not found"
    @command -v npm >/dev/null 2>&1 && echo "✓ npm installed" || echo "✗ npm not found"
    @command -v docker >/dev/null 2>&1 && echo "✓ Docker installed" || echo "✗ Docker not found"
    @command -v git >/dev/null 2>&1 && echo "✓ Git installed" || echo "✗ Git not found"
    @command -v psql >/dev/null 2>&1 && echo "✓ PostgreSQL client installed" || echo "✗ psql not found"
    @command -v just >/dev/null 2>&1 && echo "✓ just installed" || echo "✗ just not found"
    @echo ""
    @echo "Optional tools:"
    @command -v render >/dev/null 2>&1 && echo "✓ Render CLI installed" || echo "○ Render CLI not installed (optional)"

# Production commands
# ===================

# Full pre-deployment check
pre-deploy: validate validate-migrations test
    @echo ""
    @echo "✓ All pre-deployment checks passed!"
    @echo ""
    @echo "Ready to deploy. Run 'just deploy' to proceed."

# Emergency rollback with monitoring
emergency-rollback SERVICE="morse-api":
    @echo "EMERGENCY ROLLBACK - {{SERVICE}}"
    @just rollback {{SERVICE}}
    @sleep 30
    @just health
    @just monitor

# Complete deployment with full validation and monitoring
deploy-full: pre-deploy
    @echo "Starting full deployment..."
    @just deploy
    @echo "Waiting for deployment to complete..."
    @sleep 120
    @just health
    @just smoke
    @echo "✓ Deployment complete and verified!"
