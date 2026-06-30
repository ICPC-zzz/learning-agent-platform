import type { LlmChatMessage } from "../llm/llm-provider-contract.ts";
import { LlmChatRole } from "../llm/llm-provider-contract.ts";
import {
  ContextBudgetStatus,
  evaluateContextBudget,
} from "../memory/contracts.ts";
import {
  createA505ContextBudget,
  estimateTextTokens,
} from "../memory/a505-context-compression.ts";
import {
  ToolExecutionStatus,
  type ToolExecutionResult,
  type ToolSourceReference,
} from "../tools/index.ts";

export interface ToolResultBudgetConfig {
  maxSingleResultChars: number;
  maxRoundResultChars: number;
  maxLoopResultChars: number;
  maxPreviewChars: number;
  maxEvidenceRefs: number;
  maxArtifacts: number;
}

export interface ToolResultBudgetState {
  roundInjectedChars: number;
  loopInjectedChars: number;
  artifactCount: number;
  evidenceCount: number;
}

export interface ToolResultArtifactRecord {
  artifactId: string;
  ownerUserId: string;
  conversationId: string;
  runId: string;
  toolCallId: string;
  toolName: string;
  contentType: "application/json";
  safePreview: string;
  sourceRefs: readonly ToolSourceReference[];
  size: number;
  createdAt: string;
  expiresAt: string | null;
  sensitiveResultNotPersisted?: boolean;
}

export interface SaveToolResultArtifactInput {
  ownerUserId: string;
  conversationId: string;
  runId: string;
  toolCallId: string;
  toolName: string;
  contentType: "application/json";
  safePreview: string;
  sourceRefs: readonly ToolSourceReference[];
  content: unknown;
  size: number;
  createdAt?: string;
  expiresAt?: string | null;
}

export interface ToolResultArtifactRepository {
  saveToolResultArtifact(input: SaveToolResultArtifactInput): Promise<ToolResultArtifactRecord>;
}

export interface PreparedToolResultForModel {
  safeResult: ToolExecutionResult;
  modelContent: string;
  preview: string;
  injectedChars: number;
  artifact: ToolResultArtifactRecord | null;
  budgetApplied: boolean;
  sensitiveResultNotPersisted: boolean;
}

export interface CompressionCircuitState {
  consecutiveFailures: number;
  lastFailureAt: string | null;
  circuitOpenUntil: string | null;
}

export interface ReliableAgentContextCompressionConfig {
  contextWindowTokens: number;
  maxConsecutiveCompressionFailures: number;
  circuitCooldownMs: number;
  preserveRecentMessageCount: number;
  preserveRecentToolResultCount: number;
  microcompactToolResultChars: number;
  forceCompressionFailure?: boolean;
  summaryModelAvailable?: boolean;
}

export interface ReliableAgentContextState {
  toolBudget: ToolResultBudgetState;
  compressionCircuit: CompressionCircuitState;
  compressedRanges: Set<string>;
}

export interface ReliableAgentContextPreparationEvent {
  type:
    | "tool_result_microcompacted"
    | "context_budget_warning"
    | "context_compressed"
    | "context_compression_failed"
    | "context_compression_paused"
    | "context_blocked";
  safeSummary: string;
  beforeTokens?: number;
  afterTokens?: number;
  compactedMessageCount?: number;
  sourceRange?: string;
}

export interface PreparedMessagesForModel {
  messages: LlmChatMessage[];
  events: ReliableAgentContextPreparationEvent[];
  blocked: boolean;
}

export const DEFAULT_TOOL_RESULT_BUDGET_CONFIG: ToolResultBudgetConfig = {
  maxSingleResultChars: 4_000,
  maxRoundResultChars: 8_000,
  maxLoopResultChars: 18_000,
  maxPreviewChars: 900,
  maxEvidenceRefs: 16,
  maxArtifacts: 8,
};

