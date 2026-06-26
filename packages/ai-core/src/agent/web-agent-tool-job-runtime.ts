import {
  createWebAgentToolRegistryMetadata,
  executeWebAgentToolPreview,
  getWebAgentToolRegistry,
  validateWebAgentToolInput,
  type WebAgentToolDataLoaders,
  type WebAgentToolDefinition,
  type WebAgentToolExecutionResult,
  type WebAgentToolName,
} from "./web-agent-tool-framework.ts";
import {
  evaluateWebAgentNetworkDevGuard,
  type WebAgentNetworkDevGuardResult,
} from "./web-agent-network-dev-guard.ts";

export const ToolJobStatus = {
  Queued: "queued",
  Running: "running",
  Succeeded: "succeeded",
  Blocked: "blocked",
  Failed: "failed",
  TimedOut: "timedOut",
  Cancelled: "cancelled",
} as const;

export type ToolJobStatus =
  (typeof ToolJobStatus)[keyof typeof ToolJobStatus];

export const ToolJobTraceEventKind = {
  Queued: "queued",
  PolicyChecked: "policy_checked",
  ToolSelected: "tool_selected",
  InputValidated: "input_validated",
  Running: "running",
  Succeeded: "succeeded",
  Blocked: "blocked",
  Failed: "failed",
  TimedOut: "timedOut",
  Cancelled: "cancelled",
  PreviewTruncated: "preview_truncated",
} as const;

export type ToolJobTraceEventKind =
  (typeof ToolJobTraceEventKind)[keyof typeof ToolJobTraceEventKind];

export const ToolJobTraceEventSeverity = {
  Info: "info",
  Warning: "warning",
  Blocked: "blocked",
  Error: "error",
} as const;

export type ToolJobTraceEventSeverity =
  (typeof ToolJobTraceEventSeverity)[keyof typeof ToolJobTraceEventSeverity];

export interface ToolJobPolicy {
  enabled: boolean;
  allowReadOnlyTools: true;
  allowSafeToExposeToClient: true;
  timeoutMs: number;
  maxInputBytes: number;
  maxPreviewBytes: number;
  productionReady: false;
}

export interface ToolJobRequest {
  messagePreview: string;
  selectedToolId: WebAgentToolName | null;
  selectedToolInput: Record<string, unknown>;
  selectedBy: string;
  selectionSource: string;
  toolPreviewEnabled: boolean;
  requestedAt?: string;
}

export interface ToolJobTraceEvent {
  traceEventId: string;
  kind: ToolJobTraceEventKind;
  severity: ToolJobTraceEventSeverity;
  message: string;
  jobStatus: ToolJobStatus | null;
  selectedToolId: WebAgentToolName | null;
  details: readonly string[];
  createdAt: string;
  devOnly: true;
  productionReady: false;
  safeToExposeToClient: true;
  secretSafe: true;
  rawPromptStored: false;
  rawResponseStored: false;
}

export interface ToolJobResult {
  jobId: string;
  toolId: WebAgentToolName | null;
  toolName: string | null;
  status: ToolJobStatus;
  toolExecutionStatus: WebAgentToolExecutionResult["status"] | null;
  toolExecution: WebAgentToolExecutionResult | null;
  resultPreview: string | null;
  previewTruncated: boolean;
  blockedReason: string | null;
  errorReason: string | null;
  timeoutReason: string | null;
  cancelledReason: string | null;
  warnings: readonly string[];
  inputSummary: string;
  startedAt: string | null;
  finishedAt: string;
  elapsedMs: number;
  devOnly: true;
  productionReady: false;
  safeToExposeToClient: true;
  secretSafe: true;
  rawPromptStored: false;
  rawResponseStored: false;
}

export interface ToolJob {
  jobId: string;
  status: ToolJobStatus;
  selectedToolId: WebAgentToolName | null;
  selectedToolName: string | null;
  request: ToolJobRequest;
  policy: ToolJobPolicy;
  traceEvents: readonly ToolJobTraceEvent[];
  result: ToolJobResult | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  blockedReason: string | null;
  errorReason: string | null;
  timeoutReason: string | null;
  cancelledReason: string | null;
  devOnly: true;
  productionReady: false;
  safeToExposeToClient: true;
  secretSafe: true;
  rawPromptStored: false;
  rawResponseStored: false;
}

export interface ToolJobExecutorContext {
  signal: AbortSignal;
  now: () => string;
}

export type ToolJobExecutor = (input: {
  request: ToolJobRequest;
  toolDefinition: WebAgentToolDefinition;
  normalizedInput: Record<string, unknown>;
  dataLoaders: WebAgentToolDataLoaders;
  toolPreviewEnabled: boolean;
  policy: ToolJobPolicy;
  context: ToolJobExecutorContext;
  fetchImpl?: typeof globalThis.fetch;
  networkGuard?: WebAgentNetworkDevGuardResult;
}) => Promise<WebAgentToolExecutionResult>;

export interface WebAgentToolJobRuntimeOptions {
  toolDataLoaders: WebAgentToolDataLoaders;
  toolRegistry?: readonly WebAgentToolDefinition[];
  policy?: Partial<ToolJobPolicy>;
  executor?: ToolJobExecutor;
  fetchImpl?: typeof globalThis.fetch;
  networkGuard?: WebAgentNetworkDevGuardResult;
  now?: () => Date;
}

export interface ToolJobHandle {
  jobId: string;
  getSnapshot(): ToolJob;
  cancel(reason?: string): ToolJob | null;
  readonly result: Promise<ToolJob>;
}

export interface WebAgentToolJobRuntime {
  submitToolJob(request: ToolJobRequest): ToolJobHandle;
  runToolJob(request: ToolJobRequest): Promise<ToolJob>;
  getToolJob(jobId: string): ToolJob | null;
  listToolJobs(): readonly ToolJob[];
  cancelToolJob(jobId: string, reason?: string): ToolJob | null;
  getPolicy(): ToolJobPolicy;
}

export interface WebAgentToolJobPreviewInput {
  request: ToolJobRequest;
  toolExecution: WebAgentToolExecutionResult;
  policy?: Partial<ToolJobPolicy>;
  toolRegistry?: readonly WebAgentToolDefinition[];
  createdAt?: string;
}

const DEFAULT_TIMEOUT_MS = 2_500;
const DEFAULT_MAX_INPUT_BYTES = 2_048;
const DEFAULT_MAX_PREVIEW_BYTES = 1_024;
const DEFAULT_MESSAGE_PREVIEW_CHARS = 220;

