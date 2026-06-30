"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties, type FormEvent } from "react";

import {
  deleteDraft,
  IMPORTED_BOOK_DRAFTS_CHANGED_EVENT,
  listImportedBookDrafts,
  MAX_IMPORTED_DRAFT_MANUAL_BODY_LENGTH,
  MAX_IMPORTED_DRAFT_MANUAL_CHAPTER_TITLE_LENGTH,
  loadImportedBookDraft,
  renameDraft,
  updateDraftManualContent,
} from "../../lib/local-imported-book-draft-store.ts";
import { saveImportedDraftToDevDatabaseAction } from "./imported-draft-db-write-action.ts";
import {
  buildImportedDraftShelfViewModel,
  type ImportedDraftShelfDbSaveStatus,
  type ImportedDraftShelfItemViewModel,
  type ImportedDraftShelfViewModel,
} from "./imported-draft-shelf-view-model.ts";

const cardStyle: CSSProperties = {
  border: "1px solid #e2e6ed",
  borderRadius: "12px",
  background: "#fff",
  padding: "14px 16px",
  display: "grid",
  gap: "10px",
};

const badgeRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "6px",
};

const badgeStyle: CSSProperties = {
  display: "inline-block",
  fontSize: "0.7rem",
  fontWeight: 600,
  padding: "2px 8px",
  borderRadius: "999px",
  background: "#eef2f7",
  color: "#516072",
};

const warningBadgeStyle: CSSProperties = {
  ...badgeStyle,
  background: "#fff4d6",
  color: "#8a6300",
};

const actionRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  alignItems: "center",
};

const actionButtonStyle: CSSProperties = {
  border: "1px solid #c8d1dd",
  borderRadius: "999px",
  background: "#fff",
  color: "#1c2430",
  fontSize: "0.82rem",
  fontWeight: 600,
  padding: "6px 12px",
  cursor: "pointer",
};

const deleteButtonStyle: CSSProperties = {
  ...actionButtonStyle,
  borderColor: "#efb6b6",
  background: "#fff5f5",
  color: "#a33",
};

const editorFieldStyle: CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  padding: "8px 10px",
  fontSize: "0.92rem",
};

function readImportedDraftShelfViewModel(
  devDbSaveStatus?: ImportedDraftShelfDbSaveStatus,
): ImportedDraftShelfViewModel {
  return buildImportedDraftShelfViewModel(
    listImportedBookDrafts(),
    devDbSaveStatus,
  );
}

