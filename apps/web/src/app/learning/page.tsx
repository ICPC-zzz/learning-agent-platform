import Link from "next/link";
import { getCurrentAuthSession } from "../../lib/session/web-auth-session";

/**
 * /learning — Learning Center page (A397).
 *
 * Unified entry point for all learning-related sub-pages:
 * report, review recommendations, today plan, activity timeline,
 * wrong book, recent reading, recent practice, AI history.
 *
 * @previewOnly — dev-only / 规则型学习反馈 / 未调用 LLM
 */

const ENTRY_CARDS = [
  {
    title: "每日挑战",
    description: "每天一道规则推荐题，基于错题本、收藏、练习记录选择。确定性规则，不调用 LLM。",
    href: "/daily-challenge",
    label: "A399 每日挑战",
    accent: "#3b82f6",
  },
  {
    title: "学习报告",
    description: "聚合题目、错题、训练状态和 AI 问答摘要，生成学习摘要。",
    href: "/user/report",
    label: "A396 学习报告",
    accent: "#166534",
  },
  {
    title: "复习推荐",
    description: "基于错题本、薄弱标签和近期训练生成确定性复习建议（7 级优先级）。",
    href: "/user/review",
    label: "A396 复习推荐",
    accent: "#1e40af",
  },
  {
    title: "今日计划",
    description: "基于本地学习数据生成 3–5 个建议任务，估计用时和原因。",
    href: "/user/today",
    label: "A396 今日计划",
    accent: "#9a3412",
  },
  {
    title: "学习活动",
    description: "查看学习活动时间线：练习、收藏、复习和 AI 分析等记录。",
    href: "/user/activity",
    label: "A392 学习活动",
    accent: "#4f46e5",
  },
  {
    title: "错题本",
    description: "记录和复习做错的题目，本地错题本（localStorage fallback）。",
    href: "/user/wrong-book",
    label: "A395 错题本",
    accent: "#dc2626",
  },
  {
    title: "最近刷题",
    description: "查看最近练习的题目记录。",
    href: "/user/recent-practice",
    label: "最近刷题",
    accent: "#7c3aed",
  },
  {
    title: "AI 问答历史",
    description: "查看 QA 问答历史的安全摘要（不保存 raw prompt/response）。",
    href: "/user/ai-history",
    label: "AI 问答历史",
    accent: "#0891b2",
  },
];

export default async function LearningCenterPage() {
  const session = await getCurrentAuthSession();
  const hasSession = session.hasSession;

  return (
    <main className="learningPage">
      <header className="learningHero">
        <div>
          <p className="eyebrow">A397 Learning Center</p>
          <h1>学习中心（开发预览）</h1>
          <p className="status">
            规则型学习反馈 · 未调用 LLM · local fallback · 未接生产账号
          </p>
        </div>
        <div className="homeActions">
          <Link className="secondaryLink" href="/">
            Home
          </Link>
          <Link className="secondaryLink" href="/user">
            User Center
          </Link>
        </div>
      </header>

      {/* Intro */}
      <section className="learningPanel" aria-labelledby="learning-intro-title">
        <div className="panelHeader">
          <h2 id="learning-intro-title">学习反馈入口</h2>
          <p className="panelNote">
            聚合已有学习数据，通过确定性规则生成报告、推荐和计划。所有计算在浏览器本地完成，不调用 LLM。
          </p>
        </div>
        <div style={{ marginTop: "14px", padding: "10px", backgroundColor: "#f8fafc", borderRadius: "6px" }}>
          <p style={{ fontSize: "12px", color: "#64748b", lineHeight: "1.7" }}>
            <strong>当前状态：</strong>
            规则型学习反馈 · 开发预览 · localStorage fallback · 未调用 LLM · 未接生产账号。
            数据来自浏览器 localStorage 本地存储，不保存到数据库（DB guard 默认关闭）。
            所有推荐为确定性规则计算，不依赖 AI 模型。
            每日挑战基于 6 级优先级规则，同一天同样数据返回同一道题。
          </p>
        </div>
      </section>

      {/* Entry cards */}
      <section className="learningPanel" aria-labelledby="learning-cards-title">
        <div className="panelHeader">
          <h2 id="learning-cards-title">学习功能入口</h2>
          <p className="panelNote">点击进入各个学习功能模块。</p>
        </div>
        <div
          style={{
            marginTop: "14px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: "12px",
          }}
        >
          {ENTRY_CARDS.map(function (card) {
            return (
              <div
                key={card.href}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  padding: "14px",
                  backgroundColor: "#ffffff",
                }}
              >
                <p style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "4px" }}>
                  {card.label}
                </p>
                <h3 style={{ fontSize: "15px", color: "#1e293b", marginBottom: "6px" }}>
                  {card.title}
                </h3>
                <p style={{ fontSize: "12px", color: "#64748b", marginBottom: "10px", lineHeight: "1.6" }}>
                  {card.description}
                </p>
                <Link
                  href={card.href}
                  style={{
                    display: "inline-block",
                    padding: "4px 12px",
                    fontSize: "12px",
                    fontWeight: "500",
                    color: "#ffffff",
                    backgroundColor: card.accent,
                    borderRadius: "4px",
                    textDecoration: "none",
                  }}
                >
                  进入 →
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <section className="learningPanel" aria-labelledby="learning-footer-title" style={{ marginTop: "20px" }}>
        <div className="panelHeader">
          <h2 id="learning-footer-title" style={{ fontSize: "14px", color: "#94a3b8" }}>
            数据来源说明
          </h2>
        </div>
        <ul style={{ fontSize: "12px", color: "#94a3b8", lineHeight: "1.8", paddingLeft: "16px" }}>
          <li>规则型学习反馈 — 基于确定性规则，非 AI</li>
          <li>不调用 LLM — 不使用任何语言模型</li>
          <li>localStorage fallback — 数据存储在浏览器本地</li>
          <li>未接生产账号 — 未连接真实用户系统</li>
          <li>DB guard 默认关闭 — 不保存学习数据到数据库</li>
          <li>不读取 raw prompt/response — 仅聚合安全摘要</li>
        </ul>
      </section>
    </main>
  );
}
