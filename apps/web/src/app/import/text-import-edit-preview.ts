import type {
  TextImportChapterDisplayState,
  TextImportPreviewChapter,
  TextImportPreviewChapterEditDraft,
  TextImportPreviewResult,
} from "./text-import-preview";

export interface TextImportEditedPreviewChapter extends TextImportPreviewChapter {
  originalTitle: string;
  resolvedTitle: string;
  excluded: boolean;
  titleWasBlank: boolean;
}

export interface TextImportEditedPreviewSummary {
  previewOnly: true;
  implemented: true;
  safeToExposeToClient: true;
  saved: false;
  confirmationStatus: "ready" | "blocked";
  effectiveChapterCount: number;
  excludedChapterCount: number;
  estimatedTotalLines: number;
  chapters: TextImportEditedPreviewChapter[];
  warnings: string[];
}

export interface TextImportChapterEditHistoryState {
  chapterEdits: TextImportPreviewChapterEditDraft[];
  undoStack: TextImportPreviewChapterEditDraft[][];
  redoStack: TextImportPreviewChapterEditDraft[][];
}

export interface TextImportPreviewResetGateState {
  title: string;
  rawText: string;
  preview: TextImportPreviewResult | null;
  previewError: string | null;
  chapterEditHistory: TextImportChapterEditHistoryState;
  showAllChapters: boolean;
}

export type TextImportEditedPreviewAvailabilityKind =
  | "missing"
  | "blocked"
  | "ready";

export interface TextImportEditedPreviewAvailabilityState {
  kind: TextImportEditedPreviewAvailabilityKind;
  title: string;
  description: string;
}

export interface TextImportChapterEditEscapeState {
  restoredTitle: string;
  focusTarget: "chapterTitleInput";
}

const EMPTY_TITLE_FALLBACK_PREFIX = "未命名章节";
const EMPTY_TITLE_WARNING_PREFIX = "章节标题为空，已回退为";
const EXCLUDED_WARNING = "至少保留 1 个有效章节后才能继续确认。";
const DANGEROUS_FIELD_WARNING = "检测到危险字段，当前确认保持阻断。";
export const TEXT_IMPORT_CHAPTER_EDIT_TITLE_MAX_CHARS = 120;
export const TEXT_IMPORT_CHAPTER_EDIT_TITLE_PREVIEW_MAX_CHARS = 80;


export function createTextImportChapterEditDrafts(
  chapters: readonly TextImportPreviewChapter[],
): TextImportPreviewChapterEditDraft[] {
  return chapters.map((chapter) => ({
    title: normalizeTextImportChapterEditTitle(chapter.title),
    excluded: false,
  }));
}

export function createTextImportChapterEditHistoryState(
  chapters: readonly TextImportPreviewChapter[],
): TextImportChapterEditHistoryState {
  return {
    chapterEdits: createTextImportChapterEditDrafts(chapters),
    undoStack: [],
    redoStack: [],
  };
}

export function applyTextImportChapterEditChange(
  current: TextImportChapterEditHistoryState,
  nextChapterEdits: readonly TextImportPreviewChapterEditDraft[],
): TextImportChapterEditHistoryState {
  if (areTextImportChapterEditDraftsEqual(current.chapterEdits, nextChapterEdits)) {
    return current;
  }

  return {
    chapterEdits: cloneTextImportChapterEditDrafts(nextChapterEdits),
    undoStack: [...current.undoStack, cloneTextImportChapterEditDrafts(current.chapterEdits)],
    redoStack: [],
  };
}

export function undoTextImportChapterEditChange(
  current: TextImportChapterEditHistoryState,
): TextImportChapterEditHistoryState {
  if (current.undoStack.length === 0) {
    return current;
  }

  const previousEdits = current.undoStack[current.undoStack.length - 1];

  return {
    chapterEdits: cloneTextImportChapterEditDrafts(previousEdits),
    undoStack: current.undoStack.slice(0, -1),
    redoStack: [...current.redoStack, cloneTextImportChapterEditDrafts(current.chapterEdits)],
  };
}

