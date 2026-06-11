/**
 * User Review Recommendations View Model — generates review recommendations
 * for /user/review page using deterministic rules.
 *
 * @module user-review-recommendations-view-model
 * @previewOnly — dev-only / 规则型推荐 / 未调用 LLM
 */

import type {
  SafeReadingSummary,
  SafeProblemPracticeSummary,
  SafeProblemFavoriteSummary,
  SafeWrongBookSummary,
  SafeBookmarkSummary,
  SafeNoteSummary,
  SafeAiHistorySummary,
  ReviewRecommendationsView,
} from "../../../lib/learning-insight-types.ts";
import {
  generateReviewRecommendations,
  recommendationsAreSafe,
} from "../../../lib/learning-insight-rules.ts";

export interface ReviewRecommendationsInput {
  hasSession: boolean;
  wrongBookEntries: SafeWrongBookSummary[];
  recentPractice: SafeProblemPracticeSummary[];
  recentReading: SafeReadingSummary[];
  bookmarks: SafeBookmarkSummary[];
  notes: SafeNoteSummary[];
  aiHistory: SafeAiHistorySummary[];
  favoriteProblems: SafeProblemFavoriteSummary[];
}

const DATA_SOURCE_NOTICE = "规则型推荐 · 未调用 LLM · 开发预览 · local fallback · 未接生产账号";

const FORBIDDEN_LABELS = [
  "AI 推荐", "LLM 生成", "生产推荐", "真实推荐系统", "云端智能推荐",
];

export function buildReviewRecommendationsView(
  input: ReviewRecommendationsInput,
): ReviewRecommendationsView {
  const {
    hasSession, wrongBookEntries, recentPractice, recentReading,
    bookmarks, notes, aiHistory, favoriteProblems,
  } = input;

  const recommendations = generateReviewRecommendations({
    wrongBookEntries, recentPractice, recentReading,
    bookmarks, notes, aiHistory, favoriteProblems,
  });

  const safetyCheck = recommendationsAreSafe(recommendations);
  const safeRecommendations = safetyCheck.safe
    ? recommendations
    : recommendations.filter(function(r) { return r.safetyLabel && r.safetyLabel.length > 0; });

  const totalCount = safeRecommendations.length;
  const message = totalCount > 0
    ? "共 " + totalCount + " 条推荐（规则型）"
    : hasSession
      ? "暂无足够数据生成复习推荐。继续阅读和练习后将自动生成推荐。"
      : "请先登录 dev session 后查看复习推荐。";

  return {
    recommendations: safeRecommendations,
    totalCount,
    dataSourceNotice: DATA_SOURCE_NOTICE,
    hasSession,
    message,
  };
}

const SENSITIVE_PATTERNS = [
  /\bDATABASE_URL\b/i, /\bapi[_\s-]*key\b/i, /\btoken\b/i,
  /\bsecret\b/i, /\bpassword\b/i, /\bcookie\b/i, /\bauthorization\b/i,
  /\braw[_\s]*prompt\b/i, /\braw[_\s]*response\b/i, /\brawText\b/i,
  /\bfullChapterContent\b/i, /\bsubmittedCode\b/i,
];

export function reviewRecommendationsViewIsSafe(
  view: ReviewRecommendationsView,
): { safe: boolean; violations: string[] } {
  var violations: string[] = [];
  var json = JSON.stringify(view);

  for (var i = 0; i < SENSITIVE_PATTERNS.length; i++) {
    if (SENSITIVE_PATTERNS[i].test(json)) {
      violations.push("Sensitive field matched: " + SENSITIVE_PATTERNS[i].source);
    }
  }

  for (var j = 0; j < FORBIDDEN_LABELS.length; j++) {
    if (json.includes(FORBIDDEN_LABELS[j])) {
      violations.push("Forbidden label found: " + FORBIDDEN_LABELS[j]);
    }
  }

  var recSafety = recommendationsAreSafe(view.recommendations);
  violations.push.apply(violations, recSafety.violations);

  return { safe: violations.length === 0, violations: violations };
}
