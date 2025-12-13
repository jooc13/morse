#!/bin/bash
# ============================================================================
# MORSE Database Initialization Script for Render PostgreSQL
# ============================================================================
# This script initializes the MORSE database with the complete schema,
# functions, and optional test data.
#
# Usage:
#   ./init_database.sh [--with-test-data] [--force]
#
# Options:
#   --with-test-data    Include test data for development/testing
#   --force            Drop and recreate database (DESTRUCTIVE!)
#
# Environment Variables Required:
#   DATABASE_URL       PostgreSQL connection string
#
# Exit Codes:
#   0  Success
#   1  Missing environment variables
#   2  Database connection failed
#   3  Schema initialization failed
#   4  Function initialization failed
#   5  Test data initialization failed
# ============================================================================

set -e  # Exit on error
set -u  # Exit on undefined variable
set -o pipefail  # Exit on pipe failure

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Parse arguments
WITH_TEST_DATA=false
FORCE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --with-test-data)
            WITH_TEST_DATA=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Function to print colored messages
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check required environment variables
if [ -z "${DATABASE_URL:-}" ]; then
    log_error "DATABASE_URL environment variable is not set"
    log_info "Example: export DATABASE_URL='postgresql://user:password@host:port/database'"
    exit 1
fi

log_info "Starting MORSE database initialization..."
log_info "Database URL: ${DATABASE_URL%%@*}@***" # Hide credentials in logs

# Test database connection
log_info "Testing database connection..."
if ! psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    log_error "Cannot connect to database"
    log_info "Please check your DATABASE_URL and ensure PostgreSQL is running"
    exit 2
fi
log_success "Database connection successful"

# Check if database has existing tables
TABLE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
TABLE_COUNT=$(echo "$TABLE_COUNT" | tr -d '[:space:]')

if [ "$TABLE_COUNT" -gt 0 ]; then
    if [ "$FORCE" = true ]; then
        log_warning "Force flag detected. Dropping all existing tables..."
        psql "$DATABASE_URL" <<-EOSQL
			DO \$\$ DECLARE
			    r RECORD;
			BEGIN
			    -- Drop all views
			    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
			        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
			    END LOOP;

			    -- Drop all functions
			    FOR r IN (SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_type = 'FUNCTION') LOOP
			        EXECUTE 'DROP FUNCTION IF EXISTS ' || quote_ident(r.routine_name) || ' CASCADE';
			    END LOOP;
			END \$\$;
		EOSQL
        log_success "Existing database objects dropped"
    else
        log_warning "Database already contains $TABLE_COUNT tables"
        log_info "Schema initialization is idempotent and will skip existing objects"
        log_info "Use --force flag to drop and recreate (DESTRUCTIVE!)"
    fi
fi

# Initialize production schema
log_info "Initializing production schema..."
if psql "$DATABASE_URL" -f "$SCRIPT_DIR/init_production_schema.sql" > /dev/null 2>&1; then
    log_success "Production schema initialized successfully"
else
    log_error "Schema initialization failed"
    log_info "Check the SQL file: $SCRIPT_DIR/init_production_schema.sql"
    exit 3
fi

# Initialize functions and triggers
log_info "Initializing database functions and triggers..."
if psql "$DATABASE_URL" -f "$SCRIPT_DIR/init_functions.sql" > /dev/null 2>&1; then
    log_success "Functions and triggers initialized successfully"
else
    log_error "Function initialization failed"
    log_info "Check the SQL file: $SCRIPT_DIR/init_functions.sql"
    exit 4
fi

# Initialize test data if requested
if [ "$WITH_TEST_DATA" = true ]; then
    log_info "Initializing test data..."
    if psql "$DATABASE_URL" -f "$SCRIPT_DIR/init_test_data.sql" > /dev/null 2>&1; then
        log_success "Test data initialized successfully"
    else
        log_error "Test data initialization failed"
        log_info "Check the SQL file: $SCRIPT_DIR/init_test_data.sql"
        exit 5
    fi
else
    log_info "Skipping test data (use --with-test-data to include)"
fi

# Verify installation
log_info "Verifying database installation..."
VERIFICATION_SCRIPT="$SCRIPT_DIR/verify_database.sh"
if [ -f "$VERIFICATION_SCRIPT" ]; then
    if bash "$VERIFICATION_SCRIPT"; then
        log_success "Database verification passed"
    else
        log_warning "Database verification found some issues (see above)"
    fi
else
    log_warning "Verification script not found: $VERIFICATION_SCRIPT"
fi

# Summary
echo ""
log_success "============================================"
log_success "Database initialization complete!"
log_success "============================================"
echo ""
log_info "Next steps:"
log_info "  1. Start your MORSE backend services"
log_info "  2. Test API connectivity with /health endpoint"
log_info "  3. Monitor logs for any database-related issues"
echo ""

if [ "$WITH_TEST_DATA" = true ]; then
    log_info "Test Data Credentials:"
    log_info "  Device UUIDs (last 4 chars): c4b9, 4c5d, bc12, 9012, cdef"
    log_info "  Use these for testing device search and claiming"
    echo ""
fi

exit 0