export function createDefaultToolJobPolicy(): ToolJobPolicy {
  return {
    enabled: false,
    allowReadOnlyTools: true,
    allowSafeToExposeToClient: true,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    maxInputBytes: DEFAULT_MAX_INPUT_BYTES,
    maxPreviewBytes: DEFAULT_MAX_PREVIEW_BYTES,
    productionReady: false,
  };
}

export function createWebAgentToolJobRuntime(
  options: WebAgentToolJobRuntimeOptions,
): WebAgentToolJobRuntime {
  const jobs = new Map<string, MutableToolJob>();
  const policy = normalizeToolJobPolicy(options.policy);
  const toolRegistry = createWebAgentToolRegistryMetadata(
    options.toolRegistry ?? getWebAgentToolRegistry(),
  );
  const executor =
    options.executor ??
    (async (input) =>
      executeWebAgentToolPreview({
        message: input.request.messagePreview,
        toolId: input.toolDefinition.toolId,
        toolPreviewEnabled: input.toolPreviewEnabled,
        toolInput: input.normalizedInput,
        dataLoaders: options.toolDataLoaders,
        fetchImpl: input.fetchImpl ?? options.fetchImpl,
        networkGuard:
          input.networkGuard ??
          options.networkGuard ??
          evaluateWebAgentNetworkDevGuard({
            LAP_WEB_AGENT_NETWORK_DEV_ENABLED:
              process.env.LAP_WEB_AGENT_NETWORK_DEV_ENABLED,
            LAP_ALLOW_AGENT_NETWORK: process.env.LAP_ALLOW_AGENT_NETWORK,
            NODE_ENV: process.env.NODE_ENV,
          }),
      }));
  const now = options.now ?? (() => new Date());

  function submitToolJob(request: ToolJobRequest): ToolJobHandle {
    const normalizedRequest = normalizeToolJobRequest(request);
    const jobId = createToolJobId(normalizedRequest, now());
    const createdAt = now().toISOString();
    const selectedToolDefinition = resolveSelectedToolDefinition(
      toolRegistry,
      normalizedRequest.selectedToolId,
    );
    const mutableJob = createMutableToolJob({
      jobId,
      request: normalizedRequest,
      policy,
      selectedToolDefinition,
      createdAt,
    });

    jobs.set(jobId, mutableJob);
    void queueMicrotask(() => {
      void processQueuedJob({
        mutableJob,
        toolRegistry,
        toolDataLoaders: options.toolDataLoaders,
        executor,
        fetchImpl: options.fetchImpl,
        networkGuard: options.networkGuard,
        now,
      });
    });

    return {
      jobId,
      getSnapshot: () => cloneToolJob(mutableJob),
      cancel: (reason?: string) => cancelJob(mutableJob, reason),
      get result() {
        return mutableJob.resultPromise;
      },
    };
  }

  async function runToolJob(request: ToolJobRequest): Promise<ToolJob> {
    const handle = submitToolJob(request);
    return handle.result;
  }

  function getToolJob(jobId: string): ToolJob | null {
    const job = jobs.get(jobId);
    return job === undefined ? null : cloneToolJob(job);
  }

  function listToolJobs(): readonly ToolJob[] {
    return Array.from(jobs.values()).map((job) => cloneToolJob(job));
  }

  function cancelToolJob(jobId: string, reason?: string): ToolJob | null {
    const job = jobs.get(jobId);

    if (job === undefined) {
      return null;
    }

    return cancelJob(job, reason);
  }

  return {
    submitToolJob,
    runToolJob,
    getToolJob,
    listToolJobs,
    cancelToolJob,
    getPolicy: () => ({ ...policy }),
  };

  function cancelJob(job: MutableToolJob, reason?: string): ToolJob | null {
    if (
      job.status !== ToolJobStatus.Queued &&
      job.status !== ToolJobStatus.Running
    ) {
      return cloneToolJob(job);
    }

    job.cancelledReason = sanitizePreviewText(
      reason ?? "Cancelled by caller.",
    );
    job.controller.abort();
    return cloneToolJob(job);
  }
}

export function createWebAgentToolJobPreviewFromExecution(
  input: WebAgentToolJobPreviewInput,
): ToolJob {
  const policy = normalizeToolJobPolicy(input.policy);
  const createdAt = input.createdAt ?? new Date().toISOString();
  const selectedToolDefinition = resolveSelectedToolDefinition(
    createWebAgentToolRegistryMetadata(input.toolRegistry ?? getWebAgentToolRegistry()),
    input.request.selectedToolId,
  );
  const mutableJob = createMutableToolJob({
    jobId: createToolJobId(input.request, new Date(createdAt)),
    request: normalizeToolJobRequest(input.request),
    policy,
    selectedToolDefinition,
    createdAt,
  });

  applyJobQueuedTrace(mutableJob, createdAt);
  applyJobPolicyTrace(mutableJob, createdAt);

  const policyBlockReason = getPolicyBlockReason(mutableJob.request, policy);

  if (policyBlockReason !== null) {
    finalizeBlockedJob(mutableJob, {
      blockedReason: policyBlockReason,
      toolExecution: createBlockedToolExecution(
        selectedToolDefinition?.toolId ?? input.request.selectedToolId,
        policyBlockReason,
        mutableJob.request.messagePreview,
      ),
      createdAt,
      startedAt: null,
      resultPreview: "Tool job was blocked before execution started.",
      warnings: [
        "The background tool job was blocked safely before execution started.",
      ],
      kind: ToolJobTraceEventKind.Blocked,
      message: "Tool job was blocked before execution started.",
    });

    return cloneToolJob(mutableJob);
  }

  if (selectedToolDefinition === null) {
    finalizeBlockedJob(mutableJob, {
      blockedReason: "tool_not_registered",
      toolExecution: createBlockedToolExecution(
        input.request.selectedToolId,
        "tool_not_registered",
        mutableJob.request.messagePreview,
      ),
      createdAt,
      startedAt: null,
      resultPreview: "The selected tool was not registered.",
      warnings: ["The selected tool was not found in the registry."],
      kind: ToolJobTraceEventKind.Blocked,
      message: "The selected tool was not found in the registry.",
    });

    return cloneToolJob(mutableJob);
  }

  const inputSummary = buildInputSummary(mutableJob.request.selectedToolInput);
  const inputSize = byteLength(inputSummary);

  if (inputSize > policy.maxInputBytes) {
    finalizeBlockedJob(mutableJob, {
      blockedReason: "input_too_large",
      toolExecution: createBlockedToolExecution(
        selectedToolDefinition.toolId,
        "input_too_large",
        mutableJob.request.messagePreview,
      ),
      createdAt,
      startedAt: null,
      resultPreview: "The selected tool input exceeded the preview budget.",
      warnings: [
        `Tool input was ${inputSize} bytes, which exceeded the ${policy.maxInputBytes}-byte preview budget.`,
      ],
      kind: ToolJobTraceEventKind.Blocked,
      message: "The selected tool input exceeded the preview budget.",
    });

    return cloneToolJob(mutableJob);
  }

  const validation = validateWebAgentToolInput(
    selectedToolDefinition,
    mutableJob.request.selectedToolInput,
  );

  applyJobTraceEvent(mutableJob, {
    kind: ToolJobTraceEventKind.InputValidated,
    severity: validation.valid ? ToolJobTraceEventSeverity.Info : ToolJobTraceEventSeverity.Warning,
    message: validation.valid
      ? "Tool input passed preview validation."
      : "Tool input failed preview validation.",
    jobStatus: null,
    selectedToolId: selectedToolDefinition.toolId,
    details: [
      validation.inputSummary,
      validation.blockedReason === null
        ? "blockedReason=none"
        : `blockedReason=${validation.blockedReason}`,
    ],
    createdAt,
  });

  if (!validation.valid) {
    finalizeBlockedJob(mutableJob, {
      blockedReason: validation.blockedReason ?? "validation_failed",
      toolExecution: createBlockedToolExecution(
        selectedToolDefinition.toolId,
        validation.blockedReason ?? "validation_failed",
        mutableJob.request.messagePreview,
      ),
      createdAt,
      startedAt: null,
      resultPreview: "The selected tool input failed preview validation.",
      warnings: validation.warnings,
      kind: ToolJobTraceEventKind.Blocked,
      message: "The selected tool input failed preview validation.",
    });

    return cloneToolJob(mutableJob);
  }

  startRunningJob(mutableJob, createdAt);

  finalizeJobFromExecution(mutableJob, {
    createdAt,
    startedAt: mutableJob.startedAt,
    toolExecution: input.toolExecution,
    policy,
  });

  return cloneToolJob(mutableJob);
}

