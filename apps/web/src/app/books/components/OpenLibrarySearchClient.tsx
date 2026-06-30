"use client";

/**
 * OpenLibrarySearchClient — Client component for Open Library external search.
 *
 * Renders a search form + results on the /books page.
 * Clearly separates external (Open Library) data from local book library data.
 *
 * States:
 * - Blocked: guard blocked → shows missing env names
 * - Idle: ready to search
 * - Loading: fetching from Open Library
 * - Empty: search returned no results
 * - Error: search failed
 * - Success: shows result cards
 *
 * All results are labeled "外部数据预览 · 未导入本地".
 * Import button is disabled with "下一轮接入导入" text.
 *
 * @previewOnly — dev-only external search preview
 */

import { useState, useCallback, type CSSProperties } from "react";
import {
  openLibrarySearchAction,
  openLibraryWorkDetailAction,
  openLibraryEditionDetailAction,
  type OpenLibrarySearchActionResult,
  type OpenLibraryDetailActionResult,
} from "../open-library-actions";
import {
  importOpenLibraryBookAction,
  type OpenLibraryImportResult,
} from "../open-library-import-actions";
import type { OpenLibraryBookPreview, OpenLibraryDetailPreview } from "../../../lib/open-library-adapter";

// ---------------------------------------------------------------------------
// CSS styles (inline, matching site design tokens)
// ---------------------------------------------------------------------------

const containerStyle: CSSProperties = {
  marginTop: "var(--lap-space-6)",
};

const sectionCardStyle: CSSProperties = {
  background: "var(--lap-surface, #ffffff)",
  border: "1px solid var(--lap-border, #d8dee8)",
  borderRadius: "12px",
  padding: "var(--lap-space-5, 20px)",
};

const sectionHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "var(--lap-space-2, 8px)",
  marginBottom: "var(--lap-space-3, 12px)",
};

const sectionTitleStyle: CSSProperties = {
  fontSize: "1.1rem",
  fontWeight: 700,
  color: "var(--lap-text-primary, #1c2430)",
  margin: 0,
};

const externalBadgeStyle: CSSProperties = {
  display: "inline-block",
  fontSize: "0.675rem",
  fontWeight: 600,
  padding: "2px 8px",
  borderRadius: "999px",
  background: "#e3f2fd",
  color: "#1565c0",
};

const searchRowStyle: CSSProperties = {
  display: "flex",
  gap: "8px",
  alignItems: "center",
  flexWrap: "wrap",
  marginBottom: "var(--lap-space-3, 12px)",
};

const inputStyle: CSSProperties = {
  flex: 1,
  minWidth: "200px",
  minHeight: "38px",
  border: "1px solid var(--lap-border, #d8dee8)",
  borderRadius: "8px",
  color: "var(--lap-text-primary, #1c2430)",
  background: "var(--lap-surface, #ffffff)",
  font: "inherit",
  padding: "8px 12px",
};

const buttonStyle: CSSProperties = {
  minHeight: "38px",
  padding: "0 16px",
  border: "none",
  borderRadius: "8px",
  background: "var(--lap-accent, #2563eb)",
  color: "#ffffff",
  fontWeight: 600,
  fontSize: "0.85rem",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const buttonDisabledStyle: CSSProperties = {
  ...buttonStyle,
  opacity: 0.5,
  cursor: "not-allowed",
};

const blockedPanelStyle: CSSProperties = {
  background: "#fff9e6",
  border: "1px solid #f0d77b",
  borderRadius: "8px",
  padding: "14px 16px",
  fontSize: "0.875rem",
  color: "#66561b",
  marginBottom: "var(--lap-space-3, 12px)",
};

const resultsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
  gap: "var(--lap-space-3, 12px)",
  marginTop: "var(--lap-space-3, 12px)",
};

const cardStyle: CSSProperties = {
  background: "var(--lap-surface, #ffffff)",
  border: "1px solid var(--lap-border, #d8dee8)",
  borderRadius: "10px",
  padding: "var(--lap-space-4, 16px)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--lap-space-2, 8px)",
  position: "relative",
};

const cardTitleStyle: CSSProperties = {
  fontSize: "0.95rem",
  fontWeight: 600,
  color: "var(--lap-text-primary, #1c2430)",
  margin: 0,
  lineHeight: 1.35,
};

const cardMetaStyle: CSSProperties = {
  fontSize: "0.75rem",
  color: "var(--lap-text-muted, #6b7a93)",
  margin: 0,
};

