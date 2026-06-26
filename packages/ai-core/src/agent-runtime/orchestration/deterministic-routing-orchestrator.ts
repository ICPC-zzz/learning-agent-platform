// ============================================================
// A488 — Deterministic Routing Orchestrator
// ============================================================
// Real Orchestrator for cf.learning.analysis intent.
// No LLM routing — intent is passed directly.
// Uses A487 AgentOrchestrator contract, ToolRegistry, ToolExecutor.
//
// @module deterministic-routing-orchestrator

import type { AgentId, RunId, TaskId } from "../core/agent-types.ts";
import {
  AgentExecutionStatus as ES,
  AgentTaskPriority,
  AgentTaskStatus as TS,
} from "../core/agent-types.ts";
import type { CfProblemStat } from "../cf-analysis/cf-rating-estimator.ts";
import type { CodeforcesAgentCandidate } from "../cf-analysis/cf-training-plan.ts";
import type { AgentEvent } from "../core/agent-events.ts";
import {
  createRunStartedEvent,
  createRunCompletedEvent,
  createRunFailedEvent,
  createTaskCreatedEvent,
  createTaskStartedEvent,
  createTaskCompletedEvent,
  createTaskFailedEvent,
  createAgentStartedEvent,
  createAgentProgressEvent,
} from "../core/agent-events.ts";
import type {
  AgentOrchestrator,
  AgentRequest,
  AgentPlan,
  AgentPlanStep,
  AgentResult,
  AggregatedAgentResult,
} from "./orchestrator-types.ts";
import type { AgentToolExecutor } from "../tools/tool-executor.ts";

// ---------------------------------------------------------------------------
// Supported intents
// ---------------------------------------------------------------------------

export const SUPPORTED_INTENTS: ReadonlySet<string> = new Set([
  "cf.learning.analysis",
  "cf.wrongbook.review",
]);

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

export const OrchestratorErrorCode = {
  NotLoggedIn: "NOT_LOGGED_IN",
  NotBound: "CF_NOT_BOUND",
  NotSynced: "CF_NOT_SYNCED",
  InsufficientData: "CF_INSUFFICIENT_DATA",
  FeatureDisabled: "FEATURE_DISABLED",
  UnsupportedIntent: "UNSUPPORTED_INTENT",
  PoolEmpty: "CF_POOL_EMPTY",
  ToolPermissionDenied: "TOOL_PERMISSION_DENIED",
  DatabaseError: "DATABASE_ERROR",
  InternalError: "INTERNAL_ERROR",
} as const;

export type OrchestratorErrorCode =
  (typeof OrchestratorErrorCode)[keyof typeof OrchestratorErrorCode];

// ---------------------------------------------------------------------------
// Orchestrator dependencies
// ---------------------------------------------------------------------------

export interface DeterministicOrchestratorDeps {
  readonly toolExecutor: AgentToolExecutor;
  readonly featureEnabled: () => boolean;
  readonly isAuthenticated: (userId?: string) => boolean;
  readonly isCfBound: (userId: string) => Promise<boolean>;
  readonly isCfSynced: (userId: string) => Promise<boolean>;
  readonly hasLocalPool: () => Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Error with code
// ---------------------------------------------------------------------------

export class OrchestratorError extends Error {
  public readonly code: OrchestratorErrorCode;
  public readonly userMessage: string;

