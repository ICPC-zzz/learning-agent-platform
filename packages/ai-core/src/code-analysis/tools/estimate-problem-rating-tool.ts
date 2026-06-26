/**
 * A492 — Problem Rating Estimation AgentTool
 *
 * Returns problem rating estimate. User-provided values are authoritative.
 * When no rating is provided, use deterministic heuristics instead of waiting
 * on a model call. This keeps downstream code analysis usable under provider
 * latency or outage.
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
  source: "user_provided" | "model_inferred" | "rule_estimated" | "unknown";
  confidence: number;
  reasoning: string[];
  tags: Array<{ tag: string; source: "user_provided" | "model_inferred" | "rule_estimated"; confidence: number }>;
  requiredKnowledge: string[];
  warnings: string[];
}

export function createEstimateProblemRatingTool(): AgentTool<EstimateProblemRatingInput, EstimateProblemRatingOutput> {
  var metadata: AgentToolMetadata = createDefaultToolMetadata({
    name: "cf.problem.rating.estimate",
    description: "预估题目 Rating（用户填写时直接返回；未填写时用规则估算，不阻塞等待模型）",
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
        var estimate = estimateProblemRatingByRules(input.problemStatement, input.userProvidedTags ?? []);
        data = {
          rating: estimate.rating,
          ratingRange: [Math.max(800, estimate.rating - 100), Math.min(3500, estimate.rating + 100)],
          source: "rule_estimated",
          confidence: estimate.confidence,
          reasoning: estimate.reasoning,
          tags: estimate.tags.map(function(t) {
            return { tag: t, source: "rule_estimated" as const, confidence: estimate.confidence };
          }),
          requiredKnowledge: estimate.tags,
          warnings: ["未使用模型推断，当前 Rating 为规则估算；手动填写题目 Rating 可获得更准确的难度匹配"],
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

function estimateProblemRatingByRules(problemStatement: string, userProvidedTags: string[]): {
  rating: number;
  confidence: number;
  reasoning: string[];
  tags: string[];
} {
  var text = problemStatement.toLowerCase();
  var tags = normalizeTags(userProvidedTags);

  var keywordTags: Array<[string, string[]]> = [
    ["dp", ["dynamic programming", "dp", "subproblem", "transition"]],
    ["greedy", ["greedy", "optimal", "minimum operations", "maximum score"]],
    ["graphs", ["graph", "tree", "edge", "vertex", "connected", "path"]],
    ["binary search", ["binary search", "minimum possible", "maximum possible", "can we"]],
    ["data structures", ["segment tree", "fenwick", "priority queue", "set", "map"]],
    ["math", ["modulo", "gcd", "prime", "divisor", "combinatorics"]],
    ["strings", ["string", "substring", "prefix", "suffix", "palindrome"]],
    ["brute force", ["brute force", "enumerate", "all pairs", "try all"]],
    ["implementation", ["simulate", "simulation", "process queries"]],
  ];

  for (var i = 0; i < keywordTags.length; i++) {
    var tag = keywordTags[i][0];
    var keywords = keywordTags[i][1];
    if (keywords.some(function(keyword) { return text.includes(keyword); }) && tags.indexOf(tag) === -1) {
      tags.push(tag);
    }
  }

  var rating = 1100;
  var weights: Record<string, number> = {
    "implementation": 0,
    "brute force": 0,
    "greedy": 100,
    "math": 100,
    "strings": 100,
    "binary search": 200,
    "data structures": 250,
    "graphs": 250,
    "dp": 300,
  };

  for (var j = 0; j < tags.length; j++) {
    rating += weights[tags[j]] ?? 120;
  }

  if (/10\^5|100000|2e5|200000|10\^6|1000000/.test(text)) rating += 150;
  if (/multiple test cases|test cases|queries/.test(text)) rating += 100;
  if (/prove|expected value|probability|interactive/.test(text)) rating += 300;

  rating = Math.max(800, Math.min(3500, Math.round(rating / 100) * 100));

  return {
    rating: rating,
    confidence: tags.length > 0 ? 0.55 : 0.35,
    reasoning: [
      tags.length > 0
        ? "根据题面关键词和标签做规则估算: " + tags.slice(0, 5).join(", ")
        : "缺少足够题面信号，使用默认入门到中等难度估算",
    ],
    tags: tags,
  };
}

function normalizeTags(tags: string[]): string[] {
  var normalized: string[] = [];
  for (var i = 0; i < tags.length; i++) {
    var tag = tags[i].trim().toLowerCase();
    if (tag.length > 0 && normalized.indexOf(tag) === -1) normalized.push(tag);
  }
  return normalized;
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
