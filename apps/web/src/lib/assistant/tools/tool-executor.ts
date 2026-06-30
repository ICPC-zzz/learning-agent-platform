import {
  InMemoryToolRegistry,
  InMemoryToolRuntime,
  ToolCallErrorCode,
  ToolExecutionStatus,
  ToolRiskCategory,
  ToolRiskLevel,
  type JsonValue,
  type ToolDefinition,
  type ToolExecutionResult,
  type ToolRegistration,
  type ToolSourceReference,
} from "@learning-agent-platform/ai-core/tools";
import type {
  AnyAssistantToolDefinition,
  AssistantToolExecutionContext,
  AssistantToolExecutionResult,
  AssistantToolName,
} from "./tool-types.ts";
import { getAssistantToolRegistry } from "./tool-registry.ts";

export interface AssistantCanonicalToolExecution {
  result: AssistantToolExecutionResult<unknown>;
  canonicalResult: ToolExecutionResult<AssistantToolExecutionResult<unknown>>;
}

export async function executeAssistantTool(
  definition: AnyAssistantToolDefinition,
  input: unknown,
  context: AssistantToolExecutionContext,
): Promise<AssistantToolExecutionResult<unknown>> {
  return (await executeAssistantToolWithCanonicalResult(definition, input, context)).result;
}

export async function executeAssistantToolWithCanonicalResult(
  definition: AnyAssistantToolDefinition,
  input: unknown,
  context: AssistantToolExecutionContext,
): Promise<AssistantCanonicalToolExecution> {
  const canonicalName = getAssistantToolCanonicalName(definition.name);
  const registry = new InMemoryToolRegistry([
    createAssistantCanonicalToolRegistration(definition, context),
  ]);
  const runtime = new InMemoryToolRuntime(registry);
  const canonicalResult = await runtime.executeTool({
    toolName: canonicalName,
    input: toJsonInput(input),
    context: {
      userId: context.userId ?? undefined,
      conversationId: context.pageContext.route,
      requestId: context.question.slice(0, 120),
      enabledTools: [canonicalName],
      signal: context.signal,
      metadata: {
        adapter: "web-assistant",
        assistantToolName: definition.name,
      },
    },
  }) as ToolExecutionResult<AssistantToolExecutionResult<unknown>>;

  return {
    canonicalResult,
    result: assistantResultFromCanonical(definition, canonicalResult),
  };
}

export function createAssistantCanonicalToolRuntime(
  context: AssistantToolExecutionContext,
  definitions: readonly AnyAssistantToolDefinition[] = getAssistantToolRegistry(),
): InMemoryToolRuntime {
  return new InMemoryToolRuntime(
    new InMemoryToolRegistry(
      definitions.map((definition) =>
        createAssistantCanonicalToolRegistration(definition, context),
      ),
    ),
  );
}

export function createAssistantCanonicalToolRegistration(
  definition: AnyAssistantToolDefinition,
  context: AssistantToolExecutionContext,
): ToolRegistration {
  const canonicalName = getAssistantToolCanonicalName(definition.name);
  return {
    definition: {
      name: canonicalName,
      displayName: formatAssistantToolDisplayName(definition.name),
      description: definition.description,
      riskLevel: ToolRiskLevel.Low,
      riskCategory: ToolRiskCategory.ReadOnly,
      requiresConfirmation: false,
      enabled: context.forcePermissionDenied === true ? false : true,
      disabledByDefault: context.forcePermissionDenied === true ? true : false,
      readOnly: true,
      sideEffect: false,
      concurrencySafe: true,
      timeoutMs: definition.timeoutMs,
      sourceLabel: definition.sourceLabel,
      inputSchema: toCanonicalToolSchema(definition.inputSchema),
      outputSchema: toCanonicalToolSchema(definition.outputSchema),
      metadata: {
        adapter: "web-assistant",
        assistantToolName: definition.name,
        sourceLabel: definition.sourceLabel,
      },
    },
    validateInput: (rawInput) => ({
      valid: definition.validateInput(rawInput),
      safeSummary: "工具参数不完整，暂时无法执行。",
      errorCode: ToolCallErrorCode.InvalidToolInput,
    }),
    handler: async (request) => {
      const result = await definition.execute(request.input, {
        ...context,
        signal: request.context?.signal,
      });
      const status = mapAssistantResultToCanonicalStatus(result);
      return {
        toolCallId: request.callId ?? "",
        toolName: canonicalName,
        status,
        output: result,
        safeSummary: safeSummaryForAssistantResult(status, result),
        errorCode: canonicalErrorCodeForAssistantResult(status, result),
        retryable: status === ToolExecutionStatus.TimedOut
          || status === ToolExecutionStatus.Cancelled
          || status === ToolExecutionStatus.Failed,
        sourceRefs: result.sources.map(toToolSourceReference),
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 0,
        cached: didAssistantToolUseCache(result),
        metadata: {
          adapter: "web-assistant",
          displayName: formatAssistantToolDisplayName(definition.name),
          assistantToolName: definition.name,
          sourceLabel: definition.sourceLabel,
        },
      } satisfies ToolExecutionResult<AssistantToolExecutionResult<unknown>>;
    },
  };
}

