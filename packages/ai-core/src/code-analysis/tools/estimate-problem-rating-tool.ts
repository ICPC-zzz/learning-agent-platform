/**
 * A492 — Problem Rating Estimation AgentTool
 *
 * Returns problem rating estimate. User-provided values are authoritative.
 * Tool is registered but model inference is disabled — Spark provider
 * latency makes it unreliable. User should manually enter rating.
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

export interface EstimateProblemRatingInput {
  problemStatement: string;
  userProvidedRating?: number;
  userProvidedTags?: string[];
}

export interface EstimateProblemRatingOutput {
  rating: number | null;
  ratingRange: [number, number] | null;
  source: "user_provided" | "model_inferred" | "unknown";
  confidence: number;
  reasoning: string[];
  tags: Array<{ tag: string; source: "user_provided" | "model_inferred"; confidence: number }>;
  requiredKnowledge: string[];
  warnings: string[];
}

export function createEstimateProblemRatingTool(): AgentTool<EstimateProblemRatingInput, EstimateProblemRatingOutput> {
  var metadata: AgentToolMetadata = createDefaultToolMetadata({
    name: "cf.problem.rating.estimate",
    description: "预估题目 Rating（用户填写时直接返回；未填写时返回 unknown，不调模型）",
    category: AgentToolCategory.Analysis,
    readOnly: true,
    sideEffect: false,
    parallelSafe: true,
    requiresConfirmation: false,
    requiresAuthentication: false,
    sensitivity: AgentToolSensitivity.Low,
    timeoutMs: 1000,
    allowedAgents: ["code-debugger", "problem-profiler"],
    disabledByDefault: false,
  });

  return {
    metadata: metadata,
    inputSchema: ratingInputSchema(),
    async execute(input, _context): Promise<ToolExecutionResult<EstimateProblemRatingOutput>> {
      var startedAt = new Date().toISOString();
      var data: EstimateProblemRatingOutput;
      if (input.userProvidedRating !== undefined) {
        data = {
          rating: input.userProvidedRating,
          ratingRange: null,
          source: "user_provided",
          confidence: 1.0,
          reasoning: ["用户手动填写"],
          tags: (input.userProvidedTags ?? []).map(function(t) { return { tag: t, source: "user_provided" as const, confidence: 1.0 }; }),
          requiredKnowledge: [],
          warnings: [],
        };
      } else {
        data = {
          rating: null, ratingRange: null, source: "unknown", confidence: 0,
          reasoning: ["请手动填写题目 Rating"],
          tags: [],
          requiredKnowledge: [],
          warnings: ["请填写题目 Rating（800-3500）以获得准确的难度匹配"],
        };
      }
      return {
        toolCallId: "tcall_" + Date.now(), status: ToolExecutionStatus.Success, data: data,
        safeSummary: "Rating: " + (data.rating ?? "unknown") + " (source: " + data.source + ")",
        retryable: false, startedAt: startedAt, completedAt: new Date().toISOString(),
        durationMs: Date.now() - new Date(startedAt).getTime(),
      };
    },
  };
}

function ratingInputSchema(): ToolInputSchema<EstimateProblemRatingInput> {
  return {
    _brand: "ToolInputSchema" as const,
    _inputType: undefined as unknown as EstimateProblemRatingInput,
    schema: { type: "object", properties: { problemStatement: { type: "string" }, userProvidedRating: { type: "number" }, userProvidedTags: { type: "array", items: { type: "string" } } }, required: ["problemStatement"] },
    validate(input: unknown): EstimateProblemRatingInput {
      if (!input || typeof input !== "object") throw new Error("Invalid input");
      var obj = input as Record<string, unknown>;
      return { problemStatement: String(obj.problemStatement ?? ""), userProvidedRating: typeof obj.userProvidedRating === "number" ? obj.userProvidedRating : undefined, userProvidedTags: Array.isArray(obj.userProvidedTags) ? obj.userProvidedTags.filter(function(t) { return typeof t === "string"; }) : undefined };
    },
  };
}
