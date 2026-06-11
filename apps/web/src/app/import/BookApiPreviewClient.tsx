"use client";

import {
  createOpenLibraryBookSourceProvider,
  type BookSourceProvider,
} from "@learning-agent-platform/book-engine";
import { useId, useState, type CSSProperties } from "react";

import { previewBookApiSearch, type BookApiPreviewBookViewModel, type BookApiPreviewViewModel } from "./book-api-preview";
import {
  createBlockedUIState,
  createErrorUIState,
  createIdleUIState,
  createLoadingUIState,
  createSuccessUIState,
  SAFETY_BADGE_LABELS,
  type BookApiPreviewUIState,
} from "./book-api-preview-view-model";

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const formStackStyle: CSSProperties = {
  display: "grid",
  gap: "12px",
};

const searchRowStyle: CSSProperties = {
  display: "flex",
  gap: "8px",
  alignItems: "center",
};

const inputStyle: CSSProperties = {
  flex: 1,
  minHeight: "38px",
  border: "1px solid #d8dee8",
  borderRadius: "8px",
  color: "#1c2430",
  font: "inherit",
  padding: "8px 12px",
};

const badgeRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "6px",
  marginTop: "4px",
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

const blockedBadgeStyle: CSSProperties = {
  display: "inline-block",
  fontSize: "0.7rem",
  fontWeight: 600,
  padding: "2px 8px",
  borderRadius: "999px",
  background: "#fff3cd",
  color: "#856404",
};

const resultCardStyle: CSSProperties = {
  border: "1px solid #e2e6ed",
  borderRadius: "8px",
  padding: "12px",
  display: "grid",
  gap: "4px",
};

