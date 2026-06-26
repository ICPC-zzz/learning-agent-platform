import { MemoryLayer, type MemoryLayer as MemoryLayerValue } from "../memory/types";
import {
  AgentTaskPlanExecutionStatus,
  type AgentTaskPlanPreview,
  type AgentTaskPlanStep,
} from "./plan-preview";

export const AgentMemoryContextStatus = {
  PreviewOnly: "preview_only",
  NoCandidateMemory: "no_candidate_memory",
  NoRelevantMemory: "no_relevant_memory",
  Disabled: "disabled",
} as const;

export type AgentMemoryContextStatus =
  (typeof AgentMemoryContextStatus)[keyof typeof AgentMemoryContextStatus];

export const AgentMemoryContextMatchLevel = {
  Low: "low",
  Medium: "medium",
  High: "high",
} as const;

export type AgentMemoryContextMatchLevel =
  (typeof AgentMemoryContextMatchLevel)[keyof typeof AgentMemoryContextMatchLevel];

export type AgentMemoryContextExecutionStatus =
  AgentTaskPlanExecutionStatus;

export interface AgentMemoryContextSnippetInput {
  id: string;
  layer: MemoryLayerValue;
  content: string;
  summary?: string;
  tags?: readonly string[];
  createdAt?: string;
  updatedAt?: string;
  relevanceScore?: number;
  metadata?: Record<string, unknown>;
}

export interface AgentMemoryContextPreviewOptions {
  maxSelectedSnippets?: number;
  maxContextChars?: number;
  includeProfileMemory?: boolean;
  includeSessionMemory?: boolean;
  includeRetrievableMemory?: boolean;
  minimumRelevanceScore?: number;
}

export interface AgentMemoryContextPreviewInput {
  taskText: string;
  planPreview: AgentTaskPlanPreview;
  candidateMemories: readonly AgentMemoryContextSnippetInput[];
  options?: AgentMemoryContextPreviewOptions;
}

export interface AgentMemoryContextSnippetPreview {
  id: string;
  layer: MemoryLayerValue;
  contentPreview: string;
  relevanceScore: number;
  matchLevel: AgentMemoryContextMatchLevel;
  matchReasons: readonly string[];
  coveredStepIds: readonly string[];
  coveredStepIndexes: readonly number[];
  coveredStepSummaries: readonly string[];
  includedInContext: boolean;
  exclusionReason?: string;
  safetyNotes: readonly string[];
}

export type AgentMemoryContextSelectedSnippet =
  AgentMemoryContextSnippetPreview;

export interface AgentMemoryContextBlock {
  blockId: string;
  memoryId: string;
  layer: MemoryLayerValue;
  text: string;
  charCount: number;
  truncated: boolean;
}

export interface AgentMemoryContextPreview {
  previewId: string;
  planPreviewId: string;
  taskSummary: string;
  contextStatus: AgentMemoryContextStatus;
  executable: false;
  executionStatus: AgentMemoryContextExecutionStatus;
  retrievalExecuted: false;
  embeddingUsed: false;
  llmUsed: false;
  selectedMemories: readonly AgentMemoryContextSelectedSnippet[];
  excludedMemories: readonly AgentMemoryContextSnippetPreview[];
  contextBlocks: readonly AgentMemoryContextBlock[];
  contextPreviewText: string;
  contextCharCount: number;
  truncated: boolean;
  selectedMemoryCount: number;
  candidateMemoryCount: number;
  safetyNotes: readonly string[];
  disabledReason?: string;
}

interface NormalizedOptions {
  readonly maxSelectedSnippets: number;
  readonly maxContextChars: number;
  readonly includeProfileMemory: boolean;
  readonly includeSessionMemory: boolean;
  readonly includeRetrievableMemory: boolean;
  readonly minimumRelevanceScore: number;
}

interface StepSearchIndex {
  readonly step: AgentTaskPlanStep;
  readonly stepIndex: number;
  readonly tokens: ReadonlySet<string>;
}