export const DEFAULT_CONTEXT_COMPRESSION_CONFIG: ReliableAgentContextCompressionConfig = {
  contextWindowTokens: 16_000,
  maxConsecutiveCompressionFailures: 3,
  circuitCooldownMs: 5 * 60 * 1000,
  preserveRecentMessageCount: 6,
  preserveRecentToolResultCount: 1,
  microcompactToolResultChars: 1_200,
  summaryModelAvailable: false,
};

export function createReliableAgentContextState(): ReliableAgentContextState {
  return {
    toolBudget: {
      roundInjectedChars: 0,
      loopInjectedChars: 0,
      artifactCount: 0,
      evidenceCount: 0,
    },
    compressionCircuit: {
      consecutiveFailures: 0,
      lastFailureAt: null,
      circuitOpenUntil: null,
    },
    compressedRanges: new Set<string>(),
  };
}

export function resetToolResultRoundBudget(state: ReliableAgentContextState): void {
  state.toolBudget.roundInjectedChars = 0;
}

export async function prepareToolResultForModel(input: {
  result: ToolExecutionResult;
  config?: Partial<ToolResultBudgetConfig>;
  state: ReliableAgentContextState;
  artifactRepository?: ToolResultArtifactRepository;
  ownerUserId?: string;
  conversationId?: string;
  runId?: string;
}): Promise<PreparedToolResultForModel> {
  const config = { ...DEFAULT_TOOL_RESULT_BUDGET_CONFIG, ...(input.config ?? {}) };
  const sanitized = sanitizeToolResultForModel(input.result, config.maxEvidenceRefs);
  const preview = createToolResultPreview(sanitized.safeResult, config.maxPreviewChars);
  const directPayload = createModelVisibleToolResultPayload({
    result: sanitized.safeResult,
    preview,
    artifact: null,
    truncated: false,
    sensitiveResultNotPersisted: false,
  });
  const directContent = JSON.stringify(directPayload);
  const wouldExceedSingle = directContent.length > config.maxSingleResultChars;
  const wouldExceedRound =
    input.state.toolBudget.roundInjectedChars + directContent.length > config.maxRoundResultChars;
  const wouldExceedLoop =
    input.state.toolBudget.loopInjectedChars + directContent.length > config.maxLoopResultChars;
  const mustSummarize = wouldExceedSingle || wouldExceedRound || wouldExceedLoop;

  if (!mustSummarize && !sanitized.sensitiveDetected) {
    registerInjectedChars(input.state, directContent.length, sanitized.safeResult.sourceRefs.length);
    return {
      safeResult: sanitized.safeResult,
      modelContent: directContent,
      preview,
      injectedChars: directContent.length,
      artifact: null,
      budgetApplied: false,
      sensitiveResultNotPersisted: false,
    };
  }

  let artifact: ToolResultArtifactRecord | null = null;
  const artifactRepository = input.artifactRepository;
  const ownerUserId = input.ownerUserId;
  const conversationId = input.conversationId;
  const runId = input.runId;
  const canPersistArtifact =
    !sanitized.sensitiveDetected &&
    artifactRepository !== undefined &&
    ownerUserId !== undefined &&
    conversationId !== undefined &&
    runId !== undefined &&
    input.state.toolBudget.artifactCount < config.maxArtifacts;

  if (canPersistArtifact) {
    const content = createArtifactContent(sanitized.safeResult);
    artifact = await artifactRepository.saveToolResultArtifact({
      ownerUserId,
      conversationId,
      runId,
      toolCallId: sanitized.safeResult.toolCallId,
      toolName: sanitized.safeResult.toolName,
      contentType: "application/json",
      safePreview: preview,
      sourceRefs: sanitized.safeResult.sourceRefs,
      content,
      size: JSON.stringify(content).length,
    });
    input.state.toolBudget.artifactCount += 1;
  }

  const previewPayload = createModelVisibleToolResultPayload({
    result: sanitized.safeResult,
    preview,
    artifact,
    truncated: true,
    sensitiveResultNotPersisted: sanitized.sensitiveDetected,
  });
  const previewContent = stringifyPayloadWithinBudget(previewPayload, config.maxSingleResultChars);
  registerInjectedChars(input.state, previewContent.length, sanitized.safeResult.sourceRefs.length);

  const safeResult = {
    ...sanitized.safeResult,
    output: {
      preview,
      sourceRefs: sanitized.safeResult.sourceRefs,
      ...(artifact
        ? {
            artifactRef: {
              artifactId: artifact.artifactId,
              toolCallId: artifact.toolCallId,
              toolName: artifact.toolName,
              contentType: artifact.contentType,
            },
          }
        : {}),
      truncated: true,
      sensitiveResultNotPersisted: sanitized.sensitiveDetected,
    },
    metadata: {
      ...(sanitized.safeResult.metadata ?? {}),
      toolResultBudgetApplied: true,
      ...(artifact ? { artifactId: artifact.artifactId } : {}),
      ...(sanitized.sensitiveDetected ? { sensitiveResultNotPersisted: true } : {}),
    },
  } satisfies ToolExecutionResult;

  return {
    safeResult,
    modelContent: previewContent,
    preview,
    injectedChars: previewContent.length,
    artifact,
    budgetApplied: true,
    sensitiveResultNotPersisted: sanitized.sensitiveDetected,
  };
}

