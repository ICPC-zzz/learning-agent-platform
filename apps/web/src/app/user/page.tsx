import { cookies } from "next/headers";
import Link from "next/link";
import { deserializeDevSession, getSafeSessionSummary } from "../../lib/web-auth-dev-session";
import { getDevAuthGuardStatus } from "../../lib/web-auth-dev-guard";
import { getUserInfoView, EMPTY_STATE_MESSAGES } from "./user-dashboard-types";
import { AuthStatusCard } from "../../components/auth/AuthStatusCard";
import { UserFavoriteBooksPanel } from "../../components/user/UserFavoriteBooksPanel";
import { UserRecentReadingPanel } from "../../components/user/UserRecentReadingPanel";
import { getUserImportedBooksCount } from "./user-imported-books-loader";
import { loadUserRecentReadingDbProgress, type UserRecentReadingDbLoadResult } from "./user-recent-reading-db-loader";
import type { DbReadingProgressSummary } from "./user-recent-reading-db-loader";
import { loadDbFavorites } from "./favorites-db-loader";
import type { DbFavoritesLoadResult, DbFavoriteBookView } from "./favorites-db-view-model";
import { buildDashboardStatsView } from "./user-dashboard-stats-view-model";
import { loadDbProblemFavorites } from "./problem-favorites-db-loader";
import type { DbProblemFavoritesLoadResult, DbProblemFavoriteView } from "./problem-favorites-db-loader";
import { loadDbProblemPractice } from "./problem-practice-db-loader";
import type { DbProblemPracticeLoadResult, DbProblemPracticeView } from "./problem-practice-db-loader";
import { loadDbReaderBookmarks } from "./reader-bookmarks-db-loader";
import type { DbReaderBookmarksLoadResult } from "./reader-bookmarks-db-loader";
import { loadDbReaderNotes } from "./reader-notes-db-loader";
import type { DbReaderNotesLoadResult } from "./reader-notes-db-loader";
import { loadDbLearningActivities } from "./learning-activity-db-loader";
import type { LearningActivityDbLoadResult } from "./learning-activity-db-loader";
import { loadDbReadingSessions } from "./reading-session-db-loader";
import type { ReadingSessionDbLoadResult } from "./reading-session-db-loader";
import { loadDbProblemWrongBook } from "./problem-wrong-book-db-loader";
import type { DbWrongBookLoadResult } from "./problem-wrong-book-db-loader";
import { buildDashboardLearningStatsView } from "./user-dashboard-learning-stats-view-model";
import { UserDashboardUnifiedStatsHydration } from "./UserDashboardUnifiedStatsHydration";

