import { cookies } from "next/headers";
import Link from "next/link";
import { deserializeDevSession, getSafeSessionSummary } from "../../../lib/web-auth-dev-session";
import { getDevAuthGuardStatus } from "../../../lib/web-auth-dev-guard";
import { loadDbReaderBookmarks, type DbReaderBookmarksLoadResult } from "../reader-bookmarks-db-loader";
import { buildBookmarksPageViewModel } from "./user-bookmarks-page-view-model";
import { UserBookmarksClientHydration } from "./UserBookmarksClientHydration";

export default async function UserBookmarksPage() {
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

  // Load DB bookmarks
  let dbBookmarksResult: DbReaderBookmarksLoadResult;
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("lap-web-dev-session")?.value;
    dbBookmarksResult = await loadDbReaderBookmarks(raw);
  } catch {
    dbBookmarksResult = await loadDbReaderBookmarks(undefined);
  }

  // Build view model (localStorage is client-only, pass empty)
  const viewModel = buildBookmarksPageViewModel({
    dbItems: dbBookmarksResult.useDbBookmarks ? dbBookmarksResult.items : null,
    dbEnabled: dbBookmarksResult.guardEnabled,
    hasSession: sessionSummary.hasSession,
    dbMessage: dbBookmarksResult.message,
    localItems: [], // localStorage is client-only here
  });

  return (
    <main className="learningPage">
      <header className="learningHero">
        <div>
          <p className="eyebrow">A390 Reader Bookmarks</p>
          <h1>User Reading Bookmarks</h1>
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

      <section className="learningPanel" aria-labelledby="bookmarks-list-title">
        <div className="panelHeader">
          <p className="eyebrow">Reader Bookmarks</p>
          <h2 id="bookmarks-list-title">
            阅读书签
            {viewModel.totalCount > 0 ? ` (${viewModel.totalCount})` : ""}
          </h2>
          <p className="panelNote">{viewModel.dataSourceNotice}</p>
        </div>

        <div style={{ marginTop: "14px" }}>
          {viewModel.items.length === 0 ? (
            <div className="learningEmptyState" aria-live="polite">
              <strong>暂无书签</strong>
              <p>{viewModel.message}</p>
              <Link
                className="primaryLink"
                href="/reader"
                style={{ marginTop: "8px", display: "inline-block" }}
              >
                前往 Reader 添加书签
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
            dev-only · local fallback · 未接生产账号 · 不保存完整章节正文
          </p>
        </div>
      </section>

      {/* A391: Client-side localStorage hydration */}
      <UserBookmarksClientHydration
        hasDbData={dbBookmarksResult.useDbBookmarks && dbBookmarksResult.items.length > 0}
        dataSourceNote={dbBookmarksResult.guardEnabled ? "DB enabled" : "local fallback"}
      />
    </main>
  );
}
