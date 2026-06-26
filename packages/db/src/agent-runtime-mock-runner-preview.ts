import {
  mapAgentRuntimeAuditEventPreviewToAppendRuntimeAuditLogInput,
  mapAgentRuntimeEventPreviewToAppendRuntimeEventInput,
  mapAgentRuntimeLlmCallPreviewToAppendRuntimeLlmCallInput,
  mapAgentRuntimePreviewToCreateRuntimeExecutionInput,
  mapAgentRuntimeStepPreviewToAppendRuntimeStepInput,
  mapAgentRuntimeToolCallPreviewToAppendRuntimeToolCallInput,
} from "./mappers/agent-runtime-mapper.js";
import type {
  AgentRuntimeAuditEventPreviewLike,
  AgentRuntimeErrorPreviewLike,
  AgentRuntimeEventPreviewLike,
  AgentRuntimeLlmCallPreviewLike,
  AgentRuntimePreviewLike,
  AgentRuntimeStepPreviewLike,
  AgentRuntimeToolCallPreviewLike,
} from "./mappers/agent-runtime-mapper.js";
import type { AgentRuntimeRepository } from "./repositories/agent-runtime-repository.js";

export interface MockRuntimePreviewPlanLike {
  runtime: AgentRuntimePreviewLike;
  steps?: readonly AgentRuntimeStepPreviewLike[];
  toolCalls?: readonly AgentRuntimeToolCallPreviewLike[];
  llmCalls?: readonly AgentRuntimeLlmCallPreviewLike[];
  events?: readonly AgentRuntimeEventPreviewLike[];
  auditEvents?: readonly AgentRuntimeAuditEventPreviewLike[];
  errors?: readonly AgentRuntimeErrorPreviewLike[];
  metadata?: unknown;
}

export type PersistableMockRuntimePreviewInput =
  | AgentRuntimePreviewLike
  | MockRuntimePreviewPlanLike;

export interface PersistMockRuntimePreviewOptions {
  appendChildren?: boolean;
  maxSteps?: number;
  maxToolCalls?: number;
  maxLlmCalls?: number;
  maxEvents?: number;
  maxAuditEvents?: number;
  maxErrors?: number;
  now?: string;
  dryRun?: boolean;
}

export interface MockRuntimePersistenceCounts {
  executions: number;
  steps: number;
  toolCalls: number;
  llmCalls: number;
  events: number;
  auditEvents: number;
  errors: number;
}

export interface PersistMockRuntimePreviewResult {
  ok: boolean;
  previewOnly: true;
  executionId?: string;
  persistedCounts: MockRuntimePersistenceCounts;
  skippedCounts: MockRuntimePersistenceCounts;
  warnings: string[];
  message: string;
  dryRun?: boolean;
}

interface NormalizedMockRuntimePreviewPlan {
  runtime: AgentRuntimePreviewLike;
  steps: readonly AgentRuntimeStepPreviewLike[];
  toolCalls: readonly AgentRuntimeToolCallPreviewLike[];
  llmCalls: readonly AgentRuntimeLlmCallPreviewLike[];
  events: readonly AgentRuntimeEventPreviewLike[];
  auditEvents: readonly AgentRuntimeAuditEventPreviewLike[];
  errors: readonly AgentRuntimeErrorPreviewLike[];
  metadata?: unknown;
}

interface LimitedMockRuntimePreviewPlan extends NormalizedMockRuntimePreviewPlan {
  skippedCounts: MockRuntimePersistenceCounts;
  warnings: string[];
}

const defaultMockRuntimePreviewLimits = {
  maxSteps: 20,
  maxToolCalls: 20,
  maxLlmCalls: 10,
  maxEvents: 50,
  maxAuditEvents: 50,
  maxErrors: 20,
} as const;

/**
 * Preview-only persistence orchestrator for mock runtime records.
 *
 * Despite the MockRunner name, this class never starts a runtime, advances an
 * Agent loop, executes tools, calls LLMs, confirms permissions, or starts jobs.
 * It only maps already-created preview data through A95 mapper functions and
 * persists preview records through the A94 repository boundary.
 */
export class PrismaAgentRuntimeMockRunnerPreview {
  private readonly repository: AgentRuntimeRepository;

  constructor(repository: AgentRuntimeRepository) {
    this.repository = repository;
  }

