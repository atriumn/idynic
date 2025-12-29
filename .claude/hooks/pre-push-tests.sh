#!/usr/bin/env bash
set -euo pipefail

# PreToolUse:Bash hook - runs tests before git push
# Prevents pushing code that hasn't been tested

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Only intercept git push commands
if [[ ! "$COMMAND" =~ ^git[[:space:]]+push ]]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR" || exit 1

echo "🧪 Running tests before push..."
echo ""

# Check if package.json exists and has test script
# Run typecheck first (faster than tests)
echo "Running typecheck..."
if ! pnpm run typecheck 2>&1; then
  echo ""
  echo "❌ Typecheck failed. Push blocked." >&2
  exit 2
fi

# Run tests
echo ""
echo "Running tests..."
if ! pnpm run test 2>&1; then
  echo ""
  echo "❌ Tests failed. Push blocked." >&2
  exit 2
fi

echo ""
echo "✅ All checks passed, proceeding with push"
exit 0
