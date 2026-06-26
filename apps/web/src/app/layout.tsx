import type { ReactNode } from "react";
import { Suspense } from "react";

import "./globals.css";

import { FloatingAiAssistant } from "./_components/FloatingAiAssistant";
import { SessionRefresher } from "./_components/SessionRefresher";
import { ShellRouter } from "./_components/ShellRouter";
import { readAssistantSession } from "../lib/assistant/assistant-session";

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

  return (
    <html lang="zh-CN">
      <body>
        <SessionRefresher />

        <ShellRouter hasSession={assistantSession.hasSession}>
          {children}
        </ShellRouter>

        <Suspense fallback={null}>
          <FloatingAiAssistant
            hasSession={assistantSession.hasSession}
          />
        </Suspense>
      </body>
    </html>
  );
}
