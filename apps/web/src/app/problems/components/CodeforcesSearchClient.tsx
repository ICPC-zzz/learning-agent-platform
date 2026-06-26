"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";

import { searchCodeforcesProblems, type CodeforcesSearchInput, type CodeforcesSearchResult } from "../codeforces-actions";
import type { CodeforcesProblemPreview } from "../../../lib/codeforces-adapter";

interface CodeforcesSearchClientProps {
  guardBlocked: boolean;
  blockedReason: string | null;
  missingEnvNames: readonly string[];
}

const styles = {
  panel: {
    background: "#fafbfc",
    border: "1px solid #e4e8ee",
    borderRadius: "10px",
    padding: "20px",
  } as React.CSSProperties,
  searchRow: {
    display: "grid",
    gridTemplateColumns: "1.2fr 1fr 1fr 0.8fr",
    gap: "10px",
    alignItems: "end",
  } as React.CSSProperties,
  controlBlock: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "4px",
  } as React.CSSProperties,
  input: {
    minHeight: "38px",
    border: "1px solid #d8dee8",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "14px",
    width: "100%",
    boxSizing: "border-box" as const,
    background: "#fff",
  } as React.CSSProperties,
  actionRow: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "8px",
    marginTop: "12px",
  } as React.CSSProperties,
  badgeRow: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "6px",
    marginTop: "10px",
  } as React.CSSProperties,
  badge: {
    display: "inline-block",
    fontSize: "0.72rem",
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: "999px",
    background: "#e8ecf1",
    color: "#54657e",
  } as React.CSSProperties,
  badgeBlue: {
    display: "inline-block",
    fontSize: "0.72rem",
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: "999px",
    background: "#dbeafe",
    color: "#1e40af",
  } as React.CSSProperties,
  badgeGreen: {
    display: "inline-block",
    fontSize: "0.72rem",
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: "999px",
    background: "#dcfce7",
    color: "#166534",
  } as React.CSSProperties,
  badgeYellow: {
    display: "inline-block",
    fontSize: "0.72rem",
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: "999px",
    background: "#fef9c3",
    color: "#854d0e",
  } as React.CSSProperties,
  badgeRed: {
    display: "inline-block",
    fontSize: "0.72rem",
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: "999px",
    background: "#fee2e2",
    color: "#991b1b",
  } as React.CSSProperties,
  blockedPanel: {
    background: "#fff9e6",
    border: "1px solid #f0d77b",
    borderRadius: "8px",
    padding: "14px 16px",
    fontSize: "0.9rem",
    color: "#66561b",
  } as React.CSSProperties,
  errorPanel: {
    background: "#fff1f2",
    border: "1px solid #fda4af",
    borderRadius: "8px",
    padding: "14px 16px",
    fontSize: "0.9rem",
    color: "#9f1239",
  } as React.CSSProperties,
  emptyPanel: {
    padding: "20px",
    textAlign: "center" as const,
    color: "#64748b",
    fontSize: "0.95rem",
  } as React.CSSProperties,
  button: {
    padding: "8px 16px",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 600,
    background: "#0f172a",
    color: "#fff",
  } as React.CSSProperties,
  buttonSecondary: {
    padding: "8px 16px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 600,
    background: "#fff",
    color: "#0f172a",
  } as React.CSSProperties,
  buttonDisabled: {
    padding: "8px 16px",
    borderRadius: "8px",
    border: "1px solid #d8dee8",
    cursor: "not-allowed",
    fontSize: "13px",
    fontWeight: 600,
    background: "#f1f5f9",
    color: "#94a3b8",
  } as React.CSSProperties,
  paginationInfo: {
    fontSize: "0.85rem",
    color: "#64748b",
    marginRight: "12px",
  } as React.CSSProperties,
  card: {
    border: "1px solid #e4e8ee",
    borderRadius: "12px",
    padding: "16px",
    background: "#fff",
    display: "flex",
    flexDirection: "column" as const,
    gap: "10px",
  } as React.CSSProperties,
  tagChip: {
    display: "inline-block",
    background: "#e2e8f0",
    borderRadius: "4px",
    color: "#334155",
    fontSize: "11px",
    padding: "1px 6px",
    margin: "2px",
  } as React.CSSProperties,
};