export function ImportedDraftShelfClient({
  devDbSaveStatus,
}: {
  devDbSaveStatus?: ImportedDraftShelfDbSaveStatus;
}) {
  const [viewModel, setViewModel] = useState<ImportedDraftShelfViewModel>(() =>
    readImportedDraftShelfViewModel(devDbSaveStatus),
  );

  useEffect(() => {
    function refreshDrafts() {
      setViewModel(readImportedDraftShelfViewModel(devDbSaveStatus));
    }

    refreshDrafts();
    window.addEventListener(IMPORTED_BOOK_DRAFTS_CHANGED_EVENT, refreshDrafts);
    window.addEventListener("storage", refreshDrafts);

    return () => {
      window.removeEventListener(IMPORTED_BOOK_DRAFTS_CHANGED_EVENT, refreshDrafts);
      window.removeEventListener("storage", refreshDrafts);
    };
  }, [devDbSaveStatus]);

  function handleRenameDraft(draft: ImportedDraftShelfItemViewModel) {
    const nextTitle = window.prompt("Rename this local draft", draft.title);
    if (nextTitle === null) {
      return;
    }

    renameDraft(draft.draftId, nextTitle);
    setViewModel(readImportedDraftShelfViewModel(devDbSaveStatus));
  }

  function handleDeleteDraft(draft: ImportedDraftShelfItemViewModel) {
    const confirmed = window.confirm(`Delete local draft "${draft.title}"?`);
    if (!confirmed) {
      return;
    }

    deleteDraft(draft.draftId);
    setViewModel(readImportedDraftShelfViewModel(devDbSaveStatus));
  }

  return (
    <section
      className="learningPanel recommendationPanel"
      aria-labelledby="imported-draft-shelf-title"
    >
      <div className="panelHeaderRow">
        <div>
          <p className="eyebrow">A416 local draft shelf</p>
          <h2 id="imported-draft-shelf-title">Local imported drafts</h2>
          <p className="panelNote">
            preview-only / local-only / localStorage only / not synced to cloud / not written to DB / not calling LLM / not fetching web body / not a full import
          </p>
          <p className="panelNote" style={{ marginTop: "6px" }}>
            dev-only DB save: {viewModel.devDbSaveStatus.statusText}
          </p>
        </div>
        <Link className="secondaryLink" href="/books">
          Go to library
        </Link>
      </div>

      {viewModel.status === "empty" ? (
        <div className="learningEmptyState" role="status" style={{ marginTop: "16px" }}>
          <strong>No imported drafts yet</strong>
          <p style={{ marginTop: "8px" }}>{viewModel.message}</p>
          <p style={{ marginTop: "8px" }}>
            Create a local draft from the external book preview card, then come back here to add a body and open Reader.
          </p>
        </div>
      ) : (
        <div style={{ marginTop: "16px", display: "grid", gap: "12px" }}>
          <p className="panelNote" style={{ margin: 0 }}>
            {viewModel.message}
          </p>
          {viewModel.drafts.map((draft) => (
            <article key={draft.draftId} style={cardStyle}>
              <div style={{ display: "grid", gap: "4px" }}>
                <strong style={{ fontSize: "0.98rem", color: "#1c2430" }}>{draft.title}</strong>
                <p style={{ margin: 0, color: "#5c697c", fontSize: "0.86rem" }}>
                  {draft.authors.length > 0 ? draft.authors.join(", ") : "Unknown author"}
                  {" | "}
                  language: {draft.language}
                </p>
                <p style={{ margin: 0, color: "#738193", fontSize: "0.78rem" }}>
                  provider: {draft.providerId} | externalBookId: {draft.externalBookId} | draftId:{" "}
                  {draft.draftId}
                </p>
              </div>

              <div style={badgeRowStyle} aria-label="Draft safety labels">
                {draft.safeLabels.map((label) => (
                  <span key={label} style={label === "local-only" ? warningBadgeStyle : badgeStyle}>
                    {label}
                  </span>
                ))}
                <span style={badgeStyle}>chapter count: {draft.chapterCount}</span>
                <span style={badgeStyle}>bodyAvailable: {String(draft.bodyAvailable)}</span>
                <span style={badgeStyle}>readerUrl ready</span>
              </div>

              <div className="homeActions" style={actionRowStyle}>
                <Link className="primaryLink" href={draft.readerUrl}>
                  Open Reader
                </Link>
                <DraftManualContentEditor
                  draft={draft}
                  onSaved={() => {
                    setViewModel(readImportedDraftShelfViewModel(devDbSaveStatus));
                  }}
                />
                <DraftDevDbSaveButton
                  draftId={draft.draftId}
                  dbSaveStatus={viewModel.devDbSaveStatus}
                />
                <button
                  type="button"
                  style={actionButtonStyle}
                  onClick={() => handleRenameDraft(draft)}
                >
                  Rename
                </button>
                <button
                  type="button"
                  style={deleteButtonStyle}
                  onClick={() => handleDeleteDraft(draft)}
                >
                  Delete
                </button>
                <span className="panelNote" aria-label="Draft storage note">
                  Browser local only
                </span>
              </div>

              <dl className="scoreMeta" style={{ marginTop: "2px" }}>
                <SummaryRow label="bodyAvailable" value={String(draft.bodyAvailable)} />
                <SummaryRow label="productionReady" value="false" />
                <SummaryRow label="writesDatabase" value="false" />
                <SummaryRow label="llmUsed" value="false" />
                <SummaryRow label="externalApiUsed" value="false" />
                <SummaryRow label="rawResponseStored" value="false" />
                <SummaryRow label="createdAt" value={draft.createdAt} />
                <SummaryRow label="updatedAt" value={draft.updatedAt} />
              </dl>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function DraftManualContentEditor({
  draft,
  onSaved,
}: {
  draft: ImportedDraftShelfItemViewModel;
  onSaved: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [chapterTitle, setChapterTitle] = useState("");
  const [body, setBody] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function openEditor() {
    const currentDraft = listImportedBookDrafts().find((entry) => entry.draftId === draft.draftId);
    const currentChapter = currentDraft?.chapters[0] ?? null;

    setChapterTitle(currentChapter?.title ?? draft.title);
    setBody(currentChapter?.plainText ?? "");
    setStatusMessage(null);
    setErrorMessage(null);
    setIsOpen(true);
  }

  function cancelEditor() {
    setIsOpen(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedBody = body.replace(/\r\n?/g, "\n");
    if (normalizedBody.trim().length === 0) {
      setErrorMessage("Body cannot be empty.");
      return;
    }

    if (normalizedBody.length > MAX_IMPORTED_DRAFT_MANUAL_BODY_LENGTH) {
      setErrorMessage(`Body exceeds the ${MAX_IMPORTED_DRAFT_MANUAL_BODY_LENGTH}-character limit.`);
      return;
    }

    const saved = updateDraftManualContent(draft.draftId, {
      chapterTitle,
      body: normalizedBody,
    });

    if (!saved) {
      setErrorMessage("Save failed: the draft is missing, storage is unavailable, or the content did not change.");
      return;
    }

    setStatusMessage("Saved to browser localStorage only.");
    setErrorMessage(null);
    setIsOpen(false);
    onSaved();
  }

  return (
    <div>
      {!isOpen ? (
        <button type="button" style={actionButtonStyle} onClick={openEditor}>
          {draft.bodyAvailable ? "Edit body" : "Add body"}
        </button>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "8px", minWidth: "100%" }}>
          <label style={{ display: "grid", gap: "4px", fontSize: "0.82rem", color: "#4b5565" }}>
            Chapter title
            <input
              value={chapterTitle}
              onChange={(event) => setChapterTitle(event.target.value)}
              maxLength={MAX_IMPORTED_DRAFT_MANUAL_CHAPTER_TITLE_LENGTH}
              style={editorFieldStyle}
            />
          </label>
          <label style={{ display: "grid", gap: "4px", fontSize: "0.82rem", color: "#4b5565" }}>
            Body
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={MAX_IMPORTED_DRAFT_MANUAL_BODY_LENGTH}
              rows={10}
              style={{
                ...editorFieldStyle,
                lineHeight: 1.6,
                resize: "vertical",
              }}
            />
          </label>
          <p className="panelNote" style={{ margin: 0 }}>
            local-only / not synced to cloud / not written to DB / not calling LLM / not fetching web body
          </p>
          <p className="panelNote" style={{ margin: 0 }}>
            Body limit {MAX_IMPORTED_DRAFT_MANUAL_BODY_LENGTH} chars, title limit {MAX_IMPORTED_DRAFT_MANUAL_CHAPTER_TITLE_LENGTH} chars.
          </p>
          {statusMessage !== null ? (
            <p style={{ margin: 0, color: "#166534", fontSize: "0.84rem" }}>{statusMessage}</p>
          ) : null}
          {errorMessage !== null ? (
            <p style={{ margin: 0, color: "#a33", fontSize: "0.84rem" }}>{errorMessage}</p>
          ) : null}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            <button type="submit" style={actionButtonStyle}>
              Save body
            </button>
            <button type="button" style={actionButtonStyle} onClick={cancelEditor}>
              Cancel
            </button>
          </div>
        </form>
      )}
      {statusMessage !== null && !isOpen ? (
        <p style={{ margin: "6px 0 0", color: "#166534", fontSize: "0.84rem" }}>
          {statusMessage}
        </p>
      ) : null}
    </div>
  );
}

function DraftDevDbSaveButton({
  draftId,
  dbSaveStatus,
}: {
  draftId: string;
  dbSaveStatus: ImportedDraftShelfDbSaveStatus;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [resultLinks, setResultLinks] = useState<{
    detailHref: string;
    readerHref: string;
    libraryHref: string;
  } | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSave() {
    if (!dbSaveStatus.enabled || isSaving) {
      return;
    }

    setIsSaving(true);
    setResultLinks(null);
    setResultMessage(null);
    setErrorMessage(null);

    try {
      const currentDraft = loadImportedBookDraft(draftId);
      const result = await saveImportedDraftToDevDatabaseAction(currentDraft);

      if (result.status === "written-dev-preview") {
        setResultLinks({
          detailHref: result.detailHref,
          readerHref: result.readerHref,
          libraryHref: result.libraryHref,
        });
        setResultMessage(
          `${result.message} bookId: ${result.bookId ?? "n/a"}; chapterId: ${result.chapterId ?? "n/a"}.`,
        );
      } else if (result.status === "blocked") {
        setErrorMessage(
          `${result.message} bookId preview: ${result.bookIdPreview ?? "n/a"}; chapterId preview: ${result.chapterIdPreview ?? "n/a"}.`,
        );
      } else {
        setErrorMessage(
          `${result.message} bookId preview: ${result.bookIdPreview ?? "n/a"}; chapterId preview: ${result.chapterIdPreview ?? "n/a"}.`,
        );
      }
    } catch {
      setErrorMessage("Saving to the dev database failed unexpectedly.");
    } finally {
      setIsSaving(false);
    }
  }

  const buttonLabel = !dbSaveStatus.enabled
    ? "开发数据库保存已关闭"
    : isSaving
      ? "Saving to dev DB..."
      : "保存到开发数据库";

  return (
    <div style={{ display: "grid", gap: "4px" }}>
      <button
        type="button"
        style={actionButtonStyle}
        disabled={!dbSaveStatus.enabled || isSaving}
        onClick={() => {
          void handleSave();
        }}
      >
        {buttonLabel}
      </button>
      <span className="panelNote" aria-label="Dev database save status">
        {dbSaveStatus.statusText}
      </span>
      {resultLinks !== null ? (
        <div className="homeActions" style={{ marginTop: "6px" }}>
          <a className="secondaryLink" href={resultLinks.libraryHref}>
            查看书库
          </a>
          <a className="primaryLink" href={resultLinks.readerHref}>
            打开阅读
          </a>
          <a className="secondaryLink" href={resultLinks.detailHref}>
            查看详情
          </a>
        </div>
      ) : null}
      {resultMessage !== null ? (
        <span style={{ color: "#166534", fontSize: "0.8rem", maxWidth: "320px" }}>
          {resultMessage}
        </span>
      ) : null}
      {errorMessage !== null ? (
        <span style={{ color: "#a33", fontSize: "0.8rem", maxWidth: "320px" }}>
          {errorMessage}
        </span>
      ) : null}
    </div>
  );
}