  constructor(code: OrchestratorErrorCode, userMessage: string) {
    super(userMessage);
    this.name = "OrchestratorError";
    this.code = code;
    this.userMessage = userMessage;
  }
}

// ---------------------------------------------------------------------------
// Progress messages
// ---------------------------------------------------------------------------

const PROGRESS_MESSAGES: Record<string, string> = {
  step_1_read_snapshot: "正在读取Codeforces数据...",
  step_2_analyze: "正在分析训练表现...",
  step_3_query_candidates: "正在筛选本地题目...",
  step_4_generate_report: "正在生成训练计划...",
  step_5_aggregate: "分析完成",
  // Wrong book review steps (v2)
  wb_step_1_load_stats: "正在加载Codeforces提交数据...",
  wb_step_2_estimate: "正在计算预估Rating...",
  wb_step_3_weak_tags: "正在分析薄弱标签...",
  wb_step_4_pool: "正在筛选本地题目...",
  wb_step_5_generate: "正在生成复习计划...",
  wb_step_6_aggregate: "复习计划生成完成",
};

const TOOL_NAMES = {
  snapshot: "cf.user.snapshot.read",
  candidates: "cf.problem.candidates.read",
  wrongbook: "cf.wrongbook.read",
} as const;

// ---------------------------------------------------------------------------
// Orchestrator implementation
// ---------------------------------------------------------------------------

export class DeterministicRoutingOrchestrator implements AgentOrchestrator {
  private readonly deps: DeterministicOrchestratorDeps;
  private cancelledRuns = new Set<RunId>();
  private eventSeq = 0;

  constructor(deps: DeterministicOrchestratorDeps) {
    this.deps = deps;
  }

  // ---------------------------------------------------------
  // Plan
  // ---------------------------------------------------------

  async plan(request: AgentRequest): Promise<AgentPlan> {
    if (!this.deps.featureEnabled()) {
      throw new OrchestratorError(OrchestratorErrorCode.FeatureDisabled, "学习分析功能尚未启用");
    }
    if (!SUPPORTED_INTENTS.has(request.intent)) {
      throw new OrchestratorError(OrchestratorErrorCode.UnsupportedIntent, `不支持的操作类型: ${request.intent}`);
    }
    if (!this.deps.isAuthenticated(request.userId)) {
      throw new OrchestratorError(OrchestratorErrorCode.NotLoggedIn, "请先登录");
    }

    const userId = request.userId!;
    const isWrongBook = request.intent === "cf.wrongbook.review";

    // For wrongbook.review: binding/sync/pool checks are optional (lower confidence allowed)
    if (!isWrongBook) {
      if (!(await this.deps.isCfBound(userId))) {
        throw new OrchestratorError(OrchestratorErrorCode.NotBound, "尚未绑定 Codeforces 账号，请先在个人中心绑定");
      }
      if (!(await this.deps.isCfSynced(userId))) {
        throw new OrchestratorError(OrchestratorErrorCode.NotSynced, "请先同步 Codeforces 数据");
      }
      if (!(await this.deps.hasLocalPool())) {
        throw new OrchestratorError(OrchestratorErrorCode.PoolEmpty, "本地精选题池为空，无法生成训练推荐");
      }
    }

    const isBound = await this.deps.isCfBound(userId);

    if (isWrongBook) {
      return {
        planId: `plan_${Date.now()}`,
        requestId: request.requestId,
        intent: {
          kind: "cf.wrongbook.review",
          description: "错题复习计划 v2 — estimateRating + 3区4类复习",
          confidence: isBound ? 1.0 : 0.6,
          suggestedAgentIds: ["orchestrator", "cf-data-collector", "cf-data-analyst", "cf-report-writer"],
        },
        steps: [
          { stepId: "wb_step_1_load_stats", agentId: "cf-data-collector", description: "加载CF提交数据", dependencies: [], expectedOutput: "CfProblemStat[]" },
          { stepId: "wb_step_2_estimate", agentId: "cf-data-analyst", description: "计算预估Rating和难度区间", dependencies: ["wb_step_1_load_stats"], expectedOutput: "EstimateRatingResult + Zones" },
          { stepId: "wb_step_3_weak_tags", agentId: "cf-data-analyst", description: "分析薄弱标签", dependencies: ["wb_step_1_load_stats"], expectedOutput: "FocusTags" },
          { stepId: "wb_step_4_pool", agentId: "cf-problem-recommender", description: "筛选本地精选题池", dependencies: [], expectedOutput: "LocalPool" },
          { stepId: "wb_step_5_generate", agentId: "cf-report-writer", description: "生成3区4类复习计划", dependencies: ["wb_step_2_estimate", "wb_step_3_weak_tags", "wb_step_4_pool"], expectedOutput: "ReviewReport" },
          { stepId: "wb_step_6_aggregate", agentId: "orchestrator", description: "聚合并返回前端", dependencies: ["wb_step_5_generate"], expectedOutput: "AggregatedAgentResult" },
        ],
        createdAt: new Date().toISOString(),
      };
    }

    // Default: cf.learning.analysis plan
    return {
      planId: `plan_${Date.now()}`,
      requestId: request.requestId,
      intent: {
        kind: "cf.learning.analysis",
        description: "Codeforces 学习分析 — 基于真实数据的确定性分析",
        confidence: 1.0,
        suggestedAgentIds: ["orchestrator", "cf-data-collector", "cf-data-analyst", "cf-problem-recommender", "cf-report-writer"],
      },
      steps: [
        { stepId: "step_1_read_snapshot", agentId: "cf-data-collector", description: "读取CF用户快照", dependencies: [], expectedOutput: "CodeforcesUserAnalysisSnapshot" },
        { stepId: "step_2_analyze", agentId: "cf-data-analyst", description: "分析训练数据", dependencies: ["step_1_read_snapshot"], expectedOutput: "ActivityAnalysis + WeakTags + RatingTrend" },
        { stepId: "step_3_query_candidates", agentId: "cf-problem-recommender", description: "查询训练候选题", dependencies: ["step_1_read_snapshot"], expectedOutput: "CandidateProblemList" },
        { stepId: "step_4_generate_report", agentId: "cf-report-writer", description: "生成结构化报告", dependencies: ["step_2_analyze", "step_3_query_candidates"], expectedOutput: "CfLearningAgentReport" },
        { stepId: "step_5_aggregate", agentId: "orchestrator", description: "聚合并返回前端", dependencies: ["step_4_generate_report"], expectedOutput: "AggregatedAgentResult" },
      ],
      createdAt: new Date().toISOString(),
    };
  }