interface PlanSearchIndex {
  readonly taskTokens: ReadonlySet<string>;
  readonly planTokens: ReadonlySet<string>;
  readonly steps: readonly StepSearchIndex[];
}

interface ScoredMemory {
  readonly input: AgentMemoryContextSnippetInput;
  readonly contentPreview: string;
  readonly relevanceScore: number;
  readonly matchLevel: AgentMemoryContextMatchLevel;
  readonly matchReasons: readonly string[];
  readonly coveredSteps: readonly StepSearchIndex[];
}

interface ContextAssemblyResult {
  readonly selectedMemories: readonly AgentMemoryContextSelectedSnippet[];
  readonly excludedMemories: readonly AgentMemoryContextSnippetPreview[];
  readonly contextBlocks: readonly AgentMemoryContextBlock[];
  readonly contextPreviewText: string;
  readonly contextCharCount: number;
  readonly truncated: boolean;
}

const DEFAULT_MAX_SELECTED_SNIPPETS = 5;
const DEFAULT_MAX_CONTEXT_CHARS = 2_000;
const DEFAULT_MINIMUM_RELEVANCE_SCORE = 12;
const CONTENT_PREVIEW_MAX_CHARS = 240;
const CONTEXT_BLOCK_CONTENT_MAX_CHARS = 600;

const MEMORY_CONTEXT_DISABLED_REASON =
  "智能体记忆上下文预览已禁用。真实记忆检索、embedding、模型摘要、工具执行、Skill 执行、数据库访问、网络访问、持久化和智能体运行时执行均已禁用。";

const layerPriority: Record<MemoryLayerValue, number> = {
  [MemoryLayer.Profile]: 0,
  [MemoryLayer.Session]: 1,
  [MemoryLayer.Retrievable]: 2,
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "be",
  "by",
  "for",
  "from",
  "in",
  "into",
  "is",
  "it",
  "memory",
  "of",
  "on",
  "or",
  "plan",
  "preview",
  "task",
  "the",
  "this",
  "to",
  "with",
]);

