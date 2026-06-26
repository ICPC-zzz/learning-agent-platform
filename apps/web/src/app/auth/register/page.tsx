"use client";

/**
 * /auth/register — redirects to email OTP login flow.
 *
 * A471: Registration is automatic on first email login.
 * There is no separate registration form. Users simply enter their
 * email on the login page and an account is created on first use.
 *
 * @previewOnly — dev-only Auth
 */

import Link from "next/link";

export default function RegisterPage() {
  return (
    <main className="page" style={{ maxWidth: "480px", paddingTop: "80px", textAlign: "center" }}>
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

      <h1 style={{ fontSize: "1.5rem", margin: "0 0 12px", fontWeight: 700 }}>
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
            background: "#0f172a", borderRadius: "var(--lap-radius-sm)",
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
            borderRadius: "var(--lap-radius-sm)",
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
        dev-only · 开发预览 · 非生产 Auth · A471
      </div>
    </main>
  );
}
