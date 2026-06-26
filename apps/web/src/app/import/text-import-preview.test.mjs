import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// @ts-expect-error TS5097: direct .ts import is used in existing node:test coverage.
import {
  buildTextImportChapterDisplayState,
  buildTextImportPreview,
  buildTextImportPreviewFieldErrorState,
  buildTextImportPreviewInputStats,
  buildTextImportPreviewStatusSummary,
  createTextImportPreviewExampleContent,
  createTextImportPreviewExampleState,
  createTextImportPreviewResetState,
  DEFAULT_TEXT_IMPORT_CHAPTER_PREVIEW_LIMIT,
  shouldActivateTextImportChapterToggle,
  validateTextImportPreviewInput,
} from "./text-import-preview.ts";
// @ts-expect-error TS5097: direct .ts import is used in existing node:test coverage.
import {
  BOOK_IMPORT_MAX_CONTENT_CHARS,
  BOOK_IMPORT_MIN_CONTENT_CHARS,
} from "./book-import-save-types.ts";

const currentDir = dirname(fileURLToPath(import.meta.url));

test("buildTextImportPreviewFieldErrorState maps empty title and body to the first error field", () => {
  const validation = validateTextImportPreviewInput({
    title: "   ",
    rawText: " \n\t ",
  });
  const fieldErrorState = buildTextImportPreviewFieldErrorState(validation.errors);

  assert.equal(fieldErrorState.titleError, "标题不能为空，请先填写书名。");
  assert.equal(fieldErrorState.rawTextError, "正文不能为空，请先粘贴纯文本内容。");
  assert.equal(fieldErrorState.firstErrorField, "title");
});

test("buildTextImportPreviewFieldErrorState keeps blank title optional when body has content", () => {
  const validation = validateTextImportPreviewInput({
    title: "   ",
    rawText: "# 第一章\n这里有正文内容",
  });
  const fieldErrorState = buildTextImportPreviewFieldErrorState(validation.errors);

  assert.equal(fieldErrorState.titleError, null);
  assert.equal(fieldErrorState.rawTextError, null);
  assert.equal(fieldErrorState.firstErrorField, null);
});

test("shouldActivateTextImportChapterToggle accepts Enter and Space", () => {
  assert.equal(shouldActivateTextImportChapterToggle({ key: "Enter" }), true);
  assert.equal(shouldActivateTextImportChapterToggle({ key: " " }), true);
  assert.equal(shouldActivateTextImportChapterToggle({ key: "Spacebar" }), true);
  assert.equal(shouldActivateTextImportChapterToggle({ key: "Escape" }), false);
});

test("buildTextImportPreview keeps Markdown and Chinese chapter headings working", () => {
  const markdownPreview = buildTextImportPreview({
    title: "Markdown 书籍",
    rawText: `# 前言
Alpha line

## 详情
Beta line`,
  });

  const chinesePreview = buildTextImportPreview({
    title: "中文书籍",
    rawText: `第 1 章 序章
第一段
第 2 章 继续
第二段`,
  });

  assert.equal(markdownPreview.previewOnly, true);
  assert.equal(markdownPreview.implemented, true);
  assert.equal(markdownPreview.safeToExposeToClient, true);
  assert.equal(markdownPreview.chapterCount, 2);
  assert.deepEqual(markdownPreview.chapters.map((chapter) => chapter.title), [
    "前言",
    "详情",
  ]);
  assert.equal(chinesePreview.chapterCount, 2);
  assert.deepEqual(chinesePreview.chapters.map((chapter) => chapter.title), [
    "第 1 章 序章",
    "第 2 章 继续",
  ]);
});

test("buildTextImportPreview falls back to a single Chinese chapter title when no headings exist", () => {
  const preview = buildTextImportPreview({
    title: "Plain Book",
    rawText: `第一段纯文本
第二段纯文本`,
  });

  assert.equal(preview.chapterCount, 1);
  assert.equal(preview.chapters[0].title, "第 1 章");
  assert.equal(
    preview.warnings.includes("未识别到支持的章节标题，已生成单章节预览。"),
    true,
  );
});

test("buildTextImportPreview keeps blank titles as a single chapter preview with a prompt", () => {
  const preview = buildTextImportPreview({
    title: "   ",
    rawText: `# 第一章 正文一

## 第二章 正文二`,
  });

  assert.equal(preview.chapterCount, 1);
  assert.equal(preview.chapters[0].title, "第 1 章");
  assert.equal(preview.bookTitlePreview, "未命名书籍");
  assert.equal(
    preview.warnings.includes("未填写书名，已使用默认标题并按单章预览处理。"),
    true,
  );
});

test("buildTextImportPreviewInputStats reports live character counts and dangerous-field state", () => {
  const safeStats = buildTextImportPreviewInputStats({
    title: "Live Stats",
    rawText: "one\ntwo",
  });
  const dangerousStats = buildTextImportPreviewInputStats({
    title: "Live Stats",
    rawText: "token = abc123",
  });

  assert.equal(safeStats.titleCharCount, 10);
  assert.equal(safeStats.rawTextCharCount, 7);
  assert.equal(safeStats.estimatedLineCount, 2);
  assert.equal(safeStats.hasDangerousFields, false);
  assert.equal(dangerousStats.hasDangerousFields, true);
  assert.equal(
    dangerousStats.warnings.includes("检测到危险字段，已阻断或脱敏，预览中不会显示原值。"),
    true,
  );
});

