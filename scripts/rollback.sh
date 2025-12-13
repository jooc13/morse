#!/bin/bash
# Automated rollback script
# Quickly reverts to previous deployment on failure

set -e

# Configuration
SERVICE_NAME="${1:-morse-api}"
ROLLBACK_REASON="${2:-Manual rollback requested}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_success() { echo -e "${GREEN}[OK]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
print_info() { echo -e "${BLUE}[INFO]${NC} $1"; }

echo "========================================="
echo "MORSE Rollback Procedure"
echo "========================================="
echo "Service: $SERVICE_NAME"
echo "Reason: $ROLLBACK_REASON"
echo "========================================="
echo ""

# Check if render CLI is available
if ! command -v render &> /dev/null; then
    print_error "Render CLI not found!"
    echo ""
    echo "Install the Render CLI:"
    echo "  npm install -g render-cli"
    echo ""
    echo "Or use manual rollback via Render dashboard:"
    echo "  1. Go to https://dashboard.render.com"
    echo "  2. Select service: $SERVICE_NAME"
    echo "  3. Click 'Manual Deploy'"
    echo "  4. Select previous deploy from dropdown"
    echo "  5. Click 'Deploy'"
    exit 1
fi

# Confirm rollback
echo ""
print_warning "This will rollback $SERVICE_NAME to the previous deployment"
read -p "Continue? (yes/no): " -r
echo ""

if [[ ! $REPLY =~ ^[Yy]es$ ]]; then
    print_info "Rollback cancelled"
    exit 0
fi

# Get current deployment info
print_info "Getting current deployment info..."
echo ""

# List recent deploys
print_info "Recent deployments:"
render deploys list -s "$SERVICE_NAME" --limit 5 || true
echo ""

# Get previous deploy ID
print_info "Identifying previous deployment..."
PREVIOUS_DEPLOY=$(render deploys list -s "$SERVICE_NAME" --limit 2 --json 2>/dev/null | grep -o '"id":"[^"]*"' | cut -d'"' -f4 | tail -n1 || echo "")

if [ -z "$PREVIOUS_DEPLOY" ]; then
    print_error "Could not identify previous deployment"
    echo ""
    echo "Manual steps:"
    echo "  1. Visit https://dashboard.render.com/service/$SERVICE_NAME"
    echo "  2. Go to 'Deploys' tab"
    echo "  3. Find a successful previous deploy"
    echo "  4. Click 'Redeploy' for that version"
    exit 1
fi

print_success "Previous deploy ID: $PREVIOUS_DEPLOY"
echo ""

# Create rollback marker
ROLLBACK_LOG="rollback-$(date +%Y%m%d-%H%M%S).log"
cat > "$ROLLBACK_LOG" <<EOF
========================================
MORSE Rollback Log
========================================
Date: $(date)
Service: $SERVICE_NAME
Reason: $ROLLBACK_REASON
Previous Deploy ID: $PREVIOUS_DEPLOY
Initiated by: $(whoami)
========================================

EOF

print_info "Starting rollback..."
echo ""

# Trigger rollback
if render deploy -s "$SERVICE_NAME" --commit "$PREVIOUS_DEPLOY" 2>&1 | tee -a "$ROLLBACK_LOG"; then
    print_success "Rollback initiated successfully"
else
    print_error "Rollback command failed"
    echo "See $ROLLBACK_LOG for details"
    exit 1
fi

echo ""
print_info "Waiting for rollback to complete (30s)..."
sleep 30

# Verify rollback
print_info "Verifying rollback..."
echo ""

# Get service URL
SERVICE_URL=$(render services list --json 2>/dev/null | grep -A10 "\"name\":\"$SERVICE_NAME\"" | grep -o '"url":"[^"]*"' | cut -d'"' -f4 || echo "")

if [ -n "$SERVICE_URL" ]; then
    # Check health endpoint
    for i in {1..5}; do
        print_info "Health check attempt $i/5..."
        response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$SERVICE_URL/health" 2>/dev/null || echo "000")

        if [ "$response" = "200" ]; then
            print_success "Service is healthy after rollback (HTTP $response)"
            echo ""

            # Log success
            cat >> "$ROLLBACK_LOG" <<EOF

Rollback Verification:
- Health Check: PASSED (HTTP $response)
- Timestamp: $(date)
- Status: SUCCESS

EOF

            print_success "Rollback completed successfully!"
            print_info "Rollback log saved to: $ROLLBACK_LOG"
            echo ""

            echo "Next steps:"
            echo "  1. Monitor service for 10-15 minutes"
            echo "  2. Check error logs: render logs -s $SERVICE_NAME"
            echo "  3. Investigate root cause of failure"
            echo "  4. Fix issue before next deployment"
            echo ""

            exit 0
        fi

        sleep 5
    done

    print_error "Health check failed after rollback"
    echo ""

    # Log failure
    cat >> "$ROLLBACK_LOG" <<EOF

Rollback Verification:
- Health Check: FAILED
- Timestamp: $(date)
- Status: INCOMPLETE

Manual intervention required.
EOF

    echo "Manual verification required:"
    echo "  1. Check Render dashboard: https://dashboard.render.com/service/$SERVICE_NAME"
    echo "  2. View logs: render logs -s $SERVICE_NAME"
    echo "  3. Verify service status"
else
    print_warning "Could not determine service URL for verification"
fi

echo ""
print_info "Rollback log saved to: $ROLLBACK_LOG"
echo ""

exit 1
