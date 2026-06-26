"use client";

import React, { useState, useCallback } from "react";
import { bulkImportCodeforcesAction } from "../codeforces-bulk-import-actions";
import type { CodeforcesBulkImportResult, CodeforcesBulkImportItemResult } from "../codeforces-bulk-import-actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CodeforcesBulkImportClientProps {
  /** Whether Codeforces API guard is enabled */
  cfEnabled: boolean;
  /** Whether dev import guard is enabled */
  importEnabled: boolean;
  /** Reason import is blocked */
  importBlockedReason: string | null;
}

// ---------------------------------------------------------------------------
// Predefined tags and rating ranges
// ---------------------------------------------------------------------------

const BULK_TAGS = [
  { key: "dp", label: "DP" },
  { key: "greedy", label: "Greedy" },
  { key: "math", label: "Math" },
  { key: "implementation", label: "实现" },
  { key: "data structures", label: "数据结构" },
  { key: "graphs", label: "图论" },
  { key: "strings", label: "字符串" },
  { key: "binary search", label: "二分" },
  { key: "constructive algorithms", label: "构造" },
];

const BULK_RATING_RANGES = [
  { key: "", label: "全部", min: undefined, max: undefined },
  { key: "800-1200", label: "800–1200", min: 800, max: 1200 },
  { key: "1200-1600", label: "1200–1600", min: 1200, max: 1600 },
  { key: "1600-2000", label: "1600–2000", min: 1600, max: 2000 },
  { key: "2000+", label: "2000+", min: 2000, max: undefined },
];

