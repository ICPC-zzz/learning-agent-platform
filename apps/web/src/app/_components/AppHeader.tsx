/**
 * AppHeader — User-facing top navigation bar.
 *
 * Renders the primary user nav items. Admin links are intentionally omitted.
 * Mobile: shows a hamburger toggle that opens the AppSidebar.
 *
 * @previewOnly — UI shell only, no data access
 */

"use client";

import Link from "next/link";
import { useState, useCallback } from "react";
import { USER_NAV_ITEMS, NavLink } from "./AppNav";

export interface AppHeaderProps {
  /** Called when the mobile hamburger is clicked. */
  onToggleMobileSidebar?: () => void;
  hasSession?: boolean;
}

export function AppHeader({ onToggleMobileSidebar, hasSession = false }: AppHeaderProps) {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: "var(--lap-z-sticky)",
        background: "var(--lap-bg-card)",
        borderBottom: "var(--lap-border-light)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          maxWidth: "var(--lap-layout-width-wide)",
          margin: "0 auto",
          padding: "0 var(--lap-space-4)",
          minHeight: "56px",
        }}
      >
        {/* Logo & brand */}
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--lap-space-2)",
            textDecoration: "none",
            color: "var(--lap-text-primary)",
            fontWeight: 800,
            fontSize: "1.125rem",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "32px",
              height: "32px",
              borderRadius: "var(--lap-radius-md)",
              background: "linear-gradient(135deg, var(--lap-accent-purple) 0%, #8b5cf6 100%)",
              color: "#fff",
              fontSize: "1rem",
              fontWeight: 800,
            }}
          >
            L
          </span>
          <span className="lap-hide-mobile">Learning Platform</span>
        </Link>

        {/* Desktop nav */}
        <nav
          className="lap-hide-mobile"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--lap-space-1)",
          }}
          aria-label="主导航"
        >
          {USER_NAV_ITEMS.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </nav>

        {/* Right side: auth actions + dev badge + admin link (small) + mobile toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--lap-space-2)" }}>
          {!hasSession ? (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Link
                href="/auth/login"
                style={guestActionLinkStyle}
                title="登录"
              >
                登录
              </Link>
              <Link
                href="/auth/register"
                style={guestActionLinkStyleSecondary}
                title="注册"
              >
                注册
              </Link>
            </div>
          ) : null}
          <span className="lap-dev-badge lap-hide-mobile">dev-preview</span>
          <Link
            href="/admin"
            className="lap-hide-mobile"
            style={{
              fontSize: "0.75rem",
              color: "var(--lap-text-subtle)",
              textDecoration: "none",
              padding: "4px 8px",
              borderRadius: "var(--lap-radius-sm)",
              border: "1px solid #e2e8f0",
              transition: "color var(--lap-transition-fast)",
            }}
            title="后台管理（开发预览）"
          >
            后台
          </Link>
          {/* Mobile hamburger */}
          <button
            className="lap-show-mobile"
            onClick={onToggleMobileSidebar}
            aria-label="打开导航菜单"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "8px",
              color: "var(--lap-text-primary)",
              fontSize: "1.5rem",
              lineHeight: 1,
            }}
          >
            ☰
          </button>
        </div>
      </div>
    </header>
  );
}

const guestActionLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "56px",
  padding: "8px 12px",
  borderRadius: "999px",
  border: "1px solid transparent",
  background: "var(--lap-text-primary)",
  color: "#fff",
  fontSize: "0.75rem",
  fontWeight: 700,
  textDecoration: "none",
  whiteSpace: "nowrap",
};

const guestActionLinkStyleSecondary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "56px",
  padding: "8px 12px",
  borderRadius: "999px",
  border: "1px solid var(--lap-border-default)",
  background: "#fff",
  color: "var(--lap-text-primary)",
  fontSize: "0.75rem",
  fontWeight: 700,
  textDecoration: "none",
  whiteSpace: "nowrap",
};
