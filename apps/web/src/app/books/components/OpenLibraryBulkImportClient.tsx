"use client";

/**
 * OpenLibraryBulkImportClient — Client component for bulk importing
 * Open Library programming books by category.
 *
 * States:
 * - Guard blocked: shows env setup instructions
 * - Import disabled: shows env instructions for dev import
 * - Idle: shows category buttons
 * - Loading: searching + importing
 * - Error: search/import failed
 * - Success: shows result summary
 *
 * @previewOnly — dev-only bulk import
 */

import { useState, useCallback, type CSSProperties } from "react";
import {
  openLibraryBulkImportAction,
  type OpenLibraryBulkImportResult,
  type BulkImportItemResult,
} from "../open-library-bulk-import-actions";
import { getBulkImportCategories } from "../programming-categories";

export interface OpenLibraryBulkImportClientProps {
  importEnabled: boolean;
  importBlockedReason: string | null;
  olGuardAllowed: boolean;
  olGuardBlockedReason: string | null;
}

const sectionCardStyle: CSSProperties = {
  background: "var(--lap-surface, #ffffff)",
  border: "1px solid var(--lap-border, #d8dee8)",
  borderRadius: "12px",
  padding: "var(--lap-space-5, 20px)",
};

const categoryGridStyle: CSSProperties = {
  display: "flex", flexWrap: "wrap", gap: "8px",
  marginBottom: "var(--lap-space-3, 12px)",
};

const categoryBtnStyle: CSSProperties = {
  padding: "6px 14px", borderRadius: "8px",
  border: "1px solid var(--lap-border, #d8dee8)",
  background: "var(--lap-surface, #ffffff)",
  color: "var(--lap-text-primary, #1c2430)",
  cursor: "pointer", fontSize: "0.8rem", fontWeight: 500, whiteSpace: "nowrap",
};

const categoryBtnActiveStyle: CSSProperties = {
  ...categoryBtnStyle, background: "#2563eb", color: "#ffffff", borderColor: "#2563eb",
};

const blockedPanelStyle: CSSProperties = {
  background: "#f0f7ff", border: "1px solid #93c5fd",
  borderRadius: "8px", padding: "14px 16px", fontSize: "0.85rem",
  color: "#1e40af", lineHeight: 1.7, marginBottom: "12px",
};

const resultCardStyle: CSSProperties = {
  marginTop: "12px", padding: "12px", borderRadius: "8px",
  border: "1px solid var(--lap-border, #d8dee8)", fontSize: "0.85rem",
};

const loadingStyle: CSSProperties = {
  textAlign: "center", padding: "16px",
  color: "var(--lap-text-muted, #6b7a93)", fontSize: "0.875rem",
};

const errorStyle: CSSProperties = {
  padding: "12px", background: "#fef0f0", border: "1px solid #ffcdd2",
  borderRadius: "8px", color: "#b71c1c", fontSize: "0.85rem",
};

