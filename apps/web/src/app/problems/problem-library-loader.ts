/**
 * Problem library loader — resolves the sample problems list with optional
 * filtering for the /problems page.
 *
 * @module problem-library-loader
 * @previewOnly — built-in samples; not connected to a real OJ
 */

import { SAMPLE_PROBLEMS, type SampleProgrammingProblem } from "./sample-programming-problems.js";
import {
  filterProblems,
  computeProblemLibraryStats,
  type ProblemFilterCriteria,
} from "./problem-library-filter.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProblemLibraryLoadResult {
  /** The filtered list of problems. */
  problems: SampleProgrammingProblem[];
  /** Total count in the full library. */
  totalCount: number;
  /** Filtered count. */
  filteredCount: number;
  /** Library statistics. */
  stats: ReturnType<typeof computeProblemLibraryStats>;
  /** Data source note. */
  sourceNote: string;
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Load problems with optional filter criteria.
 * In future iterations, this could also load from a DB or external API.
 */
export function loadProblemLibrary(
  criteria?: ProblemFilterCriteria,
): ProblemLibraryLoadResult {
  const filtered = criteria ? filterProblems(SAMPLE_PROBLEMS, criteria) : SAMPLE_PROBLEMS;
  const stats = computeProblemLibraryStats(SAMPLE_PROBLEMS, filtered);

  return {
    problems: filtered.slice(0, 200),
    totalCount: SAMPLE_PROBLEMS.length,
    filteredCount: filtered.length,
    stats,
    sourceNote:
      "内置示例题目 · 用于练习路径演示 · 未接真实判题系统 · 不执行代码",
  };
}