export function prepareMessagesForProvider(input: {
  messages: readonly LlmChatMessage[];
  state: ReliableAgentContextState;
  protectToolCallIds?: ReadonlySet<string>;
  compression?: Partial<ReliableAgentContextCompressionConfig>;
}): PreparedMessagesForModel {
  const config = { ...DEFAULT_CONTEXT_COMPRESSION_CONFIG, ...(input.compression ?? {}) };
  const events: ReliableAgentContextPreparationEvent[] = [];
  let messages = [...input.messages];

  const micro = microcompactToolMessages({
    messages,
    protectToolCallIds: input.protectToolCallIds ?? new Set<string>(),
    maxToolContentChars: config.microcompactToolResultChars,
    preserveRecentToolResultCount: config.preserveRecentToolResultCount,
  });
  messages = micro.messages;
  if (micro.compactedCount > 0) {
    events.push({
      type: "tool_result_microcompacted",
      safeSummary: "已压缩较早的工具结果，仅保留安全摘要和来源引用。",
      compactedMessageCount: micro.compactedCount,
    });
  }

  const beforeTokens = estimateMessagesTokens(messages);
  const budget = createA505ContextBudget(config.contextWindowTokens);
  const budgetResult = evaluateContextBudget({
    budget,
    currentInputTokens: beforeTokens,
  });

  if (budgetResult.status === ContextBudgetStatus.Warning) {
    events.push({
      type: "context_budget_warning",
      safeSummary: "上下文接近上限，已保留最近对话和关键来源。",
      beforeTokens,
    });
    return { messages, events, blocked: false };
  }

  if (
    budgetResult.status !== ContextBudgetStatus.NeedsCompression &&
    budgetResult.status !== ContextBudgetStatus.Blocking
  ) {
    return { messages, events, blocked: false };
  }

  if (isCompressionCircuitOpen(input.state.compressionCircuit)) {
    events.push({
      type: "context_compression_paused",
      safeSummary: "自动整理暂时暂停，当前仅执行安全摘要和阻断策略。",
      beforeTokens,
    });
    return {
      messages,
      events,
      blocked: budgetResult.status === ContextBudgetStatus.Blocking,
    };
  }

  if (config.forceCompressionFailure) {
    recordCompressionFailure(input.state.compressionCircuit, config);
    events.push({
      type: isCompressionCircuitOpen(input.state.compressionCircuit)
        ? "context_compression_paused"
        : "context_compression_failed",
      safeSummary: isCompressionCircuitOpen(input.state.compressionCircuit)
        ? "自动整理暂时暂停，当前仅执行安全摘要和阻断策略。"
        : "上下文自动整理失败，已保留当前最近对话。",
      beforeTokens,
    });
    return {
      messages,
      events,
      blocked: budgetResult.status === ContextBudgetStatus.Blocking &&
        isCompressionCircuitOpen(input.state.compressionCircuit),
    };
  }

  const compressed = compressOlderMessages({
    messages,
    protectToolCallIds: input.protectToolCallIds ?? new Set<string>(),
    preserveRecentMessageCount: config.preserveRecentMessageCount,
    compressedRanges: input.state.compressedRanges,
  });
  messages = compressed.messages;
  const afterTokens = estimateMessagesTokens(messages);

  if (compressed.compactedMessageCount > 0 && afterTokens < beforeTokens) {
    input.state.compressionCircuit.consecutiveFailures = 0;
    input.state.compressionCircuit.lastFailureAt = null;
    input.state.compressionCircuit.circuitOpenUntil = null;
    events.push({
      type: "context_compressed",
      safeSummary: config.summaryModelAvailable === false
        ? "上下文已自动整理：使用确定性摘要降级，未调用摘要模型。"
        : "上下文已自动整理，关键来源和最近对话已保留。",
      beforeTokens,
      afterTokens,
      compactedMessageCount: compressed.compactedMessageCount,
      sourceRange: compressed.sourceRange,
    });
    return { messages, events, blocked: false };
  }

  recordCompressionFailure(input.state.compressionCircuit, config);
  events.push({
    type: isCompressionCircuitOpen(input.state.compressionCircuit)
      ? "context_compression_paused"
      : "context_compression_failed",
    safeSummary: isCompressionCircuitOpen(input.state.compressionCircuit)
      ? "自动整理暂时暂停，当前仅执行安全摘要和阻断策略。"
      : "上下文自动整理未能降低预算，已保留当前最近对话。",
    beforeTokens,
    afterTokens,
  });

  return {
    messages,
    events,
    blocked: budgetResult.status === ContextBudgetStatus.Blocking,
  };
}

