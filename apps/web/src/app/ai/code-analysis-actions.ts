"use server";

/**
 * Code Analysis Server Action (A491 + A492).
 *
 * Routes to:
 * - A491 base code analysis (when enableCfProfile is false/undefined)
 * - A492 personalized code analysis (when enableCfProfile is true)
 *
 * Auth-protected. Never persists code, problem text, prompts, or responses.
 */
import { readAssistantSession } from "../../lib/assistant/assistant-session.ts";
import {
  runCodeAnalysisWorkflow,
  validateCodeAnalysisInput,
  type CodeAnalysisResult,
} from "@learning-agent-platform/ai-core";
import { runPersonalizedCodeAnalysis, type AgentDeps } from "@learning-agent-platform/ai-core/code-analysis/personalized-orchestrator";
import type { A492PersonalizedResult } from "@learning-agent-platform/ai-core/code-analysis/a492-types";
import { resolveCodeAnalysisModel } from "@learning-agent-platform/ai-core/code-analysis/model-resolver";
import { profileProblem } from "@learning-agent-platform/ai-core/code-analysis/problem-profiling";

// CF tool dependencies (lazy-loaded, server-only)
import type {
  CfSnapshotOutput,
  CfEstimatedRatingOutput,
  CfWeakTagsOutput,
  CfReviewPlanOutput,
  CfCandidatesInput,
  CfCandidatesOutput,
  CfRefreshOutput,
} from "@learning-agent-platform/ai-core/code-analysis/tools/cf-user-tools";

// Auto-save analysis results to history
import { saveAnalysisResult } from "./analysis-history-actions.ts";
import { setAnalysisProgress, clearAnalysisProgress } from "./analysis-progress-actions.ts";

// Rate limiting
const cooldownMap = new Map<string, number>();
const COOLDOWN_MS = 3000;

