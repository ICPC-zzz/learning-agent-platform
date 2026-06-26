// ============================================================
// A488 — Training Plan Generator (Deterministic)
// ============================================================
// Generates 3-5 training problems from candidate results.
// Mandatory safety: verifies no solved problem is included.
//
// @module cf-training-plan

import type { CfLearningAgentReport } from "./cf-learning-analysis.ts";
export interface CodeforcesAgentCandidate {
  problemKey: string;
  name: string;
  rating: number;
  tags: readonly string[];
  originalUrl: string;
  solvedCount?: number;
}

// ---------------------------------------------------------------------------
// Recommendation types
// ---------------------------------------------------------------------------

export type RecommendationType =
  | "warmup"
  | "weak_tag"
  | "challenge"
  | "unfinished_review";

export interface TrainingCandidate {
  problemKey: string;
  name: string;
  rating: number;
  tags: string[];
  originalUrl: string;
  candidate: CodeforcesAgentCandidate;
}

export interface RecommendationEntry {
  problemKey: string;
  name: string;
  rating: number;
  tags: readonly string[];
  originalUrl: string;
  recommendationType: RecommendationType;
  reasonCodes: readonly string[];
}

// ---------------------------------------------------------------------------
// Safety: ensure no solved problems in recommendations
// ---------------------------------------------------------------------------

