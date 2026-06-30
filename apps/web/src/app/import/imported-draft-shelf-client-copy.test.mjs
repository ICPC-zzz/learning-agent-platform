/**
 * Tests for the imported draft shelf client copy and safety labels.
 */

import assert from "node:assert/strict";
import test from "node:test";

const source = await import("node:fs/promises").then((fs) =>
  fs.readFile(
    new URL("./ImportedDraftShelfClient.tsx", import.meta.url),
    "utf8",
  ),
);

test("ImportedDraftShelfClient source keeps preview/local-only safety copy", () => {
  assert.equal(source.includes("preview-only"), true);
  assert.equal(source.includes("local-only"), true);
  assert.equal(source.includes("A416 local draft shelf"), true);
  assert.equal(source.includes("dev-only DB save"), true);
  assert.equal(source.includes("保存到开发数据库"), true);
  assert.equal(source.includes("window.prompt"), true);
  assert.equal(source.includes("window.confirm"), true);
  assert.equal(source.includes("renameDraft"), true);
  assert.equal(source.includes("deleteDraft"), true);
  assert.equal(source.includes("saveImportedDraftToDevDatabaseAction"), true);
});