export function redoTextImportChapterEditChange(
  current: TextImportChapterEditHistoryState,
): TextImportChapterEditHistoryState {
  if (current.redoStack.length === 0) {
    return current;
  }

  const nextEdits = current.redoStack[current.redoStack.length - 1];

  return {
    chapterEdits: cloneTextImportChapterEditDrafts(nextEdits),
    undoStack: [...current.undoStack, cloneTextImportChapterEditDrafts(current.chapterEdits)],
    redoStack: current.redoStack.slice(0, -1),
  };
}

export function buildTextImportEditedPreviewSummary(input: {
  chapters: readonly TextImportPreviewChapter[];
  edits: readonly TextImportPreviewChapterEditDraft[];
  warnings?: readonly string[];
  hasDangerousFields?: boolean;
}): TextImportEditedPreviewSummary {
  const chapters = input.chapters.map((chapter, index) =>
    buildEditedChapterPreview(chapter, input.edits[index]),
  );
  const effectiveChapters = chapters.filter((chapter) => chapter.excluded === false);
  const excludedChapterCount = chapters.length - effectiveChapters.length;
  const effectiveChapterCount = effectiveChapters.length;
  const warnings = dedupeStrings([
    ...(input.warnings ?? []),
    ...(effectiveChapterCount === 0 ? [EXCLUDED_WARNING] : []),
    ...(input.hasDangerousFields === true ? [DANGEROUS_FIELD_WARNING] : []),
    ...chapters
      .filter((chapter) => chapter.titleWasBlank)
      .map((chapter) => `${EMPTY_TITLE_WARNING_PREFIX} ${chapter.resolvedTitle}。`),
  ]);

  return {
    previewOnly: true,
    implemented: true,
    safeToExposeToClient: true,
    saved: false,
    confirmationStatus:
      effectiveChapterCount === 0 || input.hasDangerousFields === true ? "blocked" : "ready",
    effectiveChapterCount,
    excludedChapterCount,
    estimatedTotalLines: effectiveChapters.reduce(
      (total, chapter) => total + chapter.estimatedLineCount,
      0,
    ),
    chapters,
    warnings,
  };
}

export function buildTextImportEditedPreviewAvailabilityState(input: {
  preview: TextImportPreviewResult | null;
  summary: TextImportEditedPreviewSummary | null;
  chapterDisplayState: TextImportChapterDisplayState | null;
  previewError: string | null;
  validationErrors: readonly string[];
}): TextImportEditedPreviewAvailabilityState {
  if (input.previewError !== null) {
    return {
      kind: "blocked",
      title: "预览生成失败",
      description: "请先修复上方错误，再继续编辑章节草案。",
    };
  }

  if (input.validationErrors.length > 0) {
    return {
      kind: "blocked",
      title: "输入校验未通过",
      description: "上方表单当前有错误，章节编辑区暂不可用。",
    };
  }

  if (input.preview === null) {
    return {
      kind: "missing",
      title: "先生成预览",
      description: "填写书名和正文后生成预览，章节编辑区才会出现。",
    };
  }

  if (input.summary?.effectiveChapterCount === 0) {
    return {
      kind: "blocked",
      title: "当前没有可继续导入的有效章节",
      description: "请恢复至少 1 个章节后再继续确认。",
    };
  }

  if (input.chapterDisplayState !== null && input.chapterDisplayState.visibleChapters.length === 0) {
    return {
      kind: "blocked",
      title: "当前没有可显示的章节",
      description: "请重新生成预览或展开章节列表后再继续编辑。",
    };
  }

  if (input.summary?.confirmationStatus === "blocked") {
    return {
      kind: "blocked",
      title: "当前预览已被阻断",
      description: "请先处理上方提示，或恢复有效章节后再继续。",
    };
  }

  return {
    kind: "ready",
    title: "章节编辑可继续",
    description: "可以继续重命名、排除或恢复章节，所有操作仍然只会保留在本地预览中。",
  };
}

export function resolveTextImportChapterEditEscapeState(input: {
  currentTitle: string;
  safeTitleSnapshot: string | null | undefined;
}): TextImportChapterEditEscapeState {
  return {
    restoredTitle: normalizeTextImportChapterEditTitle(
      input.safeTitleSnapshot ?? input.currentTitle,
    ),
    focusTarget: "chapterTitleInput",
  };
}

