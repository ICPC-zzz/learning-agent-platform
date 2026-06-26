/**
 * A492 Problem Profiling
 *
 * User-provided rating is authoritative and returns immediately.
 * Without a user rating, the profiler first creates a deterministic rule-based
 * estimate, then tries one short model call as an optional enhancement. Model
 * timeout or provider failure never blocks code analysis.
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
  if (input.userProvidedRating !== undefined) {
    return {
      rating: {
        value: input.userProvidedRating,
        range: null,
        source: "user_provided",
        confidence: 1.0,
        reasoning: ["User-provided rating."],
      },
      tags: normalizeTags(input.userProvidedTags ?? []).map((tag) => ({
        tag,
        source: "user_provided" as ProfileSource,
        confidence: 1.0,
        evidence: ["User-provided tag."],
      })),
      problemType: [],
      requiredKnowledge: [],
      keyConstraints: [],
      uncertaintyWarnings: [],
    };
  }

  const ruleProfile = buildRuleEstimatedProblemProfile(input);

  try {
    const result = await generateStructured(
      {
        ...modelConfig,
        timeoutMs: Math.min(modelConfig.timeoutMs ?? 6000, 6000),
        maxOutputTokens: Math.min(modelConfig.maxOutputTokens ?? 1024, 768),
      },
      {
        messages: [
          {
            role: "system",
            content: [
              "You are a Codeforces difficulty profiler.",
              "Return JSON only.",
              "Infer a Codeforces rating from 800 to 3500 in steps of 100.",
              "Use only official Codeforces tags.",
            ].join("\n"),
          },
          {
            role: "user",
            content: [
              "Problem statement:",
              input.problemStatement.slice(0, 3000),
              "",
              "Return shape:",
              "{\"inferredRating\":1600,\"ratingRange\":[1500,1700],\"ratingConfidence\":0.7,\"ratingReasoning\":[\"short reason\"],\"inferredTags\":[{\"tag\":\"dp\",\"confidence\":0.8,\"evidence\":[\"evidence\"]}],\"problemType\":[],\"requiredKnowledge\":[],\"keyConstraints\":[],\"uncertaintyWarnings\":[]}",
            ].join("\n"),
          },
        ],
        maxOutputChars: 2400,
      },
    );

    if (!result.success || !result.output) {
      return ruleProfile;
    }

    const parsed = normalizeModelResponse(result.output as Partial<ModelResponse>);
    if (!parsed) return ruleProfile;

    return mergeModelProfile(input, ruleProfile, parsed);
  } catch {
    return ruleProfile;
  }
}

function mergeModelProfile(
  input: ProblemProfilingInput,
  ruleProfile: ProblemProfile,
  model: ModelResponse,
): ProblemProfile {
  const modelTags = model.inferredTags
    .map((entry) => ({
      tag: entry.tag.trim().toLowerCase(),
      source: "model_inferred" as ProfileSource,
      confidence: clamp01(entry.confidence),
      evidence: entry.evidence.length > 0 ? entry.evidence.slice(0, 3) : ["Model-inferred tag."],
    }))
    .filter((entry) => isKnownCfTag(entry.tag));

  const userTags = normalizeTags(input.userProvidedTags ?? []).map((tag) => ({
    tag,
    source: "user_provided" as ProfileSource,
    confidence: 1.0,
    evidence: ["User-provided tag."],
  }));

  return {
    rating: {
      value: model.inferredRating,
      range: model.ratingRange,
      source: model.inferredRating !== null ? "model_inferred" : ruleProfile.rating.source,
      confidence: model.inferredRating !== null ? model.ratingConfidence : ruleProfile.rating.confidence,
      reasoning: model.ratingReasoning.length > 0 ? model.ratingReasoning : ruleProfile.rating.reasoning,
    },
    tags: dedupeTagEntries([...userTags, ...modelTags, ...ruleProfile.tags]),
    problemType: model.problemType,
    requiredKnowledge: model.requiredKnowledge.length > 0 ? model.requiredKnowledge : ruleProfile.requiredKnowledge,
    keyConstraints: model.keyConstraints.length > 0 ? model.keyConstraints : ruleProfile.keyConstraints,
    uncertaintyWarnings: model.uncertaintyWarnings,
  };
}

function buildRuleEstimatedProblemProfile(input: ProblemProfilingInput): ProblemProfile {
  const text = (input.problemStatement || "").toLowerCase();
  const userTags = normalizeTags(input.userProvidedTags ?? []);
  const inferredTags = inferTagsFromText(text);
  const tags = normalizeTags([...userTags, ...inferredTags]);
  const rating = estimateRatingFromSignals(text, tags);

  return {
    rating: {
      value: rating,
      range: [clampRating(rating - 100), clampRating(rating + 100)],
      source: "rule_estimated",
      confidence: tags.length > 0 ? 0.55 : 0.35,
      reasoning: [
        "Rule estimate from constraints, tags, and common Codeforces difficulty distribution.",
        "This fallback is used when the model profiler is slow or unavailable.",
      ],
    },
    tags: tags.map((tag) => ({
      tag,
      source: userTags.includes(tag) ? "user_provided" as ProfileSource : "rule_estimated" as ProfileSource,
      confidence: userTags.includes(tag) ? 1.0 : 0.5,
      evidence: [userTags.includes(tag) ? "User-provided tag." : "Keyword-based tag estimate."],
    })),
    problemType: [],
    requiredKnowledge: tags.slice(0, 5),
    keyConstraints: extractConstraintHints(text),
    uncertaintyWarnings: [
      "Problem rating is rule-estimated. It is suitable for recommendation bands; enter a rating manually for exact matching.",
    ],
  };
}

function normalizeModelResponse(value: Partial<ModelResponse>): ModelResponse | null {
  const inferredRating =
    typeof value.inferredRating === "number" && Number.isFinite(value.inferredRating)
      ? clampRating(Math.round(value.inferredRating / 100) * 100)
      : null;

  let ratingRange: [number, number] | null = null;
  if (Array.isArray(value.ratingRange) && value.ratingRange.length >= 2) {
    const lo = Number(value.ratingRange[0]);
    const hi = Number(value.ratingRange[1]);
    if (Number.isFinite(lo) && Number.isFinite(hi)) {
      ratingRange = [
        clampRating(Math.round(Math.min(lo, hi) / 100) * 100),
        clampRating(Math.round(Math.max(lo, hi) / 100) * 100),
      ];
    }
  }

  return {
    inferredRating,
    ratingRange,
    ratingConfidence: clamp01(Number(value.ratingConfidence ?? 0.5)),
    ratingReasoning: asStringArray(value.ratingReasoning).slice(0, 5),
    inferredTags: Array.isArray(value.inferredTags)
      ? value.inferredTags
          .filter((entry): entry is { tag: string; confidence: number; evidence: string[] } =>
            typeof entry?.tag === "string")
          .slice(0, 8)
      : [],
    problemType: asStringArray(value.problemType).slice(0, 5),
    requiredKnowledge: asStringArray(value.requiredKnowledge).slice(0, 8),
    keyConstraints: asStringArray(value.keyConstraints).slice(0, 8),
    uncertaintyWarnings: asStringArray(value.uncertaintyWarnings).slice(0, 5),
  };
}

function inferTagsFromText(text: string): string[] {
  const rules: Array<[string, string[]]> = [
    ["dp", ["dynamic programming", "dp", "subsequence", "state", "transition"]],
    ["graphs", ["graph", "vertex", "edge", "connected", "component"]],
    ["trees", ["tree", "root", "ancestor", "subtree"]],
    ["greedy", ["greedy", "maximize", "minimize", "optimal"]],
    ["binary search", ["binary search", "lower_bound", "upper_bound", "monotonic"]],
    ["data structures", ["segment tree", "fenwick", "bit indexed", "priority queue", "multiset"]],
    ["brute force", ["brute force", "enumerate", "try all"]],
    ["math", ["gcd", "modulo", "prime", "divisor", "integer"]],
    ["number theory", ["prime", "divisor", "gcd", "lcm", "modular"]],
    ["strings", ["string", "substring", "prefix", "suffix"]],
    ["two pointers", ["two pointers", "sliding window"]],
    ["sortings", ["sort", "sorted", "permutation"]],
    ["constructive algorithms", ["construct", "any valid", "output any"]],
    ["bitmasks", ["bitmask", "xor", "bits"]],
    ["combinatorics", ["combination", "permutation", "count the number"]],
    ["divide and conquer", ["divide and conquer"]],
    ["shortest paths", ["shortest path", "dijkstra", "bellman"]],
    ["flows", ["max flow", "min cut", "flow network"]],
  ];

  const result: string[] = [];
  for (const [tag, keywords] of rules) {
    if (keywords.some((keyword) => text.includes(keyword))) result.push(tag);
  }
  return result;
}

function estimateRatingFromSignals(text: string, tags: string[]): number {
  const tagWeight: Record<string, number> = {
    implementation: 0,
    "brute force": 0,
    greedy: 100,
    math: 100,
    sortings: 100,
    "two pointers": 150,
    "binary search": 200,
    "constructive algorithms": 200,
    strings: 200,
    dp: 300,
    graphs: 300,
    "data structures": 350,
    trees: 350,
    "number theory": 300,
    bitmasks: 350,
    combinatorics: 350,
    "divide and conquer": 450,
    "shortest paths": 450,
    flows: 800,
  };

  let rating = 1100;
  let strongest = 0;
  for (const tag of tags) strongest = Math.max(strongest, tagWeight[tag] ?? 150);
  rating += strongest;

  if (/(10\^5|100000|2e5|200000|10\^6|1000000)/.test(text)) rating += 100;
  if (/(10\^9|1e9|1000000000|10\^18|1e18)/.test(text)) rating += 100;
  if (/(multiple test cases|sum of n|all test cases)/.test(text)) rating += 100;
  if (/(interactive|output queries|ask queries)/.test(text)) rating += 400;
  if (tags.length >= 3) rating += 100;

  return clampRating(Math.round(rating / 100) * 100);
}

function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const rawTag of tags) {
    const tag = String(rawTag ?? "").trim().toLowerCase();
    if (!isKnownCfTag(tag) || seen.has(tag)) continue;
    seen.add(tag);
    result.push(tag);
    if (result.length >= 8) break;
  }
  return result;
}

function dedupeTagEntries<T extends { tag: string }>(tags: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const tag of tags) {
    const key = tag.tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(tag);
  }
  return result;
}

function extractConstraintHints(text: string): string[] {
  const hints: string[] = [];
  const matches = text.match(/n\s*(?:<=|<=|≤)\s*(?:10\^\d+|\d+)/g);
  if (matches) hints.push(...matches.slice(0, 3));
  if (/(multiple test cases|sum of n|all test cases)/.test(text)) hints.push("multiple test cases");
  return hints;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function isKnownCfTag(tag: string): boolean {
  return (CF_COMMON_TAGS as readonly string[]).includes(tag);
}

function clampRating(value: number): number {
  return Math.max(800, Math.min(3500, value));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
