"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteAllImportedBooksAction } from "../delete-all-imported-action";

export function DeleteAllButton({ devImportEnabled }: { devImportEnabled: boolean }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");

  async function handleDelete() {
    setLoading(true); setResult("");
    try {
      const res = await deleteAllImportedBooksAction();
      setResult(res.message);
      if (res.deleted > 0) { router.refresh(); setTimeout(() => window.location.href = "/books", 500); }
    } catch (err) {
      setResult("Error: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false); setConfirming(false);
    }
  }

  if (!devImportEnabled) {
    return (
      <div style={{ marginTop: 16, padding: "10px 14px", background: "#fff9e6", border: "1px solid #f0d77b", borderRadius: 8, fontSize: "0.82rem", color: "#66561b" }}>
        删除功能需要设置 LAP_ALLOW_DEV_BOOK_IMPORT=true
      </div>
    );
  }

  return (
    <div style={{ marginTop: 16 }}>
      {!confirming ? (
        <button onClick={() => setConfirming(true)} style={{
          padding: "8px 20px", border: "2px solid #ef4444", borderRadius: 8,
          background: "transparent", color: "#ef4444", fontWeight: 600, fontSize: "0.84rem", cursor: "pointer",
        }}>
          删除所有已导入书籍
        </button>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
          background: "#fef0f0", border: "1px solid #ffcdd2", borderRadius: 8 }}>
          <span style={{ fontSize: "0.84rem", color: "#b71c1c", fontWeight: 600 }}>
            确定删除所有非内置书籍？（保护 3 本示例书不被删除）
          </span>
          <button onClick={handleDelete} disabled={loading} style={{
            padding: "6px 16px", border: "none", borderRadius: 6, background: "#ef4444",
            color: "#fff", fontWeight: 600, fontSize: "0.8rem", cursor: loading ? "not-allowed" : "pointer",
          }}>{loading ? "删除中..." : "确认"}</button>
          <button onClick={() => setConfirming(false)} disabled={loading} style={{
            padding: "6px 16px", border: "1px solid #ccc", borderRadius: 6,
            background: "#fff", fontSize: "0.8rem", cursor: loading ? "not-allowed" : "pointer",
          }}>取消</button>
        </div>
      )}
      {result ? (
        <p style={{ marginTop: 8, fontSize: "0.8rem", color: result.startsWith("Error") ? "#ef4444" : "#16a34a" }}>{result}</p>
      ) : null}
    </div>
  );
}