const detailLinkStyle: CSSProperties = {
  fontSize: "0.75rem",
  color: "var(--lap-accent, #2563eb)",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: 0,
  textDecoration: "underline",
  fontWeight: 500,
};

const disabledImportButtonStyle: CSSProperties = {
  fontSize: "0.7rem",
  padding: "2px 8px",
  borderRadius: "6px",
  border: "1px solid #d8dee8",
  background: "#f5f5f5",
  color: "#999",
  cursor: "not-allowed",
  whiteSpace: "nowrap",
};

const importButtonStyle: CSSProperties = {
  fontSize: "0.7rem",
  padding: "3px 10px",
  borderRadius: "6px",
  border: "1px solid #2563eb",
  background: "#2563eb",
  color: "#ffffff",
  cursor: "pointer",
  whiteSpace: "nowrap",
  fontWeight: 600,
};

const importingButtonStyle: CSSProperties = {
  fontSize: "0.7rem",
  padding: "3px 10px",
  borderRadius: "6px",
  border: "1px solid #2563eb",
  background: "#e3f2fd",
  color: "#2563eb",
  whiteSpace: "nowrap",
  fontWeight: 500,
};

const importedBadgeStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "4px",
  fontSize: "0.7rem",
  padding: "2px 8px",
  borderRadius: "6px",
  border: "1px solid #4caf50",
  background: "#e8f5e9",
  color: "#2e7d32",
  whiteSpace: "nowrap",
  fontWeight: 600,
};

const importedDetailLinkStyle: CSSProperties = {
  fontSize: "0.65rem",
  color: "#1565c0",
  textDecoration: "underline",
  cursor: "pointer",
  background: "none",
  border: "none",
  padding: 0,
  fontWeight: 500,
};

const detailPanelStyle: CSSProperties = {
  marginTop: "var(--lap-space-2, 8px)",
  padding: "var(--lap-space-3, 12px)",
  background: "#f9fafb",
  borderRadius: "8px",
  border: "1px solid var(--lap-border, #d8dee8)",
  fontSize: "0.85rem",
  color: "var(--lap-text-secondary, #4a5568)",
  lineHeight: 1.6,
};

const loadingStyle: CSSProperties = {
  textAlign: "center",
  padding: "var(--lap-space-4, 16px)",
  color: "var(--lap-text-muted, #6b7a93)",
  fontSize: "0.875rem",
};

const emptyStyle: CSSProperties = {
  textAlign: "center",
  padding: "var(--lap-space-4, 16px)",
  color: "var(--lap-text-muted, #6b7a93)",
  fontSize: "0.875rem",
};

