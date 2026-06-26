import type {
  AgentTaskRepositoryJsonValue,
  AppendAgentTaskEventInput,
  AppendAgentTaskSnapshotInput,
  CreateAgentTaskInput,
} from "../repositories/agent-task-repository.js";

type AgentTaskMapperJsonPrimitive = string | number | boolean | null;

type AgentTaskMapperJsonValue =
  | AgentTaskMapperJsonPrimitive
  | AgentTaskMapperJsonObject
  | AgentTaskMapperJsonValue[];

interface AgentTaskMapperJsonObject {
  [key: string]: AgentTaskMapperJsonValue;
}

export interface AgentTaskExecutionReadinessPreviewLike {
  readinessStatus?: string | null;
  overallRiskLevel?: string | null;
  autonomyLevel?: string | null;
  taskSummary?: string | null;
  executable?: boolean;
  realExecutionEnabled?: boolean;
  [key: string]: unknown;
}

export interface AgentTaskRecordPreviewLike {
  userId?: string | null;
  taskText?: string | null;
  taskSummary?: string | null;
  source?: string | null;
  mode?: string | null;
  lifecycleStatus?: string | null;
  autonomyLevel?: string | null;
  overallRiskLevel?: string | null;
  readinessStatus?: string | null;
  executable?: boolean;
  realExecutionEnabled?: boolean;
  planPreview?: unknown;
  toolRequirementReview?: unknown;
  skillSuggestionPreview?: unknown;
  memoryContextPreview?: unknown;
  executionReadinessPreview?: AgentTaskExecutionReadinessPreviewLike | null;
  snapshots?: readonly AgentTaskSnapshotPreviewLike[];
  events?: readonly AgentTaskEventPreviewLike[];
  safetyFlags?: unknown;
  safetyNotes?: unknown;
  metadata?: unknown;
  [key: string]: unknown;
}

export interface AgentTaskSnapshotPreviewLike {
  snapshotKind?: string | null;
  lifecycleStatus?: string | null;
  taskSummary?: string | null;
  executable?: boolean;
  realExecutionEnabled?: boolean;
  planPreview?: unknown;
  toolRequirementReview?: unknown;
  skillSuggestionPreview?: unknown;
  memoryContextPreview?: unknown;
  executionReadinessPreview?: AgentTaskExecutionReadinessPreviewLike | unknown;
  safetyNotes?: unknown;
  metadata?: unknown;
  [key: string]: unknown;
}

export interface AgentTaskEventPreviewLike {
  eventType?: string | null;
  source?: string | null;
  severity?: string | null;
  message?: string | null;
  relatedStepIds?: unknown;
  relatedStepIndexes?: unknown;
  relatedToolNames?: unknown;
  relatedSkillNames?: unknown;
  safetyNotes?: unknown;
  metadata?: unknown;
  [key: string]: unknown;
}

const defaultTaskText = "Agent task preview.";
const defaultRecordSource = "user";
const defaultMode = "preview_only";
const defaultLifecycleStatus = "preview_created";
const defaultReadinessStatus = "preview_only";
const defaultSnapshotKind = "combined_preview";
const defaultEventType = "preview_created";
const defaultEventSource = "system_preview";
const defaultEventSeverity = "info";
const defaultEventMessage = "Agent task preview event.";

const previewRecordModes = new Set(["preview_only", "disabled"]);

const previewLifecycleStatuses = new Set([
  "preview_created",
  "preview_updated",
  "readiness_reviewed",
  "blocked",
  "needs_confirmation",
  "ready_for_future_manual_review",
  "execution_disabled",
  "archived_preview",
]);

const previewRecordSources = new Set([
  "user",
  "system_preview",
  "agent_preview",
  "safety_preview",
]);

const previewSnapshotKinds = new Set([
  "plan_preview",
  "tool_requirement_review",
  "skill_suggestion",
  "memory_context",
  "execution_readiness",
  "combined_preview",
]);

