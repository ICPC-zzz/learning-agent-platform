"use client";

/**
 * ProblemWrongBookControl — Problem detail page wrong book control.
 *
 * Provides buttons to add/remove from wrong book, record wrong count,
 * update review status, and add notes.
 * Uses localStorage fallback by default; DB writes only when guard passes.
 *
 * @previewOnly — dev-only / local fallback / 未接真实判题 / 未接生产账号
 */

import { useState, useCallback, useEffect } from "react";
import {
  loadWrongBook,
  persistWrongBook,
  isProblemInWrongBook,
  findWrongBookEntryByProblemId,
  addProblemToWrongBook,
  recordProblemWrong,
  removeProblemFromWrongBook,
  updateWrongBookReviewStatus,
  updateWrongBookNote,
  type WrongBookEntry,
  type WrongBookReviewStatus,
} from "../../lib/local-problem-wrong-book-store";

export interface ProblemWrongBookControlProps {
  problemId: string;
  title: string;
  difficulty: string;
  tags: string[];
  /** Whether wrong book DB guard is enabled. */
  dbWrongBookEnabled: boolean;
  /** Dev session owner ID. */
  devSessionOwnerId: string | null;
}

export function ProblemWrongBookControl({
  problemId,
  title,
  difficulty,
  tags,
  dbWrongBookEnabled,
  devSessionOwnerId,
}: ProblemWrongBookControlProps) {
  const [wrongBook, setWrongBook] = useState<WrongBookEntry[]>([]);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);

  // Load wrong book on mount
  useEffect(() => {
    setWrongBook(loadWrongBook());
  }, []);

  const currentEntry = findWrongBookEntryByProblemId(wrongBook, problemId);
  const isInWrongBook = currentEntry !== null;

  const persist = useCallback((entries: WrongBookEntry[]) => {
    persistWrongBook(entries);
    setWrongBook(entries);
  }, []);

  const handleAdd = useCallback(() => {
    const now = new Date().toISOString();
    const entry: WrongBookEntry = {
      wrongBookId: `local-wb-${problemId}-${Date.now()}`,
      problemId,
      title,
      difficulty,
      tags: tags.slice(0, 20),
      wrongCount: 1,
      lastWrongAt: now,
      reviewStatus: "needs-review",
      notePreview: null,
      sourceType: "local-fallback",
      createdAt: now,
      updatedAt: now,
    };
    const updated = addProblemToWrongBook(wrongBook, entry);
    persist(updated);
    setStatusMsg("已添加到错题本（本地 fallback · 开发预览）");
  }, [problemId, title, difficulty, tags, wrongBook, persist]);

  const handleRecordWrong = useCallback(() => {
    const result = recordProblemWrong(wrongBook, problemId, title, difficulty, tags.slice(0, 20));
    persist(result.entries);
    setStatusMsg(
      `已记录一次做错 · 当前错误次数：${result.entry?.wrongCount ?? "?"}（本地记录 · 不执行代码）`,
    );
  }, [problemId, title, difficulty, tags, wrongBook, persist]);

  const handleRemove = useCallback(() => {
    const updated = removeProblemFromWrongBook(wrongBook, problemId);
    persist(updated);
    setStatusMsg("已移出错题本（本地 fallback）");
    setShowNoteInput(false);
  }, [problemId, wrongBook, persist]);

  const handleReviewStatus = useCallback(
    (status: WrongBookReviewStatus) => {
      const updated = updateWrongBookReviewStatus(wrongBook, problemId, status);
      persist(updated);
      setStatusMsg(`复习状态已更新为：${reviewStatusLabel(status)}（本地记录）`);
    },
    [problemId, wrongBook, persist],
  );

  const handleSaveNote = useCallback(() => {
    const updated = updateWrongBookNote(wrongBook, problemId, noteDraft || null);
    persist(updated);
    setNoteDraft("");
    setShowNoteInput(false);
    setStatusMsg("错题备注已保存（本地 fallback）");
  }, [problemId, noteDraft, wrongBook, persist]);

  return (
    <div
      style={{
        marginTop: "10px",
        padding: "10px 14px",
        background: "#fefce8",
        border: "1px solid #fde68a",
        borderRadius: "6px",
      }}
    >
      <div style={{ marginBottom: "6px" }}>
        <p style={{ fontSize: "12px", color: "#92400e", fontWeight: 600, margin: "0 0 4px 0" }}>
          错题本（开发预览）· 本地 fallback · 未接真实判题 · 未接生产账号
        </p>
        {dbWrongBookEnabled ? (
          <p style={{ fontSize: "11px", color: "#a16207", margin: 0 }}>
            dev-only DB · 绑定 dev session · 未接生产同步
          </p>
        ) : (
          <p style={{ fontSize: "11px", color: "#a16207", margin: 0 }}>
            本地 localStorage 存储 · 不连接数据库
          </p>
        )}
      </div>

      {currentEntry ? (
        <div>
          <div style={{ fontSize: "12px", marginBottom: "6px" }}>
            <p style={{ color: "#475569", margin: "2px 0" }}>
              错误次数：<strong>{currentEntry.wrongCount}</strong>
            </p>
            <p style={{ color: "#475569", margin: "2px 0" }}>
              最近错误：{currentEntry.lastWrongAt.slice(0, 10)}
            </p>
            <p style={{ color: "#475569", margin: "2px 0" }}>
              复习状态：{reviewStatusLabel(currentEntry.reviewStatus)}
            </p>
            {currentEntry.notePreview ? (
              <p style={{ color: "#475569", margin: "2px 0", fontStyle: "italic" }}>
                备注：{currentEntry.notePreview.slice(0, 100)}
              </p>
            ) : null}
          </div>

          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "8px" }}>
            <button
              type="button"
              onClick={handleRecordWrong}
              style={{
                fontSize: "12px",
                cursor: "pointer",
                padding: "4px 10px",
                background: "#dc2626",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
              }}
            >
              记录一次做错
            </button>
            <button
              type="button"
              onClick={() => handleReviewStatus("needs-review")}
              style={statusBtnStyle(currentEntry.reviewStatus === "needs-review")}
            >
              待复习
            </button>
            <button
              type="button"
              onClick={() => handleReviewStatus("reviewed")}
              style={statusBtnStyle(currentEntry.reviewStatus === "reviewed")}
            >
              已复习
            </button>
            <button
              type="button"
              onClick={() => handleReviewStatus("mastered")}
              style={statusBtnStyle(currentEntry.reviewStatus === "mastered")}
            >
              已掌握
            </button>
          </div>

          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "8px" }}>
            {!showNoteInput ? (
              <button
                type="button"
                onClick={() => setShowNoteInput(true)}
                style={{ fontSize: "12px", cursor: "pointer", padding: "4px 10px" }}
                className="secondaryLink"
              >
                添加错题备注
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleRemove}
              style={{ fontSize: "12px", cursor: "pointer", padding: "4px 10px" }}
              className="secondaryLink"
            >
              移出错题本
            </button>
          </div>

          {showNoteInput ? (
            <div style={{ marginTop: "6px" }}>
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value.slice(0, 300))}
                placeholder="错题备注（最多300字，不保存代码和敏感信息）"
                rows={2}
                style={{
                  width: "100%",
                  fontSize: "12px",
                  padding: "6px",
                  border: "1px solid #e2e8f0",
                  borderRadius: "4px",
                  resize: "vertical",
                }}
              />
              <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                <button
                  type="button"
                  onClick={handleSaveNote}
                  style={{ fontSize: "12px", cursor: "pointer", padding: "4px 10px" }}
                  className="primaryLink"
                >
                  保存备注
                </button>
                <button
                  type="button"
                  onClick={() => { setShowNoteInput(false); setNoteDraft(""); }}
                  style={{ fontSize: "12px", cursor: "pointer", padding: "4px 10px" }}
                  className="secondaryLink"
                >
                  取消
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={handleAdd}
          style={{
            fontSize: "12px",
            cursor: "pointer",
            padding: "4px 14px",
            background: "#d97706",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
          }}
        >
          加入错题本
        </button>
      )}

      {statusMsg ? (
        <p
          style={{
            fontSize: "11px",
            color: "#92400e",
            marginTop: "8px",
            padding: "4px 8px",
            background: "#fffbeb",
            borderRadius: "4px",
          }}
        >
          {statusMsg}
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function reviewStatusLabel(status: WrongBookReviewStatus): string {
  switch (status) {
    case "needs-review":
      return "待复习";
    case "reviewed":
      return "已复习";
    case "mastered":
      return "已掌握";
    default:
      return status;
  }
}

function statusBtnStyle(active: boolean): React.CSSProperties {
  return {
    fontSize: "12px",
    cursor: "pointer",
    padding: "4px 10px",
    background: active ? "#0f172a" : "#e2e8f0",
    color: active ? "#fff" : "#334155",
    border: active ? "1px solid #0f172a" : "1px solid #cbd5e1",
    borderRadius: "4px",
  };
}
