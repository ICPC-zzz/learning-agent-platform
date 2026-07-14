/**
 * A492 — Personalized Code Analysis Types
 *
 * Extends A491 CodeAnalysisInput with user-provided rating/tags,
 * CF profile controls, and new report sections:
 * - ProblemProfile, LearnerProfile, DifficultyFit, PersonalizedAdvice
 */
import type { CodeAnalysisError, CodeAnalysisReport } from "./types.ts";

// ---------------------------------------------------------------------------
// A492 Extended Input
// ---------------------------------------------------------------------------

export interface PersonalizedCodeAnalysisInput {
  /** A491 base input */
  problemStatement: string;
  sourceCode: string;
  selectedLanguage: string;
  errorInfo?: string;
  testInput?: string;
  actualOutput?: string;
  expectedOutput?: string;
  failedCases?: string;

  /** A492: user-provided problem rating (800-3500, optional) */
  userProvidedRating?: number;

  /** A492: user-provided problem tags (optional, deduped, normalized) */
  userProvidedTags?: string[];

  /** A492: enable CF learning profile integration */
  enableCfProfile: boolean;

  /** A492: refresh CF data before analysis (requires explicit user action) */
  refreshCfData: boolean;

  /** A492: recommend follow-up training problems */
  recommendFollowUp: boolean;

  /** A492: userId from session (never from client) */
  userId: string;
}

// ---------------------------------------------------------------------------
// Problem Profile (ProblemProfileAgent output)
// ---------------------------------------------------------------------------

export type ProfileSource = "user_provided" | "model_inferred" | "rule_estimated" | "unknown";

export interface ProblemRatingProfile {
  value: number | null;
  range: [number, number] | null;
  source: ProfileSource;
  confidence: number; // 0–1
  reasoning: string[];
}

export interface ProblemTagEntry {
  tag: string;
  source: ProfileSource;
  confidence: number; // 0–1
  evidence: string[];
}

export interface ProblemProfile {
  rating: ProblemRatingProfile;
  tags: ProblemTagEntry[];
  problemType: string[];
  requiredKnowledge: string[];
  keyConstraints: string[];
  uncertaintyWarnings: string[];
}

// ---------------------------------------------------------------------------
// Learner Profile (LearnerProfileAgent output)
// ---------------------------------------------------------------------------

export interface WeakTagSummary {
  tag: string;
  attempted: number;
  solved: number;
  completionRate: number;
  averageAttempts: number;
  averageRating: number;
  evidenceLevel: "strong" | "moderate" | "weak";
  reasonCodes: string[];
}

export interface CfWeakTagEntry {
  tag: string;
  attempted: number;
  solved: number;
  completionRate: number;
  averageAttempts: number;
  averageRating: number;
  evidenceLevel: string;
  reasonCodes: string[];
}

export interface LearnerProfileContext {
  handle: string | null;
  estimatedRating: number | null;
  ratingConfidence: number; // 0–1
  officialRating: number | null;
  weakTags: WeakTagSummary[];
  reviewFocusTags: string[];
  recentActivity: string;
  solvedProblemKeys: string[];
  dataQuality: string[];
  lastSyncedAt: string | null;
}

// ---------------------------------------------------------------------------
// Difficulty Fit (deterministic pure function)
// ---------------------------------------------------------------------------

export type DifficultyStatus =
  | "far_too_easy"
  | "easy"
  | "appropriate"
  | "challenging"
  | "far_too_hard"
  | "unknown";

export interface DifficultyFit {
  status: DifficultyStatus;
  ratingDifference: number | null;
  confidence: number; // 0–1
  reasonCodes: string[];
  advice: string[];
}

// ---------------------------------------------------------------------------
// Weak Tag Match (deterministic pure function)
// ---------------------------------------------------------------------------

export interface WeakTagMatch {
  matchedTags: string[];
  unmatchedProblemTags: string[];
  confidence: number; // 0–1
  recommendations: string[];
}

// ---------------------------------------------------------------------------
// Evidence Classification
// ---------------------------------------------------------------------------

export type EvidenceBasis =
  | "verified_fact"
  | "deterministic_statistic"
  | "user_provided"
  | "model_inference"
  | "needs_runtime_verification";

// ---------------------------------------------------------------------------
// Personalized Code Report (extends A491 report)
// ---------------------------------------------------------------------------

export interface LearnerSpecificObservation {
  observation: string;
  basis: EvidenceBasis;
  confidence: number; // 0–1
}

export interface CodeAnalysisPersonalization {
  difficultyFit: DifficultyFit;
  weakTagMatch: WeakTagMatch;
  learnerSpecificObservations: LearnerSpecificObservation[];
  learningAdvice: string[];
}

// ---------------------------------------------------------------------------
// Candidate Problem (from local curated pool)
// ---------------------------------------------------------------------------

export type CandidateSuggestionType =
  | "prerequisite"
  | "same_tag_practice"
  | "next_challenge";

export interface CandidateProblem {
  cfContestId: number;
  cfIndex: string;
  name: string;
  rating: number | null;
  tags: string[];
  cfUrl: string;
  suggestionType: CandidateSuggestionType;
  suggestionReason: string;
}

// ---------------------------------------------------------------------------
// Extended Report (A491 + A492 sections)
// ---------------------------------------------------------------------------

export interface A492PersonalizedReport {
  /** A491 base report (null if analysis timed out or failed) */
  baseReport: CodeAnalysisReport | null;

  /** Safe failure metadata when baseReport is null. Optional for old saved reports. */
  baseReportError?: CodeAnalysisError | null;

