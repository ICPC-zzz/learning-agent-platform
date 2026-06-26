"use client";

/**
 * HomeLoginEntry - Auth-first login entry shown on the home page.
 *
 * A471: Email OTP is the primary (and only) login flow.
 * User enters email -> gets verification code -> verifies -> auto-login/register.
 *
 * @previewOnly - dev-only Auth
 */

import { useActionState, useState } from "react";
import Link from "next/link";
import { sendEmailOtpAction } from "../auth/login/email-otp-actions";
import { verifyEmailOtpAction } from "../auth/login/email-otp-verify-actions";
import type { EmailOtpSendResult } from "../auth/login/email-otp-actions";
import type { EmailOtpVerifyResult } from "../auth/login/email-otp-verify-actions";

const INITIAL_SEND_STATE: EmailOtpSendResult = {
  success: false,
  message: "",
  emailSent: false,
  devOnly: true,
  retryAfterSeconds: 0,
};

const INITIAL_VERIFY_STATE: EmailOtpVerifyResult = {
  success: false,
  message: "",
  devOnly: true,
  sessionCreated: false,
};

export function HomeLoginEntry() {
  const [sendState, sendAction, sendPending] = useActionState(sendEmailOtpAction, INITIAL_SEND_STATE);
  const [verifyState, verifyAction, verifyPending] = useActionState(verifyEmailOtpAction, INITIAL_VERIFY_STATE);

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

  return (
    <main className="page" style={{ maxWidth: "440px", paddingTop: "60px" }}>
      <div style={{ textAlign: "center", marginBottom: "var(--lap-space-6)" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "56px",
            height: "56px",
            borderRadius: "var(--lap-radius-xl)",
            background: "linear-gradient(135deg, var(--lap-accent-purple) 0%, #8b5cf6 100%)",
            color: "#fff",
            fontSize: "1.5rem",
            fontWeight: 800,
            marginBottom: "var(--lap-space-4)",
          }}
        >
          L
        </div>
        <h1 style={{ fontSize: "1.75rem", margin: "0 0 8px", fontWeight: 700 }}>
          Learning Agent Platform
        </h1>
        <p style={{ fontSize: "0.875rem", color: "var(--lap-text-muted)", margin: 0 }}>
          输入邮箱即可登录或注册
        </p>
      </div>

      {verifyState.success && verifyState.user ? (
        <div
          style={{
            padding: "var(--lap-space-4)",
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: "var(--lap-radius-md)",
            color: "#166534",
          }}
          role="status"
        >
          <p style={{ margin: 0, fontWeight: 600, fontSize: "1rem" }}>
            {verifyState.user.isNewUser ? "注册并登录成功" : "登录成功"}
          </p>
          <p style={{ margin: "8px 0", fontSize: "0.875rem" }}>
            {verifyState.user.isNewUser ? "欢迎，" : "欢迎回来，"}{verifyState.user.username}
          </p>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "14px" }}>
            <Link
              href="/articles"
              style={{
                display: "inline-flex",
                alignItems: "center",
                background: "#0f172a",
                borderRadius: "var(--lap-radius-sm)",
                color: "#f8fafc",
                fontSize: "0.8125rem",
                fontWeight: 600,
                padding: "10px 20px",
                textDecoration: "none",
              }}
            >
              进入文章
            </Link>
            <Link
              href="/user"
              style={{
                display: "inline-flex",
                alignItems: "center",
                border: "1px solid var(--lap-border-default)",
                borderRadius: "var(--lap-radius-sm)",
                color: "var(--lap-text-primary)",
                fontSize: "0.8125rem",
                fontWeight: 600,
                padding: "10px 20px",
                textDecoration: "none",
              }}
            >
              个人中心
            </Link>
          </div>
        </div>
      ) : (
        <>
          <form action={sendAction} style={{ marginBottom: "12px" }}>
            <label
              htmlFor="home-email"
              style={{
                display: "block",
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: "var(--lap-text-primary)",
                marginBottom: "6px",
              }}
            >
              邮箱地址
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                id="home-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  fontSize: "0.875rem",
                  border: "1px solid #d8dee8",
                  borderRadius: "var(--lap-radius-sm)",
                  background: "#fff",
                  color: "var(--lap-text-primary)",
                  boxSizing: "border-box",
                }}
              />
              <button
                type="submit"
                disabled={sendPending || !email}
                style={{
                  background: sendPending || !email ? "#e2e8f0" : "#0f172a",
                  border: "none",
                  borderRadius: "var(--lap-radius-sm)",
                  color: sendPending || !email ? "#94a3b8" : "#f8fafc",
                  cursor: sendPending || !email ? "not-allowed" : "pointer",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  padding: "10px 16px",
                  whiteSpace: "nowrap",
                }}
              >
                {sendPending ? "发送中..." : "发送验证码"}
              </button>
            </div>
          </form>

          {sendState.message ? (
            <div
              style={{
                background: sendState.success ? "#f0fdf4" : "#fef3c7",
                border: sendState.success ? "1px solid #bbf7d0" : "1px solid #fde68a",
                borderRadius: "var(--lap-radius-sm)",
                color: sendState.success ? "#166534" : "#92400e",
                fontSize: "0.8125rem",
                padding: "10px 14px",
                marginBottom: "12px",
              }}
              role="status"
            >
              {sendState.message}
            </div>
          ) : null}

          {sendState.success ? (
            <form action={verifyAction}>
              <input type="hidden" name="email" value={email} />
              <label
                htmlFor="home-code"
                style={{
                  display: "block",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  color: "var(--lap-text-primary)",
                  marginBottom: "6px",
                }}
              >
                验证码
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  id="home-code"
                  name="code"
                  type="text"
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="6位数字"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    fontSize: "1.25rem",
                    letterSpacing: "4px",
                    textAlign: "center",
                    fontFamily: "monospace",
                    border: "1px solid #d8dee8",
                    borderRadius: "var(--lap-radius-sm)",
                    background: "#fff",
                    color: "var(--lap-text-primary)",
                    boxSizing: "border-box",
                  }}
                />
                <button
                  type="submit"
                  disabled={verifyPending || code.length !== 6}
                  style={{
                    background: verifyPending || code.length !== 6 ? "#e2e8f0" : "#0f172a",
                    border: "none",
                    borderRadius: "var(--lap-radius-sm)",
                    color: verifyPending || code.length !== 6 ? "#94a3b8" : "#f8fafc",
                    cursor: verifyPending || code.length !== 6 ? "not-allowed" : "pointer",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    padding: "10px 16px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {verifyPending ? "验证中..." : "登录"}
                </button>
              </div>
            </form>
          ) : null}

          {verifyState.message && !verifyState.success ? (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "var(--lap-radius-sm)",
                color: "#991b1b",
                fontSize: "0.8125rem",
                padding: "10px 14px",
                marginTop: "12px",
              }}
              role="alert"
            >
              {verifyState.message}
            </div>
          ) : null}

          <p style={{ fontSize: "0.75rem", color: "var(--lap-text-muted)", marginTop: "10px", textAlign: "center" }}>
            首次使用邮箱登录将自动创建账号，无需单独注册。
          </p>
        </>
      )}

      <div
        style={{
          marginTop: "var(--lap-space-5)",
          paddingTop: "var(--lap-space-4)",
          borderTop: "var(--lap-border-light)",
          textAlign: "center",
          fontSize: "0.75rem",
          color: "var(--lap-text-subtle)",
        }}
      >
        dev-only 路 开发预览 路 非生产 Auth
      </div>
    </main>
  );
}