function createMutableToolJob(input: {
  jobId: string;
  request: ToolJobRequest;
  policy: ToolJobPolicy;
  selectedToolDefinition: WebAgentToolDefinition | null;
  createdAt: string;
}): MutableToolJob {
  const job: MutableToolJob = {
    jobId: input.jobId,
    status: ToolJobStatus.Queued,
    selectedToolId: input.request.selectedToolId,
    selectedToolName: input.selectedToolDefinition?.displayName ?? null,
    request: input.request,
    policy: { ...input.policy },
    traceEvents: [],
    result: null,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    startedAt: null,
    finishedAt: null,
    blockedReason: null,
    errorReason: null,
    timeoutReason: null,
    cancelledReason: null,
    devOnly: true,
    productionReady: false,
    safeToExposeToClient: true,
    secretSafe: true,
    rawPromptStored: false,
    rawResponseStored: false,
    controller: new AbortController(),
    resolveResult: () => {},
    rejectResult: () => {},
    resultPromise: Promise.resolve(undefined as never),
    finalized: false,
  };

  job.resultPromise = new Promise<ToolJob>((resolve, reject) => {
    job.resolveResult = resolve;
    job.rejectResult = reject;
  });

  applyJobQueuedTrace(job, input.createdAt);
  applyJobPolicyTrace(job, input.createdAt);
  if (job.selectedToolId !== null) {
    applyJobTraceEvent(job, {
      kind: ToolJobTraceEventKind.ToolSelected,
      severity: ToolJobTraceEventSeverity.Info,
      message: "Tool job selected a preview-safe tool.",
      jobStatus: ToolJobStatus.Queued,
      selectedToolId: job.selectedToolId,
      details: [
        `selectedToolName=${job.selectedToolName ?? "unknown"}`,
        `selectedBy=${job.request.selectedBy}`,
        `selectionSource=${job.request.selectionSource}`,
      ],
      createdAt: input.createdAt,
    });
  }

  return job;
}

