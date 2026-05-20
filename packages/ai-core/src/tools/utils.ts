import { ToolRegistryError } from "./errors";
import {
  ToolCallErrorCode,
  ToolRiskLevel,
  type ToolDefinition,
  type ToolMetadata,
  type ToolSchema,
} from "./types";

const TOOL_NAME_PATTERN = /^[a-z0-9_.-]+$/;

let toolCallSequence = 0;

export function normalizeToolName(name: string): string {
  const normalized = name.trim().toLowerCase();

  if (normalized.length === 0 || !TOOL_NAME_PATTERN.test(normalized)) {
    throw new ToolRegistryError(
      ToolCallErrorCode.InvalidToolDefinition,
      "Tool name must contain only lowercase letters, numbers, underscores, hyphens, or dots.",
    );
  }

  return normalized;
}

export function createToolCallId(prefix = "tool_call"): string {
  toolCallSequence += 1;

  return `${prefix}_${Date.now().toString(36)}_${toolCallSequence.toString(36)}`;
}

export function validateToolDefinition(
  definition: ToolDefinition,
): ToolDefinition {
  const name = normalizeToolName(definition.name);
  const description = definition.description.trim();

  if (description.length === 0) {
    throw new ToolRegistryError(
      ToolCallErrorCode.InvalidToolDefinition,
      "Tool description is required.",
    );
  }

  if (!isToolRiskLevel(definition.riskLevel)) {
    throw new ToolRegistryError(
      ToolCallErrorCode.InvalidToolDefinition,
      "Tool riskLevel is required and must be valid.",
    );
  }

  if (typeof definition.requiresConfirmation !== "boolean") {
    throw new ToolRegistryError(
      ToolCallErrorCode.InvalidToolDefinition,
      "Tool requiresConfirmation must be a boolean.",
    );
  }

  assertJsonObject(definition.inputSchema, "Tool inputSchema");
  assertJsonObject(definition.outputSchema, "Tool outputSchema");
  assertJsonObject(definition.metadata, "Tool metadata");

  return cloneToolDefinition({
    ...definition,
    name,
    description,
  });
}

export function cloneToolDefinition(
  definition: ToolDefinition,
): ToolDefinition {
  return {
    ...definition,
    inputSchema: cloneJsonObject(definition.inputSchema),
    outputSchema: cloneJsonObject(definition.outputSchema),
    metadata: cloneJsonObject(definition.metadata),
  };
}

export function getToolCallName(request: {
  readonly name?: string;
  readonly toolName?: string;
}): string | undefined {
  return request.name ?? request.toolName;
}

export function isConfirmationGranted(request: {
  readonly confirmation?: { readonly granted?: boolean };
  readonly confirmationGranted?: boolean;
}): boolean {
  return request.confirmation?.granted === true || request.confirmationGranted === true;
}

function isToolRiskLevel(value: unknown): value is ToolRiskLevel {
  return Object.values(ToolRiskLevel).includes(value as ToolRiskLevel);
}

function assertJsonObject(
  value: ToolSchema | ToolMetadata | undefined,
  label: string,
): void {
  if (value === undefined) {
    return;
  }

  if (!isPlainObject(value) || !isJsonValue(value)) {
    throw new ToolRegistryError(
      ToolCallErrorCode.InvalidToolDefinition,
      `${label} must be a JSON object.`,
    );
  }
}

function cloneJsonObject<T extends ToolSchema | ToolMetadata | undefined>(
  value: T,
): T {
  if (value === undefined) {
    return undefined as T;
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function isJsonValue(value: unknown): boolean {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return Number.isFinite(value) || typeof value !== "number";
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  if (isPlainObject(value)) {
    return Object.values(value).every(isJsonValue);
  }

  return false;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}