export function assertNoSolvedProblems(
  recommendations: readonly RecommendationEntry[],
  solvedProblemKeys: ReadonlySet<string>,
): void {
  for (const rec of recommendations) {
    if (solvedProblemKeys.has(rec.problemKey)) {
      throw new Error(
        `SAFETY VIOLATION: Solved problem "${rec.problemKey}" (${rec.name}) found in recommendations. Entire result rejected.`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

export interface TrainingPlanInput {
  readonly warmupCandidates: readonly CodeforcesAgentCandidate[];
  readonly weakTagCandidates: readonly CodeforcesAgentCandidate[];
  readonly challengeCandidates: readonly CodeforcesAgentCandidate[];
  readonly unfinishedCandidates: readonly CodeforcesAgentCandidate[];
  readonly weakTags: CfLearningAgentReport["weakTags"];
  readonly solvedProblemKeys: ReadonlySet<string>;
}

export function generateTrainingPlan(input: TrainingPlanInput): {
  recommendations: RecommendationEntry[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const recommendations: RecommendationEntry[] = [];

  // 1. Warmup (1 problem)
  const warmup = pickWarmup(input.warmupCandidates, input.solvedProblemKeys);
  if (warmup) {
    recommendations.push(warmup);
  } else {
    warnings.push("no_warmup_candidate: 未找到合适的热身题");
  }

  // 2. Weak tag training (1-2 problems)
  const weakTagRecs = pickWeakTagTraining(
    input.weakTagCandidates,
    input.weakTags,
    input.solvedProblemKeys,
    2,
  );
  recommendations.push(...weakTagRecs);
  if (weakTagRecs.length === 0) {
    warnings.push("no_weak_tag_candidate: 未找到合适的薄弱标签训练题");
  }

  // 3. Challenge (1 problem)
  const challenge = pickChallenge(
    input.challengeCandidates,
    input.solvedProblemKeys,
  );
  if (challenge) {
    recommendations.push(challenge);
  } else {
    warnings.push("no_challenge_candidate: 未找到合适的挑战题");
  }

  // 4. Unfinished review (optional, 1 problem)
  if (recommendations.length < 5 && input.unfinishedCandidates.length > 0) {
    const unfinished = pickUnfinishedReview(
      input.unfinishedCandidates,
      input.weakTags,
      input.solvedProblemKeys,
    );
    if (unfinished) {
      recommendations.push(unfinished);
    }
  }

  // Final safety assertion
  assertNoSolvedProblems(recommendations, input.solvedProblemKeys);

  // Degrade gracefully: minimum 3
  if (recommendations.length < 3) {
    warnings.push(
      `low_recommendation_count: 仅生成 ${recommendations.length} 道推荐题，推荐题池可能不足`,
    );
  }

  return { recommendations, warnings };
}

// ---------------------------------------------------------------------------
// Pickers
// ---------------------------------------------------------------------------

function pickWarmup(
  candidates: readonly CodeforcesAgentCandidate[],
  solvedKeys: ReadonlySet<string>,
): RecommendationEntry | null {
  // Prefer a problem close to warmup range, not already solved
  const eligible = candidates.filter((c) => !solvedKeys.has(c.problemKey));

  // Sort by solvedCount descending (more validated = better warmup)
  const sorted = [...eligible].sort(
    (a, b) => (b.solvedCount ?? 0) - (a.solvedCount ?? 0),
  );

  const picked = sorted[0];
  if (!picked) return null;

  return {
    problemKey: picked.problemKey,
    name: picked.name,
    rating: picked.rating,
    tags: picked.tags,
    originalUrl: picked.originalUrl,
    recommendationType: "warmup",
    reasonCodes: ["close_to_training_level", "high_solve_count"],
  };
}

function pickWeakTagTraining(
  candidates: readonly CodeforcesAgentCandidate[],
  weakTags: CfLearningAgentReport["weakTags"],
  solvedKeys: ReadonlySet<string>,
  maxCount: number,
): RecommendationEntry[] {
  const weakTagNames = new Set(
    weakTags.map((wt) => wt.tag.toLowerCase()),
  );

  const eligible = candidates.filter((c) => !solvedKeys.has(c.problemKey));

  // Score: match weak tags, then by solvedCount
  const scored = eligible.map((c) => {
    const matchedTags = c.tags.filter((t) =>
      weakTagNames.has(t.toLowerCase()),
    );
    return {
      candidate: c,
      matchCount: matchedTags.length,
      score: matchedTags.length * 100 + (c.solvedCount ?? 0),
    };
  });

  scored.sort((a, b) => b.score - a.score);

  const result: RecommendationEntry[] = [];
  const usedKeys = new Set<string>();

  for (const item of scored) {
    if (result.length >= maxCount) break;
    if (usedKeys.has(item.candidate.problemKey)) continue;

    usedKeys.add(item.candidate.problemKey);
    result.push({
      problemKey: item.candidate.problemKey,
      name: item.candidate.name,
      rating: item.candidate.rating,
      tags: item.candidate.tags,
      originalUrl: item.candidate.originalUrl,
      recommendationType: "weak_tag",
      reasonCodes:
        item.matchCount > 0
          ? ["matching_weak_tag", "training_range"]
          : ["training_range"],
    });
  }

  return result;
}

function pickChallenge(
  candidates: readonly CodeforcesAgentCandidate[],
  solvedKeys: ReadonlySet<string>,
): RecommendationEntry | null {
  const eligible = candidates.filter(
    (c) => !solvedKeys.has(c.problemKey),
  );

  // Prefer problems with lower solvedCount (more challenging)
  const sorted = [...eligible].sort(
    (a, b) => (a.solvedCount ?? 0) - (b.solvedCount ?? 0),
  );

  const picked = sorted[0];
  if (!picked) return null;

  return {
    problemKey: picked.problemKey,
    name: picked.name,
    rating: picked.rating,
    tags: picked.tags,
    originalUrl: picked.originalUrl,
    recommendationType: "challenge",
    reasonCodes: ["slightly_above_current", "growth_opportunity"],
  };
}

function pickUnfinishedReview(
  candidates: readonly CodeforcesAgentCandidate[],
  weakTags: CfLearningAgentReport["weakTags"],
  solvedKeys: ReadonlySet<string>,
): RecommendationEntry | null {
  const weakTagNames = new Set(
    weakTags.map((wt) => wt.tag.toLowerCase()),
  );

  const eligible = candidates.filter(
    (c) => !solvedKeys.has(c.problemKey),
  );

  // Score by weak tag match
  const scored = eligible.map((c) => {
    const matchedTags = c.tags.filter((t) =>
      weakTagNames.has(t.toLowerCase()),
    );
    return {
      candidate: c,
      matchCount: matchedTags.length,
    };
  });

  scored.sort((a, b) => b.matchCount - a.matchCount);

  const picked = scored[0];
  if (!picked) return null;

  return {
    problemKey: picked.candidate.problemKey,
    name: picked.candidate.name,
    rating: picked.candidate.rating,
    tags: picked.candidate.tags,
    originalUrl: picked.candidate.originalUrl,
    recommendationType: "unfinished_review",
    reasonCodes: ["previously_attempted", "related_to_weak_tags"],
  };
}