export default async function UserPage() {
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

  let dbReadingProgress: UserRecentReadingDbLoadResult;
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("lap-web-dev-session")?.value;
    dbReadingProgress = await loadUserRecentReadingDbProgress(raw);
  } catch {
    dbReadingProgress = await loadUserRecentReadingDbProgress(undefined);
  }

  // A385: Load DB favorites
  let dbFavoritesResult: DbFavoritesLoadResult;
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("lap-web-dev-session")?.value;
    dbFavoritesResult = await loadDbFavorites(raw);
  } catch {
    dbFavoritesResult = await loadDbFavorites(undefined);
  }

  // A387: Load DB problem favorites
  let dbProblemFavResult: DbProblemFavoritesLoadResult;
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("lap-web-dev-session")?.value;
    dbProblemFavResult = await loadDbProblemFavorites(raw);
  } catch {
    dbProblemFavResult = await loadDbProblemFavorites(undefined);
  }

  // A387: Load DB practice records
  let dbPracticeResult: DbProblemPracticeLoadResult;
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("lap-web-dev-session")?.value;
    dbPracticeResult = await loadDbProblemPractice(raw);
  } catch {
    dbPracticeResult = await loadDbProblemPractice(undefined);
  }

  // A390: Load DB reader bookmarks
  let dbBookmarksResult: DbReaderBookmarksLoadResult;
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("lap-web-dev-session")?.value;
    dbBookmarksResult = await loadDbReaderBookmarks(raw);
  } catch {
    dbBookmarksResult = await loadDbReaderBookmarks(undefined);
  }

  // A390: Load DB reader notes
  let dbNotesResult: DbReaderNotesLoadResult;
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("lap-web-dev-session")?.value;
    dbNotesResult = await loadDbReaderNotes(raw);
  } catch {
    dbNotesResult = await loadDbReaderNotes(undefined);
  }

  // A392: Load DB learning activities
  let dbLearningActivitiesResult: LearningActivityDbLoadResult;
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("lap-web-dev-session")?.value;
    dbLearningActivitiesResult = await loadDbLearningActivities(raw, 20);
  } catch {
    dbLearningActivitiesResult = await loadDbLearningActivities(undefined, 20);
  }

  // A392: Load DB reading sessions
  let dbReadingSessionsResult: ReadingSessionDbLoadResult;
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("lap-web-dev-session")?.value;
    dbReadingSessionsResult = await loadDbReadingSessions(raw, 20);
  } catch {
    dbReadingSessionsResult = await loadDbReadingSessions(undefined, 20);
  }

  // A395: Load DB wrong book
  let dbWrongBookResult: DbWrongBookLoadResult;
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("lap-web-dev-session")?.value;
    dbWrongBookResult = await loadDbProblemWrongBook(raw);
  } catch {
    dbWrongBookResult = await loadDbProblemWrongBook(undefined);
  }

  let importedBookCount = 0;
  let canManageImports = false;
  if (sessionSummary.hasSession && sessionSummary.user) {
    try {
      const cookieStore = await cookies();
      const raw = cookieStore.get("lap-web-dev-session")?.value;
      const result = await getUserImportedBooksCount(raw);
      importedBookCount = result.count;
      canManageImports = result.canManage;
    } catch {
      // Silently ignore
    }
  }

  const user = getUserInfoView({
    hasSession: sessionSummary.hasSession,
    userIdPreview: sessionSummary.user?.userIdPreview ?? null,
    displayName: sessionSummary.user?.displayName ?? null,
    role: sessionSummary.user?.role ?? null,
    sessionMode: sessionSummary.sessionMode,
    createdAt: null,
  });

  // A386: Build dashboard stats view model
  const statsView = buildDashboardStatsView({
    hasSession: sessionSummary.hasSession,
    dbFavorites: dbFavoritesResult.useDbFavorites ? dbFavoritesResult.items : null,
    dbFavoritesEnabled: dbFavoritesResult.guardEnabled,
    localFavorites: [], // localStorage is client-only here
    dbProgressItems: dbReadingProgress.hasDbProgress ? dbReadingProgress.items : null,
    dbProgressEnabled: dbReadingProgress.guardEnabled,
    localRecentReadings: [], // localStorage is client-only here
    // A387: Problem data
    dbProblemFavorites: dbProblemFavResult.guardEnabled ? dbProblemFavResult.items : null,
    dbProblemFavoritesEnabled: dbProblemFavResult.guardEnabled,
    localProblemFavorites: [], // localStorage is client-only here
    dbPracticeItems: dbPracticeResult.guardEnabled ? dbPracticeResult.items : null,
    dbPracticeEnabled: dbPracticeResult.guardEnabled,
    localPracticeEntries: [], // localStorage is client-only here
    // A390: Reader bookmarks/notes
    dbReaderBookmarks: dbBookmarksResult.useDbBookmarks ? dbBookmarksResult.items : null,
    dbReaderBookmarksEnabled: dbBookmarksResult.guardEnabled,
    localReaderBookmarks: [], // localStorage is client-only here
    dbReaderNotes: dbNotesResult.useDbNotes ? dbNotesResult.items : null,
    dbReaderNotesEnabled: dbNotesResult.guardEnabled,
    localReaderNotes: [], // localStorage is client-only here
    importedBooksCount,
    canManageImports,
    // A395
    dbWrongBookItems: dbWrongBookResult.items,
    dbWrongBookEnabled: dbWrongBookResult.guardEnabled,
    localWrongBookEntries: [],
    dbWrongBookNeedsReviewCount: dbWrongBookResult.needsReviewCount,
    dbWrongBookTotalCount: dbWrongBookResult.totalCount,
    dbWrongBookMostRecentAt: null,
  });

  // A392: Build learning stats view model
  const learningStatsView = buildDashboardLearningStatsView({
    hasSession: sessionSummary.hasSession,
    dbActivities: dbLearningActivitiesResult.useDbActivities ? dbLearningActivitiesResult.items : null,
    dbActivitiesEnabled: dbLearningActivitiesResult.guardEnabled,
    localActivities: [], // localStorage is client-only here
    dbSessions: dbReadingSessionsResult.useDbSessions ? dbReadingSessionsResult.items : null,
    dbSessionsEnabled: dbReadingSessionsResult.guardEnabled,
    localSessions: [], // localStorage is client-only here
    dbReadingSessionSummary: dbReadingSessionsResult.useDbSessions ? dbReadingSessionsResult.summary : null,
  });

  const dbSection = renderDbReadingProgressSection(dbReadingProgress);

  return (
    <main className="learningPage">
      <header className="learningHero">
        <div>
          <p className="eyebrow">A378 Auth Session + Import Mgmt</p>
          <h1>User Center</h1>
          <p className="status">
            dev preview . local save .{" "}
            {sessionSummary.hasSession ? "dev session connected" : "not logged in"} . not synced to DB
          </p>
        </div>
        <div className="homeActions">
          <Link className="secondaryLink" href="/">
            Home
          </Link>
          <Link className="secondaryLink" href="/books">
            Books
          </Link>
          <Link className="secondaryLink" href="/import">
            Import
          </Link>
          <Link className="secondaryLink" href="/reader">
            Reader
          </Link>
          <Link className="secondaryLink" href="/user/favorites/books">
            Favorite Books
          </Link>
          <Link className="secondaryLink" href="/user/recent-reading">
            Recent Reading
          </Link>
          <Link className="secondaryLink" href="/user/favorites/problems">
            Favorite Problems
          </Link>
          <Link className="secondaryLink" href="/user/recent-practice">
            Recent Practice
          </Link>
          <Link className="secondaryLink" href="/user/bookmarks">
            Bookmarks
          </Link>
          <Link className="secondaryLink" href="/user/notes">
            Notes
          </Link>
          <Link className="secondaryLink" href="/user/activity">
            Activity
          </Link>
          <Link className="secondaryLink" href="/user/ai-history">
            AI History
          </Link>
          <Link className="secondaryLink" href="/user/wrong-book">
            Wrong Book
          </Link>
          <Link className="secondaryLink" href="/user/report">
            Learning Report
          </Link>
          <Link className="secondaryLink" href="/user/review">
            Review Recs
          </Link>
          <Link className="secondaryLink" href="/user/today">
            Today Plan
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

      {/* A398: Unified Dashboard Stats — replaces A386 stats + A392 learning stats */}
      <UserDashboardUnifiedStatsHydration
        serverStats={statsView}
        serverLearningStats={learningStatsView}
        hasSession={sessionSummary.hasSession}
      />

      <section className="learningPanel" aria-labelledby="user-info-title">
        <div className="panelHeader">
          <p className="eyebrow">User Info</p>
          <h2 id="user-info-title">{user.nickname}</h2>
        </div>
        <dl className="scoreMeta" style={{ marginTop: "14px" }}>
          <div>
            <dt>Name</dt>
            <dd>{user.nickname}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd style={{ color: sessionSummary.hasSession ? "#16a34a" : "#92400e" }}>
              {user.status}
            </dd>
          </div>
          {user.sessionMode ? (
            <div>
              <dt>Session Mode</dt>
              <dd style={{ color: "#92400e" }}>{user.sessionMode}</dd>
            </div>
          ) : null}
          <div>
            <dt>Note</dt>
            <dd>{user.notice}</dd>
          </div>
        </dl>
      </section>

      <UserFavoriteBooksPanel
        hasSession={sessionSummary.hasSession}
        dbFavorites={dbFavoritesResult.items}
        dbFavoritesEnabled={dbFavoritesResult.useDbFavorites}
        dbFavoritesMessage={dbFavoritesResult.message}
      />
      {dbSection}
      <UserRecentReadingPanel hasSession={sessionSummary.hasSession} />

      <section className="learningPanel" aria-labelledby="recent-problems-title">
        <div className="panelHeader">
          <p className="eyebrow">Problems</p>
          <h2 id="recent-problems-title">Recent Problems</h2>
          <p className="panelNote">{statsView.problemSystemMessage}</p>
        </div>
        <div style={{ marginTop: "14px" }}>
          {sessionSummary.hasSession ? (
            <div>
              <p style={{ fontSize: "13px", color: "#475569", marginBottom: "8px" }}>
                在题目详情页标记练习状态即可记录。不执行代码，不接真实判题。
              </p>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <Link className="primaryLink" href="/user/recent-practice">
                  查看最近刷题
                </Link>
                <Link className="secondaryLink" href="/problems">
                  前往题目中心
                </Link>
              </div>
            </div>
          ) : (
            <div>
              <p style={{ color: "#92400e", fontSize: "13px", marginBottom: "8px" }}>
                请先登录 dev session 后查看最近刷题。
              </p>
              <Link className="primaryLink" href="/login">
                Dev Login
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="learningPanel" aria-labelledby="fav-problems-title">
        <div className="panelHeader">
          <p className="eyebrow">Problem Favs</p>
          <h2 id="fav-problems-title">Favorite Problems</h2>
          <p className="panelNote">{statsView.problemSystemMessage}</p>
        </div>
        <div style={{ marginTop: "14px" }}>
          {sessionSummary.hasSession ? (
            <div>
              <p style={{ fontSize: "13px", color: "#475569", marginBottom: "8px" }}>
                在题目列表或详情页点击收藏按钮即可收藏。
              </p>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <Link className="primaryLink" href="/user/favorites/problems">
                  查看收藏题目
                </Link>
                <Link className="secondaryLink" href="/problems">
                  前往题目中心
                </Link>
              </div>
            </div>
          ) : (
            <div>
              <p style={{ color: "#92400e", fontSize: "13px", marginBottom: "8px" }}>
                请先登录 dev session 后查看收藏题目。
              </p>
              <Link className="primaryLink" href="/login">
                Dev Login
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* A395: Wrong Book Section */}
      <section className="learningPanel" aria-labelledby="wrong-book-title">
        <div className="panelHeader">
          <p className="eyebrow">Wrong Book</p>
          <h2 id="wrong-book-title">错题本（开发预览）</h2>
          <p className="panelNote">A395 · 未接真实判题 · 未接生产账号 · 本地 fallback</p>
        </div>
        <div style={{ marginTop: "14px" }}>
          {sessionSummary.hasSession ? (
            <div>
              <p style={{ fontSize: "13px", color: "#475569", marginBottom: "8px" }}>
                在题目详情页标记"记录一次做错"或"加入错题本"即可记录。不执行代码，不接真实判题。
              </p>
              {statsView.wrongBookTotalCount > 0 ? (
                <p style={{ fontSize: "12px", color: "#64748b", marginBottom: "8px" }}>
                  当前有 {statsView.wrongBookTotalCount} 条错题记录
                  {statsView.wrongBookNeedsReviewCount > 0
                    ? `，其中 ${statsView.wrongBookNeedsReviewCount} 条待复习`
                    : ""}。
                  {statsView.wrongBookMostRecentAt
                    ? ` 最近错误：${statsView.wrongBookMostRecentAt.slice(0, 10)}。`
                    : ""}
                </p>
              ) : (
                <p style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "8px" }}>
                  暂无错题记录。前往题目详情页标记做错即可开始记录。
                </p>
              )}
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <Link className="primaryLink" href="/user/wrong-book">
                  查看错题本
                </Link>
                <Link className="secondaryLink" href="/problems">
                  前往题目中心
                </Link>
              </div>
            </div>
          ) : (
            <div>
              <p style={{ color: "#92400e", fontSize: "13px", marginBottom: "8px" }}>
                请先登录 dev session 后查看错题本。
              </p>
              <Link className="primaryLink" href="/login">
                Dev Login
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="learningPanel" aria-labelledby="my-imports-title">
        <div className="panelHeader">
          <p className="eyebrow">Books</p>
          <h2 id="my-imports-title">
            My Imported Books
            {importedBookCount > 0 ? " (" + importedBookCount + ")" : ""}
          </h2>
          <p className="panelNote">dev preview - DB persist opt-in - not production</p>
        </div>
        <div style={{ marginTop: "14px" }}>
          {!sessionSummary.hasSession ? (
            <div>
              <p style={{ color: "#92400e", fontSize: "13px" }}>
                Please login with dev session to view imported books.
              </p>
              <Link className="primaryLink" href="/login" style={{ marginTop: "8px", display: "inline-block" }}>
                Dev Login
              </Link>
            </div>
          ) : importedBookCount > 0 ? (
            <div>
              <p style={{ fontSize: "14px", marginBottom: "8px" }}>
                You have <strong>{importedBookCount}</strong> imported books in dev database.
              </p>
              <Link className="primaryLink" href="/books/manage">
                Manage Imported Books
              </Link>
            </div>
          ) : canManageImports ? (
            <div>
              <p style={{ color: "#64748b", fontSize: "13px", marginBottom: "8px" }}>
                You have no imported books in database yet. Import and save to see them here.
              </p>
              <Link className="primaryLink" href="/import">
                Open Text Import
              </Link>
            </div>
          ) : (
            <div>
              <p style={{ color: "#64748b", fontSize: "12px", fontStyle: "italic", marginBottom: "8px" }}>
                DB persist not enabled. Books saved in process memory (lost on restart).
              </p>
              <Link className="primaryLink" href="/import">
                Open Text Import Preview
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* A396: Learning Feedback Hub */}
      <section className="learningPanel" aria-labelledby="learning-feedback-title">
        <div className="panelHeader">
          <p className="eyebrow">A396 Learning Feedback</p>
          <h2 id="learning-feedback-title">学习反馈中心（开发预览）</h2>
          <p className="panelNote">规则型推荐 · 未调用 LLM · 开发预览 · local fallback · 未接生产账号</p>
        </div>
        <div style={{ marginTop: "14px" }}>
          <p style={{ fontSize: "13px", color: "#475569", marginBottom: "12px" }}>
            聚合已有学习数据（阅读、题目、错题、笔记、AI 问答），生成统一学习报告、复习推荐和今日学习计划。
          </p>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <Link className="primaryLink" href="/user/report">
              学习报告
            </Link>
            <Link className="primaryLink" href="/user/review">
              复习推荐
            </Link>
            <Link className="primaryLink" href="/user/today">
              今日计划
            </Link>
          </div>
          <div style={{ marginTop: "14px", padding: "10px", backgroundColor: "#f8fafc", borderRadius: "6px" }}>
            <p style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>
              <strong>数据来源：</strong>
            </p>
            <p style={{ fontSize: "11px", color: "#94a3b8", lineHeight: "1.7" }}>
              学习报告 / 复习推荐 / 今日计划基于浏览器 localStorage 本地存储的学习数据，通过确定性规则生成，不调用 LLM。
              错误标记、练习状态、阅读进度、笔记书签、AI 问答历史等数据聚合生成学习摘要。
              所有推荐不保存到 DB，仅作为当日学习建议。
            </p>
          </div>
        </div>
      </section>

      {/* A397: Learning Center entry */}
      <section className="learningPanel" aria-labelledby="learning-center-title">
        <div className="panelHeader">
          <p className="eyebrow">A397 Learning Center</p>
          <h2 id="learning-center-title">学习中心（开发预览）</h2>
          <p className="panelNote">规则型学习反馈 · 未调用 LLM · local fallback · 未接生产账号</p>
        </div>
        <div style={{ marginTop: "14px" }}>
          <p style={{ fontSize: "13px", color: "#475569", marginBottom: "12px" }}>
            集中查看学习报告、复习推荐、今日计划、学习活动、错题本、最近阅读、最近刷题和 AI 问答历史。
          </p>
          <Link className="primaryLink" href="/learning">
            进入学习中心
          </Link>
        </div>
      </section>

      {/* A399: Daily Challenge entry */}
      <section className="learningPanel" aria-labelledby="daily-challenge-title">
        <div className="panelHeader">
          <p className="eyebrow">A399 Daily Challenge</p>
          <h2 id="daily-challenge-title">每日挑战（开发预览）</h2>
          <p className="panelNote">规则生成 · 未调用 LLM · 未接真实判题 · localStorage fallback</p>
        </div>
        <div style={{ marginTop: "14px" }}>
          <p style={{ fontSize: "13px", color: "#475569", marginBottom: "12px" }}>
            每天一道推荐题，基于错题本、收藏题目、最近练习记录，通过确定性优先级规则自动选择。
            同一天同样数据返回同一道题，不调用 LLM，不使用随机数。
          </p>
          <Link className="primaryLink" href="/daily-challenge">
            进入每日挑战
          </Link>
          <p style={{ fontSize: "11px", color: "#94a3b8", marginTop: "8px" }}>
            挑战状态存储在浏览器 localStorage，不保存到 DB。不执行用户代码，不接真实判题。
          </p>
        </div>
      </section>
    </main>
  );
}

function renderDbReadingProgressSection(
  dbReadingProgress: UserRecentReadingDbLoadResult,
) {
  return (
    <section className="learningPanel" aria-labelledby="db-progress-title">
      <div className="panelHeader">
        <p className="eyebrow">DB Reading Progress</p>
        <h2 id="db-progress-title">开发 DB 阅读进度（dev-only）</h2>
        <p className="panelNote">
          未接生产同步 · 绑定 dev session 用户 · guard 关闭时不查询 DB
        </p>
      </div>
      <div style={{ marginTop: "14px" }}>
        <DbReadingProgressContent dbReadingProgress={dbReadingProgress} />
      </div>
    </section>
  );
}

function DbReadingProgressContent({
  dbReadingProgress,
}: {
  dbReadingProgress: UserRecentReadingDbLoadResult;
}) {
  if (!dbReadingProgress.guardEnabled) {
    return (
      <div className="learningEmptyState" aria-live="polite">
        <strong>DB reading progress not enabled</strong>
        <p>{dbReadingProgress.message}</p>
      </div>
    );
  }

  if (dbReadingProgress.items.length === 0) {
    return (
      <div className="learningEmptyState" aria-live="polite">
        <strong>无 DB 阅读进度</strong>
        <p>{dbReadingProgress.message}</p>
        <Link className="primaryLink" href="/reader" style={{ marginTop: "8px", display: "inline-block" }}>
          前往 Reader 保存阅读进度
        </Link>
      </div>
    );
  }

  return (
    <div className="chunkList">
      {dbReadingProgress.items.map(function (item, index) {
        return (
          <article className="chunkItem" key={item.bookId + "-" + item.chapterId + "-" + index}>
            <div className="panelHeaderRow">
              <div>
                <p className="eyebrow">
                  {item.progressPercent + "% · " + item.ownerLabel}
                </p>
                <h3>{item.bookTitle}</h3>
                <p className="panelNote">{item.chapterTitle}</p>
              </div>
              <Link
                className="primaryLink"
                href={"/reader?bookId=" + encodeURIComponent(item.bookId) + "&chapterId=" + encodeURIComponent(item.chapterId)}
              >
                Continue Reading (DB)
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}
