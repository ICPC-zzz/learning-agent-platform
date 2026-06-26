/**
 * User Dashboard Stats View Model — computes user learning data statistics
 * for the /user page summary cards.
 *
 * Aggregates DB data + localStorage fallback for favorites count,
 * recent reading count, imported books count, and problem system placeholders.
 *
 * @module user-dashboard-stats-view-model
 * @previewOnly — dev-only; not production user system
 */

import type { DbFavoriteBookView } from "./favorites-db-view-model";
import type { DbReadingProgressSummary } from "./user-recent-reading-db-loader";
import type { DbProblemFavoriteView } from "./problem-favorites-db-loader";
import type { DbProblemPracticeView } from "./problem-practice-db-loader";
import type { DbReaderBookmarkView } from "./reader-bookmarks-db-loader";
import type { DbReaderNoteView } from "./reader-notes-db-loader";
import type { FavoriteBookEntry, RecentReadingEntry } from "../../lib/local-user-library-store";
import type { FavoriteProblemEntry, RecentPracticeEntry } from "../../lib/local-user-problem-store";
import type { ReaderLocalBookmark, ReaderLocalNote } from "../../lib/local-reader-annotation-store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardStatsView {
  /** Number of favorite books. */
  favoriteBooksCount: number;
  /** Source of favorite books count. */
  favoriteBooksSource: "db" | "local" | "none";
  /** Number of recent reading entries. */
  recentReadingCount: number;
  /** Source of recent reading count. */
  recentReadingSource: "db" | "local" | "none";
  /** Number of imported books. */
  importedBooksCount: number;
  /** Whether import management is available. */
  canManageImports: boolean;
  /** A387: Recent problems/practice count. */
  recentProblemsCount: number;
  /** A387: Source of recent problems count. */
  recentProblemsSource: "db" | "local" | "none";
  /** A387: Favorite problems count. */
  favoriteProblemsCount: number;
  /** A387: Source of favorite problems count. */
  favoriteProblemsSource: "db" | "local" | "none";
  /** A390: Reader bookmarks count. */
  readerBookmarksCount: number;
  /** A390: Source of reader bookmarks count. */
  readerBookmarksSource: "db" | "local" | "none";
  /** A390: Reader notes count. */
  readerNotesCount: number;
  /** A390: Source of reader notes count. */
  readerNotesSource: "db" | "local" | "none";
  /** A395: Wrong book total count. */
  wrongBookTotalCount: number;
  /** A395: Wrong book needs-review count. */
  wrongBookNeedsReviewCount: number;
  /** A395: Wrong book most recent wrong at. */
  wrongBookMostRecentAt: string | null;
  /** A395: Source of wrong book data. */
  wrongBookSource: "db" | "local" | "none";
  /** Whether the problem system is connected. */
  problemSystemConnected: false;
  /** Problem system status message. */
  problemSystemMessage: string;
  /** Overall data source notice. */
  dataSourceNotice: string;
  /** Whether a dev session exists. */
  hasSession: boolean;
  /** Whether any DB data source is active. */
  anyDbActive: boolean;
}