  async persistMockRuntimePreview(
    input: PersistableMockRuntimePreviewInput,
    options: PersistMockRuntimePreviewOptions = {},
  ): Promise<PersistMockRuntimePreviewResult> {
    const persistencePlan = createMockRuntimePersistencePlan(input, options);

    if (options.dryRun === true) {
      return createDryRunResult(persistencePlan);
    }

    const execution = await this.repository.createRuntimeExecutionPreview(
      persistencePlan.executionInput,
    );

    if (persistencePlan.appendChildren) {
      for (const stepInput of persistencePlan.stepInputs) {
        await this.repository.appendRuntimeStepPreview(execution.id, stepInput);
      }

      for (const toolCallInput of persistencePlan.toolCallInputs) {
        await this.repository.appendRuntimeToolCallPreview(
          execution.id,
          toolCallInput,
        );
      }

      for (const llmCallInput of persistencePlan.llmCallInputs) {
        await this.repository.appendRuntimeLlmCallPreview(
          execution.id,
          llmCallInput,
        );
      }

      for (const eventInput of persistencePlan.eventInputs) {
        await this.repository.appendRuntimeEventPreview(
          execution.id,
          eventInput,
        );
      }

      for (const auditLogInput of persistencePlan.auditLogInputs) {
        await this.repository.appendRuntimeAuditLogPreview(
          execution.id,
          auditLogInput,
        );
      }
    }

    return {
      ok: true,
      previewOnly: true,
      executionId: execution.id,
      persistedCounts: persistencePlan.persistedCounts,
      skippedCounts: persistencePlan.skippedCounts,
      warnings: persistencePlan.warnings,
      message: createPersistenceMessage({
        dryRun: false,
        appendChildren: persistencePlan.appendChildren,
        errors: persistencePlan.persistedCounts.errors,
      }),
    };
  }

  previewMockRuntimePersistencePlan(
    input: PersistableMockRuntimePreviewInput,
    options: PersistMockRuntimePreviewOptions = {},
  ): PersistMockRuntimePreviewResult {
    return createDryRunResult(createMockRuntimePersistencePlan(input, options));
  }
}

function createMockRuntimePersistencePlan(
  input: PersistableMockRuntimePreviewInput,
  options: PersistMockRuntimePreviewOptions,
) {
  const normalizedPlan = normalizeMockRuntimePreviewPlan(input);
  const limitedPlan = applyMockRuntimePreviewLimits(
    normalizedPlan,
    options,
  );
  const appendChildren = options.appendChildren !== false;
  const runtimeForPersistence = createRuntimeForPersistence({
    plan: limitedPlan,
    appendChildren,
    now: options.now,
    dryRun: options.dryRun === true,
  });
  const executionInput =
    mapAgentRuntimePreviewToCreateRuntimeExecutionInput(
      runtimeForPersistence,
    );
  const stepInputs = appendChildren
    ? limitedPlan.steps.map((step) =>
        mapAgentRuntimeStepPreviewToAppendRuntimeStepInput(step),
      )
    : [];
  const toolCallInputs = appendChildren
    ? limitedPlan.toolCalls.map((toolCall) =>
        mapAgentRuntimeToolCallPreviewToAppendRuntimeToolCallInput(toolCall),
      )
    : [];
  const llmCallInputs = appendChildren
    ? limitedPlan.llmCalls.map((llmCall) =>
        mapAgentRuntimeLlmCallPreviewToAppendRuntimeLlmCallInput(llmCall),
      )
    : [];
  const eventInputs = appendChildren
    ? limitedPlan.events.map((event) =>
        mapAgentRuntimeEventPreviewToAppendRuntimeEventInput(event),
      )
    : [];
  const auditLogInputs = appendChildren
    ? limitedPlan.auditEvents.map((auditEvent) =>
        mapAgentRuntimeAuditEventPreviewToAppendRuntimeAuditLogInput(
          auditEvent,
        ),
      )
    : [];
  const childSkippedCounts = appendChildren
    ? limitedPlan.skippedCounts
    : createCounts({
        steps: normalizedPlan.steps.length,
        toolCalls: normalizedPlan.toolCalls.length,
        llmCalls: normalizedPlan.llmCalls.length,
        events: normalizedPlan.events.length,
        auditEvents: normalizedPlan.auditEvents.length,
        errors: limitedPlan.skippedCounts.errors,
      });
  const warnings = appendChildren
    ? [...limitedPlan.warnings]
    : [
        ...limitedPlan.warnings,
        "appendChildren=false; only the runtime execution preview record will be created.",
      ];
  const persistedCounts = createCounts({
    executions: 1,
    steps: stepInputs.length,
    toolCalls: toolCallInputs.length,
    llmCalls: llmCallInputs.length,
    events: eventInputs.length,
    auditEvents: auditLogInputs.length,
    errors: limitedPlan.errors.length,
  });

  if (limitedPlan.errors.length > 0) {
    warnings.push(
      "Runtime error previews are stored on the execution errors JSON field; no separate runtime error child table exists in the current A94 repository.",
    );
  }

  return {
    appendChildren,
    executionInput,
    stepInputs,
    toolCallInputs,
    llmCallInputs,
    eventInputs,
    auditLogInputs,
    persistedCounts,
    skippedCounts: childSkippedCounts,
    warnings,
  };
}

