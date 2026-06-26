import { createToolErrorResult, getErrorMessage } from "./errors";
import { InMemoryToolRegistry } from "./registry";
import {
  ToolCallErrorCode,
  ToolCallStatus,
  type ToolCallRequest,
  type ToolCallResult,
  type ToolDefinition,
  type ToolRegistration,
  type ToolRuntime,
} from "./types";
import {
  createToolCallId,
  getToolCallName,
  isConfirmationGranted,
  normalizeToolName,
} from "./utils";

export class InMemoryToolRuntime implements ToolRuntime {
  private readonly registry: InMemoryToolRegistry;

  constructor(
    registryOrRegistrations:
      | InMemoryToolRegistry
      | readonly ToolRegistration[] = new InMemoryToolRegistry(),
  ) {
    this.registry =
      registryOrRegistrations instanceof InMemoryToolRegistry
        ? registryOrRegistrations
        : new InMemoryToolRegistry(registryOrRegistrations);
  }

  async listTools(): Promise<ToolDefinition[]> {
    return this.registry.list();
  }

  async callTool(request: ToolCallRequest): Promise<ToolCallResult> {
    const callId = request.callId ?? createToolCallId();
    const rawName = getToolCallName(request);

    if (rawName === undefined) {
      return createToolErrorResult({
        callId,
        status: ToolCallStatus.Failed,
        errorCode: ToolCallErrorCode.InvalidToolRequest,
        errorMessage: "Tool call request must include a tool name.",
      });
    }

    const normalizedName = normalizeRequestToolName(rawName);

    if (normalizedName === undefined) {
      return createToolErrorResult({
        toolName: rawName,
        callId,
        status: ToolCallStatus.Failed,
        errorCode: ToolCallErrorCode.InvalidToolRequest,
        errorMessage: "Tool call request includes an invalid tool name.",
      });
    }

    const registration = this.registry.get(normalizedName);

    if (registration === undefined) {
      return createToolErrorResult({
        toolName: normalizedName,
        callId,
        status: ToolCallStatus.Failed,
        errorCode: ToolCallErrorCode.ToolNotFound,
        errorMessage: `Tool "${normalizedName}" is not registered.`,
      });
    }

    const { definition, handler } = registration;

    if (
      definition.requiresConfirmation &&
      !isConfirmationGranted(request)
    ) {
      return createToolErrorResult({
        toolName: definition.name,
        callId,
        status: ToolCallStatus.RequiresConfirmation,
        errorCode: ToolCallErrorCode.ConfirmationRequired,
        errorMessage: `Tool "${definition.name}" requires confirmation before execution.`,
        metadata: {
          riskLevel: definition.riskLevel,
          requiresConfirmation: true,
        },
      });
    }

    try {
      const result = await handler({
        ...request,
        name: definition.name,
        toolName: definition.name,
        callId,
      });

      return {
        ...result,
        name: definition.name,
        toolName: definition.name,
        callId,
      };
    } catch (error) {
      return createToolErrorResult({
        toolName: definition.name,
        callId,
        status: ToolCallStatus.Failed,
        errorCode: ToolCallErrorCode.ExecutionFailed,
        errorMessage: getErrorMessage(error),
        metadata: {
          riskLevel: definition.riskLevel,
        },
      });
    }
  }
}

function normalizeRequestToolName(name: string): string | undefined {
  try {
    return normalizeToolName(name);
  } catch {
    return undefined;
  }
}