export function findAssistantToolDefinition(
  definitions: readonly AnyAssistantToolDefinition[],
  name: AssistantToolName,
): AnyAssistantToolDefinition | null {
  return definitions.find((definition) => definition.name === name) ?? null;
}

export function getAssistantToolCanonicalName(name: AssistantToolName | string): string {
  switch (name) {
    case "resolveLearnerTrainingProfile":
      return "assistant.resolve_learner_training_profile";
    case "getPersonalizedCodeforcesCandidates":
      return "assistant.get_personalized_codeforces_candidates";
    case "getUpcomingCodeforcesContests":
      return "assistant.get_upcoming_codeforces_contests";
    default:
      return `assistant.${String(name)
        .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
        .replace(/[^A-Za-z0-9_.-]+/g, "_")
        .toLowerCase()}`;
  }
}

export function formatAssistantToolDisplayName(name: string): string {
  switch (name) {
    case "resolveLearnerTrainingProfile":
      return "解析用户真实训练水平";
    case "getPersonalizedCodeforcesCandidates":
      return "查询个性化候选题目";
    case "getUpcomingCodeforcesContests":
      return "查询近期 Codeforces 比赛";
    case "recommend_codeforces_problems":
      return "推荐 Codeforces 题目";
    case "search_codeforces_problems":
      return "搜索 Codeforces 题目";
    case "search_technical_articles":
      return "搜索技术文章";
    case "get_hot_technical_articles":
      return "读取热门技术文章";
    default:
      return name;
  }
}

function assistantResultFromCanonical(
  definition: AnyAssistantToolDefinition,
  canonical: ToolExecutionResult<AssistantToolExecutionResult<unknown>>,
): AssistantToolExecutionResult<unknown> {
  if (
    canonical.output
    && typeof canonical.output === "object"
    && "rawResponseStored" in canonical.output
  ) {
    return {
      ...canonical.output,
      ok: canonical.status === ToolExecutionStatus.Succeeded,
      summary: canonical.status === ToolExecutionStatus.Succeeded
        ? canonical.output.summary
        : canonical.safeSummary,
      errorCode: canonical.status === ToolExecutionStatus.Succeeded
        ? canonical.output.errorCode
        : assistantErrorCodeFromCanonical(canonical),
      errorMessage: canonical.status === ToolExecutionStatus.Succeeded
        ? canonical.output.errorMessage
        : canonical.safeSummary,
      timedOut: canonical.status === ToolExecutionStatus.TimedOut,
      rawResponseStored: false,
    };
  }

  return {
    name: definition.name,
    ok: false,
    summary: canonical.safeSummary,
    items: [],
    sources: [],
    warnings: [canonical.safeSummary],
    errorCode: canonical.errorCode ?? canonical.status,
    errorMessage: canonical.safeSummary,
    timedOut: canonical.status === ToolExecutionStatus.TimedOut,
    rawResponseStored: false,
  };
}

