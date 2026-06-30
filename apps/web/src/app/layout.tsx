import type { ReactNode } from "react";

import "./globals.css";

import { ShellRouter } from "./_components/ShellRouter";
import { readAssistantSession } from "../lib/assistant/assistant-session";
import { isCurrentUserAdmin } from "../lib/admin/admin-auth";

export const metadata = {
  title: "Learning Agent Platform",
  description: "编程学习与智能体预览平台",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const assistantSession = await readAssistantSession();
  const adminStatus = await isCurrentUserAdmin();

  return (
    <html lang="zh-CN">
      <body>
        <ShellRouter hasSession={assistantSession.hasSession} canAccessAdmin={adminStatus.ok}>
          {children}
        </ShellRouter>

      </body>
    </html>
  );
}