export function createAgentMemoryContextPreview(
  input: AgentMemoryContextPreviewInput,
): AgentMemoryContextPreview {
  const options = normalizeOptions(input.options);
  const taskText = normalizeDisplayText(input.taskText);
  const candidateMemoryCount = input.candidateMemories.length;

  if (!input.planPreview.isValid || taskText.length === 0) {
    return createEmptyPreview({
      input,
      options,
      contextStatus: AgentMemoryContextStatus.Disabled,
      executionStatus: AgentTaskPlanExecutionStatus.Disabled,
      candidateMemoryCount,
      disabledReason:
        "任务文本为空或来源智能体任务计划预览已禁用，因此记忆上下文预览不能变为可执行。",
      extraSafetyNotes: [
        "需要有效任务文本和有效智能体任务计划预览，才能预览候选记忆。",
      ],
    });
  }

  if (!hasAnyIncludedLayer(options)) {
    return createEmptyPreview({
      input,
      options,
      contextStatus: AgentMemoryContextStatus.Disabled,
      executionStatus: AgentTaskPlanExecutionStatus.Disabled,
      candidateMemoryCount,
      disabledReason:
        "预览选项已禁用所有记忆层，因此不会纳入任何候选记忆。",
      extraSafetyNotes: [
        "层级包含选项已为本次预览禁用 profile、session 和 retrievable 记忆。",
      ],
    });
  }

  if (candidateMemoryCount === 0) {
    return createEmptyPreview({
      input,
      options,
      contextStatus: AgentMemoryContextStatus.NoCandidateMemory,
      executionStatus: AgentTaskPlanExecutionStatus.PreviewOnly,
      candidateMemoryCount,
      disabledReason: MEMORY_CONTEXT_DISABLED_REASON,
      extraSafetyNotes: [
        "调用方未提供候选记忆；不会尝试检索。",
      ],
    });
  }

  const planSearchIndex = createPlanSearchIndex(taskText, input.planPreview);
  const scoredMemories = input.candidateMemories
    .map((memory) =>
      scoreMemory({
        memory,
        planSearchIndex,
      }),
    )
    .sort(compareScoredMemories);
  const excludedBeforeSelection = scoredMemories
    .filter((memory) => !isMemoryLayerIncluded(memory.input.layer, options))
    .map((memory) =>
      createSnippetPreview({
        memory,
        includedInContext: false,
        exclusionReason: "memory_layer_disabled_by_options",
      }),
    );
  const eligibleMemories = scoredMemories.filter((memory) =>
    isMemoryLayerIncluded(memory.input.layer, options),
  );
  const relevantMemories = eligibleMemories.filter(
    (memory) =>
      memory.relevanceScore >= options.minimumRelevanceScore &&
      memory.matchReasons.length > 0,
  );
  const excludedForRelevance = eligibleMemories
    .filter((memory) => !relevantMemories.includes(memory))
    .map((memory) =>
      createSnippetPreview({
        memory,
        includedInContext: false,
        exclusionReason:
          memory.relevanceScore > 0
            ? "relevance_below_minimum_score"
            : "no_relevant_keyword_match",
      }),
    );

  if (relevantMemories.length === 0) {
    return createEmptyPreview({
      input,
      options,
      contextStatus: AgentMemoryContextStatus.NoRelevantMemory,
      executionStatus: AgentTaskPlanExecutionStatus.PreviewOnly,
      candidateMemoryCount,
      disabledReason: MEMORY_CONTEXT_DISABLED_REASON,
      excludedMemories: [
        ...excludedBeforeSelection,
        ...excludedForRelevance,
      ],
      extraSafetyNotes: [
        "已提供候选记忆，但没有任何项达到保守的确定性相关性阈值。",
      ],
    });
  }

  const selectedCandidates = relevantMemories.slice(
    0,
    options.maxSelectedSnippets,
  );
  const excludedForSelectionLimit = relevantMemories
    .slice(options.maxSelectedSnippets)
    .map((memory) =>
      createSnippetPreview({
        memory,
        includedInContext: false,
        exclusionReason: "max_selected_snippets_exceeded",
      }),
    );
  const assembly = assembleContext({
    selectedCandidates,
    maxContextChars: options.maxContextChars,
  });

  return {
    previewId: createPreviewId(input, options),
    planPreviewId: input.planPreview.previewId,
    taskSummary: input.planPreview.taskSummary,
    contextStatus: AgentMemoryContextStatus.PreviewOnly,
    executable: false,
    executionStatus: AgentTaskPlanExecutionStatus.PreviewOnly,
    retrievalExecuted: false,
    embeddingUsed: false,
    llmUsed: false,
    selectedMemories: assembly.selectedMemories,
    excludedMemories: [
      ...assembly.excludedMemories,
      ...excludedForSelectionLimit,
      ...excludedBeforeSelection,
      ...excludedForRelevance,
    ],
    contextBlocks: assembly.contextBlocks,
    contextPreviewText: assembly.contextPreviewText,
    contextCharCount: assembly.contextCharCount,
    truncated: assembly.truncated,
    selectedMemoryCount: assembly.selectedMemories.length,
    candidateMemoryCount,
    safetyNotes: createSafetyNotes({
      candidateMemoryCount,
      options,
      contextStatus: AgentMemoryContextStatus.PreviewOnly,
      extraNotes:
        assembly.contextBlocks.length === 0
          ? ["已找到相关记忆，但上下文字数预算不足，无法纳入任何块。"]
          : [],
    }),
    disabledReason: MEMORY_CONTEXT_DISABLED_REASON,
  };
}

