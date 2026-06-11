import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// @ts-expect-error TS5097: direct .ts import is used in existing node:test coverage.
import { buildTextImportPreview } from "./text-import-preview.ts";
// @ts-expect-error TS5097: direct .ts import is used in existing node:test coverage.
import {
  buildTextImportConfirmationChecklist,
  createTextImportConfirmationPreview,
  validateTextImportConfirmationPreview,
} from "./text-import-confirmation.ts";

const currentDir = dirname(fileURLToPath(import.meta.url));

test("createTextImportConfirmationPreview builds a ready confirmation from a safe preview", () => {
  const preview = buildTextImportPreview({
    title: "Markdown Book",
    rawText: `# Intro
Alpha line

## Details
Beta line`,
  });

  const confirmation = createTextImportConfirmationPreview(preview);
  const checklist = buildTextImportConfirmationChecklist(confirmation);

  assert.equal(confirmation.previewOnly, true);
  assert.equal(confirmation.implemented, true);
  assert.equal(confirmation.safeToExposeToClient, true);
  assert.equal(confirmation.readyForFutureSave, true);
  assert.equal(confirmation.status, "ready");
  assert.equal(confirmation.blockedReasons.length, 0);
  assert.equal(confirmation.bookTitlePreview, "Markdown Book");
  assert.equal(confirmation.chapterCount, 2);
  assert.equal(
    confirmation.estimatedTotalLines,
    preview.chapters.reduce((total, chapter) => total + chapter.estimatedLineCount, 0),
  );
  assert.equal(confirmation.requiresExplicitUserConfirmation, true);
  assert.equal(confirmation.writesDatabase, false);
  assert.equal(confirmation.callsRepository, false);
  assert.equal(
    checklist.find((item) => item.label === "章节有效")?.value,
    "已通过",
  );
  assert.equal(
    checklist.find((item) => item.label === "保存功能未连接")?.value,
    "是",
  );
  assert.equal(
    checklist.find((item) => item.label === "危险字段检测")?.value,
    "未检测到危险字段",
  );
});

test("createTextImportConfirmationPreview blocks a malformed preview", () => {
  const confirmation = createTextImportConfirmationPreview({
    previewOnly: true,
    implemented: true,
    safeToExposeToClient: true,
    bookTitlePreview: "Broken Book",
    chapterCount: 0,
    chapters: [],
    warnings: [],
  });
  const checklist = buildTextImportConfirmationChecklist(confirmation);

  assert.equal(confirmation.status, "blocked");
  assert.equal(confirmation.readyForFutureSave, false);
  assert.ok(confirmation.blockedReasons.length > 0);
  assert.equal(
    checklist.find((item) => item.label === "章节有效")?.value.includes("需要复核"),
    true,
  );
  assert.equal(
    checklist.find((item) => item.label === "危险字段检测")?.value,
    "未检测到危险字段",
  );
  assert.equal(confirmation.writesDatabase, false);
  assert.equal(confirmation.callsRepository, false);
});

test("validateTextImportConfirmationPreview reports missing and unsafe fields", () => {
  const validation = validateTextImportConfirmationPreview({
    previewOnly: false,
    implemented: true,
    safeToExposeToClient: true,
    bookTitlePreview: "token secret cookie DATABASE_URL api key authorization header",
    chapterCount: 1,
    chapters: [{ estimatedLineCount: 1 }],
    warnings: ["ok"],
    rawText: "should not be here",
  });

  assert.ok(validation.blockedReasons.length > 0);
  assert.equal(
    validation.blockedReasons.some((reason) => reason.includes("不安全的字段名")),
    true,
  );
  assert.equal(
    validation.blockedReasons.some((reason) => reason.includes("敏感标记")),
    true,
  );
});

test("createTextImportConfirmationPreview keeps dangerous values out of output objects", () => {
  const preview = buildTextImportPreview({
    title: "token secret cookie DATABASE_URL api key authorization header",
    rawText: `# token secret cookie DATABASE_URL api key authorization header
Authorization: Bearer abc123
cookie=visible
secret notes and token values`,
  });

  const confirmation = createTextImportConfirmationPreview(preview);
  const output = JSON.stringify(confirmation);

  assert.equal(output.includes("abc123"), false);
  assert.equal(output.includes("DATABASE_URL"), false);
  assert.equal(output.includes("authorization"), false);
  assert.equal(output.includes("api key"), false);
  assert.equal(output.includes("cookie"), false);
  assert.equal(output.includes("secret"), false);
  assert.equal(output.includes("token"), false);
  assert.equal(
    confirmation.warnings.includes("检测到危险字段，已阻断或脱敏，预览中不会显示原值。"),
    true,
  );
});

test("import confirmation UI source includes the draft copy and keeps save disabled", () => {
  const clientSource = readFileSync(join(currentDir, "TextImportPreviewClient.tsx"), "utf8");
  const confirmationSource = readFileSync(join(currentDir, "text-import-confirmation.ts"), "utf8");

  assert.equal(clientSource.includes("保存前确认草案"), true);
  assert.equal(clientSource.includes("确认清单"), true);
  assert.equal(clientSource.includes("阻断原因"), true);
  assert.equal(clientSource.includes("role=\"region\""), true);
  assert.equal(clientSource.includes("aria-labelledby=\"import-confirmation-title\""), true);
  assert.equal(clientSource.includes("@learning-agent-platform/db"), false);
  assert.equal(clientSource.includes("saveImportedPlainTextBookAction"), false);
  assert.equal(confirmationSource.includes("@learning-agent-platform/db"), false);
  assert.equal(confirmationSource.includes("saveImportedPlainTextBookAction"), false);
});
