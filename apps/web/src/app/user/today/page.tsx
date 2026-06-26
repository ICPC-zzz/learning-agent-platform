import { cookies } from "next/headers";
import Link from "next/link";
import { deserializeDevSession, getSafeSessionSummary } from "../../../lib/web-auth-dev-session";
import { UserTodayPlanClientHydration } from "./UserTodayPlanClientHydration";

/**
 * /user/today — Today's Learning Plan page (A396).
 * Displays a deterministic daily plan with 3–5 suggested tasks.
 *
 * @previewOnly — dev-only / 规则型计划 / 未调用 LLM
 */

export default async function UserTodayPlanPage() {
  let hasSession = false;

  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("lap-web-dev-session")?.value;
    const payload = deserializeDevSession(raw);
    const summary = getSafeSessionSummary(payload);
    hasSession = summary.hasSession;
  } catch {
    // Silently ignore — no session
  }

  return (
    <main className="learningPage">
      <header className="learningHero">
        <div>
          <p className="eyebrow">A396 Today Plan</p>
          <h1>今日学习计划（开发预览）</h1>
          <p className="status">
            规则型计划 · 未调用 LLM · local fallback · 未接生产账号 · 不保存到 DB
          </p>
        </div>
        <div className="homeActions">
          <Link className="secondaryLink" href="/user">
            &larr; User Center
          </Link>
          <Link className="secondaryLink" href="/user/report">
            Learning Report
          </Link>
          <Link className="secondaryLink" href="/user/review">
            Review Recommendations
          </Link>
        </div>
      </header>

      <section className="learningPanel" aria-labelledby="plan-intro-title">
        <div className="panelHeader">
          <h2 id="plan-intro-title">今日学习计划</h2>
          <p className="panelNote">
            基于错题本、阅读进度、笔记、收藏题目、AI 问答历史生成 3–5 个建议任务。
          </p>
        </div>
        <div style={{ marginTop: "14px" }}>
          <p style={{ color: "#64748b", fontSize: "13px" }}>
            每个任务标注估计耗时。不保存任务到 DB，仅作为当日学习建议。
          </p>
          <p style={{ color: "#92400e", fontSize: "12px", marginTop: "8px" }}>
            开发预览 · 规则型计划 · 未调用 LLM · 不保存任务到 DB · 未接生产账号
          </p>
        </div>
      </section>

      {/* Client hydration */}
      <section className="learningPanel" aria-labelledby="plan-tasks-title">
        <div className="panelHeader">
          <h2 id="plan-tasks-title">今日任务（客户端水合）</h2>
          <p className="panelNote">客户端渲染后显示 3–5 个今日学习任务，数据来自 localStorage。</p>
        </div>
        <UserTodayPlanClientHydration hasSession={hasSession} />
      </section>

      {/* Footer */}
      <section className="learningPanel" aria-labelledby="plan-footer-title" style={{ marginTop: "20px" }}>
        <div className="panelHeader">
          <h2 id="plan-footer-title" style={{ fontSize: "14px", color: "#94a3b8" }}>计划来源说明</h2>
        </div>
        <ul style={{ fontSize: "12px", color: "#94a3b8", lineHeight: "1.8", paddingLeft: "16px" }}>
          <li>规则型今日计划 — 基于确定性规则生成</li>
          <li>不调用 LLM — 不使用任何语言模型</li>
          <li>不保存任务到 DB — 仅当日预览，不持久化</li>
          <li>localStorage fallback — 数据来自浏览器本地存储</li>
          <li>未接生产账号 — 未连接真实用户系统</li>
          <li>每个任务标注 dev-only label</li>
        </ul>
      </section>
    </main>
  );
}
