"use client";

import { useCallback, useState } from "react";
import {
  doAddProblemToWrongBook,
} from "../../app/user/problem-wrong-book-db-actions";
import { evaluateProblemWrongBookDbGuard } from "../../app/user/problem-wrong-book-db-guard";

export interface AddToWrongBookButtonProps {
  problemId: string;
  title: string;
  difficulty: string;
  tags?: string[];
  /** Dev session cookie raw value */
  sessionCookie?: string;
}

/**
 * "加入错题本" button — calls DB when guard passes, otherwise no-op.
 *
 * Practice status (未开始/已练习/已完成/需要复习) is NOT driven by
 * page visits. It will come from Codeforces account sync in a future
 * round. Unbound users see all problems as "未开始" by default.
 */
export function AddToWrongBookButton({
  problemId,
  title,
  difficulty,
  tags,
  sessionCookie,
}: AddToWrongBookButtonProps) {
  const [added, setAdded] = useState(false);
  const [pending, setPending] = useState(false);

  const handleAdd = useCallback(async () => {
    if (pending || added) return;
    setPending(true);
    try {
      const guard = evaluateProblemWrongBookDbGuard(sessionCookie);
      if (!guard.enabled || !guard.sessionPayload) {
        // Guard blocked — silently skip
        setPending(false);
        return;
      }
      const result = await doAddProblemToWrongBook(
        problemId,
        title,
        difficulty,
        tags,
        guard.sessionPayload.userIdPreview,
        guard,
      );
      if (result.success) {
        setAdded(true);
      }
    } catch {
      // Silently ignore
    } finally {
      setPending(false);
    }
  }, [problemId, title, difficulty, tags, sessionCookie, pending, added]);

  if (added) {
    return (
      <span style={addedStyle}>
        已加入错题本
      </span>
    );
  }

  return (
    <button
      type="button"
      className="secondaryLink"
      onClick={handleAdd}
      disabled={pending}
      style={{ ...buttonResetStyle, opacity: pending ? 0.6 : 1 }}
    >
      {pending ? "加入中…" : "加入错题本"}
    </button>
  );
}

const buttonResetStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  font: "inherit",
};

const addedStyle: React.CSSProperties = {
  alignItems: "center",
  background: "#fef3c7",
  border: "1px solid #fcd34d",
  borderRadius: "10px",
  color: "#92400e",
  display: "inline-flex",
  fontSize: "13px",
  fontWeight: 700,
  justifyContent: "center",
  minHeight: "38px",
  padding: "0 14px",
  opacity: 0.85,
};
