/**
 * Problem Practice DB Loader — loads dev-only DB practice records
 * for /user and /user/recent-practice pages.
 *
 * When the guard passes, queries the ProblemPractice repository.
 * Falls back to empty when guard is blocked or DB is unavailable.
 *
 * @module problem-practice-db-loader
 * @previewOnly — dev-only; never production user system
 */

import {
  getPrismaClient,
  PrismaProblemPracticeRepository,
} from "@learning-agent-platform/db";

import { deserializeDevSession } from "../../lib/web-auth-dev-session";
import { evaluateProblemPracticeDbGuard } from "./problem-practice-db-guard";
import type { PracticeStatusType } from "./problem-practice-db-actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DbProblemPracticeView {
  problemId: string;
  problemTitle: string;
  difficulty: string;
  status: PracticeStatusType;
  updatedAt: string;
  source: "db-practice";
  ownerLabel: string | null;
  notice: string;
}

export interface DbProblemPracticeLoadResult {
  guardEnabled: boolean;
  useDbPractice: boolean;
  items: DbProblemPracticeView[];
  message: string;
  ownerLabel: string | null;
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Load DB practice records for the current dev session.
 * Queries the ProblemPractice repository when guard passes.
 * Falls back to empty results when guard is blocked.
 */
export async function loadDbProblemPractice(
  cookieValue: string | undefined,
): Promise<DbProblemPracticeLoadResult> {
  const guard = evaluateProblemPracticeDbGuard(cookieValue);

  if (!guard.enabled) {
    return createEmptyDbProblemPracticeLoadResult(
      false,
      guard.blockedReasons.length > 0
        ? `题目练习记录 DB 持久化未启用：${guard.blockedReasons[0]}`
        : "题目练习记录 DB 持久化默认关闭。使用本地练习记录 fallback。",
    );
  }

  if (guard.sessionPayload === null) {
    return createEmptyDbProblemPracticeLoadResult(
      true,
      "DB 题目练习记录已启用但当前无开发会话。使用本地练习记录 fallback。",
    );
  }

  const ownerId = guard.sessionPayload.userIdPreview;
  const ownerLabel = guard.sessionPayload.displayName;

  try {
    const prisma = getPrismaClient();
    const repository = new PrismaProblemPracticeRepository(prisma);

    const records = await repository.listPracticeByOwner({
      userId: ownerId,
      limit: 200,
    });

    const items: DbProblemPracticeView[] = records.map((r) => ({
      problemId: r.problemId,
      problemTitle: r.problemTitle,
      difficulty: r.difficulty,
      status: r.status as PracticeStatusType,
      updatedAt: r.updatedAt.toISOString(),
      source: "db-practice",
      ownerLabel,
      notice: "开发 DB 练习记录 · 绑定 dev session · 未接生产同步",
    }));

    return {
      guardEnabled: true,
      useDbPractice: true,
      items,
      message: `加载了 ${items.length} 条 DB 练习记录（dev-only）。`,
      ownerLabel,
    };
  } catch (error: unknown) {
    const brief =
      error instanceof Error ? error.constructor.name : "db-load-error";
    return createEmptyDbProblemPracticeLoadResult(
      true,
      `DB 练习记录查询失败（${brief}）。使用本地练习记录 fallback。`,
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createEmptyDbProblemPracticeLoadResult(
  guardEnabled: boolean,
  message: string,
): DbProblemPracticeLoadResult {
  return {
    guardEnabled,
    useDbPractice: false,
    items: [],
    message,
    ownerLabel: null,
  };
}

export function getProblemPracticeDbGuardEnabled(
  cookieValue: string | undefined,
): boolean {
  return evaluateProblemPracticeDbGuard(cookieValue).enabled;
}

export function getProblemPracticeDevSessionOwnerId(
  cookieValue: string | undefined,
): string | null {
  const session = deserializeDevSession(cookieValue);
  if (session === null) return null;
  return session.userIdPreview;
}
