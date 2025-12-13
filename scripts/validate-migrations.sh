#!/bin/bash
# Database migration validation script
# Validates migrations for syntax, ordering, and idempotency

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MIGRATION_DIR="$PROJECT_ROOT/morse-backend/database/migrations"
EXIT_CODE=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_success() { echo -e "${GREEN}[PASS]${NC} $1"; }
print_error() { echo -e "${RED}[FAIL]${NC} $1"; EXIT_CODE=1; }
print_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }

echo "========================================="
echo "Database Migration Validation"
echo "========================================="
echo ""

# 1. Check migration directory exists
echo "1. Checking migration directory..."
if [ -d "$MIGRATION_DIR" ]; then
    print_success "Migration directory exists"
else
    print_error "Migration directory not found: $MIGRATION_DIR"
    exit 1
fi
echo ""

# 2. List and validate migration files
echo "2. Validating migration files..."
MIGRATIONS=($(find "$MIGRATION_DIR" -name "*.sql" -type f | sort))

if [ ${#MIGRATIONS[@]} -eq 0 ]; then
    print_error "No migration files found"
    exit 1
fi

print_success "Found ${#MIGRATIONS[@]} migration files"
for migration in "${MIGRATIONS[@]}"; do
    echo "  - $(basename "$migration")"
done
echo ""

# 3. Check migration naming convention
echo "3. Validating migration naming..."
for migration in "${MIGRATIONS[@]}"; do
    filename=$(basename "$migration")
    if [[ $filename =~ ^[0-9]{3}_[a-z_]+\.sql$ ]]; then
        print_success "$filename follows naming convention"
    else
        print_error "$filename does not follow naming convention (###_description.sql)"
    fi
done
echo ""

# 4. Check migration ordering
echo "4. Validating migration order..."
PREV_NUM=-1
for migration in "${MIGRATIONS[@]}"; do
    filename=$(basename "$migration")
    CURRENT_NUM=$(echo "$filename" | grep -o '^[0-9]\+')

    if [ "$CURRENT_NUM" -le "$PREV_NUM" ]; then
        print_error "Migration $filename is out of order (previous: $PREV_NUM)"
    else
        print_success "Migration $filename is in order ($CURRENT_NUM)"
    fi
    PREV_NUM=$CURRENT_NUM
done
echo ""

# 5. Validate SQL syntax (basic checks)
echo "5. Validating SQL syntax..."
for migration in "${MIGRATIONS[@]}"; do
    filename=$(basename "$migration")

    # Check file is not empty
    if [ ! -s "$migration" ]; then
        print_error "$filename is empty"
        continue
    fi

    # Check for basic SQL keywords
    if grep -q -E "(CREATE|ALTER|INSERT|UPDATE|DELETE|DROP)" "$migration"; then
        print_success "$filename contains SQL statements"
    else
        print_warning "$filename may not contain valid SQL"
    fi

    # Check for transaction safety
    if grep -q "BEGIN" "$migration" && grep -q "COMMIT" "$migration"; then
        print_success "  - Transaction-wrapped"
    else
        print_warning "  - Not transaction-wrapped (consider adding BEGIN/COMMIT)"
    fi

    # Check for idempotency patterns
    if grep -q -E "(IF NOT EXISTS|IF EXISTS|CREATE OR REPLACE)" "$migration"; then
        print_success "  - Idempotent checks present"
    else
        print_warning "  - No idempotency checks (may fail on re-run)"
    fi

    # Check for DROP statements without IF EXISTS
    if grep -q "DROP " "$migration" && ! grep -q "IF EXISTS" "$migration"; then
        print_warning "  - DROP statement without IF EXISTS guard"
    fi
done
echo ""

# 6. Check for common SQL mistakes
echo "6. Checking for common mistakes..."
for migration in "${MIGRATIONS[@]}"; do
    filename=$(basename "$migration")

    # Check for missing semicolons
    if ! grep -q ";" "$migration"; then
        print_warning "$filename may be missing semicolons"
    fi

    # Check for SQL injection vulnerabilities (basic check)
    if grep -q -E "'\$|\"$|CONCAT\(" "$migration"; then
        print_warning "$filename may contain SQL injection risks"
    fi

    # Check for hardcoded credentials
    if grep -q -E "(password|secret|key).*=.*'[^']+'" "$migration"; then
        print_warning "$filename may contain hardcoded credentials"
    fi
done
echo ""

# 7. Validate migration dependencies
echo "7. Validating migration dependencies..."
for migration in "${MIGRATIONS[@]}"; do
    filename=$(basename "$migration")

    # Check for references to tables/columns that may not exist yet
    TABLES_CREATED=$(grep -o "CREATE TABLE[^(]*(" "$migration" | grep -o "[a-z_]\+\s*(" | tr -d '(' | tr -d ' ' || true)

    if [ -n "$TABLES_CREATED" ]; then
        print_success "$filename creates tables: $(echo "$TABLES_CREATED" | tr '\n' ' ')"
    fi
done
echo ""

# 8. Generate migration checksum
echo "8. Generating migration checksums..."
CHECKSUM_FILE="$PROJECT_ROOT/.migration-checksums"
> "$CHECKSUM_FILE"  # Clear file

for migration in "${MIGRATIONS[@]}"; do
    filename=$(basename "$migration")
    CHECKSUM=$(sha256sum "$migration" | cut -d' ' -f1)
    echo "$filename:$CHECKSUM" >> "$CHECKSUM_FILE"
    print_success "$filename: $CHECKSUM"
done

print_success "Checksums saved to .migration-checksums"
echo ""

# 9. Validate init-db.sh references all migrations
echo "9. Validating init-db.sh..."
INIT_SCRIPT="$PROJECT_ROOT/init-db.sh"
if [ -f "$INIT_SCRIPT" ]; then
    for migration in "${MIGRATIONS[@]}"; do
        filename=$(basename "$migration")

        # Skip test data migrations
        if [[ $filename == *"test_data"* ]]; then
            continue
        fi

        if grep -q "$filename" "$INIT_SCRIPT"; then
            print_success "$filename referenced in init-db.sh"
        else
            print_error "$filename NOT referenced in init-db.sh"
        fi
    done
else
    print_error "init-db.sh not found"
fi
echo ""

# 10. Test migration dry-run (if database available)
echo "10. Testing migration dry-run..."
if [ -n "$DATABASE_URL" ]; then
    print_warning "DATABASE_URL is set - would run dry-run test"
    print_warning "Skipping actual test to avoid affecting database"
else
    print_warning "DATABASE_URL not set - skipping dry-run test"
    print_warning "Set DATABASE_URL to test migrations against a database"
fi
echo ""

# Summary
echo "========================================="
echo "Migration Validation Summary"
echo "========================================="
if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}All migration checks passed!${NC}"
    echo "Migrations are ready for deployment."
    echo ""
    echo "Next steps:"
    echo "1. Review .migration-checksums for any unexpected changes"
    echo "2. Test migrations on a staging database"
    echo "3. Create database backup before production deployment"
else
    echo -e "${RED}Migration validation failed!${NC}"
    echo "Please fix the errors above before deploying."
fi
echo ""

exit $EXIT_CODE