function normalizeMockRuntimePreviewPlan(
  input: PersistableMockRuntimePreviewInput,
): NormalizedMockRuntimePreviewPlan {
  if (isMockRuntimePreviewPlanLike(input)) {
    return {
      runtime: input.runtime,
      steps: normalizeArray(input.steps ?? input.runtime.steps),
      toolCalls: normalizeArray(input.toolCalls ?? input.runtime.toolCalls),
      llmCalls: normalizeArray(input.llmCalls ?? input.runtime.llmCalls),
      events: normalizeArray(input.events ?? input.runtime.events),
      auditEvents: normalizeArray(
        input.auditEvents ?? input.runtime.auditEvents,
      ),
      errors: normalizeArray(input.errors ?? input.runtime.errors),
      metadata: input.metadata,
    };
  }

  return {
    runtime: input,
    steps: normalizeArray(input.steps),
    toolCalls: normalizeArray(input.toolCalls),
    llmCalls: normalizeArray(input.llmCalls),
    events: normalizeArray(input.events),
    auditEvents: normalizeArray(input.auditEvents),
    errors: normalizeArray(input.errors),
  };
}

function applyMockRuntimePreviewLimits(
  plan: NormalizedMockRuntimePreviewPlan,
  options: PersistMockRuntimePreviewOptions,
): LimitedMockRuntimePreviewPlan {
  const warnings: string[] = [];
  const maxSteps = normalizeLimit(
    options.maxSteps,
    defaultMockRuntimePreviewLimits.maxSteps,
    "maxSteps",
    warnings,
  );
  const maxToolCalls = normalizeLimit(
    options.maxToolCalls,
    defaultMockRuntimePreviewLimits.maxToolCalls,
    "maxToolCalls",
    warnings,
  );
  const maxLlmCalls = normalizeLimit(
    options.maxLlmCalls,
    defaultMockRuntimePreviewLimits.maxLlmCalls,
    "maxLlmCalls",
    warnings,
  );
  const maxEvents = normalizeLimit(
    options.maxEvents,
    defaultMockRuntimePreviewLimits.maxEvents,
    "maxEvents",
    warnings,
  );
  const maxAuditEvents = normalizeLimit(
    options.maxAuditEvents,
    defaultMockRuntimePreviewLimits.maxAuditEvents,
    "maxAuditEvents",
    warnings,
  );
  const maxErrors = normalizeLimit(
    options.maxErrors,
    defaultMockRuntimePreviewLimits.maxErrors,
    "maxErrors",
    warnings,
  );
  const limitedSteps = limitArray(plan.steps, maxSteps, "steps", warnings);
  const limitedToolCalls = limitArray(
    plan.toolCalls,
    maxToolCalls,
    "toolCalls",
    warnings,
  );
  const limitedLlmCalls = limitArray(
    plan.llmCalls,
    maxLlmCalls,
    "llmCalls",
    warnings,
  );
  const limitedEvents = limitArray(
    plan.events,
    maxEvents,
    "events",
    warnings,
  );
  const limitedAuditEvents = limitArray(
    plan.auditEvents,
    maxAuditEvents,
    "auditEvents",
    warnings,
  );
  const limitedErrors = limitArray(
    plan.errors,
    maxErrors,
    "errors",
    warnings,
  );

  return {
    ...plan,
    steps: limitedSteps,
    toolCalls: limitedToolCalls,
    llmCalls: limitedLlmCalls,
    events: limitedEvents,
    auditEvents: limitedAuditEvents,
    errors: limitedErrors,
    skippedCounts: createCounts({
      steps: plan.steps.length - limitedSteps.length,
      toolCalls: plan.toolCalls.length - limitedToolCalls.length,
      llmCalls: plan.llmCalls.length - limitedLlmCalls.length,
      events: plan.events.length - limitedEvents.length,
      auditEvents: plan.auditEvents.length - limitedAuditEvents.length,
      errors: plan.errors.length - limitedErrors.length,
    }),
    warnings,
  };
}

