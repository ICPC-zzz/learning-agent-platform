import { cookies } from "next/headers";
import Link from "next/link";
import { deserializeDevSession, getSafeSessionSummary } from "../../../lib/web-auth-dev-session";
import { evaluateReaderAiHistoryDbGuard } from "../reader-ai-history-db-guard";
import { loadReaderAiHistoryFromDb } from "../reader-ai-history-db-loader";
import { buildUserAiHistoryPageViewModel } from "./user-ai-history-page-view-model";
import { UserAiHistoryClientHydration } from "./UserAiHistoryClientHydration";

export default async function UserAiHistoryPage() {
  var sessionSummary;
  try {
    var cookieStore = await cookies();
    var raw = cookieStore.get("lap-web-dev-session")?.value;
    var payload = deserializeDevSession(raw);
    sessionSummary = getSafeSessionSummary(payload);
  } catch {
    sessionSummary = getSafeSessionSummary(null);
  }

  var ownerId = sessionSummary.user?.userIdPreview ?? "";

  var guardResult = evaluateReaderAiHistoryDbGuard({
    LAP_ALLOW_REAL_DB_INTEGRATION: process.env.LAP_ALLOW_REAL_DB_INTEGRATION,
    DATABASE_URL: process.env.DATABASE_URL,
    LAP_WEB_AUTH_DEV_ENABLED: process.env.LAP_WEB_AUTH_DEV_ENABLED,
    LAP_READER_AI_HISTORY_DB_DEV_ENABLED: process.env.LAP_READER_AI_HISTORY_DB_DEV_ENABLED,
    hasDevSession: sessionSummary.hasSession,
  });

  var dbResult = await loadReaderAiHistoryFromDb(ownerId, guardResult);

  // Server-side: local items come from client hydration
  var viewModel = buildUserAiHistoryPageViewModel({
    dbItems: dbResult.items,
    localItems: [],
    dbGuardEnabled: guardResult.enabled,
    blockedReasons: guardResult.blockedReasons,
  });

  return (
    <main className="learningPage">
      <header className="learningHero">
        <div>
          <p className="eyebrow">A394 AI History</p>
          <h1>AI 问答历史</h1>
          <p className="status">
            dev preview · {guardResult.sourceLabel} · not synced to production
          </p>
        </div>
        <div className="homeActions">
          <Link className="secondaryLink" href="/">Home</Link>
          <Link className="secondaryLink" href="/user">User Center</Link>
          <Link className="secondaryLink" href="/reader">Reader</Link>
        </div>
      </header>

      {/* Guard status */}
      <section className="learningPanel" aria-labelledby="guard-title">
        <div className="panelHeader">
          <p className="eyebrow">DB Guard</p>
          <h2 id="guard-title">数据源状态</h2>
        </div>
        <dl className="scoreMeta" style={{ marginTop: "14px" }}>
          <div>
            <dt>数据源</dt>
            <dd>
              {viewModel.dataSourceLabel}
              <span style={{ color: "#64748b", fontSize: "11px", marginLeft: "6px" }}>
                ({viewModel.dataSourceNotice})
              </span>
            </dd>
          </div>
          <div>
            <dt>DB 条数</dt>
            <dd>{viewModel.dbCount}</dd>
          </div>
          <div>
            <dt>本地条数</dt>
            <dd>{viewModel.localCount}</dd>
          </div>
          <div>
            <dt>总计</dt>
            <dd>{viewModel.totalCount}</dd>
          </div>
          {viewModel.guardBlockedReasons.length > 0 && (
            <div>
              <dt>DB 阻止原因</dt>
              <dd style={{ color: "#92400e" }}>
                {viewModel.guardBlockedReasons.join("; ")}
              </dd>
            </div>
          )}
        </dl>
      </section>

      {/* Safety notice */}
      <section className="learningPanel" aria-labelledby="safety-title">
        <div className="panelHeader">
          <p className="eyebrow">Safety</p>
          <h2 id="safety-title">安全声明</h2>
        </div>
        <ul style={{ marginTop: "14px", color: "#475569", fontSize: "13px" }}>
          <li>{viewModel.safetyNotice}</li>
          <li>仅保存安全摘要（questionPreview ≤ 200字，answerPreview ≤ 500字）</li>
          <li>不保存 raw prompt · raw response · token · secret · cookie · API key</li>
          <li>默认 mock · dev-only · 未接生产 AI 服务</li>
          <li>DB 写入默认关闭，需多层显式 env 开启</li>
        </ul>
      </section>

      {/* Server-rendered DB items */}
      {viewModel.items.length > 0 && (
        <section className="learningPanel" aria-labelledby="history-title">
          <div className="panelHeader">
            <p className="eyebrow">History</p>
            <h2 id="history-title">问答记录</h2>
            <p className="panelNote">
              {viewModel.totalCount} 条记录 · {viewModel.dataSourceLabel}
            </p>
          </div>
          <div className="chunkList" style={{ marginTop: "14px" }}>
            {viewModel.items.map(function (item) {
              return (
                <article className="chunkItem" key={item.historyId}>
                  <div className="panelHeaderRow">
                    <div>
                      <p className="eyebrow">
                        {item.providerMode} · {item.sourceLabel} · {item.codeBlockCount} 代码块
                      </p>
                      <h3>{item.bookTitle}</h3>
                      <p className="panelNote">{item.chapterTitle}</p>
                    </div>
                    <Link className="primaryLink" href={item.readerLink}>
                      返回阅读
                    </Link>
                  </div>
                  <div style={{ marginTop: "8px" }}>
                    <p style={{ fontSize: "12px", color: "#64748b" }}>
                      <strong>Q:</strong> {item.questionPreview}
                    </p>
                    <p style={{ fontSize: "12px", color: "#334155", marginTop: "4px" }}>
                      <strong>A:</strong> {item.answerPreview}
                    </p>
                  </div>
                  <p style={{ fontSize: "10px", color: "#94a3b8", marginTop: "4px" }}>
                    {item.createdAt}
                    {item.realProviderCalled ? " · 真实 API 调用" : " · mock"}
                  </p>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Empty state */}
      {viewModel.items.length === 0 && (
        <section className="learningPanel" aria-labelledby="empty-title">
          <div className="learningEmptyState" aria-live="polite">
            <strong>暂无 AI 问答历史</strong>
            <p>
              在 Reader 中使用 AI 问答功能后，问答摘要将保存在本地浏览器中。
              如果 DB guard 全部开启（LAP_ALLOW_REAL_DB_INTEGRATION + DATABASE_URL +
              LAP_WEB_AUTH_DEV_ENABLED + LAP_READER_AI_HISTORY_DB_DEV_ENABLED），
              也可保存到开发数据库。
            </p>
            <Link className="primaryLink" href="/reader" style={{ marginTop: "8px", display: "inline-block" }}>
              前往 Reader
            </Link>
          </div>
        </section>
      )}

      {/* Client hydration for localStorage items */}
      <UserAiHistoryClientHydration
        dbItems={viewModel.items.filter(function (i) { return i.sourceLabel === "DB"; }).map(function (i) { return { id: i.historyId, bookId: i.bookId, chapterId: i.chapterId, bookTitle: i.bookTitle, chapterTitle: i.chapterTitle, questionPreview: i.questionPreview, answerPreview: i.answerPreview, providerMode: i.providerMode, realProviderCalled: i.realProviderCalled, codeBlockCount: i.codeBlockCount, createdAt: i.createdAt }; })}
      />
    </main>
  );
}