async function processQueuedJob(input: {
  mutableJob: MutableToolJob;
  toolRegistry: readonly WebAgentToolDefinition[];
  toolDataLoaders: WebAgentToolDataLoaders;
  executor: ToolJobExecutor;
  fetchImpl?: typeof globalThis.fetch;
  networkGuard?: WebAgentNetworkDevGuardResult;
  now: () => Date;
}): Promise<void> {
  const { mutableJob } = input;

  if (mutableJob.status !== ToolJobStatus.Queued || mutableJob.finalized) {
    return;
  }

  await Promise.resolve();

  if (mutableJob.controller.signal.aborted) {
    finalizeCancelledJob(mutableJob, {
      createdAt: input.now().toISOString(),
      startedAt: null,
      reason:
        mutableJob.cancelledReason ?? "Cancelled before execution started.",
    });
    return;
  }

  const policyBlockReason = getPolicyBlockReason(
    mutableJob.request,
    mutableJob.policy,
  );

  if (policyBlockReason !== null) {
    finalizeBlockedJob(mutableJob, {
      blockedReason: policyBlockReason,
      toolExecution: createBlockedToolExecution(
        mutableJob.request.selectedToolId,
        policyBlockReason,
        mutableJob.request.messagePreview,
      ),
      createdAt: input.now().toISOString(),
      startedAt: null,
      resultPreview: "Tool job was blocked before execution started.",
      warnings: ["The background tool job was blocked safely before execution started."],
      kind: ToolJobTraceEventKind.Blocked,
      message: "Tool job was blocked before execution started.",
    });
    return;
  }

  const selectedToolDefinition = resolveSelectedToolDefinition(
    input.toolRegistry,
    mutableJob.request.selectedToolId,
  );

  if (selectedToolDefinition === null) {
    finalizeBlockedJob(mutableJob, {
      blockedReason: "tool_not_registered",
      toolExecution: createBlockedToolExecution(
        mutableJob.request.selectedToolId,
        "tool_not_registered",
        mutableJob.request.messagePreview,
      ),
      createdAt: input.now().toISOString(),
      startedAt: null,
      resultPreview: "The selected tool was not registered.",
      warnings: ["The selected tool was not found in the registry."],
      kind: ToolJobTraceEventKind.Blocked,
      message: "The selected tool was not found in the registry.",
    });
    return;
  }

  const normalizedInput = normalizeJsonObject(
    mutableJob.request.selectedToolInput,
  );

  if (byteLength(buildInputSummary(normalizedInput)) > mutableJob.policy.maxInputBytes) {
    finalizeBlockedJob(mutableJob, {
      blockedReason: "input_too_large",
      toolExecution: createBlockedToolExecution(
        selectedToolDefinition.toolId,
        "input_too_large",
        mutableJob.request.messagePreview,
      ),
      createdAt: input.now().toISOString(),
      startedAt: null,
      resultPreview: "The selected tool input exceeded the preview budget.",
      warnings: [
        `Tool input exceeded the ${mutableJob.policy.maxInputBytes}-byte preview budget.`,
      ],
      kind: ToolJobTraceEventKind.Blocked,
      message: "The selected tool input exceeded the preview budget.",
    });
    return;
  }

  const validation = validateWebAgentToolInput(
    selectedToolDefinition,
    normalizedInput,
  );

  if (!validation.valid) {
    finalizeBlockedJob(mutableJob, {
      blockedReason: validation.blockedReason ?? "validation_failed",
      toolExecution: createBlockedToolExecution(
        selectedToolDefinition.toolId,
        validation.blockedReason ?? "validation_failed",
        mutableJob.request.messagePreview,
      ),
      createdAt: input.now().toISOString(),
      startedAt: null,
      resultPreview: "The selected tool input failed preview validation.",
      warnings: validation.warnings,
      kind: ToolJobTraceEventKind.Blocked,
      message: "The selected tool input failed preview validation.",
    });
    return;
  }

  startRunningJob(mutableJob, input.now().toISOString());

  const executorContext: ToolJobExecutorContext = {
    signal: mutableJob.controller.signal,
    now: () => input.now().toISOString(),
  };

  try {
    const executorPromise = Promise.resolve(
      input.executor({
        request: mutableJob.request,
        toolDefinition: selectedToolDefinition,
        normalizedInput: validation.normalizedInput,
        dataLoaders: input.toolDataLoaders,
        toolPreviewEnabled: mutableJob.request.toolPreviewEnabled,
        policy: mutableJob.policy,
        context: executorContext,
        fetchImpl: input.fetchImpl,
        networkGuard: input.networkGuard,
      }),
    );

    const outcome = await Promise.race([
      executorPromise,
      createTimeoutPromise(mutableJob.policy.timeoutMs),
      createCancelPromise(mutableJob.controller.signal),
    ]);

    if (isToolExecutionResult(outcome)) {
      finalizeJobFromExecution(mutableJob, {
        createdAt: input.now().toISOString(),
        startedAt: mutableJob.startedAt,
        toolExecution: outcome,
        policy: mutableJob.policy,
      });
      return;
    }

    if (outcome.kind === "cancelled") {
      finalizeCancelledJob(mutableJob, {
        createdAt: input.now().toISOString(),
        startedAt: mutableJob.startedAt,
        reason: outcome.reason,
      });
      return;
    }

    finalizeTimedOutJob(mutableJob, {
      createdAt: input.now().toISOString(),
      startedAt: mutableJob.startedAt,
      timeoutMs: mutableJob.policy.timeoutMs,
    });
  } catch (error) {
    finalizeFailedJob(mutableJob, {
      createdAt: input.now().toISOString(),
      startedAt: mutableJob.startedAt,
      error,
    });
  }
}

function finalizeJobFromExecution(
  mutableJob: MutableToolJob,
  input: {
    createdAt: string;
    startedAt: string | null;
    toolExecution: WebAgentToolExecutionResult;
    policy: ToolJobPolicy;
  },
): void {
  if (mutableJob.finalized) {
    return;
  }

  if (input.toolExecution.safeToExposeToClient !== true) {
    finalizeBlockedJob(mutableJob, {
      blockedReason: "unsafe_result",
      toolExecution: createBlockedToolExecution(
        input.toolExecution.toolId,
        "unsafe_result",
        input.toolExecution.toolResultPreview ?? "unsafe result",
      ),
      createdAt: input.createdAt,
      startedAt: input.startedAt,
      resultPreview: "The tool returned an unsafe result and was blocked.",
      warnings: [
        "The tool result was marked unsafe to expose to the client.",
      ],
      kind: ToolJobTraceEventKind.Blocked,
      message: "The tool returned an unsafe result and was blocked.",
    });
    return;
  }

  const normalizedExecution = normalizeToolExecution(
    input.toolExecution,
    input.policy.maxPreviewBytes,
  );
  const preview = normalizedExecution.toolResultPreview ?? null;
  const timedOutReason =
    normalizedExecution.errorReason === "request_timeout"
      ? "request_timeout"
      : null;
  const jobStatus =
    timedOutReason !== null
      ? ToolJobStatus.TimedOut
      : normalizedExecution.status === "success"
        ? ToolJobStatus.Succeeded
        : normalizedExecution.status === "blocked"
          ? ToolJobStatus.Blocked
          : ToolJobStatus.Failed;

  mutableJob.status = jobStatus;
  mutableJob.result = {
    jobId: mutableJob.jobId,
    toolId: normalizedExecution.toolId,
    toolName: mutableJob.selectedToolName,
    status: jobStatus,
    toolExecutionStatus: normalizedExecution.status,
    toolExecution: normalizedExecution,
    resultPreview: preview,
    previewTruncated:
      normalizedExecution.toolResultPreview !== input.toolExecution.toolResultPreview,
    blockedReason:
      normalizedExecution.status === "blocked"
        ? normalizedExecution.blockedReason
        : null,
    errorReason:
      timedOutReason !== null
        ? null
        : normalizedExecution.status === "error"
        ? normalizedExecution.errorReason
        : null,
    timeoutReason: timedOutReason,
    cancelledReason: null,
    warnings: normalizeStrings([
      ...normalizedExecution.warnings,
      ...(normalizedExecution.toolResultPreview === input.toolExecution.toolResultPreview
        ? []
        : ["The result preview was truncated to stay within the preview budget."]),
    ]),
    inputSummary: normalizedExecution.inputSummary,
    startedAt: input.startedAt,
    finishedAt: input.createdAt,
    elapsedMs: calculateElapsedMs(input.startedAt, input.createdAt),
    devOnly: true,
    productionReady: false,
    safeToExposeToClient: true,
    secretSafe: true,
    rawPromptStored: false,
    rawResponseStored: false,
  };
  mutableJob.startedAt = input.startedAt;
  mutableJob.finishedAt = input.createdAt;
  mutableJob.updatedAt = input.createdAt;
  mutableJob.blockedReason = mutableJob.result.blockedReason;
  mutableJob.errorReason = mutableJob.result.errorReason;
  mutableJob.timeoutReason = mutableJob.result.timeoutReason;
  mutableJob.cancelledReason = null;

  const eventKind =
    jobStatus === ToolJobStatus.TimedOut
      ? ToolJobTraceEventKind.TimedOut
      : jobStatus === ToolJobStatus.Succeeded
      ? ToolJobTraceEventKind.Succeeded
      : jobStatus === ToolJobStatus.Blocked
        ? ToolJobTraceEventKind.Blocked
        : ToolJobTraceEventKind.Failed;
  const eventSeverity =
    jobStatus === ToolJobStatus.TimedOut
      ? ToolJobTraceEventSeverity.Error
      : jobStatus === ToolJobStatus.Succeeded
      ? ToolJobTraceEventSeverity.Info
      : jobStatus === ToolJobStatus.Blocked
        ? ToolJobTraceEventSeverity.Blocked
        : ToolJobTraceEventSeverity.Error;

  applyJobTraceEvent(mutableJob, {
    kind: eventKind,
    severity: eventSeverity,
    message:
      jobStatus === ToolJobStatus.TimedOut
        ? "Tool job timed out safely."
        : jobStatus === ToolJobStatus.Succeeded
        ? "Tool job completed successfully."
        : jobStatus === ToolJobStatus.Blocked
          ? "Tool job completed in blocked mode."
          : "Tool job failed safely.",
    jobStatus,
    selectedToolId: normalizedExecution.toolId,
    details: [
      `toolExecutionStatus=${normalizedExecution.status}`,
      `providerMode=${normalizedExecution.providerMode ?? "blocked"}`,
      `repoAccessStatus=${normalizedExecution.githubRepoAccessStatus ?? "not_checked"}`,
      `safePreview=${String(normalizedExecution.safeToExposeToClient)}`,
      `previewTruncated=${String(mutableJob.result.previewTruncated)}`,
      `elapsedMs=${String(mutableJob.result.elapsedMs)}`,
      ...(timedOutReason === null ? [] : [`timeoutReason=${timedOutReason}`]),
    ],
    createdAt: input.createdAt,
  });

  if (mutableJob.result.previewTruncated) {
    applyJobTraceEvent(mutableJob, {
      kind: ToolJobTraceEventKind.PreviewTruncated,
      severity: ToolJobTraceEventSeverity.Warning,
      message: "Tool job result preview was truncated.",
      jobStatus,
      selectedToolId: normalizedExecution.toolId,
      details: [
        `maxPreviewBytes=${String(input.policy.maxPreviewBytes)}`,
        `inputSummary=${truncateForPreview(normalizedExecution.inputSummary, DEFAULT_MESSAGE_PREVIEW_CHARS)}`,
      ],
      createdAt: input.createdAt,
    });
  }

  resolveJob(mutableJob);
}

