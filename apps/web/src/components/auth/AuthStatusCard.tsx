"use client";

/**
 * AuthStatusCard — displays current auth/session status.
 *
 * Used on /user page and in navigation areas. Shows different states:
 * - No session: "未登录" + link to /login
 * - Dev session: user info + session mode + disclaimer
 *
 * @previewOnly — dev-only session display
 */

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { devLogoutAction } from "../../app/login/actions";

export interface AuthStatusCardProps {
  /** Whether a dev session exists. */
  hasSession: boolean;
  /** User display name (null when no session). */
  displayName: string | null;
  /** Session mode (null when no session). */
  sessionMode: string | null;
  /** User role (null when no session). */
  role: string | null;
  /** Status display string. */
  status: string;
  /** Notice/description string. */
  notice: string;
  /** Whether dev auth guard is enabled. */
  guardEnabled?: boolean;
}

export function AuthStatusCard({
  hasSession,
  displayName,
  sessionMode,
  role,
  status,
  notice,
  guardEnabled,
}: AuthStatusCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [logoutMsg, setLogoutMsg] = useState<string | null>(null);

  const handleLogout = useCallback(() => {
    setLogoutMsg("正在退出...");
    startTransition(async () => {
      try {
        const result = await devLogoutAction();
        setLogoutMsg(result.message);
        if (result.success) {
          router.refresh();
        }
      } catch (err) {
        setLogoutMsg(
          `退出失败: ${err instanceof Error ? err.message : "未知错误"}`,
        );
      }
    });
  }, [router]);

  return (
    <section className="learningPanel" aria-labelledby="auth-status-title">
      <div className="panelHeader">
        <p className="eyebrow">认证状态</p>
        <h2 id="auth-status-title">
          {hasSession ? displayName ?? "开发用户" : "未登录"}
        </h2>
        <p className="panelNote">
          {status}
        </p>
      </div>

      <dl className="scoreMeta" style={{ marginTop: "14px" }}>
        {hasSession ? (
          <>
            <div>
              <dt>显示名</dt>
              <dd>{displayName ?? "—"}</dd>
            </div>
            <div>
              <dt>会话模式</dt>
              <dd style={{ color: "#92400e" }}>{sessionMode ?? "—"}</dd>
            </div>
            {role ? (
              <div>
                <dt>角色</dt>
                <dd>{role}</dd>
              </div>
            ) : null}
            <div>
              <dt>说明</dt>
              <dd style={{ color: "#64748b", fontSize: "12px" }}>{notice}</dd>
            </div>
          </>
        ) : (
          <>
            <div>
              <dt>状态</dt>
              <dd style={{ color: "#64748b" }}>{status}</dd>
            </div>
            <div>
              <dt>说明</dt>
              <dd style={{ color: "#64748b", fontSize: "12px" }}>{notice}</dd>
            </div>
          </>
        )}
      </dl>

      {/* Actions */}
      <div style={{ marginTop: "14px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
        {hasSession ? (
          <button
            onClick={handleLogout}
            disabled={isPending}
            style={{
              background: isPending ? "#e2e8f0" : "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "8px",
              color: isPending ? "#94a3b8" : "#dc2626",
              cursor: isPending ? "not-allowed" : "pointer",
              fontSize: "13px",
              fontWeight: 600,
              padding: "6px 16px",
              transition: "background 0.15s",
            }}
          >
            {isPending ? "退出中..." : "退出开发会话"}
          </button>
        ) : (
          <a
            href="/login"
            style={{
              alignItems: "center",
              background: "#0f172a",
              borderRadius: "8px",
              color: "#f8fafc",
              display: "inline-flex",
              fontSize: "13px",
              fontWeight: 600,
              gap: "4px",
              padding: "8px 18px",
              textDecoration: "none",
              transition: "background 0.15s",
            }}
          >
            去登录
          </a>
        )}

        {guardEnabled === false ? (
          <span
            style={{
              color: "#92400e",
              fontSize: "11px",
              fontStyle: "italic",
              padding: "6px 0",
            }}
          >
            开发登录未启用 (LAP_WEB_AUTH_DEV_ENABLED)
          </span>
        ) : null}
      </div>

      {/* Logout status message */}
      {logoutMsg ? (
        <p
          style={{
            color: logoutMsg.includes("失败") ? "#dc2626" : "#16a34a",
            fontSize: "13px",
            marginTop: "10px",
          }}
          aria-live="polite"
        >
          {logoutMsg}
        </p>
      ) : null}
    </section>
  );
}
