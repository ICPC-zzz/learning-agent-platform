/**
 * AdminHeader — Admin-facing top bar.
 *
 * Distinct from AppHeader — uses a different visual style (darker, muted)
 * to clearly signal "admin mode" to the user.
 *
 * @previewOnly — admin UI shell, no data access
 */

"use client";

import Link from "next/link";

export function AdminHeader() {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: "var(--lap-z-sticky)",
        background: "#1e293b",
        color: "#e2e8f0",
        borderBottom: "1px solid #334155",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          maxWidth: "var(--lap-layout-width-admin)",
          margin: "0 auto",
          padding: "0 var(--lap-space-4)",
          minHeight: "52px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--lap-space-3)" }}>
          <Link
            href="/admin"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--lap-space-2)",
              textDecoration: "none",
              color: "#f1f5f9",
              fontWeight: 700,
              fontSize: "0.9375rem",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "28px",
                height: "28px",
                borderRadius: "var(--lap-radius-sm)",
                background: "#475569",
                color: "#f1f5f9",
                fontSize: "0.75rem",
                fontWeight: 800,
              }}
            >
              A
            </span>
            Admin
          </Link>
          <span
            style={{
              fontSize: "0.625rem",
              background: "#78350f",
              color: "#fbbf24",
              padding: "2px 6px",
              borderRadius: "var(--lap-radius-sm)",
              fontWeight: 600,
            }}
          >
            admin-dev · productionReady=false
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--lap-space-3)" }}>
          <Link
            href="/"
            style={{
              fontSize: "0.8125rem",
              color: "#94a3b8",
              textDecoration: "none",
              padding: "4px 10px",
              borderRadius: "var(--lap-radius-sm)",
              border: "1px solid #475569",
              transition: "color var(--lap-transition-fast), border-color var(--lap-transition-fast)",
            }}
          >
            ← 返回前台
          </Link>
        </div>
      </div>
    </header>
  );
}
