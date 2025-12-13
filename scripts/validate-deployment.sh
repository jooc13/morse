#!/bin/bash
# Pre-deployment validation script
# Validates code, dependencies, and configuration before deployment

set -e  # Exit on any error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
EXIT_CODE=0

echo "========================================="
echo "MORSE Deployment Validation"
echo "========================================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

print_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    EXIT_CODE=1
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# 1. Check required files exist
echo "1. Validating required files..."
REQUIRED_FILES=(
    "render.yaml"
    "morse-backend/services/api/Dockerfile"
    "morse-backend/services/frontend/Dockerfile"
    "morse-backend/services/api/package.json"
    "morse-backend/services/frontend/package.json"
    "init-db.sh"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$PROJECT_ROOT/$file" ]; then
        print_success "$file exists"
    else
        print_error "$file is missing"
    fi
done
echo ""

# 2. Validate render.yaml syntax
echo "2. Validating render.yaml syntax..."
if command -v python3 &> /dev/null; then
    python3 -c "import yaml; yaml.safe_load(open('$PROJECT_ROOT/render.yaml'))" 2>/dev/null
    if [ $? -eq 0 ]; then
        print_success "render.yaml is valid YAML"
    else
        print_error "render.yaml has syntax errors"
    fi
else
    print_warning "Python3 not found, skipping YAML validation"
fi
echo ""

# 3. Check database migrations
echo "3. Validating database migrations..."
MIGRATION_DIR="$PROJECT_ROOT/morse-backend/database/migrations"
if [ -d "$MIGRATION_DIR" ]; then
    MIGRATION_COUNT=$(find "$MIGRATION_DIR" -name "*.sql" -type f | wc -l | tr -d ' ')
    if [ "$MIGRATION_COUNT" -gt 0 ]; then
        print_success "Found $MIGRATION_COUNT migration files"

        # Validate SQL syntax (basic check)
        for migration in "$MIGRATION_DIR"/*.sql; do
            if [ -f "$migration" ]; then
                # Check for basic SQL keywords
                if grep -q -E "(CREATE|ALTER|INSERT|UPDATE|DELETE)" "$migration"; then
                    print_success "$(basename "$migration") appears valid"
                else
                    print_warning "$(basename "$migration") may be empty or invalid"
                fi
            fi
        done
    else
        print_error "No migration files found"
    fi
else
    print_error "Migration directory not found"
fi
echo ""

# 4. Validate package.json files
echo "4. Validating package.json dependencies..."
for pkg_json in "$PROJECT_ROOT"/morse-backend/services/*/package.json; do
    if [ -f "$pkg_json" ]; then
        SERVICE_NAME=$(basename "$(dirname "$pkg_json")")

        # Check for required fields
        if jq -e '.name and .version and .dependencies' "$pkg_json" > /dev/null 2>&1; then
            print_success "$SERVICE_NAME package.json is valid"

            # Count dependencies
            DEP_COUNT=$(jq '.dependencies | length' "$pkg_json")
            print_success "  - $DEP_COUNT dependencies"

            # Check for security vulnerabilities (if npm is available)
            if command -v npm &> /dev/null; then
                cd "$(dirname "$pkg_json")"
                if npm audit --production --audit-level=high 2>&1 | grep -q "found 0 vulnerabilities"; then
                    print_success "  - No high-severity vulnerabilities"
                else
                    print_warning "  - Security vulnerabilities detected (run 'npm audit' for details)"
                fi
                cd "$PROJECT_ROOT"
            fi
        else
            print_error "$SERVICE_NAME package.json is invalid or incomplete"
        fi
    fi
done
echo ""

# 5. Validate Dockerfiles
echo "5. Validating Dockerfiles..."
for dockerfile in "$PROJECT_ROOT"/morse-backend/services/*/Dockerfile; do
    if [ -f "$dockerfile" ]; then
        SERVICE_NAME=$(basename "$(dirname "$dockerfile")")

        # Check for required Dockerfile instructions
        if grep -q "FROM" "$dockerfile" && grep -q "WORKDIR" "$dockerfile"; then
            print_success "$SERVICE_NAME Dockerfile is valid"

            # Check for security best practices
            if grep -q "USER node" "$dockerfile" || grep -q "USER " "$dockerfile"; then
                print_success "  - Non-root user configured"
            else
                print_warning "  - Running as root (security risk)"
            fi

            # Check for .dockerignore
            DOCKER_DIR=$(dirname "$dockerfile")
            if [ -f "$DOCKER_DIR/.dockerignore" ]; then
                print_success "  - .dockerignore present"
            else
                print_warning "  - No .dockerignore file (may increase build time)"
            fi
        else
            print_error "$SERVICE_NAME Dockerfile is incomplete"
        fi
    fi
done
echo ""

# 6. Check environment variables
echo "6. Validating environment configuration..."
if [ -f "$PROJECT_ROOT/.env.example" ]; then
    print_success ".env.example exists"

    # Count required variables
    VAR_COUNT=$(grep -c "=" "$PROJECT_ROOT/.env.example" || true)
    print_success "  - $VAR_COUNT environment variables documented"
else
    print_warning ".env.example not found"
fi
echo ""

# 7. Validate init-db.sh
echo "7. Validating database initialization script..."
if [ -f "$PROJECT_ROOT/init-db.sh" ]; then
    if [ -x "$PROJECT_ROOT/init-db.sh" ]; then
        print_success "init-db.sh is executable"
    else
        print_warning "init-db.sh is not executable (run: chmod +x init-db.sh)"
    fi

    # Check script uses set -e
    if grep -q "set -e" "$PROJECT_ROOT/init-db.sh"; then
        print_success "  - Error handling configured"
    else
        print_warning "  - No error handling (missing 'set -e')"
    fi

    # Check migration order
    if grep -q "001_" "$PROJECT_ROOT/init-db.sh"; then
        print_success "  - Migrations referenced in order"
    else
        print_warning "  - Migration order not clear"
    fi
else
    print_error "init-db.sh not found"
fi
echo ""

# 8. Check Git status
echo "8. Validating Git repository..."
if [ -d "$PROJECT_ROOT/.git" ]; then
    print_success "Git repository initialized"

    # Check for uncommitted changes
    if [ -z "$(git status --porcelain)" ]; then
        print_success "  - Working directory clean"
    else
        print_warning "  - Uncommitted changes detected"
        git status --short
    fi

    # Check current branch
    CURRENT_BRANCH=$(git branch --show-current)
    print_success "  - Current branch: $CURRENT_BRANCH"
else
    print_error "Not a Git repository"
fi
echo ""

# 9. Validate critical endpoints
echo "9. Validating API endpoint definitions..."
API_APP="$PROJECT_ROOT/morse-backend/services/api/src/app.js"
if [ -f "$API_APP" ]; then
    if grep -q "/health" "$API_APP"; then
        print_success "Health check endpoint defined"
    else
        print_error "Health check endpoint missing"
    fi

    # Count route definitions
    ROUTE_COUNT=$(grep -c "app.use\|app.get\|app.post" "$API_APP" || true)
    print_success "  - $ROUTE_COUNT route definitions found"
else
    print_error "API app.js not found"
fi
echo ""

# Summary
echo "========================================="
echo "Validation Summary"
echo "========================================="
if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}All validation checks passed!${NC}"
    echo "Deployment is ready to proceed."
else
    echo -e "${RED}Validation failed!${NC}"
    echo "Please fix the errors above before deploying."
fi
echo ""

exit $EXIT_CODE
