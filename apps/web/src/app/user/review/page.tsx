import { cookies } from "next/headers";
import Link from "next/link";
import { deserializeDevSession, getSafeSessionSummary } from "../../../lib/web-auth-dev-session";
import { UserReviewRecommendationsClientHydration } from "./UserReviewRecommendationsClientHydration";

/**
 * /user/review — Review Recommendations page (A396).
 * Displays deterministic review recommendations from learning data.
 *
 * @previewOnly — dev-only / 规则型推荐 / 未调用 LLM
 */

export default async function UserReviewPage() {
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
          <p className="eyebrow">A396 Review Recommendations</p>
          <h1>复习推荐（开发预览）</h1>
          <p className="status">
            规则型推荐 · 未调用 LLM · local fallback · 未接生产账号
          </p>
        </div>
        <div className="homeActions">
          <Link className="secondaryLink" href="/user">
            &larr; User Center
          </Link>
          <Link className="secondaryLink" href="/user/report">
            Learning Report
          </Link>
          <Link className="secondaryLink" href="/user/today">
            Today Plan
          </Link>
        </div>
      </header>

      <section className="learningPanel" aria-labelledby="review-intro-title">
        <div className="panelHeader">
          <h2 id="review-intro-title">复习推荐</h2>
          <p className="panelNote">
            基于错题本、最近刷题、阅读进度、笔记/书签、AI 问答历史生成确定性推荐。
          </p>
        </div>
        <div style={{ marginTop: "14px" }}>
          <p style={{ color: "#64748b", fontSize: "13px" }}>
            推荐按优先级排序：
          </p>
          <ol style={{ fontSize: "12px", color: "#64748b", lineHeight: "1.8", paddingLeft: "20px", marginTop: "8px" }}>
            <li>待复习错题（needs-review）</li>
            <li>高频错题（wrongCount ≥ 2）</li>
            <li>最近练习标记为 needs-review 的题</li>
            <li>最近阅读但未完成的章节</li>
            <li>有笔记/书签但近期未阅读的章节</li>
            <li>AI 问答历史中出现过的章节</li>
            <li>收藏但未练习的题目</li>
          </ol>
          <p style={{ color: "#92400e", fontSize: "12px", marginTop: "12px" }}>
            开发预览 · 规则型推荐 · 未调用 LLM · 未接生产账号
          </p>
        </div>
      </section>

      {/* Client hydration */}
      <section className="learningPanel" aria-labelledby="review-list-title">
        <div className="panelHeader">
          <h2 id="review-list-title">推荐列表（客户端水合）</h2>
          <p className="panelNote">客户端渲染后显示完整的推荐列表，数据来自 localStorage。</p>
        </div>
        <UserReviewRecommendationsClientHydration hasSession={hasSession} />
      </section>

      {/* Footer */}
      <section className="learningPanel" aria-labelledby="review-footer-title" style={{ marginTop: "20px" }}>
        <div className="panelHeader">
          <h2 id="review-footer-title" style={{ fontSize: "14px", color: "#94a3b8" }}>推荐来源说明</h2>
        </div>
        <ul style={{ fontSize: "12px", color: "#94a3b8", lineHeight: "1.8", paddingLeft: "16px" }}>
          <li>规则型推荐 — 基于确定性规则，非 AI</li>
          <li>不调用 LLM — 不使用任何语言模型</li>
          <li>localStorage fallback — 数据来自浏览器本地存储</li>
          <li>未接生产账号 — 未连接真实用户系统</li>
          <li>每条推荐标注 safety label</li>
        </ul>
      </section>
    </main>
  );
}
