import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { AdminShell } from "../_components/AdminShell";
import { isCurrentUserAdmin } from "../../lib/admin/admin-auth";

/**
 * Admin layout — wraps all /admin/* pages in AdminShell.
 *
 * Visual/navigation isolation from user pages:
 * - Dark header vs light user header
 * - Left sidebar with admin-only nav
 * - No user main nav
 * - No learning workflow
 * - Floating assistant removed; admin pages do not mount assistant overlays
 */

export const metadata = {
  title: "Admin — Learning Agent Platform",
  description: "后台管理 — 开发预览",
};

export default async function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  const adminStatus = await isCurrentUserAdmin();
  if (!adminStatus.ok) {
    notFound();
  }

  return <AdminShell>{children}</AdminShell>;
}
