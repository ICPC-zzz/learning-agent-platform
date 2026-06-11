"use client";

import {
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";

import {
  buildTextImportChapterDisplayState,
  buildTextImportPreview,
  buildTextImportPreviewFieldErrorState,
  buildTextImportPreviewInputStats,
  createTextImportPreviewExampleState,
  createTextImportPreviewResetState,
  DEFAULT_TEXT_IMPORT_CHAPTER_PREVIEW_LIMIT,
  type TextImportPreviewFieldName,
  type TextImportPreviewResult,
} from "./text-import-preview";
import {
  buildTextImportConfirmationChecklist,
  createBlockedTextImportConfirmationPreview,
  createTextImportConfirmationPreview,
} from "./text-import-confirmation";
import {
  applyTextImportChapterEditChange,
  buildTextImportEditedPreviewAvailabilityState,
  buildTextImportEditedPreviewConfirmationInput,
  buildTextImportEditedPreviewSummary,
  createTextImportChapterEditHistoryState,
  hasTextImportEditedPreviewConflict,
  normalizeTextImportChapterEditTitle,
  redoTextImportChapterEditChange,
  resolveTextImportChapterEditEscapeState,
  shouldPromptTextImportPreviewReset,
  TEXT_IMPORT_CHAPTER_EDIT_TITLE_MAX_CHARS,
  undoTextImportChapterEditChange,
} from "./text-import-edit-preview";
import { createTextImportSaveRequestPreview } from "./text-import-save-request";
import type { TextImportSaveDevGuardResult } from "./text-import-save-dev-guard";
import type { ImportDbPersistGuardResult } from "./text-import-db-persist-guard";
import {
  saveTextImportDevServerAction,
  type TextImportSaveDevServerActionResult,
} from "./text-import-save-dev-server-action";

const inputStyle = {
  width: "100%",
  minHeight: "42px",
  border: "1px solid #d8dee8",
  borderRadius: "8px",
  color: "#1c2430",
  font: "inherit",
  padding: "10px 12px",
} as const;

const textareaStyle = {
  ...inputStyle,
  minHeight: "180px",
  resize: "vertical",
} as const;

const buttonRowStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: "12px",
  alignItems: "center",
  marginTop: "18px",
} as const;

const noticeStyle = {
  marginTop: "18px",
  border: "1px solid #e1d7c8",
  borderRadius: "12px",
  padding: "14px 16px",
  background: "#fffaf3",
} as const;

const blockedNoticeStyle = {
  ...noticeStyle,
  borderColor: "#e6c5b6",
  background: "#fff6f0",
} as const;

const noticeBadgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: "999px",
  padding: "4px 10px",
  fontSize: "12px",
  fontWeight: 700,
  letterSpacing: "0.02em",
  color: "#fff",
  background: "#5e6f5f",
} as const;

const blockedBadgeStyle = {
  ...noticeBadgeStyle,
  background: "#8a452d",
} as const;

const greenBadgeStyle = {
  ...noticeBadgeStyle,
  background: "#2d6a4f",
} as const;

const SAVE_REQUEST_CONTRACT_COPY =
  "保存请求合同已就绪，但真实保存仍未连接。";
const SAVE_REQUEST_CONTRACT_DETAIL_COPY =
  "现在仍然保持 preview-only / no-op 边界，保存按钮依然处于 disabled 状态，且必须先经显式确认。";

export interface TextImportPreviewClientProps {
  /** Guard result from server-side check. Safe to expose to client. */
  devGuard: TextImportSaveDevGuardResult;
  /** DB persist guard result from server-side check. Safe to expose to client. */
  dbPersistGuard: ImportDbPersistGuardResult;
}

