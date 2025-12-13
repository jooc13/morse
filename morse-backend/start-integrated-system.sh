#!/bin/bash

# Morse Integration Test Startup Script
# This script starts the integrated system with frontend-vibecode UI and 656-main parsing quality

echo "🚀 Starting Morse Integrated System..."
echo "   Frontend: vibecode branch (comprehensive UI)"
echo "   Backend: Unified parsing with multi-provider LLM support"
echo "   Auth: Disabled for testing"

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found. Creating from example..."
    cp .env.example .env
    echo "✅ Created .env file. Please edit it with your API keys:"
    echo "   - ANTHROPIC_API_KEY (for Claude)"
    echo "   - GOOGLE_API_KEY (for Gemini)"
    echo ""
    echo "💡 You can start with just one provider - the system will auto-detect"
    echo ""
fi

# Create uploads directory
mkdir -p uploads
echo "✅ Created uploads directory"

# Check if API key is set
if [ -z "$ANTHROPIC_API_KEY" ] && [ -z "$GOOGLE_API_KEY" ] && [ -z "$GEMINI_API_KEY" ]; then
    echo "⚠️  WARNING: No LLM API keys detected in environment"
    echo "   Please set at least one of:"
    echo "   - export ANTHROPIC_API_KEY=your_key"
    echo "   - export GOOGLE_API_KEY=your_key"
    echo "   Or edit the .env file"
    echo ""
fi

echo "🐳 Starting Docker services..."
docker-compose up --build

echo ""
echo "🎉 System should be running at:"
echo "   Frontend: http://localhost:8080"
echo "   API: http://localhost:3000"
echo "   PgAdmin: http://localhost:5050 (admin@morse.com / admin)"
echo ""
echo "📝 To test the parsing integration:"
echo "   1. Go to http://localhost:8080"
echo "   2. Navigate to 'Log Workout'"
echo "   3. Upload an audio file"
echo "   4. Check that parsing quality matches 656-main expectations"
echo ""
echo "🛑 To stop: Ctrl+C then run: docker-compose down"