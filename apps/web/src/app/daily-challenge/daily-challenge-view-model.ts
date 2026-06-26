/**
 * Daily Challenge View Model — formats daily challenge recommendation
 * and state for the /daily-challenge page.
 *
 * Pure functions only — no localStorage, no LLM, no network.
 *
 * @module daily-challenge-view-model
 * @previewOnly — dev preview / rules engine / no LLM
 */

import type {
  DailyChallengeState,
  DailyChallengeStatus,
} from "../../lib/local-daily-challenge-store";
import type { DailyChallengeRecommendation } from "./daily-challenge-rules";

export interface DailyChallengeActionView {
  actionId: string;
  label: string;
  targetStatus: DailyChallengeStatus;
  description: string;
}

export interface DailyChallengeRelatedLink {
  label: string;
  href: string;
  description: string;
}

export interface DailyChallengePageView {
  hasChallenge: boolean;
  challengeState: DailyChallengeState | null;
  recommendation: DailyChallengeRecommendation | null;
  statusLabel: string;
  statusDescription: string;
  availableActions: DailyChallengeActionView[];
  relatedLinks: DailyChallengeRelatedLink[];
  safetyNotices: string[];
  dataSourceNotice: string;
  isError: boolean;
  errorMessage: string | null;
}

interface DailyChallengePageViewParams {
  challengeState: DailyChallengeState | null;
  recommendation: DailyChallengeRecommendation | null;
  hasError: boolean;
  errorMessage: string | null;
}

export interface DailyChallengeSummaryView {
  hasChallenge: boolean;
  title: string | null;
  difficulty: string | null;
  statusLabel: string;
  statusBadge: DailyChallengeStatus | "not-available";
  recommendationReason: string | null;
  challengeDate: string | null;
  href: string;
  sourceNotice: string;
}

// ---------------------------------------------------------------------------
// Status labels
// ---------------------------------------------------------------------------

var STATUS_LABELS: Record<DailyChallengeStatus, string> = {
  "not-started": "未开始",
  "in-progress": "进行中",
  "completed": "已完成",
  "needs-review": "需要复习",
};

