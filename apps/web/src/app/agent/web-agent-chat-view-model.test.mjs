import assert from "node:assert/strict";
import test from "node:test";

import { getWebAgentToolRegistry } from "@learning-agent-platform/ai-core/agent/web-agent-readonly-tool-registry";
import { createWebAgentRunScaffold } from "@learning-agent-platform/ai-core/agent/web-agent-runtime";
import {
  ToolJobStatus,
  ToolJobTraceEventKind,
} from "@learning-agent-platform/ai-core/agent/web-agent-tool-job-runtime";

import { buildWebAgentChatViewModel } from "./web-agent-chat-view-model.ts";

function createBaseResult() {
  const toolExecution = {
    toolId: null,
    status: "blocked",
    safeToExposeToClient: true,
    providerMode: "blocked",
    githubRepoAccessStatus: "blocked",
    toolResultPreview: null,
    blockedReason: "tool_preview_disabled_by_default",
    errorReason: null,
    warnings: [],
    inputSummary: "no-input",
    readOnly: true,
    enabledByDefault: false,
    productionReady: false,
  };
  const mcpGuard = {
    enabled: false,
    nonProduction: true,
    devEnabled: false,
    allowAgentMcp: false,
    githubReadonlyEnabled: false,
    allowed: false,
    missingEnvKeys: [
      "LAP_WEB_AGENT_MCP_DEV_ENABLED",
      "LAP_ALLOW_AGENT_MCP",
      "LAP_AGENT_GITHUB_READONLY_ENABLED",
      "LAP_AGENT_GITHUB_ALLOWED_REPOS",
      "GITHUB_TOKEN",
    ],
    blockedReasons: [
      "LAP_WEB_AGENT_MCP_DEV_ENABLED is not enabled",
      "LAP_ALLOW_AGENT_MCP is not enabled",
      "LAP_AGENT_GITHUB_READONLY_ENABLED is not enabled",
      "LAP_AGENT_GITHUB_ALLOWED_REPOS is missing",
      "GITHUB_TOKEN is missing",
    ],
    notice: "GitHub MCP read-only preview is blocked.",
    sourceLabel: "mcp-guard-blocked (preview disabled)",
    devOnly: true,
    productionReady: false,
  };
  const scaffold = createWebAgentRunScaffold({
    message: "preview only",
    mode: "mock",
    executionPath: "rule-only",
    selectedToolId: null,
    selectedToolInput: {},
    selectedToolInputSummary: "no-input",
    toolExecution,
    toolRegistry: getWebAgentToolRegistry(),
    toolSelectionSource: "blocked",
    toolGuardEnabled: false,
    toolGuardNotice: "Tool preview is disabled by default.",
    toolGuardSourceLabel: "tool-guard-blocked (preview disabled)",
    providerMode: null,
    llmUsed: false,
    realProviderCalled: false,
    fallbackUsed: false,
    fallbackReason: null,
    toolIntentValidated: null,
    toolIntentValidationReason: null,
    toolIntentReason: null,
    toolIntentFinalAnswerHint: null,
    warnings: ["preview disabled"],
    blockedReasons: ["tool_preview_disabled_by_default"],
    finalAnswerSource: "template",
    finalAnswer: "[blocked]",
  });
  const createdAt = new Date().toISOString();
  const toolJob = createToolJob({
    status: ToolJobStatus.Blocked,
    toolExecutionStatus: "blocked",
    resultPreview: "Tool job was blocked before execution started.",
    blockedReason: "tool_preview_disabled_by_default",
    errorReason: null,
    timeoutReason: null,
    cancelledReason: null,
    warnings: ["The background tool job was blocked safely before execution started."],
    traceMessage: "Tool job was blocked before execution started.",
  });
  const loopSteps = [
    {
      stepId: "loop-step-1",
      stepIndex: 1,
      kind: "tool_selection",
      status: "completed",
      title: "Plan and select tool intent",
      summary: "Build a safe bounded-loop plan and choose at most one read-only tool.",
      inputSummary: "message, safe tool registry, and guarded dev-only context",
      outputSummary: "Rules did not match a supported read-only tool.",
      traceEventIds: ["trace-1"],
      toolCallIds: [],
      safetyNotes: ["No raw prompt or raw response is stored."],
      createdAt,
      updatedAt: createdAt,
      devOnly: true,
      productionReady: false,
      safeToExposeToClient: true,
    },
    {
      stepId: "loop-step-2",
      stepIndex: 2,
      kind: "final_answer",
      status: "blocked",
      title: "Execute one tool and answer",
      summary: "Run one read-only tool at most once and compose the final safe answer.",
      inputSummary: "no supported tool selected",
      outputSummary: "[blocked]",
      traceEventIds: ["trace-2"],
      toolCallIds: [],
      safetyNotes: ["The final answer stays preview-only."],
      createdAt,
      updatedAt: createdAt,
      devOnly: true,
      productionReady: false,
      safeToExposeToClient: true,
    },
  ];

  return {
    ...scaffold,
    networkGuard: {
      enabled: false,
      nonProduction: true,
      networkDevEnabled: false,
      allowAgentNetwork: false,
      allowed: false,
      blockedReasons: [
        "LAP_WEB_AGENT_NETWORK_DEV_ENABLED is not enabled",
        "LAP_ALLOW_AGENT_NETWORK is not enabled",
      ],
      notice: "Network fetch is disabled until the dev-only guard is enabled.",
      sourceLabel: "network-guard-blocked (preview disabled)",
      devOnly: true,
      productionReady: false,
    },
    ok: true,
    mode: "mock",
    modeLabel: "mock",
    modeDescription: "mock description",
    executionPath: "rule-only",
    selectedToolId: null,
    toolSelectionSource: "blocked",
    toolUsed: null,
    toolGuardEnabled: false,
    toolGuardNotice: "Tool preview is disabled by default.",
    toolGuardSourceLabel: "tool-guard-blocked (preview disabled)",
    providerMode: null,
    llmUsed: false,
    toolIntentValidated: null,
    toolIntentValidationReason: null,
    toolIntentReason: null,
    toolIntentFinalAnswerHint: null,
    loopModeLabel: "bounded-loop-v1",
    loopModeDescription:
      "Plan -> Tool -> Critic -> Answer preview with a maximum of 2 steps and 1 read-only tool call.",
    loopMaxSteps: 2,
    loopMaxToolCalls: 1,
    loopMaxDurationMs: 4000,
    loopStepCount: 2,
    loopToolCallCount: 0,
    loopPlanSummary: "Rules did not match a supported read-only tool.",
    loopBlockReason: "tool_preview_disabled_by_default",
    finalAnswer: "[blocked]",
    finalAnswerSource: "template",
    fallbackReason: null,
    toolRegistry: getWebAgentToolRegistry(),
    toolExecution,
    toolExecutionStatus: "blocked",
    toolResultPreview: null,
    assistantMessage: "[blocked]",
    toolJob,
    steps: loopSteps,
    toolCallRecords: [],
    skillCandidate: {
      name: "Web Agent conversation skill draft",
      description: "Preview-only draft.",
      triggerHints: ["books"],
      requiredTools: [],
      safetyNotes: ["preview-only"],
      productionReady: false,
    },
    blockedReasons: ["tool_preview_disabled_by_default"],
    warnings: ["preview disabled"],
    realProviderCalled: false,
    fallbackUsed: false,
    devOnly: true,
    productionReady: false,
    safeToExposeToClient: true,
    rawPromptStored: false,
    rawResponseStored: false,
    secretSafe: true,
    mcpGuard,
    selectedMcpToolId: null,
    createdAt: new Date().toISOString(),
    answerPreview: "[blocked]",
    guardNotice: "blocked",
    guardSourceLabel: "blocked",
    toolBlockedReasons: ["tool_preview_disabled_by_default"],
    toolWarnings: [],
    githubProviderMode: "blocked",
    githubAllowedRepoStatus: "blocked",
    githubResultPreview: "Tool job was blocked before execution started.",
  };
}

