import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

import { loadProblemById } from "../problem-detail-loader";
import { deserializeDevSession } from "../../../lib/web-auth-dev-session";
import { getFavoritesDbStatusForUi } from "../../user/favorites-db-guard";
import { FavoriteProblemButton } from "../../../components/problems/FavoriteProblemButton";
import { ProblemPracticeStatusControl } from "../../../components/problems/ProblemPracticeStatusControl";
import { ProblemPracticeActivityControl } from "./ProblemPracticeActivityControl";
import { ProblemWrongBookControl } from "./ProblemWrongBookControl";
import { getLearningActivityDbStatusForUi } from "../../user/learning-activity-db-guard";
import { getProblemWrongBookDbStatusForUi } from "../../user/problem-wrong-book-db-guard";

interface ProblemDetailPageProps {
  params?: Promise<{
    problemId?: string;
  }>;
}

export default async function ProblemDetailPage({ params }: ProblemDetailPageProps) {
  const resolvedParams = params ? await params : { problemId: undefined };
  const problemId =
    typeof resolvedParams.problemId === "string" ? resolvedParams.problemId : undefined;

  const result = loadProblemById(problemId);

  if (!result.found) {
    notFound();
  }

  const problem = result.problem!;

  // Read dev session
  let devSessionOwnerId: string | null = null;
  let favDbEnabled = false;
  let activityDbEnabled = false;
  let wrongBookDbEnabled = false;
  try {
    const cookieStore = await cookies();
    const devSessionCookie = cookieStore.get("lap-web-dev-session")?.value;
    const favDbStatus = getFavoritesDbStatusForUi(devSessionCookie);
    favDbEnabled = favDbStatus.enabled;
    const activityDbStatus = getLearningActivityDbStatusForUi(devSessionCookie);
    activityDbEnabled = activityDbStatus.enabled;
    const wrongBookDbStatus = getProblemWrongBookDbStatusForUi(devSessionCookie);
    wrongBookDbEnabled = wrongBookDbStatus.enabled;
    const session = deserializeDevSession(devSessionCookie);
    devSessionOwnerId = session?.userIdPreview ?? null;
  } catch {
    favDbEnabled = false;
    activityDbEnabled = false;
    wrongBookDbEnabled = false;
    devSessionOwnerId = null;
  }

  const difficultyBadge = (d: string) => {
    const colors: Record<string, string> = {
      easy: "#16a34a",
      medium: "#d97706",
      hard: "#dc2626",
      challenge: "#7c3aed",
    };
    return (
      <span
        style={{
          background: colors[d] ?? "#64748b",
          borderRadius: "4px",
          color: "#fff",
          fontSize: "12px",
          fontWeight: 600,
          padding: "3px 10px",
          textTransform: "uppercase",
        }}
      >
        {d}
      </span>
    );
  };

  return (
    <main className="learningPage">
      <header className="learningHero">
        <div>
          <p className="eyebrow">A387 Problem Detail</p>
          <h1>{problem.title}</h1>
          <p className="status">
            内置示例题 · 用于练习路径演示 · 未接真实判题系统 · 不执行代码
          </p>
        </div>
        <div className="homeActions">
          <Link className="secondaryLink" href="/problems">
            ← 返回题目列表
          </Link>
          <Link className="secondaryLink" href="/user/recent-practice">
            最近刷题
          </Link>
          <Link className="secondaryLink" href="/user/favorites/problems">
            收藏题目
          </Link>
        </div>
      </header>

      {/* Problem header info */}
      <section className="learningPanel" aria-labelledby="problem-info-title">
        <div className="panelHeader">
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "8px" }}>
            {difficultyBadge(problem.difficulty)}
            <span className="eyebrow" style={{ margin: 0 }}>{problem.problemId}</span>
            <span style={{ color: "#64748b", fontSize: "12px" }}>
              预计用时 {problem.estimatedMinutes} 分钟
            </span>
          </div>
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "10px" }}>
            {problem.tags.map((t) => (
              <span
                key={t}
                style={{
                  background: "#e2e8f0",
                  borderRadius: "3px",
                  color: "#334155",
                  fontSize: "12px",
                  padding: "2px 8px",
                }}
              >
                {t}
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
            <FavoriteProblemButton
              problemId={problem.problemId}
              title={problem.title}
              difficulty={problem.difficulty}
              tags={problem.tags}
              dbFavoritesEnabled={favDbEnabled}
              devSessionOwnerId={devSessionOwnerId}
            />
            <ProblemPracticeStatusControl
              problemId={problem.problemId}
              title={problem.title}
              difficulty={problem.difficulty}
            />
            <ProblemPracticeActivityControl
              problemId={problem.problemId}
              title={problem.title}
              difficulty={problem.difficulty}
              dbEnabled={activityDbEnabled}
              devSessionOwnerId={devSessionOwnerId}
            />
            <ProblemWrongBookControl
              problemId={problem.problemId}
              title={problem.title}
              difficulty={problem.difficulty}
              tags={problem.tags}
              dbWrongBookEnabled={wrongBookDbEnabled}
              devSessionOwnerId={devSessionOwnerId}
            />
          </div>
        </div>
      </section>

      {/* Problem statement */}
      <section className="learningPanel" aria-labelledby="problem-statement-title">
        <div className="panelHeader">
          <h2 id="problem-statement-title">题面描述</h2>
        </div>
        <div style={{ marginTop: "12px", lineHeight: "1.7", whiteSpace: "pre-wrap", fontSize: "14px" }}>
          {problem.statement}
        </div>
      </section>

      {/* Input / Output */}
      <section className="learningPanel" aria-labelledby="problem-io-title">
        <div className="panelHeader">
          <h2 id="problem-io-title">输入输出说明</h2>
        </div>
        <div style={{ marginTop: "12px" }}>
          <div style={{ marginBottom: "12px" }}>
            <strong style={{ color: "#0f172a", fontSize: "13px" }}>输入：</strong>
            <p style={{ color: "#475569", fontSize: "13px", margin: "4px 0 0 0", whiteSpace: "pre-wrap" }}>
              {problem.inputDescription}
            </p>
          </div>
          <div>
            <strong style={{ color: "#0f172a", fontSize: "13px" }}>输出：</strong>
            <p style={{ color: "#475569", fontSize: "13px", margin: "4px 0 0 0", whiteSpace: "pre-wrap" }}>
              {problem.outputDescription}
            </p>
          </div>
        </div>
      </section>

      {/* Examples */}
      <section className="learningPanel" aria-labelledby="problem-examples-title">
        <div className="panelHeader">
          <h2 id="problem-examples-title">样例</h2>
        </div>
        <div style={{ marginTop: "12px" }}>
          {problem.examples.map((ex, idx) => (
            <div
              key={idx}
              style={{
                marginBottom: "14px",
                padding: "12px",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
              }}
            >
              <p style={{ fontWeight: 600, fontSize: "12px", color: "#64748b", margin: "0 0 8px 0" }}>
                样例 {idx + 1}
              </p>
              <div style={{ marginBottom: "6px" }}>
                <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600 }}>输入：</span>
                <pre style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "4px", fontSize: "12px", margin: "2px 0 0 0", padding: "8px", whiteSpace: "pre-wrap" }}>
                  {ex.input}
                </pre>
              </div>
              <div style={{ marginBottom: "6px" }}>
                <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600 }}>输出：</span>
                <pre style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "4px", fontSize: "12px", margin: "2px 0 0 0", padding: "8px", whiteSpace: "pre-wrap" }}>
                  {ex.output}
                </pre>
              </div>
              {ex.explanation ? (
                <div>
                  <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600 }}>说明：</span>
                  <p style={{ color: "#475569", fontSize: "12px", margin: "2px 0 0 0" }}>
                    {ex.explanation}
                  </p>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {/* Hints */}
      <section className="learningPanel" aria-labelledby="problem-hints-title">
        <div className="panelHeader">
          <h2 id="problem-hints-title">提示</h2>
        </div>
        <div style={{ marginTop: "12px" }}>
          <ol style={{ paddingLeft: "20px", margin: 0 }}>
            {problem.hints.map((hint, idx) => (
              <li key={idx} style={{ color: "#475569", fontSize: "13px", marginBottom: "4px", lineHeight: "1.6" }}>
                {hint}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Footer notices */}
      <div style={{ marginTop: "20px" }}>
        <div
          style={{
            padding: "10px 14px",
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: "6px",
            fontSize: "12px",
            color: "#92400e",
            marginBottom: "8px",
          }}
        >
          此页面不提供代码运行和提交判题功能。题目系统 v1，未接真实判题、未接生产账号。
          收藏和练习状态存储在浏览器本地。
        </div>
        <div
          style={{
            padding: "10px 14px",
            background: "#f1f5f9",
            border: "1px solid #e2e8f0",
            borderRadius: "6px",
            fontSize: "12px",
            color: "#64748b",
          }}
        >
          数据来源：{result.sourceNote}
        </div>
      </div>
    </main>
  );
}
