/**
 * A492 — Difficulty Matching (Pure Functions)
 *
 * Compares problem profile to learner profile to produce
 * DifficultyFit and WeakTagMatch. No LLM calls — fully deterministic.
 */
import type {
  DifficultyFit,
  DifficultyStatus,
  WeakTagMatch,
  ProblemProfile,
  LearnerProfileContext,
  CfWeakTagEntry,
} from "./a492-types.ts";

// ---------------------------------------------------------------------------
// DifficultyFit
// ---------------------------------------------------------------------------

const DEFAULT_THRESHOLDS = {
  farTooEasy: -300,   // problem rating < learner rating - 300
  easy: -100,         // problem rating < learner rating - 100
  appropriate: 100,   // |problem rating - learner rating| <= 100
  challenging: 300,   // problem rating > learner rating + 100
  // Above 300 = far_too_hard
};

export function compareProblemDifficultyToLearner(
  problemProfile: ProblemProfile,
  learnerProfile: LearnerProfileContext,
  thresholds: Partial<typeof DEFAULT_THRESHOLDS> = {},
): DifficultyFit {
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds };

  const learnerRating = learnerProfile.estimatedRating;
  const learnerConfidence = learnerProfile.ratingConfidence;
  const problemRating = problemProfile.rating.value;
  const problemConfidence = problemProfile.rating.confidence;

  // Case: insufficient data
  if (learnerRating === null && problemRating === null) {
    return {
      status: "unknown",
      ratingDifference: null,
      confidence: 0,
      reasonCodes: ["no_learner_rating", "no_problem_rating"],
      advice: ["无法判断难度匹配：缺少用户 Rating 和题目 Rating 数据"],
    };
  }

  if (learnerRating === null) {
    return {
      status: "unknown",
      ratingDifference: null,
      confidence: 0,
      reasonCodes: ["no_learner_rating"],
      advice: ["用户尚未有 Codeforces Rating 数据，无法进行难度匹配"],
    };
  }

  if (problemRating === null) {
    // Use range if available
    if (problemProfile.rating.range) {
      const [lo, hi] = problemProfile.rating.range;
      const mid = Math.round((lo + hi) / 2);
      const diff = mid - learnerRating;
      const status = classifyStatus(diff, t, learnerConfidence, problemConfidence);
      return {
        status,
        ratingDifference: diff,
        confidence: Math.min(learnerConfidence, problemConfidence, 0.6),
        reasonCodes: buildReasonCodes(status, diff, "rating_range_estimate"),
        advice: buildAdvice(status, diff, learnerProfile, problemProfile),
      };
    }

    return {
      status: "unknown",
      ratingDifference: null,
      confidence: 0,
      reasonCodes: ["no_problem_rating"],
      advice: ["题目 Rating 未知，无法进行精确难度匹配"],
    };
  }

  const diff = problemRating - learnerRating;
  const status = classifyStatus(diff, t, learnerConfidence, problemConfidence);
  const combinedConfidence = Math.min(learnerConfidence, problemConfidence);

  // Adjust for weak tags
  const weakTagMatch = matchProblemTagsToWeakTags(problemProfile, learnerProfile.weakTags);
  const reasonCodes = buildReasonCodes(status, diff, "exact_rating");
  if (weakTagMatch.matchedTags.length > 0) {
    reasonCodes.push("matches_weak_tags");
  }

  // Adjust status if weak tag and problem is in challenging range
  let finalStatus = status;
  if (weakTagMatch.matchedTags.length > 0 && status === "challenging") {
    // Weak tag + challenging = may need more caution
    reasonCodes.push("weak_tag_caution");
  }

  const advice = buildAdvice(finalStatus, diff, learnerProfile, problemProfile);

  return {
    status: finalStatus,
    ratingDifference: diff,
    confidence: combinedConfidence,
    reasonCodes,
    advice,
  };
}

function classifyStatus(
  diff: number,
  t: typeof DEFAULT_THRESHOLDS,
  learnerConfidence: number,
  problemConfidence: number,
): DifficultyStatus {
  // Low confidence on both sides → more conservative classification
  const lowConfidence = learnerConfidence < 0.5 || problemConfidence < 0.5;

  if (diff < t.farTooEasy) return "far_too_easy";
  if (diff < t.easy) return "easy";
  if (diff <= t.appropriate) return "appropriate";
  if (diff <= t.challenging) return lowConfidence ? "challenging" : "challenging";
  return "far_too_hard";
}

