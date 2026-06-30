"use client";

import { useMemo } from "react";
import Link from "next/link";

import {
  buildFavoriteProblemsPageViewModel,
  type FavoriteProblemsPageViewModel,
} from "./favorite-problems-page-view-model";
import type { DbProblemFavoriteView } from "../../problem-favorites-db-loader";

interface FavoriteProblemsPageClientProps {
  dbFavorites: DbProblemFavoriteView[];
  dbFavoritesEnabled: boolean;
  hasSession: boolean;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "#16a34a",
  medium: "#d97706",
  hard: "#dc2626",
  challenge: "#7c3aed",
};

export function FavoriteProblemsPageClient({
  dbFavorites,
  dbFavoritesEnabled,
  hasSession,
}: FavoriteProblemsPageClientProps) {
  const vm: FavoriteProblemsPageViewModel = useMemo(
    () =>
      buildFavoriteProblemsPageViewModel({
        dbFavorites,
        dbFavoritesEnabled,
        localFavorites: [],
        hasSession,
      }),
    [dbFavorites, dbFavoritesEnabled, hasSession],
  );

  // Empty state
  if (vm.items.length === 0) {
    return (
      <div className="learningEmptyState" aria-live="polite">
        <strong>暂无收藏题目</strong>
        <p>{vm.message}</p>
        <Link
          className="primaryLink"
          href="/problems"
          style={{ marginTop: "8px", display: "inline-block" }}
        >
          前往题目中心浏览题目
        </Link>
      </div>
    );
  }

  return (
    <div>
      <p className="panelNote" style={{ marginBottom: "10px" }}>
        {vm.notice} · 共 {vm.count} 道
      </p>
      <div className="chunkList">
        {vm.items.map((item) => (
          <article className="chunkItem" key={item.problemId}>
            <div className="panelHeaderRow">
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span
                    style={{
                      background: DIFFICULTY_COLORS[item.difficulty] ?? "#64748b",
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
                  <span
                    style={{
                      background: item.source === "db-problem-favorite" ? "#dbeafe" : "#fef3c7",
                      borderRadius: "3px",
                      color: item.source === "db-problem-favorite" ? "#1e40af" : "#92400e",
                      fontSize: "10px",
                      fontWeight: 600,
                      padding: "1px 6px",
                    }}
                  >
                    {item.source === "db-problem-favorite" ? "DB" : "local"}
                  </span>
                </div>
                <h3 style={{ margin: "6px 0 4px 0", fontSize: "16px" }}>{item.title}</h3>
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
                  收藏于 {item.favoritedAt.slice(0, 10)} · {item.notice}
                </p>
              </div>
              <div style={{ display: "flex", gap: "6px", alignItems: "center", flexShrink: 0 }}>
                <Link
                  className="primaryLink"
                  href={`/problems/${item.problemId}`}
                  style={{ fontSize: "12px", padding: "5px 10px" }}
                >
                  查看详情
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