var STATUS_DESCRIPTIONS: Record<DailyChallengeStatus, string> = {
  "not-started": "今日挑战尚未开始，点击开始挑战进入练习。",
  "in-progress": "挑战进行中，完成题目后点击标记完成。",
  "completed": "今日挑战已完成！",
  "needs-review": "今日题目已标记为需要复习，建议重新练习。",
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

var FORBIDDEN_LABELS = [
  "AI 自动推荐",
  "真实判题已接入",
  "生产每日挑战",
  "云端同步成功",
  "Agent 已运行",
  "LLM 生成",
  "生产可用",
  "真实数据",
];

var SENSITIVE_PATTERNS = [
  /\bDATABASE_URL\b/i,
  /\bapi_.*key\b/i,
  /\btoken\b/i,
  /\bsecret\b/i,
  /\bpassword\b/i,
  /\bcookie\b/i,
  /\bauthorization\b/i,
  /\braw_.*prompt\b/i,
  /\braw_.*response\b/i,
];

// ---------------------------------------------------------------------------
// View model builder
// ---------------------------------------------------------------------------

export function buildDailyChallengePageView(
  params: DailyChallengePageViewParams,
): DailyChallengePageView {
  var challengeState = params.challengeState;
  var recommendation = params.recommendation;
  var hasError = params.hasError;
  var errorMessage = params.errorMessage;
  var hasChallenge = challengeState !== null && recommendation !== null;

  if (hasError || (!hasChallenge && !recommendation)) {
    return buildErrorView(errorMessage || "无法加载每日挑战数据");
  }

  if (recommendation === null) {
    return buildErrorView("题库暂无可用题目");
  }

  if (challengeState === null) {
    return buildNewChallengeView(recommendation);
  }

  return buildActiveChallengeView(challengeState, recommendation);
}

function buildNewChallengeView(
  recommendation: DailyChallengeRecommendation,
): DailyChallengePageView {
  var actions: DailyChallengeActionView[] = [
    { actionId: "start", label: "开始挑战", targetStatus: "in-progress", description: "开始今日挑战题目" },
  ];

  return {
    hasChallenge: true,
    challengeState: null,
    recommendation: recommendation,
    statusLabel: "未开始",
    statusDescription: "今日挑战已就绪，点击开始挑战开始练习。",
    availableActions: actions,
    relatedLinks: buildRelatedLinks(recommendation),
    safetyNotices: buildSafetyNotices(),
    dataSourceNotice: "规则生成 · 开发预览 · 未调用 LLM · 未接真实判题 · localStorage fallback",
    isError: false,
    errorMessage: null,
  };
}

function buildActiveChallengeView(
  state: DailyChallengeState,
  recommendation: DailyChallengeRecommendation,
): DailyChallengePageView {
  var actions = buildAvailableActions(state.status);

  return {
    hasChallenge: true,
    challengeState: state,
    recommendation: recommendation,
    statusLabel: STATUS_LABELS[state.status] || "未知",
    statusDescription: STATUS_DESCRIPTIONS[state.status] || "",
    availableActions: actions,
    relatedLinks: buildRelatedLinks(recommendation),
    safetyNotices: buildSafetyNotices(),
    dataSourceNotice: "规则生成 · " + recommendation.recommendationSource + " · 开发预览 · 未调用 LLM · 未接真实判题 · localStorage fallback",
    isError: false,
    errorMessage: null,
  };
}

function buildErrorView(message: string): DailyChallengePageView {
  return {
    hasChallenge: false,
    challengeState: null,
    recommendation: null,
    statusLabel: "错误",
    statusDescription: message,
    availableActions: [],
    relatedLinks: [
      { label: "题目中心", href: "/problems", description: "浏览内置题目" },
      { label: "错题本", href: "/user/wrong-book", description: "查看错题记录" },
    ],
    safetyNotices: buildSafetyNotices(),
    dataSourceNotice: "规则生成 · 开发预览 · 未调用 LLM · 未接真实判题",
    isError: true,
    errorMessage: message,
  };
}

// ---------------------------------------------------------------------------
// Available actions
// ---------------------------------------------------------------------------

function buildAvailableActions(status: DailyChallengeStatus): DailyChallengeActionView[] {
  if (status === "not-started") {
    return [
      { actionId: "start", label: "开始挑战", targetStatus: "in-progress", description: "开始今日挑战题目" },
    ];
  }
  if (status === "in-progress") {
    return [
      { actionId: "complete", label: "标记完成", targetStatus: "completed", description: "确认完成今日挑战" },
      { actionId: "needs-review", label: "标记需要复习", targetStatus: "needs-review", description: "将这道题标记为需要复习" },
      { actionId: "reset", label: "重置", targetStatus: "not-started", description: "重置挑战状态" },
    ];
  }
  if (status === "completed") {
    return [
      { actionId: "needs-review", label: "标记需要复习", targetStatus: "needs-review", description: "虽然已完成，但觉得需要复习" },
      { actionId: "reset", label: "重新开始", targetStatus: "not-started", description: "重置挑战状态" },
    ];
  }
  if (status === "needs-review") {
    return [
      { actionId: "complete", label: "标记完成", targetStatus: "completed", description: "确认复习完成" },
      { actionId: "reset", label: "重新开始", targetStatus: "not-started", description: "重置挑战状态" },
    ];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Related links
// ---------------------------------------------------------------------------

function buildRelatedLinks(
  recommendation: DailyChallengeRecommendation,
): DailyChallengeRelatedLink[] {
  var links: DailyChallengeRelatedLink[] = [];

  if (recommendation && recommendation.problemId) {
    links.push({
      label: "题目详情",
      href: "/problems/" + recommendation.problemId,
      description: "查看题目详情和示例",
    });
  }

  links.push(
    { label: "今日计划", href: "/user/today", description: "查看今日学习计划" },
    { label: "错题本", href: "/user/wrong-book", description: "查看错题记录" },
    { label: "复习推荐", href: "/user/review", description: "查看复习推荐" },
    { label: "题目中心", href: "/problems", description: "浏览全部题目" },
  );

  return links;
}

// ---------------------------------------------------------------------------
// Safety notices
// ---------------------------------------------------------------------------

function buildSafetyNotices(): string[] {
  return [
    "开发预览",
    "规则生成",
    "未调用 LLM",
    "未接真实判题",
    "localStorage fallback",
    "不保存用户代码",
    "不保存判题结果",
  ];
}

// ---------------------------------------------------------------------------
// Dashboard summary builder
// ---------------------------------------------------------------------------

export function buildDailyChallengeSummary(params: {
  challengeState: DailyChallengeState | null;
  recommendation: DailyChallengeRecommendation | null;
}): DailyChallengeSummaryView {
  var challengeState = params.challengeState;
  var recommendation = params.recommendation;
  var hasChallenge = challengeState !== null && recommendation !== null;

  if (!hasChallenge || challengeState === null || recommendation === null) {
    return {
      hasChallenge: false,
      title: null,
      difficulty: null,
      statusLabel: "未初始化",
      statusBadge: "not-available",
      recommendationReason: null,
      challengeDate: null,
      href: "/daily-challenge",
      sourceNotice: "规则生成 · 未调用 LLM · localStorage fallback",
    };
  }

  return {
    hasChallenge: true,
    title: recommendation.title,
    difficulty: recommendation.difficulty,
    statusLabel: STATUS_LABELS[challengeState.status] || "未知",
    statusBadge: challengeState.status,
    recommendationReason: recommendation.recommendationReason,
    challengeDate: challengeState.challengeDate,
    href: "/daily-challenge",
    sourceNotice: "规则生成 · " + recommendation.recommendationSource + " · 未调用 LLM · localStorage fallback",
  };
}

// ---------------------------------------------------------------------------
// Safety checks
// ---------------------------------------------------------------------------

export function dailyChallengeViewIsSafe(view: DailyChallengePageView): {
  safe: boolean;
  violations: string[];
} {
  var violations: string[] = [];
  var json = JSON.stringify(view);

  for (var i = 0; i < SENSITIVE_PATTERNS.length; i++) {
    if (SENSITIVE_PATTERNS[i].test(json)) {
      violations.push("sensitive: " + SENSITIVE_PATTERNS[i].source);
    }
  }

  for (var j = 0; j < FORBIDDEN_LABELS.length; j++) {
    if (json.indexOf(FORBIDDEN_LABELS[j]) >= 0) {
      violations.push("forbidden label: " + FORBIDDEN_LABELS[j]);
    }
  }

  var hasNoLlmNotice = Array.isArray(view.safetyNotices) && view.safetyNotices.some(function (n) { return typeof n === "string" && n.indexOf("未调用 LLM") >= 0; });
  if (!hasNoLlmNotice) {
    violations.push("safety notices missing: 未调用 LLM");
  }

  return { safe: violations.length === 0, violations: violations };
}

export function dailyChallengeSummaryIsSafe(view: DailyChallengeSummaryView): {
  safe: boolean;
  violations: string[];
} {
  var violations: string[] = [];
  var json = JSON.stringify(view);

  for (var i = 0; i < SENSITIVE_PATTERNS.length; i++) {
    if (SENSITIVE_PATTERNS[i].test(json)) {
      violations.push("sensitive: " + SENSITIVE_PATTERNS[i].source);
    }
  }

  for (var j = 0; j < FORBIDDEN_LABELS.length; j++) {
    if (json.indexOf(FORBIDDEN_LABELS[j]) >= 0) {
      violations.push("forbidden label: " + FORBIDDEN_LABELS[j]);
    }
  }

  return { safe: violations.length === 0, violations: violations };
}