  // ---------------------------------------------------------
  // Execute
  // ---------------------------------------------------------

  async *execute(plan: AgentPlan): AsyncIterable<AgentEvent> {
    const runId: RunId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    // Store userId as internal context
    const userId = (plan as unknown as { _userId?: string })._userId as string | undefined;

    this.eventSeq = 0;
    yield this.next(runId, createRunStartedEvent(runId, {
      status: ES.Running,
    }));

    const results = new Map<string, unknown>();
    const taskResults: AgentResult[] = [];

    for (const step of plan.steps) {
      if (this.cancelledRuns.has(runId)) break;

      const taskId: TaskId = `task_${step.stepId}_${runId}`;

      // Yield progress
      const msg = PROGRESS_MESSAGES[step.stepId] ?? step.description;
      yield this.next(runId, createAgentProgressEvent(runId, step.agentId, {
        message: msg,
        progress: 0,
      }));

      yield this.next(runId, createTaskCreatedEvent(runId, step.agentId, taskId, {
        intent: step.description,
        priority: AgentTaskPriority.Normal,
      }));
      yield this.next(runId, createTaskStartedEvent(runId, step.agentId, taskId));

      try {
        const result = await this.doStep(step, results, userId, runId);
        results.set(step.stepId, result);

        yield this.next(runId, createTaskCompletedEvent(runId, step.agentId, taskId, {
          status: TS.Completed,
          summary: step.expectedOutput,
        }));

        taskResults.push({ agentId: step.agentId, taskId, status: TS.Completed, summary: step.description, completedAt: new Date().toISOString() });
      } catch (err) {
        const msg2 = err instanceof Error ? err.message : String(err);
        yield this.next(runId, createTaskFailedEvent(runId, step.agentId, taskId, {
          status: TS.Failed,
          failure: {
            code: OrchestratorErrorCode.InternalError,
            message: msg2,
            retryable: false,
          },
        }));
        taskResults.push({ agentId: step.agentId, taskId, status: TS.Failed, summary: `失败: ${msg2}`, completedAt: new Date().toISOString() });
        yield this.next(runId, createRunFailedEvent(runId, {
          reason: `步骤 "${step.description}" 执行失败: ${msg2}`, completedSteps: taskResults.length,
        }));
        return;
      }
    }

    const completedCount = taskResults.filter((r) => r.status === TS.Completed).length;
    yield this.next(runId, createRunCompletedEvent(runId, {
      totalSteps: plan.steps.length, completedSteps: completedCount,
      result: "Codeforces 学习分析完成",
    }));
  }

