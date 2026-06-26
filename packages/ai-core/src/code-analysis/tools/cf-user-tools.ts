/**
 * A492 — CF User Profile Agent Tools
 *
 * Wraps existing deterministic CF analysis functions as AgentTools
 * for use within the personalized code analysis workflow.
 *
 * Security:
 * - Server-only — never registered for client access
 * - Read-only (except cf.user.refresh)
 * - Validates ownership: user can only read their own data
 * - Never returns raw API responses, source code, keys, or tokens
 */
import type {
  AgentTool,
  AgentToolMetadata,
  ToolExecutionContext,
  ToolExecutionResult,
  ToolInputSchema,
} from "../../agent-runtime/tools/tool-types.ts";
import {
  AgentToolCategory,
  AgentToolSensitivity,
  ToolExecutionStatus,
  createDefaultToolMetadata,
} from "../../agent-runtime/tools/tool-types.ts";

// ---------------------------------------------------------------------------
// Tool Input/Output Types
// ---------------------------------------------------------------------------

export interface CfSnapshotInput {
  /** Empty — userId comes from context */
}

export interface CfSnapshotOutput {
  handle: string;
  currentRating: number | null;
  maxRating: number | null;
  submissions: number;
  solvedProblems: number;
  unfinishedProblems: number;
  lastSubmissionAt: string | null;
  ratingHistorySummary: string;
  tagStatsSummary: string;
  activityTrend: string;
  dataQuality: { confidence: string; warnings: string[] };
}

export interface CfEstimatedRatingInput {
  /** Empty — userId comes from context */
}

export interface CfEstimatedRatingOutput {
  estimatedRating: number | null;
  confidence: number;
  basis: string[];
  currentOfficialRating: number | null;
  maxOfficialRating: number | null;
  source: "official_and_practice" | "practice_only" | "insufficient";
}