export function TextImportPreviewClient({ devGuard, dbPersistGuard }: TextImportPreviewClientProps) {
  const formId = useId();
  const titleInputRef = useRef<HTMLInputElement>(null);
  const rawTextInputRef = useRef<HTMLTextAreaElement>(null);
  const resetButtonRef = useRef<HTMLButtonElement>(null);
  const resetConfirmButtonRef = useRef<HTMLButtonElement>(null);
  const chapterTitleInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const chapterSafeTitleSnapshotsRef = useRef<Record<number, string>>({});

  const [title, setTitle] = useState("");
  const [rawText, setRawText] = useState("");
  const [preview, setPreview] = useState<TextImportPreviewResult | null>(null);
  const [chapterEditHistory, setChapterEditHistory] = useState(() =>
    createTextImportChapterEditHistoryState([]),
  );
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [showAllChapters, setShowAllChapters] = useState(false);
  const [resetConfirmationOpen, setResetConfirmationOpen] = useState(false);
  const [userExplicitlyConfirmed, setUserExplicitlyConfirmed] = useState(false);
  const [devSaveState, setDevSaveState] = useState<TextImportSaveDevServerActionResult | null>(null);
  const [devSavePending, setDevSavePending] = useState(false);

  const inputStats = buildTextImportPreviewInputStats({ title, rawText });
  const fieldErrorState = buildTextImportPreviewFieldErrorState(inputStats.errors);
  const chapterDisplayState =
    preview === null
      ? null
      : buildTextImportChapterDisplayState(preview, {
          showAll: showAllChapters,
          visibleLimit: DEFAULT_TEXT_IMPORT_CHAPTER_PREVIEW_LIMIT,
        });
  const editedPreviewSummary =
    preview === null
      ? null
      : buildTextImportEditedPreviewSummary({
          chapters: preview.chapters,
          edits: chapterEditHistory.chapterEdits,
          warnings: preview.warnings,
          hasDangerousFields: inputStats.hasDangerousFields,
        });
  const editedPreviewConfirmationInput =
    preview === null || editedPreviewSummary === null
      ? null
      : buildTextImportEditedPreviewConfirmationInput(preview, editedPreviewSummary);
  const editedPreviewConfirmationStatus =
    editedPreviewSummary?.confirmationStatus ?? "blocked";
  const editedPreviewWarnings = editedPreviewSummary?.warnings ?? [];
  const confirmation =
    editedPreviewConfirmationInput === null
      ? null
      : editedPreviewConfirmationStatus === "blocked"
        ? createBlockedTextImportConfirmationPreview(
            editedPreviewConfirmationInput,
            editedPreviewWarnings.length > 0
              ? editedPreviewWarnings
              : ["当前编辑草案被阻断，暂时不能进入继续确认。"],
            editedPreviewWarnings,
          )
        : createTextImportConfirmationPreview(editedPreviewConfirmationInput);
  const availabilityState = buildTextImportEditedPreviewAvailabilityState({
    preview,
    summary: editedPreviewSummary,
    chapterDisplayState,
    previewError,
    validationErrors: inputStats.errors,
  });
  const hasEditedPreviewConflict =
    preview !== null && hasTextImportEditedPreviewConflict(preview, chapterEditHistory);
  const hasLongChapterTitles =
    preview !== null &&
    chapterEditHistory.chapterEdits.some(
      (chapterEdit) =>
        normalizeTextImportChapterEditTitle(chapterEdit.title).length >=
        TEXT_IMPORT_CHAPTER_EDIT_TITLE_MAX_CHARS,
    );
  const shouldConfirmReset = shouldPromptTextImportPreviewReset({
    title,
    rawText,
    preview,
    previewError,
    chapterEditHistory,
    showAllChapters,
  });
  const combinedWarnings = dedupeStrings([
    ...inputStats.warnings,
    ...(preview?.warnings ?? []),
    ...(editedPreviewSummary?.warnings ?? []),
  ]);
  const saveRequestPreview =
    preview === null ||
    editedPreviewSummary === null ||
    confirmation === null ||
    editedPreviewConfirmationInput === null
      ? null
      : createTextImportSaveRequestPreview({
          preview: editedPreviewConfirmationInput,
          confirmation,
          summary: editedPreviewSummary,
          userExplicitlyConfirmed,
        });
  const canToggleChapterList =
    preview !== null && preview.chapterCount > DEFAULT_TEXT_IMPORT_CHAPTER_PREVIEW_LIMIT;

  const canDevSave =
    devGuard.devSaveEnabled &&
    saveRequestPreview !== null &&
    saveRequestPreview.saveReady &&
    saveRequestPreview.userExplicitlyConfirmed &&
    userExplicitlyConfirmed;

  const titleInputId = `${formId}-title`;
  const titleHelpId = `${formId}-title-help`;
  const titleErrorId = `${formId}-title-error`;
  const rawTextInputId = `${formId}-raw-text`;
  const rawTextHelpId = `${formId}-raw-text-help`;
  const rawTextErrorId = `${formId}-raw-text-error`;
  const chapterListId = `${formId}-chapter-list`;
  const resetConfirmTitleId = `${formId}-reset-confirmation-title`;

  function scheduleFocus(getElement: () => HTMLElement | null) {
    const focus = () => {
      getElement()?.focus();
    };

    if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
      focus();
      return;
    }

    window.requestAnimationFrame(focus);
  }

  function clearChapterSafeTitleSnapshots() {
    chapterSafeTitleSnapshotsRef.current = {};
  }

  function seedChapterSafeTitleSnapshots(chapters: TextImportPreviewResult["chapters"]) {
    chapterSafeTitleSnapshotsRef.current = Object.fromEntries(
      chapters.map((chapter) => [
        chapter.order,
        normalizeTextImportChapterEditTitle(chapter.title),
      ]),
    );
  }

  function preserveCurrentFocus() {
    if (typeof document === "undefined") {
      return;
    }

    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && activeElement !== document.body) {
      scheduleFocus(() => activeElement);
    }
  }

  function invalidatePreviewDraft() {
    if (
      preview !== null ||
      previewError !== null ||
      showAllChapters ||
      resetConfirmationOpen ||
      chapterEditHistory.undoStack.length > 0 ||
      chapterEditHistory.redoStack.length > 0
    ) {
      setPreview(null);
      setChapterEditHistory(createTextImportChapterEditHistoryState([]));
      setPreviewError(null);
      setShowAllChapters(false);
      setResetConfirmationOpen(false);
      setUserExplicitlyConfirmed(false);
      clearChapterSafeTitleSnapshots();
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setPreviewError(null);
    setResetConfirmationOpen(false);
    setUserExplicitlyConfirmed(false);
    clearChapterSafeTitleSnapshots();

    if (inputStats.errors.length > 0) {
      setPreview(null);
      setChapterEditHistory(createTextImportChapterEditHistoryState([]));
      setShowAllChapters(false);
      focusFirstInvalidField(fieldErrorState.firstErrorField ?? "rawText", {
        titleInputRef,
        rawTextInputRef,
      });
      return;
    }

    try {
      const nextPreview = buildTextImportPreview({ title, rawText });

      setPreview(nextPreview);
      setChapterEditHistory(createTextImportChapterEditHistoryState(nextPreview.chapters));
      setShowAllChapters(false);
      seedChapterSafeTitleSnapshots(nextPreview.chapters);
    } catch (caughtError) {
      setPreview(null);
      setChapterEditHistory(createTextImportChapterEditHistoryState([]));
      setShowAllChapters(false);
      clearChapterSafeTitleSnapshots();
      setPreviewError(
        caughtError instanceof Error
          ? caughtError.message
          : "导入预览生成失败，原因未知。",
      );
    }
  }

  function handleTitleChange(event: ChangeEvent<HTMLInputElement>) {
    setTitle(event.currentTarget.value);
    setResetConfirmationOpen(false);
    invalidatePreviewDraft();
  }

  function handleRawTextChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setRawText(event.currentTarget.value);
    setResetConfirmationOpen(false);
    invalidatePreviewDraft();
  }

  function performReset() {
    const resetState = createTextImportPreviewResetState();

    setTitle(resetState.title);
    setRawText(resetState.rawText);
    setPreview(resetState.preview);
    setPreviewError(resetState.previewError);
    setShowAllChapters(resetState.showAllChapters);
    setChapterEditHistory(createTextImportChapterEditHistoryState([]));
    setResetConfirmationOpen(false);
    setUserExplicitlyConfirmed(false);
    clearChapterSafeTitleSnapshots();
    scheduleFocus(() => titleInputRef.current);
  }

  function handleFillExample() {
    const exampleState = createTextImportPreviewExampleState();

    setTitle(exampleState.title);
    setRawText(exampleState.rawText);
    setPreview(exampleState.preview);
    setPreviewError(exampleState.previewError);
    setShowAllChapters(exampleState.showAllChapters);
    setChapterEditHistory(createTextImportChapterEditHistoryState([]));
    setResetConfirmationOpen(false);
    setUserExplicitlyConfirmed(false);
    clearChapterSafeTitleSnapshots();
    scheduleFocus(() => titleInputRef.current);
  }

  function handleReset() {
    if (shouldConfirmReset) {
      setResetConfirmationOpen(true);
      scheduleFocus(() => resetConfirmButtonRef.current);
      return;
    }

    performReset();
  }

  function handleResetConfirmationCancel() {
    setResetConfirmationOpen(false);
    scheduleFocus(() => resetButtonRef.current);
  }

  function handleResetConfirmationConfirm() {
    performReset();
  }

  function handleChapterTitleChange(chapterOrder: number, value: string) {
    setChapterEditHistory((current) =>
      applyTextImportChapterEditChange(
        current,
        current.chapterEdits.map((chapterEdit, index) =>
          index + 1 === chapterOrder
            ? {
                ...chapterEdit,
                title: normalizeTextImportChapterEditTitle(value),
              }
            : chapterEdit,
        ),
      ),
    );
    setUserExplicitlyConfirmed(false);
  }

  function handleChapterTitleFocus(chapterOrder: number, value: string) {
    chapterSafeTitleSnapshotsRef.current[chapterOrder] =
      normalizeTextImportChapterEditTitle(value);
  }

  function handleChapterTitleKeyDown(
    chapterOrder: number,
    event: KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key !== "Escape") {
      return;
    }

    event.preventDefault();

    const currentTitle = chapterEditHistory.chapterEdits[chapterOrder - 1]?.title ?? "";
    const restoredTitle = resolveTextImportChapterEditEscapeState({
      currentTitle,
      safeTitleSnapshot: chapterSafeTitleSnapshotsRef.current[chapterOrder],
    }).restoredTitle;

    setChapterEditHistory((current) =>
      applyTextImportChapterEditChange(
        current,
        current.chapterEdits.map((chapterEdit, index) =>
          index + 1 === chapterOrder
            ? {
                ...chapterEdit,
                title: restoredTitle,
              }
            : chapterEdit,
        ),
      ),
    );

    scheduleFocus(() => chapterTitleInputRefs.current[chapterOrder]);
  }

  function handleChapterExcludedToggle(chapterOrder: number) {
    setChapterEditHistory((current) =>
      applyTextImportChapterEditChange(
        current,
        current.chapterEdits.map((chapterEdit, index) =>
          index + 1 === chapterOrder
            ? {
                ...chapterEdit,
                excluded: !chapterEdit.excluded,
              }
            : chapterEdit,
        ),
      ),
    );
    setUserExplicitlyConfirmed(false);
  }

  function handleUndoChapterEdit() {
    setChapterEditHistory((current) => undoTextImportChapterEditChange(current));
    preserveCurrentFocus();
  }

  function handleRedoChapterEdit() {
    setChapterEditHistory((current) => redoTextImportChapterEditChange(current));
    preserveCurrentFocus();
  }

  function handleToggleUserConfirmation() {
    setUserExplicitlyConfirmed((current) => !current);
  }

  async function handleDevSave() {
    if (!canDevSave || saveRequestPreview === null || devSavePending) {
      return;
    }

    setDevSavePending(true);
    try {
      const result = await saveTextImportDevServerAction(null, saveRequestPreview);
      setDevSaveState(result);
    } catch (error) {
      setDevSaveState({
        success: false,
        previewOnly: true,
        implemented: true,
        safeToExposeToClient: true,
        reasonCode: "save-error",
        writesDatabase: false,
        callsRepository: false,
        usesDevStore: false,
        message: error instanceof Error ? error.message : "保存过程发生未知错误。",
        bookId: null,
        chapterIds: [],
        chapterCount: 0,
        dbPersistGuard,
        usedDbPersist: false,
      });
    } finally {
      setDevSavePending(false);
    }
  }

  return (
    <div className="dashboardGrid">
      <section className="learningPanel askAiPanel" aria-labelledby="import-preview-form-title">
        <p className="eyebrow">导入预览 / 仅预览</p>
        <h2 id="import-preview-form-title">纯文本书籍导入</h2>
        <p className="panelNote">
          这里只生成本地预览，不保存原文，不写入数据库，不接入大模型，也不处理 PDF、EPUB 或 URL。
        </p>

        <form className="askAiForm" noValidate onSubmit={handleSubmit}>
          <label htmlFor={titleInputId} className="readerNoteDraftTitle">
            书名
          </label>
          <p id={titleHelpId} className="panelNote">
            可以留空；留空时会按单章节预览处理。预览阶段只用于检查切分结果，不会进入保存流程。
          </p>
          <input
            ref={titleInputRef}
            id={titleInputId}
            aria-describedby={joinDescribedByIds(
              titleHelpId,
              fieldErrorState.titleError !== null ? titleErrorId : null,
            )}
            aria-invalid={fieldErrorState.titleError !== null ? "true" : undefined}
            onChange={handleTitleChange}
            placeholder="例如：TypeScript 入门"
            style={inputStyle}
            type="text"
            value={title}
          />
          {fieldErrorState.titleError !== null ? (
            <p id={titleErrorId} className="formFieldError" role="alert">
              {fieldErrorState.titleError}
            </p>
          ) : null}

          <label htmlFor={rawTextInputId} className="readerNoteDraftTitle">
            纯文本内容
          </label>
          <p id={rawTextHelpId} className="panelNote">
            粘贴 Markdown 标题、中文章节标题或普通纯文本内容即可。敏感字段会被脱敏，不会暴露原值。
          </p>
          <textarea
            ref={rawTextInputRef}
            id={rawTextInputId}
            aria-describedby={joinDescribedByIds(
              rawTextHelpId,
              fieldErrorState.rawTextError !== null ? rawTextErrorId : null,
            )}
            aria-invalid={fieldErrorState.rawTextError !== null ? "true" : undefined}
            onChange={handleRawTextChange}
            placeholder="粘贴 Markdown 标题、中文章节标题或普通纯文本内容。"
            style={textareaStyle}
            value={rawText}
          />
          {fieldErrorState.rawTextError !== null ? (
            <p id={rawTextErrorId} className="formFieldError" role="alert">
              {fieldErrorState.rawTextError}
            </p>
          ) : null}

          <div style={buttonRowStyle}>
            <button type="submit">生成导入预览</button>
            <button
              aria-label="填充本地安全示例文本，仅本地示例，不会保存"
              onClick={handleFillExample}
              title="仅本地示例，不会保存"
              type="button"
            >
              填充示例文本
            </button>
            <button
              aria-label="撤销最近一次章节草案编辑，仅影响本地预览"
              disabled={chapterEditHistory.undoStack.length === 0}
              onClick={handleUndoChapterEdit}
              title="撤销最近一次章节草案编辑"
              type="button"
            >
              撤销
            </button>
            <button
              aria-label="重做最近一次章节草案编辑，仅影响本地预览"
              disabled={chapterEditHistory.redoStack.length === 0}
              onClick={handleRedoChapterEdit}
              title="重做最近一次撤销"
              type="button"
            >
              重做
            </button>
            <button
              ref={resetButtonRef}
              aria-label="重置导入表单并清空本地预览草案"
              onClick={handleReset}
              title="清空输入、预览和本地草案"
              type="button"
            >
              重置表单
            </button>
            {!devGuard.devSaveEnabled ? (
              <button
                disabled
                type="button"
                title="保存功能未连接 / 预览未入库"
              >
                保存功能未连接 / 预览未入库
              </button>
            ) : null}
          </div>

          {saveRequestPreview !== null && !devGuard.devSaveEnabled ? (
            <div
              aria-live="polite"
              className="learningDataSourceNotice learningDataSourceNoticeFallback"
              role="status"
              style={{ marginTop: "12px" }}
            >
              <span className="learningDataSourceBadge">保存请求合同</span>
              <p>{SAVE_REQUEST_CONTRACT_COPY}</p>
              <p className="panelNote" style={{ marginTop: "6px" }}>
                {SAVE_REQUEST_CONTRACT_DETAIL_COPY}
              </p>
              {dbPersistGuard.blockedReasons.length > 0 ? (
                <p className="panelNote" style={{ marginTop: "6px" }}>
                  DB 持久化也未启用。需要同时设置 LAP_IMPORT_DB_PERSIST_DEV_ENABLED=true、
                  LAP_ALLOW_REAL_DB_INTEGRATION=true 并配置 DATABASE_URL。
                </p>
              ) : null}
            </div>
          ) : null}

          {devGuard.devSaveEnabled ? (
            <div
              className="learningDataSourceNotice"
              role="status"
              style={{ marginTop: "12px", borderColor: "#b7e4c7", background: "#f0faf3" }}
            >
              <span className="learningDataSourceBadge" style={greenBadgeStyle}>
                开发/测试保存路径已启用
              </span>
              <p className="panelNote" style={{ marginTop: "6px" }}>
                {devGuard.reason}
              </p>
            </div>
          ) : null}

          {resetConfirmationOpen ? (
            <div
              aria-labelledby={resetConfirmTitleId}
              className="warningBlock"
              role="alert"
              style={{ marginTop: "12px" }}
            >
              <h3 id={resetConfirmTitleId}>确认重置当前本地预览？</h3>
              <p>
                这会清空标题、正文、预览、确认草案、编辑草案、危险字段提示以及撤销 / 重做历史。
              </p>
              <div style={buttonRowStyle}>
                <button
                  ref={resetConfirmButtonRef}
                  aria-label="确认重置当前本地预览草案"
                  onClick={handleResetConfirmationConfirm}
                  type="button"
                >
                  确认重置
                </button>
                <button
                  aria-label="取消重置并保留当前本地预览草案"
                  onClick={handleResetConfirmationCancel}
                  type="button"
                >
                  取消
                </button>
              </div>
            </div>
          ) : null}

          <p className="panelNote" style={{ marginTop: "8px" }}>
            当前始终仅是本地示例，不会保存。
          </p>
        </form>

        <div
          aria-live="polite"
          className="learningDataSourceNotice learningDataSourceNoticeFallback"
          role="status"
          style={{ marginTop: "18px" }}
        >
          <span className="learningDataSourceBadge">本地预览统计 / 未保存</span>
          <p>统计只存在于当前组件状态，不会保存到本地存储，也不会进入数据库。</p>
          <dl className="scoreMeta" style={{ marginTop: "12px" }}>
            <PreviewSummaryRow label="标题字符数" value={inputStats.titleCharCount} />
            <PreviewSummaryRow label="正文字符数" value={inputStats.rawTextCharCount} />
            <PreviewSummaryRow label="估算行数" value={inputStats.estimatedLineCount} />
            <PreviewSummaryRow
              label="危险字段"
              value={inputStats.hasDangerousFields ? "已检测到并脱敏" : "未检测到危险字段"}
            />
          </dl>
          {inputStats.warnings.length > 0 ? (
            <ul style={{ marginTop: "12px" }}>
              {inputStats.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
        </div>

        {inputStats.errors.length > 0 || previewError !== null ? (
          <div aria-live="assertive" className="learningEmptyState" role="alert">
            <strong>{inputStats.errors.length > 0 ? "表单校验未通过" : "预览生成失败"}</strong>
            {inputStats.errors.length > 0 ? (
              <ul>
                {inputStats.errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            ) : null}
            {previewError !== null ? <p>{previewError}</p> : null}
          </div>
        ) : null}
      </section>

      <section
        className="learningPanel recommendationPanel"
        aria-labelledby="import-preview-result-title"
      >
        <div className="learningDataSourceNotice learningDataSourceNoticeFallback">
          <span className="learningDataSourceBadge">未保存</span>
          <p>
            预览结果只用于确认章节切分和安全提示，当前不会写入数据库，也不会触发保存接口。
          </p>
        </div>

        {availabilityState.kind !== "ready" ? (
          <div
            aria-live="polite"
            className="learningDataSourceNotice learningDataSourceNoticeFallback"
            role={availabilityState.kind === "blocked" ? "alert" : "status"}
            style={availabilityState.kind === "blocked" ? blockedNoticeStyle : noticeStyle}
          >
            <span
              className="learningDataSourceBadge"
              style={availabilityState.kind === "blocked" ? blockedBadgeStyle : noticeBadgeStyle}
            >
              {availabilityState.kind === "blocked" ? "编辑受限" : "等待预览"}
            </span>
            <p style={{ marginTop: "10px", fontWeight: 600 }}>{availabilityState.title}</p>
            <p className="panelNote" style={{ marginTop: "6px" }}>
              {availabilityState.description}
            </p>
          </div>
        ) : null}

        {preview === null ? (
          <p className="learningEmptyState">
            先在上方填写书名和正文并生成预览，章节编辑区才会出现。当前仍然只是在本地预览，不会保存，也不会进入数据库。
          </p>
        ) : (
          <div aria-live="polite">
            {editedPreviewSummary !== null ? (
              <div
                aria-label="编辑草案状态摘要"
                className="learningDataSourceNotice learningDataSourceNoticeFallback"
                role="status"
                style={{ marginTop: "18px" }}
              >
                <span className="learningDataSourceBadge">编辑草案 / 未保存</span>
                <p>这只是本地编辑草案，不会保存到数据库，也不会进入真实导入流程。</p>
                <dl className="scoreMeta" style={{ marginTop: "12px" }}>
                  <PreviewSummaryRow
                    label="有效章节数"
                    value={editedPreviewSummary.effectiveChapterCount}
                  />
                  <PreviewSummaryRow
                    label="已排除章节数"
                    value={editedPreviewSummary.excludedChapterCount}
                  />
                  <PreviewSummaryRow
                    label="估算总行数"
                    value={editedPreviewSummary.estimatedTotalLines}
                  />
                  <PreviewSummaryRow
                    label="确认状态"
                    value={editedPreviewSummary.confirmationStatus}
                  />
                  <PreviewSummaryRow label="入库状态" value="未入库" />
                  <PreviewSummaryRow label="状态说明" value="仅预览，未入库" />
                </dl>
              </div>
            ) : null}

            {hasEditedPreviewConflict ? (
              <div
                aria-live="polite"
                className="learningDataSourceNotice learningDataSourceNoticeFallback"
                role="status"
                style={{ marginTop: "18px" }}
              >
                <span className="learningDataSourceBadge">本地草案</span>
                <p>存在未保存的本地编辑草案，仅预览，未入库。</p>
              </div>
            ) : null}

            {hasLongChapterTitles ? (
              <div
                aria-live="polite"
                className="learningDataSourceNotice learningDataSourceNoticeFallback"
                role="status"
                style={{ marginTop: "18px" }}
              >
                <span className="learningDataSourceBadge">标题截断</span>
                <p>章节标题已限制为 120 字，超出部分会自动截断，预览摘要只显示安全标题。</p>
              </div>
            ) : null}

            <div className="panelHeaderRow" style={{ marginTop: "18px" }}>
              <div>
                <p className="eyebrow">导入预览</p>
                <h2 id="import-preview-result-title">{preview.bookTitlePreview}</h2>
                <p className="panelNote">
                  预览只展示切分结果，不保存原文，不写数据库，也不会调用任何后端写入逻辑。
                </p>
              </div>
              <span className="difficultyBadge">编辑草案</span>
            </div>

            <dl className="scoreMeta" style={{ marginTop: "18px" }}>
              <PreviewSummaryRow
                label="总章节数"
                value={editedPreviewSummary?.chapters.length ?? preview.chapterCount}
              />
              <PreviewSummaryRow
                label="总估算行数"
                value={editedPreviewSummary?.estimatedTotalLines ?? sumEstimatedLineCount(preview)}
              />
              <PreviewSummaryRow
                label="当前显示章节"
                value={chapterDisplayState?.visibleChapters.length ?? 0}
              />
              <PreviewSummaryRow
                label="折叠章节数"
                value={chapterDisplayState?.hiddenChapterCount ?? 0}
              />
              <PreviewSummaryRow
                label="确认状态"
                value={editedPreviewSummary?.confirmationStatus ?? "blocked"}
              />
            </dl>

            {combinedWarnings.length > 0 ? (
              <div
                className="warningBlock"
                aria-live="polite"
                aria-label="预览提示和危险字段脱敏提示"
                role="status"
              >
                <h3>预览与校验提示</h3>
                <ul>
                  {combinedWarnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {editedPreviewSummary?.effectiveChapterCount === 0 ? (
              <p className="learningEmptyState" style={{ marginTop: "18px" }}>
                当前没有可继续导入的有效章节，请至少恢复 1 个章节后再继续。
              </p>
            ) : null}

            <div className="chunkPanel">
              <div className="panelHeader">
                <p className="eyebrow">章节预览</p>
                <h2>章节摘要</h2>
                <p className="panelNote">
                  默认只展示前 {DEFAULT_TEXT_IMPORT_CHAPTER_PREVIEW_LIMIT} 章，避免长文本撑爆页面。每章都显示标题、顺序、估算行数和正文预览。
                </p>
              </div>

              {chapterDisplayState !== null ? (
                <>
                  {chapterDisplayState.visibleChapters.length > 0 ? (
                    <div aria-label="章节预览列表" className="chunkList" id={chapterListId}>
                      {chapterDisplayState.visibleChapters.map((chapter) => {
                        const chapterEdit = chapterEditHistory.chapterEdits[chapter.order - 1] ?? {
                          title: chapter.title,
                          excluded: false,
                        };
                        const chapterSummary = editedPreviewSummary?.chapters[chapter.order - 1];
                        const resolvedTitle =
                          chapterSummary?.resolvedTitle ??
                          resolveEditedChapterTitle(chapter.order, chapterEdit.title);
                        const chapterCardId = `${chapterListId}-${chapter.order}`;

                        return (
                          <article
                            aria-labelledby={`${chapterCardId}-heading`}
                            className="chunkItem"
                            key={chapter.order}
                            style={{
                              opacity: chapterEdit.excluded ? 0.65 : 1,
                              borderStyle: chapterEdit.excluded ? "dashed" : undefined,
                            }}
                          >
                            <div className="chunkMeta">
                              <span>#{chapter.order}</span>
                              <span>{chapter.estimatedLineCount} 行</span>
                              <span>{chapterEdit.excluded ? "已排除" : "有效"}</span>
                            </div>
                            <h3 id={`${chapterCardId}-heading`}>{resolvedTitle}</h3>
                            <label htmlFor={`${chapterCardId}-title`} className="panelNote">
                              重命名章节标题
                            </label>
                            <input
                              ref={(element) => {
                                chapterTitleInputRefs.current[chapter.order] = element;
                              }}
                              id={`${chapterCardId}-title`}
                              aria-label={`编辑第 ${chapter.order} 章标题，最多 ${TEXT_IMPORT_CHAPTER_EDIT_TITLE_MAX_CHARS} 字`}
                              aria-describedby={joinDescribedByIds(
                                `${chapterCardId}-note`,
                                chapterEdit.title.trim().length >=
                                  TEXT_IMPORT_CHAPTER_EDIT_TITLE_MAX_CHARS
                                  ? `${chapterCardId}-limit`
                                  : null,
                              )}
                              maxLength={TEXT_IMPORT_CHAPTER_EDIT_TITLE_MAX_CHARS}
                              onChange={(event) =>
                                handleChapterTitleChange(chapter.order, event.currentTarget.value)
                              }
                              onFocus={(event) =>
                                handleChapterTitleFocus(chapter.order, event.currentTarget.value)
                              }
                              onKeyDown={(event) => handleChapterTitleKeyDown(chapter.order, event)}
                              placeholder={`未命名章节 ${chapter.order}`}
                              style={inputStyle}
                              type="text"
                              value={chapterEdit.title}
                            />
                            <p id={`${chapterCardId}-note`} className="panelNote">
                              {chapterEdit.title.trim().length === 0
                                ? `空标题会自动回退为未命名章节 ${chapter.order}。`
                                : `当前显示标题：${resolvedTitle}`}
                            </p>
                            {chapterEdit.title.trim().length >= TEXT_IMPORT_CHAPTER_EDIT_TITLE_MAX_CHARS ? (
                              <p id={`${chapterCardId}-limit`} className="panelNote">
                                章节标题已限制为 120 字，超出部分会自动截断，预览摘要只显示安全标题。
                              </p>
                            ) : null}
                            <button
                              aria-pressed={chapterEdit.excluded}
                              aria-label={
                                chapterEdit.excluded
                                  ? `恢复第 ${chapter.order} 章`
                                  : `排除第 ${chapter.order} 章`
                              }
                              className="secondaryLink"
                              onClick={() => handleChapterExcludedToggle(chapter.order)}
                              type="button"
                            >
                              {chapterEdit.excluded ? "恢复此章" : "排除此章"}
                            </button>
                            <p>{chapter.previewText || "暂无可展示的正文预览"}</p>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="learningEmptyState">
                      当前没有可显示的章节，请重新生成预览后再继续。
                    </p>
                  )}

                  {canToggleChapterList ? (
                    <div
                      className="learningDataSourceNotice learningDataSourceNoticeFallback"
                      style={{ marginTop: "18px" }}
                    >
                      <span className="learningDataSourceBadge">
                        {showAllChapters
                          ? "已展开全部章节"
                          : `已折叠 ${chapterDisplayState.hiddenChapterCount} 章`}
                      </span>
                      <p>
                        当前只展示前 {chapterDisplayState.visibleChapters.length} 章，剩余章节可以通过按钮展开或收起。
                      </p>
                      <button
                        aria-controls={chapterListId}
                        aria-expanded={showAllChapters}
                        className="secondaryLink"
                        onClick={() => setShowAllChapters((current) => !current)}
                        type="button"
                      >
                        {showAllChapters ? "收起章节预览" : "展开全部章节"}
                      </button>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>

            {confirmation !== null ? (
              <div
                aria-labelledby="import-confirmation-title"
                className="learningDataSourceNotice"
                role="region"
                style={{
                  marginTop: "18px",
                  borderColor: confirmation.status === "ready" ? "#c9d8ca" : "#e5cdbd",
                  background: confirmation.status === "ready" ? "#f5faf6" : "#fff8f2",
                }}
              >
                <span
                  className="learningDataSourceBadge"
                  style={{
                    background: confirmation.status === "ready" ? "#4f6f52" : "#8a452d",
                  }}
                >
                  {confirmation.status === "ready" ? "可继续预览" : "已阻断预览"}
                </span>
                <div>
                  <p className="eyebrow">保存前确认草案</p>
                  <h3 id="import-confirmation-title">{confirmation.bookTitlePreview}</h3>
                  <p className="panelNote">
                    这里仍然只是确认草案，未写入数据库，保存功能未连接，后续也必须先经过显式确认。
                  </p>
                </div>

                <dl className="scoreMeta" style={{ marginTop: "18px" }}>
                  <PreviewSummaryRow label="确认状态" value={confirmation.status} />
                  <PreviewSummaryRow label="章节总数" value={confirmation.chapterCount} />
                  <PreviewSummaryRow label="总估算行数" value={confirmation.estimatedTotalLines} />
                  <PreviewSummaryRow
                    label="需要显式确认"
                    value={String(confirmation.requiresExplicitUserConfirmation)}
                  />
                  <PreviewSummaryRow
                    label="未写入数据库"
                    value={String(confirmation.writesDatabase)}
                  />
                  <PreviewSummaryRow
                    label="未调用仓库层"
                    value={String(confirmation.callsRepository)}
                  />
                </dl>

                <div className="warningBlock">
                  <h3>确认清单</h3>
                  <ul>
                    {buildTextImportConfirmationChecklist(confirmation).map((item) => (
                      <li key={item.label}>
                        <strong>{item.label}</strong>：{item.value}
                      </li>
                    ))}
                  </ul>
                </div>

                {confirmation.warnings.length > 0 ? (
                  <div className="warningBlock" aria-live="polite" role="status">
                    <h3>确认草案提示</h3>
                    <ul>
                      {confirmation.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {confirmation.blockedReasons.length > 0 ? (
                  <div className="warningBlock" role="alert">
                    <h3>阻断原因</h3>
                    <ul>
                      {confirmation.blockedReasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="learningEmptyState">
                    当前状态仍然可以继续预览，但不会触发保存。真正进入保存前仍需要用户显式确认。
                  </p>
                )}
              </div>
            ) : null}

            {/* --- Dev Save Section --- */}
            {devGuard.devSaveEnabled && saveRequestPreview !== null ? (
              <div
                className="learningDataSourceNotice"
                role="region"
                aria-labelledby="dev-save-section-title"
                style={{
                  marginTop: "18px",
                  borderColor: dbPersistGuard.enabled ? "#b7e4c7" : "#b7e4c7",
                  background: dbPersistGuard.enabled ? "#f0faf3" : "#f0faf3",
                }}
              >
                <span className="learningDataSourceBadge" style={greenBadgeStyle}>
                  {dbPersistGuard.enabled
                    ? "保存到开发数据库"
                    : "保存到开发内存书库"}
                </span>
                <h3 id="dev-save-section-title" style={{ marginTop: "10px" }}>
                  {dbPersistGuard.enabled
                    ? "开发数据库持久化保存（dev-only）"
                    : "开发/测试保存（非生产）"}
                </h3>
                <p className="panelNote" style={{ marginTop: "6px" }}>
                  {dbPersistGuard.enabled
                    ? "书籍将保存到开发数据库，重启后数据保留。dev-only · 需要显式环境变量 · 未接生产用户系统 · 不要用于生产数据。"
                    : "书籍将保存到进程内内存书库，重启丢失，未连接生产数据库，未接真实用户账号。"}
                </p>

                <div className="warningBlock" style={{ marginTop: "12px" }}>
                  <h3>保存前确认</h3>
                  <ul>
                    <li>
                      <strong>是否已确认</strong>
                      ：{saveRequestPreview.userExplicitlyConfirmed ? "是" : "否"}
                    </li>
                    <li>
                      <strong>saveReady</strong>：{String(saveRequestPreview.saveReady)}
                    </li>
                    <li>
                      <strong>章节数</strong>：{saveRequestPreview.effectiveChapterCount}
                    </li>
                    <li>
                      <strong>阻断原因</strong>
                      ：{saveRequestPreview.blockedReasons.length > 0
                        ? saveRequestPreview.blockedReasons.join("；")
                        : "无"}
                    </li>
                    {dbPersistGuard.enabled ? (
                      <>
                        <li>
                          <strong>写入目标</strong>：开发数据库（PostgreSQL/Prisma）
                        </li>
                        <li>
                          <strong>写入模式</strong>：dev-only DB persist
                        </li>
                        <li>
                          <strong>生产就绪</strong>：否（未接生产用户系统）
                        </li>
                      </>
                    ) : (
                      <li>
                        <strong>写入目标</strong>：进程内存（重启丢失）
                      </li>
                    )}
                  </ul>
                </div>

                <div style={{ marginTop: "12px" }}>
                  <button
                    type="button"
                    onClick={handleToggleUserConfirmation}
                    className={userExplicitlyConfirmed ? undefined : "secondaryLink"}
                    style={
                      userExplicitlyConfirmed
                        ? { background: "#2d6a4f", color: "#fff" }
                        : undefined
                    }
                  >
                    {userExplicitlyConfirmed
                      ? "已显式确认（点击取消）"
                      : dbPersistGuard.enabled
                        ? "我确认保存到开发数据库"
                        : "我确认保存到开发内存书库"}
                  </button>
                </div>

                <div style={{ marginTop: "8px" }}>
                  <button
                    type="button"
                    onClick={handleDevSave}
                    disabled={!canDevSave || devSavePending}
                    title={
                      devSavePending
                        ? "保存中..."
                        : canDevSave
                          ? dbPersistGuard.enabled
                            ? "保存到开发数据库（重启后数据保留）"
                            : "保存到开发内存书库（重启丢失）"
                          : saveRequestPreview.blockedReasons.length > 0
                            ? `阻断：${saveRequestPreview.blockedReasons.join("；")}`
                            : "请先完成预览并显式确认"
                    }
                    style={
                      canDevSave ? { background: "#2d6a4f", color: "#fff" } : undefined
                    }
                  >
                    {devSavePending
                      ? "保存中..."
                      : canDevSave
                        ? dbPersistGuard.enabled
                          ? "保存到开发数据库"
                          : "保存到开发内存书库"
                        : "保存未就绪（仍需显式确认或存在阻断）"}
                  </button>
                </div>

                {/* Save result display */}
                {devSaveState !== null ? (
                  <div
                    id={`${formId}-save-result`}
                    aria-live="polite"
                    className={
                      devSaveState.success
                        ? "learningDataSourceNotice"
                        : "learningDataSourceNotice learningDataSourceNoticeFallback"
                    }
                    role="status"
                    style={{
                      marginTop: "12px",
                      borderColor: devSaveState.success ? "#b7e4c7" : "#e5cdbd",
                      background: devSaveState.success ? "#f0faf3" : "#fff8f2",
                    }}
                  >
                    <span
                      className="learningDataSourceBadge"
                      style={{
                        background: devSaveState.success ? "#2d6a4f" : "#8a452d",
                      }}
                    >
                      {devSaveState.success ? "保存成功" : "未保存"}
                    </span>
                    <p style={{ marginTop: "6px" }}>{devSaveState.message}</p>
                    {devSaveState.success && devSaveState.bookId !== null ? (
                      <dl className="scoreMeta" style={{ marginTop: "12px" }}>
                        <PreviewSummaryRow label="书籍 ID" value={devSaveState.bookId} />
                        <PreviewSummaryRow
                          label="章节数"
                          value={devSaveState.chapterCount}
                        />
                        <PreviewSummaryRow
                          label="写入数据库"
                          value={
                            devSaveState.writesDatabase
                              ? "是（开发数据库）"
                              : "否（开发内存或 no-op）"
                          }
                        />
                        <PreviewSummaryRow
                          label="重启丢失"
                          value={devSaveState.writesDatabase ? "否（数据持久化）" : "是"}
                        />
                        {devSaveState.writesDatabase ? (
                          <>
                            <PreviewSummaryRow label="持久化模式" value="dev-only DB" />
                            <PreviewSummaryRow label="生产就绪" value="否" />
                          </>
                        ) : null}
                      </dl>
                    ) : null}
                    {devSaveState.success && devSaveState.bookId !== null ? (
                      <div style={{ marginTop: "12px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
                        <a href={"/books/" + encodeURIComponent(devSaveState.bookId)} className="secondaryLink">
                          View Book Detail
                        </a>
                        {devSaveState.chapterIds.length > 0 ? (
                          <a href={"/reader?bookId=" + encodeURIComponent(devSaveState.bookId) + "&chapterId=" + encodeURIComponent(devSaveState.chapterIds[0])} className="secondaryLink">
                            Read Chapter 1
                          </a>
                        ) : null}
                        <a href="/books" className="secondaryLink">
                          Books
                        </a>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* DB persist blocked notice */}
            {devGuard.devSaveEnabled && !dbPersistGuard.enabled && saveRequestPreview !== null ? (
              <div className="learningDataSourceNotice learningDataSourceNoticeFallback" role="status" style={{ marginTop: "12px" }}>
                <span className="learningDataSourceBadge">DB Persist Disabled</span>
                <p className="panelNote" style={{ marginTop: "6px" }}>
                  Current save is dev preview. To enable DB persist, set LAP_IMPORT_DB_PERSIST_DEV_ENABLED=true, LAP_ALLOW_REAL_DB_INTEGRATION=true, and configure DATABASE_URL.
                </p>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}

function PreviewSummaryRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function focusFirstInvalidField(
  fieldName: TextImportPreviewFieldName,
  refs: {
    titleInputRef: RefObject<HTMLInputElement | null>;
    rawTextInputRef: RefObject<HTMLTextAreaElement | null>;
  },
) {
  if (fieldName === "title") {
    refs.titleInputRef.current?.focus();
    return;
  }
  refs.rawTextInputRef.current?.focus();
}

function sumEstimatedLineCount(preview: TextImportPreviewResult): number {
  return preview.chapters.reduce((total, chapter) => total + chapter.estimatedLineCount, 0);
}

function joinDescribedByIds(...ids: Array<string | null | undefined>): string | undefined {
  const filteredIds = ids.filter((id): id is string => typeof id === "string" && id.length > 0);
  return filteredIds.length > 0 ? filteredIds.join(" ") : undefined;
}

function dedupeStrings(values: string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) === index);
}

function resolveEditedChapterTitle(chapterOrder: number, title: string): string {
  const normalizedTitle = normalizeTextImportChapterEditTitle(title);
  return normalizedTitle.length > 0
    ? normalizedTitle.length > TEXT_IMPORT_CHAPTER_EDIT_TITLE_MAX_CHARS
      ? normalizedTitle.slice(0, TEXT_IMPORT_CHAPTER_EDIT_TITLE_MAX_CHARS)
      : normalizedTitle
    : "未命名章节 " + chapterOrder;
}
