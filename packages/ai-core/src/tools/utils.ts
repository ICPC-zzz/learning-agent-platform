import { ToolRegistryError } from "./errors.ts";
import {
  ToolCallErrorCode,
  ToolRiskCategory,
  ToolRiskLevel,
  type JsonObject,
  type JsonValue,
  type ToolDefinition,
  type ToolMetadata,
  type ToolSchema,
} from "./types.ts";

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
  const displayName = normalizeOptionalText(definition.displayName);

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

  if (
    definition.riskCategory !== undefined &&
    !Object.values(ToolRiskCategory).includes(definition.riskCategory)
  ) {
    throw new ToolRegistryError(
      ToolCallErrorCode.InvalidToolDefinition,
      "Tool riskCategory must be valid when provided.",
    );
  }

  if (typeof definition.requiresConfirmation !== "boolean") {
    throw new ToolRegistryError(
      ToolCallErrorCode.InvalidToolDefinition,
      "Tool requiresConfirmation must be a boolean.",
    );
  }

  assertOptionalBoolean(definition.enabled, "Tool enabled");
  assertOptionalBoolean(definition.disabledByDefault, "Tool disabledByDefault");
  assertOptionalBoolean(definition.readOnly, "Tool readOnly");
  assertOptionalBoolean(definition.sideEffect, "Tool sideEffect");
  assertOptionalBoolean(definition.concurrencySafe, "Tool concurrencySafe");
  assertOptionalBoolean(definition.allowClientUserId, "Tool allowClientUserId");
  assertOptionalStringArray(definition.allowedAgents, "Tool allowedAgents");
  assertOptionalStringArray(definition.requiredPermissions, "Tool requiredPermissions");
  assertOptionalPositiveNumber(definition.timeoutMs, "Tool timeoutMs");
  assertJsonObject(definition.inputSchema, "Tool inputSchema");
  assertJsonObject(definition.outputSchema, "Tool outputSchema");
  assertJsonObject(definition.metadata, "Tool metadata");

  return cloneToolDefinition({
    ...definition,
    name,
    description,
    ...(displayName ? { displayName } : {}),
    riskCategory: definition.riskCategory ?? inferRiskCategory(definition),
    enabled: definition.enabled ?? true,
    disabledByDefault: definition.disabledByDefault ?? true,
    readOnly: definition.readOnly ?? false,
    sideEffect: definition.sideEffect ?? true,
    concurrencySafe: definition.concurrencySafe ?? false,
    allowClientUserId: definition.allowClientUserId ?? false,
    allowedAgents: definition.allowedAgents
      ? [...definition.allowedAgents]
      : [],
    timeoutMs: definition.timeoutMs ?? 30_000,
    requiredPermissions: definition.requiredPermissions
      ? [...definition.requiredPermissions]
      : [],
  });
}

export function cloneToolDefinition(
  definition: ToolDefinition,
): ToolDefinition {
  return {
    ...definition,
    allowedAgents: definition.allowedAgents
      ? [...definition.allowedAgents]
      : undefined,
    requiredPermissions: definition.requiredPermissions
      ? [...definition.requiredPermissions]
      : undefined,
    inputSchema: cloneJsonObject(definition.inputSchema),
    outputSchema: cloneJsonObject(definition.outputSchema),
    metadata: cloneJsonObject(definition.metadata),
  };
}

function inferRiskCategory(definition: ToolDefinition): ToolRiskCategory {
  if (definition.readOnly === true && definition.sideEffect !== true) {
    return ToolRiskCategory.ReadOnly;
  }

  if (definition.requiresConfirmation) {
    return ToolRiskCategory.WriteWithConfirmation;
  }

  return ToolRiskCategory.Forbidden;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return undefined;
  }

  return normalized;
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

export interface ToolInputValidationResult {
  readonly valid: boolean;
  readonly message: string;
}

export function validateToolInputAgainstSchema(
  input: unknown,
  schema: ToolSchema | undefined,
): ToolInputValidationResult {
  if (schema === undefined) {
    return { valid: true, message: "Input accepted." };
  }

  if (schema.type !== undefined && schema.type !== "object") {
    return {
      valid: false,
      message: "Tool input schema must have type object when type is provided.",
    };
  }

  if (!isPlainObject(input)) {
    return {
      valid: false,
      message: "Tool input must be a JSON object.",
    };
  }

  const required = getStringArray(schema.required);
  for (const key of required) {
    if (!(key in input)) {
      return {
        valid: false,
        message: `Tool input is missing required field "${key}".`,
      };
    }
  }

  const properties = getProperties(schema.properties);
  for (const [key, propertySchema] of Object.entries(properties)) {
    if (!(key in input)) {
      continue;
    }

    const value = input[key];
    const expectedType = typeof propertySchema.type === "string"
      ? propertySchema.type
      : undefined;

    if (expectedType && !matchesJsonSchemaType(value, expectedType)) {
      return {
        valid: false,
        message: `Tool input field "${key}" must be ${expectedType}.`,
      };
    }
  }

  return { valid: true, message: "Input accepted." };
}

function getStringArray(value: JsonValue | undefined): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function getProperties(value: JsonValue | undefined): Record<string, JsonObject> {
  if (!isPlainObject(value)) {
    return {};
  }

  const properties: Record<string, JsonObject> = {};
  for (const [key, property] of Object.entries(value)) {
    if (isPlainObject(property)) {
      properties[key] = property;
    }
  }

  return properties;
}

function matchesJsonSchemaType(value: unknown, expectedType: string): boolean {
  if (expectedType === "array") {
    return Array.isArray(value);
  }

  if (expectedType === "object") {
    return isPlainObject(value);
  }

  if (expectedType === "integer") {
    return Number.isInteger(value);
  }

  if (expectedType === "number") {
    return typeof value === "number" && Number.isFinite(value);
  }

  if (expectedType === "null") {
    return value === null;
  }

  return typeof value === expectedType;
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

function assertOptionalBoolean(value: boolean | undefined, label: string): void {
  if (value !== undefined && typeof value !== "boolean") {
    throw new ToolRegistryError(
      ToolCallErrorCode.InvalidToolDefinition,
      `${label} must be a boolean.`,
    );
  }
}

function assertOptionalStringArray(
  value: readonly string[] | undefined,
  label: string,
): void {
  if (value === undefined) {
    return;
  }

  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new ToolRegistryError(
      ToolCallErrorCode.InvalidToolDefinition,
      `${label} must be an array of strings.`,
    );
  }
}

function assertOptionalPositiveNumber(
  value: number | undefined,
  label: string,
): void {
  if (value === undefined) {
    return;
  }

  if (!Number.isFinite(value) || value <= 0) {
    throw new ToolRegistryError(
      ToolCallErrorCode.InvalidToolDefinition,
      `${label} must be a positive finite number.`,
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
