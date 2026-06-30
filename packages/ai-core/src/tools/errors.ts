import {
  ToolCallErrorCode,
  ToolCallStatus,
  ToolExecutionStatus,
  type ToolCallResult,
  type ToolExecutionResult,
  type ToolMetadata,
  type ToolSourceReference,
} from "./types.ts";

export class ToolRegistryError extends Error {
  readonly code: ToolCallErrorCode;

  constructor(code: ToolCallErrorCode, message: string) {
    super(message);
    this.name = "ToolRegistryError";
    this.code = code;
  }
}

export interface CreateToolErrorResultInput {
  toolName?: string;
  name?: string;
  callId?: string;
  status?: ToolCallStatus;
  errorCode: ToolCallErrorCode;
  errorMessage: string;
  metadata?: ToolMetadata;
}

export function createToolErrorResult(
  input: CreateToolErrorResultInput,
): ToolCallResult {
  const toolName = input.toolName ?? input.name ?? "";

  return {
    toolName,
    name: toolName,
    callId: input.callId,
    status: input.status ?? ToolCallStatus.Failed,
    errorCode: input.errorCode,
    errorMessage: input.errorMessage,
    metadata: input.metadata,
  };
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return sanitizeToolErrorMessage(error.message);
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return sanitizeToolErrorMessage(error);
  }

  return "Tool execution failed.";
}

export function sanitizeToolErrorMessage(message: string): string {
  const trimmed = message.trim();

  if (trimmed.length === 0) {
    return "Tool execution failed.";
  }

  if (/(api[_-]?key|secret|token|password|credential)/i.test(trimmed)) {
    return "Tool execution failed without exposing sensitive details.";
  }

  return trimmed.length > 300 ? `${trimmed.slice(0, 300)}...` : trimmed;
}

export function safeToolSummaryForStatus(input: {
  status: ToolExecutionStatus;
  errorCode?: string;
  fallback?: string;
}): string {
  if (input.status === ToolExecutionStatus.Succeeded) {
    return input.fallback ?? "工具执行完成。";
  }

  if (input.status === ToolExecutionStatus.Empty) {
    return "本次查询没有找到符合条件的数据。";
  }

  if (input.status === ToolExecutionStatus.InvalidInput) {
    return "工具参数不完整，暂时无法执行。";
  }

  if (input.status === ToolExecutionStatus.PermissionDenied) {
    return "当前操作没有执行权限。";
  }

  if (input.status === ToolExecutionStatus.TimedOut) {
    return "数据查询超时，你可以稍后重试。";
  }

  if (input.status === ToolExecutionStatus.Cancelled) {
    return "本次工具调用已取消。";
  }

  if (input.errorCode === ToolCallErrorCode.ExternalUnavailable || input.errorCode === "external_unavailable") {
    return "Codeforces 数据暂时无法获取，请稍后重试。";
  }

  return "工具执行失败，请稍后重试。";
}

export function sanitizeSafeSummary(summary: string): string {
  const trimmed = String(summary ?? "").replace(/\s+/g, " ").trim();
  if (trimmed.length === 0) {
    return "工具执行失败，请稍后重试。";
  }

  if (containsUnsafeDiagnostic(trimmed)) {
    return "工具执行失败，请稍后重试。";
  }

  return trimmed.slice(0, 700);
}

export function containsUnsafeDiagnostic(message: string): boolean {
  return /(invalid prisma|foreign key constraint|econnrefused|fetch failed|stack trace|failed with empty|no candidate problems available|tool_result|api[_-]?key|secret|token|password|credential)/i.test(message);
}

export function createToolExecutionResult(input: {
  toolCallId: string;
  toolName: string;
  status: ToolExecutionStatus;
  startedAt: string;
  completedAt?: string;
  output?: unknown;
  safeSummary?: string;
  errorCode?: string;
  retryable?: boolean;
  sourceRefs?: ToolSourceReference[];
  cached?: boolean;
  metadata?: ToolMetadata;
}): ToolExecutionResult {
  const completedAt = input.completedAt ?? new Date().toISOString();
  return {
    toolCallId: input.toolCallId,
    toolName: input.toolName,
    status: input.status,
    ...(input.output !== undefined ? { output: input.output } : {}),
    safeSummary: sanitizeSafeSummary(input.safeSummary ?? safeToolSummaryForStatus({
      status: input.status,
      errorCode: input.errorCode,
    })),
    ...(input.errorCode ? { errorCode: input.errorCode } : {}),
    retryable: input.retryable ?? isRetryableToolStatus(input.status),
    sourceRefs: input.sourceRefs ?? [],
    startedAt: input.startedAt,
    completedAt,
    durationMs: Math.max(0, new Date(completedAt).getTime() - new Date(input.startedAt).getTime()),
    ...(input.cached !== undefined ? { cached: input.cached } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };
}

export function isRetryableToolStatus(status: ToolExecutionStatus): boolean {
  return status === ToolExecutionStatus.TimedOut
    || status === ToolExecutionStatus.Cancelled
    || status === ToolExecutionStatus.Failed;
}
