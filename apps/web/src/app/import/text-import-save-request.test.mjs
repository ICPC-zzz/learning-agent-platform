import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { readFileSync } from "node:fs";

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
import {
  createBlockedTextImportSaveRequestPreview,
  createTextImportSaveRequestPreview,
  validateTextImportSaveRequestPreview,
} from "./text-import-save-request.ts";

const currentDir = dirname(fileURLToPath(import.meta.url));

test("createTextImportSaveRequestPreview builds a ready save request from safe edited preview state", () => {
  const preview = buildTextImportPreview({
    title: "Safe Save Contract",
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
  const saveRequest = createTextImportSaveRequestPreview({
    preview: confirmationInput,
    confirmation,
    summary,
    userExplicitlyConfirmed: true,
  });

  assert.equal(saveRequest.previewOnly, true);
  assert.equal(saveRequest.implemented, false);
  assert.equal(saveRequest.safeToExposeToClient, true);
  assert.equal(saveRequest.bookTitlePreview, "Safe Save Contract");
  assert.equal(saveRequest.confirmationStatus, "ready");
  assert.equal(saveRequest.effectiveChapterCount, summary.effectiveChapterCount);
  assert.equal(saveRequest.excludedChapterCount, summary.excludedChapterCount);
  assert.equal(saveRequest.estimatedTotalLines, summary.estimatedTotalLines);
  assert.equal(saveRequest.requiresExplicitUserConfirmation, true);
  assert.equal(saveRequest.userExplicitlyConfirmed, true);
  assert.equal(saveRequest.saveReady, true);
  assert.deepEqual(saveRequest.blockedReasons, []);
  assert.equal(saveRequest.writesDatabase, false);
  assert.equal(saveRequest.callsRepository, false);
  assert.equal(saveRequest.safeChapters.length, summary.effectiveChapterCount);
  assert.equal(JSON.stringify(saveRequest).includes("rawText"), false);
});

test("createTextImportSaveRequestPreview blocks when the user has not explicitly confirmed", () => {
  const preview = buildTextImportPreview({
    title: "Explicit Confirmation Check",
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
  const saveRequest = createTextImportSaveRequestPreview({
    preview: confirmationInput,
    confirmation,
    summary,
    userExplicitlyConfirmed: false,
  });

  assert.equal(saveRequest.saveReady, false);
  assert.equal(
    saveRequest.blockedReasons.some((reason) => reason.includes("显式确认")),
    true,
  );
});

test("createTextImportSaveRequestPreview blocks when every chapter is excluded", () => {
  const preview = buildTextImportPreview({
    title: "Excluded Chapters",
    rawText: `# 第一章
正文一
## 第二章
正文二`,
  });
  const edits = createTextImportChapterEditDrafts(preview.chapters).map((draft) => ({
    ...draft,
    excluded: true,
  }));
  const summary = buildTextImportEditedPreviewSummary({
    chapters: preview.chapters,
    edits,
    warnings: preview.warnings,
  });
  const confirmationInput = buildTextImportEditedPreviewConfirmationInput(preview, summary);
  const confirmation = createTextImportConfirmationPreview(confirmationInput);
  const saveRequest = createTextImportSaveRequestPreview({
    preview: confirmationInput,
    confirmation,
    summary,
    userExplicitlyConfirmed: true,
  });

  assert.equal(saveRequest.saveReady, false);
  assert.equal(saveRequest.effectiveChapterCount, 0);
  assert.equal(saveRequest.safeChapters.length, 0);
  assert.equal(
    saveRequest.blockedReasons.some((reason) => reason.includes("有效章节")),
    true,
  );
});

test("createTextImportSaveRequestPreview blocks dangerous-field previews without leaking raw values", () => {
  const preview = buildTextImportPreview({
    title: "token secret cookie DATABASE_URL api key authorization header",
    rawText: `# token secret cookie DATABASE_URL api key authorization header
Authorization: Bearer abc123
cookie=session; token=hidden`,
  });
  const summary = buildTextImportEditedPreviewSummary({
    chapters: preview.chapters,
    edits: createTextImportChapterEditDrafts(preview.chapters),
    warnings: preview.warnings,
  });
  const confirmationInput = buildTextImportEditedPreviewConfirmationInput(preview, summary);
  const confirmation = createTextImportConfirmationPreview(confirmationInput);
  const saveRequest = createTextImportSaveRequestPreview({
    preview: confirmationInput,
    confirmation,
    summary,
    userExplicitlyConfirmed: true,
  });
  const output = JSON.stringify(saveRequest);

  assert.equal(saveRequest.saveReady, false);
  assert.equal(
    saveRequest.blockedReasons.some((reason) => reason.includes("危险字段")),
    true,
  );
  assert.equal(output.includes("rawText"), false);
  assert.equal(output.includes("DATABASE_URL"), false);
  assert.equal(output.includes("authorization"), false);
  assert.equal(output.includes("api key"), false);
  assert.equal(output.includes("cookie"), false);
  assert.equal(output.includes("secret"), false);
  assert.equal(output.includes("token"), false);
  assert.equal(output.includes("session"), false);
  assert.equal(output.includes("abc123"), false);
});

test("validateTextImportSaveRequestPreview and createBlockedTextImportSaveRequestPreview handle missing fields safely", () => {
  const validation = validateTextImportSaveRequestPreview({});
  const blocked = createBlockedTextImportSaveRequestPreview(
    {
      preview: {
        bookTitlePreview: "token secret DATABASE_URL",
        chapters: [
          {
            title: "token secret",
            order: 1,
            estimatedLineCount: 1,
            previewText: "cookie=session",
          },
        ],
      },
    },
    ["保存请求缺少必要字段。"],
  );
  const output = JSON.stringify(blocked);

  assert.equal(validation.blockedReasons.some((reason) => reason.includes("必要字段")), true);
  assert.equal(blocked.saveReady, false);
  assert.equal(blocked.safeToExposeToClient, true);
  assert.equal(blocked.bookTitlePreview.length > 0, true);
  assert.equal(output.includes("DATABASE_URL"), false);
  assert.equal(output.includes("token"), false);
  assert.equal(output.includes("cookie"), false);
  assert.equal(output.includes("session"), false);
});

test("import save request source keeps the client note and avoids DB or repository dependencies", () => {
  const clientSource = readFileSync(join(currentDir, "TextImportPreviewClient.tsx"), "utf8");
  const requestSource = readFileSync(join(currentDir, "text-import-save-request.ts"), "utf8");
  const serverActionSource = readFileSync(
    join(currentDir, "text-import-save-server-action.ts"),
    "utf8",
  );

  assert.equal(clientSource.includes("createTextImportSaveRequestPreview"), true);
  assert.equal(clientSource.includes("SAVE_REQUEST_CONTRACT_COPY"), true);
  assert.equal(clientSource.includes("SAVE_REQUEST_CONTRACT_DETAIL_COPY"), true);
  assert.equal(clientSource.includes("preview-only / no-op"), true);
  assert.equal(clientSource.includes("disabled"), true);
  assert.equal(requestSource.includes("@learning-agent-platform/db"), false);
  assert.equal(requestSource.includes("rawText"), true);
  assert.equal(serverActionSource.includes("@learning-agent-platform/db"), false);
  assert.equal(serverActionSource.includes("save-disabled-by-default"), true);
  assert.equal(serverActionSource.includes("success: false"), true);
  assert.equal(serverActionSource.includes("callsRepository: false"), true);
});