function finalizeBlockedJob(
  mutableJob: MutableToolJob,
  input: {
    blockedReason: string;
    toolExecution: WebAgentToolExecutionResult;
    createdAt: string;
    startedAt: string | null;
    resultPreview: string;
    warnings: readonly string[];
    kind: ToolJobTraceEventKind;
    message: string;
  },
): void {
  if (mutableJob.finalized) {
    return;
  }

  mutableJob.status = ToolJobStatus.Blocked;
  mutableJob.startedAt = input.startedAt;
  mutableJob.finishedAt = input.createdAt;
  mutableJob.updatedAt = input.createdAt;
  mutableJob.blockedReason = input.blockedReason;
  mutableJob.errorReason = null;
  mutableJob.timeoutReason = null;
  mutableJob.cancelledReason = null;
  mutableJob.result = {
    jobId: mutableJob.jobId,
    toolId: input.toolExecution.toolId,
    toolName: mutableJob.selectedToolName,
    status: ToolJobStatus.Blocked,
    toolExecutionStatus: input.toolExecution.status,
    toolExecution: input.toolExecution,
    resultPreview: truncateResultPreview(input.resultPreview, mutableJob.policy.maxPreviewBytes),
    previewTruncated: false,
    blockedReason: input.blockedReason,
    errorReason: null,
    timeoutReason: null,
    cancelledReason: null,
    warnings: normalizeStrings(input.warnings),
    inputSummary: input.toolExecution.inputSummary,
    startedAt: input.startedAt,
    finishedAt: input.createdAt,
    elapsedMs: calculateElapsedMs(input.startedAt, input.createdAt),
    devOnly: true,
    productionReady: false,
    safeToExposeToClient: true,
    secretSafe: true,
    rawPromptStored: false,
    rawResponseStored: false,
  };

  applyJobTraceEvent(mutableJob, {
    kind: input.kind,
    severity: ToolJobTraceEventSeverity.Blocked,
    message: input.message,
    jobStatus: ToolJobStatus.Blocked,
    selectedToolId: input.toolExecution.toolId,
    details: [
      `blockedReason=${input.blockedReason}`,
      `toolExecutionStatus=${input.toolExecution.status}`,
    ],
    createdAt: input.createdAt,
  });

  resolveJob(mutableJob);
}

function finalizeTimedOutJob(
  mutableJob: MutableToolJob,
  input: {
    createdAt: string;
    startedAt: string | null;
    timeoutMs: number;
  },
): void {
  if (mutableJob.finalized) {
    return;
  }

  mutableJob.status = ToolJobStatus.TimedOut;
  mutableJob.startedAt = input.startedAt;
  mutableJob.finishedAt = input.createdAt;
  mutableJob.updatedAt = input.createdAt;
  mutableJob.blockedReason = null;
  mutableJob.errorReason = null;
  mutableJob.timeoutReason = `timed out after ${input.timeoutMs}ms`;
  mutableJob.cancelledReason = null;
  mutableJob.result = {
    jobId: mutableJob.jobId,
    toolId: mutableJob.selectedToolId,
    toolName: mutableJob.selectedToolName,
    status: ToolJobStatus.TimedOut,
    toolExecutionStatus: null,
    toolExecution: null,
    resultPreview: `Tool job timed out after ${input.timeoutMs}ms.`,
    previewTruncated: false,
    blockedReason: null,
    errorReason: null,
    timeoutReason: mutableJob.timeoutReason,
    cancelledReason: null,
    warnings: [
      `The background tool job timed out after ${input.timeoutMs}ms.`,
    ],
    inputSummary: buildInputSummary(mutableJob.request.selectedToolInput),
    startedAt: input.startedAt,
    finishedAt: input.createdAt,
    elapsedMs: calculateElapsedMs(input.startedAt, input.createdAt),
    devOnly: true,
    productionReady: false,
    safeToExposeToClient: true,
    secretSafe: true,
    rawPromptStored: false,
    rawResponseStored: false,
  };

  applyJobTraceEvent(mutableJob, {
    kind: ToolJobTraceEventKind.TimedOut,
    severity: ToolJobTraceEventSeverity.Error,
    message: "Tool job timed out.",
    jobStatus: ToolJobStatus.TimedOut,
    selectedToolId: mutableJob.selectedToolId,
    details: [`timeoutMs=${String(input.timeoutMs)}`],
    createdAt: input.createdAt,
  });

  resolveJob(mutableJob);
}

