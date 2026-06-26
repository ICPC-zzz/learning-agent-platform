/**
 * Web AI User Data DB Loader — aggregates safe user learning data summaries
 * from DB. Read-only, returns only sanitized counts and short summaries.
 *
 * @module web-ai-user-data-db-loader
 * @previewOnly
 */

import type { WebAiUserDataSummary } from "./web-ai-context-builder";
import { buildUserDataSummary } from "./web-ai-context-builder";
import type { WebAiUserDataSummaryInput, WebAiUserDataSummaryResult } from "./web-ai-user-data-summary";

/**
 * Aggregate safe user data summary from available DB queries.
 * Falls back gracefully when any loader fails.
 */
export async function getSafeUserDataSummary(
  input?: WebAiUserDataSummaryInput,
): Promise<WebAiUserDataSummaryResult> {
  let importedBookCount = input?.localStorageImportedBookCount ?? 0;
  let importedProblemCount = input?.localStorageImportedProblemCount ?? 0;
  let recentReadingSummary = "";
  let learningStatsSummary = "";
  let favoritesSummary = "";

  // Try to load imported books count from DB
  try {
    const { hasDatabaseUrl: _hd, getPrismaClient: _gp, PrismaBookRepository: _pbr } = await import("@learning-agent-platform/db");
    if (_hd()) {
      const client = _gp();
      const repo = new _pbr(client);
      const books = await repo.listBooks({ limit: 100 });
      importedBookCount = Math.max(importedBookCount, books.length);
      if (books.length > 0 && !input?.localStorageImportedBookCount) {
        recentReadingSummary = "DB 中有 " + books.length + " 本已导入书籍";
      }
    }
  } catch {
    // DB unavailable, keep localStorage counts
  }

  // Try to load imported problems count from DB
  try {
    const { hasDatabaseUrl: _hd, getPrismaClient: _gp, PrismaLearningRepository: _plr } = await import("@learning-agent-platform/db");
    if (_hd()) {
      const client = _gp();
      const repo = new _plr(client);
      const problems = await repo.listProblems({ limit: 100 });
      importedProblemCount = Math.max(importedProblemCount, problems.length);
      if (problems.length > 0 && !input?.localStorageImportedProblemCount) {
        learningStatsSummary = "DB 中有 " + problems.length + " 道已导入题目";
      }
    }
  } catch {
    // DB unavailable
  }

  const summary = buildUserDataSummary({
    dbAvailable: true,
    importedBookCount,
    importedProblemCount,
    recentReadingSummary,
    learningStatsSummary,
    favoritesSummary,
  });

  return { summary, source: "db", dbAvailable: true };
}
