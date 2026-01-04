#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting local development environment...${NC}"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running. Please start Docker Desktop.${NC}"
    exit 1
fi

# Navigate to project root
cd "$(dirname "$0")/.."

# Check if Supabase is already running
if supabase status > /dev/null 2>&1; then
    echo -e "${YELLOW}Supabase is already running${NC}"
else
    echo -e "${GREEN}Starting Supabase...${NC}"
    supabase start
fi

# Backup existing .env.local if it exists and isn't already a backup
if [ -f ".env.local" ] && [ ! -f ".env.local.prod" ]; then
    echo -e "${YELLOW}Backing up .env.local to .env.local.prod${NC}"
    cp .env.local .env.local.prod
fi

# Copy local Supabase env, preserving API keys from prod
if [ -f ".env.local.prod" ]; then
    echo -e "${GREEN}Setting up local environment with your API keys...${NC}"

    # Start with local Supabase config
    cp .env.local.supabase .env.local

    # Copy over API keys from prod env
    OPENAI_KEY=$(grep "^OPENAI_API_KEY=" .env.local.prod 2>/dev/null | cut -d'=' -f2-)
    GOOGLE_KEY=$(grep "^GOOGLE_AI_API_KEY=" .env.local.prod 2>/dev/null | cut -d'=' -f2-)
    ANTHROPIC_KEY=$(grep "^ANTHROPIC_API_KEY=" .env.local.prod 2>/dev/null | cut -d'=' -f2-)

    # Update .env.local with actual API keys
    if [ -n "$OPENAI_KEY" ]; then
        sed -i '' "s|^OPENAI_API_KEY=.*|OPENAI_API_KEY=$OPENAI_KEY|" .env.local
    fi
    if [ -n "$GOOGLE_KEY" ]; then
        sed -i '' "s|^# GOOGLE_AI_API_KEY=.*|GOOGLE_AI_API_KEY=$GOOGLE_KEY|" .env.local
    fi
    if [ -n "$ANTHROPIC_KEY" ]; then
        sed -i '' "s|^# ANTHROPIC_API_KEY=.*|ANTHROPIC_API_KEY=$ANTHROPIC_KEY|" .env.local
    fi
else
    echo -e "${YELLOW}Warning: No .env.local.prod found. Using .env.local.supabase as-is.${NC}"
    echo -e "${YELLOW}You may need to add your OPENAI_API_KEY manually.${NC}"
    cp .env.local.supabase .env.local
fi

echo ""
echo -e "${GREEN}Local Supabase is ready!${NC}"
echo -e "  API URL:      http://127.0.0.1:54321"
echo -e "  Studio:       http://127.0.0.1:54323"
echo -e "  Inbucket:     http://127.0.0.1:54324 (email testing)"
echo ""
echo -e "${GREEN}Starting Next.js dev server...${NC}"
echo -e "${YELLOW}To switch back to prod: cp .env.local.prod .env.local${NC}"
echo ""

# Start the Next.js dev server
cd apps/web
pnpm dev