const previewEventTypes = new Set([
  "preview_created",
  "preview_updated",
  "plan_preview_generated",
  "tool_requirement_reviewed",
  "skill_suggestions_reviewed",
  "memory_context_previewed",
  "execution_readiness_reviewed",
  "blocked_detected",
  "confirmation_required_detected",
  "execution_disabled_confirmed",
]);

const previewEventSeverities = new Set(["info", "warning", "blocked"]);

const previewFalseBooleanKeys = new Set([
  "executable",
  "realExecutionEnabled",
  "toolsExecuted",
  "llmCalled",
  "networkUsed",
  "memoryRetrievalExecuted",
  "embeddingsUsed",
  "vectorSearchUsed",
  "ragUsed",
  "dataSaved",
  "skillGenerated",
  "skillInstalled",
  "skillExecuted",
]);

const runtimeOnlyKeys = new Set([
  "executedAt",
  "completedAt",
  "runtimeStatus",
  "processId",
  "exitCode",
  "executeTask",
  "runTask",
  "startRuntime",
]);

const defaultPreviewSafetyFlags = {
  executable: false,
  realExecutionEnabled: false,
  toolsExecuted: false,
  llmCalled: false,
  networkUsed: false,
  memoryRetrievalExecuted: false,
  embeddingsUsed: false,
  vectorSearchUsed: false,
  ragUsed: false,
  dataSaved: false,
  skillGenerated: false,
  skillInstalled: false,
  skillExecuted: false,
} as const satisfies AgentTaskMapperJsonObject;

export function mapAgentTaskRecordPreviewToCreateInput(
  record: AgentTaskRecordPreviewLike,
): CreateAgentTaskInput {
  const readinessPreview = record.executionReadinessPreview ?? undefined;
  const taskText =
    normalizeOptionalText(record.taskText) ??
    normalizeOptionalText(readinessPreview?.taskSummary) ??
    defaultTaskText;
  const taskSummary =
    normalizeOptionalText(record.taskSummary) ??
    normalizeOptionalText(readinessPreview?.taskSummary) ??
    taskText;
  const source = normalizeKnownText(
    record.source,
    previewRecordSources,
    defaultRecordSource,
  );
  const mode = normalizeKnownText(record.mode, previewRecordModes, defaultMode);
  const lifecycleStatus = normalizeKnownText(
    record.lifecycleStatus,
    previewLifecycleStatuses,
    defaultLifecycleStatus,
  );
  const autonomyLevel =
    normalizeOptionalText(record.autonomyLevel) ??
    normalizeOptionalText(readinessPreview?.autonomyLevel);
  const overallRiskLevel =
    normalizeOptionalText(record.overallRiskLevel) ??
    normalizeOptionalText(readinessPreview?.overallRiskLevel);
  const readinessStatus =
    normalizeOptionalText(readinessPreview?.readinessStatus) ??
    normalizeOptionalText(record.readinessStatus) ??
    defaultReadinessStatus;
  const safetyFlags = createPreviewSafetyFlags(record.safetyFlags);
  const createInput: CreateAgentTaskInput = {
    taskText,
    taskSummary,
    source,
    mode,
    lifecycleStatus,
    autonomyLevel,
    overallRiskLevel,
    readinessStatus,
    executable: false,
    realExecutionEnabled: false,
    safetyFlags,
    previewPayload: createRecordPreviewPayload(record, {
      taskText,
      taskSummary,
      source,
      mode,
      lifecycleStatus,
      autonomyLevel,
      overallRiskLevel,
      readinessStatus,
      safetyFlags,
    }),
  };
  const userId = normalizeOptionalText(record.userId);
  const metadata = toRepositoryJsonValue(record.metadata);

  if (userId !== null) {
    createInput.userId = userId;
  }

  if (metadata !== undefined) {
    createInput.metadata = metadata;
  }

  return createInput;
}