  // ---------------------------------------------------------
  // Step execution
  // ---------------------------------------------------------

  private async doStep(
    step: AgentPlanStep,
    results: Map<string, unknown>,
    userId: string | undefined,
    runId: RunId,
  ): Promise<unknown> {
    switch (step.stepId) {
      case "step_1_read_snapshot": {
        const ctx = this.toolCtx(step.agentId, runId, userId);
        const { result, events } = await this.deps.toolExecutor.execute(TOOL_NAMES.snapshot, {
          accountId: (results.get("_accountId") as string) ?? "",
          userId: userId ?? "",
        }, ctx);
        if (result.status !== "success") throw new Error(`工具执行失败: ${result.safeSummary}`);
        return result.data;
      }
      case "step_2_analyze": {
        const snapshot = results.get("step_1_read_snapshot");
        const mod = await import("../cf-analysis/cf-learning-analysis.ts");
        return mod.analyzeCodeforcesLearningProfile(snapshot as Parameters<typeof mod.analyzeCodeforcesLearningProfile>[0]);
      }
      case "step_3_query_candidates": {
        const ctx = this.toolCtx(step.agentId, runId, userId);
        const { result } = await this.deps.toolExecutor.execute(TOOL_NAMES.candidates, {
          userId: userId ?? "",
          minRating: 800,
          maxRating: 3500,
          limit: 30,
        }, ctx);
        if (result.status !== "success") throw new Error(`工具执行失败: ${result.safeSummary}`);
        return result.data;
      }
      case "step_4_generate_report": {
        return this.buildReport(
          results.get("step_1_read_snapshot"),
          results.get("step_2_analyze"),
          results.get("step_3_query_candidates"),
        );
      }
      case "step_5_aggregate": {
        return results.get("step_4_generate_report");
      }
      // ---- Wrong book review steps (v2) ----
      case "wb_step_1_load_stats": {
        // Stats loaded externally by server action; pass through
        return results.get("_allStats") ?? [];
      }
      case "wb_step_2_estimate": {
        const stats = normalizeCfProblemStats(results.get("wb_step_1_load_stats"));
        const account = results.get("_account") as Record<string, unknown> | null;
        const mod = await import("../cf-analysis/cf-rating-estimator.ts");
        return mod.estimateUserRating({
          currentRating: normalizeNullableNumber(account?.currentRating),
          maxRating: normalizeNullableNumber(account?.maxRating),
          ratingHistory: [],
          problemStats: stats,
          lastOnlineAt: normalizeNullableString(account?.lastOnlineAt),
        });
      }
      case "wb_step_3_weak_tags": {
        const stats = results.get("wb_step_1_load_stats") ?? [];
        const mod = await import("../cf-analysis/cf-wrongbook-review.ts");
        return mod.computeWeakTags(stats as Parameters<typeof mod.computeWeakTags>[0]);
      }
      case "wb_step_4_pool": {
        // Pool loaded externally; pass through
        return results.get("_localPool") ?? [];
      }
      case "wb_step_5_generate": {
        const est = results.get("wb_step_2_estimate") as Record<string, unknown>;
        const method = normalizeEstimationMethod(est?.modelType);
        const isUnrated = method === "unrated";
        const mod = await import("../cf-analysis/cf-wrongbook-review.ts");
        const estimatedRating = normalizeNumber(est?.estimatedRating, 800);
        const zones = mod.computeRatingZones(estimatedRating, isUnrated);
        const planResult = mod.generateReviewPlan({
          estimatedRating,
          isUnrated,
          zones,
          allStats: normalizeCfProblemStats(results.get("wb_step_1_load_stats")),
          weakTags: (results.get("wb_step_3_weak_tags") ?? []) as Parameters<typeof mod.generateReviewPlan>[0]["weakTags"],
          localPool: (results.get("wb_step_4_pool") ?? []) as Parameters<typeof mod.generateReviewPlan>[0]["localPool"],
        });
        return mod.buildReviewReport({
          estimatedRating,
          estimationMethod: method,
          zones,
          allStats: normalizeCfProblemStats(results.get("wb_step_1_load_stats")),
          focusTags: (results.get("wb_step_3_weak_tags") ?? []) as Parameters<typeof mod.buildReviewReport>[0]["focusTags"],
          recommendations: planResult.recommendations,
          reviewAdvice: planResult.reviewAdvice,
          hasCfBinding: true,
          additionalWarnings: planResult.warnings,
        });
      }
      case "wb_step_6_aggregate": {
        return results.get("wb_step_5_generate");
      }
      default:
        throw new Error(`Unknown step: ${step.stepId}`);
    }
  }

