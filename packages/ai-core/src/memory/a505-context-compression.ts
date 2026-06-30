import {
  CompressionReason,
  ContextBudgetStatus,
  evaluateContextBudget,
  type ContextBudget,
  type ContextBudgetResult,
} from "./contracts.ts";

export type ConversationMessageRole = "user" | "assistant" | "system";

export interface ConversationSession {
  readonly id: string;
  readonly userId: string;
  readonly title: string;
  readonly status?: "active" | "archived" | "deleted";
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly archivedAt?: string | null;
  readonly deletedAt?: string | null;
  readonly lastCompressedAt: string | null;
  readonly compressionCount: number;
}

export interface ConversationMessage {
  readonly id: string;
  readonly conversationId: string;
  readonly role: ConversationMessageRole;
  readonly visibleContent: string;
  readonly createdAt: string;
  readonly archivedAt?: string;
  readonly compressionId?: string;
}

export interface StructuredCompressionSummary {
  readonly userCurrentGoal: readonly string[];
  readonly confirmedFacts: readonly string[];
  readonly explicitConstraints: readonly string[];
  readonly decisionsMade: readonly string[];
  readonly unresolvedQuestions: readonly string[];
  readonly importantCodeOrErrorClues: readonly string[];
  readonly recentConversationState: readonly string[];
}

export interface ConversationCompression {
  readonly id: string;
  readonly conversationId: string;
  readonly reason: CompressionReason;
  readonly trigger: "manual_button" | "conversation_command" | "auto_budget";
  readonly summary: StructuredCompressionSummary;
  readonly summaryText: string;
  readonly beforeEstimatedTokens: number;
  readonly afterEstimatedTokens: number;
  readonly archivedMessageCount: number;
  readonly retainedMessageCount: number;
  readonly compressedThroughMessageId: string;
  readonly createdAt: string;
  readonly compressorKind: "local_structured_v1";
}

export interface ActiveConversationContext {
  readonly systemConstraint: string;
  readonly latestCompression: ConversationCompression | null;
  readonly activeMessages: readonly ConversationMessage[];
  readonly includedMessageIds: readonly string[];
  readonly excludedArchivedMessageIds: readonly string[];
  readonly estimatedTokens: number;
  readonly budget: ContextBudget;
  readonly budgetResult: ContextBudgetResult;
  readonly contextText: string;
}

export interface ConversationCompressionState {
  readonly session: ConversationSession;
  readonly messages: readonly ConversationMessage[];
  readonly compressions: readonly ConversationCompression[];
  readonly activeContext: ActiveConversationContext;
}

export const LOCAL_STRUCTURED_COMPRESSOR_KIND = "local_structured_v1";
export const DEFAULT_A505_CONTEXT_WINDOW_TOKENS = 4096;
export const A505_RESERVED_OUTPUT_TOKENS = 512;
export const A505_WARNING_RATIO = 0.7;
export const A505_COMPRESSION_RATIO = 0.85;
export const A505_BLOCKING_RATIO = 0.95;
export const A505_RETAIN_RECENT_MESSAGE_COUNT = 2;
export const A505_MIN_COMPRESSIBLE_MESSAGE_COUNT = 2;

export function createA505ContextBudget(
  contextWindowTokens = DEFAULT_A505_CONTEXT_WINDOW_TOKENS,
): ContextBudget {
  const contextWindow = Math.max(512, Math.trunc(contextWindowTokens));
  const reservedOutputTokens = Math.min(
    Math.max(128, Math.trunc(contextWindow * 0.125)),
    A505_RESERVED_OUTPUT_TOKENS,
  );
  const effectiveInputLimit = Math.max(1, contextWindow - reservedOutputTokens);

  return {
    contextWindowTokens: contextWindow,
    reservedOutputTokens,
    warningBufferTokens: Math.max(
      0,
      effectiveInputLimit - Math.floor(effectiveInputLimit * A505_WARNING_RATIO),
    ),
    compressionBufferTokens: Math.max(
      0,
      effectiveInputLimit - Math.floor(effectiveInputLimit * A505_COMPRESSION_RATIO),
    ),
    blockingBufferTokens: Math.max(
      0,
      effectiveInputLimit - Math.floor(effectiveInputLimit * A505_BLOCKING_RATIO),
    ),
  };
}

export function estimateConversationTokens(
  messages: readonly Pick<ConversationMessage, "role" | "visibleContent">[],
  extraText = "",
): number {
  const body = [
    extraText,
    ...messages.map((message) => `${message.role}: ${message.visibleContent}`),
  ].join("\n");
  return estimateTextTokens(body);
}

