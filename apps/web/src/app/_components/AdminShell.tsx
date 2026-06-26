/**
 * AdminShell — Admin-facing layout shell.
 *
 * Completely separate from AppShell (user). Uses:
 * - AdminHeader (dark top bar)
 * - AdminSidebar (dark left nav)
 * - Main content area with admin-dev identifiers
 *
 * Does NOT include user navigation, learning workflow, or the AI assistant.
 *
 * @previewOnly — admin UI shell, no data access
 */

"use client";

import type { ReactNode } from "react";
import { AdminHeader } from "./AdminHeader";
import { AdminSidebar } from "./AdminSidebar";

export interface AdminShellProps {
  children: ReactNode;
}

export function AdminShell({ children }: AdminShellProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <AdminHeader />
      <div style={{ display: "flex", flex: 1 }}>
        <AdminSidebar />
        <main
          style={{
            flex: 1,
            background: "#f8fafc",
            padding: "var(--lap-space-6)",
            minWidth: 0,
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
