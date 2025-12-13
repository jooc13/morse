#!/bin/bash

echo "==================================="
echo "Render Configuration Validator"
echo "==================================="
echo ""

# Check if render.yaml exists
if [ -f "render.yaml" ]; then
    echo "✓ render.yaml found"
else
    echo "✗ render.yaml not found"
    exit 1
fi

# Check if init-db.sh exists
if [ -f "init-db.sh" ]; then
    echo "✓ init-db.sh found"
else
    echo "✗ init-db.sh not found"
    exit 1
fi

# Check if init-db.sh is executable
if [ -x "init-db.sh" ]; then
    echo "✓ init-db.sh is executable"
else
    echo "✗ init-db.sh is not executable (run: chmod +x init-db.sh)"
    exit 1
fi

# Check Dockerfiles
if [ -f "morse-backend/services/api/Dockerfile" ]; then
    echo "✓ API Dockerfile found"
else
    echo "✗ API Dockerfile not found"
    exit 1
fi

if [ -f "morse-backend/services/frontend/Dockerfile" ]; then
    echo "✓ Frontend Dockerfile found"
else
    echo "✗ Frontend Dockerfile not found"
    exit 1
fi

# Check package.json files
if [ -f "morse-backend/services/api/package.json" ]; then
    echo "✓ API package.json found"
else
    echo "✗ API package.json not found"
    exit 1
fi

if [ -f "morse-backend/services/frontend/package.json" ]; then
    echo "✓ Frontend package.json found"
else
    echo "✗ Frontend package.json not found"
    exit 1
fi

# Check migrations
echo ""
echo "Checking database migrations..."
MIGRATION_COUNT=$(ls morse-backend/database/migrations/*.sql 2>/dev/null | wc -l)
if [ "$MIGRATION_COUNT" -ge 6 ]; then
    echo "✓ Found $MIGRATION_COUNT migration files"
else
    echo "✗ Expected at least 6 migration files, found $MIGRATION_COUNT"
    exit 1
fi

echo ""
echo "==================================="
echo "Configuration is valid!"
echo "==================================="
echo ""
echo "Next steps:"
echo "1. Commit these changes to git"
echo "2. Push to GitHub"
echo "3. Go to https://dashboard.render.com"
echo "4. Click 'New' → 'Blueprint'"
echo "5. Connect your GitHub repo"
echo "6. Render will detect render.yaml automatically"
echo "7. Set GEMINI_API_KEY in morse-api service settings"
echo ""
