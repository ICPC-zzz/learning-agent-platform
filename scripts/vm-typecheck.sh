#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NODE="$(which node)"
TSC="$PROJECT_DIR/scripts/vm-deps/typescript/bin/tsc"
NM_SRC="$PROJECT_DIR/node_modules/.pnpm"
NM_DST="/tmp/vm-node-modules"

if [ ! -w "/tmp" ] 2>/dev/null; then
  NM_DST="/sessions/festive-amazing-goodall/tmp/vm-node-modules"
fi

echo "=== typecheck (via VM typescript) ==="

ROUTES_FILE="$PROJECT_DIR/apps/web/.next/types/routes.d.ts"
ROUTES_CLEAN="$PROJECT_DIR/scripts/vm-deps/routes-clean.d.ts"
mkdir -p "$(dirname "$ROUTES_FILE")"
if [ -f "$ROUTES_CLEAN" ]; then
  cp "$ROUTES_CLEAN" "$ROUTES_FILE"
fi

# Python helper outputs the actual NM_DST it used
ACTUAL_NM_DST=$(python3 "$PROJECT_DIR/scripts/vm-typecheck-helper.py" "$NM_SRC" "$NM_DST" "$PROJECT_DIR" 2>&1 | tee /dev/stderr | grep "^NM_DST=" | cut -d= -f2)
if [ -n "$ACTUAL_NM_DST" ]; then
  NM_DST="$ACTUAL_NM_DST"
fi
echo ""

TSCONFIG_PATH="$NM_DST/vm-tsconfig.json"

"$NODE" "$TSC" --noEmit --skipLibCheck --project "$TSCONFIG_PATH" 2>&1
EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
  echo "PASS: typecheck 0 errors"
else
  SRC_ERRORS=$($NODE $TSC --noEmit --skipLibCheck --project "$TSCONFIG_PATH" 2>/dev/null | grep -c "apps/web/src/" || echo 0)
  echo "INFO: TS exited with code $EXIT_CODE"
  echo "INFO: Errors in apps/web/src/: $SRC_ERRORS"
fi
