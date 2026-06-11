import { cookies } from "next/headers";
import Link from "next/link";
import { deserializeDevSession, getSafeSessionSummary } from "../../../lib/web-auth-dev-session";
import { getDevAuthGuardStatus } from "../../../lib/web-auth-dev-guard";
import { AuthStatusCard } from "../../../components/auth/AuthStatusCard";
import { loadDbProblemWrongBook } from "../problem-wrong-book-db-loader";
import type { DbWrongBookLoadResult } from "../problem-wrong-book-db-loader";
import { buildWrongBookPageView } from "./user-wrong-book-page-view-model";
import type { WrongBookPageView } from "./user-wrong-book-page-view-model";
import { UserWrongBookClientHydration } from "./UserWrongBookClientHydration";

export default async function WrongBookPage() {
  const guard = getDevAuthGuardStatus();

  let sessionSummary;
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("lap-web-dev-session")?.value;
    const payload = deserializeDevSession(raw);
    sessionSummary = getSafeSessionSummary(payload);
  } catch {
    sessionSummary = getSafeSessionSummary(null);
  }

  // Load DB wrong book
  let dbResult: DbWrongBookLoadResult;
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("lap-web-dev-session")?.value;
    dbResult = await loadDbProblemWrongBook(raw);
  } catch {
    dbResult = await loadDbProblemWrongBook(undefined);
  }

  // Build view model with empty local entries (hydrated on client)
  const view: WrongBookPageView = buildWrongBookPageView({
    dbGuardEnabled: dbResult.guardEnabled,
    dbItems: dbResult.items,
    dbActive: dbResult.useDbWrongBook,
    localEntries: [],
    hasSession: sessionSummary.hasSession,
  });

  return (
    <main className="learningPage">
      <header className="learningHero">
        <div>
          <p className="eyebrow">A395 Problem Wrong Book</p>
          <h1>错题本</h1>
          <p className="status">
            开发预览 · {view.dataSourceNotice} · 不执行代码 · 不接真实判题
          </p>
        </div>
        <div className="homeActions">
          <Link className="secondaryLink" href="/user">
            ← 返回用户中心
          </Link>
          <Link className="secondaryLink" href="/problems">
            题目中心
          </Link>
          <Link className="secondaryLink" href="/user/recent-practice">
            最近刷题
          </Link>
          <Link className="secondaryLink" href="/user/favorites/problems">
            收藏题目
          </Link>
          {!sessionSummary.hasSession ? (
            <Link className="primaryLink" href="/login">
              Dev Login
            </Link>
          ) : null}
        </div>
      </header>

      <AuthStatusCard
        hasSession={sessionSummary.hasSession}
        displayName={sessionSummary.user?.displayName ?? null}
        sessionMode={sessionSummary.sessionMode}
        role={sessionSummary.user?.role ?? null}
        status={sessionSummary.status}
        notice={sessionSummary.notice}
        guardEnabled={guard.enabled}
      />

      {/* Stats summary */}
      <section className="learningPanel" aria-labelledby="wrong-book-summary-title">
        <div className="panelHeader">
          <p className="eyebrow">A395 Stats</p>
          <h2 id="wrong-book-summary-title">错题汇总（开发预览）</h2>
          <p className="panelNote">{view.dataSourceNotice}</p>
        </div>

        <dl className="scoreMeta" style={{ marginTop: "14px" }}>
          <div>
            <dt>错题总数</dt>
            <dd>
              {view.totalCount}
              <span style={{ color: "#64748b", fontSize: "11px", marginLeft: "6px" }}>
                ({view.dataSource === "db" ? "DB" : view.dataSource === "local" ? "local" : "none"})
              </span>
            </dd>
          </div>
          <div>
            <dt>待复习</dt>
            <dd style={{ color: view.needsReviewCount > 0 ? "#d97706" : "#16a34a" }}>
              {view.needsReviewCount}
            </dd>
          </div>
          {view.mostRecentWrongAt ? (
            <div>
              <dt>最近错误时间</dt>
              <dd style={{ fontSize: "12px" }}>
                {view.mostRecentWrongAt.slice(0, 10)}
              </dd>
            </div>
          ) : null}
        </dl>

        <p style={{ fontSize: "12px", color: "#64748b", marginTop: "8px" }}>
          {view.message}
        </p>

        <UserWrongBookClientHydration dbHasData={view.dataSource === "db" || view.dataSource === "mixed"} />
      </section>

      {/* Wrong book items */}
      <section className="learningPanel" aria-labelledby="wrong-book-items-title">
        <div className="panelHeader">
          <p className="eyebrow">Items</p>
          <h2 id="wrong-book-items-title">错题列表</h2>
        </div>

        {view.items.length === 0 ? (
          <div className="learningEmptyState" aria-live="polite">
            <strong>暂无错题记录</strong>
            <p>
              {sessionSummary.hasSession
                ? "“在题目详情页点击”记录一次做错“或”“加入错题本”即可记录。不执行代码，不接真实判题。"
                : "请先登录 dev session 后使用错题本。"}
            </p>
            {sessionSummary.hasSession ? (
              <Link className="primaryLink" href="/problems" style={{ marginTop: "8px", display: "inline-block" }}>
                前往题目中心
              </Link>
            ) : (
              <Link className="primaryLink" href="/login" style={{ marginTop: "8px", display: "inline-block" }}>
                Dev Login
              </Link>
            )}
          </div>
        ) : (
          <div className="chunkList" style={{ marginTop: "14px" }}>
            {view.items.map((item) => (
              <article className="chunkItem" key={item.id}>
                <div className="panelHeaderRow">
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
                      <p className="eyebrow" style={{ margin: 0 }}>
                        {item.source === "db" ? "DB" : "local"} · {item.difficulty}
                      </p>
                      <span
                        style={{
                          fontSize: "10px",
                          padding: "1px 6px",
                          borderRadius: "3px",
                          background:
                            item.reviewStatus === "needs-review"
                              ? "#fef3c7"
                              : item.reviewStatus === "reviewed"
                                ? "#dbeafe"
                                : "#dcfce7",
                          color:
                            item.reviewStatus === "needs-review"
                              ? "#92400e"
                              : item.reviewStatus === "reviewed"
                                ? "#1e40af"
                                : "#166534",
                        }}
                      >
                        {item.reviewStatus === "needs-review"
                          ? "待复习"
                          : item.reviewStatus === "reviewed"
                            ? "已复习"
                            : "已掌握"}
                      </span>
                    </div>
                    <h3 style={{ fontSize: "14px", margin: "0 0 4px 0" }}>{item.problemTitle}</h3>
                    <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "4px" }}>
                      {item.tags.slice(0, 8).map((t: string) => (
                        <span
                          key={t}
                          style={{
                            background: "#e2e8f0",
                            borderRadius: "3px",
                            color: "#334155",
                            fontSize: "11px",
                            padding: "1px 6px",
                          }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                    <p className="panelNote" style={{ margin: "0 0 4px 0" }}>
                      错误次数：{item.wrongCount} · 最近错误：{item.lastWrongAt.slice(0, 10)}
                    </p>
                    {item.notePreview ? (
                      <p style={{ fontSize: "11px", color: "#64748b", fontStyle: "italic", margin: "2px 0" }}>
                        备注：{item.notePreview.slice(0, 100)}
                      </p>
                    ) : null}
                    <p style={{ fontSize: "10px", color: "#94a3b8", margin: "2px 0" }}>
                      {item.notice}
                    </p>
                  </div>
                  <Link
                    className="primaryLink"
                    href={`/problems/${encodeURIComponent(item.problemId)}`}
                    style={{ fontSize: "12px", whiteSpace: "nowrap" }}
                  >
                    查看题目
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Safety notices */}
      <div style={{ marginTop: "20px" }}>
        <div
          style={{
            padding: "10px 14px",
            background: "#fefce8",
            border: "1px solid #fde68a",
            borderRadius: "6px",
            fontSize: "12px",
            color: "#92400e",
            marginBottom: "8px",
          }}
        >
          错题本 v1 · 开发预览 · 所有数据本地存储 · 未接真实判题系统 · 未接生产账号。
          记录做错不执行代码、不连接判题机、不代表真实 AC/WA 结果。
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
          数据来源：{view.dataSourceNotice}
        </div>
      </div>
    </main>
  );
}
