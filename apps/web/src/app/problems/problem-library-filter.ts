/**
 * Problem library filter — pure functions to search and filter sample
 * programming problems by keyword, difficulty, and tags.
 *
 * @module problem-library-filter
 * @previewOnly — built-in sample data only; not connected to a real OJ
 */

import type { SampleProgrammingProblem } from "./sample-programming-problems.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProblemFilterCriteria {
  query?: string;
  difficulty?: string;
  tags?: string[];
}

export interface ProblemLibraryStats {
  totalCount: number;
  difficultyCounts: Record<string, number>;
  tagCounts: Record<string, number>;
  filteredCount: number;
}

// ---------------------------------------------------------------------------
// Filter
// ---------------------------------------------------------------------------

export function filterProblems(
  problems: readonly SampleProgrammingProblem[],
  criteria: ProblemFilterCriteria,
): SampleProgrammingProblem[] {
  var result = problems.slice();

  if (criteria.query && criteria.query.trim().length > 0) {
    var q = criteria.query.trim().toLowerCase();
    result = result.filter(function (p) {
      return p.title.toLowerCase().indexOf(q) >= 0 ||
        p.difficulty.toLowerCase().indexOf(q) >= 0 ||
        p.tags.some(function (t) { return t.toLowerCase().indexOf(q) >= 0; });
    });
  }

  if (criteria.difficulty && criteria.difficulty.trim().length > 0) {
    var d = criteria.difficulty.trim().toLowerCase();
    result = result.filter(function (p) {
      return p.difficulty.toLowerCase() === d;
    });
  }

  if (criteria.tags && criteria.tags.length > 0) {
    var reqTags = criteria.tags.map(function (t) {
      return t.trim().toLowerCase();
    }).filter(Boolean);
    if (reqTags.length > 0) {
      result = result.filter(function (p) {
        var lowerTags = p.tags.map(function (t) {
          return t.toLowerCase();
        });
        return reqTags.every(function (rt) {
          return lowerTags.indexOf(rt) >= 0;
        });
      });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export function computeProblemLibraryStats(
  problems: readonly SampleProgrammingProblem[],
  filteredProblems?: readonly SampleProgrammingProblem[],
): ProblemLibraryStats {
  var totalCount = problems.length;
  var filteredCount = filteredProblems ? filteredProblems.length : totalCount;

  var difficultyCounts: Record<string, number> = {};
  for (var i = 0; i < problems.length; i++) {
    var d = problems[i].difficulty;
    difficultyCounts[d] = (difficultyCounts[d] ?? 0) + 1;
  }

  var tagCounts: Record<string, number> = {};
  for (var j = 0; j < problems.length; j++) {
    var tags = problems[j].tags;
    for (var k = 0; k < tags.length; k++) {
      var t = tags[k];
      tagCounts[t] = (tagCounts[t] ?? 0) + 1;
    }
  }

  return { totalCount: totalCount, difficultyCounts: difficultyCounts, tagCounts: tagCounts, filteredCount: filteredCount };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

var SENSITIVE_PATTERNS: RegExp[] = [
  /\bDATABASE_URL\b/i,
  /\bapi[_\s-]*key\b/i,
  /\btoken\b/i,
  /\bsecret\b/i,
  /\bpassword\b/i,
];

export function filterCriteriaIsSafe(criteria: ProblemFilterCriteria): boolean {
  var json = JSON.stringify(criteria);
  for (var i = 0; i < SENSITIVE_PATTERNS.length; i++) {
    if (SENSITIVE_PATTERNS[i].test(json)) {
      return false;
    }
  }
  return true;
}
