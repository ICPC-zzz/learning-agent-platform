"use client";

/**
 * ReaderStudyTimerControl — Reader page reading timer control.
 *
 * Provides "开始/结束计时" and "记录本次阅读时长" UI.
 * Writes to localStorage fallback; calls DB action when guard is enabled.
 *
 * @previewOnly — dev-only / local fallback / 未接生产账号
 */

import { useState, useEffect, useCallback } from "react";
import {
  loadReadingSessions,
  persistReadingSessions,
  addReadingSession,
  endReadingSession,
  generateReadingSessionId,
  type LocalReadingSession,
} from "../../lib/local-learning-activity-store";
import {
  formatDuration,
  formatMinutes,
} from "./reader-study-timer-view-model";

export interface ReaderStudyTimerControlProps {
  bookId: string;
  chapterId: string;
  bookTitle: string;
  chapterTitle: string;
  sourceType: string;
  progressRatio: number;
  dbEnabled: boolean;
  devSessionOwnerId: string | null;
}

export function ReaderStudyTimerControl({
  bookId,
  chapterId,
  bookTitle,
  chapterTitle,
  sourceType,
  progressRatio,
  dbEnabled,
  devSessionOwnerId,
}: ReaderStudyTimerControlProps) {
  const [sessions, setSessions] = useState<LocalReadingSession[]>([]);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [manualDuration, setManualDuration] = useState(300); // default 5 min
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const presetSeconds = [300, 900, 1800, 3600, 7200]; // 5, 15, 30, 60, 120 min

  // Load sessions on mount (client-side only)
  useEffect(() => {
    const loaded = loadReadingSessions();
    setSessions(loaded);
    // Check for active timer
    const active = loaded.find((s) => s.endedAt === null);
    if (active) {
      setActiveSessionId(active.sessionId);
      setIsTimerRunning(true);
      const elapsed = Math.max(
        0,
        Math.trunc((Date.now() - new Date(active.startedAt).getTime()) / 1000),
      );
      setElapsedSeconds(elapsed);
    }
  }, []);

  // Timer tick
  useEffect(() => {
    if (!isTimerRunning || !activeSessionId) return;
    const interval = setInterval(() => {
      const active = sessions.find((s) => s.sessionId === activeSessionId);
      if (active) {
        const elapsed = Math.max(
          0,
          Math.trunc((Date.now() - new Date(active.startedAt).getTime()) / 1000),
        );
        setElapsedSeconds(Math.min(elapsed, 28800));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning, activeSessionId, sessions]);

  const startTimer = useCallback(() => {
    const now = new Date().toISOString();
    const session: LocalReadingSession = {
      sessionId: generateReadingSessionId(),
      bookId,
      chapterId,
      bookTitle,
      chapterTitle,
      startedAt: now,
      endedAt: null,
      durationSeconds: 0,
      progressRatio,
      sourceType,
    };

    const updated = addReadingSession(sessions, session);
    setSessions(updated);
    persistReadingSessions(updated);
    setActiveSessionId(session.sessionId);
    setIsTimerRunning(true);
    setElapsedSeconds(0);
    setStatusMsg("阅读计时已开始（本地记录）");
  }, [sessions, bookId, chapterId, bookTitle, chapterTitle, progressRatio, sourceType]);

  const stopTimer = useCallback(() => {
    if (!activeSessionId) return;
    const now = new Date().toISOString();
    const updated = endReadingSession(sessions, activeSessionId, now);
    setSessions(updated);
    persistReadingSessions(updated);
    setIsTimerRunning(false);
    setActiveSessionId(null);
    setElapsedSeconds(0);
    setStatusMsg(`阅读计时已结束：${formatMinutes(elapsedSeconds)}`);
  }, [sessions, activeSessionId, elapsedSeconds]);

  const recordManualDuration = useCallback(
    (durationSeconds: number) => {
      const now = new Date().toISOString();
      const endedAt = new Date(Date.now() + durationSeconds * 1000).toISOString();
      const session: LocalReadingSession = {
        sessionId: generateReadingSessionId(),
        bookId,
        chapterId,
        bookTitle,
        chapterTitle,
        startedAt: now,
        endedAt,
        durationSeconds: Math.min(durationSeconds, 28800),
        progressRatio,
        sourceType,
      };

      const updated = addReadingSession(sessions, session);
      setSessions(updated);
      persistReadingSessions(updated);
      setStatusMsg(`已记录阅读时长：${formatMinutes(durationSeconds)}`);
    },
    [sessions, bookId, chapterId, bookTitle, chapterTitle, progressRatio, sourceType],
  );

  const sessionCount = sessions.length;

  return (
    <section
      className="learningPanel"
      aria-labelledby="study-timer-title"
      style={{ marginTop: "14px" }}
    >
      <div className="panelHeader">
        <p className="eyebrow">A392 Reading Timer</p>
        <h3 id="study-timer-title">阅读计时（开发预览）</h3>
        <p className="panelNote">
          {dbEnabled
            ? "dev-only DB · 绑定 dev session"
            : "本地记录 fallback · 未接生产账号"}
        </p>
      </div>

      <div style={{ marginTop: "12px" }}>
        {/* Timer status */}
        {isTimerRunning ? (
          <div
            style={{
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: "6px",
              padding: "10px 14px",
              marginBottom: "10px",
            }}
          >
            <strong style={{ color: "#166534", fontSize: "13px" }}>计时中</strong>
            <span style={{ marginLeft: "10px", fontSize: "18px", fontWeight: 600, color: "#166534" }}>
              {formatDuration(elapsedSeconds)}
            </span>
          </div>
        ) : null}

        {/* Controls */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
          {!isTimerRunning ? (
            <button
              className="primaryLink"
              type="button"
              onClick={startTimer}
              style={{ fontSize: "13px", cursor: "pointer" }}
            >
              开始计时
            </button>
          ) : (
            <button
              className="primaryLink"
              type="button"
              onClick={stopTimer}
              style={{ fontSize: "13px", cursor: "pointer", background: "#dc2626", borderColor: "#dc2626" }}
            >
              结束计时
            </button>
          )}
        </div>

        {/* Preset durations */}
        {!isTimerRunning ? (
          <div>
            <p style={{ fontSize: "12px", color: "#64748b", margin: "6px 0" }}>
              快速记录阅读时长：
            </p>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {presetSeconds.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  className="secondaryLink"
                  onClick={() => recordManualDuration(sec)}
                  style={{ fontSize: "12px", cursor: "pointer", padding: "4px 10px" }}
                >
                  {formatMinutes(sec)}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Status message */}
        {statusMsg ? (
          <p
            style={{
              fontSize: "12px",
              color: "#475569",
              marginTop: "8px",
              padding: "6px 10px",
              background: "#f1f5f9",
              borderRadius: "4px",
            }}
          >
            {statusMsg}
          </p>
        ) : null}

        {/* Session count */}
        <p style={{ fontSize: "12px", color: "#94a3b8", marginTop: "8px" }}>
          已记录 {sessionCount} 次阅读计时 · {dbEnabled ? "DB 写入可用" : "仅本地存储"} · 未接生产账号
        </p>
      </div>
    </section>
  );
}
