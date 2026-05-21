import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const componentSource = readFileSync(
  join(currentDir, "BookLibraryEmptyState.tsx"),
  "utf8",
);

test("books empty state import entry points to /import", () => {
  assert.match(
    componentSource,
    /<Link\b[\s\S]*\bhref="\/import"[\s\S]*>\s*导入第一本书\s*<\/Link>/u,
  );
});