function createEmptyPreview(input: {
  readonly input: AgentMemoryContextPreviewInput;
  readonly options: NormalizedOptions;
  readonly contextStatus: AgentMemoryContextStatus;
  readonly executionStatus: AgentMemoryContextExecutionStatus;
  readonly candidateMemoryCount: number;
  readonly disabledReason: string;
  readonly excludedMemories?: readonly AgentMemoryContextSnippetPreview[];
  readonly extraSafetyNotes: readonly string[];
}): AgentMemoryContextPreview {
  return {
    previewId: createPreviewId(input.input, input.options),
    planPreviewId: input.input.planPreview.previewId,
    taskSummary: input.input.planPreview.taskSummary,
    contextStatus: input.contextStatus,
    executable: false,
    executionStatus: input.executionStatus,
    retrievalExecuted: false,
    embeddingUsed: false,
    llmUsed: false,
    selectedMemories: [],
    excludedMemories: input.excludedMemories ?? [],
    contextBlocks: [],
    contextPreviewText: "",
    contextCharCount: 0,
    truncated: false,
    selectedMemoryCount: 0,
    candidateMemoryCount: input.candidateMemoryCount,
    safetyNotes: createSafetyNotes({
      candidateMemoryCount: input.candidateMemoryCount,
      options: input.options,
      contextStatus: input.contextStatus,
      extraNotes: input.extraSafetyNotes,
    }),
    disabledReason: input.disabledReason,
  };
}

function createPlanSearchIndex(
  taskText: string,
  planPreview: AgentTaskPlanPreview,
): PlanSearchIndex {
  const stepIndexes = planPreview.steps.map((step, index): StepSearchIndex => {
    const stepText = createStepText(step);

    return {
      step,
      stepIndex: index + 1,
      tokens: createTokenSet(stepText),
    };
  });
  const planText = [
    taskText,
    planPreview.taskSummary,
    ...planPreview.steps.map(createStepText),
  ].join(" ");

  return {
    taskTokens: createTokenSet([taskText, planPreview.taskSummary].join(" ")),
    planTokens: createTokenSet(planText),
    steps: stepIndexes,
  };
}

function scoreMemory(input: {
  readonly memory: AgentMemoryContextSnippetInput;
  readonly planSearchIndex: PlanSearchIndex;
}): ScoredMemory {
  const content = normalizeDisplayText(input.memory.content);
  const summary = normalizeDisplayText(input.memory.summary ?? "");
  const tagText = normalizeDisplayText((input.memory.tags ?? []).join(" "));
  const memoryText = [content, summary, tagText].join(" ");
  const memoryTokens = createTokenSet(memoryText);
  const contentTokens = createTokenSet(content);
  const summaryTokens = createTokenSet(summary);
  const tagTokens = createTokenSet(tagText);
  const taskOverlap = getTokenOverlap(
    input.planSearchIndex.taskTokens,
    contentTokens,
  );
  const summaryOverlap = getTokenOverlap(
    input.planSearchIndex.taskTokens,
    summaryTokens,
  );
  const tagOverlap = getTokenOverlap(input.planSearchIndex.planTokens, tagTokens);
  const coveredSteps = input.planSearchIndex.steps.filter((stepIndex) =>
    hasTokenOverlap(stepIndex.tokens, memoryTokens),
  );
  const reasons: string[] = [];
  let score = 0;

  if (taskOverlap.length > 0) {
    score += Math.min(48, taskOverlap.length * 12);
    reasons.push(
      `记忆内容匹配任务关键词：${taskOverlap.slice(0, 5).join(", ")}。`,
    );
  }

  if (summaryOverlap.length > 0) {
    score += Math.min(40, summaryOverlap.length * 14);
    reasons.push(
      `记忆摘要匹配任务关键词：${summaryOverlap
        .slice(0, 5)
        .join(", ")}。`,
    );
  }

  if (tagOverlap.length > 0) {
    score += Math.min(36, tagOverlap.length * 18);
    reasons.push(
      `记忆标签与计划关键词重合：${tagOverlap
        .slice(0, 5)
        .join(", ")}。`,
    );
  }

  if (coveredSteps.length > 0) {
    score += Math.min(36, coveredSteps.length * 12);
    reasons.push(
      `记忆文本与计划步骤重合：${coveredSteps
        .map((step) => step.step.stepId)
        .join(", ")}。`,
    );
  }

  if (score > 0 && input.memory.relevanceScore !== undefined) {
    const callerScore = normalizeCallerRelevanceScore(
      input.memory.relevanceScore,
    );
    score += Math.min(12, Math.round(callerScore * 12));
    reasons.push("调用方提供的相关性分数仅在确定性文本匹配后作为小幅排序参考。");
  }

  if (score > 0 && input.memory.layer === MemoryLayer.Profile) {
    score += 4;
    reasons.push("Profile 记忆在文本匹配后获得小幅优先级。");
  } else if (score > 0 && input.memory.layer === MemoryLayer.Session) {
    score += 2;
    reasons.push("Session 记忆在文本匹配后获得小幅优先级。");
  }

  const relevanceScore = Math.min(100, Math.max(0, Math.round(score)));

  return {
    input: input.memory,
    contentPreview: createContentPreview(input.memory),
    relevanceScore,
    matchLevel: getMatchLevel(relevanceScore),
    matchReasons: reasons,
    coveredSteps,
  };
}

