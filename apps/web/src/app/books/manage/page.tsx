import { cookies } from "next/headers";
import Link from "next/link";
import { buildImportedBooksManagementViewModel } from "./imported-books-management-view-model";
import { ManageBookRenameForm } from "./ManageBookRenameForm";
import { ManageBookArchiveForm } from "./ManageBookArchiveForm";

export default async function ManageBooksPage() {
  let cookieValue: string | undefined;
  try {
    const cookieStore = await cookies();
    cookieValue = cookieStore.get("lap-web-dev-session")?.value;
  } catch {
    // No cookies available — will show no-session state
  }

  const viewModel = await buildImportedBooksManagementViewModel({ cookieValue });

  return (
    <main className="learningPage">
      <header className="learningHero">
        <div>
          <p className="eyebrow">A378 Book Management v1</p>
          <h1>My Imported Books</h1>
          <p className="status">
            dev preview · dev session归属 · 未接生产账号 · DB persist opt-in
          </p>
        </div>
        <div className="homeActions">
          <Link className="secondaryLink" href="/">
            Home
          </Link>
          <Link className="secondaryLink" href="/books">
            Books
          </Link>
          <Link className="secondaryLink" href="/user">
            User Center
          </Link>
          <Link className="secondaryLink" href="/import">
            Import
          </Link>
          {!viewModel.ownerContext.hasOwner ? (
            <Link className="primaryLink" href="/login">
              Dev Login
            </Link>
          ) : null}
        </div>
      </header>

      {/* Guard status cards */}
      <section className="learningPanel" aria-labelledby="guard-status-title">
        <div className="panelHeader">
          <p className="eyebrow">Guard Status</p>
          <h2 id="guard-status-title">Environment Guards</h2>
        </div>
        <dl className="scoreMeta" style={{ marginTop: "14px" }}>
          <div>
            <dt>Dev Auth</dt>
            <dd style={{ color: viewModel.ownerContext.devAuthEnabled ? "#16a34a" : "#92400e" }}>
              {viewModel.ownerContext.devAuthEnabled ? "enabled" : "disabled"}
            </dd>
          </div>
          <div>
            <dt>DB Persist</dt>
            <dd style={{ color: viewModel.dbPersistGuard.enabled ? "#16a34a" : "#92400e" }}>
              {viewModel.dbPersistGuard.enabled ? "enabled" : "disabled"}
            </dd>
          </div>
          <div>
            <dt>Session</dt>
            <dd style={{ color: viewModel.ownerContext.hasOwner ? "#16a34a" : "#92400e" }}>
              {viewModel.ownerContext.sessionSummary.status}
            </dd>
          </div>
          {viewModel.ownerContext.ownerLabel ? (
            <div>
              <dt>Owner</dt>
              <dd>{viewModel.ownerContext.ownerLabel} ({viewModel.ownerContext.ownerId})</dd>
            </div>
          ) : null}
        </dl>
        {viewModel.ownerContext.blockedReasons.length > 0 ? (
          <div className="learningEmptyState" aria-live="polite" style={{ marginTop: "12px" }}>
            <strong>Blocked Reasons</strong>
            <ul style={{ textAlign: "left", marginTop: "8px" }}>
              {viewModel.ownerContext.blockedReasons.map((reason, i) => (
                <li key={i} style={{ color: "#92400e", fontSize: "13px" }}>{reason}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {/* Session info (always visible) */}
      <section className="learningPanel" aria-labelledby="session-title">
        <div className="panelHeader">
          <p className="eyebrow">Dev Session</p>
          <h2 id="session-title">Session Info</h2>
          <p className="panelNote">dev session归属 · 未接生产账号</p>
        </div>
        <div style={{ marginTop: "14px" }}>
          <p>{viewModel.ownerContext.sessionSummary.notice}</p>
          {!viewModel.ownerContext.sessionSummary.hasSession ? (
            <div style={{ marginTop: "12px" }}>
              <Link className="primaryLink" href="/login">
                Go to Dev Login
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      {/* Book list */}
      <section className="learningPanel" aria-labelledby="imported-books-title">
        <div className="panelHeader">
          <p className="eyebrow">Imported Books</p>
          <h2 id="imported-books-title">
            Your Imported Books
            {viewModel.totalCount > 0 ? ` (${viewModel.totalCount})` : ""}
          </h2>
          <p className="panelNote">开发 DB 导入书籍 · dev-only · 未接生产用户书库</p>
        </div>

        {viewModel.status === "no-session" && (
          <div className="learningEmptyState" aria-live="polite" style={{ marginTop: "14px" }}>
            <strong>No Dev Session</strong>
            <p>{viewModel.message}</p>
            <div style={{ marginTop: "12px" }}>
              <Link className="primaryLink" href="/login">
                Dev Login
              </Link>
            </div>
          </div>
        )}

        {viewModel.status === "db-persist-disabled" && (
          <div className="learningEmptyState" aria-live="polite" style={{ marginTop: "14px" }}>
            <strong>DB Import Management Not Enabled</strong>
            <p>{viewModel.message}</p>
          </div>
        )}

        {viewModel.status === "no-db-url" && (
          <div className="learningEmptyState" aria-live="polite" style={{ marginTop: "14px" }}>
            <strong>Database Not Configured</strong>
            <p>{viewModel.message}</p>
          </div>
        )}

        {viewModel.status === "no-books" && (
          <div className="learningEmptyState" aria-live="polite" style={{ marginTop: "14px" }}>
            <strong>No Imported Books</strong>
            <p>{viewModel.message}</p>
            <div style={{ marginTop: "12px" }}>
              <Link className="primaryLink" href="/import">
                Import Text
              </Link>
            </div>
          </div>
        )}

        {viewModel.status === "error" && (
          <div className="learningEmptyState" aria-live="polite" style={{ marginTop: "14px" }}>
            <strong>Error</strong>
            <p>{viewModel.message}</p>
          </div>
        )}

        {viewModel.status === "loaded" && viewModel.books.length > 0 && (
          <div style={{ marginTop: "14px" }}>
            {viewModel.books.map((book) => (
              <div
                key={book.id}
                className="learningPanel"
                style={{
                  marginBottom: "12px",
                  padding: "16px",
                  border: book.isArchived ? "1px solid #fbbf24" : "1px solid var(--color-border, #e2e8f0)",
                  borderRadius: "8px",
                  background: book.isArchived ? "#fffbeb" : undefined,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: 0, fontSize: "16px" }}>
                      {book.title}
                      {book.isArchived ? (
                        <span style={{
                          marginLeft: "8px",
                          padding: "2px 8px",
                          background: "#fbbf24",
                          color: "#78350f",
                          borderRadius: "4px",
                          fontSize: "11px",
                          fontWeight: 600,
                        }}>
                          archived
                        </span>
                      ) : null}
                    </h3>
                    <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "13px" }}>
                      {book.author ? `${book.author} · ` : ""}
                      {book.sourceLabel}
                    </p>
                    <p style={{ margin: "4px 0 0", color: "#94a3b8", fontSize: "12px" }}>
                      ID: {book.id.slice(0, 12)}...
                      {book.createdAtLabel ? ` · Created: ${book.createdAtLabel}` : ""}
                      {book.updatedAtLabel ? ` · Updated: ${book.updatedAtLabel}` : ""}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "8px", flexShrink: 0, marginLeft: "16px" }}>
                    <Link className="secondaryLink" href={book.detailHref} style={{ fontSize: "12px" }}>
                      Detail
                    </Link>
                    {book.readerHref ? (
                      <Link className="secondaryLink" href={book.readerHref} style={{ fontSize: "12px" }}>
                        Read
                      </Link>
                    ) : null}
                  </div>
                </div>

                {/* Management actions */}
                {viewModel.canManage ? (
                  <div style={{ marginTop: "12px", display: "flex", gap: "12px", flexWrap: "wrap", borderTop: "1px solid #e2e8f0", paddingTop: "12px" }}>
                    <ManageBookRenameForm bookId={book.id} currentTitle={book.title} />
                    <ManageBookArchiveForm bookId={book.id} isArchived={book.isArchived} />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Footer note */}
      <section className="learningPanel" aria-labelledby="notes-title">
        <div className="panelHeader">
          <p className="eyebrow">Notes</p>
          <h2 id="notes-title">Important</h2>
        </div>
        <div style={{ marginTop: "14px", fontSize: "13px", color: "#64748b" }}>
          <p>· 所有操作均为 dev-only，不会影响生产数据。</p>
          <p>· 归档操作不物理删除数据，仅标记为隐藏状态。</p>
          <p>· 重命名操作仅修改书籍元数据标题，不改动章节内容。</p>
          <p>· dev session 归属使用 userIdPreview，未接生产 User 表的真实 ID。</p>
        </div>
      </section>
    </main>
  );
}
