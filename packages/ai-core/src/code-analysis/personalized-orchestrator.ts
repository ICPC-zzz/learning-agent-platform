/**
 * A492 — Personalized Code Analysis Orchestrator
 *
 * Fixed 8-step multi-agent workflow:
 *   1. Validate input
 *   2. Optionally refresh CF data
 *   3. ProblemProfileAgent (parallel-safe with LearnerProfileAgent)
 *   4. LearnerProfileAgent (deterministic, no LLM)
 *   5. CodeDebugAgent (A491 + personalization context)
 *   6. LearningAdviceAgent (aggregation + difficulty match + candidates)
 *   7. Validate final report
 *   8. Aggregate output
 *
 * Maximum: 8 tool calls, 3 model calls, 12 total steps, 120s timeout.
 *
 * STALE CONTEXT GUARD: This orchestrator NEVER injects old analysis results
 * or historical reports into the model context. Each analysis is independent
 * and only uses current CF data (via cache with 5-min TTL). User skill levels
 * change over time, so past analyses are irrelevant to current ones.
 */
import type { CodeAnalysisResult } from "./types.ts";
import { runCodeAnalysisWorkflow } from "./analysis-workflow.ts";
import type {
  PersonalizedCodeAnalysisInput,
  ProblemProfile,
  LearnerProfileContext,
  DifficultyFit,
  WeakTagMatch,
  CodeAnalysisPersonalization,
  CandidateProblem,
  A492PersonalizedReport,
  A492PersonalizedResult,
  A492AgentEvent,
  A492AgentTimeline,
  A492AgentEventStep,
} from "./a492-types.ts";
import { CF_RATING_MIN, CF_RATING_MAX, MAX_CANDIDATE_PROBLEMS } from "./a492-types.ts";
import { compareProblemDifficultyToLearner, matchProblemTagsToWeakTags } from "./difficulty-fit.ts";
import type {
  CfSnapshotOutput,
  CfEstimatedRatingOutput,
  CfWeakTagsOutput,
  CfReviewPlanOutput,
  CfCandidatesInput,
  CfCandidatesOutput,
  CfRefreshOutput,
} from "./tools/cf-user-tools.ts";

// ---------------------------------------------------------------------------
// Agent Context (immutable, injected by orchestrator)
// ---------------------------------------------------------------------------

export interface AgentDeps {
  /** User ID from session */
  userId: string;

  /** CF Snapshot tool */
  getCfSnapshot?: (userId: string) => Promise<CfSnapshotOutput | null>;

  /** Estimated rating tool */
  getEstimatedRating?: (userId: string) => Promise<CfEstimatedRatingOutput>;

  /** Weak tags tool */
  getWeakTags?: (userId: string) => Promise<CfWeakTagsOutput>;

  /** Review plan tool */
  getReviewPlan?: (userId: string) => Promise<CfReviewPlanOutput>;

  /** Problem candidates tool */
  getCandidates?: (userId: string, input: CfCandidatesInput) => Promise<CfCandidatesOutput>;

  /** CF refresh (heavily restricted) */
  refreshCfData?: (userId: string) => Promise<CfRefreshOutput>;

  /** Problem profiling via LLM */
  profileProblem?: (input: {
    problemStatement: string;
    code?: string;
    userProvidedRating?: number;
    userProvidedTags?: string[];
  }) => Promise<ProblemProfile>;

  /** Model info for display */
  modelInfo?: {
    providerName: string;
    modelDisplayName: string;
    usageType: string;
    isFallback: boolean;
  };

  /** Progress reporter (called before each phase) */
  reportProgress?: (phase: string, index: number, total: number) => void;
}

// ---------------------------------------------------------------------------
// Orchestrator Config
// ---------------------------------------------------------------------------

const MAX_TOTAL_STEPS = 16;
const MAX_MODEL_CALLS = 3;
const MAX_TOOL_CALLS = 8;
const MAX_TIMEOUT_MS = 180_000;

// ---------------------------------------------------------------------------
// Main Entry Point
// ---------------------------------------------------------------------------

