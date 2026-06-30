"use client";

/**
 * SyncManagementClient — Admin sync management UI.
 *
 * Displays sync status and provides manual refresh buttons.
 * Rate limited. No token or secret exposure.
 */

import { useState } from "react";
import type { SyncActionResult } from "./admin-sync-actions";

interface SyncStatusItem {
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  status: string;
  count: number;
  safeSummary: string | null;
  errorCode: string | null;
}

interface SyncStatusSummary {
  hotspots: SyncStatusItem;
  github: SyncStatusItem;
  articles: SyncStatusItem;
}

interface SyncManagementClientProps {
  initialStatus: SyncStatusSummary;
  refreshHotspots: () => Promise<SyncActionResult>;
  refreshGitHub: () => Promise<SyncActionResult>;
  refreshArticles: () => Promise<SyncActionResult>;
}

export function SyncManagementClient({
  initialStatus,
  refreshHotspots,
  refreshGitHub,
  refreshArticles,
}: SyncManagementClientProps) {
  const [status, setStatus] = useState<SyncStatusSummary>(initialStatus);
  const [hotspotResult, setHotspotResult] = useState<SyncActionResult | null>(null);
  const [githubResult, setGithubResult] = useState<SyncActionResult | null>(null);
  const [articleResult, setArticleResult] = useState<SyncActionResult | null>(null);
  const [hotspotLoading, setHotspotLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const [articleLoading, setArticleLoading] = useState(false);

  async function handleRefreshHotspots() {
    setHotspotLoading(true);
    setHotspotResult(null);
    try {
      const result = await refreshHotspots();
      setHotspotResult(result);
      // Re-fetch status
      // For now, just update the counts locally
      setStatus((prev) => ({
        ...prev,
        hotspots: {
          ...prev.hotspots,
          lastAttemptAt: new Date().toISOString(),
          lastSuccessAt: result.success ? new Date().toISOString() : prev.hotspots.lastSuccessAt,
          status: result.success ? "succeeded" : "failed",
          count: result.saved ?? prev.hotspots.count,
          safeSummary: result.message,
          errorCode: result.errors?.[0] ?? null,
        },
      }));
    } catch (err) {
      setHotspotResult({ success: false, message: String(err) });
    } finally {
      setHotspotLoading(false);
    }
  }

  async function handleRefreshGitHub() {
    setGithubLoading(true);
    setGithubResult(null);
    try {
      const result = await refreshGitHub();
      setGithubResult(result);
      setStatus((prev) => ({
        ...prev,
        github: {
          ...prev.github,
          lastAttemptAt: new Date().toISOString(),
          lastSuccessAt: result.success ? new Date().toISOString() : prev.github.lastSuccessAt,
          status: result.success ? "succeeded" : "failed",
          count: result.saved ?? prev.github.count,
          safeSummary: result.message,
          errorCode: result.errors?.[0] ?? null,
        },
      }));
    } catch (err) {
      setGithubResult({ success: false, message: String(err) });
    } finally {
      setGithubLoading(false);
    }
  }

  async function handleRefreshArticles() {
    setArticleLoading(true);
    setArticleResult(null);
    try {
      const result = await refreshArticles();
      setArticleResult(result);
      setStatus((prev) => ({
        ...prev,
        articles: {
          ...prev.articles,
          lastAttemptAt: new Date().toISOString(),
          lastSuccessAt: result.success ? new Date().toISOString() : prev.articles.lastSuccessAt,
          status: result.success ? "succeeded" : "failed",
          count: result.articleCount ?? result.fetched ?? prev.articles.count,
          safeSummary: result.message,
          errorCode: result.errors?.[0] ?? null,
        },
      }));
    } catch (err) {
      setArticleResult({ success: false, message: String(err) });
    } finally {
      setArticleLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--lap-space-5)" }}>
      {/* Status overview */}
      <div
        style={{
          padding: "var(--lap-space-4)",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "var(--lap-radius-lg)",
        }}
      >
        <h2 style={{ margin: "0 0 12px", fontSize: "1rem", fontWeight: 600, color: "#cbd5e1" }}>
          同步状态
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px" }}>
          <StatusCard
            title="每日热点"
            item={status.hotspots}
          />
          <StatusCard
            title="GitHub 日报"
            item={status.github}
          />
          <StatusCard
            title="技术文章"
            item={status.articles}
          />
        </div>
      </div>

      {/* Refresh buttons */}
      <div
        style={{
          padding: "var(--lap-space-4)",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "var(--lap-radius-lg)",
        }}
      >
        <h2 style={{ margin: "0 0 12px", fontSize: "1rem", fontWeight: 600, color: "#cbd5e1" }}>
          手动刷新
        </h2>
        <p style={{ margin: "0 0 16px", fontSize: "0.75rem", color: "#94a3b8" }}>
          每个数据源有 1 分钟冷却时间。GITHUB_TOKEN 可选，未配置时 GitHub 使用匿名请求（额度较低）。
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
          {/* Hotspot refresh */}
          <button
            type="button"
            onClick={handleRefreshHotspots}
            disabled={hotspotLoading}
            style={{
              minHeight: "40px",
              padding: "0 20px",
              borderRadius: "var(--lap-radius-md)",
              border: "1px solid #475569",
              background: hotspotLoading ? "#334155" : "#1e293b",
              color: "#e2e8f0",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: hotspotLoading ? "wait" : "pointer",
            }}
          >
            {hotspotLoading ? "刷新中..." : "刷新每日热点"}
          </button>

          {/* GitHub refresh */}
          <button
            type="button"
            onClick={handleRefreshGitHub}
            disabled={githubLoading}
            style={{
              minHeight: "40px",
              padding: "0 20px",
              borderRadius: "var(--lap-radius-md)",
              border: "1px solid #475569",
              background: githubLoading ? "#334155" : "#1e293b",
              color: "#e2e8f0",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: githubLoading ? "wait" : "pointer",
            }}
          >
            {githubLoading ? "刷新中..." : "刷新 GitHub 日报"}
          </button>

          <button
            type="button"
            onClick={handleRefreshArticles}
            disabled={articleLoading}
            style={{
              minHeight: "40px",
              padding: "0 20px",
              borderRadius: "var(--lap-radius-md)",
              border: "1px solid #475569",
              background: articleLoading ? "#334155" : "#1e293b",
              color: "#f8fafc",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: articleLoading ? "wait" : "pointer",
            }}
          >
            {articleLoading ? "刷新中..." : "刷新技术文章"}
          </button>
        </div>
      </div>

      {/* Result messages */}
      {hotspotResult && (
        <SyncResultCard title="每日热点同步" result={hotspotResult} />
      )}
      {githubResult && (
        <SyncResultCard title="GitHub 日报同步" result={githubResult} />
      )}
      {articleResult && (
        <SyncResultCard title="技术文章同步" result={articleResult} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusCard({
  title,
  item,
}: {
  title: string;
  item: SyncStatusItem;
}) {
  return (
    <div
      style={{
        padding: "12px",
        background: "rgba(255,255,255,0.05)",
        borderRadius: "var(--lap-radius-md)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#f8fafc", marginBottom: "4px" }}>
        {title}
      </div>
      <div style={{ fontSize: "0.75rem", color: "#dbeafe", lineHeight: 1.7 }}>
        <div>最近尝试：{item.lastAttemptAt ? formatTime(item.lastAttemptAt) : "从未"}</div>
        <div>最近成功：{item.lastSuccessAt ? formatTime(item.lastSuccessAt) : "从未"}</div>
        <div>当前状态：{formatStatus(item.status)}</div>
        <div>当前条目：{item.count}</div>
        {item.safeSummary ? <div>结果：{item.safeSummary}</div> : null}
        {item.errorCode ? <div style={{ color: "#fecaca" }}>错误摘要：{item.errorCode}</div> : null}
      </div>
    </div>
  );
}

function SyncResultCard({
  title,
  result,
}: {
  title: string;
  result: SyncActionResult;
}) {
  return (
    <div
      style={{
        padding: "var(--lap-space-4)",
        background: result.success
          ? "rgba(34,197,94,0.08)"
          : "rgba(239,68,68,0.08)",
        border: `1px solid ${result.success ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
        borderRadius: "var(--lap-radius-md)",
      }}
    >
      <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "#f8fafc", marginBottom: "4px" }}>
        {title}
      </div>
      <div style={{ fontSize: "0.75rem", color: result.success ? "#bbf7d0" : "#fecaca" }}>
        {result.message}
      </div>
      {result.date ? (
        <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: "4px" }}>
          日期：{result.date} · 获取：{result.fetched ?? "—"} · 保存：{result.saved ?? "—"}
        </div>
      ) : null}
      {result.articleCount !== undefined ? (
        <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: "4px" }}>
          技术文章：当前 {result.articleCount} 篇 · 新增 {result.articleAdded ?? 0} 篇
        </div>
      ) : null}
      {result.errors && result.errors.length > 0 ? (
        <div style={{ fontSize: "0.7rem", color: "#fca5a5", marginTop: "4px" }}>
          {result.errors.map((e, i) => (
            <div key={i}>{e}</div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("zh-CN");
}

function formatStatus(status: string): string {
  switch (status) {
    case "running":
      return "同步中";
    case "succeeded":
      return "同步成功";
    case "failed":
      return "同步失败";
    case "skipped":
      return "使用上次成功数据";
    case "idle":
    default:
      return "从未同步";
  }
}
