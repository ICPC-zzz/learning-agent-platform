"use client";

import React, { useState, useEffect, useCallback } from "react";
import { getContestCountdownData } from "./cf-contest-server-action";
import type { ContestCountdownData } from "./cf-contest-server-action";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ContestCountdownProps {
  /** If user has a CF account bound, their rating to highlight eligible contests */
  userRating?: number | null;
}

// ---------------------------------------------------------------------------
// Live countdown hook
// ---------------------------------------------------------------------------

function useCountdown(targetSeconds: number): { label: string; isPast: boolean } {
  const [label, setLabel] = useState("");
  const [isPast, setIsPast] = useState(false);

  useEffect(() => {
    function tick() {
      const now = Math.floor(Date.now() / 1000);
      const diff = targetSeconds - now;
      if (diff <= 0) { setIsPast(true); setLabel("进行中"); return; }
      const d = Math.floor(diff / 86400);
      const h = Math.floor((diff % 86400) / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      if (d > 0) setLabel(`${d}天 ${h}时 ${m}分`);
      else setLabel(`${h}时 ${m}分 ${s}秒`);
    }
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [targetSeconds]);

  return { label, isPast };
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ContestCountdown({ userRating }: ContestCountdownProps) {
  const [data, setData] = useState<ContestCountdownData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getContestCountdownData();
      setData(result);
      if (!result.success) setError(result.error ?? null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Determine eligible divisions
  function isEligible(contestName: string): boolean {
    if (!userRating || userRating < 800) return false;
    const name = contestName.toLowerCase();
    if (userRating < 1200) return name.includes("div. 4") || name.includes("div. 3");
    if (userRating < 1600) return name.includes("div. 3") || name.includes("div. 2") || name.includes("educational");
    if (userRating < 1900) return name.includes("div. 2") || name.includes("educational");
    return name.includes("div. 1") || name.includes("div. 2") || name.includes("educational");
  }

  if (loading) {
    return (
      <div style={S.container}>
        <h3 style={S.title}>📅 Codeforces 比赛</h3>
        <div style={S.loading}>加载中...</div>
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <div style={S.container}>
        <h3 style={S.title}>📅 Codeforces 比赛</h3>
        <div style={S.empty}>
          <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "8px" }}>
            {error ?? "暂无比赛数据"}
          </div>
          <button onClick={fetchData} style={S.retryBtn}>刷新</button>
        </div>
      </div>
    );
  }

  if (data.contests.length === 0) {
    return (
      <div style={S.container}>
        <h3 style={S.title}>📅 Codeforces 比赛</h3>
        <div style={S.empty}>近期暂无比赛</div>
      </div>
    );
  }

  return (
    <div style={S.container}>
      <div style={S.header}>
        <h3 style={S.title}>📅 Codeforces 比赛</h3>
        <button onClick={fetchData} style={S.retryBtn}>刷新</button>
      </div>
      <div style={S.list}>
        {data.contests.map((contest) => {
          const eligible = isEligible(contest.name);
          return <ContestRow key={contest.id} contest={contest} highlighted={eligible} />;
        })}
      </div>
      <div style={S.footer}>
        <a
          href="https://codeforces.com/contests"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: "11px", color: "#6366f1", textDecoration: "none", fontWeight: 600 }}
        >
          查看全部 Codeforces 比赛 →
        </a>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single contest row
// ---------------------------------------------------------------------------

function ContestRow({ contest, highlighted }: {
  contest: ContestCountdownData["contests"][number];
  highlighted: boolean;
}) {
  const { label, isPast } = useCountdown(contest.startTimeSeconds);

  const startDate = new Date(contest.startTimeSeconds * 1000);
  const dateStr = startDate.toLocaleDateString("zh-CN", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <a
      href={`https://codeforces.com/contests/${contest.id}`}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        ...S.row,
        borderColor: highlighted ? "#6366f1" : isPast ? "#e2e8f0" : "#e2e8f0",
        background: highlighted ? "#eef2ff" : "#fff",
      }}
    >
      <div style={S.rowLeft}>
        <div style={{ ...S.contestName, fontWeight: highlighted ? 700 : 500 }}>
          {highlighted ? "⭐ " : ""}{contest.name}
        </div>
        <div style={S.contestMeta}>
          {contest.type} · {contest.durationHours}h · {dateStr}
        </div>
      </div>
      <div style={{
        ...S.countdown,
        color: isPast ? "#94a3b8" : highlighted ? "#6366f1" : "#64748b",
        fontWeight: isPast ? 500 : 700,
      }}>
        {label}
      </div>
    </a>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const S: Record<string, React.CSSProperties> = {
  container: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "16px",
    marginBottom: "16px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
  },
  title: {
    fontSize: "15px",
    fontWeight: 700,
    color: "#0f172a",
    margin: 0,
  },
  loading: {
    fontSize: "13px",
    color: "#94a3b8",
    textAlign: "center",
    padding: "16px",
  },
  empty: {
    fontSize: "13px",
    color: "#94a3b8",
    textAlign: "center",
    padding: "16px",
  },
  retryBtn: {
    fontSize: "11px",
    color: "#6366f1",
    background: "none",
    border: "1px solid #c7d2fe",
    borderRadius: "6px",
    padding: "3px 10px",
    cursor: "pointer",
    fontWeight: 600,
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid",
    textDecoration: "none",
    color: "inherit",
    transition: "box-shadow 0.15s",
  },
  rowLeft: {
    flex: 1,
    minWidth: 0,
    marginRight: "10px",
  },
  contestName: {
    fontSize: "12px",
    color: "#0f172a",
    lineHeight: 1.4,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  contestMeta: {
    fontSize: "10px",
    color: "#94a3b8",
    marginTop: "2px",
  },
  countdown: {
    fontSize: "13px",
    whiteSpace: "nowrap",
    textAlign: "right",
    minWidth: "80px",
  },
  footer: {
    marginTop: "10px",
    textAlign: "right",
  },
};