export async function runCodeAnalysisAction(
  input: {
    problemStatement: string;
    sourceCode: string;
    selectedLanguage: string;
    errorInfo?: string;
    testInput?: string;
    actualOutput?: string;
    expectedOutput?: string;
    failedCases?: string;
    /** A492: user-provided problem rating */
    userProvidedRating?: number;
    /** A492: user-provided problem tags */
    userProvidedTags?: string[];
    /** A492: enable CF learning profile */
    enableCfProfile?: boolean;
    /** A492: refresh CF data */
    refreshCfData?: boolean;
    /** A492: recommend follow-up training problems */
    recommendFollowUp?: boolean;
    /** Run ID for progress tracking */
    _runId?: string;
  },
): Promise<CodeAnalysisResult | A492PersonalizedResult> {
  // 1. Check session
  const session = await readAssistantSession();
  if (!session.userId) {
    return makeBaseError("NOT_AUTHENTICATED", "请先登录后再使用代码分析功能");
  }

  // 2. Rate limiting
  const now = Date.now();
  const lastCall = cooldownMap.get(session.userId) ?? 0;
  if (now - lastCall < COOLDOWN_MS) {
    return makeBaseError("MODEL_RATE_LIMITED", "请稍候再提交，每次分析至少间隔 3 秒");
  }
  cooldownMap.set(session.userId, now);

  // 3. Input validation
  const validation = validateCodeAnalysisInput({
    problemStatement: input.problemStatement ?? "",
    sourceCode: input.sourceCode ?? "",
    selectedLanguage: input.selectedLanguage ?? "auto",
  });
  if (!validation.valid) {
    return makeBaseError("EMPTY_CODE", validation.errors[0]?.message ?? "输入校验失败");
  }

  // 4. Check if personalized analysis is requested
  const enableCfProfile = input.enableCfProfile === true;

  if (!enableCfProfile) {
    // A491: Base code analysis
    const workflowInput = {
      problemStatement: sanitizeString(input.problemStatement) ?? "",
      sourceCode: sanitizeString(input.sourceCode) ?? "",
      selectedLanguage: normalizeLanguage(input.selectedLanguage),
      errorInfo: sanitizeString(input.errorInfo),
      testInput: sanitizeString(input.testInput),
      actualOutput: sanitizeString(input.actualOutput),
      expectedOutput: sanitizeString(input.expectedOutput),
      failedCases: sanitizeString(input.failedCases),
    };
    const result = await runCodeAnalysisWorkflow(workflowInput, session.userId);
    var runId = input._runId || ("base_" + Date.now());
    saveAnalysisResult({
      runId: runId,
      summary: input.problemStatement.slice(0, 50) + (input.problemStatement.length > 50 ? "..." : "") + " — 基础分析",
      problemRating: null,
      userRating: null,
      findingCount: result.success && result.report ? result.report.findings.length : 0,
      personalized: false,
      modelName: result.modelInfo?.modelDisplayName ?? "未知",
      fullReport: result.success ? result.report : null,
    }).catch(function() {});
    return result;
  }

  // A492: Personalized code analysis
  try {
    // Resolve model for problem profiling
    const modelResult = await resolveCodeAnalysisModel(session.userId);
    if (!modelResult.model) {
      // Fall back to base analysis if no model
      const workflowInput = {
        problemStatement: sanitizeString(input.problemStatement) ?? "",
        sourceCode: sanitizeString(input.sourceCode) ?? "",
        selectedLanguage: normalizeLanguage(input.selectedLanguage),
      };
      return await runCodeAnalysisWorkflow(workflowInput, session.userId);
    }

    const model = modelResult.model;

    // Calculate total phases for progress tracking
    var totalPhases = input.enableCfProfile ? 7 : 4;
    var phaseIdx = 0;
    var runId = input._runId || ("run_" + Date.now());
    var report = function(phase: string) {
      phaseIdx++;
      setAnalysisProgress(runId, phase, phaseIdx, totalPhases).catch(function() {});
    };

    // Build Agent dependencies
    const deps: AgentDeps = {
      userId: session.userId,
      modelInfo: model.info,

      reportProgress: function(phase: string) { report(phase); },

      // Problem profiling — profileProblem internally skips model when user provides rating
      profileProblem: async (pi) => {
        // profileProblem does: user has rating → 0ms return, otherwise → 15s max model call
        return profileProblem(
          { problemStatement: pi.problemStatement, code: pi.code, userProvidedRating: pi.userProvidedRating, userProvidedTags: pi.userProvidedTags },
          { baseUrl: model.provider.baseUrl, authMode: model.provider.authMode, secrets: model.provider.secrets, modelId: model.profile.modelId, timeoutMs: 15000, maxOutputTokens: 1024, temperature: model.profile.temperature, supportsJsonSchema: model.profile.supportsJsonSchema, modelDisplayName: model.info.modelDisplayName, providerName: model.info.providerName },
        );
      },

      // CF tools — lazy-load to avoid import errors when CF not configured
      getCfSnapshot: async (userId) => {
        try {
          const { getCfSnapshotForTool } = await import("./cf-tool-adapters.ts");
          return getCfSnapshotForTool(userId);
        } catch {
          return null;
        }
      },

      getEstimatedRating: async (userId) => {
        try {
          const { getEstimatedRatingForTool } = await import("./cf-tool-adapters.ts");
          return getEstimatedRatingForTool(userId);
        } catch {
          return { estimatedRating: null, confidence: 0, basis: [], currentOfficialRating: null, maxOfficialRating: null, source: "insufficient" as const };
        }
      },

      getWeakTags: async (userId) => {
        try {
          const { getWeakTagsForTool } = await import("./cf-tool-adapters.ts");
          return getWeakTagsForTool(userId);
        } catch {
          return { weakTags: [], totalTagsAnalyzed: 0, dataQuality: "error" };
        }
      },

      getReviewPlan: async (userId) => {
        try {
          const { getReviewPlanForTool } = await import("./cf-tool-adapters.ts");
          return getReviewPlanForTool(userId);
        } catch {
          return { focusTags: [], unfinishedCount: 0, reviewNeededCount: 0, recentSuggestions: [], associatedProblemKeys: [] };
        }
      },

      getCandidates: async (userId, query) => {
        try {
          const { getCandidatesForTool } = await import("./cf-tool-adapters.ts");
          return getCandidatesForTool(userId, query);
        } catch {
          return { candidates: [], totalAvailable: 0, excludedCount: 0 };
        }
      },

      refreshCfData: input.refreshCfData ? async (userId) => {
        try {
          const { refreshCfForTool } = await import("./cf-tool-adapters.ts");
          return refreshCfForTool(userId);
        } catch {
          return { success: false, newRating: null, submissionsFetched: 0, message: "Refresh failed" };
        }
      } : undefined,
    };

    const result = await runPersonalizedCodeAnalysis(
      {
        problemStatement: sanitizeString(input.problemStatement) ?? "",
        sourceCode: sanitizeString(input.sourceCode) ?? "",
        selectedLanguage: normalizeLanguage(input.selectedLanguage),
        errorInfo: sanitizeString(input.errorInfo),
        testInput: sanitizeString(input.testInput),
        actualOutput: sanitizeString(input.actualOutput),
        expectedOutput: sanitizeString(input.expectedOutput),
        failedCases: sanitizeString(input.failedCases),
        userProvidedRating: input.userProvidedRating,
        userProvidedTags: input.userProvidedTags,
        enableCfProfile: true,
        refreshCfData: input.refreshCfData === true,
        recommendFollowUp: input.recommendFollowUp === true,
        userId: session.userId,
      },
      deps,
    );

    // Save full result for history replay
    saveAnalysisResult({
      runId: runId,
      summary: input.problemStatement.slice(0, 50) + (input.problemStatement.length > 50 ? "..." : "") + " — " + (result.success ? "完成" : "失败"),
      problemRating: input.userProvidedRating ?? ((result as any).report?.problemProfile?.rating?.value ?? null),
      userRating: (result as any).report?.learnerProfile?.estimatedRating ?? null,
      findingCount: result.success && (result as any).report?.baseReport ? (result as any).report.baseReport.findings.length : 0,
      personalized: true,
      modelName: result.modelInfo?.modelDisplayName ?? "未知",
      fullResult: result,
    }).catch(function() {});

    return result;
  } catch (err: unknown) {
    // On A492 error, fall back to A491
    console.error("A492 personalized analysis failed, falling back to A491:", err);
    const workflowInput = {
      problemStatement: sanitizeString(input.problemStatement) ?? "",
      sourceCode: sanitizeString(input.sourceCode) ?? "",
      selectedLanguage: normalizeLanguage(input.selectedLanguage),
    };
    return await runCodeAnalysisWorkflow(workflowInput, session.userId);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitizeString(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeLanguage(lang: string): "auto" | "cpp" | "python" | "java" | "javascript" | "typescript" | "other" {
  const valid = new Set(["auto", "cpp", "python", "java", "javascript", "typescript", "other"]);
  return valid.has(lang) ? lang as any : "auto";
}

function makeBaseError(code: string, message: string): CodeAnalysisResult {
  return {
    success: false,
    report: null,
    timeline: {
      events: [{
        step: "failed",
        status: "failed",
        timestamp: new Date().toISOString(),
        durationMs: 0,
        summary: message,
      }],
      totalDurationMs: 0,
      modelCallCount: 0,
      hadFormatRepair: false,
    },
    error: { code: code as any, safeMessage: message, retryable: false },
    modelInfo: null,
  };
}