function finalizeCancelledJob(
  mutableJob: MutableToolJob,
  input: {
    createdAt: string;
    startedAt: string | null;
    reason: string;
  },
): void {
  if (mutableJob.finalized) {
    return;
  }

  mutableJob.status = ToolJobStatus.Cancelled;
  mutableJob.startedAt = input.startedAt;
  mutableJob.finishedAt = input.createdAt;
  mutableJob.updatedAt = input.createdAt;
  mutableJob.blockedReason = null;
  mutableJob.errorReason = null;
  mutableJob.timeoutReason = null;
  mutableJob.cancelledReason = input.reason;
  mutableJob.result = {
    jobId: mutableJob.jobId,
    toolId: mutableJob.selectedToolId,
    toolName: mutableJob.selectedToolName,
    status: ToolJobStatus.Cancelled,
    toolExecutionStatus: null,
    toolExecution: null,
    resultPreview: `Tool job cancelled: ${input.reason}`,
    previewTruncated: false,
    blockedReason: null,
    errorReason: null,
    timeoutReason: null,
    cancelledReason: input.reason,
    warnings: [input.reason],
    inputSummary: buildInputSummary(mutableJob.request.selectedToolInput),
    startedAt: input.startedAt,
    finishedAt: input.createdAt,
    elapsedMs: calculateElapsedMs(input.startedAt, input.createdAt),
    devOnly: true,
    productionReady: false,
    safeToExposeToClient: true,
    secretSafe: true,
    rawPromptStored: false,
    rawResponseStored: false,
  };

  applyJobTraceEvent(mutableJob, {
    kind: ToolJobTraceEventKind.Cancelled,
    severity: ToolJobTraceEventSeverity.Warning,
    message: "Tool job was cancelled.",
    jobStatus: ToolJobStatus.Cancelled,
    selectedToolId: mutableJob.selectedToolId,
    details: [input.reason],
    createdAt: input.createdAt,
  });

  resolveJob(mutableJob);
}

function finalizeFailedJob(
  mutableJob: MutableToolJob,
  input: {
    createdAt: string;
    startedAt: string | null;
    error: unknown;
  },
): void {
  if (mutableJob.finalized) {
    return;
  }

  const errorReason = sanitizePreviewText(extractErrorMessage(input.error), 180);
  mutableJob.status = ToolJobStatus.Failed;
  mutableJob.startedAt = input.startedAt;
  mutableJob.finishedAt = input.createdAt;
  mutableJob.updatedAt = input.createdAt;
  mutableJob.blockedReason = null;
  mutableJob.errorReason = errorReason;
  mutableJob.timeoutReason = null;
  mutableJob.cancelledReason = null;
  mutableJob.result = {
    jobId: mutableJob.jobId,
    toolId: mutableJob.selectedToolId,
    toolName: mutableJob.selectedToolName,
    status: ToolJobStatus.Failed,
    toolExecutionStatus: "error",
    toolExecution: {
      toolId: mutableJob.selectedToolId,
      status: "error",
      safeToExposeToClient: true,
      toolResultPreview: truncateResultPreview(
        `[error] Tool job failed safely. ${errorReason}`,
        mutableJob.policy.maxPreviewBytes,
      ),
      blockedReason: null,
      errorReason: "preview_execution_failed_safely",
      warnings: [
        "The preview failed safely; no raw stack, secret, or database detail was exposed.",
      ],
      inputSummary: buildInputSummary(mutableJob.request.selectedToolInput),
      readOnly: true,
      enabledByDefault: false,
      productionReady: false,
    },
    resultPreview: truncateResultPreview(
      `[error] Tool job failed safely. ${errorReason}`,
      mutableJob.policy.maxPreviewBytes,
    ),
    previewTruncated: false,
    blockedReason: null,
    errorReason,
    timeoutReason: null,
    cancelledReason: null,
    warnings: [
      "The background tool job failed safely.",
      errorReason,
    ],
    inputSummary: buildInputSummary(mutableJob.request.selectedToolInput),
    startedAt: input.startedAt,
    finishedAt: input.createdAt,
    elapsedMs: calculateElapsedMs(input.startedAt, input.createdAt),
    devOnly: true,
    productionReady: false,
    safeToExposeToClient: true,
    secretSafe: true,
    rawPromptStored: false,
    rawResponseStored: false,
  };

  applyJobTraceEvent(mutableJob, {
    kind: ToolJobTraceEventKind.Failed,
    severity: ToolJobTraceEventSeverity.Error,
    message: "Tool job failed safely.",
    jobStatus: ToolJobStatus.Failed,
    selectedToolId: mutableJob.selectedToolId,
    details: [errorReason],
    createdAt: input.createdAt,
  });

  resolveJob(mutableJob);
}

function startRunningJob(mutableJob: MutableToolJob, createdAt: string): void {
  mutableJob.status = ToolJobStatus.Running;
  mutableJob.startedAt = createdAt;
  mutableJob.updatedAt = createdAt;
  applyJobTraceEvent(mutableJob, {
    kind: ToolJobTraceEventKind.Running,
    severity: ToolJobTraceEventSeverity.Info,
    message: "Tool job is running.",
    jobStatus: ToolJobStatus.Running,
    selectedToolId: mutableJob.selectedToolId,
    details: [
      `selectedToolId=${mutableJob.selectedToolId ?? "none"}`,
      `selectedBy=${sanitizePreviewText(mutableJob.request.selectedBy, 80)}`,
    ],
    createdAt,
  });
}

function applyJobQueuedTrace(job: MutableToolJob, createdAt: string): void {
  applyJobTraceEvent(job, {
    kind: ToolJobTraceEventKind.Queued,
    severity: ToolJobTraceEventSeverity.Info,
    message: "Tool job was queued.",
    jobStatus: ToolJobStatus.Queued,
    selectedToolId: job.selectedToolId,
    details: [
      `messagePreview=${truncateForPreview(job.request.messagePreview, DEFAULT_MESSAGE_PREVIEW_CHARS)}`,
      `toolPreviewEnabled=${String(job.request.toolPreviewEnabled)}`,
    ],
    createdAt,
  });
}