export interface DashboardStatsInput {
  /** Whether a dev session exists. */
  hasSession: boolean;
  /** DB favorites from loader. */
  dbFavorites: DbFavoriteBookView[] | null;
  /** Whether DB favorites guard is enabled. */
  dbFavoritesEnabled: boolean;
  /** LocalStorage favorites. */
  localFavorites: FavoriteBookEntry[];
  /** DB reading progress items. */
  dbProgressItems: DbReadingProgressSummary[] | null;
  /** Whether DB progress guard is enabled. */
  dbProgressEnabled: boolean;
  /** LocalStorage recent reading entries. */
  localRecentReadings: RecentReadingEntry[];
  /** A387: DB problem favorites. */
  dbProblemFavorites: DbProblemFavoriteView[] | null;
  /** A387: Whether DB problem favorites guard is enabled. */
  dbProblemFavoritesEnabled: boolean;
  /** A387: LocalStorage problem favorites. */
  localProblemFavorites: FavoriteProblemEntry[];
  /** A387: DB practice records. */
  dbPracticeItems: DbProblemPracticeView[] | null;
  /** A387: Whether DB practice guard is enabled. */
  dbPracticeEnabled: boolean;
  /** A387: LocalStorage practice entries. */
  localPracticeEntries: RecentPracticeEntry[];
  /** A390: DB reader bookmarks. */
  dbReaderBookmarks: DbReaderBookmarkView[] | null;
  /** A390: Whether DB reader bookmarks guard is enabled. */
  dbReaderBookmarksEnabled: boolean;
  /** A390: LocalStorage reader bookmarks. */
  localReaderBookmarks: ReaderLocalBookmark[];
  /** A390: DB reader notes. */
  dbReaderNotes: DbReaderNoteView[] | null;
  /** A390: Whether DB reader notes guard is enabled. */
  dbReaderNotesEnabled: boolean;
  /** A390: LocalStorage reader notes. */
  localReaderNotes: ReaderLocalNote[];
  /** A395: DB wrong book items. */
  dbWrongBookItems: unknown[] | null;
  /** A395: Whether DB wrong book guard is enabled. */
  dbWrongBookEnabled: boolean;
  /** A395: LocalStorage wrong book entries. */
  localWrongBookEntries: unknown[];
  /** A395: DB wrong book needs-review count. */
  dbWrongBookNeedsReviewCount: number;
  /** A395: DB wrong book total count. */
  dbWrongBookTotalCount: number;
  /** A395: DB wrong book most recent wrong at. */
  dbWrongBookMostRecentAt: string | null;
  /** Imported books count from DB loader. */
  importedBooksCount: number;
  /** Whether import management is available. */
  canManageImports: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROBLEM_SYSTEM_MESSAGE = "题目系统未接入";
const DATA_SOURCE_NOTICES = {
  allDb: "开发 DB 数据（dev-only）· 绑定 dev session · 未接生产账号",
  mixedDb: "部分数据来自开发 DB · 部分本地 fallback · 未接生产账号",
  allLocal: "数据来自 localStorage 本地存储 · 未连接数据库 · 未接生产账号",
} as const;

const FORBIDDEN_LABELS = [
  "生产可用",
  "真实数据",
  "云端同步",
  "账号同步完成",
  "真实用户系统已完成",
] as const;

// ---------------------------------------------------------------------------
// View model builder
// ---------------------------------------------------------------------------

/**
 * Build the dashboard stats view model.
 *
 * Prioritizes DB data when available, falls back to localStorage,
 * and always indicates problem system placeholder status.
 */
export function buildDashboardStatsView(
  input: DashboardStatsInput,
): DashboardStatsView {
  const {
    hasSession,
    dbFavorites,
    dbFavoritesEnabled,
    localFavorites,
    dbProgressItems,
    dbProgressEnabled,
    localRecentReadings,
    dbProblemFavorites,
    dbProblemFavoritesEnabled,
    localProblemFavorites,
    dbPracticeItems,
    dbPracticeEnabled,
    localPracticeEntries,
    dbReaderBookmarks,
    dbReaderBookmarksEnabled,
    localReaderBookmarks,
    dbReaderNotes,
    dbReaderNotesEnabled,
    localReaderNotes,
    dbWrongBookItems,
    dbWrongBookEnabled,
    localWrongBookEntries,
    dbWrongBookNeedsReviewCount,
    dbWrongBookTotalCount,
    dbWrongBookMostRecentAt,
    importedBooksCount,
    canManageImports,
  } = input;

  // Favorite books count
  const useDbFavorites = dbFavoritesEnabled && dbFavorites !== null && dbFavorites.length > 0;
  const favoriteBooksCount = useDbFavorites
    ? dbFavorites!.length
    : localFavorites.length;
  const favoriteBooksSource = useDbFavorites
    ? "db"
    : localFavorites.length > 0
      ? "local"
      : "none";

  // Recent reading count
  const useDbProgress = dbProgressEnabled && dbProgressItems !== null && dbProgressItems.length > 0;
  const recentReadingCount = useDbProgress
    ? dbProgressItems!.length
    : localRecentReadings.length;
  const recentReadingSource = useDbProgress
    ? "db"
    : localRecentReadings.length > 0
      ? "local"
      : "none";

  // A387: Favorite problems count
  const useDbProblemFavs = dbProblemFavoritesEnabled && dbProblemFavorites !== null && dbProblemFavorites.length > 0;
  const favoriteProblemsCount = useDbProblemFavs
    ? dbProblemFavorites!.length
    : localProblemFavorites.length;
  const favoriteProblemsSource = useDbProblemFavs
    ? "db"
    : localProblemFavorites.length > 0
      ? "local"
      : "none";

  // A387: Recent problems/practice count
  const useDbPractice = dbPracticeEnabled && dbPracticeItems !== null && dbPracticeItems.length > 0;
  const recentProblemsCount = useDbPractice
    ? dbPracticeItems!.length
    : localPracticeEntries.length;
  const recentProblemsSource = useDbPractice
    ? "db"
    : localPracticeEntries.length > 0
      ? "local"
      : "none";

  // A387: Problem system message — reflects actual state
  const problemSystemHasData = favoriteProblemsCount > 0 || recentProblemsCount > 0;
  const problemSystemMessage = problemSystemHasData
    ? "题目系统 v1 · 内置示例题 · 未接真实判题"
    : "题目系统未接入";

  // A390: Reader bookmarks count
  const useDbBookmarks = dbReaderBookmarksEnabled && dbReaderBookmarks !== null && dbReaderBookmarks.length > 0;
  const readerBookmarksCount = useDbBookmarks
    ? dbReaderBookmarks!.length
    : localReaderBookmarks.length;
  const readerBookmarksSource = useDbBookmarks
    ? "db"
    : localReaderBookmarks.length > 0
      ? "local"
      : "none";

  // A390: Reader notes count
  const useDbNotes = dbReaderNotesEnabled && dbReaderNotes !== null && dbReaderNotes.length > 0;
  const readerNotesCount = useDbNotes
    ? dbReaderNotes!.length
    : localReaderNotes.length;
  const readerNotesSource = useDbNotes
    ? "db"
    : localReaderNotes.length > 0
      ? "local"
      : "none";

  // A395: Wrong book stats
  const useDbWrongBook = dbWrongBookEnabled && dbWrongBookItems !== null && (dbWrongBookItems as unknown[]).length > 0;
  const wrongBookTotalCount = useDbWrongBook
    ? dbWrongBookTotalCount
    : Array.isArray(localWrongBookEntries) ? localWrongBookEntries.length : 0;
  const wrongBookNeedsReviewCount = useDbWrongBook
    ? dbWrongBookNeedsReviewCount
    : 0;
  const wrongBookMostRecentAt = useDbWrongBook
    ? dbWrongBookMostRecentAt
    : null;
  const wrongBookSource = useDbWrongBook
    ? "db"
    : (Array.isArray(localWrongBookEntries) && localWrongBookEntries.length > 0)
      ? "local"
      : "none";

  // Determine overall data source notice
  const anyDbActive = useDbFavorites || useDbProgress || useDbProblemFavs || useDbPractice || useDbBookmarks || useDbNotes || (canManageImports && importedBooksCount > 0);
  const allDb = (useDbFavorites || favoriteBooksCount === 0) &&
    (useDbProgress || recentReadingCount === 0) &&
    (useDbProblemFavs || favoriteProblemsCount === 0) &&
    (useDbPractice || recentProblemsCount === 0);
  const allLocal = !useDbFavorites && !useDbProgress && !useDbProblemFavs && !useDbPractice && !canManageImports;

  let dataSourceNotice: string;
  if (allDb && anyDbActive) {
    dataSourceNotice = DATA_SOURCE_NOTICES.allDb;
  } else if (allLocal) {
    dataSourceNotice = DATA_SOURCE_NOTICES.allLocal;
  } else {
    dataSourceNotice = DATA_SOURCE_NOTICES.mixedDb;
  }

  return {
    favoriteBooksCount,
    favoriteBooksSource,
    recentReadingCount,
    recentReadingSource,
    importedBooksCount,
    canManageImports,
    recentProblemsCount,
    favoriteProblemsCount,
    problemSystemConnected: false,
    problemSystemMessage,
    dataSourceNotice,
    hasSession,
    anyDbActive,
    recentProblemsSource: recentProblemsSource || "none",
    favoriteProblemsSource: favoriteProblemsSource || "none",
    // A390
    readerBookmarksCount,
    readerBookmarksSource,
    readerNotesCount,
    readerNotesSource,
    // A395
    wrongBookTotalCount,
    wrongBookNeedsReviewCount,
    wrongBookMostRecentAt,
    wrongBookSource,
  };
}

// ---------------------------------------------------------------------------
// Safety
// ---------------------------------------------------------------------------

const SENSITIVE_PATTERNS: RegExp[] = [
  /\btoken\b/i,
  /\bsecret\b/i,
  /\bpassword\b/i,
  /\bapi[_\s-]*key\b/i,
  /\bDATABASE_URL\b/i,
  /\bcookie\b/i,
  /\bauthorization\b/i,
  /\bcertificate\b/i,
  /\brawText\b/i,
];

/**
 * Verify that a dashboard stats view contains no sensitive fields
 * or misleading production labels.
 */
export function dashboardStatsViewIsSafe(
  view: DashboardStatsView,
): { safe: boolean; violations: string[] } {
  const violations: string[] = [];
  const json = JSON.stringify(view);

  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(json)) {
      violations.push(`Sensitive field matched: ${pattern.source}`);
    }
  }

  for (const label of FORBIDDEN_LABELS) {
    if (json.includes(label)) {
      violations.push(`Forbidden label found: ${label}`);
    }
  }

  return { safe: violations.length === 0, violations };
}

/**
 * Check that problem system data is not fabricated.
 * Checks that the message correctly indicates the system state.
 */
export function problemSystemIsPlaceholder(view: DashboardStatsView): boolean {
  return (
    view.problemSystemConnected === false &&
    (view.problemSystemMessage.includes("未接入") || view.problemSystemMessage.includes("v1"))
  );
}
