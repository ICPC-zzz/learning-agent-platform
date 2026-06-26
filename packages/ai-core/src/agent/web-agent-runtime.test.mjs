import assert from "node:assert/strict";
import test from "node:test";

import {
  getWebAgentToolRegistry,
} from "./web-agent-readonly-tool-registry.ts";
import {
  AgentTraceEventKind,
  createWebAgentRunScaffold,
} from "./web-agent-runtime.ts";
import {
  createWebAgentToolRegistryMetadata,
  validateWebAgentToolInput,
  WebAgentToolName,
} from "./web-agent-tool-framework.ts";

function createBlockedToolExecution() {
  return {
    toolId: null,
    status: "blocked",
    safeToExposeToClient: true,
    toolResultPreview: null,
    blockedReason: "client_request_failed",
    errorReason: null,
    warnings: [],
    inputSummary: "client_request_failed",
    readOnly: true,
    enabledByDefault: false,
    productionReady: false,
  };
}

test("tool registry metadata is cloned and stays read-only", () => {
  const registry = getWebAgentToolRegistry();
  const metadata = createWebAgentToolRegistryMetadata(registry);

  assert.equal(metadata.length, registry.length);
  assert.notEqual(metadata[0], registry[0]);
  assert.equal(metadata[0].readOnly, true);
  assert.equal(metadata[0].productionReady, false);

  metadata[0].displayName = "mutated";
  assert.notEqual(metadata[0].displayName, registry[0].displayName);
});

test("tool input validation blocks bad input and marks valid input safely", () => {
  const registry = getWebAgentToolRegistry();
  const getBookDetail = registry.find(
    (tool) => tool.toolId === WebAgentToolName.GetBookDetail,
  );

  assert.ok(getBookDetail);

  const valid = validateWebAgentToolInput(getBookDetail, {});
  const invalid = validateWebAgentToolInput(getBookDetail, { bookId: 123 });

  assert.equal(valid.valid, true);
  assert.equal(valid.blockedReason, null);
  assert.equal(valid.productionReady, false);
  assert.equal(invalid.valid, false);
  assert.equal(invalid.blockedReason, "invalid_field_type:bookId");
  assert.equal(invalid.productionReady, false);
});

test("run scaffold emits safe trace, memory, and skill previews", () => {
  const registry = getWebAgentToolRegistry();
  const result = createWebAgentRunScaffold({
    message: "api_key=sk-test raw prompt",
    mode: "blocked",
    executionPath: "blocked",
    selectedToolId: null,
    selectedToolInput: {},
    selectedToolInputSummary: "client_request_failed",
    toolExecution: createBlockedToolExecution(),
    toolRegistry: registry,
    toolSelectionSource: "blocked",
    toolGuardEnabled: false,
    toolGuardNotice: "Tool preview is disabled.",
    toolGuardSourceLabel: "blocked (client error)",
    providerMode: null,
    llmUsed: false,
    realProviderCalled: false,
    fallbackUsed: false,
    fallbackReason: null,
    toolIntentValidated: null,
    toolIntentValidationReason: null,
    toolIntentReason: null,
    toolIntentFinalAnswerHint: null,
    warnings: ["client failure"],
    blockedReasons: ["client_request_failed"],
    finalAnswerSource: "blocked",
    finalAnswer: "Here is your bearer token and DATABASE_URL=postgres://secret",
  });

  const payload = JSON.stringify(result);

  assert.equal(result.safeToExposeToClient, true);
  assert.equal(result.rawPromptStored, false);
  assert.equal(result.rawResponseStored, false);
  assert.equal(result.memoryPreview.productionReady, false);
  assert.equal(result.skillSeed.productionReady, false);
  assert.equal(result.toolCallRecords[0].safeToExposeToClient, true);
  assert.equal(result.steps.length, 5);
  assert.equal(
    result.traceEvents.some((event) => event.kind === AgentTraceEventKind.RunBlocked),
    true,
  );
  assert.equal(payload.includes("api_key=sk-test"), false);
  assert.equal(payload.includes("DATABASE_URL=postgres://secret"), false);
  assert.equal(payload.includes("bearer token"), false);
});