export function isCompressionCircuitOpen(
  state: CompressionCircuitState,
  now = Date.now(),
): boolean {
  if (!state.circuitOpenUntil) {
    return false;
  }
  const until = new Date(state.circuitOpenUntil).getTime();
  return Number.isFinite(until) && until > now;
}

function registerInjectedChars(
  state: ReliableAgentContextState,
  chars: number,
  evidenceCount: number,
): void {
  state.toolBudget.roundInjectedChars += chars;
  state.toolBudget.loopInjectedChars += chars;
  state.toolBudget.evidenceCount += evidenceCount;
}

function sanitizeToolResultForModel(
  result: ToolExecutionResult,
  maxEvidenceRefs: number,
): {
  safeResult: ToolExecutionResult;
  sensitiveDetected: boolean;
} {
  const sanitizedOutput = sanitizeModelVisibleValue(result.output, 0);
  const sourceRefs = result.sourceRefs
    .slice(0, maxEvidenceRefs)
    .map((source) => sanitizeSourceRef(source));
  const safeResult = {
    ...result,
    safeSummary: sanitizeSensitiveString(result.safeSummary).value,
    sourceRefs,
    output: sanitizedOutput.value,
    metadata: sanitizeMetadata(result.metadata),
  } satisfies ToolExecutionResult;
  return {
    safeResult,
    sensitiveDetected: sanitizedOutput.sensitiveDetected,
  };
}

function createModelVisibleToolResultPayload(input: {
  result: ToolExecutionResult;
  preview: string;
  artifact: ToolResultArtifactRecord | null;
  truncated: boolean;
  sensitiveResultNotPersisted: boolean;
}): Record<string, unknown> {
  return {
    status: input.result.status,
    toolName: input.result.toolName,
    toolCallId: input.result.toolCallId,
    safeSummary: input.result.safeSummary,
    sourceRefs: input.result.sourceRefs.map((ref) => ({
      title: ref.title,
      source: ref.source,
      ...(ref.recordId ? { recordId: ref.recordId } : {}),
      ...(ref.safeSummary ? { safeSummary: ref.safeSummary } : {}),
      ...(ref.cached !== undefined ? { cached: ref.cached } : {}),
      ...(ref.url && ref.url.startsWith("http") ? { url: ref.url } : {}),
    })),
    preview: input.preview,
    output: input.truncated ? undefined : input.result.output,
    truncated: input.truncated,
    sensitiveResultNotPersisted: input.sensitiveResultNotPersisted,
    ...(input.artifact
      ? {
          artifactRef: {
            artifactId: input.artifact.artifactId,
            toolCallId: input.artifact.toolCallId,
            toolName: input.artifact.toolName,
            contentType: input.artifact.contentType,
          },
        }
      : {}),
  };
}