export function mapAgentTaskSnapshotPreviewToAppendInput(
  snapshot: AgentTaskSnapshotPreviewLike,
  taskId: string,
): AppendAgentTaskSnapshotInput {
  const appendInput: AppendAgentTaskSnapshotInput = {
    taskId: normalizeRequiredText(taskId, "Agent task id is required."),
    snapshotKind: normalizeKnownText(
      snapshot.snapshotKind,
      previewSnapshotKinds,
      defaultSnapshotKind,
    ),
    lifecycleStatus: normalizeKnownNullableText(
      snapshot.lifecycleStatus,
      previewLifecycleStatuses,
    ),
    taskSummary:
      normalizeOptionalText(snapshot.taskSummary) ??
      normalizeOptionalText(
        getExecutionReadinessPreviewLike(snapshot.executionReadinessPreview)
          ?.taskSummary,
      ),
    executable: false,
    realExecutionEnabled: false,
    payload: createSnapshotPayload(snapshot),
    safetyNotes: createSafetyNotesJson(snapshot.safetyNotes),
  };
  const metadata = toRepositoryJsonValue(snapshot.metadata);

  if (metadata !== undefined) {
    appendInput.metadata = metadata;
  }

  return appendInput;
}

export function mapAgentTaskEventPreviewToAppendInput(
  event: AgentTaskEventPreviewLike,
  taskId: string,
): AppendAgentTaskEventInput {
  const appendInput: AppendAgentTaskEventInput = {
    taskId: normalizeRequiredText(taskId, "Agent task id is required."),
    eventType: normalizeKnownText(
      event.eventType,
      previewEventTypes,
      defaultEventType,
    ),
    source: normalizeKnownText(
      event.source,
      previewRecordSources,
      defaultEventSource,
    ),
    severity: normalizeKnownText(
      event.severity,
      previewEventSeverities,
      defaultEventSeverity,
    ),
    message: normalizeOptionalText(event.message) ?? defaultEventMessage,
    safetyNotes: createSafetyNotesJson(event.safetyNotes),
  };
  const relatedStepIds = createStringArrayJson(event.relatedStepIds);
  const relatedStepIndexes = createNumberArrayJson(event.relatedStepIndexes);
  const relatedToolNames = createStringArrayJson(event.relatedToolNames);
  const relatedSkillNames = createStringArrayJson(event.relatedSkillNames);
  const metadata = toRepositoryJsonValue(event.metadata);

  if (relatedStepIds !== undefined) {
    appendInput.relatedStepIds = relatedStepIds;
  }

  if (relatedStepIndexes !== undefined) {
    appendInput.relatedStepIndexes = relatedStepIndexes;
  }

  if (relatedToolNames !== undefined) {
    appendInput.relatedToolNames = relatedToolNames;
  }

  if (relatedSkillNames !== undefined) {
    appendInput.relatedSkillNames = relatedSkillNames;
  }

  if (metadata !== undefined) {
    appendInput.metadata = metadata;
  }

  return appendInput;
}

function createRecordPreviewPayload(
  record: AgentTaskRecordPreviewLike,
  normalized: {
    taskText: string;
    taskSummary: string;
    source: string;
    mode: string;
    lifecycleStatus: string;
    autonomyLevel: string | null;
    overallRiskLevel: string | null;
    readinessStatus: string;
    safetyFlags: AgentTaskRepositoryJsonValue;
  },
): AgentTaskRepositoryJsonValue {
  return toRepositoryJsonValue({
    ...record,
    taskText: normalized.taskText,
    taskSummary: normalized.taskSummary,
    source: normalized.source,
    mode: normalized.mode,
    lifecycleStatus: normalized.lifecycleStatus,
    autonomyLevel: normalized.autonomyLevel,
    overallRiskLevel: normalized.overallRiskLevel,
    readinessStatus: normalized.readinessStatus,
    executable: false,
    realExecutionEnabled: false,
    safetyFlags: normalized.safetyFlags,
  }) as AgentTaskRepositoryJsonValue;
}

