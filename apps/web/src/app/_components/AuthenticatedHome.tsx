/**
 * AuthenticatedHome - shown on the home page after login.
 *
 * Displays a welcome message with 4-page navigation overview:
 * 文章、题目中心、AI助手、个人
 *
 * Also shows the dev-only session status.
 *
 * @previewOnly
 */

import Link from "next/link";

interface AuthenticatedHomeProps {
  displayName: string;
  sessionMode: string;
}

export function AuthenticatedHome({ displayName, sessionMode }: AuthenticatedHomeProps) {
  return (
    <main className="page">
      <section className="hero" style={{ paddingTop: "var(--lap-space-6)", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--lap-space-3)", marginBottom: "var(--lap-space-3)" }}>
          <p className="eyebrow" style={{ margin: 0 }}>开发预览</p>
          <span className="lap-dev-badge">dev-only 路 productionReady=false</span>
        </div>
        <h1 style={{ fontSize: "2rem", lineHeight: 1.15 }}>
          欢迎回来{displayName ? `，${displayName}` : ""}
        </h1>
        <p className="status" style={{ maxWidth: "56ch", margin: "12px auto 0" }}>
          当前会话模式：{sessionMode}。您已通过 dev-only 登录，可使用以下四个主要功能模块。
        </p>
      </section>

      <section style={{ marginTop: "var(--lap-space-8)" }}>
        <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--lap-text-primary)", margin: "0 0 var(--lap-space-4)", textAlign: "center" }}>
          主导航
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "var(--lap-space-4)",
            maxWidth: "800px",
            margin: "0 auto",
          }}
        >
          <NavCard
            href="/articles"
            icon="文"
            title="文章"
            description="浏览聚合的博客园与 CSDN 技术文章，点击进入原文阅读。"
            accent="linear-gradient(135deg, #244a73 0%, #3b6fa0 100%)"
          />
          <NavCard
            href="/problems"
            icon="题"
            title="题目中心"
            description="查看 Codeforces 精选题目，按 rating 和标签筛选，并跳转官方原题训练。"
            accent="linear-gradient(135deg, #c05d3b 0%, #d47a5a 100%)"
          />
          <NavCard
            href="/ai"
            icon="AI"
            title="AI助手"
            description="网页端限制版 Agent，可读取当前页面上下文与安全学习数据摘要。"
            accent="linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)"
            badge="网页端限制版"
          />
          <NavCard
            href="/user"
            icon="人"
            title="个人"
            description="查看 Codeforces 用户数据、薄弱标签、学习报告、训练计划和复习统计。"
            accent="linear-gradient(135deg, #4f6f52 0%, #6b8f6e 100%)"
          />
        </div>
      </section>

      <section style={{ marginTop: "var(--lap-space-8)" }}>
        <div
          style={{
            textAlign: "center",
            padding: "var(--lap-space-4)",
            background: "var(--lap-bg-card-alt)",
            borderRadius: "var(--lap-radius-md)",
            border: "var(--lap-border-light)",
            maxWidth: "480px",
            margin: "0 auto",
          }}
        >
          <p style={{ fontSize: "0.75rem", color: "var(--lap-text-muted)", margin: 0 }}>
            会话模式：<strong>{sessionMode}</strong> 路 dev-only 路 非生产 Auth
          </p>
          <p style={{ fontSize: "0.6875rem", color: "var(--lap-text-subtle)", margin: "4px 0 0" }}>
            您也可以点击右下角 AI 悬浮球获取学习帮助。
          </p>
        </div>
      </section>

      <footer
        style={{
          marginTop: "var(--lap-space-12)",
          paddingTop: "var(--lap-space-6)",
          borderTop: "var(--lap-border-light)",
          textAlign: "center",
        }}
      >
        <span style={{ fontSize: "0.75rem", color: "var(--lap-text-subtle)" }}>
          开发预览 路 productionReady=false 路 受限于 dev-only 安全边界
        </span>
      </footer>
    </main>
  );
}

function NavCard({
  href,
  icon,
  title,
  description,
  accent,
  badge,
}: {
  href: string;
  icon: string;
  title: string;
  description: string;
  accent: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="lap-card lap-card--hover"
      style={{
        textDecoration: "none",
        padding: "var(--lap-space-5)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--lap-space-3)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--lap-space-3)" }}>
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "var(--lap-radius-lg)",
            background: accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: "1rem",
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 700, color: "var(--lap-text-primary)" }}>
            {title}
          </h3>
          {badge ? (
            <span
              style={{
                fontSize: "0.625rem",
                color: "var(--lap-status-dev-text)",
                background: "var(--lap-status-dev-bg)",
                padding: "1px 6px",
                borderRadius: "var(--lap-radius-sm)",
              }}
            >
              {badge}
            </span>
          ) : null}
        </div>
      </div>
      <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--lap-text-muted)", lineHeight: 1.5 }}>
        {description}
      </p>
    </Link>
  );
}
