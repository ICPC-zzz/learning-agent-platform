"use server";

/**
 * Delete Problem Server Actions for /problems Page
 *
 * Server-side actions that:
 * 1. Check dev guard + DB persist guard
 * 2. Protect built-in/sample problems from deletion
 * 3. Return a protected unavailable result because the current repository is read-only.
 *
 * Guards:
 * - Dev import guard (LAP_ALLOW_DEV_PROBLEM_IMPORT)
 * - Production blocked (NODE_ENV !== "production")
 * - DB persist guard (LAP_IMPORT_DB_PERSIST_DEV_ENABLED + LAP_ALLOW_REAL_DB_INTEGRATION + DATABASE_URL)
 *
 * @module delete-problem-actions
 * @previewOnly — dev-only delete, not for production
 */

import { evaluateImportDbPersistGuard } from "../import/text-import-db-persist-guard";
import {
  hasDatabaseUrl,
} from "@learning-agent-platform/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DeleteProblemInput {
  /** Problem ID to delete */
  problemId: string;
}

export interface DeleteProblemResult {
  success: boolean;
  problemId: string;
  title: string | null;
  message: string;
  /** Whether the problem was protected (built-in/sample) */
  protected: boolean;
  dbDeleted: boolean;
}

// ---------------------------------------------------------------------------
// Built-in / sample problem IDs (protected from deletion)
// ---------------------------------------------------------------------------

const PROTECTED_PROBLEM_IDS = new Set([
  "lap-builtin-001",
  "lap-builtin-002",
  "lap-builtin-003",
  "lap-builtin-004",
  "lap-builtin-005",
  "lap-builtin-006",
  "lap-builtin-007",
  "lap-builtin-008",
  "lap-builtin-009",
  "lap-builtin-010",
]);

function isProtectedProblem(problemId: string): boolean {
  // Protect built-in sample problems
  if (PROTECTED_PROBLEM_IDS.has(problemId)) return true;
  // Protect any lap-builtin- pattern
  if (problemId.startsWith("lap-builtin-")) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

/**
 * Delete a problem from the local problem library.
 *
 * Usage from /problems ProblemLibraryClient:
 *   deleteProblemAction({ problemId })
 *
 * Guard chain:
 * 1. Input validation
 * 2. Protect built-in problems
 * 3. Dev import guard
 * 4. Production blocked
 * 5. DB persist guard
 * 6. Repository.deleteProblem() (transaction)
 */
export async function deleteProblemAction(
  input: DeleteProblemInput | null,
): Promise<DeleteProblemResult> {
  // Guard 1: Input validation
  if (!input || !input.problemId) {
    return {
      success: false,
      problemId: input?.problemId ?? "",
      title: null,
      message: "缺少题目 ID。",
      protected: false,
      dbDeleted: false,
    };
  }

  const problemId = input.problemId.trim();
  if (problemId.length === 0) {
    return {
      success: false,
      problemId: "",
      title: null,
      message: "题目 ID 不能为空。",
      protected: false,
      dbDeleted: false,
    };
  }

  // Guard 2: Protect built-in problems
  if (isProtectedProblem(problemId)) {
    return {
      success: false,
      problemId,
      title: null,
      message: "内置示例题目受保护，不可删除。",
      protected: true,
      dbDeleted: false,
    };
  }

  // Guard 3: Dev import guard
  try {
    const nodeEnv = process.env.NODE_ENV;
    if (nodeEnv === "production") {
      return {
        success: false,
        problemId,
        title: null,
        message: "题目删除在 production 环境中不可用。",
        protected: false,
        dbDeleted: false,
      };
    }

    const devImportEnabled = process.env.LAP_ALLOW_DEV_PROBLEM_IMPORT === "true";
    if (!devImportEnabled) {
      return {
        success: false,
        problemId,
        title: null,
        message: "题目删除未启用。设置 LAP_ALLOW_DEV_PROBLEM_IMPORT=true。",
        protected: false,
        dbDeleted: false,
      };
    }
  } catch {
    return {
      success: false,
      problemId,
      title: null,
      message: "无法检查环境配置。",
      protected: false,
      dbDeleted: false,
    };
  }

  // Guard 4: DB persist guard
  const dbGuard = evaluateImportDbPersistGuard();
  if (!dbGuard.enabled) {
    return {
      success: false,
      problemId,
      title: null,
      message: "DB 持久化未启用。设置 LAP_IMPORT_DB_PERSIST_DEV_ENABLED=true 和 LAP_ALLOW_REAL_DB_INTEGRATION=true。",
      protected: false,
      dbDeleted: false,
    };
  }

  // Guard 5: DATABASE_URL must be available
  try {
    if (!hasDatabaseUrl()) {
      return {
        success: false,
        problemId,
        title: null,
        message: "数据库未配置。",
        protected: false,
        dbDeleted: false,
      };
    }
  } catch {
    return {
      success: false,
      problemId,
      title: null,
      message: "无法检查数据库配置。",
      protected: false,
      dbDeleted: false,
    };
  }

  return {
    success: false,
    problemId,
    title: null,
    message: "当前题目仓库不提供删除接口；本轮仅保留只读 Codeforces 题目池。",
    protected: true,
    dbDeleted: false,
  };
}
