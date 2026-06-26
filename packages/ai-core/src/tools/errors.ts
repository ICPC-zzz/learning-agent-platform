import {
  ToolCallErrorCode,
  ToolCallStatus,
  type ToolCallResult,
  type ToolMetadata,
} from "./types";

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
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return "Tool execution failed.";
}