export function estimateTextTokens(value: string): number {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  if (normalized.length === 0) {
    return 0;
  }

  const cjkChars = normalized.match(/[\u3400-\u9fff]/gu)?.length ?? 0;
  const nonCjkChars = Math.max(0, normalized.length - cjkChars);
  return Math.max(1, Math.ceil(cjkChars * 0.8 + nonCjkChars / 4));
}

export function isExplicitCompressionCommand(input: string): boolean {
  const text = normalizeForIntent(input);
  if (text.length === 0) {
    return false;
  }

  const knowledgeQuestion =
    /(什么是|什么叫|如何理解|为什么|原理|介绍|解释|区别|好处|坏处).*(上下文压缩|压缩上下文|会话压缩)/.test(text);
  if (knowledgeQuestion) {
    return false;
  }

  return [
    /^请?压缩(一下)?(当前)?(这段)?(会话|对话|上下文)$/,
    /^帮我压缩(一下)?(当前)?(会话|对话|上下文)$/,
    /^请?(整理|总结)(并)?压缩(当前|这段)?(会话|对话|上下文)$/,
    /^总结当前(会话|对话)并释放上下文$/,
    /^释放(当前)?上下文$/,
    /^压缩当前上下文$/,
  ].some((pattern) => pattern.test(text));
}

