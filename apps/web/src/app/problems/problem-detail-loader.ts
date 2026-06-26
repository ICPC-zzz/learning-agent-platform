/**
 * Problem detail loader — resolves a problemId to a problem record.
 * Currently only supports built-in sample problems.
 *
 * @module problem-detail-loader
 * @previewOnly — built-in samples; not connected to a real OJ
 */

import {
  SAMPLE_PROBLEMS,
} from "./sample-programming-problems.js";

// Re-export the type for TypeScript consumers (Next.js/tsc)
// but keep value-only imports for Node's runtime TS stripping
type SampleProgrammingProblem = typeof SAMPLE_PROBLEMS[number];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProblemDetailLoadResult {
  /** Whether a problem was found. */
  found: boolean;
  /** The problem record, if found. */
  problem: SampleProgrammingProblem | null;
  /** Human-readable message for UI. */
  message: string;
  /** Data source note. */
  sourceNote: string;
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Load a problem by ID from the built-in sample library.
 * Returns a safe result even when the problem doesn't exist.
 */
export function loadProblemById(
  problemId: string | undefined | null,
): ProblemDetailLoadResult {
  if (!problemId || typeof problemId !== "string" || problemId.trim().length === 0) {
    return {
      found: false,
      problem: null,
      message: "未提供有效的题目 ID。",
      sourceNote: "内置示例题目库",
    };
  }

  const normalized = problemId.trim();
  const problem = SAMPLE_PROBLEMS.find((p) => p.problemId === normalized);

  if (!problem) {
    return {
      found: false,
      problem: null,
      message: `未找到题目 "${normalized}"。该题目可能已被移除或 ID 不正确。`,
      sourceNote: "内置示例题目库",
    };
  }

  return {
    found: true,
    problem,
    message: `已加载题目 "${problem.title}"。`,
    sourceNote: "内置示例题目 · 用于练习路径演示 · 未接真实判题系统",
  };
}

/**
 * Get a problem by ID. Returns null when not found.
 */
export function getProblemById(problemId: string | undefined | null): SampleProgrammingProblem | null {
  var result = loadProblemById(problemId);
  return result.problem;
}