function mapAssistantResultToCanonicalStatus(
  result: AssistantToolExecutionResult<unknown>,
): ToolExecutionStatus {
  if (result.ok) {
    return result.items.length === 0
      ? ToolExecutionStatus.Empty
      : ToolExecutionStatus.Succeeded;
  }

  if (result.errorCode === "empty" || result.items.length === 0 && result.warnings.some((warning) => /未找到|没有|empty/i.test(warning))) {
    return ToolExecutionStatus.Empty;
  }
  if (result.errorCode === "invalid_input") {
    return ToolExecutionStatus.InvalidInput;
  }
  if (result.errorCode === "session_required" || result.errorCode === "permission_denied") {
    return ToolExecutionStatus.PermissionDenied;
  }
  if (result.errorCode === "timeout" || result.timedOut) {
    return ToolExecutionStatus.TimedOut;
  }
  if (result.errorCode === "cancelled") {
    return ToolExecutionStatus.Cancelled;
  }

  return ToolExecutionStatus.Failed;
}

function assistantErrorCodeFromCanonical(
  canonical: ToolExecutionResult<AssistantToolExecutionResult<unknown>>,
): string {
  if (
    canonical.status === ToolExecutionStatus.PermissionDenied
    && canonical.output?.errorCode === "session_required"
  ) {
    return "session_required";
  }
  return canonical.errorCode ?? canonical.status;
}

function safeSummaryForAssistantResult(
  status: ToolExecutionStatus,
  result: AssistantToolExecutionResult<unknown>,
): string {
  if (status === ToolExecutionStatus.Succeeded) {
    return result.summary;
  }
  if (status === ToolExecutionStatus.Empty) {
    return "本次查询没有找到符合条件的数据。";
  }
  if (status === ToolExecutionStatus.InvalidInput) {
    return "工具参数不完整，暂时无法执行。";
  }
  if (status === ToolExecutionStatus.PermissionDenied) {
    return "当前操作没有执行权限。";
  }
  if (status === ToolExecutionStatus.TimedOut) {
    return "数据查询超时，你可以稍后重试。";
  }
  if (status === ToolExecutionStatus.Cancelled) {
    return "本次工具调用已取消。";
  }
  if (isExternalUnavailable(result.errorCode)) {
    return "Codeforces 数据暂时无法获取，请稍后重试。";
  }
  return "工具执行失败，请稍后重试。";
}

function canonicalErrorCodeForAssistantResult(
  status: ToolExecutionStatus,
  result: AssistantToolExecutionResult<unknown>,
): string | undefined {
  if (status === ToolExecutionStatus.Succeeded) {
    return undefined;
  }
  if (status === ToolExecutionStatus.Empty) {
    return "empty_result";
  }
  if (status === ToolExecutionStatus.InvalidInput) {
    return "invalid_input";
  }
  if (status === ToolExecutionStatus.PermissionDenied) {
    return "permission_denied";
  }
  if (status === ToolExecutionStatus.TimedOut) {
    return "timed_out";
  }
  if (status === ToolExecutionStatus.Cancelled) {
    return "cancelled";
  }
  if (isExternalUnavailable(result.errorCode)) {
    return "external_unavailable";
  }
  return "execution_failed";
}

function toToolSourceReference(source: { title: string; source: string; url: string }): ToolSourceReference {
  return {
    title: source.title,
    source: source.source,
    url: source.url,
    cached: /cache|缓存|本地|local/i.test(source.source),
  };
}

function didAssistantToolUseCache(result: AssistantToolExecutionResult<unknown>): boolean {
  const text = `${result.summary}\n${result.sources.map((source) => source.source).join("\n")}`.toLowerCase();
  return text.includes("fresh_cache")
    || text.includes("stale_cache")
    || text.includes("cache")
    || text.includes("缓存");
}

function isExternalUnavailable(errorCode: string | undefined): boolean {
  return Boolean(errorCode && /cf_|codeforces|api|external/i.test(errorCode));
}

function toJsonInput(input: unknown): JsonValue | undefined {
  if (input === undefined) {
    return undefined;
  }
  return JSON.parse(JSON.stringify(input)) as JsonValue;
}

function toCanonicalToolSchema(value: unknown): ToolDefinition["inputSchema"] {
  const normalized = JSON.parse(JSON.stringify(value)) as JsonValue;
  if (normalized === null || typeof normalized !== "object" || Array.isArray(normalized)) {
    return undefined;
  }
  return normalized as ToolDefinition["inputSchema"];
}
