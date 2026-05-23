#!/bin/bash
set -e
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NODE="$(which node)"
TSLIB="$PROJECT_DIR/scripts/vm-deps/typescript/lib/typescript.js"

echo "=== VM lint: TypeScript syntax check ==="

check_file() {
  local f="$1"
  local full="$PROJECT_DIR/apps/web/$f"
  if [ ! -f "$full" ]; then return; fi
  result=$("$NODE" -e "
    var fs = require('fs');
    var ts = require('$TSLIB');
    var src = fs.readFileSync('$full', 'utf8');
    var sf = ts.createSourceFile('$f', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    var diags = sf.parseDiagnostics;
    if (diags.length === 0) process.stdout.write('OK');
    else diags.forEach(function(d) {
      var pos = d.start ? ts.getLineAndCharacterOfPosition(sf, d.start) : {line:0};
      process.stdout.write('L' + (pos.line+1) + ':' + ts.flattenDiagnosticMessageText(d.messageText,' '));
    });
  " 2>&1)
  if [ "$result" = "OK" ]; then echo "  ✅ $f"; else echo "  ⚠️  $f ($result)"; fi
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

echo "✅ VM lint complete"
