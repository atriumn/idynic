#!/usr/bin/env bash
set -euo pipefail

# PostToolUse:Write|Edit hook - validates code after file changes

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Skip if no file path or not a code file
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Only validate TypeScript/JavaScript files
if [[ ! "$FILE_PATH" =~ \.(ts|tsx|js|jsx)$ ]]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR" || exit 1

echo "Validating changes to $FILE_PATH..."

# Run formatter on the specific file
echo "Formatting..."
if ! pnpm run format 2>&1; then
  echo "Formatting failed" >&2
  exit 2
fi

# Run lint
echo "Running lint..."
if ! pnpm run lint 2>&1; then
  echo "Lint failed. Please fix linting errors." >&2
  exit 2
fi

# Run typecheck
echo "Running typecheck..."
if ! pnpm run typecheck 2>&1; then
  echo "Type checking failed." >&2
  exit 2
fi

echo "Validation passed!"
exit 0
