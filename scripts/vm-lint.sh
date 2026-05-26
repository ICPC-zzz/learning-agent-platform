#!/usr/bin/env bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NODE="$(which node)"
TSLIB="$PROJECT_DIR/scripts/vm-deps/typescript/lib/typescript.js"

to_node_path() {
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -m "$1"
  else
    printf '%s\n' "$1"
  fi
}

TSLIB_NODE="$(to_node_path "$TSLIB")"

echo "=== VM lint: TypeScript syntax check ==="

failed=0

check_file() {
  local f="$1"
  local full="$PROJECT_DIR/apps/web/$f"

  if [ ! -f "$full" ]; then
    return
  fi

  local full_node
  full_node="$(to_node_path "$full")"

  result=$("$NODE" -e "
    var fs = require('fs');
    var ts = require('$TSLIB_NODE');
    var src = fs.readFileSync('$full_node', 'utf8');
    var sf = ts.createSourceFile('$f', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    var diags = sf.parseDiagnostics;

    if (diags.length === 0) {
      process.stdout.write('OK');
    } else {
      diags.forEach(function(d) {
        var pos = d.start ? ts.getLineAndCharacterOfPosition(sf, d.start) : { line: 0 };
        process.stdout.write('L' + (pos.line + 1) + ':' + ts.flattenDiagnosticMessageText(d.messageText, ' '));
      });
      process.exitCode = 1;
    }
  " 2>&1) || true

  if [ "$result" = "OK" ]; then
    echo "  OK $f"
  else
    echo "  FAIL $f ($result)"
    failed=1
  fi
}

for f in \
  "src/app/reader/ReaderRecentChaptersPanel.tsx" \
  "src/app/reader/ReaderFontSizeControl.tsx" \
  "src/app/reader/ReaderNoteDraftPanel.tsx" \
  "src/app/reader/ReaderBookmarksPanel.tsx" \
  "src/app/reader/ReaderReadingStatsPanel.tsx" \
  "src/app/reader/ReaderScrollPositionTracker.tsx" \
  "src/app/reader/ReaderReadingTimer.tsx" \
  "src/app/reader/ReaderChapterCompletionToggle.tsx" \
  "src/app/reader/ReaderScrollProgressIndicator.tsx" \
  "src/app/reader/ReaderVisibleBlockIndicator.tsx" \
  "src/app/reader/components/ReaderChapterNavigation.tsx" \
  "src/app/reader/components/ReaderChapterSelectionNotice.tsx" \
  "src/app/reader/components/ReadingProgressSaveForm.tsx" \
  "src/app/reader/page.tsx" \
  "src/app/reader/reader-query.ts" \
  ; do check_file "$f"; done

if [ "$failed" -ne 0 ]; then
  echo "VM lint failed"
  exit 1
fi

echo "VM lint complete"