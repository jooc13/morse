#!/bin/bash
# ============================================================================
# MORSE Database Rollback Script
# ============================================================================
# This script provides emergency rollback capabilities for the MORSE database.
# Use with extreme caution - this is a DESTRUCTIVE operation.
#
# Usage:
#   ./rollback_database.sh [--confirm] [--save-backup]
#
# Options:
#   --confirm       Required flag to confirm destructive operation
#   --save-backup   Create a database dump before rolling back
#
# Environment Variables Required:
#   DATABASE_URL    PostgreSQL connection string
#
# Exit Codes:
#   0  Rollback completed successfully
#   1  Missing confirmation flag
#   2  Database connection failed
#   3  Backup failed
#   4  Rollback failed
# ============================================================================

set -e
set -u
set -o pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Parse arguments
CONFIRMED=false
SAVE_BACKUP=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --confirm)
            CONFIRMED=true
            shift
            ;;
        --save-backup)
            SAVE_BACKUP=true
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Require confirmation
if [ "$CONFIRMED" = false ]; then
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}DANGEROUS OPERATION${NC}"
    echo -e "${RED}========================================${NC}"
    echo ""
    echo -e "${YELLOW}This script will DROP ALL database objects including:${NC}"
    echo -e "  - All tables and their data"
    echo -e "  - All indexes"
    echo -e "  - All functions and triggers"
    echo -e "  - All views"
    echo ""
    echo -e "${RED}This action CANNOT be undone!${NC}"
    echo ""
    echo -e "To proceed, run with ${YELLOW}--confirm${NC} flag:"
    echo -e "  ${BLUE}./rollback_database.sh --confirm${NC}"
    echo ""
    echo -e "To save a backup first:"
    echo -e "  ${BLUE}./rollback_database.sh --confirm --save-backup${NC}"
    echo ""
    exit 1
fi

# Check DATABASE_URL
if [ -z "${DATABASE_URL:-}" ]; then
    echo -e "${RED}ERROR: DATABASE_URL environment variable is not set${NC}"
    exit 1
fi

echo -e "${RED}========================================${NC}"
echo -e "${RED}MORSE Database Rollback${NC}"
echo -e "${RED}========================================${NC}"
echo ""

# Test database connection
echo -e "${BLUE}Testing database connection...${NC}"
if ! psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${RED}ERROR: Cannot connect to database${NC}"
    exit 2
fi
echo -e "${GREEN}✓ Connected${NC}"
echo ""

# Save backup if requested
if [ "$SAVE_BACKUP" = true ]; then
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_DIR="./backups"
    BACKUP_FILE="$BACKUP_DIR/morse_backup_$TIMESTAMP.sql"

    mkdir -p "$BACKUP_DIR"

    echo -e "${BLUE}Creating backup...${NC}"
    if pg_dump "$DATABASE_URL" > "$BACKUP_FILE" 2>/dev/null; then
        echo -e "${GREEN}✓ Backup saved to: $BACKUP_FILE${NC}"
        # Compress the backup
        gzip "$BACKUP_FILE"
        echo -e "${GREEN}✓ Backup compressed: $BACKUP_FILE.gz${NC}"
    else
        echo -e "${RED}ERROR: Backup failed${NC}"
        exit 3
    fi
    echo ""
fi

# Final warning
echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}FINAL WARNING${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""
echo -e "${RED}About to DROP ALL database objects.${NC}"
echo -e "Press Ctrl+C now to abort, or Enter to continue..."
read -r

# Perform rollback
echo ""
echo -e "${BLUE}Dropping all database objects...${NC}"

if psql "$DATABASE_URL" <<-EOSQL
	-- Disable foreign key checks temporarily
	SET session_replication_role = replica;

	-- Drop all views first
	DO \$\$
	DECLARE
	    r RECORD;
	BEGIN
	    FOR r IN (SELECT tablename FROM pg_views WHERE schemaname = 'public') LOOP
	        EXECUTE 'DROP VIEW IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
	    END LOOP;
	END \$\$;

	-- Drop all tables
	DO \$\$
	DECLARE
	    r RECORD;
	BEGIN
	    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
	        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
	    END LOOP;
	END \$\$;

	-- Drop all functions
	DO \$\$
	DECLARE
	    r RECORD;
	BEGIN
	    FOR r IN (
	        SELECT routine_name, routine_schema
	        FROM information_schema.routines
	        WHERE routine_schema = 'public'
	        AND routine_type = 'FUNCTION'
	    ) LOOP
	        EXECUTE 'DROP FUNCTION IF EXISTS ' || quote_ident(r.routine_name) || ' CASCADE';
	    END LOOP;
	END \$\$;

	-- Drop all sequences
	DO \$\$
	DECLARE
	    r RECORD;
	BEGIN
	    FOR r IN (SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public') LOOP
	        EXECUTE 'DROP SEQUENCE IF EXISTS ' || quote_ident(r.sequence_name) || ' CASCADE';
	    END LOOP;
	END \$\$;

	-- Drop all types
	DO \$\$
	DECLARE
	    r RECORD;
	BEGIN
	    FOR r IN (SELECT typname FROM pg_type WHERE typnamespace = 'public'::regnamespace) LOOP
	        EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(r.typname) || ' CASCADE';
	    END LOOP;
	END \$\$;

	-- Re-enable foreign key checks
	SET session_replication_role = DEFAULT;

	-- Verify cleanup
	SELECT
	    (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public') as tables,
	    (SELECT COUNT(*) FROM pg_views WHERE schemaname = 'public') as views,
	    (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public') as functions;
EOSQL
then
    echo -e "${GREEN}✓ All database objects dropped successfully${NC}"
else
    echo -e "${RED}ERROR: Rollback failed${NC}"
    exit 4
fi

# Summary
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Rollback Complete${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "The database is now empty and ready for re-initialization."
echo ""
echo -e "Next steps:"
echo -e "  1. Run ${BLUE}./init_database.sh${NC} to reinitialize the schema"

if [ "$SAVE_BACKUP" = true ]; then
    echo -e "  2. Restore from backup if needed:"
    echo -e "     ${BLUE}gunzip -c $BACKUP_FILE.gz | psql \$DATABASE_URL${NC}"
fi

echo ""
exit 0
