import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error TS5097: direct .ts import is used in existing node:test coverage.
import { buildTextImportPreview } from "./text-import-preview.ts";
// @ts-expect-error TS5097: direct .ts import is used in existing node:test coverage.
import { createTextImportConfirmationPreview } from "./text-import-confirmation.ts";
// @ts-expect-error TS5097: direct .ts import is used in existing node:test coverage.
import {
  applyTextImportChapterEditChange,
  buildTextImportEditedPreviewAvailabilityState,
  buildTextImportEditedPreviewConfirmationInput,
  buildTextImportEditedPreviewSummary,
  createTextImportChapterEditDrafts,
  createTextImportChapterEditHistoryState,
  hasTextImportEditedPreviewConflict,
  isTextImportEditedPreviewDirty,
  normalizeTextImportChapterEditTitle,
  TEXT_IMPORT_CHAPTER_EDIT_TITLE_MAX_CHARS,
  redoTextImportChapterEditChange,
  resolveTextImportChapterEditEscapeState,
  shouldPromptTextImportPreviewReset,
  undoTextImportChapterEditChange,
} from "./text-import-edit-preview.ts";

test("buildTextImportEditedPreviewSummary applies renames, exclusions, and fallback titles", () => {
  const preview = buildTextImportPreview({
    title: "编辑草案测试",
    rawText: `# 第一章
第一章内容
# 第二章
第二章内容`,
  });
  const edits = createTextImportChapterEditDrafts(preview.chapters);

  edits[0] = { title: "  ", excluded: false };
  edits[1] = { title: "重命名的第二章", excluded: true };

  const summary = buildTextImportEditedPreviewSummary({
    chapters: preview.chapters,
    edits,
    warnings: preview.warnings,
  });

  assert.equal(summary.previewOnly, true);
  assert.equal(summary.implemented, true);
  assert.equal(summary.safeToExposeToClient, true);
  assert.equal(summary.saved, false);
  assert.equal(summary.confirmationStatus, "ready");
  assert.equal(
    summary.effectiveChapterCount,
    summary.chapters.filter((chapter) => chapter.excluded === false).length,
  );
  assert.equal(
    summary.excludedChapterCount,
    summary.chapters.filter((chapter) => chapter.excluded === true).length,
  );
  assert.equal(
    summary.effectiveChapterCount + summary.excludedChapterCount,
    summary.chapters.length,
  );
  assert.equal(summary.effectiveChapterCount < summary.chapters.length, true);
  assert.equal(
    summary.estimatedTotalLines,
    summary.chapters
      .filter((chapter) => chapter.excluded === false)
      .reduce((total, chapter) => total + chapter.estimatedLineCount, 0),
  );
  assert.equal(summary.chapters[0]?.resolvedTitle, "未命名章节 1");
  assert.equal(summary.chapters[1]?.resolvedTitle, "重命名的第二章");
  assert.equal(summary.chapters.some((chapter) => chapter.excluded === true), true);
  assert.equal(summary.warnings.some((warning) => warning.includes("回退为")), true);
});

