"use client";
/**
 * ReaderProgressSaveControl — dev-only button to save reading progress
 * to the development database.
 *
 * Guard-controlled: the button is disabled when the guard is not enabled.
 * Displays safe progress info, guard status, and write result.
 *
 * ALL labels include "开发预览", "dev-only DB", "未接生产同步", "未接真实用户系统".
 *
 * @module ReaderProgressSaveControl
 * @previewOnly
 */
import { useCallback, useState } from "react";
import type { ReaderProgressDbActionState } from "./reader-progress-db-server-action";
import type { ReaderProgressDbStatusForUi } from "./reader-progress-db-guard";
// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface ReaderProgressSaveControlProps {
  bookId: string;
  chapterId: string;
  progressRatio: number;
  dbStatus: ReaderProgressDbStatusForUi;
  onSave: (
    bookId: string,
    chapterId: string,
    progressRatio: number,
  ) => Promise<ReaderProgressDbActionState>;
}
// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const PROGRESS_PRESETS = [0.25, 0.5, 0.75, 1.0] as const;
export function ReaderProgressSaveControl({
  bookId,
  chapterId,
  progressRatio: initialProgressRatio,
  dbStatus,
  onSave,
}: ReaderProgressSaveControlProps) {
  const [selectedRatio, setSelectedRatio] = useState(initialProgressRatio);
  const [saving, setSaving] = useState(false);
  const [lastResult, setLastResult] = useState<ReaderProgressDbActionState | null>(null);
  const handleSave = useCallback(async () => {
    setSaving(true);
    setLastResult(null);
    try {
      const result = await onSave(bookId, chapterId, selectedRatio);
      setLastResult(result);
    } catch {
      setLastResult({
        success: false,
        devOnly: true,
        writesDatabase: false,
        callsRepository: false,
        bookId,
        chapterId,
        reasonCode: "client-error",
        blockedReasons: ["客户端保存异常，请重试。"],
        productionReady: false,
        uiMessage: "保存请求失败，请检查网络后重试。",
      });
    } finally {
      setSaving(false);
    }
  }, [bookId, chapterId, selectedRatio, onSave]);
  const canSave = dbStatus.enabled && !saving;
  const displayPercent = Math.round(selectedRatio * 100);
  return (
    <section className="progressPanel" aria-labelledby="dev-save-title">
      <p className="eyebrow">开发预览 · dev-only</p>
      <h2 id="dev-save-title">保存阅读进度到开发数据库</h2>
      {/* Guard status */}
      <div
        style={{
          background: dbStatus.enabled ? "#dcfce7" : "#fef3c7",
          border: dbStatus.enabled ? "1px solid #22c55e" : "1px solid #f59e0b",
          borderRadius: "8px",
          marginTop: "12px",
          padding: "10px 14px",
        }}
      >
        <p style={{ color: dbStatus.enabled ? "#166534" : "#92400e", fontSize: "12px", margin: 0 }}>
          <strong>{dbStatus.enabled ? "✓ 已启用" : "⚠ 未启用"}</strong>{" "}
          {dbStatus.notice}
        </p>
      </div>
      {/* Progress ratio selector */}
      <div style={{ marginTop: "14px" }}>
        <p style={{ fontSize: "13px", color: "#475569", marginBottom: "8px" }}>
          选择阅读进度（当前：{displayPercent}%）
        </p>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {PROGRESS_PRESETS.map((ratio) => (
            <button
              key={ratio}
              type="button"
              onClick={() => setSelectedRatio(ratio)}
              disabled={!dbStatus.enabled}
              style={{
                background: selectedRatio === ratio ? "#3b82f6" : "#f1f5f9",
                border: selectedRatio === ratio ? "2px solid #2563eb" : "1px solid #cbd5e1",
                borderRadius: "6px",
                color: selectedRatio === ratio ? "#fff" : "#475569",
                cursor: dbStatus.enabled ? "pointer" : "not-allowed",
                fontSize: "13px",
                fontWeight: selectedRatio === ratio ? 700 : 500,
                opacity: dbStatus.enabled ? 1 : 0.6,
                padding: "6px 12px",
                transition: "all 0.15s",
              }}
              aria-pressed={selectedRatio === ratio}
            >
              {Math.round(ratio * 100)}%
            </button>
          ))}
        </div>
      </div>
      {/* Save button */}
      <button
        type="button"
        onClick={handleSave}
        disabled={!canSave}
        style={{
          alignItems: "center",
          background: canSave ? "#3b82f6" : "#e2e8f0",
          border: "none",
          borderRadius: "8px",
          color: canSave ? "#fff" : "#94a3b8",
          cursor: canSave ? "pointer" : "not-allowed",
          display: "inline-flex",
          font: "inherit",
          fontSize: "14px",
          fontWeight: 600,
          gap: "6px",
          marginTop: "14px",
          opacity: canSave ? 1 : 0.6,
          padding: "10px 20px",
          transition: "background 0.15s",
          width: "100%",
        }}
      >
        {saving
          ? "正在保存到开发数据库..."
          : dbStatus.enabled
            ? `记录阅读进度到开发数据库（${displayPercent}%）`
            : "阅读进度 DB 持久化未启用"}
      </button>
      {/* Result display */}
      {lastResult !== null && (
        <div
          aria-live="polite"
          style={{
            background: lastResult.success ? "#dcfce7" : "#fef2f2",
            border: lastResult.success ? "1px solid #22c55e" : "1px solid #fecaca",
            borderRadius: "8px",
            marginTop: "12px",
            padding: "10px 14px",
          }}
        >
          <p
            style={{
              color: lastResult.success ? "#166534" : "#991b1b",
              fontSize: "12px",
              margin: 0,
            }}
          >
            {lastResult.uiMessage}
          </p>
          {lastResult.success && "updatedAt" in lastResult && (
            <p style={{ color: "#64748b", fontSize: "11px", margin: "4px 0 0" }}>
              保存时间：{new Date((lastResult as { updatedAt: string }).updatedAt).toLocaleString("zh-CN")}
            </p>
          )}
        </div>
      )}
      {/* Safety notices */}
      <div style={{ marginTop: "12px" }}>
        <p style={{ color: "#92400e", fontSize: "11px", fontStyle: "italic", margin: "4px 0" }}>
          ⚠ 开发预览 · dev-only DB · 未接生产同步 · 未接真实用户系统
        </p>
        {dbStatus.enabled && (
          <p style={{ color: "#64748b", fontSize: "10px", margin: "2px 0" }}>
            dev session owner · 进度绑定当前开发用户 · 不同用户进度隔离
          </p>
        )}
      </div>
    </section>
  );
}
