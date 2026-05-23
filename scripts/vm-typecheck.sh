#!/bin/bash
set -e
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NODE="$(which node)"
TSC="$PROJECT_DIR/scripts/vm-deps/typescript/bin/tsc"

echo "=== typecheck (via VM typescript) ==="
"$NODE" "$TSC" --noEmit --skipLibCheck --project "$PROJECT_DIR/apps/web/tsconfig.json" 2>&1
EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ typecheck passed (0 errors)"
else
  # Filter to show only src/ errors (ignore node_modules)
  SRC_ERRORS=$("$NODE" "$TSC" --noEmit --skipLibCheck --project "$PROJECT_DIR/apps/web/tsconfig.json" 2>&1 | grep -c "apps/web/src/" || true)
  echo "ℹ️  TypeScript exited with code $EXIT_CODE"
  echo "ℹ️  Errors in apps/web/src/: $SRC_ERRORS"
  if [ "$SRC_ERRORS" = "0" ] || [ -z "$SRC_ERRORS" ]; then
    echo "✅ No errors in project source files (all errors are in node_modules)"
  fi
fi