  // ---------------------------------------------------------
  // Report building (deterministic, no LLM)
  // ---------------------------------------------------------

  private async buildReport(
    snapshot: unknown,
    analysis: unknown,
    candidates: unknown,
  ): Promise<unknown> {
    const anal = analysis as Record<string, unknown> | undefined;
    const cand = candidates as { candidates?: Array<Record<string, unknown>>; querySummary?: Record<string, unknown> } | undefined;
    const snap = snapshot as Record<string, unknown> | undefined;

    if (!anal || !snap) throw new Error("分析数据不完整");

    const profile = (snap.profile ?? {}) as Record<string, unknown>;
    const dataQuality = anal.dataQuality as Record<string, unknown> | undefined;
    const activity = anal.activity as Record<string, unknown> | undefined;
    const ratingTrend = anal.ratingTrend as string;
    const weakTags = normalizeLearningWeakTags(anal.weakTags);
    const ratingPlan = anal.ratingPlan as Record<string, unknown> | undefined;

    const solvedKeys = new Set((anal.solvedProblemKeys ?? []) as string[]);
    const candidateList = normalizeTrainingCandidates(cand?.candidates);
    const unfinishedKeys = (anal.unfinishedProblemKeys ?? []) as string[];

    // Generate training plan
    const { generateTrainingPlan } = await import("../cf-analysis/cf-training-plan.ts");

    const unfinished = candidateList.filter((c) =>
      unfinishedKeys.includes(String(c.problemKey ?? "")));

    const { recommendations, warnings } = generateTrainingPlan({
      warmupCandidates: candidateList,
      weakTagCandidates: candidateList,
      challengeCandidates: candidateList,
      unfinishedCandidates: unfinished,
      weakTags,
      solvedProblemKeys: solvedKeys,
    });

    const totals = (snap.totals ?? {}) as Record<string, unknown>;

    return {
      generatedAt: new Date().toISOString(),
      profileSummary: {
        handle: profile.handle ?? "unknown",
        currentRating: profile.currentRating ?? null,
        maxRating: profile.maxRating ?? null,
        recentActivityStatus: profile.lastSubmissionAt ? "active" : "inactive",
      },
      activity: {
        daysSinceLastSubmission: activity?.daysSinceLastSubmission ?? null,
        submissionsLast7Days: activity?.submissionsLast7Days ?? 0,
        submissionsLast30Days: activity?.submissionsLast30Days ?? 0,
        solvedLast30Days: activity?.solvedLast30Days ?? 0,
        reminderLevel: activity?.reminderLevel ?? "restart",
      },
      progress: {
        attemptedProblems: (totals.attemptedProblems ?? 0) as number,
        solvedProblems: (totals.solvedProblems ?? 0) as number,
        unfinishedProblems: (totals.unfinishedProblems ?? 0) as number,
        ratingTrend: ratingTrend as "up" | "stable" | "down" | "insufficient",
      },
      weakTags,
      ratingPlan,
      recommendations,
      dataQuality: {
        confidence: (dataQuality?.confidence ?? "medium") as "high" | "medium" | "low",
        truncated: (dataQuality?.truncated ?? false) as boolean,
        warnings: [...((dataQuality?.warnings ?? []) as string[]), ...warnings],
      },
    };
  }

