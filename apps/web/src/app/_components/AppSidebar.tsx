/**
 * AppSidebar — Mobile slide-in navigation panel for user-facing pages.
 *
 * Renders the same USER_NAV_ITEMS as AppHeader but in a vertical list.
 * Only visible on mobile when toggled.
 *
 * @previewOnly — UI shell only, no data access
 */

"use client";

import { useEffect } from "react";
import { USER_NAV_ITEMS, useIsActive } from "./AppNav";
import Link from "next/link";

export interface AppSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AppSidebar({ isOpen, onClose }: AppSidebarProps) {
  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const isActive = useIsActive;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.3)",
            zIndex: "var(--lap-z-overlay)",
          }}
        />
      )}

      {/* Slide-in panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="导航菜单"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: "280px",
          maxWidth: "85vw",
          background: "var(--lap-bg-card)",
          zIndex: "var(--lap-z-sidebar)",
          transform: isOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform var(--lap-transition-slow)",
          boxShadow: isOpen ? "2px 0 16px rgba(0,0,0,0.12)" : "none",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Sidebar header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "var(--lap-space-4)",
            borderBottom: "var(--lap-border-light)",
            minHeight: "56px",
          }}
        >
          <span style={{ fontWeight: 800, fontSize: "1rem" }}>
            Learning Platform
          </span>
          <button
            onClick={onClose}
            aria-label="关闭导航"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "1.25rem",
              color: "var(--lap-text-muted)",
              padding: "4px",
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Nav items */}
        <nav
          style={{
            flex: 1,
            padding: "var(--lap-space-3)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--lap-space-1)",
            overflowY: "auto",
          }}
          aria-label="移动端导航"
        >
          {USER_NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                style={{
                  display: "flex",
                  alignItems: "center",
                  minHeight: "44px",
                  padding: "8px 14px",
                  borderRadius: "var(--lap-radius-md)",
                  fontSize: "0.9375rem",
                  fontWeight: active ? 700 : 500,
                  color: active ? "var(--lap-accent-primary)" : "var(--lap-text-secondary)",
                  background: active ? "#e8edf4" : "transparent",
                  textDecoration: "none",
                  transition: "background var(--lap-transition-fast)",
                }}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar footer */}
        <div
          style={{
            padding: "var(--lap-space-4)",
            borderTop: "var(--lap-border-light)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--lap-space-2)",
          }}
        >
          <span className="lap-dev-badge">dev-preview</span>
          <Link
            href="/admin"
            onClick={onClose}
            style={{
              fontSize: "0.8125rem",
              color: "var(--lap-text-subtle)",
              textDecoration: "none",
            }}
          >
            后台管理（开发预览）
          </Link>
        </div>
      </div>
    </>
  );
}