  /** A492: problem profile */
  problemProfile: ProblemProfile;

  /** A492: learner profile (null if CF profile not enabled) */
  learnerProfile: LearnerProfileContext | null;

  /** A492: difficulty fit */
  difficultyFit: DifficultyFit | null;

  /** A492: weak tag match */
  weakTagMatch: WeakTagMatch | null;

  /** A492: personalization section */
  personalization: CodeAnalysisPersonalization | null;

  /** A492: follow-up training candidates (null if not requested or not enough data) */
  candidateProblems: CandidateProblem[] | null;

  /** A492: evidence classification for all advice items */
  evidenceSummary: {
    verifiedFactCount: number;
    deterministicStatisticCount: number;
    userProvidedCount: number;
    modelInferenceCount: number;
    needsRuntimeCount: number;
  };
}

// ---------------------------------------------------------------------------
// Agent Event Types for A492
// ---------------------------------------------------------------------------

export type A492AgentEventStep =
  | "orchestrator_create_plan"
  | "problem_profile_agent"
  | "learner_profile_agent"
  | "cf_tool_snapshot"
  | "cf_tool_rating"
  | "cf_tool_weak_tags"
  | "cf_tool_review_plan"
  | "cf_tool_refresh"
  | "code_debug_agent"
  | "learning_advice_agent"
  | "cf_tool_candidates"
  | "orchestrator_validate"
  | "orchestrator_aggregate";

export interface A492AgentEvent {
  step: A492AgentEventStep;
  agentId: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  timestamp: string;
  durationMs: number;
  summary: string;
  metadata?: {
    modelName?: string;
    tokenCount?: number;
    toolName?: string;
    toolResultSummary?: string;
    confidence?: number;
  };
}

export interface A492AgentTimeline {
  events: A492AgentEvent[];
  totalDurationMs: number;
  modelCallCount: number;
  toolCallCount: number;
}

// ---------------------------------------------------------------------------
// A492 Result
// ---------------------------------------------------------------------------

export interface A492PersonalizedResult {
  success: boolean;
  report: A492PersonalizedReport | null;
  timeline: A492AgentTimeline;
  error: {
    code: string;
    safeMessage: string;
    retryable: boolean;
  } | null;
  modelInfo: {
    providerName: string;
    modelDisplayName: string;
    usageType: string;
    isFallback: boolean;
  } | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const CF_RATING_MIN = 800;
export const CF_RATING_MAX = 3500;
export const MAX_USER_TAGS = 10;
export const MAX_TAG_LENGTH = 50;
export const MAX_CANDIDATE_PROBLEMS = 3;

/** Normalized CF tags (from Codeforces official list) */
export const CF_COMMON_TAGS = [
  "dp", "graphs", "greedy", "data structures", "binary search",
  "implementation", "math", "strings", "trees", "shortest paths",
  "constructive algorithms", "brute force", "dfs and similar",
  "sortings", "number theory", "two pointers", "combinatorics",
  "bitmasks", "geometry", "divide and conquer", "flows",
  "games", "hashing", "matrices", "meet-in-the-middle",
  "probabilities", "schedules", "string suffix structures",
  "ternary search", "fft", "graph matchings", "2-sat",
  "expression parsing", "chinese remainder theorem",
] as const;

/** Tag normalization map: user-friendly input -> CF standard tag */
export const CF_TAG_NORMALIZATION: Record<string, string> = {
  // English aliases
  "dp": "dp",
  "dynamic programming": "dp",
  "graphs": "graphs",
  "graph": "graphs",
  "greedy": "greedy",
  "data structures": "data structures",
  "data structure": "data structures",
  "ds": "data structures",
  "binary search": "binary search",
  "implementation": "implementation",
  "math": "math",
  "mathematics": "math",
  "strings": "strings",
  "string": "strings",
  "trees": "trees",
  "tree": "trees",
  "shortest paths": "shortest paths",
  "shortest path": "shortest paths",
  "constructive algorithms": "constructive algorithms",
  "constructive": "constructive algorithms",
  "brute force": "brute force",
  "dfs and similar": "dfs and similar",
  "dfs": "dfs and similar",
  "sortings": "sortings",
  "sorting": "sortings",
  "number theory": "number theory",
  "two pointers": "two pointers",
  "combinatorics": "combinatorics",
  "bitmasks": "bitmasks",
  "bitmask": "bitmasks",
  "geometry": "geometry",
  "divide and conquer": "divide and conquer",
  "flows": "flows",
  "flow": "flows",
  "games": "games",
  "game": "games",
  "hashing": "hashing",
  "hash": "hashing",

  // Chinese names
  "动态规划": "dp",
  "图论": "graphs",
  "贪心": "greedy",
  "数据结构": "data structures",
  "二分查找": "binary search",
  "二分搜索": "binary search",
  "二分": "binary search",
  "实现": "implementation",
  "模拟": "implementation",
  "数学": "math",
  "字符串": "strings",
  "树": "trees",
  "最短路": "shortest paths",
  "最短路径": "shortest paths",
  "构造": "constructive algorithms",
  "构造算法": "constructive algorithms",
  "暴力": "brute force",
  "深度优先搜索": "dfs and similar",
  "排序": "sortings",
  "数论": "number theory",
  "双指针": "two pointers",
  "组合数学": "combinatorics",
  "位运算": "bitmasks",
  "位掩码": "bitmasks",
  "几何": "geometry",
  "分治": "divide and conquer",
  "网络流": "flows",
  "博弈": "games",
  "哈希": "hashing",
  "散列": "hashing",
};
