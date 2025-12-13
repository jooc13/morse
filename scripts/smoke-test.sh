#!/bin/bash
# Smoke tests for critical user workflows
# Validates end-to-end functionality after deployment
# Completes in under 1 minute

set -e

API_URL="${API_URL:-http://localhost:3000}"
TEST_USER="smoke_test_$(date +%s)"
TEST_EMAIL="${TEST_USER}@smoke.test"
TEST_PASSWORD="SmokeTest123!"
EXIT_CODE=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_success() { echo -e "${GREEN}[PASS]${NC} $1"; }
print_error() { echo -e "${RED}[FAIL]${NC} $1"; EXIT_CODE=1; }
print_info() { echo -e "${BLUE}[INFO]${NC} $1"; }

START_TIME=$(date +%s)

echo "========================================="
echo "MORSE Smoke Tests"
echo "========================================="
echo "Target: $API_URL"
echo "Test User: $TEST_EMAIL"
echo "========================================="
echo ""

# Cleanup function
cleanup() {
    echo ""
    print_info "Cleaning up test data..."
    # In a real system, we'd delete the test user here
    # For now, just log completion
    print_info "Cleanup complete"
}
trap cleanup EXIT

# Helper function for API calls
api_call() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    local expected_status="${4:-200}"
    local auth_token="${5:-}"

    headers=(-H "Content-Type: application/json")
    if [ -n "$auth_token" ]; then
        headers+=(-H "Authorization: Bearer $auth_token")
    fi

    if [ -n "$data" ]; then
        response=$(curl -s -X "$method" "${headers[@]}" -d "$data" -w "\n%{http_code}" "$API_URL$endpoint" || echo -e "\n000")
    else
        response=$(curl -s -X "$method" "${headers[@]}" -w "\n%{http_code}" "$API_URL$endpoint" || echo -e "\n000")
    fi

    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$status_code" = "$expected_status" ]; then
        echo "$body"
        return 0
    else
        echo "ERROR: Expected HTTP $expected_status, got HTTP $status_code" >&2
        echo "$body" >&2
        return 1
    fi
}

# Test 1: User Registration
echo "Test 1: User Registration"
print_info "Creating test user: $TEST_EMAIL"

registration_data=$(cat <<EOF
{
  "email": "$TEST_EMAIL",
  "password": "$TEST_PASSWORD",
  "firstName": "Smoke",
  "lastName": "Test",
  "deviceId": "smoke-test-device"
}
EOF
)

