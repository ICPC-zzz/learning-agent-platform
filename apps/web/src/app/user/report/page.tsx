import { cookies } from "next/headers";
import Link from "next/link";
import { deserializeDevSession, getSafeSessionSummary } from "../../../lib/web-auth-dev-session";
import { buildLearningReportView, LEARNING_STATUS_LABELS } from "./user-learning-report-view-model";
import type { LearningReportSummary } from "../../../lib/learning-insight-types";
import { UserLearningReportClientHydration } from "./UserLearningReportClientHydration";

/**
 * /user/report — Learning Report page (A396).
 * Displays aggregated learning report from all available data sources.
 *
 * @previewOnly — dev-only / 规则型统计 / 未调用 LLM
 */

export default async function UserReportPage() {
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

  // Build the report with client-only data (SSR renders empty, client hydration fills)
  // For SSR, we render the page skeleton; the actual data comes from client hydration.
  // This is consistent with the existing pattern used by /user/wrong-book etc.

  return (
    <main className="learningPage">
      <header className="learningHero">
        <div>
          <p className="eyebrow">A396 Learning Report</p>
          <h1>学习报告（开发预览）</h1>
          <p className="status">
            规则型统计 · 未调用 LLM · local fallback · 未接生产账号
          </p>
        </div>
        <div className="homeActions">
          <Link className="secondaryLink" href="/user">
            &larr; User Center
          </Link>
          <Link className="secondaryLink" href="/user/review">
            Review Recommendations
          </Link>
          <Link className="secondaryLink" href="/user/today">
            Today Plan
          </Link>
        </div>
      </header>

      <section className="learningPanel" aria-labelledby="report-empty-title">
        <div className="panelHeader">
          <h2 id="report-empty-title">学习报告</h2>
          <p className="panelNote">
            此页面数据来自浏览器 localStorage 本地存储。打开此页面后，数据将在客户端自动聚合展示。
          </p>
        </div>
        <div style={{ marginTop: "14px" }}>
          <p style={{ color: "#64748b", fontSize: "13px" }}>
            学习报告数据在客户端渲染。请确保已在 Reader 中阅读、在题目详情页练习，数据将自动在此聚合。
          </p>
          <p style={{ color: "#92400e", fontSize: "12px", marginTop: "8px" }}>
            开发预览 · 未接生产账号 · 未调用 LLM · 规则型统计
          </p>
        </div>
      </section>

      {/* Client hydration */}
      <section className="learningPanel" aria-labelledby="report-detail-title">
        <div className="panelHeader">
          <h2 id="report-detail-title">报告详情（客户端水合）</h2>
          <p className="panelNote">客户端渲染后显示完整学习报告数据，数据来自 localStorage。</p>
        </div>
        <UserLearningReportClientHydration hasSession={hasSession} />
      </section>

      {/* Footer */}
      <section className="learningPanel" aria-labelledby="report-footer-title" style={{ marginTop: "20px" }}>
        <div className="panelHeader">
          <h2 id="report-footer-title" style={{ fontSize: "14px", color: "#94a3b8" }}>数据来源说明</h2>
        </div>
        <ul style={{ fontSize: "12px", color: "#94a3b8", lineHeight: "1.8", paddingLeft: "16px" }}>
          <li>dev-only — 开发预览数据</li>
          <li>localStorage fallback — 数据存储在浏览器本地</li>
          <li>未接生产账号 — 未连接真实用户系统</li>
          <li>未调用 LLM — 所有统计为规则型计算</li>
          <li>不读取 raw prompt/response — 仅聚合安全摘要</li>
        </ul>
      </section>
    </main>
  );
}
