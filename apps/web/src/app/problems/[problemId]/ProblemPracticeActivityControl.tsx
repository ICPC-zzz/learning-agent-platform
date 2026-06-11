"use client";

/**
 * ProblemPracticeActivityControl — Problem detail page practice activity recorder.
 *
 * Provides "记录一次练习" button that writes a learning activity entry
 * to localStorage fallback with practice status.
 *
 * @previewOnly — dev-only / local fallback / 未接生产账号
 */

import { useState, useCallback } from "react";
import {
  loadLearningActivities,
  persistLearningActivities,
  addLearningActivity,
  generateLearningActivityId,
  type LocalLearningActivity,
} from "../../lib/local-learning-activity-store";

export interface ProblemPracticeActivityControlProps {
  problemId: string;
  title: string;
  difficulty: string;
  /** Whether learning activity DB guard is enabled. */
  dbEnabled: boolean;
  /** Dev session owner ID. */
  devSessionOwnerId: string | null;
}

type PracticeStatus = "practiced" | "completed" | "needs-review";

export function ProblemPracticeActivityControl({
  problemId,
  title,
  difficulty,
  dbEnabled,
  devSessionOwnerId,
}: ProblemPracticeActivityControlProps) {
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [lastStatus, setLastStatus] = useState<string | null>(null);

  const recordPractice = useCallback(
    (status: PracticeStatus) => {
      const now = new Date().toISOString();
      const activity: LocalLearningActivity = {
        activityId: generateLearningActivityId(),
        activityType: "practice-problem",
        title: `${title} (${difficulty}) - ${statusLabel(status)}`,
        targetType: "problem",
        targetId: problemId,
        bookId: null,
        chapterId: null,
        problemId,
        sourceType: "web-problem-detail",
        occurredAt: now,
        durationSeconds: null,
        metadataPreview: `练习状态: ${statusLabel(status)}, 难度: ${difficulty}`,
      };

      const activities = loadLearningActivities();
      const updated = addLearningActivity(activities, activity);
      persistLearningActivities(updated);
      setLastStatus(status);
      setStatusMsg(`已记录练习活动：${statusLabel(status)}`);
    },
    [problemId, title, difficulty],
  );

  return (
    <div
      style={{
        marginTop: "10px",
        padding: "10px 14px",
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: "6px",
      }}
    >
      <div style={{ marginBottom: "6px" }}>
        <p style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, margin: "0 0 4px 0" }}>
          A392 练习活动记录（开发预览）
        </p>
        <p style={{ fontSize: "11px", color: "#94a3b8", margin: 0 }}>
          {dbEnabled
            ? "dev-only DB · 绑定 dev session"
            : "本地记录 fallback · 未接数据库 · 未接生产账号"}
        </p>
      </div>

      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        <button
          type="button"
          className="primaryLink"
          onClick={() => recordPractice("practiced")}
          style={{ fontSize: "12px", cursor: "pointer", padding: "4px 10px" }}
        >
          标记为已练习
        </button>
        <button
          type="button"
          className="secondaryLink"
          onClick={() => recordPractice("completed")}
          style={{ fontSize: "12px", cursor: "pointer", padding: "4px 10px" }}
        >
          标记为已完成
        </button>
        <button
          type="button"
          className="secondaryLink"
          onClick={() => recordPractice("needs-review")}
          style={{ fontSize: "12px", cursor: "pointer", padding: "4px 10px" }}
        >
          标记为需复习
        </button>
      </div>

      {statusMsg ? (
        <p
          style={{
            fontSize: "12px",
            color: "#475569",
            marginTop: "8px",
            padding: "4px 8px",
            background: "#f1f5f9",
            borderRadius: "4px",
          }}
        >
          {statusMsg} · 不执行代码 · 不伪造判题结果
        </p>
      ) : null}

      <p style={{ fontSize: "11px", color: "#94a3b8", marginTop: "6px" }}>
        此按钮仅记录练习活动到学习时间线，不执行代码、不接真实判题、不显示 AC。
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusLabel(status: PracticeStatus): string {
  switch (status) {
    case "practiced":
      return "已练习";
    case "completed":
      return "已完成";
    case "needs-review":
      return "需复习";
    default:
      return status;
  }
}
