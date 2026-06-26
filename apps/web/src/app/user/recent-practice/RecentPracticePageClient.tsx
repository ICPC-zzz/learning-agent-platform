"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  buildRecentPracticePageViewModel,
  type RecentPracticePageViewModel,
} from "./recent-practice-page-view-model";
import {
  loadRecentPractice,
  type RecentPracticeEntry,
} from "../../../lib/local-user-problem-store";
import type { DbProblemPracticeView } from "../problem-practice-db-loader";

interface RecentPracticePageClientProps {
  dbPractice: DbProblemPracticeView[];
  dbPracticeEnabled: boolean;
  hasSession: boolean;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "#16a34a",
  medium: "#d97706",
  hard: "#dc2626",
  challenge: "#7c3aed",
};

const STATUS_COLORS: Record<string, string> = {
  "not-started": "#94a3b8",
  practiced: "#3b82f6",
  completed: "#16a34a",
  "needs-review": "#dc2626",
};

export function RecentPracticePageClient({
  dbPractice,
  dbPracticeEnabled,
  hasSession,
}: RecentPracticePageClientProps) {
  const [localPractice, setLocalPractice] = useState<RecentPracticeEntry[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLocalPractice(loadRecentPractice());
    setMounted(true);
  }, []);

  const vm: RecentPracticePageViewModel = useMemo(
    () =>
      buildRecentPracticePageViewModel({
        dbPractice,
        dbPracticeEnabled,
        localPractice,
        hasSession,
      }),
    [dbPractice, dbPracticeEnabled, localPractice, hasSession],
  );

  if (!mounted) {
    return (
      <div className="learningEmptyState" aria-live="polite">
        <strong>加载中...</strong>
      </div>
    );
  }

  if (vm.items.length === 0) {
    return (
      <div className="learningEmptyState" aria-live="polite">
        <strong>暂无刷题记录</strong>
        <p>{vm.message}</p>
        <Link
          className="primaryLink"
          href="/problems"
          style={{ marginTop: "8px", display: "inline-block" }}
        >
          前往题目中心开始练习
        </Link>
      </div>
    );
  }

  return (
    <div>
      <p className="panelNote" style={{ marginBottom: "10px" }}>
        {vm.notice} · 共 {vm.count} 条
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
                      background: STATUS_COLORS[item.status] ?? "#94a3b8",
                      borderRadius: "4px",
                      color: "#fff",
                      fontSize: "11px",
                      fontWeight: 600,
                      padding: "2px 8px",
                    }}
                  >
                    {item.statusLabel}
                  </span>
                  <span
                    style={{
                      background: item.source === "db-practice" ? "#dbeafe" : "#fef3c7",
                      borderRadius: "3px",
                      color: item.source === "db-practice" ? "#1e40af" : "#92400e",
                      fontSize: "10px",
                      fontWeight: 600,
                      padding: "1px 6px",
                    }}
                  >
                    {item.source === "db-practice" ? "DB" : "local"}
                  </span>
                </div>
                <h3 style={{ margin: "6px 0 4px 0", fontSize: "16px" }}>{item.title}</h3>
                <p className="panelNote" style={{ margin: 0 }}>
                  更新于 {item.updatedAt.slice(0, 10)} · {item.notice}
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