function createSnapshotPayload(
  snapshot: AgentTaskSnapshotPreviewLike,
): AgentTaskRepositoryJsonValue {
  return toRepositoryJsonValue({
    ...snapshot,
    snapshotKind: normalizeKnownText(
      snapshot.snapshotKind,
      previewSnapshotKinds,
      defaultSnapshotKind,
    ),
    executable: false,
    realExecutionEnabled: false,
  }) as AgentTaskRepositoryJsonValue;
}

function createPreviewSafetyFlags(
  safetyFlags: unknown,
): AgentTaskRepositoryJsonValue {
  const sanitizedSafetyFlags = sanitizeJsonValue(safetyFlags);
  const customSafetyFlags = isJsonObject(sanitizedSafetyFlags)
    ? sanitizedSafetyFlags
    : {};

  return toRepositoryJsonValue({
    ...customSafetyFlags,
    ...defaultPreviewSafetyFlags,
  }) as AgentTaskRepositoryJsonValue;
}

function createSafetyNotesJson(
  value: unknown,
): AgentTaskRepositoryJsonValue {
  const safetyNotes =
    Array.isArray(value) || value === undefined ? value ?? [] : [value];

  return toRepositoryJsonValue(safetyNotes) as AgentTaskRepositoryJsonValue;
}

function createStringArrayJson(
  value: unknown,
): AgentTaskRepositoryJsonValue | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return toRepositoryJsonValue(
    value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  );
}

function createNumberArrayJson(
  value: unknown,
): AgentTaskRepositoryJsonValue | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return toRepositoryJsonValue(
    value.filter((item): item is number => Number.isFinite(item)),
  );
}

function toRepositoryJsonValue(
  value: unknown,
): AgentTaskRepositoryJsonValue | undefined {
  const sanitizedValue = sanitizeJsonValue(value);

  if (sanitizedValue === undefined || sanitizedValue === null) {
    return undefined;
  }

  return sanitizedValue as AgentTaskRepositoryJsonValue;
}

function sanitizeJsonValue(
  value: unknown,
): AgentTaskMapperJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeJsonValue(item))
      .filter((item): item is AgentTaskMapperJsonValue => item !== undefined);
  }

  if (typeof value !== "object") {
    return undefined;
  }

  const output: AgentTaskMapperJsonObject = {};

  for (const [key, nestedValue] of Object.entries(value)) {
    if (runtimeOnlyKeys.has(key)) {
      continue;
    }

    if (previewFalseBooleanKeys.has(key)) {
      output[key] = false;
      continue;
    }

    const sanitizedNestedValue = sanitizeJsonValue(nestedValue);

    if (sanitizedNestedValue !== undefined) {
      output[key] = sanitizedNestedValue;
    }
  }

  return output;
}

function isJsonObject(
  value: AgentTaskMapperJsonValue | undefined,
): value is AgentTaskMapperJsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getExecutionReadinessPreviewLike(
  value: unknown,
): AgentTaskExecutionReadinessPreviewLike | undefined {
  return typeof value === "object" && value !== null
    ? (value as AgentTaskExecutionReadinessPreviewLike)
    : undefined;
}

function normalizeRequiredText(value: string, errorMessage: string): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new Error(errorMessage);
  }

  return normalized;
}

function normalizeOptionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  return normalized.length === 0 ? null : normalized;
}

function normalizeKnownText(
  value: unknown,
  allowedValues: ReadonlySet<string>,
  defaultValue: string,
): string {
  const normalized = normalizeOptionalText(value);

  return normalized !== null && allowedValues.has(normalized)
    ? normalized
    : defaultValue;
}

function normalizeKnownNullableText(
  value: unknown,
  allowedValues: ReadonlySet<string>,
): string | null {
  const normalized = normalizeOptionalText(value);

  return normalized !== null && allowedValues.has(normalized)
    ? normalized
    : null;
}
