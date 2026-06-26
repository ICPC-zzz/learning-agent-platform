import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

test("article library DB guard does not require a dedicated env switch", function () {
  const filePath = fileURLToPath(new URL("./article-library-db-guard.ts", import.meta.url));
  const source = fs.readFileSync(filePath, "utf8");

  assert.equal(source.includes("LAP_ARTICLE_LIBRARY_DB_DEV_ENABLED"), false);
  assert.equal(source.includes("ARTICLE_LIBRARY_DB_DISABLED"), false);
});