function applyJobPolicyTrace(job: MutableToolJob, createdAt: string): void {
  applyJobTraceEvent(job, {
    kind: ToolJobTraceEventKind.PolicyChecked,
    severity:
      job.policy.enabled && job.request.toolPreviewEnabled
        ? ToolJobTraceEventSeverity.Info
        : ToolJobTraceEventSeverity.Warning,
    message: job.policy.enabled
      ? "Tool job policy was enabled."
      : "Tool job policy is disabled by default.",
    jobStatus: null,
    selectedToolId: job.selectedToolId,
    details: [
      `enabled=${String(job.policy.enabled)}`,
      `allowReadOnlyTools=${String(job.policy.allowReadOnlyTools)}`,
      `allowSafeToExposeToClient=${String(job.policy.allowSafeToExposeToClient)}`,
      `timeoutMs=${String(job.policy.timeoutMs)}`,
      `maxInputBytes=${String(job.policy.maxInputBytes)}`,
      `maxPreviewBytes=${String(job.policy.maxPreviewBytes)}`,
      `productionReady=${String(job.policy.productionReady)}`,
    ],
    createdAt,
  });
}

function applyJobTraceEvent(
  job: MutableToolJob,
  input: {
    kind: ToolJobTraceEventKind;
    severity: ToolJobTraceEventSeverity;
    message: string;
    jobStatus: ToolJobStatus | null;
    selectedToolId: WebAgentToolName | null;
    details: readonly string[];
    createdAt: string;
  },
): void {
  const traceEvent: ToolJobTraceEvent = {
    traceEventId: createToolJobTraceEventId(job.jobId, job.traceEvents.length),
    kind: input.kind,
    severity: input.severity,
    message: sanitizePreviewText(input.message, 220),
    jobStatus: input.jobStatus,
    selectedToolId: input.selectedToolId,
    details: normalizeStringArray(input.details, 220),
    createdAt: input.createdAt,
    devOnly: true,
    productionReady: false,
    safeToExposeToClient: true,
    secretSafe: true,
    rawPromptStored: false,
    rawResponseStored: false,
  };

  job.traceEvents = [...job.traceEvents, traceEvent];
  job.updatedAt = input.createdAt;
}

function resolveJob(job: MutableToolJob): void {
  if (job.result === null || job.finalized) {
    return;
  }

  job.finalized = true;
  job.resolveResult(cloneToolJob(job));
}

function cloneToolJob(job: MutableToolJob): ToolJob {
  return {
    jobId: job.jobId,
    status: job.status,
    selectedToolId: job.selectedToolId,
    selectedToolName: job.selectedToolName,
    request: cloneToolJobRequest(job.request),
    policy: { ...job.policy },
    traceEvents: job.traceEvents.map((event) => ({
      ...event,
      details: [...event.details],
    })),
    result: job.result === null ? null : cloneToolJobResult(job.result),
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    blockedReason: job.blockedReason,
    errorReason: job.errorReason,
    timeoutReason: job.timeoutReason,
    cancelledReason: job.cancelledReason,
    devOnly: true,
    productionReady: false,
    safeToExposeToClient: true,
    secretSafe: true,
    rawPromptStored: false,
    rawResponseStored: false,
  };
}

function cloneToolJobRequest(request: ToolJobRequest): ToolJobRequest {
  return {
    messagePreview: request.messagePreview,
    selectedToolId: request.selectedToolId,
    selectedToolInput: cloneJsonObject(request.selectedToolInput),
    selectedBy: request.selectedBy,
    selectionSource: request.selectionSource,
    toolPreviewEnabled: request.toolPreviewEnabled,
    requestedAt: request.requestedAt,
  };
}

function cloneToolJobResult(result: ToolJobResult): ToolJobResult {
  return {
    ...result,
    warnings: [...result.warnings],
    toolExecution:
      result.toolExecution === null
        ? null
        : {
            ...result.toolExecution,
            warnings: [...result.toolExecution.warnings],
          },
  };
}

function normalizeToolJobRequest(request: ToolJobRequest): ToolJobRequest {
  return {
    messagePreview: sanitizePreviewText(
      request.messagePreview,
      DEFAULT_MESSAGE_PREVIEW_CHARS,
    ),
    selectedToolId: request.selectedToolId,
    selectedToolInput: cloneJsonObject(request.selectedToolInput),
    selectedBy: sanitizePreviewText(request.selectedBy, 80),
    selectionSource: sanitizePreviewText(request.selectionSource, 80),
    toolPreviewEnabled: request.toolPreviewEnabled === true,
    requestedAt: request.requestedAt,
  };
}

function normalizeToolJobPolicy(
  policy?: Partial<ToolJobPolicy>,
): ToolJobPolicy {
  const defaults = createDefaultToolJobPolicy();

  return {
    enabled: policy?.enabled === true,
    allowReadOnlyTools: true,
    allowSafeToExposeToClient: true,
    timeoutMs: normalizePositiveInteger(
      policy?.timeoutMs,
      defaults.timeoutMs,
    ),
    maxInputBytes: normalizePositiveInteger(
      policy?.maxInputBytes,
      defaults.maxInputBytes,
    ),
    maxPreviewBytes: normalizePositiveInteger(
      policy?.maxPreviewBytes,
      defaults.maxPreviewBytes,
    ),
    productionReady: false,
  };
}

function resolveSelectedToolDefinition(
  registry: readonly WebAgentToolDefinition[],
  toolId: WebAgentToolName | null,
): WebAgentToolDefinition | null {
  if (toolId === null) {
    return null;
  }

  return registry.find((tool) => tool.toolId === toolId) ?? null;
}

function getPolicyBlockReason(
  request: ToolJobRequest,
  policy: ToolJobPolicy,
): string | null {
  if (!policy.enabled) {
    return "tool_job_disabled_by_default";
  }

  if (!request.toolPreviewEnabled) {
    return "tool_preview_disabled_by_request";
  }

  if (!policy.allowReadOnlyTools || !policy.allowSafeToExposeToClient) {
    return "policy_requires_readonly_and_safe_tools";
  }

  return null;
}

function createToolJobTraceEventId(jobId: string, index: number): string {
  return `${jobId}_trace_${index.toString(36)}`;
}

function createToolJobId(request: ToolJobRequest, createdAt: Date): string {
  return `tool_job_${simpleHash(
    [
      createdAt.toISOString(),
      request.selectedToolId ?? "none",
      request.selectedBy,
      request.selectionSource,
      request.messagePreview,
      buildInputSummary(request.selectedToolInput),
    ].join("|"),
  )}`;
}

function createTimeoutPromise(
  timeoutMs: number,
): Promise<{ kind: "timedOut" }> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ kind: "timedOut" });
    }, timeoutMs);
  });
}

