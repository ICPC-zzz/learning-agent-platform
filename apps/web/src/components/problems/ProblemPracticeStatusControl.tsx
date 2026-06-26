"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addRecentPractice,
  loadRecentPractice,
  persistRecentPractice,
  type PracticeStatus,
  type RecentPracticeEntry,
} from "../../lib/local-user-problem-store";

interface ProblemPracticeStatusControlProps {
  problemId: string;
  title: string;
  difficulty: string;
}

const STATUS_OPTIONS: { value: PracticeStatus; label: string }[] = [
  { value: "not-started", label: "未开始" },
  { value: "practiced", label: "已练习" },
  { value: "completed", label: "已完成" },
  { value: "needs-review", label: "需要复习" },
];

const STATUS_COLORS: Record<PracticeStatus, string> = {
  "not-started": "#94a3b8",
  practiced: "#3b82f6",
  completed: "#16a34a",
  "needs-review": "#dc2626",
};

export function ProblemPracticeStatusControl({
  problemId,
  title,
  difficulty,
}: ProblemPracticeStatusControlProps) {
  const [mounted, setMounted] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<PracticeStatus>("not-started");
  const [showOptions, setShowOptions] = useState(false);

  useEffect(() => {
    const practice = loadRecentPractice();
    const existing = practice.find((e) => e.problemId === problemId);
    if (existing) {
      setCurrentStatus(existing.status);
    }
    setMounted(true);
  }, [problemId]);

  const updateStatus = useCallback(
    (newStatus: PracticeStatus) => {
      const practice = loadRecentPractice();
      const entry: RecentPracticeEntry = {
        problemId,
        title,
        difficulty,
        status: newStatus,
        updatedAt: new Date().toISOString(),
      };
      const updated = addRecentPractice(practice, entry);
      persistRecentPractice(updated);
      setCurrentStatus(newStatus);
      setShowOptions(false);
    },
    [problemId, title, difficulty],
  );

  const currentLabel = useMemo(
    () => STATUS_OPTIONS.find((o) => o.value === currentStatus)?.label ?? "未开始",
    [currentStatus],
  );

  if (!mounted) {
    return null;
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setShowOptions(!showOptions)}
        style={{
          alignItems: "center",
          background: `${STATUS_COLORS[currentStatus]}18`,
          border: `1px solid ${STATUS_COLORS[currentStatus]}`,
          borderRadius: "8px",
          color: STATUS_COLORS[currentStatus],
          cursor: "pointer",
          display: "inline-flex",
          font: "inherit",
          fontSize: "13px",
          fontWeight: 600,
          gap: "4px",
          padding: "6px 14px",
          transition: "background 0.15s, border-color 0.15s, color 0.15s",
        }}
        title={`当前练习状态: ${currentLabel}`}
        aria-label={`练习状态: ${currentLabel}。点击更改。`}
      >
        <span aria-hidden="true">📋</span>
        {currentLabel}
      </button>
      {showOptions ? (
        <div
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            fontSize: "12px",
            left: 0,
            minWidth: "160px",
            padding: "6px",
            position: "absolute",
            top: "calc(100% + 6px)",
            zIndex: 100,
          }}
          role="listbox"
          aria-label="选择练习状态"
        >
          <p
            style={{
              color: "#64748b",
              fontSize: "11px",
              fontWeight: 600,
              margin: "0 0 4px 6px",
            }}
          >
            标记练习状态
          </p>
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => updateStatus(opt.value)}
              role="option"
              aria-selected={currentStatus === opt.value}
              style={{
                alignItems: "center",
                background: currentStatus === opt.value ? `${STATUS_COLORS[opt.value]}14` : "transparent",
                border: "none",
                borderRadius: "6px",
                color: currentStatus === opt.value ? STATUS_COLORS[opt.value] : "#334155",
                cursor: "pointer",
                display: "flex",
                font: "inherit",
                fontSize: "12px",
                fontWeight: currentStatus === opt.value ? 600 : 400,
                gap: "6px",
                padding: "6px 10px",
                textAlign: "left",
                width: "100%",
              }}
            >
              <span
                style={{
                  background: STATUS_COLORS[opt.value],
                  borderRadius: "50%",
                  display: "inline-block",
                  height: "6px",
                  width: "6px",
                }}
              />
              {opt.label}
              {currentStatus === opt.value ? (
                <span style={{ marginLeft: "auto", fontSize: "10px" }}>✓</span>
              ) : null}
            </button>
          ))}
          <div
            style={{
              borderTop: "1px solid #e2e8f0",
              fontSize: "10px",
              margin: "4px 6px 0",
              padding: "4px 0 0",
              color: "#94a3b8",
            }}
          >
            状态保存在浏览器本地存储
          </div>
        </div>
      ) : null}
    </div>
  );
}
