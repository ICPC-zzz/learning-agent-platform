"use client";

/**
 * UserWrongBookClientHydration — hydrates localStorage wrong book data
 * on the client side to complement the SSR-provided DB data.
 *
 * Reads from localStorage key: lap.web.user.problemWrongBook
 *
 * @previewOnly — dev-only; local-only client hydration
 */

import { useEffect, useState } from "react";
import type { WrongBookEntry } from "../../../lib/local-problem-wrong-book-store";

export interface UserWrongBookClientHydrationProps {
  /** Optional initial entries from DB (SSR preload). */
  dbHasData: boolean;
}

export function UserWrongBookClientHydration({
  dbHasData,
}: UserWrongBookClientHydrationProps) {
  const [localCount, setLocalCount] = useState<number | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("lap.web.user.problemWrongBook");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setLocalCount(parsed.length);
        } else {
          setLocalCount(0);
        }
      } else {
        setLocalCount(0);
      }
    } catch {
      setLocalCount(0);
    }
  }, []);

  if (localCount === null) return null;

  if (localCount === 0 && !dbHasData) {
    return null;
  }

  return (
    <div
      style={{
        padding: "8px 12px",
        background: "#f1f5f9",
        border: "1px solid #e2e8f0",
        borderRadius: "6px",
        fontSize: "12px",
        color: "#64748b",
        marginTop: "8px",
      }}
    >
      {localCount > 0 ? (
        <p style={{ margin: 0 }}>
          本地 localStorage 中还有 {localCount} 条错题记录。
          {dbHasData ? " DB 记录优先展示。" : " 当前未连接 DB。"}
        </p>
      ) : (
        <p style={{ margin: 0 }}>
          本地无 localStorage 错题数据。
          {dbHasData ? " 以上为 DB 记录。" : ""}
        </p>
      )}
    </div>
  );
}
