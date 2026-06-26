/**
 * Problem Wrong Book DB Loader — loads dev-only DB wrong book records
 * for /user/wrong-book and /user dashboard pages.
 *
 * When the guard passes, queries the ProblemWrongBook repository.
 * Falls back to empty when guard is blocked or DB is unavailable.
 *
 * @module problem-wrong-book-db-loader
 * @previewOnly — dev-only; never production user system
 */

import {
  getPrismaClient,
  PrismaProblemWrongBookRepository,
} from "@learning-agent-platform/db";

import { deserializeDevSession } from "../../lib/web-auth-dev-session";
import { evaluateProblemWrongBookDbGuard } from "./problem-wrong-book-db-guard";
import type { WrongBookReviewStatus } from "../../lib/local-problem-wrong-book-store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DbWrongBookView {
  wrongBookId: string;
  problemId: string;
  problemTitle: string;
  difficulty: string;
  tags: string[];
  wrongCount: number;
  lastWrongAt: string;
  reviewStatus: WrongBookReviewStatus;
  notePreview: string | null;
  createdAt: string;
  updatedAt: string;
  source: "db-wrong-book";
  ownerLabel: string | null;
  notice: string;
}

export interface DbWrongBookLoadResult {
  guardEnabled: boolean;
  useDbWrongBook: boolean;
  items: DbWrongBookView[];
  needsReviewCount: number;
  totalCount: number;
  message: string;
  ownerLabel: string | null;
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Load DB wrong book records for the current dev session.
 * Queries the ProblemWrongBook repository when guard passes.
 * Falls back to empty results when guard is blocked.
 */
export async function loadDbProblemWrongBook(
  cookieValue: string | undefined,
): Promise<DbWrongBookLoadResult> {
  const guard = evaluateProblemWrongBookDbGuard(cookieValue);

  if (!guard.enabled) {
    return createEmptyDbWrongBookLoadResult(
      false,
      guard.blockedReasons.length > 0
        ? `错题本 DB 持久化未启用：${guard.blockedReasons[0]}`
        : "错题本 DB 持久化默认关闭。使用本地错题本 fallback。",
    );
  }

  if (guard.sessionPayload === null) {
    return createEmptyDbWrongBookLoadResult(
      true,
      "DB 错题本已启用但当前无开发会话。使用本地错题本 fallback。",
    );
  }

  const ownerId = guard.sessionPayload.userIdPreview;
  const ownerLabel = guard.sessionPayload.displayName;

  try {
    const prisma = getPrismaClient();
    const repository = new PrismaProblemWrongBookRepository(prisma);

    const records = await repository.listProblemWrongBookByOwner({
      ownerId,
      limit: 200,
    });

    const items: DbWrongBookView[] = records.map((r) => ({
      wrongBookId: r.id,
      problemId: r.problemId,
      problemTitle: r.problemTitle,
      difficulty: r.difficulty,
      tags: safeParseTagsJson(r.tagsJson),
      wrongCount: r.wrongCount,
      lastWrongAt: r.lastWrongAt.toISOString(),
      reviewStatus: (VALID_REVIEW_STATUSES.has(r.reviewStatus)
        ? r.reviewStatus
        : "needs-review") as WrongBookReviewStatus,
      notePreview: r.notePreview,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      source: "db-wrong-book",
      ownerLabel,
      notice: "开发 DB 错题记录 · 绑定 dev session · 未接生产同步",
    }));

    const needsReviewCount = items.filter(
      (i) => i.reviewStatus === "needs-review",
    ).length;

    return {
      guardEnabled: true,
      useDbWrongBook: true,
      items,
      needsReviewCount,
      totalCount: items.length,
      message: `加载了 ${items.length} 条 DB 错题记录（dev-only）。`,
      ownerLabel,
    };
  } catch (error: unknown) {
    const brief =
      error instanceof Error ? error.constructor.name : "db-load-error";
    return createEmptyDbWrongBookLoadResult(
      true,
      `DB 错题记录查询失败（${brief}）。使用本地错题本 fallback。`,
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_REVIEW_STATUSES: ReadonlySet<string> = new Set([
  "needs-review",
  "reviewed",
  "mastered",
]);

function createEmptyDbWrongBookLoadResult(
  guardEnabled: boolean,
  message: string,
): DbWrongBookLoadResult {
  return {
    guardEnabled,
    useDbWrongBook: false,
    items: [],
    needsReviewCount: 0,
    totalCount: 0,
    message,
    ownerLabel: null,
  };
}

function safeParseTagsJson(tagsJson: string): string[] {
  try {
    const parsed = JSON.parse(tagsJson);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((t) => (typeof t === "string" ? t.trim() : ""))
      .filter((t) => t.length > 0)
      .slice(0, 50);
  } catch {
    return [];
  }
}

export function getWrongBookDbGuardEnabled(
  cookieValue: string | undefined,
): boolean {
  return evaluateProblemWrongBookDbGuard(cookieValue).enabled;
}

export function getWrongBookDevSessionOwnerId(
  cookieValue: string | undefined,
): string | null {
  const session = deserializeDevSession(cookieValue);
  if (session === null) return null;
  return session.userIdPreview;
}