function assembleContext(input: {
  readonly selectedCandidates: readonly ScoredMemory[];
  readonly maxContextChars: number;
}): ContextAssemblyResult {
  const selectedMemories: AgentMemoryContextSelectedSnippet[] = [];
  const excludedMemories: AgentMemoryContextSnippetPreview[] = [];
  const contextBlocks: AgentMemoryContextBlock[] = [];
  let contextPreviewText = "";
  let truncated = false;

  for (const memory of input.selectedCandidates) {
    const blockText = createContextBlockText(memory);
    const separator = contextPreviewText.length === 0 ? "" : "\n\n";
    const nextLength =
      contextPreviewText.length + separator.length + blockText.length;

    if (nextLength <= input.maxContextChars) {
      contextPreviewText = `${contextPreviewText}${separator}${blockText}`;
      contextBlocks.push({
        blockId: `memory_context_block_${contextBlocks.length + 1}`,
        memoryId: memory.input.id,
        layer: memory.input.layer,
        text: blockText,
        charCount: blockText.length,
        truncated: false,
      });
      selectedMemories.push(
        createSnippetPreview({
          memory,
          includedInContext: true,
        }),
      );
      continue;
    }

    const remainingChars = input.maxContextChars - contextPreviewText.length;
    const availableForBlock = remainingChars - separator.length;

    if (availableForBlock > 0) {
      const truncatedBlock = truncateText(blockText, availableForBlock);
      contextPreviewText = `${contextPreviewText}${separator}${truncatedBlock}`;
      contextBlocks.push({
        blockId: `memory_context_block_${contextBlocks.length + 1}`,
        memoryId: memory.input.id,
        layer: memory.input.layer,
        text: truncatedBlock,
        charCount: truncatedBlock.length,
        truncated: true,
      });
      selectedMemories.push(
        createSnippetPreview({
          memory,
          includedInContext: true,
        }),
      );
    } else {
      excludedMemories.push(
        createSnippetPreview({
          memory,
          includedInContext: false,
          exclusionReason: "context_character_budget_exceeded",
        }),
      );
    }

    truncated = true;
  }

  return {
    selectedMemories,
    excludedMemories,
    contextBlocks,
    contextPreviewText,
    contextCharCount: contextPreviewText.length,
    truncated,
  };
}

function createSnippetPreview(input: {
  readonly memory: ScoredMemory;
  readonly includedInContext: boolean;
  readonly exclusionReason?: string;
}): AgentMemoryContextSnippetPreview {
  return {
    id: input.memory.input.id,
    layer: input.memory.input.layer,
    contentPreview: input.memory.contentPreview,
    relevanceScore: input.memory.relevanceScore,
    matchLevel: input.memory.matchLevel,
    matchReasons: input.memory.matchReasons,
    coveredStepIds: input.memory.coveredSteps.map((step) => step.step.stepId),
    coveredStepIndexes: input.memory.coveredSteps.map((step) => step.stepIndex),
    coveredStepSummaries: input.memory.coveredSteps.map(
      (step) => step.step.description,
    ),
    includedInContext: input.includedInContext,
    ...(input.exclusionReason === undefined
      ? {}
      : { exclusionReason: input.exclusionReason }),
    safetyNotes: createSnippetSafetyNotes(input.memory, input.includedInContext),
  };
}