function createToolJob(overrides = {}) {
  const createdAt = new Date("2026-01-01T00:00:00Z").toISOString();
  const traceEvent = {
    traceEventId: "tool_job_demo_trace_0",
    kind: ToolJobTraceEventKind.Queued,
    severity: "info",
    message: "Tool job was queued.",
    jobStatus: ToolJobStatus.Queued,
    selectedToolId: "listBooks",
    details: ["messagePreview=preview only"],
    createdAt,
    devOnly: true,
    productionReady: false,
    safeToExposeToClient: true,
    secretSafe: true,
    rawPromptStored: false,
    rawResponseStored: false,
  };

  return {
    jobId: "tool_job_demo",
    status: ToolJobStatus.Blocked,
    selectedToolId: "listBooks",
    selectedToolName: "List books",
    request: {
      messagePreview: "preview only",
      selectedToolId: "listBooks",
      selectedToolInput: { limit: 5 },
      selectedBy: "rules",
      selectionSource: "rules",
      toolPreviewEnabled: false,
      requestedAt: createdAt,
    },
    policy: {
      enabled: false,
      allowReadOnlyTools: true,
      allowSafeToExposeToClient: true,
      timeoutMs: 2500,
      maxInputBytes: 2048,
      maxPreviewBytes: 1024,
      productionReady: false,
    },
    traceEvents: [traceEvent],
    result: {
      jobId: "tool_job_demo",
      toolId: "listBooks",
      toolName: "List books",
      status: ToolJobStatus.Blocked,
      toolExecutionStatus: "blocked",
      toolExecution: {
        toolId: "listBooks",
        status: "blocked",
        safeToExposeToClient: true,
        providerMode: "blocked",
        githubRepoAccessStatus: "blocked",
        toolResultPreview: "Tool job was blocked before execution started.",
        blockedReason: "tool_preview_disabled_by_default",
        errorReason: null,
        warnings: ["The background tool job was blocked safely before execution started."],
        inputSummary: "messagePreview=preview only",
        readOnly: true,
        enabledByDefault: false,
        productionReady: false,
      },
      resultPreview: "Tool job was blocked before execution started.",
      previewTruncated: false,
      blockedReason: "tool_preview_disabled_by_default",
      errorReason: null,
      timeoutReason: null,
      cancelledReason: null,
      warnings: ["The background tool job was blocked safely before execution started."],
      inputSummary: "messagePreview=preview only",
      startedAt: null,
      finishedAt: createdAt,
      elapsedMs: 0,
      devOnly: true,
      productionReady: false,
      safeToExposeToClient: true,
      secretSafe: true,
      rawPromptStored: false,
      rawResponseStored: false,
    },
    createdAt,
    updatedAt: createdAt,
    startedAt: null,
    finishedAt: createdAt,
    blockedReason: "tool_preview_disabled_by_default",
    errorReason: null,
    timeoutReason: null,
    cancelledReason: null,
    devOnly: true,
    productionReady: false,
    safeToExposeToClient: true,
    secretSafe: true,
    rawPromptStored: false,
    rawResponseStored: false,
    ...overrides,
  };
}

