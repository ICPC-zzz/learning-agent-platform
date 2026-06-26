import type { ReactNode } from "react";
import { AdminShell } from "../_components/AdminShell";

/**
 * Admin layout — wraps all /admin/* pages in AdminShell.
 *
 * Visual/navigation isolation from user pages:
 * - Dark header vs light user header
 * - Left sidebar with admin-only nav
 * - No user main nav
 * - No learning workflow
 * - Floating AI assistant hidden on admin pages (handled by FloatingAiAssistant)
 */

export const metadata = {
  title: "Admin — Learning Agent Platform",
  description: "后台管理 — 开发预览",
};

export default function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <AdminShell>{children}</AdminShell>;
}
