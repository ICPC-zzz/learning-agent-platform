import type { ReactNode } from "react";

import "./globals.css";

export const metadata = {
  title: "Learning Agent Platform",
  description: "编程学习与智能体预览平台"
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
