/**
 * AdminSidebar — Admin left sidebar navigation.
 *
 * Provides admin-specific nav items: 概览、书籍管理、题目管理、导入管理、系统设置.
 * Completely separate from user-side AppSidebar.
 *
 * @previewOnly — admin UI shell, no data access
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_NAV_ITEMS } from "./AppNav";

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="lap-hide-mobile"
      style={{
        width: "220px",
        flexShrink: 0,
        minHeight: "calc(100vh - 52px)",
        background: "#0f172a",
        borderRight: "1px solid #1e293b",
        padding: "var(--lap-space-4) var(--lap-space-3)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <nav
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--lap-space-1)",
        }}
        aria-label="后台管理导航"
      >
        {ADMIN_NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                minHeight: "38px",
                padding: "6px 12px",
                borderRadius: "var(--lap-radius-md)",
                fontSize: "0.8125rem",
                fontWeight: isActive ? 600 : 400,
                color: isActive ? "#f1f5f9" : "#94a3b8",
                background: isActive ? "#1e293b" : "transparent",
                textDecoration: "none",
                transition: "background var(--lap-transition-fast)",
              }}
              aria-current={isActive ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Safety footer */}
      <div style={{ marginTop: "auto", paddingTop: "var(--lap-space-4)" }}>
        <div
          style={{
            padding: "var(--lap-space-3)",
            borderRadius: "var(--lap-radius-md)",
            background: "#1e293b",
            fontSize: "0.6875rem",
            color: "#64748b",
            lineHeight: 1.5,
          }}
        >
          <p style={{ margin: 0, fontWeight: 600, color: "#fbbf24", marginBottom: "4px" }}>
            ⚠ 安全提示
          </p>
          <p style={{ margin: 0 }}>
            只读/预览管理 · 不执行写操作 · 不修改数据库
          </p>
        </div>
      </div>
    </aside>
  );
}