test("mock mode view model is safe and exposes the tool registry", () => {
  const vm = buildWebAgentChatViewModel({
    lastResult: null,
    isSending: false,
    useExternalLlmDev: false,
    toolPreviewEnabled: false,
  });

  assert.equal(vm.modeLabel, "mock");
  assert.equal(vm.submitDisabled, false);
  assert.equal(vm.bannerLabel, "dev-only / preview");
  assert.equal(vm.modeTone, "mock");
  assert.equal(vm.executionPath, "rule-only");
  assert.equal(vm.toolRegistry.length, 6);
  assert.deepEqual(vm.toolRegistry, getWebAgentToolRegistry());
  assert.equal(vm.networkGuard, null);
  assert.equal(vm.assistantMessage, null);
  assert.equal(vm.selectedToolId, null);
  assert.equal(vm.selectedMcpToolId, null);
  assert.equal(vm.githubPermissionStatus, "blocked");
  assert.equal(vm.githubProviderMode, null);
  assert.equal(vm.githubAllowedRepoStatus, null);
  assert.equal(vm.mcpGuardEnabled, false);
});

test("blocked result maps to blocked UI state with tool preview data", () => {
  const vm = buildWebAgentChatViewModel({
    lastResult: {
      ...createBaseResult(),
      mode: "blocked",
      modeLabel: "blocked",
      modeDescription: "blocked by guard",
      executionPath: "blocked",
      assistantMessage: "[blocked] guard",
      answerPreview: "[blocked] guard",
      guardNotice: "guard blocked",
      guardSourceLabel: "blocked",
      finalAnswer: "[blocked] guard",
      finalAnswerSource: "blocked",
      fallbackReason: "guard blocked",
    },
    isSending: false,
    useExternalLlmDev: true,
    toolPreviewEnabled: true,
  });

  assert.equal(vm.modeLabel, "blocked");
  assert.equal(vm.modeTone, "blocked");
  assert.equal(vm.submitDisabled, false);
  assert.equal(vm.statusBadgeLabel.includes("blocked"), true);
  assert.equal(vm.toolExecution?.status, "blocked");
  assert.equal(vm.toolJob?.status, "blocked");
  assert.equal(vm.toolJob?.result?.resultPreview, "Tool job was blocked before execution started.");
  assert.equal(vm.skillCandidate?.productionReady, false);
  assert.equal(vm.githubProviderMode, "blocked");
  assert.equal(vm.githubAllowedRepoStatus, "blocked");
  assert.equal(vm.runTraceEvents.length > 0, true);
  assert.equal(vm.memoryPreview?.productionReady, false);
  assert.equal(vm.skillSeed?.productionReady, false);
  assert.equal(vm.loopModeLabel, "bounded-loop-v1");
  assert.equal(vm.loopStepCount, 2);
  assert.equal(vm.loopToolCallCount, 0);
  assert.equal(vm.loopBlockReason, "tool_preview_disabled_by_default");
  assert.equal(vm.runSteps.length, 2);
  assert.equal(vm.toolCallRecords.length, 0);
  assert.equal(vm.assistantMessage?.includes("guard"), true);
  assert.equal(vm.finalAnswer, "[blocked] guard");
  assert.equal(vm.selectedToolId, null);
});