function buildReasonCodes(status: DifficultyStatus, diff: number, basis: string): string[] {
  const codes: string[] = [`diff_${diff > 0 ? "positive" : "negative"}_${Math.abs(diff)}`, `basis_${basis}`];
  codes.push(`status_${status}`);
  return codes;
}

function buildAdvice(
  status: DifficultyStatus,
  diff: number,
  learner: LearnerProfileContext,
  problem: ProblemProfile,
): string[] {
  const advice: string[] = [];

  switch (status) {
    case "far_too_easy":
      advice.push(`题目 Rating 比你的预估水平低 ${Math.abs(diff)} 分以上，可能过于简单`);
      advice.push("可以作为热身或速度训练，但如果已稳定掌握，建议提高题目难度");
      advice.push("可以考虑更高 Rating 的同类题目");
      break;

    case "easy":
      advice.push(`题目 Rating 比你的预估水平低约 ${Math.abs(diff)} 分，属于较轻松的练习`);
      advice.push("适合作为巩固训练，重点关注代码质量和实现效率");
      break;

    case "appropriate":
      advice.push("题目难度与你的当前水平接近，适合作为当前阶段训练题");
      advice.push("重点关注算法思路、代码实现和边界处理");
      break;

    case "challenging":
      advice.push(`题目 Rating 比你的预估水平高约 ${diff} 分，有一定挑战性`);
      advice.push("建议在充分理解题目后尝试，重点关注解题思路和优化技巧");
      if (problem.tags.length > 0) {
        advice.push(`本题涉及标签: ${problem.tags.map((t) => t.tag).join(", ")}`);
      }
      break;

    case "far_too_hard":
      advice.push(`题目 Rating 比你的预估水平高 ${diff} 分以上，可能比较困难`);
      if (problem.tags.length > 0) {
        advice.push(`建议先训练相关前置知识: ${problem.tags.map((t) => t.tag).join(", ")}`);
      }
      advice.push("可以先做 1-3 道较低 Rating 的同类型题目，再回来尝试本题");
      break;

    case "unknown":
      advice.push("无法确定难度匹配，缺少足够的数据");
      break;
  }

  return advice;
}

// ---------------------------------------------------------------------------
// WeakTagMatch
// ---------------------------------------------------------------------------

export function matchProblemTagsToWeakTags(
  problemProfile: ProblemProfile,
  weakTags: CfWeakTagEntry[],
): WeakTagMatch {
  const weakTagSet = new Set(weakTags.map((w) => w.tag));
  const problemTags = problemProfile.tags.map((t) => t.tag);

  const matchedTags: string[] = [];
  const unmatchedProblemTags: string[] = [];
  const recommendations: string[] = [];

  for (const tag of problemTags) {
    if (weakTagSet.has(tag)) {
      matchedTags.push(tag);
    } else {
      unmatchedProblemTags.push(tag);
    }
  }

  if (matchedTags.length > 0) {
    recommendations.push(`本题命中了你的薄弱标签: ${matchedTags.join(", ")}`);
    recommendations.push("这些标签是你需要重点训练的方向，本题适合作为对应标签的专项练习");

    // Add specific weak tag details
    for (const tag of matchedTags) {
      const weakInfo = weakTags.find((w) => w.tag === tag);
      if (weakInfo) {
        recommendations.push(
          `  - ${tag}: 完成率 ${Math.round((weakInfo.completionRate || 0) * 100)}%, 平均 ${weakInfo.averageAttempts} 次尝试`,
        );
      }
    }
  } else {
    recommendations.push("本题标签未命中你的当前薄弱标签");
    recommendations.push("但仍可作为代码质量和算法能力的训练");
  }

  // Confidence: higher if tags are user-provided rather than model-inferred
  const userProvidedCount = problemProfile.tags.filter((t) => t.source === "user_provided").length;
  const modelInferredCount = problemProfile.tags.filter((t) => t.source === "model_inferred").length;
  let confidence: number;
  if (problemProfile.tags.length === 0) {
    confidence = 0;
  } else if (userProvidedCount === problemProfile.tags.length) {
    confidence = 0.95;
  } else if (userProvidedCount > 0) {
    confidence = 0.8;
  } else {
    confidence = 0.6;
  }

  return {
    matchedTags,
    unmatchedProblemTags,
    confidence,
    recommendations,
  };
}

// ---------------------------------------------------------------------------
// Tag Intersection (simple utility)
// ---------------------------------------------------------------------------

export function intersectTags(
  problemTags: string[],
  weakTags: CfWeakTagEntry[],
): string[] {
  const weakSet = new Set(weakTags.map((w) => w.tag));
  return problemTags.filter((t) => weakSet.has(t));
}
