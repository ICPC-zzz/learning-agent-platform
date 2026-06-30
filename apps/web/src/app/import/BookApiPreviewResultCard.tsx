"use client";

import {
  createImportedBookDraftFromPreviewBook,
  type ImportedBookDraft,
} from "@learning-agent-platform/book-engine";
import { useEffect, useState, type CSSProperties } from "react";

import type { BookApiPreviewBookViewModel } from "./book-api-preview";
import {
  createImportedBookDraftLinks,
  loadImportedBookDraftByProviderKey,
  saveImportedBookDraft,
} from "../../lib/local-imported-book-draft-store";
import {
  importBookApiItemAction,
  type BookApiImportResult,
} from "./book-api-import-server-action";

const resultCardStyle: CSSProperties = {
  border: "1px solid #e2e6ed",
  borderRadius: "8px",
  padding: "12px",
  display: "grid",
  gap: "4px",
};

const badgeStyle: CSSProperties = {
  display: "inline-block",
  fontSize: "0.7rem",
  fontWeight: 600,
  padding: "2px 8px",
  borderRadius: "999px",
  background: "#e8ecf1",
  color: "#54657e",
};

type BookDraftCardState =
  | { status: "checking" }
  | { status: "ready" }
  | { status: "saving" }
  | { status: "saved"; draft: ImportedBookDraft }
  | { status: "error"; message: string };

type BookDbImportState =
  | { status: "idle" }
  | { status: "importing" }
  | { status: "imported"; result: BookApiImportResult }
  | { status: "blocked"; message: string }
  | { status: "error"; message: string };

interface BookApiPreviewResultCardProps {
  book: BookApiPreviewBookViewModel;
}

