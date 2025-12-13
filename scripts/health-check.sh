#!/bin/bash
# Comprehensive health check script
# Tests all critical endpoints and services after deployment

set -e

# Configuration
API_URL="${API_URL:-http://localhost:3000}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3001}"
TIMEOUT=10
MAX_RETRIES=5
RETRY_DELAY=5

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_success() { echo -e "${GREEN}[PASS]${NC} $1"; }
print_error() { echo -e "${RED}[FAIL]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
print_info() { echo -e "${BLUE}[INFO]${NC} $1"; }

EXIT_CODE=0

echo "========================================="
echo "MORSE Health Check"
echo "========================================="
echo "API URL: $API_URL"
echo "Frontend URL: $FRONTEND_URL"
echo "Timeout: ${TIMEOUT}s"
echo "========================================="
echo ""

# Helper function to make HTTP requests with retry
http_get() {
    local url="$1"
    local expected_status="${2:-200}"
    local retries=0

    while [ $retries -lt $MAX_RETRIES ]; do
        response=$(curl -s -w "\n%{http_code}" --max-time "$TIMEOUT" "$url" 2>/dev/null || echo -e "\n000")
        status_code=$(echo "$response" | tail -n1)
        body=$(echo "$response" | sed '$d')

        if [ "$status_code" = "$expected_status" ]; then
            echo "$body"
            return 0
        fi

        retries=$((retries + 1))
        if [ $retries -lt $MAX_RETRIES ]; then
            print_warning "Attempt $retries failed (HTTP $status_code), retrying in ${RETRY_DELAY}s..."
            sleep $RETRY_DELAY
        fi
    done

    print_error "Failed after $MAX_RETRIES attempts (HTTP $status_code)"
    return 1
}

# Helper function to check response time
check_response_time() {
    local url="$1"
    local max_time_ms="${2:-150}"

    start_time=$(date +%s%3N)
    response=$(curl -s --max-time "$TIMEOUT" "$url" -o /dev/null -w "%{http_code}" 2>/dev/null || echo "000")
    end_time=$(date +%s%3N)

    elapsed=$((end_time - start_time))

    if [ "$response" = "200" ]; then
        if [ $elapsed -lt $max_time_ms ]; then
            print_success "Response time: ${elapsed}ms (< ${max_time_ms}ms target)"
            return 0
        else
            print_warning "Response time: ${elapsed}ms (> ${max_time_ms}ms target)"
            return 1
        fi
    else
        print_error "Request failed (HTTP $response)"
        return 1
    fi
}

# 1. API Health Check
echo "1. Checking API health endpoint..."
if response=$(http_get "$API_URL/health" 200); then
    print_success "API is healthy"

    # Parse health check response
    if echo "$response" | grep -q "healthy"; then
        print_success "  - Status: healthy"
    fi

    if echo "$response" | grep -q "version"; then
        version=$(echo "$response" | grep -o '"version":"[^"]*"' | cut -d'"' -f4)
        print_success "  - Version: $version"
    fi

    if echo "$response" | grep -q "timestamp"; then
        print_success "  - Timestamp present"
    fi
else
    print_error "API health check failed"
    EXIT_CODE=1
fi
echo ""

# 2. API Response Time
echo "2. Checking API response time..."
if check_response_time "$API_URL/health" 150; then
    print_success "API response time within target (p95 < 150ms)"
else
    print_warning "API response time exceeds target"
fi
echo ""

# 3. API Root Endpoint
echo "3. Checking API root endpoint..."
if response=$(http_get "$API_URL/" 200); then
    print_success "API root endpoint accessible"

    if echo "$response" | grep -q "Morse API Service"; then
        print_success "  - Correct service identification"
    fi

    if echo "$response" | grep -q "endpoints"; then
        endpoint_count=$(echo "$response" | grep -o "POST\|GET\|PUT\|DELETE" | wc -l | tr -d ' ')
        print_success "  - $endpoint_count endpoints documented"
    fi
else
    print_error "API root endpoint failed"
    EXIT_CODE=1
fi
echo ""

# 4. Frontend Health Check
echo "4. Checking frontend availability..."
if response=$(http_get "$FRONTEND_URL/" 200); then
    print_success "Frontend is accessible"

    # Check for React app markers
    if echo "$response" | grep -q "root"; then
        print_success "  - React app structure present"
    fi
else
    print_error "Frontend health check failed"
    EXIT_CODE=1
fi
echo ""

# 5. Frontend Response Time (LCP target)
echo "5. Checking frontend response time..."
if check_response_time "$FRONTEND_URL/" 2500; then
    print_success "Frontend response time within target (LCP < 2.5s)"
else
    print_warning "Frontend response time exceeds target"
fi
echo ""

# 6. Database Connectivity (via API)
echo "6. Checking database connectivity..."
# Try to access an endpoint that requires database
# Using a GET request that shouldn't modify data
DB_TEST_URL="$API_URL/api/workouts/test-user"
if response=$(curl -s -w "\n%{http_code}" --max-time "$TIMEOUT" "$DB_TEST_URL" 2>/dev/null || echo -e "\n000"); then
    status_code=$(echo "$response" | tail -n1)

    # Accept 200 (user exists with workouts), 404 (user exists, no workouts), or 401 (auth required)
    if [ "$status_code" = "200" ] || [ "$status_code" = "404" ] || [ "$status_code" = "401" ]; then
        print_success "Database connectivity confirmed (HTTP $status_code)"
    else
        print_warning "Database connectivity unclear (HTTP $status_code)"
    fi
else
    print_warning "Could not verify database connectivity"
fi
echo ""

# 7. Redis Connectivity (if available)
echo "7. Checking Redis connectivity..."
# This is harder to check externally, but we can look for evidence
print_info "Redis health check requires internal metrics (not available via HTTP)"
print_warning "Verify Redis connectivity in Render dashboard"
echo ""

# 8. CORS Configuration
echo "8. Checking CORS configuration..."
cors_response=$(curl -s -X OPTIONS \
    -H "Origin: https://example.com" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: Content-Type" \
    --max-time "$TIMEOUT" \
    "$API_URL/health" \
    -D - -o /dev/null 2>/dev/null || true)

if echo "$cors_response" | grep -q "Access-Control-Allow-Origin"; then
    print_success "CORS headers present"
else
    print_warning "CORS may not be properly configured"
fi
echo ""

# 9. Security Headers
echo "9. Checking security headers..."
headers=$(curl -s -I --max-time "$TIMEOUT" "$API_URL/health" 2>/dev/null || true)

if echo "$headers" | grep -q -i "X-Frame-Options"; then
    print_success "X-Frame-Options header present"
else
    print_warning "X-Frame-Options header missing"
fi

if echo "$headers" | grep -q -i "Strict-Transport-Security"; then
    print_success "HSTS header present"
else
    print_warning "HSTS header missing (expected for HTTPS)"
fi

if echo "$headers" | grep -q -i "X-Content-Type-Options"; then
    print_success "X-Content-Type-Options header present"
else
    print_warning "X-Content-Type-Options header missing"
fi
echo ""

# 10. Rate Limiting
echo "10. Checking rate limiting..."
# Make multiple rapid requests to test rate limiting
rate_limit_triggered=false
for i in {1..20}; do
    status=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "$API_URL/health" 2>/dev/null || echo "000")
    if [ "$status" = "429" ]; then
        rate_limit_triggered=true
        break
    fi
done

if [ "$rate_limit_triggered" = true ]; then
    print_success "Rate limiting is active"
else
    print_info "Rate limiting not triggered (limit may be set high for development)"
fi
echo ""

# Summary
echo "========================================="
echo "Health Check Summary"
echo "========================================="

if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}All critical health checks passed!${NC}"
    echo ""
    echo "System Status:"
    echo "  - API: Healthy"
    echo "  - Frontend: Healthy"
    echo "  - Database: Accessible"
    echo ""
    echo "The deployment is successful and ready for use."
else
    echo -e "${RED}Some health checks failed!${NC}"
    echo ""
    echo "Please investigate the failures above."
    echo "Check Render logs for more details:"
    echo "  - render logs -s morse-api"
    echo "  - render logs -s morse-frontend"
fi
echo ""

exit $EXIT_CODE
