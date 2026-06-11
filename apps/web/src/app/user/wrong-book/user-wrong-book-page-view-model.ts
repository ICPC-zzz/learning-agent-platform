/**
 * User Wrong Book Page View Model — computes wrong book data for
 * /user/wrong-book page display.
 *
 * Aggregates DB data (when guard passes) + localStorage fallback.
 *
 * @module user-wrong-book-page-view-model
 * @previewOnly — dev-only; not production user system
 */

import type { DbWrongBookView } from "../problem-wrong-book-db-loader";
import type { WrongBookEntry } from "../../../lib/local-problem-wrong-book-store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WrongBookPageItem {
  id: string;
  problemId: string;
  problemTitle: string;
  difficulty: string;
  tags: string[];
  wrongCount: number;
  lastWrongAt: string;
  reviewStatus: string;
  notePreview: string | null;
  source: "db" | "local";
  notice: string;
}

export interface WrongBookPageView {
  items: WrongBookPageItem[];
  totalCount: number;
  needsReviewCount: number;
  mostRecentWrongAt: string | null;
  dataSource: "db" | "local" | "mixed" | "none";
  dataSourceNotice: string;
  guardEnabled: boolean;
  hasSession: boolean;
  message: string;
}

export interface WrongBookPageInput {
  /** Whether the DB guard is enabled. */
  dbGuardEnabled: boolean;
  /** DB wrong book items from the loader. */
  dbItems: DbWrongBookView[] | null;
  /** Whether DB is the active data source. */
  dbActive: boolean;
  /** LocalStorage wrong book entries. */
  localEntries: WrongBookEntry[];
  /** Whether a dev session exists. */
  hasSession: boolean;
}

// ---------------------------------------------------------------------------
// Forbidden labels
// ---------------------------------------------------------------------------

const FORBIDDEN_LABELS = [
  "生产可用",
  "真实判题",
  "真实错误记录",
  "云端同步",
  "已同步到判题系统",
] as const;

const DATA_SOURCE_NOTICES = {
  db: "开发 DB 错题记录（dev-only）· 绑定 dev session · 未接生产同步 · 未接真实判题",
  local: "数据来自 localStorage 本地存储 · 未连接数据库 · 未接真实判题 · 不执行代码",
  mixed: "部分数据来自开发 DB · 部分本地 fallback · 未接生产同步",
  none: "暂无错题记录 · 在题目详情页标记做错即可记录",
} as const;

// ---------------------------------------------------------------------------
// View model builder
// ---------------------------------------------------------------------------

export function buildWrongBookPageView(
  input: WrongBookPageInput,
): WrongBookPageView {
  const { dbGuardEnabled, dbItems, dbActive, localEntries, hasSession } = input;

  const useDb = dbActive && dbItems !== null && dbItems.length > 0;
  const useLocal = localEntries.length > 0;

  let items: WrongBookPageItem[];
  let dataSource: "db" | "local" | "mixed" | "none";

  if (useDb && useLocal) {
    // DB preferred — deduplicate by problemId
    const dbProblemIds = new Set(dbItems!.map((i) => i.problemId));
    const dbMapped: WrongBookPageItem[] = dbItems!.map((i) => ({
      id: i.wrongBookId,
      problemId: i.problemId,
      problemTitle: i.problemTitle,
      difficulty: i.difficulty,
      tags: i.tags,
      wrongCount: i.wrongCount,
      lastWrongAt: i.lastWrongAt,
      reviewStatus: i.reviewStatus,
      notePreview: i.notePreview,
      source: "db",
      notice: i.notice,
    }));
    const localOnly = localEntries
      .filter((l) => !dbProblemIds.has(l.problemId))
      .map((l) => ({
        id: l.wrongBookId,
        problemId: l.problemId,
        problemTitle: l.title,
        difficulty: l.difficulty,
        tags: l.tags,
        wrongCount: l.wrongCount,
        lastWrongAt: l.lastWrongAt,
        reviewStatus: l.reviewStatus,
        notePreview: l.notePreview,
        source: "local" as const,
        notice: "本地 fallback 错题记录 · 未连接数据库",
      }));
    items = [...dbMapped, ...localOnly];
    dataSource = "mixed";
  } else if (useDb) {
    items = dbItems!.map((i) => ({
      id: i.wrongBookId,
      problemId: i.problemId,
      problemTitle: i.problemTitle,
      difficulty: i.difficulty,
      tags: i.tags,
      wrongCount: i.wrongCount,
      lastWrongAt: i.lastWrongAt,
      reviewStatus: i.reviewStatus,
      notePreview: i.notePreview,
      source: "db" as const,
      notice: i.notice,
    }));
    dataSource = "db";
  } else if (useLocal) {
    items = localEntries.map((l) => ({
      id: l.wrongBookId,
      problemId: l.problemId,
      problemTitle: l.title,
      difficulty: l.difficulty,
      tags: l.tags,
      wrongCount: l.wrongCount,
      lastWrongAt: l.lastWrongAt,
      reviewStatus: l.reviewStatus,
      notePreview: l.notePreview,
      source: "local" as const,
      notice: "本地 fallback 错题记录 · 未连接数据库",
    }));
    dataSource = "local";
  } else {
    items = [];
    dataSource = "none";
  }

  const needsReviewCount = items.filter(
    (i) => i.reviewStatus === "needs-review",
  ).length;

  let mostRecentWrongAt: string | null = null;
  for (const item of items) {
    if (mostRecentWrongAt === null || item.lastWrongAt > mostRecentWrongAt) {
      mostRecentWrongAt = item.lastWrongAt;
    }
  }

  const totalCount = items.length;

  // Build message
  let message: string;
  if (dataSource === "none") {
    message = hasSession
      ? "暂无错题记录。在题目详情页标记做错即可记录。不执行代码，不接真实判题。"
      : "请先登录 dev session 后查看错题本。";
  } else {
    message = `共 ${totalCount} 条错题记录，${needsReviewCount} 待复习。${dataSource === "db" ? "（开发 DB）" : dataSource === "local" ? "（本地存储）" : "（DB + 本地混合）"}`;
  }

  return {
    items,
    totalCount,
    needsReviewCount,
    mostRecentWrongAt,
    dataSource,
    dataSourceNotice: DATA_SOURCE_NOTICES[dataSource],
    guardEnabled: dbGuardEnabled,
    hasSession,
    message,
  };
}

// ---------------------------------------------------------------------------
// Safety
// ---------------------------------------------------------------------------

export function wrongBookPageViewIsSafe(
  view: WrongBookPageView,
): { safe: boolean; violations: string[] } {
  const violations: string[] = [];
  const json = JSON.stringify(view);

  for (const label of FORBIDDEN_LABELS) {
    if (json.includes(label)) {
      violations.push(`Forbidden label: ${label}`);
    }
  }

  return { safe: violations.length === 0, violations };
}