function stringifyPayloadWithinBudget(
  payload: Record<string, unknown>,
  maxChars: number,
): string {
  const direct = JSON.stringify(payload);
  if (direct.length <= maxChars) {
    return direct;
  }

  const compact = {
    status: payload.status,
    toolName: payload.toolName,
    toolCallId: payload.toolCallId,
    safeSummary: typeof payload.safeSummary === "string"
      ? limitString(payload.safeSummary, 180)
      : payload.safeSummary,
    sourceRefs: Array.isArray(payload.sourceRefs)
      ? payload.sourceRefs.slice(0, 2)
      : [],
    preview: typeof payload.preview === "string"
      ? limitString(payload.preview, Math.max(80, Math.floor(maxChars / 3)))
      : "",
    truncated: payload.truncated,
    sensitiveResultNotPersisted: payload.sensitiveResultNotPersisted,
    artifactRef: payload.artifactRef,
  };
  const compactContent = JSON.stringify(compact);
  if (compactContent.length <= maxChars) {
    return compactContent;
  }

  return JSON.stringify({
    status: payload.status,
    toolName: payload.toolName,
    toolCallId: payload.toolCallId,
    safeSummary: typeof payload.safeSummary === "string"
      ? limitString(payload.safeSummary, 140)
      : "工具结果已摘要。",
    preview: "工具结果已摘要，完整安全结果仅可通过服务端 Artifact 所有权校验读取。",
    truncated: true,
    sensitiveResultNotPersisted: payload.sensitiveResultNotPersisted,
    artifactRef: payload.artifactRef,
  });
}

function createArtifactContent(result: ToolExecutionResult): Record<string, unknown> {
  return {
    toolCallId: result.toolCallId,
    toolName: result.toolName,
    status: result.status,
    safeSummary: result.safeSummary,
    sourceRefs: result.sourceRefs,
    output: result.output,
    cached: result.cached === true,
    startedAt: result.startedAt,
    completedAt: result.completedAt,
    durationMs: result.durationMs,
  };
}

function createToolResultPreview(result: ToolExecutionResult, maxChars: number): string {
  const lines = [
    `工具：${result.toolName}`,
    `状态：${result.status}`,
    result.safeSummary,
    ...result.sourceRefs.slice(0, 4).map((source) =>
      `来源：${source.title} / ${source.source}`,
    ),
    previewValue(result.output),
  ].filter((line) => line.trim().length > 0);
  return limitString(lines.join("\n"), maxChars);
}

function previewValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function microcompactToolMessages(input: {
  messages: readonly LlmChatMessage[];
  protectToolCallIds: ReadonlySet<string>;
  maxToolContentChars: number;
  preserveRecentToolResultCount: number;
}): {
  messages: LlmChatMessage[];
  compactedCount: number;
} {
  const toolIndexes = input.messages
    .map((message, index) => ({ message, index }))
    .filter((entry) => entry.message.role === LlmChatRole.Tool);
  const recent = new Set(
    toolIndexes
      .slice(-Math.max(0, input.preserveRecentToolResultCount))
      .map((entry) => entry.index),
  );
  let compactedCount = 0;
  const messages = input.messages.map((message, index) => {
    if (
      message.role !== LlmChatRole.Tool ||
      !message.toolCallId ||
      input.protectToolCallIds.has(message.toolCallId) ||
      recent.has(index) ||
      message.content.length <= input.maxToolContentChars
    ) {
      return message;
    }
    const compacted = compactToolMessageContent(message.content, input.maxToolContentChars);
    if (compacted === message.content) {
      return message;
    }
    compactedCount += 1;
    return {
      ...message,
      content: compacted,
    };
  });
  return { messages, compactedCount };
}