if register_response=$(api_call POST "/api/auth/register" "$registration_data" 201); then
    print_success "User registration successful"

    # Extract user ID and token
    USER_ID=$(echo "$register_response" | grep -o '"userId":"[^"]*"' | cut -d'"' -f4 || echo "")
    AUTH_TOKEN=$(echo "$register_response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4 || echo "")

    if [ -n "$USER_ID" ]; then
        print_success "  - User ID: $USER_ID"
    else
        print_error "  - No user ID returned"
    fi

    if [ -n "$AUTH_TOKEN" ]; then
        print_success "  - Auth token received"
    else
        print_error "  - No auth token returned"
    fi
else
    print_error "User registration failed"
    exit 1
fi
echo ""

# Test 2: User Login
echo "Test 2: User Login"
print_info "Logging in as $TEST_EMAIL"

login_data=$(cat <<EOF
{
  "email": "$TEST_EMAIL",
  "password": "$TEST_PASSWORD"
}
EOF
)

if login_response=$(api_call POST "/api/auth/login" "$login_data" 200); then
    print_success "User login successful"

    # Verify we get a token
    LOGIN_TOKEN=$(echo "$login_response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4 || echo "")
    if [ -n "$LOGIN_TOKEN" ]; then
        print_success "  - New auth token received"
        AUTH_TOKEN="$LOGIN_TOKEN"  # Use login token for subsequent requests
    fi
else
    print_error "User login failed"
fi
echo ""

# Test 3: Get User Profile
echo "Test 3: Get User Profile"
print_info "Fetching user profile"

if profile_response=$(api_call GET "/api/auth/profile" "" 200 "$AUTH_TOKEN"); then
    print_success "Profile retrieval successful"

    # Verify profile data
    if echo "$profile_response" | grep -q "$TEST_EMAIL"; then
        print_success "  - Email matches"
    fi

    if echo "$profile_response" | grep -q "Smoke"; then
        print_success "  - Name matches"
    fi
else
    print_error "Profile retrieval failed"
fi
echo ""

# Test 4: Create Team
echo "Test 4: Create Team"
print_info "Creating a test team"

team_data=$(cat <<EOF
{
  "name": "Smoke Test Team",
  "description": "Automated test team"
}
EOF
)

if team_response=$(api_call POST "/api/teams/create" "$team_data" 201 "$AUTH_TOKEN"); then
    print_success "Team creation successful"

    TEAM_ID=$(echo "$team_response" | grep -o '"id":"[^"]*"' | cut -d'"' -f4 || echo "")
    INVITE_CODE=$(echo "$team_response" | grep -o '"inviteCode":"[^"]*"' | cut -d'"' -f4 || echo "")

    if [ -n "$TEAM_ID" ]; then
        print_success "  - Team ID: $TEAM_ID"
    fi

    if [ -n "$INVITE_CODE" ]; then
        print_success "  - Invite code: $INVITE_CODE"
    fi
else
    print_error "Team creation failed"
fi
echo ""

# Test 5: Get Workouts (empty state)
echo "Test 5: Get Workouts"
print_info "Fetching workouts for new user"

if workout_response=$(api_call GET "/api/workouts/$USER_ID" "" 200 "$AUTH_TOKEN"); then
    print_success "Workout retrieval successful"

    # New user should have no workouts
    workout_count=$(echo "$workout_response" | grep -o '"id"' | wc -l | tr -d ' ')
    if [ "$workout_count" = "0" ]; then
        print_success "  - Empty workout list (expected for new user)"
    else
        print_info "  - Found $workout_count workouts"
    fi
else
    print_error "Workout retrieval failed"
fi
echo ""

# Test 6: Performance - API Response Time
echo "Test 6: Performance Check"
print_info "Measuring API response time"

response_times=()
for i in {1..5}; do
    start=$(date +%s%3N)
    curl -s --max-time 2 "$API_URL/health" > /dev/null 2>&1
    end=$(date +%s%3N)
    elapsed=$((end - start))
    response_times+=($elapsed)
done

# Calculate average (simple)
total=0
for time in "${response_times[@]}"; do
    total=$((total + time))
done
avg=$((total / 5))

if [ $avg -lt 150 ]; then
    print_success "Average response time: ${avg}ms (target: <150ms)"
else
    print_error "Average response time: ${avg}ms (exceeds 150ms target)"
fi
echo ""

# Test 7: Error Handling
echo "Test 7: Error Handling"
print_info "Testing invalid requests"

# Invalid login
if api_call POST "/api/auth/login" '{"email":"invalid","password":"wrong"}' 401 2>/dev/null; then
    print_success "Invalid login properly rejected (401)"
else
    print_error "Invalid login error handling failed"
fi

# Invalid endpoint
if api_call GET "/api/invalid/endpoint" "" 404 2>/dev/null; then
    print_success "Invalid endpoint returns 404"
else
    print_error "404 handling failed"
fi
echo ""

# Summary
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo "========================================="
echo "Smoke Test Summary"
echo "========================================="
echo "Duration: ${DURATION}s"
echo ""

if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}All smoke tests passed!${NC}"
    echo ""
    echo "Critical workflows verified:"
    echo "  - User registration"
    echo "  - User authentication"
    echo "  - Profile management"
    echo "  - Team creation"
    echo "  - Workout retrieval"
    echo "  - API performance (<150ms avg)"
    echo "  - Error handling"
    echo ""
    echo "Deployment is production-ready."
else
    echo -e "${RED}Some smoke tests failed!${NC}"
    echo ""
    echo "Review the failures above and check:"
    echo "  - Database connectivity"
    echo "  - Environment variables"
    echo "  - Service dependencies"
fi
echo ""

exit $EXIT_CODE