export function buildTextImportEditedPreviewConfirmationInput(
  preview: TextImportPreviewResult,
  summary: TextImportEditedPreviewSummary,
): TextImportPreviewResult {
  return {
    ...preview,
    chapterCount: summary.effectiveChapterCount,
    chapters: summary.chapters
      .filter((chapter) => chapter.excluded === false)
      .map((chapter) => ({
        title: chapter.resolvedTitle,
        order: chapter.order,
        estimatedLineCount: chapter.estimatedLineCount,
        previewText: chapter.previewText,
      })),
    warnings: dedupeStrings([...(preview.warnings ?? []), ...summary.warnings]),
  };
}

export function isTextImportEditedPreviewDirty(
  preview: TextImportPreviewResult,
  edits: readonly TextImportPreviewChapterEditDraft[],
): boolean {
  if (preview.chapters.length !== edits.length) {
    return true;
  }

  return preview.chapters.some((chapter, index) => {
    const edit = edits[index];
    const normalizedChapterTitle = normalizeTextImportChapterEditTitle(chapter.title);
    const normalizedEditTitle = normalizeTextImportChapterEditTitle(edit?.title ?? "");

    return (
      edit === undefined ||
      edit.excluded === true ||
      normalizedChapterTitle !== normalizedEditTitle
    );
  });
}

export function hasTextImportEditedPreviewConflict(
  preview: TextImportPreviewResult,
  history: TextImportChapterEditHistoryState,
): boolean {
  return (
    isTextImportEditedPreviewDirty(preview, history.chapterEdits) ||
    history.undoStack.length > 0 ||
    history.redoStack.length > 0
  );
}

export function shouldPromptTextImportPreviewReset(
  input: TextImportPreviewResetGateState,
): boolean {
  return (
    input.title.trim().length > 0 ||
    input.rawText.trim().length > 0 ||
    input.preview !== null ||
    input.previewError !== null ||
    input.showAllChapters ||
    input.chapterEditHistory.chapterEdits.length > 0 ||
    input.chapterEditHistory.undoStack.length > 0 ||
    input.chapterEditHistory.redoStack.length > 0
  );
}

function buildEditedChapterPreview(
  chapter: TextImportPreviewChapter,
  edit?: TextImportPreviewChapterEditDraft,
): TextImportEditedPreviewChapter {
  const normalizedTitle = normalizeTextImportChapterEditTitle(edit?.title ?? "");
  const titleWasBlank = normalizedTitle.length === 0;
  const resolvedTitle = titleWasBlank
    ? `${EMPTY_TITLE_FALLBACK_PREFIX} ${chapter.order}`
    : truncatePreviewText(normalizedTitle, TEXT_IMPORT_CHAPTER_EDIT_TITLE_PREVIEW_MAX_CHARS);

  return {
    ...chapter,
    originalTitle: chapter.title,
    resolvedTitle,
    excluded: edit?.excluded === true,
    titleWasBlank,
    title: resolvedTitle,
  };
}

export function normalizeTextImportChapterEditTitle(text: string): string {
  return limitTextImportChapterEditTitle(normalizeSingleLinePreview(text));
}

function normalizeSingleLinePreview(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function cloneTextImportChapterEditDrafts(
  drafts: readonly TextImportPreviewChapterEditDraft[],
): TextImportPreviewChapterEditDraft[] {
  return drafts.map((draft) => ({
    title: draft.title,
    excluded: draft.excluded,
  }));
}

function areTextImportChapterEditDraftsEqual(
  left: readonly TextImportPreviewChapterEditDraft[],
  right: readonly TextImportPreviewChapterEditDraft[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((draft, index) => {
    const other = right[index];

    return other !== undefined && draft.title === other.title && draft.excluded === other.excluded;
  });
}

function truncatePreviewText(text: string, maxLength: number): string {
  const compactText = normalizeSingleLinePreview(text);

  if (compactText.length <= maxLength) {
    return compactText;
  }

  return `${compactText.slice(0, Math.max(0, maxLength - 3))}...`;
}

function limitTextImportChapterEditTitle(text: string): string {
  if (text.length <= TEXT_IMPORT_CHAPTER_EDIT_TITLE_MAX_CHARS) {
    return text;
  }

  return text.slice(0, TEXT_IMPORT_CHAPTER_EDIT_TITLE_MAX_CHARS);
}

function dedupeStrings(values: string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) === index);
}