function compactToolMessageContent(content: string, maxChars: number): string {
  const parsed = parseJsonObject(content);
  if (parsed?.microcompacted === true) {
    return content;
  }
  const parsedObject = parsed ?? {};
  const status = typeof parsedObject.status === "string" ? parsedObject.status : "unknown";
  if (
    status === ToolExecutionStatus.Cancelled ||
    status === ToolExecutionStatus.TimedOut ||
    status === ToolExecutionStatus.PermissionDenied
  ) {
    return content;
  }
  const sourceRefs = Array.isArray(parsedObject.sourceRefs)
    ? parsedObject.sourceRefs.slice(0, 6)
    : [];
  const compacted = {
    status,
    toolName: typeof parsedObject.toolName === "string" ? parsedObject.toolName : "unknown_tool",
    toolCallId: typeof parsedObject.toolCallId === "string" ? parsedObject.toolCallId : undefined,
    safeSummary: typeof parsedObject.safeSummary === "string"
      ? parsedObject.safeSummary
      : "较早工具结果已压缩为安全摘要。",
    sourceRefs,
    artifactRef: parsedObject.artifactRef,
    truncated: parsedObject.truncated === true,
    microcompacted: true,
  };
  return limitString(JSON.stringify(compacted), maxChars);
}

function compressOlderMessages(input: {
  messages: readonly LlmChatMessage[];
  protectToolCallIds: ReadonlySet<string>;
  preserveRecentMessageCount: number;
  compressedRanges: Set<string>;
}): {
  messages: LlmChatMessage[];
  compactedMessageCount: number;
  sourceRange: string;
} {
  if (input.messages.length <= input.preserveRecentMessageCount + 2) {
    return {
      messages: [...input.messages],
      compactedMessageCount: 0,
      sourceRange: "",
    };
  }

  const preserve = new Set<number>();
  preserve.add(0);
  for (
    let index = Math.max(0, input.messages.length - input.preserveRecentMessageCount);
    index < input.messages.length;
    index += 1
  ) {
    preserve.add(index);
  }

  for (let index = 0; index < input.messages.length; index += 1) {
    const message = input.messages[index];
    if (message.role === LlmChatRole.Tool && message.toolCallId && input.protectToolCallIds.has(message.toolCallId)) {
      preserve.add(index);
      const assistantIndex = findAssistantToolCallMessageIndex(input.messages, message.toolCallId);
      if (assistantIndex >= 0) {
        preserve.add(assistantIndex);
      }
    }
  }

  for (let index = 0; index < input.messages.length; index += 1) {
    const message = input.messages[index];
    if (message.role === LlmChatRole.Assistant && message.toolCalls) {
      const hasPreservedToolResult = message.toolCalls.some((call) =>
        input.messages.some((candidate, candidateIndex) =>
          preserve.has(candidateIndex) &&
          candidate.role === LlmChatRole.Tool &&
          candidate.toolCallId === call.id,
        ),
      );
      if (hasPreservedToolResult) {
        preserve.add(index);
      }
    }
  }

  const compactableEntries = input.messages
    .map((message, index) => ({ message, index }))
    .filter((entry) => !preserve.has(entry.index));
  if (compactableEntries.length === 0) {
    return {
      messages: [...input.messages],
      compactedMessageCount: 0,
      sourceRange: "",
    };
  }

  const firstIndex = compactableEntries[0].index;
  const lastIndex = compactableEntries[compactableEntries.length - 1].index;
  const sourceRange = `${firstIndex}-${lastIndex}`;
  if (input.compressedRanges.has(sourceRange)) {
    return {
      messages: [...input.messages],
      compactedMessageCount: 0,
      sourceRange,
    };
  }
  input.compressedRanges.add(sourceRange);

  const summary = buildDeterministicContextSummary(compactableEntries.map((entry) => entry.message), sourceRange);
  const next: LlmChatMessage[] = [];
  for (let index = 0; index < input.messages.length; index += 1) {
    if (index === firstIndex) {
      next.push({
        role: LlmChatRole.System,
        content: summary,
      });
    }
    if (!preserve.has(index)) {
      continue;
    }
    next.push(input.messages[index]);
  }

  return {
    messages: next,
    compactedMessageCount: compactableEntries.length,
    sourceRange,
  };
}