test("buildTextImportEditedPreviewSummary blocks when every chapter is excluded", () => {
  const preview = buildTextImportPreview({
    title: "全部排除测试",
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

  assert.equal(summary.confirmationStatus, "blocked");
  assert.equal(summary.effectiveChapterCount, 0);
  assert.equal(summary.excludedChapterCount, 2);
  assert.equal(confirmation.status, "blocked");
  assert.equal(confirmation.chapterCount, 0);
  assert.equal(confirmation.readyForFutureSave, false);
  assert.equal(
    summary.warnings.some((warning) => warning.includes("有效章节")),
    true,
  );
  assert.equal(confirmation.blockedReasons.length > 0, true);
});

test("buildTextImportEditedPreviewSummary blocks when dangerous fields are detected", () => {
  const preview = buildTextImportPreview({
    title: "token secret cookie DATABASE_URL api key authorization header",
    rawText: `# token secret cookie DATABASE_URL api key authorization header
Authorization: Bearer abc123
cookie=visible`,
  });
  const summary = buildTextImportEditedPreviewSummary({
    chapters: preview.chapters,
    edits: createTextImportChapterEditDrafts(preview.chapters),
    warnings: preview.warnings,
    hasDangerousFields: true,
  });
  const output = JSON.stringify(summary);

  assert.equal(summary.confirmationStatus, "blocked");
  assert.equal(output.includes("abc123"), false);
  assert.equal(output.includes("DATABASE_URL"), false);
  assert.equal(output.includes("token"), false);
  assert.equal(output.includes("secret"), false);
  assert.equal(output.includes("cookie"), false);
  assert.equal(output.includes("authorization"), false);
  assert.equal(output.includes("api key"), false);
});

test("buildTextImportEditedPreviewConfirmationInput keeps the edited preview safe and filtered", () => {
  const preview = buildTextImportPreview({
    title: "安全过滤测试",
    rawText: `# 第一章
第一段
## 第二章
第二段`,
  });
  const edits = createTextImportChapterEditDrafts(preview.chapters);

  edits[1] = { title: "排除的章节", excluded: true };
  edits[0] = { title: "保留的章节", excluded: false };

  const summary = buildTextImportEditedPreviewSummary({
    chapters: preview.chapters,
    edits,
    warnings: preview.warnings,
  });
  const confirmationInput = buildTextImportEditedPreviewConfirmationInput(preview, summary);
  const confirmation = createTextImportConfirmationPreview(confirmationInput);
  const output = JSON.stringify({ summary, confirmationInput, confirmation });

  assert.equal(confirmationInput.chapterCount, 1);
  assert.deepEqual(confirmationInput.chapters.map((chapter) => chapter.title), [
    "保留的章节",
  ]);
  assert.equal(confirmation.status, "ready");
  assert.equal(output.includes("rawText"), false);
  assert.equal(output.includes("DATABASE_URL"), false);
  assert.equal(output.includes("token"), false);
});

test("chapter edit history supports rename undo and redo while keeping the dirty marker accurate", () => {
  const preview = buildTextImportPreview({
    title: "历史栈测试",
    rawText: `# 第一章
正文一

## 第二章
正文二`,
  });

  let history = createTextImportChapterEditHistoryState(preview.chapters);

  assert.equal(history.chapterEdits.length, preview.chapters.length);
  assert.equal(history.undoStack.length, 0);
  assert.equal(history.redoStack.length, 0);
  assert.equal(isTextImportEditedPreviewDirty(preview, history.chapterEdits), false);

  history = applyTextImportChapterEditChange(
    history,
    history.chapterEdits.map((draft, index) =>
      index === 0
        ? {
            ...draft,
            title: "重命名后的第一章",
          }
        : draft,
    ),
  );

  assert.equal(history.undoStack.length, 1);
  assert.equal(history.redoStack.length, 0);
  assert.equal(isTextImportEditedPreviewDirty(preview, history.chapterEdits), true);

  history = undoTextImportChapterEditChange(history);

  assert.equal(history.undoStack.length, 0);
  assert.equal(history.redoStack.length, 1);
  assert.equal(history.chapterEdits[0]?.title, preview.chapters[0]?.title);
  assert.equal(isTextImportEditedPreviewDirty(preview, history.chapterEdits), false);

  history = redoTextImportChapterEditChange(history);

  assert.equal(history.undoStack.length, 1);
  assert.equal(history.redoStack.length, 0);
  assert.equal(history.chapterEdits[0]?.title, "重命名后的第一章");
  assert.equal(isTextImportEditedPreviewDirty(preview, history.chapterEdits), true);
});

test("chapter edit history supports exclude undo and clears redo after a fresh edit", () => {
  const preview = buildTextImportPreview({
    title: "排除测试",
    rawText: `# 第一章
正文一

## 第二章
正文二`,
  });

  let history = createTextImportChapterEditHistoryState(preview.chapters);

  history = applyTextImportChapterEditChange(
    history,
    history.chapterEdits.map((draft, index) =>
      index === 1
        ? {
            ...draft,
            excluded: true,
          }
        : draft,
    ),
  );
  assert.equal(history.redoStack.length, 0);
  assert.equal(isTextImportEditedPreviewDirty(preview, history.chapterEdits), true);

  history = undoTextImportChapterEditChange(history);

  assert.equal(history.undoStack.length, 0);
  assert.equal(history.redoStack.length, 1);
  assert.equal(history.chapterEdits[1]?.excluded, false);
  assert.equal(isTextImportEditedPreviewDirty(preview, history.chapterEdits), false);

  history = applyTextImportChapterEditChange(
    history,
    history.chapterEdits.map((draft, index) =>
      index === 0
        ? {
            ...draft,
            title: "重新命名的第一章",
          }
        : draft,
    ),
  );

  assert.equal(history.redoStack.length, 0);
  assert.equal(history.undoStack.length, 1);
  assert.equal(isTextImportEditedPreviewDirty(preview, history.chapterEdits), true);
});

test("shouldPromptTextImportPreviewReset requires confirmation once draft or preview state exists", () => {
  const preview = buildTextImportPreview({
    title: "重置门禁测试",
    rawText: `# 第一章
正文一`,
  });

  assert.equal(
    shouldPromptTextImportPreviewReset({
      title: "",
      rawText: "",
      preview: null,
      previewError: null,
      chapterEditHistory: createTextImportChapterEditHistoryState([]),
      showAllChapters: false,
    }),
    false,
  );

  assert.equal(
    shouldPromptTextImportPreviewReset({
      title: "草案标题",
      rawText: "",
      preview: null,
      previewError: null,
      chapterEditHistory: createTextImportChapterEditHistoryState([]),
      showAllChapters: false,
    }),
    true,
  );

  assert.equal(
    shouldPromptTextImportPreviewReset({
      title: "",
      rawText: "",
      preview,
      previewError: null,
      chapterEditHistory: createTextImportChapterEditHistoryState(preview.chapters),
      showAllChapters: true,
    }),
    true,
  );
});


test("chapter edit titles are normalized and capped for safe previews", () => {
  const preview = buildTextImportPreview({
    title: "标题上限测试",
    rawText: `# ${"A".repeat(200)}\n正文`,
  });

  const drafts = createTextImportChapterEditDrafts(preview.chapters);
  const summary = buildTextImportEditedPreviewSummary({
    chapters: preview.chapters,
    edits: drafts,
    warnings: preview.warnings,
  });

  assert.equal(drafts[0]?.title.length <= 80, true);
  assert.equal(normalizeTextImportChapterEditTitle("B".repeat(200)).length, TEXT_IMPORT_CHAPTER_EDIT_TITLE_MAX_CHARS);
  assert.equal(summary.chapters[0]?.resolvedTitle.length <= 80, true);
  assert.equal(summary.chapters[0]?.resolvedTitle.includes("A".repeat(120)), false);
});

test("chapter edit history keeps conflict state when undo history remains after reverting", () => {
  const preview = buildTextImportPreview({
    title: "复杂状态测试",
    rawText: `# 第一章
正文一

## 第二章
正文二`,
  });

  let history = createTextImportChapterEditHistoryState(preview.chapters);

  history = applyTextImportChapterEditChange(
    history,
    history.chapterEdits.map((draft, index) =>
      index === 0
        ? {
            ...draft,
            title: "重命名后的第一章",
          }
        : draft,
    ),
  );
  history = undoTextImportChapterEditChange(history);

  assert.equal(isTextImportEditedPreviewDirty(preview, history.chapterEdits), false);
  assert.equal(hasTextImportEditedPreviewConflict(preview, history), true);
  assert.equal(history.undoStack.length, 0);
  assert.equal(history.redoStack.length > 0, true);
});

test("buildTextImportEditedPreviewAvailabilityState distinguishes missing, blocked, and ready states", () => {
  const preview = buildTextImportPreview({
    title: "可用预览",
    rawText: `# 第一章\n正文`,
  });
  const summary = buildTextImportEditedPreviewSummary({
    chapters: preview.chapters,
    edits: createTextImportChapterEditDrafts(preview.chapters),
    warnings: preview.warnings,
  });

  const missingState = buildTextImportEditedPreviewAvailabilityState({
    preview: null,
    summary: null,
    chapterDisplayState: null,
    previewError: null,
    validationErrors: [],
  });
  const blockedState = buildTextImportEditedPreviewAvailabilityState({
    preview,
    summary: {
      ...summary,
      effectiveChapterCount: 0,
      confirmationStatus: "blocked",
    },
    chapterDisplayState: null,
    previewError: null,
    validationErrors: [],
  });
  const readyState = buildTextImportEditedPreviewAvailabilityState({
    preview,
    summary,
    chapterDisplayState: {
      visibleChapters: preview.chapters,
      hiddenChapterCount: 0,
      visibleLimit: 4,
      expanded: true,
    },
    previewError: null,
    validationErrors: [],
  });

  assert.equal(missingState.kind, "missing");
  assert.equal(missingState.title.includes("先生成预览"), true);
  assert.equal(blockedState.kind, "blocked");
  assert.equal(blockedState.title.includes("有效章节"), true);
  assert.equal(readyState.kind, "ready");
  assert.equal(readyState.title.includes("可继续"), true);
});

test("resolveTextImportChapterEditEscapeState restores the safe snapshot for Escape", () => {
  const restored = resolveTextImportChapterEditEscapeState({
    currentTitle: "当前编辑中的标题",
    safeTitleSnapshot: "  安全标题  ",
  });

  assert.equal(restored.restoredTitle, "安全标题");
  assert.equal(restored.focusTarget, "chapterTitleInput");

  const fallback = resolveTextImportChapterEditEscapeState({
    currentTitle: "当前编辑中的标题",
    safeTitleSnapshot: null,
  });

  assert.equal(fallback.restoredTitle, "当前编辑中的标题");
});