const MAX_COUNT_OPTIONS = [
  { value: 3, label: "最多 3 题" },
  { value: 5, label: "最多 5 题" },
  { value: 10, label: "最多 10 题" },
];

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = {
  panel: {
    background: "#fafbfc",
    border: "1px solid #e4e8ee",
    borderRadius: "10px",
    padding: "20px",
  } as React.CSSProperties,
  chipRow: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "6px",
    marginTop: "8px",
  },
  chip: {
    border: "1px solid #e2e8f0",
    borderRadius: "14px",
    background: "#f1f5f9",
    color: "#475569",
    cursor: "pointer",
    fontSize: "12px",
    padding: "4px 12px",
    transition: "all 0.1s",
    fontWeight: 500,
  } as React.CSSProperties,
  chipActive: {
    border: "1px solid #0f172a",
    borderRadius: "14px",
    background: "#0f172a",
    color: "#f1f5f9",
    cursor: "pointer",
    fontSize: "12px",
    padding: "4px 12px",
    transition: "all 0.1s",
    fontWeight: 600,
  } as React.CSSProperties,
  importButton: {
    background: "#0f172a",
    border: "none",
    borderRadius: "6px",
    color: "#fff",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: 600,
    padding: "10px 24px",
  } as React.CSSProperties,
  importButtonDisabled: {
    background: "#f1f5f9",
    border: "1px solid #d8dee8",
    borderRadius: "6px",
    color: "#94a3b8",
    cursor: "not-allowed",
    fontSize: "14px",
    fontWeight: 600,
    padding: "10px 24px",
  } as React.CSSProperties,
  resultBox: {
    marginTop: "12px",
    padding: "12px 16px",
    borderRadius: "8px",
    fontSize: "13px",
  },
  itemRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 0",
    borderBottom: "1px solid #f1f5f9",
    fontSize: "12px",
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CodeforcesBulkImportClient({
  cfEnabled,
  importEnabled,
  importBlockedReason,
}: CodeforcesBulkImportClientProps) {
  const [selectedTag, setSelectedTag] = useState("");
  const [selectedRatingRange, setSelectedRatingRange] = useState("");
  const [maxCount, setMaxCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CodeforcesBulkImportResult | null>(null);
  const [error, setError] = useState("");

  const canImport = cfEnabled && importEnabled;

  const handleImport = useCallback(async () => {
    if (!canImport || loading) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      // Find the rating range values
      const ratingRange = BULK_RATING_RANGES.find((r) => r.key === selectedRatingRange);
      const res = await bulkImportCodeforcesAction({
        tag: selectedTag || undefined,
        minRating: ratingRange?.min,
        maxRating: ratingRange?.max,
        maxCount,
      });

      setResult(res);
      if (!res.success) {
        setError(res.message);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "批量导入失败");
    } finally {
      setLoading(false);
    }
  }, [canImport, loading, selectedTag, selectedRatingRange, maxCount]);

  const isReady = selectedTag || selectedRatingRange;

  return (
    <div style={styles.panel}>
      <h3 style={{ fontSize: "16px", margin: "0 0 4px 0" }}>Codeforces 批量导入</h3>
      <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 12px 0" }}>
        选择标签或难度范围，一键批量导入 Codeforces 题目到本地题库。
      </p>

      {!cfEnabled ? (
        <div
          style={{
            background: "#fff9e6",
            border: "1px solid #f0d77b",
            borderRadius: "8px",
            padding: "12px 16px",
            fontSize: "13px",
            color: "#66561b",
          }}
        >
          Codeforces API 未配置。需要设置环境变量 LAP_ALLOW_EXTERNAL_PROBLEM_API 等。
        </div>
      ) : !importEnabled ? (
        <div
          style={{
            background: "#fff9e6",
            border: "1px solid #f0d77b",
            borderRadius: "8px",
            padding: "12px 16px",
            fontSize: "13px",
            color: "#66561b",
          }}
        >
          题目导入未启用。{importBlockedReason ?? "设置 LAP_ALLOW_DEV_PROBLEM_IMPORT=true 以启用。"}
        </div>
      ) : (
        <>
          {/* Tag selection */}
          <div>
            <label style={{ fontSize: "13px", color: "#475569", fontWeight: 600 }}>按标签导入</label>
            <div style={styles.chipRow}>
              {BULK_TAGS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setSelectedTag(selectedTag === key ? "" : key)}
                  style={selectedTag === key ? styles.chipActive : styles.chip}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Rating range selection */}
          <div style={{ marginTop: "12px" }}>
            <label style={{ fontSize: "13px", color: "#475569", fontWeight: 600 }}>按难度范围导入</label>
            <div style={styles.chipRow}>
              {BULK_RATING_RANGES.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setSelectedRatingRange(selectedRatingRange === key ? "" : key)}
                  style={selectedRatingRange === key ? styles.chipActive : styles.chip}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Max count */}
          <div style={{ marginTop: "12px" }}>
            <label style={{ fontSize: "13px", color: "#475569", fontWeight: 600, marginRight: "8px" }}>
              导入数量
            </label>
            {MAX_COUNT_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setMaxCount(value)}
                style={{
                  ...(maxCount === value ? styles.chipActive : styles.chip),
                  marginRight: "6px",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Import button */}
          <div style={{ marginTop: "16px" }}>
            <button
              onClick={handleImport}
              disabled={loading || !isReady}
              style={loading || !isReady ? styles.importButtonDisabled : styles.importButton}
            >
              {loading
                ? "导入中..."
                : !isReady
                  ? "选择标签或难度范围"
                  : selectedTag
                    ? `导入 ${selectedTag} 前 ${maxCount} 题`
                    : `导入前 ${maxCount} 题`}
            </button>
          </div>

          {/* Error */}
          {error ? (
            <div
              style={{
                ...styles.resultBox,
                background: "#fff1f2",
                border: "1px solid #fda4af",
                color: "#9f1239",
              }}
            >
              {error}
            </div>
          ) : null}

          {/* Results */}
          {result ? (
            <div>
              <div
                style={{
                  ...styles.resultBox,
                  background: result.created > 0 || result.existing > 0 ? "#dcfce7" : "#f8fafc",
                  border: result.created > 0 || result.existing > 0
                    ? "1px solid #86efac"
                    : "1px solid #e2e8f0",
                }}
              >
                <strong>{result.message}</strong>
                <div style={{ marginTop: "4px", display: "flex", gap: "12px" }}>
                  {result.created > 0 ? (
                    <span style={{ color: "#166534" }}>✓ 新建 {result.created} 题</span>
                  ) : null}
                  {result.existing > 0 ? (
                    <span style={{ color: "#92400e" }}>⚠ 已存在 {result.existing} 题</span>
                  ) : null}
                  {result.failed > 0 ? (
                    <span style={{ color: "#dc2626" }}>✗ 失败 {result.failed} 题</span>
                  ) : null}
                </div>
              </div>

              {/* Per-item results */}
              {result.items.length > 0 ? (
                <div style={{ marginTop: "8px" }}>
                  {result.items.map((item) => (
                    <div key={item.externalId} style={styles.itemRow}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: 600 }}>{item.name}</span>
                        {item.rating ? (
                          <span style={{ marginLeft: "6px", fontSize: "11px", color: "#64748b" }}>
                            {item.rating}
                          </span>
                        ) : null}
                        {item.tags.length > 0 ? (
                          <span style={{ marginLeft: "6px", fontSize: "10px", color: "#94a3b8" }}>
                            {item.tags.slice(0, 3).join(", ")}
                          </span>
                        ) : null}
                      </div>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 600,
                            color: item.status === "created" ? "#166534"
                              : item.status === "existing" ? "#92400e"
                              : "#dc2626",
                          }}
                        >
                          {item.status === "created" ? "已导入"
                            : item.status === "existing" ? "已存在"
                            : "失败"}
                        </span>
                        {item.detailLink ? (
                          <a
                            href={item.detailLink}
                            style={{ fontSize: "11px", color: "#3b82f6" }}
                          >
                            查看详情 →
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {/* No results message */}
              {result.items.length === 0 && !result.guardBlocked ? (
                <p style={{ fontSize: "12px", color: "#64748b", marginTop: "8px" }}>
                  没有匹配的题目可导入。尝试更换标签或难度范围。
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
