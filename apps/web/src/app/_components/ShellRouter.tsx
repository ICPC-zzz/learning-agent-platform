/**
 * ShellRouter — chooses between AppShell (user) and plain content (admin).
 *
 * Admin pages have their own AdminShell via admin/layout.tsx,
 * so we only render AppShell for non-admin routes.
 *
 * @previewOnly
 */

"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "./AppShell";
import type { ReactNode } from "react";

export function ShellRouter({
  children,
  hasSession = false,
}: {
  children: ReactNode;
  hasSession?: boolean;
}) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");

  if (isAdmin) {
    // Admin pages have their own layout (admin/layout.tsx with AdminShell)
    return <>{children}</>;
  }

  return <AppShell hasSession={hasSession}>{children}</AppShell>;
}