export function CodeforcesSearchClient({
  guardBlocked,
  blockedReason,
  missingEnvNames,
}: CodeforcesSearchClientProps) {
  const formId = useId();
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("");
  const [minRating, setMinRating] = useState("");
  const [maxRating, setMaxRating] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error" | "empty">("idle");
  const [result, setResult] = useState<CodeforcesSearchResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const initialLoadDone = useRef(false);

  const doSearch = useCallback(
    async (targetPage: number) => {
      if (guardBlocked) {
        return;
      }

      setStatus("loading");
      setErrorMessage("");
      setWarnings([]);

      try {
        const input: CodeforcesSearchInput = {
          query: query.trim() || undefined,
          tag: tag.trim() || undefined,
          minRating: minRating ? Number(minRating) : undefined,
          maxRating: maxRating ? Number(maxRating) : undefined,
          page: targetPage,
          pageSize,
        };

        const res = await searchCodeforcesProblems(input);
        setResult(res);

        if (res.guardBlocked) {
          setStatus("error");
          setErrorMessage(res.error ?? "Codeforces API blocked");
          return;
        }

        if (!res.success) {
          setStatus("error");
          setErrorMessage(res.error ?? "Search failed");
          return;
        }

        setWarnings(res.warnings ?? []);
        setPage(res.page);
        if (res.results.length === 0) {
          setStatus("empty");
        } else {
          setStatus("success");
        }
      } catch (error) {
        setStatus("error");
        setErrorMessage(error instanceof Error ? error.message : "Search failed with an unknown error");
      }
    },
    [guardBlocked, maxRating, minRating, pageSize, query, tag],
  );

  useEffect(() => {
    if (guardBlocked || initialLoadDone.current) {
      return;
    }

    initialLoadDone.current = true;
    void doSearch(1);
  }, [doSearch, guardBlocked]);

  const isLoading = status === "loading";
  const hasResults = status === "success" && result !== null && result.results.length > 0;
  const totalMatched = result?.totalMatched ?? 0;

  return (
    <div style={{ display: "grid", gap: "14px" }}>
      <div style={styles.badgeRow}>
        <span style={styles.badgeBlue}>Codeforces 搜索</span>
        <span style={styles.badgeYellow}>只跳转原站</span>
        <span style={styles.badge}>不再导入本地库</span>
      </div>

      {guardBlocked ? (
        <div style={styles.blockedPanel} role="alert">
          <strong>Codeforces 搜索不可用</strong>
          <p style={{ margin: "6px 0" }}>
            当前环境缺少外部题库配置，页面只会暴露缺失的环境变量名。
          </p>
          {missingEnvNames.length > 0 ? (
            <ul style={{ marginTop: "6px", paddingLeft: "20px", fontSize: "0.85rem" }}>
              {missingEnvNames.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          ) : null}
          {blockedReason ? (
            <p style={{ marginTop: "8px", fontSize: "0.8rem", opacity: 0.8 }}>
              {blockedReason}
            </p>
          ) : null}
        </div>
      ) : (
        <>
          <div style={styles.panel}>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void doSearch(1);
              }}
            >
              <div style={styles.searchRow}>
                <div style={styles.controlBlock}>
                  <label htmlFor={`${formId}-query`} style={{ fontSize: "12px", color: "#64748b" }}>
                    关键字
                  </label>
                  <input
                    id={`${formId}-query`}
                    type="text"
                    value={query}
                    onChange={(event) => setQuery(event.currentTarget.value)}
                    placeholder="题目名称 / 关键词"
                    style={styles.input}
                    disabled={isLoading}
                  />
                </div>

                <div style={styles.controlBlock}>
                  <label htmlFor={`${formId}-tag`} style={{ fontSize: "12px", color: "#64748b" }}>
                    标签
                  </label>
                  <input
                    id={`${formId}-tag`}
                    type="text"
                    value={tag}
                    onChange={(event) => setTag(event.currentTarget.value)}
                    placeholder="dp, greedy, math"
                    style={styles.input}
                    disabled={isLoading}
                  />
                </div>

                <div style={styles.controlBlock}>
                  <label style={{ fontSize: "12px", color: "#64748b" }}>难度范围</label>
                  <div style={{ display: "flex", gap: "4px" }}>
                    <input
                      id={`${formId}-min-rating`}
                      type="number"
                      value={minRating}
                      onChange={(event) => setMinRating(event.currentTarget.value)}
                      placeholder="min"
                      style={{ ...styles.input, width: "50%" }}
                      min={800}
                      max={4000}
                      step={100}
                      disabled={isLoading}
                    />
                    <input
                      id={`${formId}-max-rating`}
                      type="number"
                      value={maxRating}
                      onChange={(event) => setMaxRating(event.currentTarget.value)}
                      placeholder="max"
                      style={{ ...styles.input, width: "50%" }}
                      min={800}
                      max={4000}
                      step={100}
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div style={styles.controlBlock}>
                  <label htmlFor={`${formId}-page-size`} style={{ fontSize: "12px", color: "#64748b" }}>
                    每页数量
                  </label>
                  <select
                    id={`${formId}-page-size`}
                    value={String(pageSize)}
                    onChange={(event) => {
                      setPageSize(Number(event.currentTarget.value));
                      setPage(1);
                    }}
                    style={{ ...styles.input, appearance: "auto" }}
                    disabled={isLoading}
                  >
                    <option value="5">5</option>
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                  </select>
                </div>
              </div>

              <div style={styles.actionRow}>
                <button type="submit" disabled={isLoading} style={isLoading ? styles.buttonDisabled : styles.button}>
                  {isLoading ? "搜索中..." : "搜索 Codeforces"}
                </button>
                <button
                  type="button"
                  disabled={isLoading || !result || page <= 1}
                  onClick={() => doSearch(Math.max(1, page - 1))}
                  style={isLoading || !result || page <= 1 ? styles.buttonDisabled : styles.buttonSecondary}
                >
                  上一页
                </button>
                <button
                  type="button"
                  disabled={isLoading || !result || !result.hasNextPage}
                  onClick={() => doSearch(page + 1)}
                  style={isLoading || !result || !result.hasNextPage ? styles.buttonDisabled : styles.buttonSecondary}
                >
                  下一页
                </button>
                {result && totalMatched > 0 ? (
                  <span style={styles.paginationInfo}>
                    第 {result.page}/{result.totalPages} 页，共 {totalMatched} 题
                  </span>
                ) : null}
              </div>
            </form>
          </div>

          {isLoading ? (
            <div style={styles.panel}>
              <p style={{ color: "#64748b", margin: 0 }}>正在请求 Codeforces API...</p>
            </div>
          ) : status === "error" ? (
            <div style={styles.errorPanel} role="alert">
              <strong>搜索失败</strong>
              <p style={{ margin: "6px 0" }}>{errorMessage || "未知错误"}</p>
              {warnings.length > 0 ? (
                <div style={{ marginTop: "6px", fontSize: "0.8rem" }}>
                  {warnings.map((warning, index) => (
                    <p key={index} style={{ margin: "2px 0" }}>
                      {warning}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : status === "empty" ? (
            <div style={styles.panel}>
              <div style={styles.emptyPanel}>
                <strong>没有找到匹配的题目。</strong>
                <p style={{ marginTop: "6px" }}>
                  试试其他关键词、标签或难度范围。
                </p>
              </div>
            </div>
          ) : status === "idle" ? (
            <div style={styles.panel}>
              <p style={{ color: "#64748b", margin: 0 }}>
                输入关键词或筛选条件，然后搜索 Codeforces。
              </p>
            </div>
          ) : null}
        </>
      )}

      {hasResults && result ? (
        <div style={{ display: "grid", gap: "10px" }}>
          <div style={styles.badgeRow}>
            <span style={styles.badgeGreen}>匹配 {result.totalMatched} 题</span>
            {warnings.length > 0 ? <span style={styles.badgeYellow}>{warnings.length} 条提示</span> : null}
          </div>

          {result.results.map((problem) => (
            <CodeforcesProblemCard key={problem.externalId} problem={problem} />
          ))}

          <div style={{ display: "flex", justifyContent: "center", gap: "8px", padding: "10px 0" }}>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => doSearch(Math.max(1, page - 1))}
              style={page <= 1 ? styles.buttonDisabled : styles.buttonSecondary}
            >
              上一页
            </button>
            <span style={{ padding: "8px 0", fontSize: "14px", color: "#64748b" }}>
              第 {result.page} / {result.totalPages} 页
            </span>
            <button
              type="button"
              disabled={!result.hasNextPage}
              onClick={() => doSearch(page + 1)}
              style={!result.hasNextPage ? styles.buttonDisabled : styles.buttonSecondary}
            >
              下一页
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CodeforcesProblemCard({ problem }: { problem: CodeforcesProblemPreview }) {
  const ratingColor = (rating: number | undefined): string => {
    if (rating === undefined) return "#94a3b8";
    if (rating < 1200) return "#94a3b8";
    if (rating < 1400) return "#22c55e";
    if (rating < 1600) return "#06b6d4";
    if (rating < 1900) return "#3b82f6";
    if (rating < 2100) return "#a855f7";
    if (rating < 2400) return "#f59e0b";
    return "#ef4444";
  };

  const formatSolvedCount = (value: number | undefined): string => {
    if (value === undefined) return "未知";
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return String(value);
  };

  return (
    <div style={styles.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", marginBottom: "4px" }}>
            {problem.contestId && problem.index ? (
              <span style={{ ...styles.badge, fontWeight: 700, fontFamily: "monospace" }}>
                {problem.contestId}{problem.index}
              </span>
            ) : null}
            <span style={{ fontWeight: 700, fontSize: "15px", color: "#1c2430" }}>
              {problem.name}
            </span>
            {problem.rating !== undefined ? (
              <span style={{ fontWeight: 700, color: ratingColor(problem.rating), fontSize: "13px" }}>
                {problem.rating}
              </span>
            ) : (
              <span style={{ color: "#94a3b8", fontSize: "12px" }}>未评级</span>
            )}
          </div>

          {problem.tags.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "3px", marginBottom: "6px" }}>
              {problem.tags.map((tag) => (
                <span key={tag} style={styles.tagChip}>
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          <div style={{ fontSize: "12px", color: "#64748b", display: "flex", gap: "12px", flexWrap: "wrap" }}>
            {problem.solvedCount !== undefined ? <span>通过: {formatSolvedCount(problem.solvedCount)}</span> : null}
            {problem.type ? <span>类型: {problem.type}</span> : null}
            <span>ID: {problem.externalId}</span>
          </div>

          <div style={{ marginTop: "8px" }}>
            <span style={styles.badgeYellow}>外部预览，点击跳转原题</span>
          </div>
        </div>

        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: "6px", alignItems: "flex-end" }}>
          {problem.sourceUrl ? (
            <a
              href={problem.sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              style={{
                ...styles.button,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              在 Codeforces 打开
            </a>
          ) : (
            <span style={styles.badgeRed}>缺少原题链接</span>
          )}
        </div>
      </div>
    </div>
  );
}