test("validateTextImportPreviewInput reports short and long body warnings", () => {
  const shortValidation = validateTextImportPreviewInput({
    title: "Short",
    rawText: "短文本",
  });
  const longValidation = validateTextImportPreviewInput({
    title: "Long",
    rawText: "a".repeat(BOOK_IMPORT_MAX_CONTENT_CHARS + 1),
  });

  assert.equal(
    shortValidation.warnings.some((warning) =>
      warning.includes(`少于 ${BOOK_IMPORT_MIN_CONTENT_CHARS}`),
    ),
    true,
  );
  assert.equal(
    longValidation.warnings.some((warning) =>
      warning.includes(`超过 ${BOOK_IMPORT_MAX_CONTENT_CHARS}`),
    ),
    true,
  );
});

test("buildTextImportChapterDisplayState collapses long chapter lists by default", () => {
  const preview = buildTextImportPreview({
    title: "章节折叠测试",
    rawText: Array.from({ length: DEFAULT_TEXT_IMPORT_CHAPTER_PREVIEW_LIMIT + 3 }, (_, index) =>
      `# Chapter ${index + 1}\n正文 ${index + 1}`,
    ).join("\n\n"),
  });

  const collapsed = buildTextImportChapterDisplayState(preview, {
    showAll: false,
    visibleLimit: DEFAULT_TEXT_IMPORT_CHAPTER_PREVIEW_LIMIT,
  });
  const expanded = buildTextImportChapterDisplayState(preview, {
    showAll: true,
    visibleLimit: DEFAULT_TEXT_IMPORT_CHAPTER_PREVIEW_LIMIT,
  });

  assert.equal(preview.chapterCount > DEFAULT_TEXT_IMPORT_CHAPTER_PREVIEW_LIMIT, true);
  assert.equal(collapsed.visibleChapters.length, DEFAULT_TEXT_IMPORT_CHAPTER_PREVIEW_LIMIT);
  assert.equal(collapsed.hiddenChapterCount > 0, true);
  assert.equal(expanded.visibleChapters.length, preview.chapterCount);
  assert.equal(expanded.hiddenChapterCount, 0);
});

test("buildTextImportPreview redacts sensitive markers from output objects", () => {
  const preview = buildTextImportPreview({
    title: "token secret cookie DATABASE_URL api key authorization header",
    rawText: `# token secret cookie DATABASE_URL api key authorization header
Authorization: Bearer abc123
cookie=visible
secret notes and token values`,
  });

  const output = JSON.stringify(preview);

  assert.equal(output.includes("abc123"), false);
  assert.equal(output.includes("DATABASE_URL"), false);
  assert.equal(output.includes("authorization"), false);
  assert.equal(output.includes("api key"), false);
  assert.equal(output.includes("cookie"), false);
  assert.equal(output.includes("secret"), false);
  assert.equal(output.includes("token"), false);
  assert.equal(
    preview.warnings.includes("检测到危险字段，已阻断或脱敏，预览中不会显示原值。"),
    true,
  );
});

test("createTextImportPreviewExampleContent returns a safe local sample that can split into multiple chapters", () => {
  const example = createTextImportPreviewExampleContent();
  const exampleState = createTextImportPreviewExampleState();
  const preview = buildTextImportPreview(exampleState);

  assert.equal(example.previewOnly, true);
  assert.equal(example.note, "仅本地示例，不会保存");

  assert.equal(example.rawText.includes("# 预览示例"), true);
  assert.equal(example.rawText.includes("第1章 本地切分"), true);
  assert.equal(example.rawText.includes("## Markdown 第二节"), true);
  assert.equal(example.rawText.includes("第2章 继续示例"), true);
  assert.equal(example.rawText.includes("DATABASE_URL"), false);
  assert.equal(example.rawText.includes("token"), false);
  assert.equal(preview.chapterCount >= 3, true);
  assert.equal(
    preview.warnings.some((warning) => warning.includes("危险") || warning.includes("脱敏")),
    false,
  );
});

test("createTextImportPreviewResetState clears the local preview interaction state", () => {
  const resetState = createTextImportPreviewResetState();

  assert.equal(resetState.title, "");
  assert.equal(resetState.rawText, "");
  assert.equal(resetState.preview, null);
  assert.deepEqual(resetState.chapterEdits, []);
  assert.deepEqual(resetState.validationErrors, []);
  assert.deepEqual(resetState.validationWarnings, []);
  assert.equal(resetState.previewError, null);
  assert.equal(resetState.showAllChapters, false);
  assert.equal(buildTextImportPreviewInputStats(resetState).hasDangerousFields, false);
});

