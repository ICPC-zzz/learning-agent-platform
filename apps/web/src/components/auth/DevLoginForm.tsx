"use client";

/**
 * Dev login form — client component.
 *
 * Displays a list of preset dev users for selection. Submits via server action.
 * Only renders when guard is enabled (parent component controls visibility).
 */

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { devLoginAction } from "../../app/login/actions";
import { getDevUserPresets } from "../../lib/web-auth-dev-session";

export function DevLoginForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const presets = getDevUserPresets();

  const handleLogin = useCallback(() => {
    if (!selectedUser) {
      setMessage("请选择一个开发用户身份。");
      return;
    }

    setMessage("正在创建开发会话...");

    startTransition(async () => {
      try {
        const result = await devLoginAction(selectedUser);
        setMessage(result.message);
        if (result.success && result.redirectUrl) {
          router.push(result.redirectUrl);
        }
      } catch (err) {
        setMessage(
          `登录失败: ${err instanceof Error ? err.message : "未知错误"}`,
        );
      }
    });
  }, [selectedUser, router]);

  return (
    <div style={{ marginTop: "14px" }}>
      {/* Dev user selection */}
      <div style={{ marginBottom: "16px" }}>
        <label
          htmlFor="dev-user-select"
          style={{
            display: "block",
            fontSize: "13px",
            fontWeight: 600,
            marginBottom: "6px",
            color: "#334155",
          }}
        >
          选择开发用户（无需密码）
        </label>
        <select
          id="dev-user-select"
          value={selectedUser}
          onChange={(e) => {
            setSelectedUser(e.target.value);
            setMessage(null);
          }}
          style={{
            background: "#fff",
            border: "1px solid #cbd5e1",
            borderRadius: "8px",
            color: "#1e293b",
            fontSize: "14px",
            padding: "8px 12px",
            width: "100%",
            maxWidth: "400px",
          }}
        >
          <option value="">-- 请选择开发用户 --</option>
          {presets.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
        <p
          style={{
            color: "#64748b",
            fontSize: "11px",
            fontStyle: "italic",
            marginTop: "4px",
          }}
        >
          开发登录无需真实密码。选择一个预设开发用户身份即可创建 dev-only 会话。
        </p>
      </div>

      {/* Login button */}
      <button
        onClick={handleLogin}
        disabled={isPending || !selectedUser}
        style={{
          alignItems: "center",
          background:
            isPending || !selectedUser ? "#e2e8f0" : "#0f172a",
          border: "none",
          borderRadius: "8px",
          color: isPending || !selectedUser ? "#94a3b8" : "#f8fafc",
          cursor: isPending || !selectedUser ? "not-allowed" : "pointer",
          display: "inline-flex",
          fontSize: "14px",
          fontWeight: 600,
          gap: "6px",
          padding: "10px 24px",
          transition: "background 0.15s, color 0.15s",
        }}
      >
        {isPending ? "创建会话中..." : "开发登录"}
      </button>

      {/* Status message */}
      {message ? (
        <p
          style={{
            color: message.includes("失败") || message.includes("未启用")
              ? "#dc2626"
              : "#16a34a",
            fontSize: "13px",
            marginTop: "12px",
          }}
          aria-live="polite"
        >
          {message}
        </p>
      ) : null}

      {/* Disclaimer */}
      <div
        style={{
          borderTop: "1px solid #e2e8f0",
          color: "#64748b",
          fontSize: "11px",
          fontStyle: "italic",
          marginTop: "16px",
          paddingTop: "12px",
        }}
      >
        未接生产认证 · 不会写入数据库 · 仅用于本地开发验证用户中心
      </div>
    </div>
  );
}
