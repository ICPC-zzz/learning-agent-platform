"use client";

/**
 * UserActivityClientHydration — client-side hydration for localStorage
 * learning activities and reading sessions on the /user/activity page.
 *
 * Reads from localStorage and displays local-only entries alongside DB entries.
 *
 * @previewOnly — dev-only / local fallback / 未接生产账号
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  loadLearningActivities,
  loadReadingSessions,
  type LocalLearningActivity,
  type LocalReadingSession,
} from "../../../lib/local-learning-activity-store";

export interface UserActivityClientHydrationProps {
  hasSession: boolean;
  dbEntriesCount: number;
}

export function UserActivityClientHydration({
  hasSession,
  dbEntriesCount,
}: UserActivityClientHydrationProps) {
  const [localActivities, setLocalActivities] = useState<LocalLearningActivity[]>([]);
  const [localSessions, setLocalSessions] = useState<LocalReadingSession[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const activities = loadLearningActivities();
    const sessions = loadReadingSessions();
    setLocalActivities(activities);
    setLocalSessions(sessions);
    setHydrated(true);
  }, []);

  if (!hydrated) {
    return null; // prevent hydration mismatch
  }

  const totalLocal = localActivities.length + localSessions.length;

  if (totalLocal === 0 && dbEntriesCount === 0) {
    return null; // already showing empty state from server
  }

  return (
    <div style={{ marginTop: "20px" }}>
      {/* Local activities section */}
      {localActivities.length > 0 ? (
        <div style={{ marginTop: "14px" }}>
          <div
            style={{
              padding: "6px 10px",
              background: "#fffbeb",
              border: "1px solid #fde68a",
              borderRadius: "4px",
              marginBottom: "10px",
            }}
          >
            <strong style={{ fontSize: "12px", color: "#92400e" }}>LOCAL FALLBACK</strong>
            <span style={{ fontSize: "11px", color: "#92400e", marginLeft: "8px" }}>
              本地活动记录 · 未连接数据库 · 未接生产账号
            </span>
          </div>
          <div className="chunkList">
            {localActivities.map((a) => (
              <article className="chunkItem" key={a.activityId}>
                <div className="panelHeaderRow">
                  <div>
                    <p className="eyebrow">
                      <span
                        style={{
                          display: "inline-block",
                          background: "#d97706",
                          color: "#fff",
                          borderRadius: "3px",
                          fontSize: "10px",
                          fontWeight: 600,
                          padding: "2px 6px",
                          marginRight: "6px",
                        }}
                      >
                        LOCAL
                      </span>
                      {getTypeLabel(a.activityType)}
                      {" "}{formatTimeAgo(a.occurredAt)}
                    </p>
                    <h4 style={{ fontSize: "14px", margin: "4px 0 2px 0" }}>
                      {sanitizeText(a.title)}
                    </h4>
                    <p style={{ fontSize: "11px", color: "#64748b", margin: 0 }}>
                      {getLocalActivityLink(a)}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {/* Local sessions section */}
      {localSessions.length > 0 ? (
        <div style={{ marginTop: "14px" }}>
          <div
            style={{
              padding: "6px 10px",
              background: "#fffbeb",
              border: "1px solid #fde68a",
              borderRadius: "4px",
              marginBottom: "10px",
            }}
          >
            <strong style={{ fontSize: "12px", color: "#92400e" }}>LOCAL READING SESSIONS</strong>
            <span style={{ fontSize: "11px", color: "#92400e", marginLeft: "8px" }}>
              本地阅读计时 · 未连接数据库 · 未接生产账号
            </span>
          </div>
          <div className="chunkList">
            {localSessions.map((s) => (
              <article className="chunkItem" key={s.sessionId}>
                <div className="panelHeaderRow">
                  <div>
                    <p className="eyebrow">
                      <span
                        style={{
                          display: "inline-block",
                          background: "#d97706",
                          color: "#fff",
                          borderRadius: "3px",
                          fontSize: "10px",
                          fontWeight: 600,
                          padding: "2px 6px",
                          marginRight: "6px",
                        }}
                      >
                        LOCAL
                      </span>
                      阅读计时{" "}{formatTimeAgo(s.startedAt)}
                      {" · "}{Math.round(Math.max(0, s.durationSeconds) / 60)}分钟
                    </p>
                    <h4 style={{ fontSize: "14px", margin: "4px 0 2px 0" }}>
                      {sanitizeText(s.bookTitle)} · {sanitizeText(s.chapterTitle)}
                    </h4>
                  </div>
                  <Link
                    className="primaryLink"
                    href={`/reader?bookId=${encodeURIComponent(s.bookId)}&chapterId=${encodeURIComponent(s.chapterId)}`}
                    style={{ fontSize: "12px" }}
                  >
                    继续阅读
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTypeLabel(type: string): string {
  switch (type) {
    case "read-book":
      return "阅读";
    case "practice-problem":
      return "练习";
    case "favorite-book":
      return "收藏书籍";
    case "favorite-problem":
      return "收藏题目";
    case "add-note":
      return "笔记";
    case "add-bookmark":
      return "书签";
    case "import-book":
      return "导入";
    default:
      return type;
  }
}

function formatTimeAgo(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000);
    if (diffMin < 1) return "刚刚";
    if (diffMin < 60) return `${diffMin}分钟前`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}小时前`;
    return date.toLocaleDateString("zh-CN");
  } catch {
    return isoString;
  }
}

function getLocalActivityLink(a: LocalLearningActivity): string {
  if (a.chapterId) return `章节: ${a.chapterId}`;
  if (a.problemId) return `题目: ${a.problemId}`;
  return `目标: ${a.targetId}`;
}

function sanitizeText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
