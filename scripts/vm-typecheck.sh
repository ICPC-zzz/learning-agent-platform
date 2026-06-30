#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NODE="$(which node)"
PYTHON=""
for PYTHON_CANDIDATE in python3 python py; do
  if command -v "$PYTHON_CANDIDATE" >/dev/null 2>&1 && "$PYTHON_CANDIDATE" --version >/dev/null 2>&1; then
    PYTHON="$PYTHON_CANDIDATE"
    break
  fi
done
if [ -z "$PYTHON" ]; then
  echo "ERROR: Python is required for scripts/vm-typecheck-helper.py" >&2
  exit 1
fi
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

# Python helper outputs the actual NM_DST it used. Keep a temp log instead of
# using /dev/stderr because some Windows bash environments do not provide it.
HELPER_LOG="${TMPDIR:-/tmp}/lap-vm-typecheck-helper-$$.log"
"$PYTHON" "$PROJECT_DIR/scripts/vm-typecheck-helper.py" "$NM_SRC" "$NM_DST" "$PROJECT_DIR" >"$HELPER_LOG" 2>&1 || {
  HELPER_STATUS=$?
  cat "$HELPER_LOG" >&2
  rm -f "$HELPER_LOG"
  exit "$HELPER_STATUS"
}
cat "$HELPER_LOG" >&2
ACTUAL_NM_DST=$(grep "^NM_DST=" "$HELPER_LOG" | tail -n 1 | cut -d= -f2)
rm -f "$HELPER_LOG"
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
