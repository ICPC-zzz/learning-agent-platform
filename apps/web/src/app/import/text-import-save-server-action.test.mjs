import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error TS5097: direct .ts import is used in existing node:test coverage.
import { buildTextImportPreview } from "./text-import-preview.ts";
// @ts-expect-error TS5097: direct .ts import is used in existing node:test coverage.
import {
  buildTextImportEditedPreviewConfirmationInput,
  buildTextImportEditedPreviewSummary,
  createTextImportChapterEditDrafts,
} from "./text-import-edit-preview.ts";
// @ts-expect-error TS5097: direct .ts import is used in existing node:test coverage.
import { createTextImportConfirmationPreview } from "./text-import-confirmation.ts";
// @ts-expect-error TS5097: direct .ts import is used in existing node:test coverage.
import { createTextImportSaveRequestPreview } from "./text-import-save-request.ts";
// @ts-expect-error TS5097: direct .ts import is used in existing node:test coverage.
import { saveTextImportSaveRequestNoopServerAction } from "./text-import-save-server-action.ts";

test("saveTextImportSaveRequestNoopServerAction is permanently no-op", async () => {
  const preview = buildTextImportPreview({
    title: "No-op Server Action",
    rawText: `# 第一章
第一段
## 第二章
第二段`,
  });
  const summary = buildTextImportEditedPreviewSummary({
    chapters: preview.chapters,
    edits: createTextImportChapterEditDrafts(preview.chapters),
    warnings: preview.warnings,
  });
  const confirmationInput = buildTextImportEditedPreviewConfirmationInput(preview, summary);
  const confirmation = createTextImportConfirmationPreview(confirmationInput);
  const request = createTextImportSaveRequestPreview({
    preview: confirmationInput,
    confirmation,
    summary,
    userExplicitlyConfirmed: true,
  });

  const result = await saveTextImportSaveRequestNoopServerAction(null, request);
  const output = JSON.stringify(result);

  assert.equal(result.success, false);
  assert.equal(result.previewOnly, true);
  assert.equal(result.implemented, false);
  assert.equal(result.safeToExposeToClient, true);
  assert.equal(result.reasonCode, "save-disabled-by-default");
  assert.equal(result.writesDatabase, false);
  assert.equal(result.callsRepository, false);
  assert.equal(output.includes("rawText"), false);
  assert.equal(output.includes("DATABASE_URL"), false);
  assert.equal(output.includes("save-disabled-by-default"), true);
});