export async function runPersonalizedCodeAnalysis(
  input: PersonalizedCodeAnalysisInput,
  deps: AgentDeps,
): Promise<A492PersonalizedResult> {
  const events: A492AgentEvent[] = [];
  const startTime = Date.now();
  let modelCallCount = 0;
  let toolCallCount = 0;
  const seenSteps = new Set<string>();

  const pushEvent = (
    step: A492AgentEventStep,
    agentId: string,
    status: A492AgentEvent["status"],
    summary: string,
    metadata?: A492AgentEvent["metadata"],
  ) => {
    // Count step boundaries, not individual events (each step can emit multiple events)
    if (status === "running" && !seenSteps.has(step)) {
      seenSteps.add(step);
      if (seenSteps.size > MAX_TOTAL_STEPS) {
        throw new Error(`Exceeded maximum steps (${MAX_TOTAL_STEPS})`);
      }
    }
    // Also check timeout per event
    checkTimeout();
    events.push({
      step,
      agentId,
      status,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      summary,
      metadata,
    });
  };

  const checkTimeout = () => {
    if (Date.now() - startTime > MAX_TIMEOUT_MS) {
      throw new Error("Analysis timeout exceeded");
    }
  };

  try {
    // =====================================================================
    // Step 1: Validate input
    // =====================================================================
    deps.reportProgress?.("校验输入", 1, 7);
    pushEvent("orchestrator_create_plan", "orchestrator", "running", "创建个性化学习分析计划");

    // Sanitize rating
    const rating = input.userProvidedRating;
    if (rating !== undefined && (rating < CF_RATING_MIN || rating > CF_RATING_MAX)) {
      return makeA492Error("INVALID_RATING", `题目 Rating 必须在 ${CF_RATING_MIN}～${CF_RATING_MAX} 之间`, events, startTime, modelCallCount, toolCallCount, deps.modelInfo ?? null);
    }

    // Sanitize tags: dedupe, normalize, limit
    const userTags = (input.userProvidedTags ?? [])
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0 && t.length <= 50)
      .slice(0, 10);

    const hasCfProfile = input.enableCfProfile && deps.getCfSnapshot !== undefined;

    pushEvent("orchestrator_create_plan", "orchestrator", "completed",
      `计划: ProblemProfile → CodeDebug → ${hasCfProfile ? "LearnerProfile → " : ""}LearningAdvice`,
    );

    // =====================================================================
    // Step 2: ProblemProfileAgent (user rating or rule estimate first; short model enrichment when available)
    // =====================================================================
    deps.reportProgress?.("分析题目画像", 2, 7);
    pushEvent("problem_profile_agent", "problem-profiler", "running", "分析题目难度与标签");

    let problemProfile: ProblemProfile;
    try {
      problemProfile = await (deps.profileProblem?.({
        problemStatement: input.problemStatement,
        code: input.sourceCode,
        userProvidedRating: rating,
        userProvidedTags: userTags.length > 0 ? userTags : undefined,
      }) ?? Promise.resolve(makeDefaultProblemProfile(rating, userTags)));

      if (deps.profileProblem && rating === undefined) {
        modelCallCount++;
        if (modelCallCount > MAX_MODEL_CALLS) throw new Error("Exceeded max model calls");
      }

      pushEvent("problem_profile_agent", "problem-profiler", "completed",
        `Rating: ${problemProfile.rating.value ?? "未知"} (${problemProfile.rating.source === "user_provided" ? "用户填写" : problemProfile.rating.source === "model_inferred" ? "模型推断" : problemProfile.rating.source === "rule_estimated" ? "规则估算" : "未推断"}), 置信度: ${Math.round(problemProfile.rating.confidence * 100)}%` +
        (problemProfile.tags.length > 0 ? `, 标签: ${problemProfile.tags.map(function(t) { return t.tag; }).join(", ")}` : ""),
        { toolName: "cf.problem.rating.estimate", confidence: problemProfile.rating.confidence }
      );
    } catch (err: unknown) {
      pushEvent("problem_profile_agent", "problem-profiler", "failed",
        `题目画像失败: ${err instanceof Error ? err.message : String(err)}`);
      problemProfile = makeDefaultProblemProfile(rating, userTags);
    }

    checkTimeout();

    // =====================================================================
    // Step 3: CodeDebugAgent (A491 code analysis — the heavy work)
    // =====================================================================
    deps.reportProgress?.("分析代码（最耗时）", 3, 7);
    pushEvent("code_debug_agent", "code-debugger", "running", "分析代码复杂度、Bug 和修改建议");

    let codeResult: CodeAnalysisResult;
    try {
      codeResult = await runCodeAnalysisWorkflow(
        { problemStatement: input.problemStatement, sourceCode: input.sourceCode, selectedLanguage: input.selectedLanguage as any, errorInfo: input.errorInfo, testInput: input.testInput, actualOutput: input.actualOutput, expectedOutput: input.expectedOutput, failedCases: input.failedCases },
        input.userId,
      );
      modelCallCount += codeResult.timeline.modelCallCount;
      if (modelCallCount > MAX_MODEL_CALLS) throw new Error("Exceeded max model calls");

      pushEvent("code_debug_agent", "code-debugger", codeResult.success ? "completed" : "failed",
        codeResult.success ? `发现 ${codeResult.report?.findings.length ?? 0} 个问题` : `代码分析失败: ${codeResult.error?.safeMessage ?? "unknown"}`);
    } catch (err: unknown) {
      pushEvent("code_debug_agent", "code-debugger", "failed", `代码分析异常: ${err instanceof Error ? err.message : String(err)}`);
      codeResult = { success: false, report: null, timeline: { events: [], totalDurationMs: 0, modelCallCount: 0, hadFormatRepair: false }, error: { code: "UNKNOWN_ERROR" as any, safeMessage: "代码分析异常", retryable: false }, modelInfo: null };
    }

    checkTimeout();

    // =====================================================================
    // Step 4: LearnerProfileAgent (fetch CF data AFTER analysis is done)
    // =====================================================================
    let learnerProfile: LearnerProfileContext | null = null;

    if (hasCfProfile) {
      deps.reportProgress?.("读取学习画像", 4, 7);

      // CF refresh first if requested (so we get fresh data)
      if (input.refreshCfData && deps.refreshCfData) {
        pushEvent("cf_tool_refresh", "learner-profiler", "running", "刷新 Codeforces 数据");
        toolCallCount++;
        try {
          if (toolCallCount > MAX_TOOL_CALLS) throw new Error("Exceeded max tool calls");
          var refreshResult = await deps.refreshCfData(input.userId);
          pushEvent("cf_tool_refresh", "learner-profiler", refreshResult.success ? "completed" : "failed", refreshResult.message);
        } catch (err: unknown) {
          pushEvent("cf_tool_refresh", "learner-profiler", "failed", "CF 刷新失败: " + (err instanceof Error ? err.message : String(err)));
        }
      }

      // Now fetch the learner profile (from DB, uses fresh data if refresh succeeded)
      pushEvent("learner_profile_agent", "learner-profiler", "running", "读取用户学习画像");
      try {
        var toolStepsSeen = new Set<string>();
        learnerProfile = await buildLearnerProfile(input.userId, deps, function(step, status, summary) {
          if (status === "completed" && !toolStepsSeen.has(step)) { toolStepsSeen.add(step); toolCallCount++; if (toolCallCount > MAX_TOOL_CALLS) throw new Error("Exceeded max tool calls"); }
          pushEvent(step as A492AgentEventStep, "learner-profiler", status, summary);
          checkTimeout();
        });
        pushEvent("learner_profile_agent", "learner-profiler", "completed",
          `用户名: ${learnerProfile.handle ?? "unknown"}, Rating: ${learnerProfile.estimatedRating ?? "unknown"}, 薄弱标签: ${learnerProfile.weakTags.length}个`);
      } catch (err: unknown) {
        pushEvent("learner_profile_agent", "learner-profiler", "failed", `用户画像失败: ${err instanceof Error ? err.message : String(err)}`);
        learnerProfile = null;
      }
    } else {
      pushEvent("learner_profile_agent", "learner-profiler", "skipped", "未启用 CF 学习画像");
    }

    checkTimeout();

    // =====================================================================
    // Step 5: LearningAdviceAgent
    // =====================================================================
    deps.reportProgress?.("生成学习建议", 5, 7);
    pushEvent("learning_advice_agent", "learning-advisor", "running", "生成个性化学习建议");

    let difficultyFit: DifficultyFit | null = null;
    let weakTagMatch: WeakTagMatch | null = null;
    let personalization: CodeAnalysisPersonalization | null = null;
    let candidateProblems: CandidateProblem[] | null = null;

    if (learnerProfile) {
      // Compute difficulty fit (deterministic)
      difficultyFit = compareProblemDifficultyToLearner(problemProfile, learnerProfile);

      // Compute weak tag match (deterministic)
      weakTagMatch = matchProblemTagsToWeakTags(problemProfile, learnerProfile.weakTags);

      // Build personalization
      const observations = buildLearnerObservations(problemProfile, learnerProfile, difficultyFit, weakTagMatch, codeResult);
      personalization = {
        difficultyFit,
        weakTagMatch,
        learnerSpecificObservations: observations,
        learningAdvice: [...difficultyFit.advice, ...weakTagMatch.recommendations],
      };

      // Step 6b: Optional candidate problems
      if (input.recommendFollowUp && deps.getCandidates) {
        pushEvent("cf_tool_candidates", "learning-advisor", "running", "查询后续训练题");
        toolCallCount++;
        try {
          const candidatesResult = await queryFollowUpCandidates(
            input.userId, problemProfile, learnerProfile, deps.getCandidates,
          );
          candidateProblems = candidatesResult;
          pushEvent("cf_tool_candidates", "learning-advisor", "completed",
            `推荐 ${candidateProblems.length} 道后续训练题`);
        } catch (err: unknown) {
          pushEvent("cf_tool_candidates", "learning-advisor", "failed",
            `候选推荐失败: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    } else {
      // No learner profile — generate generic personalization
      personalization = {
        difficultyFit: {
          status: "unknown",
          ratingDifference: null,
          confidence: 0,
          reasonCodes: ["no_learner_profile"],
          advice: ["未启用 Codeforces 学习画像，无法提供个性化建议"],
        },
        weakTagMatch: {
          matchedTags: [],
          unmatchedProblemTags: problemProfile.tags.map((t) => t.tag),
          confidence: 0,
          recommendations: ["绑定 Codeforces 账号后可获得个性化薄弱标签分析和训练建议"],
        },
        learnerSpecificObservations: [],
        learningAdvice: ["绑定 Codeforces 账号后可获得个性化学习建议"],
      };
    }

    pushEvent("learning_advice_agent", "learning-advisor", "completed",
      `难度: ${difficultyFit?.status ?? "unknown"}, 薄弱标签命中: ${weakTagMatch?.matchedTags.length ?? 0}`);

    checkTimeout();

    // =====================================================================
    // Step 7: Validate final report
    // =====================================================================
    deps.reportProgress?.("验证报告", 6, 7);
    pushEvent("orchestrator_validate", "orchestrator", "running", "验证最终报告完整性");

    if (!codeResult.report) {
      pushEvent("orchestrator_validate", "orchestrator", "completed",
        "代码分析未产出报告（可能超时），继续输出其它画像数据");
      // Continue — still useful to show problem profile + learner profile + personalization
    } else {
      pushEvent("orchestrator_validate", "orchestrator", "completed", "报告验证通过");
    }

    // =====================================================================
    // Step 8: Aggregate
    // =====================================================================
    pushEvent("orchestrator_aggregate", "orchestrator", "running", "聚合分析结果");

    const evidenceSummary = computeEvidenceSummary(problemProfile, learnerProfile, personalization);

    const report: A492PersonalizedReport = {
      baseReport: codeResult.report,
      problemProfile,
      learnerProfile,
      difficultyFit,
      weakTagMatch,
      personalization,
      candidateProblems,
      evidenceSummary,
    };

    pushEvent("orchestrator_aggregate", "orchestrator", "completed", "报告生成完成");

    return {
      success: true,
      report,
      timeline: buildTimeline(events, startTime, modelCallCount, toolCallCount),
      error: null,
      modelInfo: deps.modelInfo ?? null,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return makeA492Error("INTERNAL_ERROR", message, events, startTime, modelCallCount, toolCallCount, deps.modelInfo ?? null);
  }
}

// ---------------------------------------------------------------------------
// Learner Profile Builder (deterministic tool composition)
// ---------------------------------------------------------------------------

async function buildLearnerProfile(
  userId: string,
  deps: AgentDeps,
  onEvent: (step: string, status: A492AgentEvent["status"], summary: string) => void,
): Promise<LearnerProfileContext> {
  let snapshot: CfSnapshotOutput | null = null;
  let estimatedRating: CfEstimatedRatingOutput | null = null;
  let weakTags: CfWeakTagsOutput | null = null;
  let reviewPlan: CfReviewPlanOutput | null = null;

  // Tool: cf.user.snapshot.read
  onEvent("cf_tool_snapshot", "running", "读取 CF 快照");
  try {
    snapshot = await (deps.getCfSnapshot?.(userId) ?? null);
    onEvent("cf_tool_snapshot", snapshot ? "completed" : "failed",
      snapshot ? `Handle: ${snapshot.handle}, Rating: ${snapshot.currentRating ?? "unrated"}` : "快照不存在");
  } catch (err: unknown) {
    onEvent("cf_tool_snapshot", "failed", `快照错误: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Tool: cf.user.estimated-rating.read
  onEvent("cf_tool_rating", "running", "读取预估 Rating");
  try {
    estimatedRating = await (deps.getEstimatedRating?.(userId) ?? null);
    onEvent("cf_tool_rating", estimatedRating ? "completed" : "failed",
      estimatedRating ? `预估: ${estimatedRating.estimatedRating} (置信度: ${estimatedRating.confidence})` : "Rating 不可用");
  } catch (err: unknown) {
    onEvent("cf_tool_rating", "failed", `Rating 错误: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Tool: cf.user.weak-tags.read
  onEvent("cf_tool_weak_tags", "running", "读取薄弱标签");
  try {
    weakTags = await (deps.getWeakTags?.(userId) ?? null);
    onEvent("cf_tool_weak_tags", weakTags ? "completed" : "failed",
      weakTags ? `${weakTags.weakTags.length} 个薄弱标签` : "弱标签不可用");
  } catch (err: unknown) {
    onEvent("cf_tool_weak_tags", "failed", `弱标签错误: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Tool: cf.user.review-plan.read
  onEvent("cf_tool_review_plan", "running", "读取复习计划");
  try {
    reviewPlan = await (deps.getReviewPlan?.(userId) ?? null);
    onEvent("cf_tool_review_plan", reviewPlan ? "completed" : "failed",
      reviewPlan ? `${reviewPlan.focusTags.length} 个重点标签` : "复习计划不可用");
  } catch (err: unknown) {
    onEvent("cf_tool_review_plan", "failed", `复习计划错误: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Compose LearnerProfileContext
  const solvedProblemKeys: string[] = [];
  // Solved keys are internal — not exposed to model
  // We track them only for candidate exclusion

  return {
    handle: snapshot?.handle ?? null,
    estimatedRating: estimatedRating?.estimatedRating ?? null,
    ratingConfidence: estimatedRating?.confidence ?? 0,
    officialRating: snapshot?.currentRating ?? null,
    weakTags: (weakTags?.weakTags ?? []).map((w) => ({
      tag: w.tag,
      attempted: w.attempted,
      solved: w.solved,
      completionRate: w.completionRate,
      averageAttempts: w.averageAttempts,
      averageRating: w.averageRating,
      evidenceLevel: (w.evidenceLevel === "sufficient"
        ? "strong" : w.evidenceLevel === "limited" ? "moderate" : "weak") as "strong" | "moderate" | "weak",
      reasonCodes: w.reasonCodes,
    })),
    reviewFocusTags: reviewPlan?.focusTags ?? [],
    recentActivity: snapshot?.activityTrend ?? "unknown",
    solvedProblemKeys,
    dataQuality: snapshot?.dataQuality?.warnings ?? [],
    lastSyncedAt: null,
  };
}

// ---------------------------------------------------------------------------
// Follow-up Candidates Query
// ---------------------------------------------------------------------------

async function queryFollowUpCandidates(
  userId: string,
  problemProfile: ProblemProfile,
  learnerProfile: LearnerProfileContext,
  getCandidates: (userId: string, input: CfCandidatesInput) => Promise<CfCandidatesOutput>,
): Promise<CandidateProblem[]> {
  const problemRating = problemProfile.rating.value;
  const learnerRating = learnerProfile.estimatedRating;
  const weakTagNames = learnerProfile.weakTags.map((w) => w.tag);
  const problemTagNames = problemProfile.tags.map((t) => t.tag);
  const queryTags = [...new Set([...problemTagNames, ...weakTagNames])].slice(0, 5);
  const baseRating = clampRatingToCf(learnerRating ?? problemRating ?? 1200);

  const tiers = [
    {
      suggestionType: "prerequisite" as const,
      ratingMin: clampRatingToCf(baseRating - 200),
      ratingMax: clampRatingToCf(baseRating),
      targetRating: clampRatingToCf(baseRating - 100),
      reason: "相似标签热身题，难度略低于当前预估水平。",
    },
    {
      suggestionType: "same_tag_practice" as const,
      ratingMin: clampRatingToCf(baseRating),
      ratingMax: clampRatingToCf(baseRating + 200),
      targetRating: clampRatingToCf(baseRating + 100),
      reason: "相似标签主训练题，难度贴近当前预估水平。",
    },
    {
      suggestionType: "next_challenge" as const,
      ratingMin: clampRatingToCf(baseRating + 200),
      ratingMax: clampRatingToCf(baseRating + 400),
      targetRating: clampRatingToCf(baseRating + 300),
      reason: "相似标签挑战题，用于向下一档难度过渡。",
    },
  ];

  const picked: CandidateProblem[] = [];
  const usedKeys = new Set<string>();

  for (const tier of tiers) {
    const candidates = await queryTierCandidates(userId, getCandidates, {
      ratingMin: tier.ratingMin,
      ratingMax: tier.ratingMax,
      targetRating: tier.targetRating,
      tags: queryTags.length > 0 ? queryTags : undefined,
      limit: 8,
    });

    const candidate = candidates.find((c) => {
      const key = `${c.cfContestId}:${c.cfIndex}`;
      return !usedKeys.has(key) && c.cfContestId > 0 && c.cfIndex.length > 0;
    });

    if (!candidate) continue;

    usedKeys.add(`${candidate.cfContestId}:${candidate.cfIndex}`);
    picked.push({
      cfContestId: candidate.cfContestId,
      cfIndex: candidate.cfIndex,
      name: candidate.name,
      rating: candidate.rating,
      tags: candidate.tags,
      cfUrl: candidate.cfUrl,
      suggestionType: tier.suggestionType,
      suggestionReason: tier.reason,
    });
  }

  return picked.slice(0, MAX_CANDIDATE_PROBLEMS);
}

async function queryTierCandidates(
  userId: string,
  getCandidates: (userId: string, input: CfCandidatesInput) => Promise<CfCandidatesOutput>,
  input: CfCandidatesInput,
): Promise<CfCandidatesOutput["candidates"]> {
  const taggedResult = await getCandidates(userId, input);
  if (taggedResult.candidates.length > 0 || !input.tags || input.tags.length === 0) {
    return taggedResult.candidates;
  }

  const fallbackResult = await getCandidates(userId, { ...input, tags: undefined });
  return fallbackResult.candidates;
}

function clampRatingToCf(value: number): number {
  return Math.max(800, Math.min(3500, Math.round(value / 100) * 100));
}

// ---------------------------------------------------------------------------
// Learner-Specific Observations (deterministic)
// ---------------------------------------------------------------------------

function buildLearnerObservations(
  _problemProfile: ProblemProfile,
  learnerProfile: LearnerProfileContext,
  difficultyFit: DifficultyFit,
  weakTagMatch: WeakTagMatch,
  codeResult: CodeAnalysisResult,
): CodeAnalysisPersonalization["learnerSpecificObservations"] {
  const obs: CodeAnalysisPersonalization["learnerSpecificObservations"] = [];

  // Rating-based observations
  if (learnerProfile.estimatedRating !== null) {
    obs.push({
      observation: `用户预估 Codeforces Rating: ${learnerProfile.estimatedRating}（官方: ${learnerProfile.officialRating ?? "无"}）`,
      basis: "deterministic_statistic",
      confidence: learnerProfile.ratingConfidence,
    });
  }

  // Difficulty fit observation
  obs.push({
    observation: `难度适配: ${difficultyFit.status}（Rating 差距: ${difficultyFit.ratingDifference ?? "未知"}）`,
    basis: "deterministic_statistic",
    confidence: difficultyFit.confidence,
  });

  // Weak tag match
  if (weakTagMatch.matchedTags.length > 0) {
    obs.push({
      observation: `命中薄弱标签: ${weakTagMatch.matchedTags.join(", ")}`,
      basis: "deterministic_statistic",
      confidence: weakTagMatch.confidence,
    });
  }

  // Code quality observations
  if (codeResult.report) {
    const criticalFindings = codeResult.report.findings.filter((f) => f.severity === "critical" || f.severity === "high");
    if (criticalFindings.length > 0) {
      obs.push({
        observation: `代码存在 ${criticalFindings.length} 个严重/高优先级问题`,
        basis: "model_inference",
        confidence: 0.7,
      });
    }
  }

  return obs;
}

// ---------------------------------------------------------------------------
// Evidence Summary
// ---------------------------------------------------------------------------

function computeEvidenceSummary(
  problemProfile: ProblemProfile,
  learnerProfile: LearnerProfileContext | null,
  personalization: CodeAnalysisPersonalization | null,
): A492PersonalizedReport["evidenceSummary"] {
  let verifiedFactCount = 0;
  let deterministicStatisticCount = 0;
  let userProvidedCount = 0;
  let modelInferenceCount = 0;
  let needsRuntimeCount = 0;

  // Problem profile
  if (problemProfile.rating.source === "user_provided") userProvidedCount++;
  else if (problemProfile.rating.source === "model_inferred") modelInferenceCount++;
  else if (problemProfile.rating.source === "rule_estimated") deterministicStatisticCount++;
  for (const tag of problemProfile.tags) {
    if (tag.source === "user_provided") userProvidedCount++;
    else if (tag.source === "model_inferred") modelInferenceCount++;
    else if (tag.source === "rule_estimated") deterministicStatisticCount++;
  }

  // Learner profile
  if (learnerProfile) {
    deterministicStatisticCount += 4; // rating, weak tags, review plan, activity
  }

  // Personalization
  if (personalization) {
    for (const obs of personalization.learnerSpecificObservations) {
      if (obs.basis === "verified_fact") verifiedFactCount++;
      else if (obs.basis === "deterministic_statistic") deterministicStatisticCount++;
      else if (obs.basis === "user_provided") userProvidedCount++;
      else if (obs.basis === "model_inference") modelInferenceCount++;
      else if (obs.basis === "needs_runtime_verification") needsRuntimeCount++;
    }
  }

  return {
    verifiedFactCount,
    deterministicStatisticCount,
    userProvidedCount,
    modelInferenceCount,
    needsRuntimeCount,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDefaultProblemProfile(
  userRating?: number,
  userTags?: string[],
): ProblemProfile {
  return {
    rating: userRating !== undefined
      ? {
          value: userRating,
          range: null,
          source: "user_provided",
          confidence: 1.0,
          reasoning: ["用户手动填写"],
        }
      : {
          value: null,
          range: null,
          source: "unknown",
          confidence: 0,
          reasoning: [],
        },
    tags: (userTags ?? []).map((tag) => ({
      tag,
      source: "user_provided" as const,
      confidence: 1.0,
      evidence: ["用户手动填写"],
    })),
    problemType: [],
    requiredKnowledge: [],
    keyConstraints: [],
    uncertaintyWarnings: [],
  };
}

function buildTimeline(
  events: A492AgentEvent[],
  startTime: number,
  modelCallCount: number,
  toolCallCount: number,
): A492AgentTimeline {
  return {
    events,
    totalDurationMs: Date.now() - startTime,
    modelCallCount,
    toolCallCount,
  };
}

function makeA492Error(
  code: string,
  message: string,
  events: A492AgentEvent[],
  startTime: number,
  modelCallCount: number,
  toolCallCount: number,
  modelInfo: A492PersonalizedResult["modelInfo"],
): A492PersonalizedResult {
  return {
    success: false,
    report: null,
    timeline: buildTimeline(events, startTime, modelCallCount, toolCallCount),
    error: { code, safeMessage: message, retryable: ["MODEL_TIMEOUT", "NETWORK_ERROR"].includes(code) },
    modelInfo,
  };
}
