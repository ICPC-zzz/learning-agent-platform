import assert from "node:assert/strict";
import test from "node:test";

import { buildWebAgentChatViewModel } from "./web-agent-chat-view-model.ts";

test("agent chat view model exposes the capability scaffold preview", () => {
  const vm = buildWebAgentChatViewModel({
    lastResult: null,
    isSending: false,
    useExternalLlmDev: false,
    toolPreviewEnabled: false,
  });

  assert.equal(vm.capabilityScaffold.capabilityRegistry.length, 8);
  assert.equal(vm.capabilityScaffold.permissionPolicy.length, 8);
  assert.equal(vm.capabilityScaffold.modelProfiles.length, 3);
  assert.equal(vm.capabilityScaffold.subagents.length, 5);
  assert.equal(vm.capabilityScaffold.hookRegistry.length, 2);
  assert.equal(vm.capabilityScaffold.mcpRegistry.length, 2);
  assert.equal(vm.capabilityScaffold.skillCompatRegistry.length, 4);
  assert.equal(vm.capabilityScaffold.mcpRegistry[0].permission, "readOnly");
  assert.deepEqual(vm.capabilityScaffold.mcpRegistry[0].toolIds, [
    "githubListIssues",
    "githubGetRepoSummary",
  ]);
  assert.equal(vm.capabilityScaffold.mcpRegistry[1].permission, "previewOnly");
  assert.equal(vm.capabilityScaffold.mcpRegistry[1].toolIds.length, 0);
  assert.equal(vm.capabilityScaffold.summary.forbiddenCount, 1);
  assert.equal(vm.capabilityScaffold.summary.disabledCount, 3);
  assert.equal(vm.capabilityScaffold.summary.previewOnlyCount, 1);
  assert.equal(vm.capabilityScaffold.summary.readOnlyCount, 1);
  assert.equal(vm.capabilityScaffold.summary.requiresApprovalCount, 1);
  assert.equal(vm.capabilityScaffold.summary.devOnlyLiveCount, 1);

  const serialized = JSON.stringify(vm);
  assert.equal(serialized.includes("DATABASE_URL"), false);
  assert.equal(serialized.includes("raw prompt"), false);
  assert.equal(serialized.includes("api_key"), false);
});