test("createTextImportPreviewExampleState fills safe example text while keeping preview and errors reset", () => {
  const exampleState = createTextImportPreviewExampleState();

  assert.equal(exampleState.title, "本地示例：Markdown 与中文章节");
  assert.equal(exampleState.preview, null);
  assert.deepEqual(exampleState.chapterEdits, []);
  assert.deepEqual(exampleState.validationErrors, []);
  assert.deepEqual(exampleState.validationWarnings, []);
  assert.equal(exampleState.previewError, null);
  assert.equal(exampleState.showAllChapters, false);
});

test("buildTextImportPreviewStatusSummary reports preview-only local state without a saved semantic", () => {
  const example = createTextImportPreviewExampleState();
  const preview = buildTextImportPreview(example);
  const summary = buildTextImportPreviewStatusSummary({
    preview,
    confirmationStatus: "ready",
    hasDangerousFields: preview.warnings.some((warning) =>
      warning.includes("危险") || warning.includes("脱敏"),
    ),
  });

  assert.equal(summary.previewOnly, true);
  assert.equal(summary.writesDatabase, false);
  assert.equal(summary.saved, false);
  assert.equal(summary.confirmationStatus, "ready");
  assert.equal(summary.chapterCount, preview.chapterCount);
  assert.equal(summary.estimatedTotalLines, sumEstimatedLineCount(preview));
  assert.equal(summary.hasDangerousFields, false);
});

test("buildTextImportPreviewStatusSummary keeps dangerous fields blocked", () => {
  const example = createTextImportPreviewExampleState();
  const preview = buildTextImportPreview(example);
  const summary = buildTextImportPreviewStatusSummary({
    preview,
    confirmationStatus: "ready",
    hasDangerousFields: true,
  });

  assert.equal(summary.confirmationStatus, "blocked");
});

test("import preview route keeps preview-only and save-disabled boundaries", () => {
  const pageSource = readFileSync(join(currentDir, "page.tsx"), "utf8");
  const clientSource = readFileSync(join(currentDir, "TextImportPreviewClient.tsx"), "utf8");
  const previewSource = readFileSync(join(currentDir, "text-import-preview.ts"), "utf8");

  assert.equal(pageSource.includes("@learning-agent-platform/db"), false);
  assert.equal(pageSource.includes("saveImportedPlainTextBookAction"), false);
  assert.equal(clientSource.includes("@learning-agent-platform/db"), false);
  assert.equal(clientSource.includes("saveImportedPlainTextBookAction"), false);
  assert.equal(clientSource.includes("aria-describedby"), true);
  assert.equal(clientSource.includes("aria-live=\"polite\""), true);
  assert.equal(clientSource.includes("role=\"alert\""), true);
  assert.equal(clientSource.includes("role=\"status\""), true);
  assert.equal(clientSource.includes("aria-controls"), true);
  assert.equal(clientSource.includes("aria-expanded"), true);
  assert.equal(clientSource.includes("本地预览统计 / 未保存"), true);
  assert.equal(clientSource.includes("编辑草案 / 未保存"), true);
  assert.equal(clientSource.includes("当前没有可继续导入的有效章节"), true);
  assert.equal(clientSource.includes("当前没有可显示的章节"), true);
  assert.equal(clientSource.includes("编辑受限"), true);
  assert.equal(clientSource.includes("等待预览"), true);
  assert.equal(clientSource.includes("标题截断"), true);
  assert.equal(clientSource.includes("保存功能未连接 / 预览未入库"), true);
  assert.equal(clientSource.includes("chapterTitleInputRefs"), true);
  assert.equal(clientSource.includes("chapterSafeTitleSnapshotsRef"), true);
  assert.equal(clientSource.includes("resetButtonRef"), true);
  assert.equal(clientSource.includes("resetConfirmButtonRef"), true);
  assert.equal(clientSource.includes("Escape"), true);
  assert.equal(clientSource.includes("handleReset"), true);
  assert.equal(clientSource.includes("handleFillExample"), true);
  assert.equal(clientSource.includes("handleUndoChapterEdit"), true);
  assert.equal(clientSource.includes("handleRedoChapterEdit"), true);
  assert.equal(clientSource.includes("maxLength={TEXT_IMPORT_CHAPTER_EDIT_TITLE_MAX_CHARS}"), true);
  assert.equal(clientSource.includes("aria-label={`编辑第 ${chapter.order} 章标题"), true);
  assert.equal(clientSource.includes("aria-labelledby={`${chapterCardId}-heading`}"), true);
  assert.equal(clientSource.includes("确认重置当前本地预览？"), true);
  assert.equal(clientSource.includes("取消重置并保留当前本地预览草案"), true);
  assert.equal(clientSource.includes("当前状态仍然可以继续预览"), true);
  assert.equal(clientSource.includes("导入成功"), false);
  assert.equal(clientSource.includes("已保存"), false);
  assert.equal(previewSource.includes("@learning-agent-platform/db"), false);
});

function sumEstimatedLineCount(preview) {
  return preview.chapters.reduce((total, chapter) => total + chapter.estimatedLineCount, 0);
}
