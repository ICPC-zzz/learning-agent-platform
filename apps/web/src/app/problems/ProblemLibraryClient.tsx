"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";

import { SAMPLE_PROBLEMS } from "../app/problems/sample-programming-problems";
import {
  filterProblems,
  computeProblemLibraryStats,
  type ProblemFilterCriteria,
} from "../app/problems/problem-library-filter";
import {
  loadFavorites,
  isFavoriteProblem,
  addFavoriteProblem,
  removeFavoriteProblem,
  persistFavorites,
  loadRecentPractice,
  addRecentPractice,
  persistRecentPractice,
  type FavoriteProblemEntry,
  type RecentPracticeEntry,
} from "../lib/local-user-problem-store";
import type { SampleProgrammingProblem } from "../app/problems/sample-programming-problems";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProblemLibraryClientProps {
  dbFavoritesEnabled?: boolean;
  devSessionOwnerId?: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProblemLibraryClient({
  dbFavoritesEnabled = false,
  devSessionOwnerId = null,
}: ProblemLibraryClientProps) {
  const [query, setQuery] = useState("");
  const [diffFilter, setDiffFilter] = useState("");
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [localFavs, setLocalFavs] = useState<FavoriteProblemEntry[]>([]);
  const [localPractice, setLocalPractice] = useState<RecentPracticeEntry[]>([]);
  const [mounted, setMounted] = useState(false);

  // Load localStorage on mount (client-only)
  // We use a lazy init pattern to avoid hydration issues
  if (!mounted) {
    setLocalFavs(loadFavorites());
    setLocalPractice(loadRecentPractice());
    setMounted(true);
  }

  const criteria: ProblemFilterCriteria = useMemo(() => {
    const c: ProblemFilterCriteria = {};
    if (query.trim()) c.query = query.trim();
    if (diffFilter) c.difficulty = diffFilter;
    if (tagFilters.length > 0) c.tags = tagFilters;
    return c;
  }, [query, diffFilter, tagFilters]);

  const filtered = useMemo(
    () => filterProblems(SAMPLE_PROBLEMS, criteria),
    [criteria],
  );

  const stats = useMemo(
    () => computeProblemLibraryStats(SAMPLE_PROBLEMS, filtered),
    [filtered],
  );

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const p of SAMPLE_PROBLEMS) {
      for (const t of p.tags) set.add(t);
    }
    return Array.from(set).sort();
  }, []);

  const toggleTagFilter = useCallback((tag: string) => {
    setTagFilters((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }, []);

  const clearFilters = useCallback(() => {
    setQuery("");
    setDiffFilter("");
    setTagFilters([]);
  }, []);

  const toggleFavorite = useCallback((problem: SampleProgrammingProblem) => {
    setLocalFavs((prev) => {
      if (isFavoriteProblem(prev, problem.problemId)) {
        const next = removeFavoriteProblem(prev, problem.problemId);
        persistFavorites(next);
        return next;
      }
      const entry: FavoriteProblemEntry = {
        problemId: problem.problemId,
        title: problem.title,
        difficulty: problem.difficulty,
        tags: problem.tags,
        favoritedAt: new Date().toISOString(),
      };
      const next = addFavoriteProblem(prev, entry);
      persistFavorites(next);
      return next;
    });
  }, []);

  const markPracticed = useCallback((problem: SampleProgrammingProblem) => {
    setLocalPractice((prev) => {
      const entry: RecentPracticeEntry = {
        problemId: problem.problemId,
        title: problem.title,
        difficulty: problem.difficulty,
        status: "practiced",
        updatedAt: new Date().toISOString(),
      };
      const next = addRecentPractice(prev, entry);
      persistRecentPractice(next);
      return next;
    });
  }, []);

  const favSet = useMemo(
    () => new Set(localFavs.map((f) => f.problemId)),
    [localFavs],
  );

  const practiceMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of localPractice) m.set(p.problemId, p.status);
    return m;
  }, [localPractice]);

  const difficultyBadge = (d: string) => {
    const colors: Record<string, string> = {
      easy: "#16a34a",
      medium: "#d97706",
      hard: "#dc2626",
      challenge: "#7c3aed",
    };
    return (
      <span
        style={{
          background: colors[d] ?? "#64748b",
          borderRadius: "4px",
          color: "#fff",
          fontSize: "11px",
          fontWeight: 600,
          padding: "2px 8px",
          textTransform: "uppercase",
        }}
      >
        {d}
      </span>
    );
  };

  return (
    <div>
      {/* Search & Filter */}
      <div style={{ marginBottom: "18px" }}>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="search"
            placeholder="搜索题目标题、难度、标签..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
              flex: "1 1 260px",
              fontSize: "14px",
              padding: "8px 12px",
            }}
          />
          <select
            value={diffFilter}
            onChange={(e) => setDiffFilter(e.target.value)}
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
              fontSize: "14px",
              padding: "8px 12px",
              minWidth: "120px",
            }}
          >
            <option value="">所有难度</option>
            <option value="easy">easy</option>
            <option value="medium">medium</option>
            <option value="hard">hard</option>
            <option value="challenge">challenge</option>
          </select>
          {(query || diffFilter || tagFilters.length > 0) ? (
            <button
              onClick={clearFilters}
              style={{
                background: "#f1f5f9",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                color: "#475569",
                cursor: "pointer",
                fontSize: "13px",
                padding: "8px 14px",
              }}
            >
              清除筛选
            </button>
          ) : null}
        </div>

        {/* Tag filter chips */}
        <div style={{ marginTop: "10px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {allTags.map((tag) => {
            const active = tagFilters.includes(tag);
            return (
              <button
                key={tag}
                onClick={() => toggleTagFilter(tag)}
                style={{
                  background: active ? "#0f172a" : "#f1f5f9",
                  border: active ? "1px solid #0f172a" : "1px solid #e2e8f0",
                  borderRadius: "14px",
                  color: active ? "#f1f5f9" : "#475569",
                  cursor: "pointer",
                  fontSize: "12px",
                  padding: "3px 12px",
                  transition: "all 0.1s",
                }}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      {/* Stats Summary */}
      <div
        style={{
          marginBottom: "16px",
          padding: "12px 16px",
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: "8px",
        }}
      >
        <p style={{ fontSize: "13px", color: "#475569", margin: 0 }}>
          {stats.filteredCount === stats.totalCount
            ? `共 ${stats.totalCount} 道题目`
            : `共 ${stats.totalCount} 道题目 · 筛选结果 ${stats.filteredCount} 道`}
          {" · "}
          {Object.entries(stats.difficultyCounts)
            .map(([k, v]) => `${k} ${v}`)
            .join(" · ")}
          {" · 标签 "}{allTags.length} 种
        </p>
        <p style={{ fontSize: "11px", color: "#92400e", margin: "4px 0 0 0" }}>
          内置示例题 · 用于练习路径演示 · 未接真实判题系统
        </p>
      </div>

      {/* Problem Cards */}
      {filtered.length === 0 ? (
        <div className="learningEmptyState" aria-live="polite">
          <strong>没有找到匹配的题目</strong>
          <p>尝试调整搜索条件或清除筛选。</p>
          <button
            onClick={clearFilters}
            style={{
              marginTop: "8px",
              background: "#0f172a",
              border: "none",
              borderRadius: "6px",
              color: "#fff",
              cursor: "pointer",
              fontSize: "13px",
              padding: "6px 16px",
            }}
          >
            清除所有筛选
          </button>
        </div>
      ) : (
        <div className="chunkList">
          {filtered.map((problem) => {
            const isFav = favSet.has(problem.problemId);
            const pracStatus = practiceMap.get(problem.problemId);
            return (
              <article className="chunkItem" key={problem.problemId}>
                <div className="panelHeaderRow">
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      {difficultyBadge(problem.difficulty)}
                      <p className="eyebrow" style={{ margin: 0 }}>
                        {problem.problemId}
                      </p>
                      {pracStatus ? (
                        <span
                          style={{
                            background: statusColor(pracStatus),
                            borderRadius: "4px",
                            color: "#fff",
                            fontSize: "10px",
                            fontWeight: 600,
                            padding: "1px 6px",
                          }}
                        >
                          {statusLabel(pracStatus)}
                        </span>
                      ) : null}
                    </div>
                    <h3 style={{ margin: "6px 0 4px 0", fontSize: "16px" }}>{problem.title}</h3>
                    <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "4px" }}>
                      {problem.tags.map((t) => (
                        <span
                          key={t}
                          style={{
                            background: "#e2e8f0",
                            borderRadius: "3px",
                            color: "#334155",
                            fontSize: "11px",
                            padding: "1px 6px",
                          }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                    <p className="panelNote" style={{ margin: 0 }}>
                      预计用时 {problem.estimatedMinutes} 分钟 · 内置示例题
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center", flexShrink: 0 }}>
                    <button
                      onClick={() => markPracticed(problem)}
                      style={{
                        alignItems: "center",
                        background: pracStatus ? "#dbeafe" : "#f8fafc",
                        border: pracStatus ? "1px solid #3b82f6" : "1px solid #cbd5e1",
                        borderRadius: "8px",
                        color: pracStatus ? "#1e40af" : "#475569",
                        cursor: "pointer",
                        display: "inline-flex",
                        fontSize: "12px",
                        fontWeight: 600,
                        gap: "4px",
                        padding: "5px 10px",
                      }}
                      title={pracStatus ? `当前状态: ${statusLabel(pracStatus)}` : "标记为已练习"}
                    >
                      {pracStatus ? "✓" : "○"} 练习
                    </button>
                    <button
                      onClick={() => toggleFavorite(problem)}
                      style={{
                        alignItems: "center",
                        background: isFav ? "#fef3c7" : "#f8fafc",
                        border: isFav ? "1px solid #f59e0b" : "1px solid #cbd5e1",
                        borderRadius: "8px",
                        color: isFav ? "#92400e" : "#475569",
                        cursor: "pointer",
                        display: "inline-flex",
                        fontSize: "12px",
                        fontWeight: 600,
                        gap: "4px",
                        padding: "5px 10px",
                      }}
                      title={isFav ? "取消收藏" : "收藏题目"}
                    >
                      <span aria-hidden="true">{isFav ? "★" : "☆"}</span>
                      {isFav ? "已收藏" : "收藏"}
                    </button>
                    <Link
                      className="primaryLink"
                      href={`/problems/${problem.problemId}`}
                      style={{ fontSize: "12px", padding: "5px 10px" }}
                    >
                      查看详情
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Footer notice */}
      <div
        style={{
          marginTop: "20px",
          padding: "10px 14px",
          background: "#fffbeb",
          border: "1px solid #fde68a",
          borderRadius: "6px",
          fontSize: "12px",
          color: "#92400e",
        }}
      >
        注意：题目收藏和练习状态存储在浏览器本地。题目系统 v1，未接真实判题、未接生产账号。
        {dbFavoritesEnabled && devSessionOwnerId ? " 开发 DB 收藏已启用（dev-only）。" : ""}
      </div>
    </div>
  );
}

function statusColor(s: string): string {
  const m: Record<string, string> = {
    "not-started": "#94a3b8",
    practiced: "#3b82f6",
    completed: "#16a34a",
    "needs-review": "#dc2626",
  };
  return m[s] ?? "#94a3b8";
}

function statusLabel(s: string): string {
  const m: Record<string, string> = {
    "not-started": "未开始",
    practiced: "已练习",
    completed: "已完成",
    "needs-review": "需复习",
  };
  return m[s] ?? s;
}