function createRuntimeForPersistence(input: {
  plan: NormalizedMockRuntimePreviewPlan;
  appendChildren: boolean;
  now?: string;
  dryRun: boolean;
}): AgentRuntimePreviewLike {
  const runtimeMetadata = isRecord(input.plan.runtime.metadata)
    ? input.plan.runtime.metadata
    : {};

  return {
    ...input.plan.runtime,
    steps: input.appendChildren ? input.plan.steps : [],
    toolCalls: input.appendChildren ? input.plan.toolCalls : [],
    llmCalls: input.appendChildren ? input.plan.llmCalls : [],
    events: input.appendChildren ? input.plan.events : [],
    auditEvents: input.appendChildren ? input.plan.auditEvents : [],
    errors: input.plan.errors,
    metadata: {
      ...runtimeMetadata,
      mockRuntimePreviewPersistence: {
        previewOnly: true,
        orchestrator: "PrismaAgentRuntimeMockRunnerPreview",
        dryRun: input.dryRun,
        appendChildren: input.appendChildren,
        now: normalizeOptionalText(input.now),
        planMetadata: input.plan.metadata,
      },
    },
  };
}

function createDryRunResult(input: {
  appendChildren: boolean;
  persistedCounts: MockRuntimePersistenceCounts;
  skippedCounts: MockRuntimePersistenceCounts;
  warnings: string[];
}): PersistMockRuntimePreviewResult {
  return {
    ok: true,
    previewOnly: true,
    dryRun: true,
    persistedCounts: input.persistedCounts,
    skippedCounts: input.skippedCounts,
    warnings: input.warnings,
    message: createPersistenceMessage({
      dryRun: true,
      appendChildren: input.appendChildren,
      errors: input.persistedCounts.errors,
    }),
  };
}

function createPersistenceMessage(input: {
  dryRun: boolean;
  appendChildren: boolean;
  errors: number;
}): string {
  const action = input.dryRun ? "Previewed" : "Persisted";
  const childMessage = input.appendChildren
    ? "execution and child preview records"
    : "execution preview record only";
  const errorMessage =
    input.errors > 0
      ? " Runtime error previews were included as execution errors JSON."
      : "";

  return `${action} mock runtime ${childMessage}. This is preview-only; no Agent runtime, tool execution, LLM call, permission confirmation, background job, or scheduler was started.${errorMessage}`;
}

function limitArray<T>(
  values: readonly T[],
  limit: number,
  label: string,
  warnings: string[],
): readonly T[] {
  if (values.length <= limit) {
    return values;
  }

  warnings.push(
    `${label} exceeded max ${limit}; ${values.length - limit} preview item(s) were skipped.`,
  );

  return values.slice(0, limit);
}

function normalizeLimit(
  value: number | undefined,
  fallback: number,
  label: string,
  warnings: string[],
): number {
  if (value === undefined) {
    return fallback;
  }

  if (!Number.isFinite(value)) {
    warnings.push(`${label} was not finite; default max ${fallback} was used.`);
    return fallback;
  }

  return Math.max(0, Math.trunc(value));
}

function createCounts(
  input: Partial<MockRuntimePersistenceCounts> = {},
): MockRuntimePersistenceCounts {
  return {
    executions: input.executions ?? 0,
    steps: input.steps ?? 0,
    toolCalls: input.toolCalls ?? 0,
    llmCalls: input.llmCalls ?? 0,
    events: input.events ?? 0,
    auditEvents: input.auditEvents ?? 0,
    errors: input.errors ?? 0,
  };
}

function isMockRuntimePreviewPlanLike(
  input: PersistableMockRuntimePreviewInput,
): input is MockRuntimePreviewPlanLike {
  return isRecord(input) && isRecord(input.runtime);
}

function normalizeArray<T>(value: readonly T[] | undefined): readonly T[] {
  return Array.isArray(value) ? value : [];
}

function normalizeOptionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  return normalized.length > 0 ? normalized : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