function createContentPreview(memory: AgentMemoryContextSnippetInput): string {
  const previewText = normalizeDisplayText(memory.summary ?? memory.content);

  if (previewText.length === 0) {
    return "未提供记忆内容。";
  }

  return truncateText(previewText, CONTENT_PREVIEW_MAX_CHARS);
}

function createContextBlockText(memory: ScoredMemory): string {
  const content = truncateText(
    normalizeDisplayText(memory.input.summary ?? memory.input.content),
    CONTEXT_BLOCK_CONTENT_MAX_CHARS,
  );
  const coveredStepText =
    memory.coveredSteps.length === 0
      ? "none"
      : memory.coveredSteps.map((step) => step.step.stepId).join(", ");

  return [
    `[memory:${memory.input.id}]`,
    `layer: ${memory.input.layer}`,
    `match: ${memory.matchLevel} (${memory.relevanceScore})`,
    `coveredSteps: ${coveredStepText}`,
    `content: ${content}`,
  ].join("\n");
}

function createStepText(step: AgentTaskPlanStep): string {
  return [
    step.stepId,
    step.title,
    step.description,
    step.kind,
    step.toolName ?? "",
    step.toolCategory ?? "",
  ].join(" ");
}

function createSafetyNotes(input: {
  readonly candidateMemoryCount: number;
  readonly options: NormalizedOptions;
  readonly contextStatus: AgentMemoryContextStatus;
  readonly extraNotes: readonly string[];
}): string[] {
  const notes = [
    "记忆上下文仅为预览。",
    "候选记忆由调用方提供。",
    "未执行记忆检索。",
    "未使用 embedding。",
    "未使用模型摘要。",
    "未保存数据。",
    "未执行工具或 Skill。",
  ];

  if (input.candidateMemoryCount === 0) {
    notes.push("没有可用于匹配的候选记忆。");
  }

  if (input.contextStatus === AgentMemoryContextStatus.Disabled) {
    notes.push("记忆上下文预览已禁用，并保持不可执行。");
  }

  notes.push(
    `记忆层过滤：profile=${input.options.includeProfileMemory.toString()}，session=${input.options.includeSessionMemory.toString()}，retrievable=${input.options.includeRetrievableMemory.toString()}。`,
  );

  notes.push(...input.extraNotes);

  return normalizeUniqueStrings(notes);
}

function createSnippetSafetyNotes(
  memory: ScoredMemory,
  includedInContext: boolean,
): string[] {
  const notes = [
    "该片段只通过确定性关键词和计划步骤匹配进行评估。",
    "该片段未执行检索、embedding、模型摘要、持久化、工具执行或 Skill 执行。",
  ];

  if (!includedInContext) {
    notes.push("该片段未纳入上下文预览文本。");
  }

  if (memory.matchReasons.length === 0) {
    notes.push("没有为该片段找到明确的确定性匹配。");
  }

  return notes;
}

function normalizeOptions(
  options: AgentMemoryContextPreviewOptions | undefined,
): NormalizedOptions {
  return {
    maxSelectedSnippets: normalizePositiveInteger(
      options?.maxSelectedSnippets,
      DEFAULT_MAX_SELECTED_SNIPPETS,
    ),
    maxContextChars: normalizeNonNegativeInteger(
      options?.maxContextChars,
      DEFAULT_MAX_CONTEXT_CHARS,
    ),
    includeProfileMemory: options?.includeProfileMemory ?? true,
    includeSessionMemory: options?.includeSessionMemory ?? true,
    includeRetrievableMemory: options?.includeRetrievableMemory ?? true,
    minimumRelevanceScore: normalizeScore(
      options?.minimumRelevanceScore,
      DEFAULT_MINIMUM_RELEVANCE_SCORE,
    ),
  };
}

function normalizePositiveInteger(
  value: number | undefined,
  fallback: number,
): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.floor(value));
}

function normalizeNonNegativeInteger(
  value: number | undefined,
  fallback: number,
): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.floor(value));
}