export interface CfWeakTagsInput {
  /** Empty — userId comes from context */
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

export interface CfWeakTagsOutput {
  weakTags: CfWeakTagEntry[];
  totalTagsAnalyzed: number;
  dataQuality: string;
}

export interface CfReviewPlanInput {
  /** Empty — userId comes from context */
}

export interface CfReviewPlanOutput {
  focusTags: string[];
  unfinishedCount: number;
  reviewNeededCount: number;
  recentSuggestions: string[];
  associatedProblemKeys: string[];
}

export interface CfCandidatesInput {
  ratingMin?: number;
  ratingMax?: number;
  targetRating?: number;
  tags?: string[];
  limit?: number;
}

export interface CfCandidateEntry {
  cfContestId: number;
  cfIndex: string;
  name: string;
  rating: number | null;
  tags: string[];
  cfUrl: string;
}

export interface CfCandidatesOutput {
  candidates: CfCandidateEntry[];
  totalAvailable: number;
  excludedCount: number;
}

export interface CfRefreshInput {
  /** Empty — userId comes from context */
}

export interface CfRefreshOutput {
  success: boolean;
  newRating: number | null;
  submissionsFetched: number;
  message: string;
}

// ---------------------------------------------------------------------------
// Tool Input Schemas (simple validation)
// ---------------------------------------------------------------------------

function emptySchema<T>(): ToolInputSchema<T> {
  return {
    _brand: "ToolInputSchema" as const,
    _inputType: undefined as unknown as T,
    schema: { type: "object", additionalProperties: false },
    validate(input: unknown): T {
      // Accept empty object or undefined
      if (input === undefined || input === null) return {} as T;
      if (typeof input === "object" && Object.keys(input as object).length === 0) return {} as T;
      return {} as T;
    },
  };
}

function candidatesSchema(): ToolInputSchema<CfCandidatesInput> {
  return {
    _brand: "ToolInputSchema" as const,
    _inputType: undefined as unknown as CfCandidatesInput,
    schema: {
      type: "object",
      properties: {
        ratingMin: { type: "number" },
        ratingMax: { type: "number" },
        targetRating: { type: "number" },
        tags: { type: "array", items: { type: "string" } },
        limit: { type: "number", minimum: 1, maximum: 10 },
      },
    },
    validate(input: unknown): CfCandidatesInput {
      if (input === undefined || input === null) return {};
      const obj = input as Record<string, unknown>;
      return {
        ratingMin: typeof obj.ratingMin === "number" ? obj.ratingMin : undefined,
        ratingMax: typeof obj.ratingMax === "number" ? obj.ratingMax : undefined,
        targetRating: typeof obj.targetRating === "number" ? obj.targetRating : undefined,
        tags: Array.isArray(obj.tags) ? obj.tags.filter((t: unknown) => typeof t === "string") : undefined,
        limit: typeof obj.limit === "number" ? Math.min(Math.max(obj.limit, 1), 10) : 3,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Tool Factory
// ---------------------------------------------------------------------------

function makeSuccess<T>(toolCallId: string, data: T, summary: string, startedAt: string): ToolExecutionResult<T> {
  return {
    toolCallId,
    status: ToolExecutionStatus.Success,
    data,
    safeSummary: summary,
    retryable: false,
    startedAt,
    completedAt: new Date().toISOString(),
    durationMs: Date.now() - new Date(startedAt).getTime(),
  };
}

function makeError<TOutput>(
  toolCallId: string,
  errorCode: string,
  message: string,
  startedAt: string,
): ToolExecutionResult<TOutput> {
  return {
    toolCallId,
    status: ToolExecutionStatus.Failed,
    safeSummary: `Tool failed: ${message}`,
    errorCode,
    retryable: false,
    startedAt,
    completedAt: new Date().toISOString(),
    durationMs: Date.now() - new Date(startedAt).getTime(),
  };
}

// ---------------------------------------------------------------------------
// Tool: cf.user.snapshot.read
// ---------------------------------------------------------------------------

export interface CfSnapshotToolDeps {
  getSnapshot: (userId: string) => Promise<CfSnapshotOutput | null>;
}

export function createCfSnapshotTool(deps: CfSnapshotToolDeps): AgentTool<CfSnapshotInput, CfSnapshotOutput> {
  const metadata: AgentToolMetadata = createDefaultToolMetadata({
    name: "cf.user.snapshot.read",
    description: "读取用户 Codeforces 快照数据（Handle、Rating、提交统计、标签分布、活跃趋势、数据质量）",
    category: AgentToolCategory.UserData,
    readOnly: true,
    sideEffect: false,
    parallelSafe: true,
    requiresConfirmation: false,
    requiresAuthentication: true,
    sensitivity: AgentToolSensitivity.Medium,
    timeoutMs: 10_000,
    allowedAgents: ["learner-profiler"],
    disabledByDefault: false,
  });

  return {
    metadata,
    inputSchema: emptySchema<CfSnapshotInput>(),
    async execute(_input, context): Promise<ToolExecutionResult<CfSnapshotOutput>> {
      const startedAt = new Date().toISOString();
      try {
        const userId = context.userId;
        if (!userId) return makeError("tcall_" + Date.now(), "NOT_AUTHENTICATED", "User not authenticated.", startedAt);
        const data = await deps.getSnapshot(userId);
        if (!data) return makeError("tcall_" + Date.now(), "NOT_FOUND", "No CF account found.", startedAt);
        return makeSuccess("tcall_" + Date.now(), data, `CF snapshot for ${data.handle}: rating=${data.currentRating ?? "unrated"}`, startedAt);
      } catch (err: unknown) {
        return makeError("tcall_" + Date.now(), "SNAPSHOT_ERROR", err instanceof Error ? err.message : String(err), startedAt);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Tool: cf.user.estimated-rating.read
// ---------------------------------------------------------------------------

export interface CfEstimatedRatingToolDeps {
  getEstimatedRating: (userId: string) => Promise<CfEstimatedRatingOutput>;
}

export function createCfEstimatedRatingTool(deps: CfEstimatedRatingToolDeps): AgentTool<CfEstimatedRatingInput, CfEstimatedRatingOutput> {
  const metadata: AgentToolMetadata = createDefaultToolMetadata({
    name: "cf.user.estimated-rating.read",
    description: "读取用户预估真实 Codeforces Rating（综合官方比赛和实践表现）",
    category: AgentToolCategory.UserData,
    readOnly: true,
    sideEffect: false,
    parallelSafe: true,
    requiresConfirmation: false,
    requiresAuthentication: true,
    sensitivity: AgentToolSensitivity.Medium,
    timeoutMs: 15_000,
    allowedAgents: ["learner-profiler"],
    disabledByDefault: false,
  });

  return {
    metadata,
    inputSchema: emptySchema<CfEstimatedRatingInput>(),
    async execute(_input, context): Promise<ToolExecutionResult<CfEstimatedRatingOutput>> {
      const startedAt = new Date().toISOString();
      try {
        const userId = context.userId;
        if (!userId) return makeError("tcall_" + Date.now(), "NOT_AUTHENTICATED", "User not authenticated.", startedAt);
        const data = await deps.getEstimatedRating(userId);
        return makeSuccess("tcall_" + Date.now(), data, `Estimated rating: ${data.estimatedRating ?? "unknown"} (confidence: ${data.confidence})`, startedAt);
      } catch (err: unknown) {
        return makeError("tcall_" + Date.now(), "RATING_ERROR", err instanceof Error ? err.message : String(err), startedAt);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Tool: cf.user.weak-tags.read
// ---------------------------------------------------------------------------

export interface CfWeakTagsToolDeps {
  getWeakTags: (userId: string) => Promise<CfWeakTagsOutput>;
}

export function createCfWeakTagsTool(deps: CfWeakTagsToolDeps): AgentTool<CfWeakTagsInput, CfWeakTagsOutput> {
  const metadata: AgentToolMetadata = createDefaultToolMetadata({
    name: "cf.user.weak-tags.read",
    description: "读取用户薄弱标签分析（完成率低、尝试次数多的标签）",
    category: AgentToolCategory.UserData,
    readOnly: true,
    sideEffect: false,
    parallelSafe: true,
    requiresConfirmation: false,
    requiresAuthentication: true,
    sensitivity: AgentToolSensitivity.Medium,
    timeoutMs: 10_000,
    allowedAgents: ["learner-profiler"],
    disabledByDefault: false,
  });

  return {
    metadata,
    inputSchema: emptySchema<CfWeakTagsInput>(),
    async execute(_input, context): Promise<ToolExecutionResult<CfWeakTagsOutput>> {
      const startedAt = new Date().toISOString();
      try {
        const userId = context.userId;
        if (!userId) return makeError("tcall_" + Date.now(), "NOT_AUTHENTICATED", "User not authenticated.", startedAt);
        const data = await deps.getWeakTags(userId);
        return makeSuccess("tcall_" + Date.now(), data, `${data.weakTags.length} weak tags identified`, startedAt);
      } catch (err: unknown) {
        return makeError("tcall_" + Date.now(), "WEAK_TAGS_ERROR", err instanceof Error ? err.message : String(err), startedAt);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Tool: cf.user.review-plan.read
// ---------------------------------------------------------------------------

export interface CfReviewPlanToolDeps {
  getReviewPlan: (userId: string) => Promise<CfReviewPlanOutput>;
}

export function createCfReviewPlanTool(deps: CfReviewPlanToolDeps): AgentTool<CfReviewPlanInput, CfReviewPlanOutput> {
  const metadata: AgentToolMetadata = createDefaultToolMetadata({
    name: "cf.user.review-plan.read",
    description: "读取用户复习计划摘要（重点复习区域、标签、未完成/需要复习题数）",
    category: AgentToolCategory.UserData,
    readOnly: true,
    sideEffect: false,
    parallelSafe: true,
    requiresConfirmation: false,
    requiresAuthentication: true,
    sensitivity: AgentToolSensitivity.Medium,
    timeoutMs: 10_000,
    allowedAgents: ["learner-profiler"],
    disabledByDefault: false,
  });

  return {
    metadata,
    inputSchema: emptySchema<CfReviewPlanInput>(),
    async execute(_input, context): Promise<ToolExecutionResult<CfReviewPlanOutput>> {
      const startedAt = new Date().toISOString();
      try {
        const userId = context.userId;
        if (!userId) return makeError("tcall_" + Date.now(), "NOT_AUTHENTICATED", "User not authenticated.", startedAt);
        const data = await deps.getReviewPlan(userId);
        return makeSuccess("tcall_" + Date.now(), data, `Review plan: ${data.focusTags.length} focus tags, ${data.unfinishedCount} unfinished`, startedAt);
      } catch (err: unknown) {
        return makeError("tcall_" + Date.now(), "REVIEW_PLAN_ERROR", err instanceof Error ? err.message : String(err), startedAt);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Tool: cf.problem.candidates.read
// ---------------------------------------------------------------------------

export interface CfCandidatesToolDeps {
  getCandidates: (userId: string, input: CfCandidatesInput) => Promise<CfCandidatesOutput>;
}

export function createCfCandidatesTool(deps: CfCandidatesToolDeps): AgentTool<CfCandidatesInput, CfCandidatesOutput> {
  const metadata: AgentToolMetadata = createDefaultToolMetadata({
    name: "cf.problem.candidates.read",
    description: "从本地精选题池查询后续训练题（强制排除已完成题，支持 Rating 范围和标签过滤）",
    category: AgentToolCategory.Recommendation,
    readOnly: true,
    sideEffect: false,
    parallelSafe: true,
    requiresConfirmation: false,
    requiresAuthentication: true,
    sensitivity: AgentToolSensitivity.Low,
    timeoutMs: 5_000,
    allowedAgents: ["learning-advisor"],
    disabledByDefault: false,
  });

  return {
    metadata,
    inputSchema: candidatesSchema(),
    async execute(input, context): Promise<ToolExecutionResult<CfCandidatesOutput>> {
      const startedAt = new Date().toISOString();
      try {
        const userId = context.userId;
        if (!userId) return makeError("tcall_" + Date.now(), "NOT_AUTHENTICATED", "User not authenticated.", startedAt);
        const data = await deps.getCandidates(userId, input);
        return makeSuccess("tcall_" + Date.now(), data, `${data.candidates.length} candidates (${data.totalAvailable} available, ${data.excludedCount} excluded)`, startedAt);
      } catch (err: unknown) {
        return makeError("tcall_" + Date.now(), "CANDIDATES_ERROR", err instanceof Error ? err.message : String(err), startedAt);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Tool: cf.user.refresh (heavy restrictions)
// ---------------------------------------------------------------------------

export interface CfRefreshToolDeps {
  refreshCfData: (userId: string) => Promise<CfRefreshOutput>;
}

export function createCfRefreshTool(deps: CfRefreshToolDeps): AgentTool<CfRefreshInput, CfRefreshOutput> {
  const metadata: AgentToolMetadata = createDefaultToolMetadata({
    name: "cf.user.refresh",
    description: "刷新用户 Codeforces 数据（需用户明确确认，受冷却时间限制，不可并发）",
    category: AgentToolCategory.UserData,
    readOnly: false,
    sideEffect: true,
    parallelSafe: false,
    requiresConfirmation: true, // Always requires user confirmation
    requiresAuthentication: true,
    sensitivity: AgentToolSensitivity.High,
    timeoutMs: 30_000,
    allowedAgents: ["learner-profiler"],
    disabledByDefault: true, // Must be explicitly enabled
  });

  return {
    metadata,
    inputSchema: emptySchema<CfRefreshInput>(),
    async execute(_input, context): Promise<ToolExecutionResult<CfRefreshOutput>> {
      const startedAt = new Date().toISOString();
      try {
        const userId = context.userId;
        if (!userId) return makeError("tcall_" + Date.now(), "NOT_AUTHENTICATED", "User not authenticated.", startedAt);
        const data = await deps.refreshCfData(userId);
        return makeSuccess("tcall_" + Date.now(), data, `CF refresh: ${data.success ? "success" : "failed"} — ${data.message}`, startedAt);
      } catch (err: unknown) {
        return makeError("tcall_" + Date.now(), "REFRESH_ERROR", err instanceof Error ? err.message : String(err), startedAt);
      }
    },
  };
}