function createCancelPromise(
  signal: AbortSignal,
): Promise<{ kind: "cancelled"; reason: string }> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve({
        kind: "cancelled",
        reason: "Cancelled before execution started.",
      });
      return;
    }

    signal.addEventListener(
      "abort",
      () => {
        resolve({
          kind: "cancelled",
          reason: "Cancelled by caller.",
        });
      },
      { once: true },
    );
  });
}

function isToolExecutionResult(
  value: unknown,
): value is WebAgentToolExecutionResult {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const execution = value as WebAgentToolExecutionResult;

  return (
    typeof execution.status === "string" &&
    typeof execution.safeToExposeToClient === "boolean" &&
    "toolResultPreview" in execution
  );
}

function normalizeToolExecution(
  execution: WebAgentToolExecutionResult,
  maxPreviewBytes: number,
): WebAgentToolExecutionResult {
  const normalizedPreview = truncateResultPreview(
    execution.toolResultPreview ?? null,
    maxPreviewBytes,
  );

  return {
    ...execution,
    toolResultPreview: normalizedPreview,
    warnings: normalizeStrings(execution.warnings),
  };
}

function createBlockedToolExecution(
  toolId: WebAgentToolName | null,
  blockedReason: string,
  messagePreview: string,
): WebAgentToolExecutionResult {
  return {
    toolId,
    status: "blocked",
    safeToExposeToClient: true,
    providerMode: "blocked",
    githubRepoAccessStatus: "blocked",
    toolResultPreview: truncateResultPreview(
      `[blocked] ${sanitizePreviewText(blockedReason, 120)} :: ${truncateForPreview(messagePreview, DEFAULT_MESSAGE_PREVIEW_CHARS)}`,
      DEFAULT_MAX_PREVIEW_BYTES,
    ),
    blockedReason,
    errorReason: null,
    warnings: [
      "The tool job was blocked safely.",
    ],
    inputSummary: truncateForPreview(messagePreview, DEFAULT_MESSAGE_PREVIEW_CHARS),
    readOnly: true,
    enabledByDefault: false,
    productionReady: false,
  };
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function calculateElapsedMs(
  startedAt: string | null,
  finishedAt: string,
): number {
  if (startedAt === null) {
    return 0;
  }

  return Math.max(0, Date.parse(finishedAt) - Date.parse(startedAt));
}

function normalizePositiveInteger(
  value: number | undefined,
  fallback: number,
): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.floor(value));
}

function buildInputSummary(value: Record<string, unknown>): string {
  const normalized = normalizeJsonObject(value);
  const parts = Object.entries(normalized).map(([key, item]) => {
    if (typeof item === "string") {
      return `${key}=${sanitizePreviewText(item, 120)}`;
    }

    if (typeof item === "number" || typeof item === "boolean") {
      return `${key}=${String(item)}`;
    }

    return `${key}=[object]`;
  });

  return parts.length > 0 ? parts.join(", ") : "no-input";
}

function truncateResultPreview(
  value: string | null,
  maxPreviewBytes: number,
): string | null {
  if (value === null) {
    return null;
  }

  return truncateToByteLength(value, maxPreviewBytes);
}

function truncateToByteLength(value: string, maxBytes: number): string {
  if (byteLength(value) <= maxBytes) {
    return value;
  }

  if (maxBytes <= 3) {
    return ".".repeat(maxBytes);
  }

  let usedBytes = 0;
  let result = "";

  for (const char of value) {
    const charBytes = byteLength(char);

    if (usedBytes + charBytes > maxBytes - 3) {
      break;
    }

    usedBytes += charBytes;
    result += char;
  }

  return `${result.trimEnd()}...`;
}

function truncateForPreview(value: string, maxChars: number): string {
  const normalized = sanitizePreviewText(value, maxChars);
  return normalized;
}

function sanitizePreviewText(value: string, maxChars = 180): string {
  let result = value.trim().replace(/\s+/g, " ");
  result = result.replace(/\bbearer\s+\S+/gi, "bearer [redacted]");
  result = result.replace(
    /\b(api[_-]?key|api[_-]?secret|access[_-]?token|refresh[_-]?token|authorization|password|secret|credential|credentials|cookie|private[_-]?key|client[_-]?secret)\b\s*[:=]\s*\S+/gi,
    "$1=[redacted]",
  );
  result = result.replace(/\bDATABASE_URL\s*[:=]\s*\S+/gi, "DATABASE_URL=[redacted]");
  result = result.replace(
    /\b(raw[_-]?prompt|raw[_-]?messages|raw[_-]?completion|raw[_-]?request|raw[_-]?response|raw[_-]?provider[_-]?response|headers|raw[_-]?headers)\b\s*[:=]\s*\S+/gi,
    "$1=[redacted]",
  );

  if (result.length <= maxChars) {
    return result;
  }

  if (maxChars <= 3) {
    return ".".repeat(maxChars);
  }

  return `${result.slice(0, maxChars - 3).trimEnd()}...`;
}

function normalizeStrings(values: readonly string[]): string[] {
  const normalizedValues: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const normalized = value.trim().replace(/\s+/g, " ");
    const key = normalized.toLowerCase();

    if (normalized.length > 0 && !seen.has(key)) {
      seen.add(key);
      normalizedValues.push(normalized);
    }
  }

  return normalizedValues;
}

function normalizeStringArray(
  values: readonly string[],
  maxChars: number,
): string[] {
  return normalizeStrings(
    values.map((value) => sanitizePreviewText(value, maxChars)),
  );
}

function cloneJsonObject(value: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(value)) {
    if (item === undefined) {
      continue;
    }

    if (item === null) {
      result[key] = null;
      continue;
    }

    if (Array.isArray(item)) {
      result[key] = item.map((entry) => cloneJsonValue(entry));
      continue;
    }

    if (typeof item === "object") {
      result[key] = cloneJsonObject(item as Record<string, unknown>);
      continue;
    }

    result[key] = item;
  }

  return result;
}

function cloneJsonValue(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => cloneJsonValue(item));
  }

  return cloneJsonObject(value as Record<string, unknown>);
}

function normalizeJsonObject(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(value)) {
    if (item !== undefined) {
      result[key] = item;
    }
  }

  return result;
}

function simpleHash(value: string): string {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash.toString(36);
}

interface MutableToolJob extends ToolJob {
  controller: AbortController;
  resolveResult: (job: ToolJob) => void;
  rejectResult: (error: unknown) => void;
  resultPromise: Promise<ToolJob>;
  finalized: boolean;
}