function buildDeterministicContextSummary(
  messages: readonly LlmChatMessage[],
  sourceRange: string,
): string {
  const userGoals = takeLines(messages, LlmChatRole.User, 3);
  const assistantSteps = takeLines(messages, LlmChatRole.Assistant, 3);
  const toolFindings = messages
    .filter((message) => message.role === LlmChatRole.Tool)
    .map((message) => parseJsonObject(message.content))
    .filter((value): value is Record<string, unknown> => value !== null)
    .map((value) => {
      const toolName = typeof value.toolName === "string" ? value.toolName : "unknown_tool";
      const status = typeof value.status === "string" ? value.status : "unknown";
      const summary = typeof value.safeSummary === "string" ? value.safeSummary : "工具结果已摘要。";
      return `${toolName} / ${status}：${summary}`;
    })
    .slice(0, 5);

  return [
    "结构化会话摘要（确定性降级，未包含隐藏 Prompt 或原始工具输出）",
    `来源消息范围：${sourceRange}`,
    "当前用户目标：",
    ...formatSummaryItems(userGoals),
    "已完成步骤：",
    ...formatSummaryItems(assistantSteps),
    "关键 Tool 结论：",
    ...formatSummaryItems(toolFindings),
    "关键 Evidence：已保留在后续工具摘要和任务 Evidence 中。",
    "当前限制和失败项：若工具失败、取消或超时，保留其安全状态摘要。",
    "尚未完成任务：继续基于最近消息和未完成 Tool Call/Result 配对处理。",
    "用户长期偏好引用：保留已注入的 active 长期记忆摘要。",
    "下一步建议：根据最近用户消息继续执行，不展开旧原文。",
  ].join("\n");
}

function takeLines(
  messages: readonly LlmChatMessage[],
  role: LlmChatRole,
  limit: number,
): string[] {
  return messages
    .filter((message) => message.role === role && message.content.trim().length > 0)
    .map((message) => sanitizeSensitiveString(message.content).value.replace(/\s+/g, " ").slice(0, 180))
    .slice(-limit);
}

function formatSummaryItems(items: readonly string[]): string[] {
  return items.length > 0
    ? items.map((item) => `- ${item}`)
    : ["- 暂无明确条目。"];
}

function findAssistantToolCallMessageIndex(
  messages: readonly LlmChatMessage[],
  toolCallId: string,
): number {
  return messages.findIndex((message) =>
    message.role === LlmChatRole.Assistant &&
    message.toolCalls?.some((call) => call.id === toolCallId),
  );
}

function recordCompressionFailure(
  state: CompressionCircuitState,
  config: ReliableAgentContextCompressionConfig,
): void {
  state.consecutiveFailures += 1;
  state.lastFailureAt = new Date().toISOString();
  if (state.consecutiveFailures >= config.maxConsecutiveCompressionFailures) {
    state.circuitOpenUntil = new Date(Date.now() + config.circuitCooldownMs).toISOString();
  }
}

function estimateMessagesTokens(messages: readonly LlmChatMessage[]): number {
  return estimateTextTokens(messages.map((message) => {
    const toolCalls = message.toolCalls?.map((call) => `${call.name}:${call.id}`).join(",") ?? "";
    return `${message.role}:${message.content}${toolCalls}`;
  }).join("\n"));
}

