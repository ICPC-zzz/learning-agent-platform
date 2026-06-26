/**
 * AppShell — User-facing layout shell.
 *
 * Wraps all user-facing pages with:
 * - AppHeader (top nav)
 * - AppSidebar (mobile slide-in nav)
 * - Main content area
 *
 * Does NOT include admin navigation. Admin pages use AdminShell instead.
 *
 * @previewOnly — UI shell only, no data access
 */

"use client";

import { useState, useCallback, type ReactNode } from "react";
import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";

export interface AppShellProps {
  children: ReactNode;
  hasSession?: boolean;
}

export function AppShell({ children, hasSession = false }: AppShellProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const toggleMobileSidebar = useCallback(() => {
    setMobileSidebarOpen((prev) => !prev);
  }, []);

  const closeMobileSidebar = useCallback(() => {
    setMobileSidebarOpen(false);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <AppHeader hasSession={hasSession} onToggleMobileSidebar={toggleMobileSidebar} />
      <AppSidebar isOpen={mobileSidebarOpen} onClose={closeMobileSidebar} />
      <main style={{ flex: 1 }}>{children}</main>
    </div>
  );
}
