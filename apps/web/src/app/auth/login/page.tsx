"use client";

/**
 * /auth/login — Email OTP login & auto-register.
 * No username/password. Phone login is hidden.
 * @previewOnly
 */

import { useActionState, useState } from "react";
import Link from "next/link";
import { sendEmailOtpAction } from "./email-otp-actions";
import { verifyEmailOtpAction } from "./email-otp-verify-actions";
import type { EmailOtpSendResult } from "./email-otp-actions";
import type { EmailOtpVerifyResult } from "./email-otp-verify-actions";

const INITIAL_SEND: EmailOtpSendResult = {
  success: false, message: "", emailSent: false, devOnly: false, productionReady: false, retryAfterSeconds: 0,
};

const INITIAL_VERIFY: EmailOtpVerifyResult = {
  success: false, message: "", devOnly: false, productionReady: false, sessionCreated: false,
};

export default function LoginPage() {
  const sendResult = useActionState(sendEmailOtpAction, INITIAL_SEND);
  const sendState = sendResult[0];
  const sendAction = sendResult[1];
  const sendPending = sendResult[2];

  const verifyResult = useActionState(verifyEmailOtpAction, INITIAL_VERIFY);
  const verifyState = verifyResult[0];
  const verifyAction = verifyResult[1];
  const verifyPending = verifyResult[2];

  const emailHook = useState("");
  const email = emailHook[0];
  const setEmail = emailHook[1];

  const codeHook = useState("");
  const code = codeHook[0];
  const setCode = codeHook[1];

  return (
    <main className="page" style={{ maxWidth: "560px", paddingTop: "72px" }}>
      <div style={{ marginBottom: "32px" }}>
        <p className="eyebrow">Learning Agent Platform</p>
        <h1 style={{ margin: "0 0 8px", fontSize: "2.25rem", fontWeight: 800, color: "#111827" }}>登录 / 注册</h1>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "#64748b" }}>输入邮箱 → 发送验证码 → 完成登录。首次使用自动注册。</p>
      </div>

      {/* Logged in success — auto-register or login */}
      {verifyState.success && verifyState.user ? (
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "20px" }}>
          <p style={{ margin: "0 0 12px", fontWeight: 700, fontSize: "1rem", color: "#166534" }}>
            {verifyState.user.isNewUser ? "注册并登录成功" : "登录成功"}
          </p>
          <dl style={{ margin: "0 0 16px", display: "grid", gridTemplateColumns: "auto 1fr", gap: "2px 12px", fontSize: "0.8125rem" }}>
            <dt style={{ color: "#15803d", fontWeight: 600 }}>用户</dt>
            <dd style={{ margin: 0 }}>{verifyState.user.username}</dd>
            <dt style={{ color: "#15803d", fontWeight: 600 }}>邮箱</dt>
            <dd style={{ margin: 0 }}>{verifyState.user.email}</dd>
          </dl>
          <Link href="/" style={{ display: "inline-block", background: "#0f172a", borderRadius: "6px", color: "#fff", fontSize: "0.8125rem", fontWeight: 600, padding: "8px 20px", textDecoration: "none" }}>进入主页</Link>
        </div>
      ) : (
        <>
          {/* Step 1: send code */}
          <form action={sendAction}>
            <label htmlFor="email" style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>邮箱地址</label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="your@email.com"
                value={email}
                onChange={function (e) { setEmail(e.target.value); }}
                style={{ flex: 1, padding: "8px 12px", fontSize: "0.875rem", border: "1px solid #d1d5db", borderRadius: "6px", background: "#fff", color: "#0f172a" }}
              />
              <button type="submit" disabled={sendPending || !email}
                style={{
                  background: sendPending || !email ? "#e2e8f0" : "var(--lap-accent-primary)",
                  border: "none", borderRadius: "6px", color: sendPending || !email ? "#94a3b8" : "#fff",
                  cursor: sendPending || !email ? "not-allowed" : "pointer",
                  fontSize: "0.8125rem", fontWeight: 600, padding: "8px 16px", whiteSpace: "nowrap",
                }}
              >{sendPending ? "发送中..." : "发送验证码"}</button>
            </div>
          </form>

          {sendState.message ? (
            <div
              style={{
                marginTop: "12px", padding: "10px 14px", borderRadius: "6px", fontSize: "0.8125rem",
                background: sendState.success ? "#f0fdf4" : "#fef3c7",
                border: sendState.success ? "1px solid #bbf7d0" : "1px solid #fde68a",
                color: sendState.success ? "#166534" : "#92400e",
              }}
              role="status"
            >{sendState.message}{sendState.retryAfterSeconds > 0 ? ` (${sendState.retryAfterSeconds}秒后可重发)` : ""}</div>
          ) : null}

          {/* Step 2: verify code (only after code sent) */}
          {sendState.success ? (
            <form action={verifyAction} style={{ marginTop: "16px" }}>
              <input type="hidden" name="email" value={email} />
              <label htmlFor="code" style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>验证码</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  id="code"
                  name="code"
                  type="text"
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="6位数字"
                  value={code}
                  onChange={function (e) { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); }}
                  style={{ flex: 1, padding: "8px 12px", fontSize: "1.25rem", letterSpacing: "4px", fontFamily: "monospace", textAlign: "center", border: "1px solid #d1d5db", borderRadius: "6px", background: "#fff", color: "#0f172a" }}
                />
                <button type="submit" disabled={verifyPending || code.length !== 6}
                  style={{
                    background: verifyPending || code.length !== 6 ? "#e2e8f0" : "var(--lap-accent-primary)",
                    border: "none", borderRadius: "6px", color: verifyPending || code.length !== 6 ? "#94a3b8" : "#fff",
                    cursor: verifyPending || code.length !== 6 ? "not-allowed" : "pointer",
                    fontSize: "0.8125rem", fontWeight: 600, padding: "8px 16px", whiteSpace: "nowrap",
                  }}
                >{verifyPending ? "验证中..." : "验证并登录"}</button>
              </div>
            </form>
          ) : null}

          {verifyState.message && !verifyState.success ? (
            <div style={{ marginTop: "12px", padding: "10px 14px", borderRadius: "6px", background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", fontSize: "0.8125rem" }} role="alert">{verifyState.message}</div>
          ) : null}

          <p style={{ marginTop: "16px", fontSize: "0.75rem", color: "#94a3b8" }}>
            首次使用邮箱登录将自动创建账号。验证码 10 分钟内有效。
          </p>

          <div style={{ marginTop: "20px" }}>
            <Link href="/" style={{ fontSize: "0.8125rem", color: "#64748b" }}>← 返回首页</Link>
          </div>
        </>
      )}
    </main>
  );
}
