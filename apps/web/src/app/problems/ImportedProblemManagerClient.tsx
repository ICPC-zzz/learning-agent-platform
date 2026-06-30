"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  loadImportedProblems,
  deduplicateImportedProblems,
  type ImportedProblemEntry,
} from "../../lib/local-imported-problem-store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UnifiedImportItem {
  id: string;
  title: string;
  difficulty: "easy" | "medium" | "hard" | "challenge" | "unknown";
  tags: string[];
  source: string;
  provider: string;
  providerId: string;
  externalProblemId: string;
  importedAt: string;
  storageMode: "db" | "localStorage" | "fallback";
  detailHref: string;
  sourceLabel: string;
}

interface ImportedProblemListItem {
  id: string;
  title: string;
  difficulty: UnifiedImportItem["difficulty"];
  tags: string[];
  source: string;
  provider?: string;
  providerId?: string;
  externalProblemId?: string;
  importedAt?: string;
  storageMode?: UnifiedImportItem["storageMode"];
  detailHref?: string;
  sourceLabel?: string;
}

interface ImportedProblemManagerClientProps {
  dbProblems: ImportedProblemListItem[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImportedProblemManagerClient({
  dbProblems,
}: ImportedProblemManagerClientProps) {
  const [localProblems, setLocalProblems] = useState<ImportedProblemEntry[]>([]);
  const [filterStorage, setFilterStorage] = useState<"all" | "db" | "localStorage">("all");
  const [filterDifficulty, setFilterDifficulty] = useState<string>("");
  const [filterTag, setFilterTag] = useState<string>("");

  useEffect(() => {
    setLocalProblems(loadImportedProblems());
  }, []);

  // Merge DB and localStorage, deduplicate
  const allItems = useMemo<UnifiedImportItem[]>(() => {
    // Convert DB problems to unified items
    const dbItems: UnifiedImportItem[] = dbProblems.map((p) => ({
      id: p.id,
      title: p.title,
      difficulty: p.difficulty,
      tags: p.tags,
      source: p.sourceLabel ?? "Codeforces",
      provider: p.sourceLabel ?? "Codeforces",
      providerId: "db",
      externalProblemId: p.id,
      importedAt: "",
      storageMode: "db" as const,
      detailHref: p.detailHref ?? `/problems/${encodeURIComponent(p.id)}`,
      sourceLabel: p.sourceLabel ?? "Codeforces",
    }));

    // Convert localStorage entries
    const localItems: UnifiedImportItem[] = localProblems.map((entry) => ({
      id: entry.importedProblemId,
      title: entry.title,
      difficulty: entry.difficulty,
      tags: entry.tags,
      source: entry.source ?? entry.providerId,
      provider: entry.providerId,
      providerId: entry.providerId,
      externalProblemId: entry.externalProblemId,
      importedAt: entry.importedAt,
      storageMode: entry.dbWritten ? ("db" as const) : ("localStorage" as const),
      detailHref: entry.dbWritten && entry.dbId
        ? `/problems/${encodeURIComponent(entry.dbId)}`
        : `/problems/${encodeURIComponent(entry.importedProblemId)}`,
      sourceLabel: entry.dbWritten ? "DB+local" : "localStorage",
    }));

    // Merge and deduplicate
    const merged = [...dbItems];

    for (const localItem of localItems) {
      // Check if already exists in merged (by providerId+externalProblemId)
      const exists = merged.find(
        (m) =>
          m.providerId === localItem.providerId &&
          m.externalProblemId === localItem.externalProblemId &&
          m.providerId !== "db",
      );
      if (!exists) {
        merged.push(localItem);
      }
      // If exists in DB, DB entry wins (already in merged)
    }

    return merged;
  }, [dbProblems, localProblems]);

  // Apply filters
  const filteredItems = useMemo(() => {
    let result = allItems;

    if (filterStorage !== "all") {
      result = result.filter((item) => item.storageMode === filterStorage);
    }

    if (filterDifficulty) {
      result = result.filter((item) => item.difficulty === filterDifficulty);
    }

    if (filterTag.trim()) {
      const tagLower = filterTag.trim().toLowerCase();
      result = result.filter((item) =>
        item.tags.some((t) => t.toLowerCase().includes(tagLower)),
      );
    }

    return result;
  }, [allItems, filterStorage, filterDifficulty, filterTag]);

  const totalCount = allItems.length;
  const filteredCount = filteredItems.length;
  const dbCount = allItems.filter((i) => i.storageMode === "db").length;
  const localCount = allItems.filter((i) => i.storageMode === "localStorage").length;

  if (totalCount === 0) {
    return null; // Don't render if nothing imported
  }

  return (
    <section className="learningPanel" aria-labelledby="imported-manager-title">
      <div className="panelHeader">
        <h2 id="imported-manager-title">已导入题目管理</h2>
        <p className="panelNote">
          合并展示 DB 导入题和 localStorage 导入题。重复题目以 DB 优先。
        </p>
      </div>

      {/* Stats */}
      <div
        style={{
          marginBottom: "12px",
          padding: "10px 14px",
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: "6px",
          fontSize: "13px",
          color: "#475569",
        }}
      >
        共 {totalCount} 条已导入题目（DB: {dbCount}，localStorage: {localCount}）
        {filteredCount !== totalCount ? ` · 筛选结果 ${filteredCount} 条` : ""}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "14px", alignItems: "center" }}>
        <select
          value={filterStorage}
          onChange={(e) => setFilterStorage(e.target.value as "all" | "db" | "localStorage")}
          style={{
            border: "1px solid #cbd5e1",
            borderRadius: "6px",
            fontSize: "13px",
            padding: "6px 10px",
            minWidth: "120px",
          }}
        >
          <option value="all">全部来源</option>
          <option value="db">DB 导入</option>
          <option value="localStorage">localStorage</option>
        </select>

        <select
          value={filterDifficulty}
          onChange={(e) => setFilterDifficulty(e.target.value)}
          style={{
            border: "1px solid #cbd5e1",
            borderRadius: "6px",
            fontSize: "13px",
            padding: "6px 10px",
            minWidth: "110px",
          }}
        >
          <option value="">所有难度</option>
          <option value="easy">easy</option>
          <option value="medium">medium</option>
          <option value="hard">hard</option>
          <option value="challenge">challenge</option>
          <option value="unknown">unknown</option>
        </select>

        <input
          type="text"
          placeholder="标签过滤..."
          value={filterTag}
          onChange={(e) => setFilterTag(e.target.value)}
          style={{
            border: "1px solid #cbd5e1",
            borderRadius: "6px",
            fontSize: "13px",
            padding: "6px 10px",
            flex: "1 1 150px",
            minWidth: "120px",
          }}
        />

        {(filterStorage !== "all" || filterDifficulty || filterTag.trim()) ? (
          <button
            onClick={() => {
              setFilterStorage("all");
              setFilterDifficulty("");
              setFilterTag("");
            }}
            style={{
              background: "#f1f5f9",
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
              color: "#475569",
              cursor: "pointer",
              fontSize: "12px",
              padding: "6px 12px",
            }}
          >
            清除筛选
          </button>
        ) : null}
      </div>

      {/* Items */}
      {filteredItems.length === 0 ? (
        <div className="learningEmptyState" aria-live="polite">
          <strong>没有匹配的已导入题目</strong>
          <p>尝试调整筛选条件。</p>
        </div>
      ) : (
        <div className="chunkList">
          {filteredItems.map((item) => {
            const storageBadge = storageModeBadge(item.storageMode);
            return (
              <article className="chunkItem" key={item.id}>
                <div className="panelHeaderRow">
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span
                        style={{
                          background: difficultyColor(item.difficulty),
                          borderRadius: "4px",
                          color: "#fff",
                          fontSize: "11px",
                          fontWeight: 600,
                          padding: "2px 8px",
                          textTransform: "uppercase",
                        }}
                      >
                        {item.difficulty}
                      </span>
                      <span style={{ color: "#64748b", fontSize: "11px" }}>
                        {item.providerId}:{item.externalProblemId.slice(0, 30)}
                      </span>
                      <span
                        style={{
                          background: storageBadge.bg,
                          borderRadius: "4px",
                          color: storageBadge.color,
                          fontSize: "10px",
                          fontWeight: 600,
                          padding: "1px 6px",
                        }}
                      >
                        {storageBadge.label}
                      </span>
                      {item.source ? (
                        <span style={{ color: "#94a3b8", fontSize: "10px" }}>
                          来源: {item.source}
                        </span>
                      ) : null}
                    </div>
                    <h3 style={{ margin: "6px 0 4px", fontSize: "16px" }}>{item.title}</h3>
                    <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "4px" }}>
                      {item.tags.map((t) => (
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
                      {item.importedAt
                        ? `导入时间: ${new Date(item.importedAt).toLocaleDateString("zh-CN")}`
                        : ""}
                      {" · "}
                      {storageBadge.label}
                    </p>
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    <Link className="primaryLink" href={item.detailHref} style={{ fontSize: "12px", padding: "5px 10px" }}>
                      查看详情
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Footer note */}
      <div
        style={{
          marginTop: "12px",
          padding: "8px 12px",
          background: "#fffbeb",
          border: "1px solid #fde68a",
          borderRadius: "6px",
          fontSize: "11px",
          color: "#92400e",
        }}
      >
        已导入题目管理区 · 去重优先 DB → localStorage
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function difficultyColor(d: string): string {
  const colors: Record<string, string> = {
    easy: "#16a34a",
    medium: "#d97706",
    hard: "#dc2626",
    challenge: "#7c3aed",
  };
  return colors[d] ?? "#64748b";
}

function storageModeBadge(mode: string): { label: string; bg: string; color: string } {
  switch (mode) {
    case "db":
      return { label: "DB", bg: "#dbeafe", color: "#1e40af" };
    case "localStorage":
      return { label: "localStorage", bg: "#fef3c7", color: "#92400e" };
    case "fallback":
      return { label: "fallback", bg: "#f1f5f9", color: "#64748b" };
    default:
      return { label: mode, bg: "#e2e8f0", color: "#334155" };
  }
}