function normalizeScore(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(100, Math.max(0, value));
}

function normalizeCallerRelevanceScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value > 1) {
    return Math.min(1, Math.max(0, value / 100));
  }

  return Math.min(1, Math.max(0, value));
}

function hasAnyIncludedLayer(options: NormalizedOptions): boolean {
  return (
    options.includeProfileMemory ||
    options.includeSessionMemory ||
    options.includeRetrievableMemory
  );
}

function isMemoryLayerIncluded(
  layer: MemoryLayerValue,
  options: NormalizedOptions,
): boolean {
  if (layer === MemoryLayer.Profile) {
    return options.includeProfileMemory;
  }

  if (layer === MemoryLayer.Session) {
    return options.includeSessionMemory;
  }

  return options.includeRetrievableMemory;
}

function getMatchLevel(score: number): AgentMemoryContextMatchLevel {
  if (score >= 70) {
    return AgentMemoryContextMatchLevel.High;
  }

  if (score >= 35) {
    return AgentMemoryContextMatchLevel.Medium;
  }

  return AgentMemoryContextMatchLevel.Low;
}

function compareScoredMemories(
  left: ScoredMemory,
  right: ScoredMemory,
): number {
  const scoreDifference = right.relevanceScore - left.relevanceScore;

  if (scoreDifference !== 0) {
    return scoreDifference;
  }

  const layerDifference =
    layerPriority[left.input.layer] - layerPriority[right.input.layer];

  if (layerDifference !== 0) {
    return layerDifference;
  }

  return left.input.id.localeCompare(right.input.id);
}

function getTokenOverlap(
  left: ReadonlySet<string>,
  right: ReadonlySet<string>,
): string[] {
  return [...left]
    .filter((token) => right.has(token))
    .sort((a, b) => a.localeCompare(b));
}

function hasTokenOverlap(
  left: ReadonlySet<string>,
  right: ReadonlySet<string>,
): boolean {
  for (const token of left) {
    if (right.has(token)) {
      return true;
    }
  }

  return false;
}

function createTokenSet(value: string): ReadonlySet<string> {
  const tokens = normalizeSearchText(value).match(/[\p{L}\p{N}_-]+/gu) ?? [];

  return new Set(
    tokens.filter((token) => {
      if (STOP_WORDS.has(token)) {
        return false;
      }

      return token.length >= 3 || token === "ai" || token === "db";
    }),
  );
}

function normalizeSearchText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeDisplayText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeUniqueStrings(values: readonly string[]): string[] {
  const normalizedValues: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const normalized = normalizeDisplayText(value);
    const key = normalized.toLowerCase();

    if (normalized.length > 0 && !seen.has(key)) {
      seen.add(key);
      normalizedValues.push(normalized);
    }
  }

  return normalizedValues.sort((left, right) =>
    left.toLowerCase().localeCompare(right.toLowerCase()),
  );
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  if (maxLength <= 3) {
    return ".".repeat(maxLength);
  }

  return `${text.slice(0, maxLength - 3).trimEnd()}...`;
}

function createPreviewId(
  input: AgentMemoryContextPreviewInput,
  options: NormalizedOptions,
): string {
  const stableParts = [
    input.taskText,
    input.planPreview.previewId,
    input.planPreview.taskSummary,
    options.maxSelectedSnippets.toString(),
    options.maxContextChars.toString(),
    options.minimumRelevanceScore.toString(),
    options.includeProfileMemory.toString(),
    options.includeSessionMemory.toString(),
    options.includeRetrievableMemory.toString(),
    ...input.candidateMemories.flatMap((memory) => [
      memory.id,
      memory.layer,
      memory.content,
      memory.summary ?? "",
      ...(memory.tags ?? []),
      memory.createdAt ?? "",
      memory.updatedAt ?? "",
    ]),
  ];

  return `memory_context_preview_${hashString(stableParts.join("|"))}`;
}

function hashString(value: string): string {
  let hash = 2_166_136_261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619) >>> 0;
  }

  return hash.toString(36).padStart(7, "0");
}