export function OpenLibraryBulkImportClient({
  importEnabled, importBlockedReason, olGuardAllowed, olGuardBlockedReason,
}: OpenLibraryBulkImportClientProps) {
  const categories = getBulkImportCategories();
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<OpenLibraryBulkImportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const handleImport = useCallback(async (category: string) => {
    if (!importEnabled || !olGuardAllowed) return;
    setIsLoading(true); setErrorMessage(""); setResult(null);
    setActiveCategory(category);
    try {
      const res = await openLibraryBulkImportAction({ category, maxBooks: 3 });
      setResult(res);
      if (!res.success && res.items.length === 0) {
        const msg = res.message || '';
        if (msg.indexOf('OL_TIMEOUT') >= 0 || msg.indexOf('timeout') >= 0 || msg.indexOf('timed out') >= 0) {
          setErrorMessage('Open Library 请求超时。这通常是网络连通性问题，请检查网络连接或稍后重试。');
        } else {
          setErrorMessage(res.message);
        }
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "批量导入失败");
    } finally {
      setIsLoading(false);
    }
  }, [importEnabled, olGuardAllowed]);

  // Build env setup instructions
  const envHints: string[] = [];
  if (!olGuardAllowed) {
    envHints.push("LAP_ALLOW_EXTERNAL_BOOK_API=true");
    envHints.push("LAP_BOOK_API_BASE_URL=https://openlibrary.org");
    envHints.push("LAP_BOOK_API_PROVIDER=open-library");
  }
  if (olGuardAllowed && !importEnabled) {
    envHints.push("LAP_ALLOW_DEV_BOOK_IMPORT=true");
  }
  envHints.push("LAP_IMPORT_DB_PERSIST_DEV_ENABLED=true");
  envHints.push("LAP_ALLOW_REAL_DB_INTEGRATION=true");

  return (
    <div style={sectionCardStyle}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexWrap: "wrap", gap: "8px", marginBottom: "12px",
      }}>
        <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--lap-text-primary)", margin: 0 }}>
          Open Library 批量导入
        </h3>
        {olGuardAllowed && importEnabled ? (
          <span style={{
            display: "inline-block", fontSize: "0.65rem", fontWeight: 600,
            padding: "2px 8px", borderRadius: "999px", background: "#e8f5e9", color: "#2e7d32",
          }}>
            已启用
          </span>
        ) : (
          <span style={{
            display: "inline-block", fontSize: "0.65rem", fontWeight: 600,
            padding: "2px 8px", borderRadius: "999px", background: "#fff3e0", color: "#e65100",
          }}>
            未启用
          </span>
        )}
      </div>

      <p style={{ fontSize: "0.8rem", color: "var(--lap-text-muted)", margin: "0 0 12px 0" }}>
        选择一个分类，导入 Open Library 中对应的编程书籍（最多 3 本）。导入的书籍包含元数据说明章节，不含完整正文。
      </p>

      {/* Environmental setup instructions */}
      {(!olGuardAllowed || !importEnabled) ? (
        <div style={blockedPanelStyle}>
          <strong>批量导入需要配置环境变量</strong>
          {olGuardBlockedReason ? (
            <div style={{ marginTop: 4, fontSize: "0.8rem" }}>{olGuardBlockedReason}</div>
          ) : null}
          {importBlockedReason ? (
            <div style={{ marginTop: 4, fontSize: "0.8rem" }}>{importBlockedReason}</div>
          ) : null}
          <div style={{ marginTop: 8 }}>
            <div style={{ fontWeight: 600, fontSize: "0.75rem", marginBottom: 4 }}>请在 .env.local 中添加：</div>
            {envHints.map(function(h, i) { return (
              <code key={i} style={{
                display: "block", fontSize: "0.72rem", padding: "2px 0",
                color: "#1e40af", fontFamily: "monospace",
              }}>{h}</code>
            ); })}
          </div>
        </div>
      ) : null}

      {/* Category buttons */}
      <div style={categoryGridStyle}>
        {categories.map(function(cat) { return (
          <button key={cat} onClick={function() { return handleImport(cat); }}
            disabled={isLoading || !importEnabled || !olGuardAllowed}
            style={activeCategory === cat ? categoryBtnActiveStyle : {
              ...categoryBtnStyle,
              ...((!importEnabled || !olGuardAllowed) ? { opacity: 0.5, cursor: "not-allowed" } : {}),
            }}
          >{cat}</button>
        ); })}
      </div>

      {isLoading ? (<div style={loadingStyle}>正在从 Open Library 搜索并导入「{activeCategory}」分类的书籍...</div>) : null}
      {errorMessage && !isLoading ? (<div style={errorStyle}>{errorMessage}</div>) : null}
      {result && !isLoading ? (<ResultSummary result={result} />) : null}
    </div>
  );
}

function ResultSummary({ result }: { result: OpenLibraryBulkImportResult }) {
  if (result.totalRequested === 0 && result.items.length === 0) {
    return (
      <div style={{ ...resultCardStyle, background: "#f9fafb" }}>
        <p style={{ margin: 0, color: "var(--lap-text-muted)" }}>{result.message}</p>
      </div>
    );
  }
  return (
    <div style={resultCardStyle}>
      <div style={{ display: "flex", gap: "16px", marginBottom: "12px", flexWrap: "wrap" }}>
        <StatBadge label="总计" value={result.totalRequested} color="#4a6fa5" />
        <StatBadge label="新创建" value={result.created} color="#16a34a" />
        <StatBadge label="已存在" value={result.existing} color="#f59e0b" />
        {result.failed > 0 ? (<StatBadge label="失败" value={result.failed} color="#ef4444" />) : null}
      </div>
      {result.items.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {result.items.map(function(item, idx) { return (<ItemRow key={idx} item={item} />); })}
        </div>
      ) : null}
      <p style={{ margin: "12px 0 0", fontSize: "0.75rem", color: "var(--lap-text-muted)" }}>{result.message}</p>
    </div>
  );
}

function StatBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.8rem" }}>
      <span style={{ color: "var(--lap-text-muted)" }}>{label}</span>
      <span style={{ fontWeight: 700, color, background: color + "15", padding: "2px 8px", borderRadius: "4px" }}>{value}</span>
    </div>
  );
}

function ItemRow({ item }: { item: BulkImportItemResult }) {
  var statusColors: Record<string, string> = { created: "#16a34a", existing: "#f59e0b", failed: "#ef4444" };
  var statusLabels: Record<string, string> = { created: "已创建", existing: "已存在", failed: "失败" };
  var color = statusColors[item.status] || "#999";
  var label = statusLabels[item.status] || item.status;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.8rem", padding: "6px 10px", borderRadius: "6px", background: "#f9fafb" }}>
      <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: color, flexShrink: 0 }} />
      <span style={{ flex: 1, fontWeight: 500 }}>{item.title}</span>
      <span style={{ fontSize: "0.7rem", padding: "1px 6px", borderRadius: "4px", background: color + "15", color, fontWeight: 600 }}>{label}</span>
      {item.detailLink ? (<a href={item.detailLink} style={{ fontSize: "0.7rem", color: "#2563eb", textDecoration: "underline" }}>查看</a>) : null}
    </div>
  );
}
