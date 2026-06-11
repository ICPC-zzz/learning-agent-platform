import { cookies } from "next/headers";
import Link from "next/link";
import { deserializeDevSession, getSafeSessionSummary } from "../../../lib/web-auth-dev-session";
import { getDevAuthGuardStatus } from "../../../lib/web-auth-dev-guard";
import { loadDbReaderNotes, type DbReaderNotesLoadResult } from "../reader-notes-db-loader";
import { buildNotesPageViewModel } from "./user-notes-page-view-model";
import { UserNotesClientHydration } from "./UserNotesClientHydration";

export default async function UserNotesPage() {
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

  // Load DB notes
  let dbNotesResult: DbReaderNotesLoadResult;
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("lap-web-dev-session")?.value;
    dbNotesResult = await loadDbReaderNotes(raw);
  } catch {
    dbNotesResult = await loadDbReaderNotes(undefined);
  }

  // Build view model (localStorage is client-only, pass empty)
  const viewModel = buildNotesPageViewModel({
    dbItems: dbNotesResult.useDbNotes ? dbNotesResult.items : null,
    dbEnabled: dbNotesResult.guardEnabled,
    hasSession: sessionSummary.hasSession,
    dbMessage: dbNotesResult.message,
    localItems: [], // localStorage is client-only here
  });

  return (
    <main className="learningPage">
      <header className="learningHero">
        <div>
          <p className="eyebrow">A390 Reader Notes</p>
          <h1>User Reading Notes</h1>
          <p className="status">
            dev preview · {viewModel.dataSourceNotice}
          </p>
        </div>
        <div className="homeActions">
          <Link className="secondaryLink" href="/user">
            User Center
          </Link>
          <Link className="secondaryLink" href="/reader">
            Reader
          </Link>
          <Link className="secondaryLink" href="/books">
            Books
          </Link>
        </div>
      </header>

      <section className="learningPanel" aria-labelledby="notes-list-title">
        <div className="panelHeader">
          <p className="eyebrow">Reader Notes</p>
          <h2 id="notes-list-title">
            阅读笔记
            {viewModel.totalCount > 0 ? ` (${viewModel.totalCount})` : ""}
          </h2>
          <p className="panelNote">{viewModel.dataSourceNotice}</p>
        </div>

        <div style={{ marginTop: "14px" }}>
          {viewModel.items.length === 0 ? (
            <div className="learningEmptyState" aria-live="polite">
              <strong>暂无笔记</strong>
              <p>{viewModel.message}</p>
              <Link
                className="primaryLink"
                href="/reader"
                style={{ marginTop: "8px", display: "inline-block" }}
              >
                前往 Reader 添加笔记
              </Link>
            </div>
          ) : (
            <div className="chunkList">
              {viewModel.items.map((item, index) => (
                <article className="chunkItem" key={item.id + "-" + index}>
                  <div className="panelHeaderRow">
                    <div>
                      <p className="eyebrow">
                        {Math.round(item.progressRatio * 100)}% · {item.sourceLabel.toUpperCase()} · {item.sourceType}
                      </p>
                      <h3>{item.bookTitle}</h3>
                      <p className="panelNote">{item.chapterTitle}</p>
                      {item.excerptPreview ? (
                        <p style={{
                          fontSize: "12px",
                          color: "#64748b",
                          fontStyle: "italic",
                          marginTop: "4px",
                          borderLeft: "3px solid #e2e8f0",
                          paddingLeft: "8px",
                        }}>
                          摘录：{item.excerptPreview}
                        </p>
                      ) : null}
                      <p style={{
                        fontSize: "13px",
                        color: "#334155",
                        marginTop: "6px",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}>
                        {item.noteTextPreview}
                      </p>
                      <p style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>
                        创建：{item.createdAt ? new Date(item.createdAt).toLocaleString() : "-"}
                        {item.updatedAt !== item.createdAt
                          ? ` · 更新：${new Date(item.updatedAt).toLocaleString()}`
                          : ""}
                      </p>
                    </div>
                    <Link
                      className="primaryLink"
                      href={item.readerLink}
                    >
                      Continue Reading
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}

          <p style={{
            color: "#92400e",
            fontSize: "11px",
            fontStyle: "italic",
            marginTop: "12px",
          }}>
            dev-only · local fallback · 未接生产账号 · 不保存完整章节正文 · noteText 限制 1000 字
          </p>
        </div>
      </section>

      {/* A391: Client-side localStorage hydration */}
      <UserNotesClientHydration
        hasDbData={dbNotesResult.useDbNotes && dbNotesResult.items.length > 0}
        dataSourceNote={dbNotesResult.guardEnabled ? "DB enabled" : "local fallback"}
      />
    </main>
  );
}