const blockedPanelStyle: CSSProperties = {
  background: "#fff9e6",
  border: "1px solid #f0d77b",
  borderRadius: "8px",
  padding: "14px 16px",
  fontSize: "0.9rem",
  color: "#66561b",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface BookApiPreviewClientProps {
  /** Whether the Book API is enabled via env configuration (default: false). */
  apiEnabled?: boolean;
  /** Provider type string (default: "open-library"). */
  providerType?: string;
  /** Override the base URL (default: reads from env or uses Open Library default). */
  baseUrl?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BookApiPreviewClient({
  apiEnabled = false,
  providerType = "open-library",
  baseUrl,
}: BookApiPreviewClientProps) {
  const formId = useId();
  const [query, setQuery] = useState("");
  const [uiState, setUIState] = useState<BookApiPreviewUIState>(() => {
    // Build the initial provider to check guard status
    const provider = buildProvider(apiEnabled, providerType, baseUrl);
    const guardStatus = provider.getGuardStatus();
    if (guardStatus.guardBlocked) {
      return createBlockedUIState(guardStatus.blockedReasons);
    }
    return createIdleUIState();
  });

  const isBlocked = uiState.status === "blocked";
  const isLoading = uiState.status === "loading";

  async function handleSearch() {
    if (!query.trim()) return;

    const provider = buildProvider(apiEnabled, providerType, baseUrl);
    const guardStatus = provider.getGuardStatus();

    if (guardStatus.guardBlocked) {
      setUIState(createBlockedUIState(guardStatus.blockedReasons));
      return;
    }

    setUIState(createLoadingUIState());

    try {
      const result = await previewBookApiSearch(provider, {
        query: query.trim(),
        maxResults: 10,
      });

      if (result.apiBlocked) {
        setUIState(createBlockedUIState(result.blockedReasons));
      } else {
        setUIState(createSuccessUIState(result));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "查询外部书源时发生未知错误";
      setUIState(createErrorUIState(message));
    }
  }

  return (
    <div className="dashboardGrid" style={{ marginTop: "24px" }}>
      {/* Left panel: search controls */}
      <section className="learningPanel askAiPanel" aria-labelledby="book-api-search-title">
        <p className="eyebrow">A403 外部书源预览</p>
        <h2 id="book-api-search-title">Book API 预览</h2>
        <p className="panelNote">
          开发预览 — 外部书籍 API 默认关闭，未调用 LLM，未写入数据库，
          未导入真实书籍，不保存原始响应，仅展示 normalized metadata。
        </p>

        <div style={{ marginTop: "14px" }}>
          <div style={searchRowStyle}>
            <input
              id={`${formId}-query`}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
              placeholder="输入书名或关键词搜索 Open Library..."
              style={inputStyle}
              disabled={isBlocked || isLoading}
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={isBlocked || isLoading || !query.trim()}
            >
              {isLoading ? "搜索中..." : "搜索"}
            </button>
          </div>
        </div>

        {/* Safety badges */}
        <div style={badgeRowStyle}>
          <span style={badgeStyle}>{SAFETY_BADGE_LABELS.devPreview}</span>
          <span style={isBlocked ? blockedBadgeStyle : badgeStyle}>
            {SAFETY_BADGE_LABELS.externalApiDisabled}
          </span>
          <span style={badgeStyle}>{SAFETY_BADGE_LABELS.noLLM}</span>
          <span style={badgeStyle}>{SAFETY_BADGE_LABELS.noDB}</span>
          <span style={badgeStyle}>{SAFETY_BADGE_LABELS.noImport}</span>
          <span style={badgeStyle}>{SAFETY_BADGE_LABELS.noRawResponse}</span>
          <span style={badgeStyle}>{SAFETY_BADGE_LABELS.normalizedOnly}</span>
        </div>
      </section>

      {/* Right panel: status / results */}
      <section className="learningPanel" aria-labelledby="book-api-status-title">
        <p className="eyebrow">A403 预览结果</p>
        <h2 id="book-api-status-title">书源查询状态</h2>

        {isBlocked ? (
          <BlockedNotice reasons={uiState.errorMessage ? [uiState.errorMessage] : []} />
        ) : uiState.status === "idle" ? (
          <p className="panelNote" style={{ padding: "16px 0" }}>
            输入书名后点击搜索，查看 Open Library 外部书源返回的 normalized metadata。
            当前为开发预览，不会真实导入书籍。
          </p>
        ) : isLoading ? (
          <p className="panelNote" style={{ padding: "16px 0" }}>
            正在查询外部书源...
          </p>
        ) : uiState.status === "error" ? (
          <div className="learningEmptyState" role="alert">
            <strong>查询失败</strong>
            <p>{uiState.errorMessage}</p>
          </div>
        ) : uiState.preview ? (
          <PreviewResults preview={uiState.preview} />
        ) : null}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function BlockedNotice({ reasons }: { reasons: string[] }) {
  return (
    <div style={blockedPanelStyle} role="alert">
      <strong>外部书籍 API 当前未启用</strong>
      <p style={{ marginTop: "6px" }}>
        外部书籍 API（Open Library 开发预览）默认关闭。如需启用，请配置以下环境变量：
      </p>
      <ul style={{ marginTop: "6px", paddingLeft: "20px", fontSize: "0.85rem" }}>
        <li>LAP_BOOK_API_DEV_ENABLED=1</li>
        <li>LAP_ALLOW_EXTERNAL_BOOK_API=1</li>
        <li>LAP_BOOK_API_BASE_URL=https://openlibrary.org</li>
        <li>LAP_BOOK_API_PROVIDER=open-library</li>
      </ul>
      {reasons.length > 0 ? (
        <p style={{ marginTop: "8px", fontSize: "0.8rem", opacity: 0.8 }}>
          {reasons[0]}
        </p>
      ) : null}
    </div>
  );
}

function PreviewResults({ preview }: { preview: BookApiPreviewViewModel }) {
  return (
    <div style={{ marginTop: "12px" }}>
      <dl className="scoreMeta">
        <SummaryRow label="搜索词" value={preview.query} />
        <SummaryRow
          label="外部 API 已查询"
          value={preview.externalApiQueried ? "是（fake fetch / 测试环境）" : "否"}
        />
        <SummaryRow label="结果数" value={preview.totalResults} />
        <SummaryRow label="LLM 调用" value="否（llmUsed=false）" />
        <SummaryRow label="数据库写入" value="否（writesDatabase=false）" />
        <SummaryRow label="原始响应保存" value="否（rawResponseStored=false）" />
      </dl>

      {preview.books.length > 0 ? (
        <div style={{ marginTop: "16px", display: "grid", gap: "10px" }}>
          {preview.books.map((book) => (
            <BookResultCard key={book.externalBookId} book={book} />
          ))}
        </div>
      ) : (
        <div className="learningEmptyState" style={{ marginTop: "16px" }}>
          <strong>未找到匹配的书籍。</strong>
          {preview.fallbackSuggestions.length > 0 ? (
            <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
              {preview.fallbackSuggestions.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </div>
  );
}

function BookResultCard({ book }: { book: BookApiPreviewBookViewModel }) {
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
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : null}
        <div style={{ minWidth: 0 }}>
          <strong style={{ fontSize: "0.95rem", color: "#1c2430" }}>{book.title}</strong>
          <p style={{ fontSize: "0.85rem", color: "#54657e", marginTop: "2px" }}>
            {book.authors.length > 0 ? book.authors.join(", ") : "未知作者"}
            {" · "}
            语言：{book.language || "unknown"}
          </p>
          {book.description ? (
            <p style={{ fontSize: "0.8rem", color: "#6c7483", marginTop: "4px", lineHeight: 1.4 }}>
              {book.description.length > 200
                ? book.description.slice(0, 197) + "..."
                : book.description}
            </p>
          ) : null}
          <div style={{ marginTop: "6px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <span style={badgeStyle}>ID: {book.externalBookId}</span>
            {book.licenseHint !== "unknown" ? (
              <span style={badgeStyle}>{book.licenseHint}</span>
            ) : null}
            <span style={{ ...badgeStyle, background: "#ffe0e0", color: "#a33" }}>
              不可导入（importable=false）
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build an OpenLibraryBookSourceProvider with the given configuration.
 * When apiEnabled is false, all guards are forced off regardless of any
 * provided baseUrl/providerType.
 */
function buildProvider(
  apiEnabled: boolean,
  providerType: string,
  baseUrl?: string,
): BookSourceProvider {
  if (!apiEnabled) {
    return createOpenLibraryBookSourceProvider({
      env: {
        bookApiDevEnabled: false,
        allowExternalBookApi: false,
        bookApiBaseUrl: null,
        bookApiProvider: null,
      },
    });
  }

  return createOpenLibraryBookSourceProvider({
    env: {
      bookApiDevEnabled: true,
      allowExternalBookApi: true,
      bookApiBaseUrl: baseUrl || "https://openlibrary.org",
      bookApiProvider: providerType,
    },
  });
}
