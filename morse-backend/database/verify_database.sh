#!/bin/bash
# ============================================================================
# MORSE Database Verification Script
# ============================================================================
# This script verifies that the database has been correctly initialized
# with all required tables, indexes, functions, and views.
#
# Usage:
#   ./verify_database.sh
#
# Environment Variables Required:
#   DATABASE_URL       PostgreSQL connection string
#
# Exit Codes:
#   0  All verifications passed
#   1  Some verifications failed
# ============================================================================

set -u  # Exit on undefined variable
set -o pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

# Check if DATABASE_URL is set
if [ -z "${DATABASE_URL:-}" ]; then
    echo -e "${RED}ERROR: DATABASE_URL environment variable is not set${NC}"
    exit 1
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}MORSE Database Verification${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to run a verification query
verify() {
    local description=$1
    local query=$2
    local expected=$3

    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

    result=$(psql "$DATABASE_URL" -t -c "$query" 2>/dev/null | tr -d '[:space:]')

    if [ "$result" = "$expected" ]; then
        echo -e "${GREEN}✓${NC} $description"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        return 0
    else
        echo -e "${RED}✗${NC} $description (expected: $expected, got: $result)"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        return 1
    fi
}

# Function to check if a table exists
check_table() {
    local table_name=$1
    verify "Table: $table_name" \
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table_name';" \
        "1"
}

# Function to check if an index exists
check_index() {
    local index_name=$1
    verify "Index: $index_name" \
        "SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname = '$index_name';" \
        "1"
}

# Function to check if a function exists
check_function() {
    local function_name=$1
    verify "Function: $function_name" \
        "SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = '$function_name';" \
        "1"
}

# Function to check if a view exists
check_view() {
    local view_name=$1
    verify "View: $view_name" \
        "SELECT COUNT(*) FROM information_schema.views WHERE table_schema = 'public' AND table_name = '$view_name';" \
        "1"
}

echo -e "${BLUE}Checking Extensions...${NC}"
verify "Extension: uuid-ossp" \
    "SELECT COUNT(*) FROM pg_extension WHERE extname = 'uuid-ossp';" \
    "1"
echo ""

echo -e "${BLUE}Checking Core Tables...${NC}"
check_table "users"
check_table "app_users"
check_table "audio_files"
check_table "transcriptions"
check_table "workouts"
check_table "exercises"
check_table "exercise_library"
check_table "user_progress"
echo ""

echo -e "${BLUE}Checking Authentication Tables...${NC}"
check_table "voice_profiles"
check_table "speaker_verifications"
check_table "user_devices"
check_table "device_links"
check_table "workout_claims"
check_table "session_claims"
echo ""

echo -e "${BLUE}Checking Session Tables...${NC}"
check_table "workout_sessions"
check_table "session_audio_files"
check_table "session_detection_config"
echo ""

echo -e "${BLUE}Checking Teams Tables...${NC}"
check_table "teams"
check_table "team_memberships"
echo ""

echo -e "${BLUE}Checking Critical Indexes...${NC}"
check_index "idx_users_device_uuid"
check_index "idx_audio_files_user_id"
check_index "idx_audio_files_transcription_status"
check_index "idx_workouts_user_id"
check_index "idx_workouts_claim_status"
check_index "idx_exercises_workout_id"
check_index "idx_voice_profiles_user_id"
check_index "idx_workout_sessions_user_id"
check_index "idx_device_links_device_uuid"
echo ""

echo -e "${BLUE}Checking Functions...${NC}"
check_function "claim_workout"
check_function "search_devices_by_last4"
check_function "get_unclaimed_workouts_for_device"
check_function "link_user_to_device"
check_function "get_user_linked_devices"
check_function "auto_assign_workout_to_user"
check_function "create_new_session"
check_function "add_audio_to_session"
check_function "detect_session_candidates"
check_function "generate_invite_code"
check_function "expire_old_unclaimed_workouts"
echo ""

echo -e "${BLUE}Checking Views...${NC}"
check_view "session_summaries"
check_view "user_workout_summaries"
echo ""

echo -e "${BLUE}Checking Foreign Key Constraints...${NC}"
verify "FK: audio_files -> users" \
    "SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY' AND table_name = 'audio_files' AND constraint_name LIKE '%user%';" \
    "1"

verify "FK: workouts -> users" \
    "SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY' AND table_name = 'workouts' AND constraint_name LIKE '%user%';" \
    "1"

verify "FK: exercises -> workouts" \
    "SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY' AND table_name = 'exercises';" \
    "1"
echo ""

echo -e "${BLUE}Checking Database Integrity...${NC}"

# Check for orphaned records
verify "No orphaned audio files" \
    "SELECT COUNT(*) FROM audio_files af WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = af.user_id);" \
    "0"

verify "No orphaned workouts" \
    "SELECT COUNT(*) FROM workouts w WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = w.user_id);" \
    "0"

verify "No orphaned exercises" \
    "SELECT COUNT(*) FROM exercises e WHERE NOT EXISTS (SELECT 1 FROM workouts w WHERE w.id = e.workout_id);" \
    "0"
echo ""

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Verification Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Total Checks:  $TOTAL_CHECKS"
echo -e "${GREEN}Passed:        $PASSED_CHECKS${NC}"

if [ $FAILED_CHECKS -gt 0 ]; then
    echo -e "${RED}Failed:        $FAILED_CHECKS${NC}"
    echo ""
    echo -e "${RED}Database verification failed!${NC}"
    echo -e "${YELLOW}Please review the errors above and ensure all migration scripts ran successfully.${NC}"
    exit 1
else
    echo -e "${GREEN}Failed:        $FAILED_CHECKS${NC}"
    echo ""
    echo -e "${GREEN}✓ All verifications passed!${NC}"
    echo -e "${GREEN}Database is correctly initialized and ready for use.${NC}"
    exit 0
fi