const errorStyle: CSSProperties = {
  textAlign: "center",
  padding: "var(--lap-space-4, 16px)",
  color: "#b71c1c",
  fontSize: "0.875rem",
  background: "#fef0f0",
  borderRadius: "8px",
  border: "1px solid #ffcdd2",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface OpenLibrarySearchClientProps {
  /** Whether the guard is currently blocked */
  guardBlocked: boolean;
  /** Blocked reason (if blocked), safe to show to user */
  blockedReason: string | null;
  /** Missing env names (if blocked), safe to show */
  missingEnvNames: string[];
  /** Whether dev book import is enabled */
  importEnabled: boolean;
  /** Import blocked reason (if import is blocked) */
  importBlockedReason: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OpenLibrarySearchClient({
  guardBlocked,
  blockedReason,
  missingEnvNames,
  importEnabled,
  importBlockedReason,
}: OpenLibrarySearchClientProps) {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<OpenLibraryBookPreview[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");

  // Detail preview state
  const [detailPreview, setDetailPreview] = useState<OpenLibraryDetailPreview | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  // Import state
  const [importingBookId, setImportingBookId] = useState<string | null>(null);
  const [importedBooks, setImportedBooks] = useState<Map<string, OpenLibraryImportResult>>(new Map());
  const [importError, setImportError] = useState<string>("");

  // Search handler
  const handleSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (trimmed.length === 0) return;

    setIsLoading(true);
    setErrorMessage("");
    setResults([]);
    setTotalResults(0);
    setDetailPreview(null);
    setActiveCardId(null);

    try {
      const actionResult: OpenLibrarySearchActionResult = await openLibrarySearchAction(trimmed, 10);

      if (!actionResult.success) {
        setErrorMessage(actionResult.error ?? "搜索失败");
        return;
      }

      setResults(actionResult.results);
      setTotalResults(actionResult.totalResults);

      if (actionResult.results.length === 0) {
        setErrorMessage(""); // Not an error — just no results
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "搜索请求失败");
    } finally {
      setIsLoading(false);
    }
  }, [query]);

  // Detail preview handler
  const handleDetailClick = useCallback(async (preview: OpenLibraryBookPreview) => {
    const cardId = preview.externalId;
    if (activeCardId === cardId) {
      // Toggle off
      setDetailPreview(null);
      setActiveCardId(null);
      return;
    }

    setDetailLoading(true);
    setDetailError("");
    setDetailPreview(null);
    setActiveCardId(cardId);

    try {
      let detailResult: OpenLibraryDetailActionResult;

      if (preview.workKey) {
        detailResult = await openLibraryWorkDetailAction(preview.workKey);
      } else if (preview.editionKey) {
        detailResult = await openLibraryEditionDetailAction(preview.editionKey);
      } else {
        setDetailError("无法获取详情：缺少 work key 或 edition key");
        setDetailLoading(false);
        return;
      }

      if (!detailResult.success || !detailResult.detail) {
        setDetailError(detailResult.error ?? "获取详情失败");
        setDetailLoading(false);
        return;
      }

      setDetailPreview(detailResult.detail);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "获取详情失败");
    } finally {
      setDetailLoading(false);
    }
  }, [activeCardId]);

  // Import handler
  const handleImport = useCallback(async (preview: OpenLibraryBookPreview) => {
    const bookId = preview.externalId;

    // Already imported
    if (importedBooks.has(bookId)) return;

    // Already importing
    if (importingBookId === bookId) return;

    // Guard blocked
    if (!importEnabled) return;

    setImportingBookId(bookId);
    setImportError("");

    try {
      const result: OpenLibraryImportResult = await importOpenLibraryBookAction({
        externalId: preview.externalId,
        workKey: preview.workKey,
        editionKey: preview.editionKey,
        title: preview.title,
        sourceUrl: preview.sourceUrl,
      });

      setImportedBooks((prev) => {
        const next = new Map(prev);
        next.set(bookId, result);
        return next;
      });
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "导入失败");
    } finally {
      setImportingBookId(null);
    }
  }, [importEnabled, importedBooks, importingBookId]);

  // Key press handler
  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleSearch();
      }
    },
    [handleSearch],
  );

  return (
    <div style={containerStyle}>
      <div style={sectionCardStyle}>
        {/* Section header */}
        <div style={sectionHeaderStyle}>
          <h3 style={sectionTitleStyle}>Open Library 外部搜索</h3>
          <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
            <span style={externalBadgeStyle}>外部数据预览</span>
            <span style={{ ...externalBadgeStyle, background: "#fff3e0", color: "#e65100" }}>开发预览 · 导入</span>
          </div>
        </div>

        {/* Guard blocked state */}
        {guardBlocked ? (
          <div style={blockedPanelStyle}>
            <strong>外部搜索暂不可用</strong>
            <div style={{ marginTop: 4 }}>
              {blockedReason ?? "Book API 未启用"}
            </div>
            {missingEnvNames.length > 0 ? (
              <div style={{ marginTop: 4, fontSize: "0.8rem", opacity: 0.8 }}>
                缺少环境变量: {missingEnvNames.join(", ")}
              </div>
            ) : null}
          </div>
        ) : (
          <>
            {/* Network note */}
            <div style={{
              background: "#f0f7ff", border: "1px solid #93c5fd", borderRadius: "8px",
              padding: "10px 14px", fontSize: "0.8rem", color: "#1e40af",
              marginBottom: "12px", lineHeight: 1.6,
            }}>
              如果你遇到 <b>OL_FETCH_ERROR</b> 或超时，说明当前网络无法直连 Open Library。
              请使用页面底部的 CLI 脚本先把书导入到本地书库，然后用上方的搜索框直接搜索本地书籍。
              本地书库已有
              <span style={{ fontWeight: 700 }}>1,400+ 本</span> 编程书籍可搜索。
            </div>
            {/* Search form */}
            <div style={searchRowStyle}>
              <input
                type="text"
                placeholder="搜索 Open Library 书籍（如：python, javascript, machine learning）"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyPress}
                maxLength={500}
                style={inputStyle}
                disabled={isLoading}
              />
              <button
                onClick={handleSearch}
                disabled={isLoading || query.trim().length === 0}
                style={isLoading || query.trim().length === 0 ? buttonDisabledStyle : buttonStyle}
              >
                {isLoading ? "搜索中..." : "搜索"}
              </button>
            </div>

            {/* Loading state */}
            {isLoading ? (
              <div style={loadingStyle}>正在搜索 Open Library...</div>
            ) : null}

            {/* Error state */}
            {errorMessage && !isLoading ? (
              <div style={errorStyle}>{errorMessage}</div>
            ) : null}

            {/* Empty state (searched but no results) */}
            {!isLoading && !errorMessage && results.length === 0 && totalResults === 0 && query.trim().length > 0 ? (
              <div style={emptyStyle}>
                未找到匹配的书籍。尝试其他关键词。
              </div>
            ) : null}

            {/* Results */}
            {results.length > 0 ? (
              <>
                <div style={{ fontSize: "0.8rem", color: "var(--lap-text-muted, #6b7a93)", marginTop: 4 }}>
                  找到 {totalResults} 个结果，显示前 {results.length} 个
                  {" · "}
                  <span style={{ color: "#1565c0", fontWeight: 500 }}>外部数据预览，未导入本地</span>
                </div>
                <div style={resultsGridStyle}>
                  {results.map((preview) => (
                    <SearchResultCard
                      key={preview.externalId}
                      preview={preview}
                      isDetailOpen={activeCardId === preview.externalId}
                      detailPreview={activeCardId === preview.externalId ? detailPreview : null}
                      detailLoading={activeCardId === preview.externalId ? detailLoading : false}
                      detailError={activeCardId === preview.externalId ? detailError : ""}
                      onDetailClick={handleDetailClick}
                      importEnabled={importEnabled}
                      importBlockedReason={importBlockedReason}
                      importingBookId={importingBookId}
                      importResult={importedBooks.get(preview.externalId)}
                      importError={importError}
                      onImport={handleImport}
                    />
                  ))}
                </div>
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SearchResultCard — individual result card
// ---------------------------------------------------------------------------

interface SearchResultCardProps {
  preview: OpenLibraryBookPreview;
  isDetailOpen: boolean;
  detailPreview: OpenLibraryDetailPreview | null;
  detailLoading: boolean;
  detailError: string;
  onDetailClick: (preview: OpenLibraryBookPreview) => void;
  /** Whether import is enabled */
  importEnabled: boolean;
  /** Import blocked reason */
  importBlockedReason: string | null;
  /** Currently importing book ID */
  importingBookId: string | null;
  /** Import result (if already imported) */
  importResult: OpenLibraryImportResult | undefined;
  /** Import error message */
  importError: string;
  /** Import handler */
  onImport: (preview: OpenLibraryBookPreview) => void;
}

function SearchResultCard({
  preview,
  isDetailOpen,
  detailPreview,
  detailLoading,
  detailError,
  onDetailClick,
  importEnabled,
  importBlockedReason,
  importingBookId,
  importResult,
  importError,
  onImport,
}: SearchResultCardProps) {
  const bookId = preview.externalId;
  const isImporting = importingBookId === bookId;
  const isImported = importResult !== undefined;
  const importSucceeded = isImported && importResult.success;
  return (
    <div style={cardStyle}>
      {/* Cover image (small thumbnail) */}
      {preview.coverUrl ? (
        <div
          style={{
            width: "100%",
            height: 120,
            background: `#f0f0f0 url(${preview.coverUrl}) center/contain no-repeat`,
            borderRadius: "6px",
            marginBottom: 4,
          }}
          title={`${preview.title} 封面`}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: 80,
            background: "#f9fafb",
            borderRadius: "6px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.7rem",
            color: "#aaa",
            marginBottom: 4,
          }}
        >
          无封面
        </div>
      )}

      {/* Title */}
      <h4 style={cardTitleStyle}>{preview.title}</h4>

      {/* Authors */}
      {preview.authorNames.length > 0 ? (
        <p style={cardMetaStyle}>
          作者: {preview.authorNames.join(", ")}
        </p>
      ) : null}

      {/* Year + Language */}
      <p style={cardMetaStyle}>
        {preview.firstPublishYear ? `${preview.firstPublishYear} 年出版` : ""}
        {preview.firstPublishYear && preview.language.length > 0 ? " · " : ""}
        {preview.language.length > 0 ? preview.language.join(", ").toUpperCase() : ""}
      </p>

      {/* ISBN */}
      {preview.isbn.length > 0 ? (
        <p style={cardMetaStyle}>
          ISBN: {preview.isbn.slice(0, 2).join(", ")}
          {preview.isbn.length > 2 ? ` 等 ${preview.isbn.length} 个` : ""}
        </p>
      ) : null}

      {/* Subjects */}
      {preview.subjects.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {preview.subjects.slice(0, 5).map((s, i) => (
            <span
              key={i}
              style={{
                fontSize: "0.625rem",
                padding: "1px 6px",
                borderRadius: "999px",
                background: "#f0f4ff",
                color: "#4a6fa5",
              }}
            >
              {s}
            </span>
          ))}
        </div>
      ) : null}

      {/* Actions row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "auto",
          paddingTop: 8,
          borderTop: "1px solid var(--lap-border, #e8ecf1)",
        }}
      >
        <button
          onClick={() => onDetailClick(preview)}
          style={detailLinkStyle}
          disabled={detailLoading}
        >
          {isDetailOpen ? "收起详情" : "查看详情"}
        </button>
        {/* Import button */}
        {importSucceeded ? (
          <span style={importedBadgeStyle}>
            已导入
            {importResult.detailLink ? (
              <a
                href={importResult.detailLink}
                style={{ ...importedDetailLinkStyle }}
              >
                查看
              </a>
            ) : null}
          </span>
        ) : isImporting ? (
          <span style={importingButtonStyle}>
            导入中...
          </span>
        ) : !importEnabled ? (
          <span
            title={importBlockedReason ?? "导入功能未启用"}
            style={disabledImportButtonStyle}
          >
            导入未启用
          </span>
        ) : (
          <button
            onClick={() => onImport(preview)}
            disabled={isImporting}
            style={importButtonStyle}
            title="导入到本地书库（开发预览）"
          >
            导入本书
          </button>
        )}
      </div>

      {/* Source label */}
      <div style={{ fontSize: "0.625rem", color: "#999", textAlign: "right" }}>
        Open Library · {preview.externalId}
      </div>

      {/* Detail preview panel (expandable) */}
      {isDetailOpen ? (
        <div style={detailPanelStyle}>
          {detailLoading ? (
            <div style={{ color: "var(--lap-text-muted, #6b7a93)" }}>加载详情中...</div>
          ) : detailError ? (
            <div style={{ color: "#b71c1c" }}>{detailError}</div>
          ) : detailPreview ? (
            <DetailContent detail={detailPreview} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DetailContent — expanded detail preview
// ---------------------------------------------------------------------------

function DetailContent({ detail }: { detail: OpenLibraryDetailPreview }) {
  return (
    <div>
      {detail.coverUrl ? (
        <div
          style={{
            width: "100%",
            height: 150,
            background: `#f0f0f0 url(${detail.coverUrl}) center/contain no-repeat`,
            borderRadius: "6px",
            marginBottom: 8,
          }}
          title={`${detail.title} 封面`}
        />
      ) : null}

      {detail.description ? (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--lap-text-primary, #1c2430)", marginBottom: 4 }}>
            简介
          </div>
          <div style={{ fontSize: "0.8rem", lineHeight: 1.6 }}>
            {detail.description.length > 500
              ? detail.description.slice(0, 500) + "..."
              : detail.description}
          </div>
        </div>
      ) : null}

      {detail.subjects.length > 0 ? (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--lap-text-primary, #1c2430)", marginBottom: 4 }}>
            主题
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {detail.subjects.slice(0, 10).map((s, i) => (
              <span
                key={i}
                style={{
                  fontSize: "0.625rem",
                  padding: "1px 6px",
                  borderRadius: "999px",
                  background: "#f0f4ff",
                  color: "#4a6fa5",
                }}
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {detail.firstPublishDate ? (
        <div style={{ fontSize: "0.75rem", color: "var(--lap-text-muted, #6b7a93)", marginBottom: 4 }}>
          首次出版: {detail.firstPublishDate}
        </div>
      ) : null}

      {detail.sourceUrl ? (
        <a
          href={detail.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: "0.75rem",
            color: "var(--lap-accent, #2563eb)",
            textDecoration: "underline",
          }}
        >
          在 Open Library 查看
        </a>
      ) : null}

      <div
        style={{
          fontSize: "0.65rem",
          color: "#999",
          marginTop: 8,
          paddingTop: 8,
          borderTop: "1px solid #e8ecf1",
        }}
      >
        外部数据预览 · 未导入本地 · Open Library
      </div>
    </div>
  );
}
