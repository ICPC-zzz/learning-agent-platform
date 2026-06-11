import { cookies } from "next/headers";
import Link from "next/link";
import { deserializeDevSession, getSafeSessionSummary } from "../../lib/web-auth-dev-session";
import DailyChallengeClient from "./DailyChallengeClient";

/**
 * /daily-challenge — Daily Challenge page (A399).
 *
 * Displays today's recommended challenge problem selected deterministically
 * from built-in problems and local learning data. Supports status tracking
 * via localStorage.
 *
 * @previewOnly — 开发预览 / 规则生成 / 未调用 LLM
 */

export default async function DailyChallengePage() {
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
          <p className="eyebrow">A399 Daily Challenge</p>
          <h1>每日挑战（开发预览）</h1>
          <p className="status">
            规则型推荐 · 未调用 LLM · 未接真实判题 · localStorage fallback · 不保存判题结果
          </p>
        </div>
        <div className="homeActions">
          <Link className="secondaryLink" href="/">
            Home
          </Link>
          <Link className="secondaryLink" href="/user">
            User Center
          </Link>
          <Link className="secondaryLink" href="/learning">
            Learning Center
          </Link>
          <Link className="secondaryLink" href="/problems">
            Problems
          </Link>
          <Link className="secondaryLink" href="/user/today">
            Today Plan
          </Link>
        </div>
      </header>

      {/* Intro */}
      <section className="learningPanel" aria-labelledby="dc-intro-title">
        <div className="panelHeader">
          <h2 id="dc-intro-title">每日一道推荐题</h2>
          <p className="panelNote">
            基于错题本、收藏题目、最近练习记录，通过确定性规则推荐今天该做的一道题。
          </p>
        </div>
        <div style={{ marginTop: "14px", padding: "10px", backgroundColor: "#f8fafc", borderRadius: "6px" }}>
          <p style={{ fontSize: "12px", color: "#64748b", lineHeight: "1.7" }}>
            <strong>推荐规则：</strong>
            1. 待复习错题优先；2. 错题次数高优先；3. 收藏但近期未练的题；4. 状态为需要复习的题；5. 按日期从内置题库选择。
            所有推荐为确定性规则计算，同一天同样数据返回同一道题，不调用 LLM，不使用随机数。
          </p>
          <p style={{ fontSize: "11px", color: "#94a3b8", marginTop: "6px" }}>
            开发预览 · 规则生成 · 未调用 LLM · 未接真实判题 · localStorage fallback · 不保存用户代码
          </p>
        </div>
      </section>

      {/* Client hydration */}
      <DailyChallengeClient />

      {/* Footer */}
      <section className="learningPanel" aria-labelledby="dc-footer-title" style={{ marginTop: "20px" }}>
        <div className="panelHeader">
          <h2 id="dc-footer-title" style={{ fontSize: "14px", color: "#94a3b8" }}>数据来源说明</h2>
        </div>
        <ul style={{ fontSize: "12px", color: "#94a3b8", lineHeight: "1.8", paddingLeft: "16px" }}>
          <li>规则型每日挑战 — 基于确定性优先级规则生成</li>
          <li>不调用 LLM — 不使用任何 AI 语言模型</li>
          <li>不调用 Agent / Provider / Tool — 纯前端规则引擎</li>
          <li>未接真实判题 — 不执行用户代码，不连接 Online Judge</li>
          <li>localStorage fallback — 挑战状态存储在浏览器本地</li>
          <li>不保存用户代码 — 不保存 raw prompt / raw response</li>
          <li>不保存判题结果 — 仅保存题目 ID、标题、状态和时间戳</li>
          <li>未接生产账号 — 未连接真实用户系统</li>
          <li>DB guard 默认关闭 — 不保存挑战数据到数据库</li>
        </ul>
      </section>
    </main>
  );
}