function sanitizeModelVisibleValue(
  value: unknown,
  depth: number,
): { value: unknown; sensitiveDetected: boolean } {
  if (depth > 5) {
    return { value: "[truncated]", sensitiveDetected: false };
  }
  if (value === null || value === undefined) {
    return { value, sensitiveDetected: false };
  }
  if (typeof value === "string") {
    return sanitizeSensitiveString(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return { value, sensitiveDetected: false };
  }
  if (Array.isArray(value)) {
    let sensitiveDetected = false;
    const next = value.slice(0, 40).map((item) => {
      const sanitized = sanitizeModelVisibleValue(item, depth + 1);
      sensitiveDetected = sensitiveDetected || sanitized.sensitiveDetected;
      return sanitized.value;
    });
    return { value: next, sensitiveDetected };
  }
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    let sensitiveDetected = false;
    for (const [key, child] of Object.entries(value as Record<string, unknown>).slice(0, 80)) {
      if (isSensitiveKey(key)) {
        output[key] = "[redacted]";
        sensitiveDetected = true;
        continue;
      }
      const sanitized = sanitizeModelVisibleValue(child, depth + 1);
      output[key] = sanitized.value;
      sensitiveDetected = sensitiveDetected || sanitized.sensitiveDetected;
    }
    return { value: output, sensitiveDetected };
  }
  return { value: undefined, sensitiveDetected: false };
}

function sanitizeMetadata(value: ToolExecutionResult["metadata"]): ToolExecutionResult["metadata"] {
  if (!value) {
    return undefined;
  }
  const sanitized = sanitizeModelVisibleValue(value, 0).value;
  return sanitized && typeof sanitized === "object" && !Array.isArray(sanitized)
    ? sanitized as ToolExecutionResult["metadata"]
    : undefined;
}

function sanitizeSourceRef(source: ToolSourceReference): ToolSourceReference {
  return {
    title: sanitizeSensitiveString(source.title).value,
    source: sanitizeSensitiveString(source.source).value,
    ...(source.url && source.url.startsWith("http") ? { url: source.url } : {}),
    ...(source.recordId ? { recordId: sanitizeSensitiveString(source.recordId).value } : {}),
    ...(source.cached !== undefined ? { cached: source.cached } : {}),
    ...(source.safeSummary ? { safeSummary: sanitizeSensitiveString(source.safeSummary).value } : {}),
  };
}

function sanitizeSensitiveString(value: string): {
  value: string;
  sensitiveDetected: boolean;
} {
  let sensitiveDetected = false;
  const redacted = String(value ?? "")
    .replace(/\bbearer\s+\S+/gi, () => {
      sensitiveDetected = true;
      return "bearer [redacted]";
    })
    .replace(/\b(api[_\s-]?key|api[_\s-]?secret|access[_\s-]?token|refresh[_\s-]?token|authorization|password|secret|credential|cookie|private[_\s-]?key|client[_\s-]?secret)\b\s*[:=]\s*("[^"]+"|'[^']+'|[^\s,;，；]+)/gi, (_match, key) => {
      sensitiveDetected = true;
      return `${key}=[redacted]`;
    })
    .replace(/\b(postgres|postgresql|mysql|mongodb):\/\/[^\s]+/gi, () => {
      sensitiveDetected = true;
      return "[redacted-database-url]";
    })
    .replace(/\b(sk-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9_]{8,}|xox[baprs]-[A-Za-z0-9-]{8,})\b/g, () => {
      sensitiveDetected = true;
      return "[redacted-secret]";
    });
  return {
    value: redacted,
    sensitiveDetected,
  };
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
  if (
    normalized === "rawresponsestored" ||
    normalized === "rawpromptstored" ||
    normalized === "rawproviderresponsestored" ||
    normalized === "rawoutputstored"
  ) {
    return false;
  }
  return /(api[_-]?key|authorization|password|token|cookie|credential|secret|database(url)?|raw(prompt|providerresponse|provider|response|output)$|prompt|providerresponse|stack|internalpath|filepath|file_path)/i.test(key);
}

function parseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function limitString(value: string, maxChars: number): string {
  const limit = Math.max(32, Math.trunc(maxChars));
  return value.length <= limit ? value : `${value.slice(0, limit - 3).trimEnd()}...`;
}
