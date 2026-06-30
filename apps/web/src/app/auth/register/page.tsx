"use client";

/**
 * /auth/register — redirects to email OTP login flow.
 *
 * A471: Registration is automatic on first email login.
 * There is no separate registration form. Users simply enter their
 * email on the login page and an account is created on first use.
 *
 */

import Link from "next/link";

export default function RegisterPage() {
  return (
    <main className="page" style={{ maxWidth: "560px", paddingTop: "88px", textAlign: "center" }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "56px",
          height: "56px",
          borderRadius: "10px",
          background: "linear-gradient(135deg, #0f6b48 0%, #4f63d9 100%)",
          color: "#fff",
          fontSize: "1.5rem",
          fontWeight: 800,
          marginBottom: "var(--lap-space-4)",
        }}
      >
        L
      </div>

      <h1 style={{ fontSize: "2.1rem", margin: "0 0 12px", fontWeight: 800 }}>
        无需单独注册
      </h1>

      <p style={{ fontSize: "0.9375rem", color: "var(--lap-text-secondary)", lineHeight: 1.7, margin: "0 0 24px" }}>
        首次使用邮箱登录时系统会自动为你创建账号。
        不需要设置用户名和密码。
      </p>

      <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
        <Link
          href="/"
          style={{
            display: "inline-flex", alignItems: "center",
            background: "var(--lap-accent-primary)", borderRadius: "8px",
            color: "#f8fafc", fontSize: "0.875rem", fontWeight: 600,
            padding: "12px 28px", textDecoration: "none",
          }}
        >
          去登录
        </Link>
        <Link
          href="/auth/login"
          style={{
            display: "inline-flex", alignItems: "center",
            border: "1px solid var(--lap-border-default)",
            borderRadius: "8px",
            color: "var(--lap-text-primary)", fontSize: "0.875rem",
            fontWeight: 600, padding: "12px 28px", textDecoration: "none",
          }}
        >
          完整登录页
        </Link>
      </div>

      <div
        style={{
          marginTop: "var(--lap-space-8)", paddingTop: "var(--lap-space-4)",
          borderTop: "var(--lap-border-light)",
          fontSize: "0.75rem", color: "var(--lap-text-subtle)",
        }}
      >
        邮箱验证码登录 · 首次登录自动创建账号
      </div>
    </main>
  );
}