export function createStructuredCompressionSummary(
  messages: readonly ConversationMessage[],
): StructuredCompressionSummary {
  const sourceMessages = messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .filter((message) => normalizeVisibleText(message.visibleContent).length > 0);
  const summaryMessages = sourceMessages.filter(
    (message) => !isLocalPreviewBoilerplate(sanitizeCompressionText(message.visibleContent)),
  );

  return {
    userCurrentGoal: collectMatchingLines(summaryMessages, [
      /目标|我要|我想|希望|需要|请|帮我|实现|完成|验收/,
    ]),
    confirmedFacts: collectMatchingLines(summaryMessages, [
      /当前|已经|已|存在|使用|采用|完成|通过|失败|报错|配置|目录|文件/,
    ]),
    explicitConstraints: collectMatchingLines(summaryMessages, [
      /必须|不要|不能|禁止|只|不得|不允许|优先|默认|需要|安全|权限|边界/,
    ]),
    decisionsMade: collectMatchingLines(summaryMessages, [
      /决定|采用|选择|确认|已确定|结论|保留|改为|不再/,
    ]),
    unresolvedQuestions: collectMatchingLines(summaryMessages, [
      /未完成|尚未|待|问题|风险|阻塞|失败|错误|报错|\?|？|TODO|FIXME/,
    ]),
    importantCodeOrErrorClues: collectMatchingLines(summaryMessages, [
      /[A-Za-z0-9_-]+\.(ts|tsx|js|jsx|mjs|json|md|prisma)|`[^`]+`|TypeError|ReferenceError|SyntaxError|Error:|failed|失败|报错|异常|stack|line\s+\d+/i,
    ]),
    recentConversationState: summaryMessages.slice(-3).map((message) =>
      `${roleLabel(message.role)}：${limitSummaryLine(message.visibleContent)}`,
    ),
  };
}

export function formatStructuredCompressionSummary(
  summary: StructuredCompressionSummary,
): string {
  const sections: Array<[string, readonly string[]]> = [
    ["用户当前目标", summary.userCurrentGoal],
    ["已确认事实", summary.confirmedFacts],
    ["用户明确约束", summary.explicitConstraints],
    ["已经做出的决定", summary.decisionsMade],
    ["尚未解决的问题", summary.unresolvedQuestions],
    ["重要代码或错误线索", summary.importantCodeOrErrorClues],
  ];

  const nonEmptySections = sections.filter(([, items]) => items.length > 0);
  if (nonEmptySections.length === 0) {
    return "本地结构化压缩 v1：暂无明确可压缩事实。";
  }

  return nonEmptySections
    .map(([title, items]) => `${title}\n${items.map((item) => `- ${item}`).join("\n")}`)
    .join("\n\n");
}

export function buildActiveConversationContext(input: {
  readonly session: ConversationSession;
  readonly messages: readonly ConversationMessage[];
  readonly compressions: readonly ConversationCompression[];
  readonly contextWindowTokens?: number;
}): ActiveConversationContext {
  const latestCompression = [...input.compressions].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  )[0] ?? null;
  const activeMessages = input.messages.filter((message) => message.archivedAt === undefined);
  const archivedMessages = input.messages.filter((message) => message.archivedAt !== undefined);
  const systemConstraint =
    "稳定系统约束：本地结构化压缩 v1；不调用真实 LLM；不携带已归档旧消息；不保存 raw prompt/raw response/credential。";
  const contextText = [
    systemConstraint,
    latestCompression ? `最近有效压缩摘要\n${latestCompression.summaryText}` : "",
    activeMessages.map((message) => `${roleLabel(message.role)}：${message.visibleContent}`).join("\n"),
  ]
    .filter((part) => part.trim().length > 0)
    .join("\n\n");
  const estimatedTokens = estimateTextTokens(contextText);
  const budget = createA505ContextBudget(input.contextWindowTokens);

  return {
    systemConstraint,
    latestCompression,
    activeMessages,
    includedMessageIds: activeMessages.map((message) => message.id),
    excludedArchivedMessageIds: archivedMessages.map((message) => message.id),
    estimatedTokens,
    budget,
    budgetResult: evaluateContextBudget({ budget, currentInputTokens: estimatedTokens }),
    contextText,
  };
}

export function shouldAutoCompress(result: ContextBudgetResult): boolean {
  return result.status === ContextBudgetStatus.NeedsCompression
    || result.status === ContextBudgetStatus.Blocking;
}

export function selectMessagesForCompression(
  messages: readonly ConversationMessage[],
  retainRecentMessageCount = A505_RETAIN_RECENT_MESSAGE_COUNT,
): {
  readonly sourceMessages: readonly ConversationMessage[];
  readonly retainedMessages: readonly ConversationMessage[];
} {
  const activeMessages = messages.filter((message) =>
    message.archivedAt === undefined
    && (message.role === "user" || message.role === "assistant")
    && normalizeVisibleText(message.visibleContent).length > 0,
  );
  const retainedMessages = activeMessages.slice(-retainRecentMessageCount);
  const retainedIds = new Set(retainedMessages.map((message) => message.id));
  const sourceMessages = activeMessages.filter((message) => !retainedIds.has(message.id));

  return { sourceMessages, retainedMessages };
}

export function sanitizeCompressionText(value: string): string {
  return String(value ?? "")
    .replace(/\b(api[_\s-]*key|token|secret|password|authorization|cookie)\b\s*[:=]\s*("[^"]+"|'[^']+'|[^\s,;，；]+)/gi, "$1=[REDACTED]")
    .replace(/\b(sk-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9_]{8,}|xox[baprs]-[A-Za-z0-9-]{8,})\b/g, "[REDACTED_SECRET]")
    .replace(/\s+/g, " ")
    .trim();
}

function collectMatchingLines(
  messages: readonly ConversationMessage[],
  patterns: readonly RegExp[],
): readonly string[] {
  const seen = new Set<string>();
  const lines: string[] = [];

  for (const message of messages) {
    for (const rawLine of splitCandidateLines(message.visibleContent)) {
      const sanitized = sanitizeCompressionText(rawLine);
      if (sanitized.length === 0) {
        continue;
      }
      if (isLocalPreviewBoilerplate(sanitized)) {
        continue;
      }
      if (!patterns.some((pattern) => pattern.test(sanitized))) {
        continue;
      }
      const line = `${roleLabel(message.role)}：${limitSummaryLine(sanitized)}`;
      const key = normalizeVisibleText(line);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      lines.push(line);
      if (lines.length >= 3) {
        return lines;
      }
    }
  }

  return lines;
}

function splitCandidateLines(value: string): string[] {
  return String(value ?? "")
    .split(/[\n。；;]+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 24);
}

function limitSummaryLine(value: string): string {
  const sanitized = sanitizeCompressionText(value);
  return sanitized.length <= 120 ? sanitized : `${sanitized.slice(0, 117).trimEnd()}...`;
}

function isLocalPreviewBoilerplate(value: string): boolean {
  return value.includes("已记录，并使用当前活动上下文继续")
    || value.includes("当前使用未归档最近消息")
    || value.includes("后续使用压缩摘要 + 最近消息")
    || value.includes("学习摘要可用")
    || value.startsWith("本地预览：")
    || value.startsWith("本地预览:");
}

function normalizeForIntent(value: string): string {
  return String(value ?? "")
    .replace(/\s+/g, "")
    .replace(/[。.!！?？,，;；:：]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeVisibleText(value: string): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function roleLabel(role: ConversationMessageRole): string {
  if (role === "user") {
    return "用户";
  }
  if (role === "assistant") {
    return "助手";
  }
  return "系统";
}