export function BookApiPreviewResultCard({
  book,
}: BookApiPreviewResultCardProps) {
  const [draftState, setDraftState] = useState<BookDraftCardState>({
    status: "checking",
  });
  const [dbImportState, setDbImportState] = useState<BookDbImportState>({ status: "idle" });

  useEffect(() => {
    const existingDraft = loadImportedBookDraftByProviderKey(
      book.providerId,
      book.externalBookId,
    );

    if (existingDraft !== null) {
      setDraftState({ status: "saved", draft: existingDraft });
      return;
    }

    setDraftState({ status: "ready" });
  }, [book.externalBookId, book.providerId]);

  function handleCreateDraft() {
    setDraftState({ status: "saving" });

    const createdDraft = createImportedBookDraftFromPreviewBook(
      {
        providerId: book.providerId,
        externalBookId: book.externalBookId,
        title: book.title,
        authors: book.authors,
        description: book.description,
        language: book.language,
        sourceUrl: book.sourceUrl,
        licenseHint: book.licenseHint,
        coverImageUrl: book.coverImageUrl,
      },
      {
        now: new Date().toISOString(),
      },
    );

    const savedDraft = saveImportedBookDraft(createdDraft);

    if (savedDraft === null) {
      setDraftState({
        status: "error",
        message: "Local draft save failed: this browser cannot access localStorage.",
      });
      return;
    }

    setDraftState({ status: "saved", draft: savedDraft });
  }

  async function handleDbImport() {
    setDbImportState({ status: "importing" });

    try {
      const result = await importBookApiItemAction({
        providerId: book.providerId,
        externalBookId: book.externalBookId,
        title: book.title,
        authors: book.authors,
        description: book.description,
        language: book.language,
        sourceUrl: book.sourceUrl,
        licenseHint: book.licenseHint,
        coverImageUrl: book.coverImageUrl,
      });

      setDbImportState({ status: "imported", result });
    } catch (error) {
      setDbImportState({
        status: "error",
        message: error instanceof Error ? error.message : "DB import failed",
      });
    }
  }

  const savedDraft = draftState.status === "saved" ? draftState.draft : null;
  const draftLinks =
    savedDraft === null ? null : createImportedBookDraftLinks(savedDraft.draftId);

  return (
    <article style={resultCardStyle}>
      <div style={{ display: "flex", gap: "8px", alignItems: "start" }}>
        {book.coverImageUrl ? (
          <img
            src={book.coverImageUrl}
            alt={book.title}
            style={{
              width: "60px",
              height: "90px",
              objectFit: "cover",
              borderRadius: "4px",
              border: "1px solid #e2e6ed",
              flexShrink: 0,
            }}
            onError={(event) => {
              (event.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : null}
        <div style={{ minWidth: 0 }}>
          <strong style={{ fontSize: "0.95rem", color: "#1c2430" }}>
            {book.title}
          </strong>
          <p style={{ fontSize: "0.85rem", color: "#54657e", marginTop: "2px" }}>
            {book.authors.length > 0 ? book.authors.join(", ") : "Unknown author"}
            {" | "}
            language: {book.language || "unknown"}
          </p>
          <p style={{ fontSize: "0.78rem", color: "#6c7483", marginTop: "2px" }}>
            provider: {book.providerId} | source URL: {book.sourceUrl || "unknown"}
          </p>
          {book.description ? (
            <p
              style={{
                fontSize: "0.8rem",
                color: "#6c7483",
                marginTop: "4px",
                lineHeight: 1.4,
              }}
            >
              {book.description.length > 200
                ? `${book.description.slice(0, 197)}...`
                : book.description}
            </p>
          ) : null}
          <div style={{ marginTop: "6px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <span style={badgeStyle}>ID: {book.externalBookId}</span>
            {book.licenseHint !== "unknown" ? (
              <span style={badgeStyle}>{book.licenseHint}</span>
            ) : null}
            <span style={{ ...badgeStyle, background: "#ffe0e0", color: "#a33" }}>
              importable=dev-only
            </span>
            <span style={badgeStyle}>
              draft:
              {draftState.status === "saved"
                ? "created"
                : draftState.status === "saving"
                  ? "saving"
                  : "not created"}
            </span>
          </div>

          <div style={{ marginTop: "10px", display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            {draftState.status === "error" ? (
              <p style={{ color: "#a33", fontSize: "0.82rem" }}>
                {draftState.message}
              </p>
            ) : null}

            {draftState.status !== "saved" ? (
              <button
                type="button"
                onClick={handleCreateDraft}
                disabled={draftState.status !== "ready"}
                style={{
                  background: draftState.status !== "ready" ? "#e2e8f0" : "#f8fafc",
                  border: "1px solid #cbd5e1",
                  borderRadius: "6px",
                  color: draftState.status !== "ready" ? "#94a3b8" : "#475569",
                  cursor: draftState.status !== "ready" ? "not-allowed" : "pointer",
                  fontSize: "12px",
                  padding: "4px 10px",
                }}
              >
                {draftState.status === "saving" ? "保存草稿中..." : "创建本地草稿"}
              </button>
            ) : null}

            {/* DB Import button */}
            {dbImportState.status !== "imported" ? (
              <button
                type="button"
                onClick={handleDbImport}
                disabled={dbImportState.status === "importing"}
                style={{
                  background: dbImportState.status === "importing" ? "#e2e8f0" : "#0f172a",
                  border: "none",
                  borderRadius: "6px",
                  color: dbImportState.status === "importing" ? "#64748b" : "#fff",
                  cursor: dbImportState.status === "importing" ? "not-allowed" : "pointer",
                  fontSize: "12px",
                  fontWeight: 600,
                  padding: "6px 14px",
                }}
              >
                {dbImportState.status === "importing"
                  ? "导入数据库中..."
                  : "导入到本地书库"}
              </button>
            ) : null}
          </div>

          {/* Draft links */}
          {savedDraft !== null && draftLinks !== null ? (
            <div className="homeActions" style={{ marginTop: "8px" }}>
              <span style={badgeStyle}>草稿 ID: {savedDraft.draftId}</span>
              <a className="primaryLink" href={draftLinks.readerHref}>
                打开阅读器草稿
              </a>
              <a className="secondaryLink" href={draftLinks.libraryHref}>
                返回书库
              </a>
            </div>
          ) : null}

          {/* DB Import result */}
          {dbImportState.status === "imported" ? (
            <div style={{ marginTop: "8px" }}>
              {dbImportState.result.success ? (
                <div className="homeActions" style={{ marginTop: "4px" }}>
                  <span style={{ ...badgeStyle, background: "#e8fff1", color: "#166534" }}>
                    DB: {dbImportState.result.dbWritten ? `已保存 (${dbImportState.result.bookId})` : "本地回退"}
                  </span>
                  {dbImportState.result.chapterCount > 0 ? (
                    <span style={badgeStyle}>章节: {dbImportState.result.chapterCount}</span>
                  ) : null}
                  {dbImportState.result.importedAt ? (
                    <span style={{ fontSize: "10px", color: "#94a3b8" }}>
                      导入: {new Date(dbImportState.result.importedAt).toLocaleDateString("zh-CN")}
                    </span>
                  ) : null}
                  {dbImportState.result.detailLink ? (
                    <a className="primaryLink" href={dbImportState.result.detailLink}>
                      查看书籍详情
                    </a>
                  ) : null}
                  {dbImportState.result.readerLink ? (
                    <a className="secondaryLink" href={dbImportState.result.readerLink}>
                      打开阅读器
                    </a>
                  ) : null}
                  <p style={{ fontSize: "0.78rem", color: "#64748b", margin: "2px 0 0 0" }}>
                    {dbImportState.result.message}
                  </p>
                </div>
              ) : (
                <div style={{ marginTop: "4px" }}>
                  <span style={{ ...badgeStyle, background: "#ffe0e0", color: "#a33" }}>
                    导入被阻止
                  </span>
                  <p style={{ fontSize: "0.78rem", color: "#9f1239", margin: "2px 0 0 0" }}>
                    {dbImportState.result.message}
                  </p>
                </div>
              )}
            </div>
          ) : null}

          {dbImportState.status === "blocked" ? (
            <p style={{ fontSize: "0.78rem", color: "#856404", marginTop: "4px", background: "#fff3cd", padding: "6px 8px", borderRadius: "4px" }}>
              {dbImportState.message}
            </p>
          ) : null}

          {dbImportState.status === "error" ? (
            <p style={{ fontSize: "0.78rem", color: "#dc2626", marginTop: "4px" }}>
              {dbImportState.message}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
