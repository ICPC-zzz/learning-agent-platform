/**
 * AppNav - shared navigation configuration for user-facing pages.
 *
 * Defines the primary user navigation items used by AppHeader, AppSidebar,
 * and the home page hero section.
 *
 * @previewOnly - navigation only, no data access
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface AppNavItem {
  href: string;
  label: string;
  description?: string;
  /** If true, only shown in dev mode (not production) */
  devOnly?: boolean;
  /** If true, the item is an external/target indicator vs. active route */
  external?: boolean;
}

/** Primary user navigation items - Auth-first 4-page structure. */
export const USER_NAV_ITEMS: AppNavItem[] = [
  { href: "/", label: "首页" },
  { href: "/articles", label: "文章" },
  { href: "/problems", label: "题目中心" },
  { href: "/ai", label: "AI助手" },
  { href: "/user", label: "个人" },
];

/** Admin nav is intentionally separate - never mixed into user nav. */
export const ADMIN_NAV_ITEMS: AppNavItem[] = [
  { href: "/admin", label: "管理概览" },
  { href: "/admin/problems", label: "题目资源" },
  { href: "/admin/sync", label: "内容同步" },
  { href: "/admin/ai", label: "AI 助手" },
  { href: "/admin/settings", label: "系统设置" },
];

/** Hook: returns whether a given href matches the current path. */
export function useIsActive(href: string): boolean {
  const pathname = usePathname();
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

/** Client nav link component with active state styling. */
export function NavLink({ item }: { item: AppNavItem }) {
  const isActive = useIsActive(item.href);
  return (
    <Link
      href={item.href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: "40px",
        padding: "6px 14px",
        borderRadius: "8px",
        fontSize: "0.875rem",
        fontWeight: isActive ? 700 : 500,
        color: isActive ? "#0a4f36" : "#2f3b4b",
        background: isActive ? "#e8f2ea" : "transparent",
        textDecoration: "none",
        transition: "background var(--lap-transition-fast), color var(--lap-transition-fast)",
      }}
      aria-current={isActive ? "page" : undefined}
    >
      {item.label}
    </Link>
  );
}
