/**
 * A492 — Problem Profiling Skill
 *
 * Infers Codeforces problem rating and tags via model call.
 * User-provided values always take priority (0ms, no model call).
 * When user does NOT provide rating: calls model with same provider
 * that code analysis uses. Spark works fine — the issue was
 * timeout/setup, not model capability.
 */
import type { ProblemProfile, ProfileSource } from "./a492-types.ts";
import { CF_COMMON_TAGS } from "./a492-types.ts";
import { generateStructured, type StructuredGenerationConfig } from "../model-gateway/index.ts";

export interface ProblemProfilingInput {
  problemStatement: string;
  code?: string;
  selectedLanguage?: string;
  userProvidedRating?: number;
  userProvidedTags?: string[];
}

// Internal model response
interface ModelResponse {
  inferredRating: number | null;
  ratingRange: [number, number] | null;
  ratingConfidence: number;
  ratingReasoning: string[];
  inferredTags: Array<{ tag: string; confidence: number; evidence: string[] }>;
  problemType: string[];
  requiredKnowledge: string[];
  keyConstraints: string[];
  uncertaintyWarnings: string[];
}

export async function profileProblem(
  input: ProblemProfilingInput,
  modelConfig: StructuredGenerationConfig & { modelDisplayName: string; providerName: string },
): Promise<ProblemProfile> {
  // User provided rating → instant return (0ms), no model call needed
  if (input.userProvidedRating !== undefined) {
    return {
      rating: { value: input.userProvidedRating, range: null, source: "user_provided", confidence: 1.0, reasoning: ["用户手动填写"] },
      tags: (input.userProvidedTags ?? []).map(function(tag) {
        return { tag: tag.toLowerCase(), source: "user_provided" as ProfileSource, confidence: 1.0, evidence: ["用户手动填写"] };
      }),
      problemType: [], requiredKnowledge: [], keyConstraints: [],
      uncertaintyWarnings: (input.userProvidedTags?.length ?? 0) > 0 ? [] : ["标签未填写，模型可能补充推断标签"],
    };
  }

  // User DID NOT provide rating → call model to infer it.
  // Same generateStructured that code analysis uses — same provider, same auth.
  var modelResponse: ModelResponse | null = null;

  try {
    var systemPrompt = [
      "你是一个 Codeforces 题目难度分析器。你只输出 JSON，不要输出任何其他文本。",
      "根据题目描述的算法复杂度、数据范围、所需知识点，推断 CF Rating（800-3500）。",
      "Rating 每 100 分为一档。不确定时用 ratingRange 给区间。",
      "每个标签必须附带 evidence（从题目描述中引用的具体证据）。",
      "格式: {\"inferredRating\":1600,\"ratingRange\":[1400,1800],\"ratingConfidence\":0.8,\"ratingReasoning\":[\"涉及状态转移DP\"],\"inferredTags\":[{\"tag\":\"dp\",\"confidence\":0.9,\"evidence\":[\"需要记录子问题最优解\"]}],\"problemType\":[\"动态规划\"],\"requiredKnowledge\":[\"状态转移方程\"],\"keyConstraints\":[\"n<=10^5\"],\"uncertaintyWarnings\":[]}",
    ].join("\n");

    var userPrompt = "题目描述:\n" + input.problemStatement.slice(0, 3000);

    var result = await generateStructured(modelConfig, {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      maxOutputChars: 3000,
    });

    if (result.success && result.output) {
      try {
        var parsed = result.output as ModelResponse;
        // Validate & clamp
        if (parsed.inferredRating !== null) {
          parsed.inferredRating = Math.max(800, Math.min(3500, Math.round(parsed.inferredRating / 100) * 100));
        }
        if (parsed.ratingRange) {
          parsed.ratingRange[0] = Math.max(800, Math.min(3500, Math.round(parsed.ratingRange[0] / 100) * 100));
          parsed.ratingRange[1] = Math.max(800, Math.min(3500, Math.round(parsed.ratingRange[1] / 100) * 100));
        }
        parsed.ratingConfidence = Math.max(0, Math.min(1, parsed.ratingConfidence));
        // Filter to known CF tags only
        var validTags = new Set(CF_COMMON_TAGS);
        parsed.inferredTags = (parsed.inferredTags ?? [])
          .filter(function(t) { return validTags.has(t.tag.toLowerCase()); })
          .slice(0, 8);
        parsed.ratingReasoning = parsed.ratingReasoning ?? [];
        parsed.problemType = parsed.problemType ?? [];
        parsed.requiredKnowledge = parsed.requiredKnowledge ?? [];
        parsed.keyConstraints = parsed.keyConstraints ?? [];
        parsed.uncertaintyWarnings = parsed.uncertaintyWarnings ?? [];
        modelResponse = parsed;
      } catch {}
    }

    if (modelResponse) {
      return {
        rating: {
          value: modelResponse.inferredRating ?? null,
          range: modelResponse.ratingRange ?? null,
          source: modelResponse.inferredRating !== null ? "model_inferred" : "unknown",
          confidence: modelResponse.ratingConfidence,
          reasoning: modelResponse.ratingReasoning,
        },
        tags: [
          ...(input.userProvidedTags ?? []).map(function(tag) {
            return { tag: tag.toLowerCase(), source: "user_provided" as ProfileSource, confidence: 1.0, evidence: ["用户手动填写"] };
          }),
          ...(modelResponse.inferredTags ?? []).map(function(t) {
            return { tag: t.tag, source: "model_inferred" as ProfileSource, confidence: t.confidence, evidence: t.evidence };
          }),
        ],
        problemType: modelResponse.problemType,
        requiredKnowledge: modelResponse.requiredKnowledge,
        keyConstraints: modelResponse.keyConstraints,
        uncertaintyWarnings: modelResponse.uncertaintyWarnings,
      };
    }
  } catch {}

  // Model failed → fallback
  return {
    rating: { value: null, range: null, source: "unknown", confidence: 0, reasoning: ["模型推断失败 — 请手动填写 Rating"] },
    tags: (input.userProvidedTags ?? []).map(function(tag) {
      return { tag: tag.toLowerCase(), source: "user_provided" as ProfileSource, confidence: 1.0, evidence: ["用户手动填写"] };
    }),
    problemType: [], requiredKnowledge: [], keyConstraints: [],
    uncertaintyWarnings: ["模型推断失败，请手动填写题目 Rating（800-3500）或稍后重试。"],
  };
}