  // ---------------------------------------------------------
  // Cancel
  // ---------------------------------------------------------

  async cancel(runId: RunId): Promise<void> {
    this.cancelledRuns.add(runId);
  }

  // ---------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------

  private toolCtx(agentId: AgentId, runId: RunId, userId?: string) {
    return { agentId, runId, userId, isAuthenticated: !!userId, isUserAuthorized: true };
  }

  private next(runId: RunId, event: AgentEvent): AgentEvent {
    this.eventSeq++;
    return { ...event, sequence: this.eventSeq, runId, timestamp: event.timestamp ?? new Date().toISOString() };
  }
}

function normalizeCfProblemStats(value: unknown): CfProblemStat[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord).map((item) => ({
    problemKey: normalizeString(item.problemKey, ""),
    contestId: normalizeNumber(item.contestId, 0),
    index: normalizeString(item.index, ""),
    name: normalizeString(item.name, normalizeString(item.problemKey, "")),
    rating: normalizeNullableNumber(item.rating),
    tags: normalizeStringArray(item.tags),
    attempts: normalizeNumber(item.attempts, 0),
    accepted: item.accepted === true,
    firstAcceptedAt: normalizeNullableString(item.firstAcceptedAt),
    lastSubmittedAt: normalizeNullableString(item.lastSubmittedAt),
    lastVerdict: normalizeNullableString(item.lastVerdict),
  })).filter((item) => item.problemKey.length > 0);
}

function normalizeTrainingCandidates(value: unknown): CodeforcesAgentCandidate[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord).map((item) => ({
    problemKey: normalizeString(item.problemKey, ""),
    name: normalizeString(item.name, normalizeString(item.problemKey, "")),
    rating: normalizeNumber(item.rating, 800),
    tags: normalizeStringArray(item.tags),
    originalUrl: normalizeString(item.originalUrl, ""),
    solvedCount: normalizeNullableNumber(item.solvedCount) ?? undefined,
  })).filter((item) => item.problemKey.length > 0);
}

function normalizeLearningWeakTags(value: unknown): Array<{
  readonly tag: string;
  readonly attempted: number;
  readonly solved: number;
  readonly completionRate: number | null;
  readonly evidenceLevel: "high" | "medium" | "low";
  readonly reasonCodes: readonly string[];
}> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord).map((item) => ({
    tag: normalizeString(item.tag, ""),
    attempted: normalizeNumber(item.attempted, 0),
    solved: normalizeNumber(item.solved, 0),
    completionRate: normalizeNullableNumber(item.completionRate),
    evidenceLevel: normalizeEvidenceLevel(item.evidenceLevel),
    reasonCodes: normalizeStringArray(item.reasonCodes),
  })).filter((item) => item.tag.length > 0);
}

function normalizeEstimationMethod(value: unknown): "rated" | "unrated" {
  return value === "rated" ? "rated" : "unrated";
}

function normalizeEvidenceLevel(value: unknown): "high" | "medium" | "low" {
  if (value === "high" || value === "medium" || value === "low") {
    return value;
  }
  return "low";
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function normalizeString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function normalizeNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