test("external result maps to external-llm-dev UI state", () => {
  const vm = buildWebAgentChatViewModel({
    lastResult: {
      ...createBaseResult(),
      mode: "external-llm-dev",
      modeLabel: "external-llm-dev",
      modeDescription: "external path",
      executionPath: "external-llm-dev",
      selectedToolId: "listBooks",
      toolSelectionSource: "llm",
      toolUsed: "listBooks",
      toolGuardEnabled: true,
      toolGuardNotice: "enabled",
      toolGuardSourceLabel: "tool-guard-enabled (dev-only preview)",
      providerMode: "external-dev-only",
      llmUsed: true,
      toolIntentValidated: true,
      toolIntentValidationReason: "Tool intent JSON parsed successfully.",
      toolIntentReason: "books",
      toolIntentFinalAnswerHint: "mention the safe preview",
      criticReview: {
        reviewId: "critic_review_1",
        reviewedAt: "2026-01-01T00:00:00Z",
        reviewerRole: "critic",
        reviewerLabel: "critic/reviewer",
        reviewerModelProfileId: "fast-cheap",
        reviewerModelProfileLabel: "Fast / cheap",
        reviewMode: "rule-based",
        decision: "approveWithWarnings",
        decisionReason: "decision=approveWithWarnings | findings=1",
        findings: [
          {
            findingId: "critic_finding_1",
            dimension: "missingEvidence",
            severity: "medium",
            title: "Missing evidence",
            summary: "The answer lacks evidence.",
            evidence: ["Tool result preview was limited."],
            recommendation: "Add evidence.",
            devOnly: true,
            previewOnly: true,
            secretSafe: true,
          },
        ],
        revisionHints: ["Add evidence."],
        reviewedToolId: "listBooks",
        reviewedToolName: "List books",
        reviewedToolInputSummary: "limit=2",
        reviewedToolSelectionSource: "llm",
        reviewedToolExecutionStatus: "success",
        reviewedFinalAnswerPreview: "answer",
        recommendedFinalAnswer: "answer",
        reviewSummary: "decision=approveWithWarnings | findings=1",
        realProviderCalled: false,
        providerMode: null,
        guardNotice: "allowed",
        guardSourceLabel: "external-llm-dev",
        devOnly: true,
        previewOnly: true,
        safeToExposeToClient: true,
        rawPromptStored: false,
        rawResponseStored: false,
        secretSafe: true,
      },
      loopModeLabel: "bounded-loop-v1",
      loopModeDescription:
        "Plan -> Tool -> Critic -> Answer preview with a maximum of 2 steps and 1 read-only tool call.",
      loopMaxSteps: 2,
      loopMaxToolCalls: 1,
      loopMaxDurationMs: 4000,
      loopStepCount: 2,
      loopToolCallCount: 1,
      loopPlanSummary: "Rules selected listBooks.",
      loopBlockReason: null,
      finalAnswer: "answer",
      finalAnswerSource: "llm",
      fallbackReason: null,
      toolExecution: {
        toolId: "listBooks",
        status: "success",
        safeToExposeToClient: true,
        providerMode: "live",
        githubRepoAccessStatus: "allowed",
        toolResultPreview: "Read-only book preview",
        blockedReason: null,
        errorReason: null,
        warnings: [],
        inputSummary: "no-input",
        readOnly: true,
        enabledByDefault: false,
        productionReady: false,
      },
      toolExecutionStatus: "success",
      toolResultPreview: "Read-only book preview",
      toolJob: createToolJob({
        status: ToolJobStatus.Succeeded,
        selectedToolId: "listBooks",
        selectedToolName: "List books",
        result: {
          jobId: "tool_job_demo",
          toolId: "listBooks",
          toolName: "List books",
          status: ToolJobStatus.Succeeded,
          toolExecutionStatus: "success",
          toolExecution: {
            toolId: "listBooks",
            status: "success",
            safeToExposeToClient: true,
            providerMode: "live",
            githubRepoAccessStatus: "allowed",
            toolResultPreview: "Read-only book preview",
            blockedReason: null,
            errorReason: null,
            warnings: [],
            inputSummary: "no-input",
            readOnly: true,
            enabledByDefault: false,
            productionReady: false,
          },
          resultPreview: "Read-only book preview",
          previewTruncated: false,
          blockedReason: null,
          errorReason: null,
          timeoutReason: null,
          cancelledReason: null,
          warnings: [],
          inputSummary: "no-input",
          startedAt: "2026-01-01T00:00:00Z",
          finishedAt: "2026-01-01T00:00:01Z",
          elapsedMs: 1000,
          devOnly: true,
          productionReady: false,
          safeToExposeToClient: true,
          secretSafe: true,
          rawPromptStored: false,
          rawResponseStored: false,
        },
        status: ToolJobStatus.Succeeded,
        blockedReason: null,
        errorReason: null,
        timeoutReason: null,
        cancelledReason: null,
      }),
      assistantMessage: "answer",
      answerPreview: "answer",
      guardNotice: "allowed",
      guardSourceLabel: "external-llm-dev",
      skillCandidate: {
        name: "Web Agent listBooks skill draft",
        description: "Preview-only.",
        triggerHints: ["books"],
        requiredTools: ["listBooks"],
        safetyNotes: ["preview-only"],
        productionReady: false,
      },
      realProviderCalled: true,
      fallbackUsed: false,
      toolBlockedReasons: [],
      toolWarnings: [],
      warnings: [],
      githubProviderMode: "live",
      githubAllowedRepoStatus: "allowed",
      githubResultPreview: "Read-only book preview",
    },
    isSending: true,
    useExternalLlmDev: true,
    toolPreviewEnabled: true,
  });

  assert.equal(vm.modeTone, "external-llm-dev");
  assert.equal(vm.modeLabel, "external-llm-dev");
  assert.equal(vm.submitDisabled, true);
  assert.equal(vm.sendLabel, "Sending...");
  assert.equal(vm.toolExecution?.toolResultPreview, "Read-only book preview");
  assert.equal(vm.toolJob?.status, "succeeded");
  assert.equal(vm.toolJob?.result?.resultPreview, "Read-only book preview");
  assert.equal(vm.skillCandidate?.requiredTools[0], "listBooks");
  assert.equal(vm.loopModeLabel, "bounded-loop-v1");
  assert.equal(vm.loopStepCount, 2);
  assert.equal(vm.loopToolCallCount, 1);
  assert.equal(vm.runSteps.length, 2);
  assert.equal(vm.runTraceEvents.length > 0, true);
  assert.equal(vm.memoryPreview?.shortTermMessages.length > 0, true);
  assert.equal(vm.skillSeed?.productionReady, false);
  assert.equal(vm.selectedToolId, "listBooks");
  assert.equal(vm.toolSelectionSource, "llm");
  assert.equal(vm.toolGuardEnabled, true);
  assert.equal(vm.providerMode, "external-dev-only");
  assert.equal(vm.llmUsed, true);
  assert.equal(vm.githubProviderMode, "live");
  assert.equal(vm.githubAllowedRepoStatus, "allowed");
  assert.equal(vm.githubResultPreview, "Read-only book preview");
  assert.equal(vm.toolIntentValidated, true);
  assert.equal(vm.criticReview?.decision, "approveWithWarnings");
  assert.equal(vm.criticReview?.findings[0].severity, "medium");
  assert.equal(vm.criticReview?.revisionHints[0], "Add evidence.");
  assert.equal(vm.criticReview?.reviewedToolId, "listBooks");
  assert.equal(vm.finalAnswer, "answer");
  assert.equal(vm.selectedMcpToolId, null);
  assert.equal(vm.githubPermissionStatus, "blocked");
});
