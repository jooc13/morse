#!/bin/bash
# Real-time deployment monitoring script
# Monitors health, performance, and error rates during/after deployment

set -e

API_URL="${API_URL:-http://localhost:3000}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3001}"
CHECK_INTERVAL=10  # seconds
DURATION=300  # 5 minutes
ALERT_THRESHOLD_P95=150  # milliseconds
ALERT_THRESHOLD_ERROR_RATE=5  # percent

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_success() { echo -e "${GREEN}[OK]${NC} $1"; }
print_error() { echo -e "${RED}[ALERT]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
print_info() { echo -e "${BLUE}[INFO]${NC} $1"; }

# Metrics storage
declare -a response_times
declare -a error_counts
total_requests=0
failed_requests=0

echo "========================================="
echo "MORSE Deployment Monitor"
echo "========================================="
echo "API URL: $API_URL"
echo "Frontend URL: $FRONTEND_URL"
echo "Check Interval: ${CHECK_INTERVAL}s"
echo "Monitor Duration: ${DURATION}s"
echo "P95 Alert Threshold: ${ALERT_THRESHOLD_P95}ms"
echo "Error Rate Alert: ${ALERT_THRESHOLD_ERROR_RATE}%"
echo "========================================="
echo ""
print_info "Starting monitoring... (Ctrl+C to stop)"
echo ""

# Calculate percentile
calculate_p95() {
    local sorted=($(printf '%s\n' "${response_times[@]}" | sort -n))
    local count=${#sorted[@]}
    local index=$((count * 95 / 100))
    echo "${sorted[$index]}"
}

# Calculate error rate
calculate_error_rate() {
    if [ $total_requests -eq 0 ]; then
        echo "0"
        return
    fi
    echo $(( (failed_requests * 100) / total_requests ))
}

# Check endpoint health and measure response time
check_endpoint() {
    local url="$1"
    local name="$2"

    start_time=$(date +%s%3N)
    response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null || echo "000")
    end_time=$(date +%s%3N)
    elapsed=$((end_time - start_time))

    total_requests=$((total_requests + 1))

    if [ "$response" = "200" ]; then
        response_times+=($elapsed)

        if [ $elapsed -gt $ALERT_THRESHOLD_P95 ]; then
            print_warning "$name: ${elapsed}ms (slow)"
        else
            print_success "$name: ${elapsed}ms"
        fi
        return 0
    else
        failed_requests=$((failed_requests + 1))
        print_error "$name: HTTP $response"
        return 1
    fi
}

# Main monitoring loop
START_TIME=$(date +%s)
END_TIME=$((START_TIME + DURATION))

iteration=0
while [ $(date +%s) -lt $END_TIME ]; do
    iteration=$((iteration + 1))
    current_time=$(date '+%H:%M:%S')

    echo "[$current_time] Check #$iteration"
    echo "----------------------------------------"

    # Check API health
    check_endpoint "$API_URL/health" "API Health"

    # Check frontend
    check_endpoint "$FRONTEND_URL/" "Frontend"

    # Calculate and display metrics
    if [ ${#response_times[@]} -gt 0 ]; then
        p95=$(calculate_p95)
        error_rate=$(calculate_error_rate)

        echo ""
        echo "Current Metrics:"
        echo "  - P95 Response Time: ${p95}ms"
        echo "  - Error Rate: ${error_rate}%"
        echo "  - Total Requests: $total_requests"
        echo "  - Failed Requests: $failed_requests"

        # Alert on thresholds
        if [ "$p95" -gt "$ALERT_THRESHOLD_P95" ]; then
            print_error "P95 response time exceeds ${ALERT_THRESHOLD_P95}ms threshold!"
        fi

        if [ "$error_rate" -gt "$ALERT_THRESHOLD_ERROR_RATE" ]; then
            print_error "Error rate exceeds ${ALERT_THRESHOLD_ERROR_RATE}% threshold!"
        fi
    fi

    echo ""
    sleep $CHECK_INTERVAL
done

# Final report
echo "========================================="
echo "Monitoring Complete"
echo "========================================="
echo ""
echo "Final Statistics:"
echo "  - Total Checks: $iteration"
echo "  - Total Requests: $total_requests"
echo "  - Failed Requests: $failed_requests"

if [ ${#response_times[@]} -gt 0 ]; then
    p95=$(calculate_p95)
    error_rate=$(calculate_error_rate)

    echo "  - P95 Response Time: ${p95}ms"
    echo "  - Error Rate: ${error_rate}%"
    echo ""

    # Calculate average
    total_time=0
    for time in "${response_times[@]}"; do
        total_time=$((total_time + time))
    done
    avg_time=$((total_time / ${#response_times[@]}))
    echo "  - Average Response Time: ${avg_time}ms"

    # Health assessment
    echo ""
    echo "Health Assessment:"
    if [ "$p95" -lt "$ALERT_THRESHOLD_P95" ] && [ "$error_rate" -lt "$ALERT_THRESHOLD_ERROR_RATE" ]; then
        print_success "System is healthy and performing within targets"
    elif [ "$error_rate" -gt "$ALERT_THRESHOLD_ERROR_RATE" ]; then
        print_error "High error rate detected - investigate immediately"
    elif [ "$p95" -gt "$ALERT_THRESHOLD_P95" ]; then
        print_warning "Performance degradation detected - monitor closely"
    fi
fi

echo ""
echo "Recommended Actions:"
if [ "$error_rate" -gt "$ALERT_THRESHOLD_ERROR_RATE" ]; then
    echo "  - Check Render logs: render logs -s morse-api"
    echo "  - Verify database connectivity"
    echo "  - Check Redis status"
    echo "  - Consider rollback if error rate continues"
fi

if [ "$p95" -gt "$ALERT_THRESHOLD_P95" ]; then
    echo "  - Review database query performance"
    echo "  - Check for resource constraints"
    echo "  - Consider scaling up service plan"
fi

echo ""
