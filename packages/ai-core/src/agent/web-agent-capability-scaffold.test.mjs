import assert from "node:assert/strict";
import test from "node:test";

import {
  getWebAgentCapabilityPermissionPolicyCrossCheck,
  getWebAgentCapabilityById,
  getWebAgentCapabilityRegistry,
} from "./web-agent-capability-registry.ts";
import {
  evaluateWebAgentPermissionPolicy,
  getWebAgentPermissionPolicy as getWebAgentPermissionPolicyDirect,
} from "./web-agent-permission-policy.ts";
import { getWebAgentPermissionLegend as getWebAgentPermissionLegendDirect } from "./web-agent-permission-policy.ts";
import { getWebAgentModelProfileById as getWebAgentModelProfileByIdDirect } from "./web-agent-model-profile.ts";
import { getWebAgentModelProfiles as getWebAgentModelProfilesDirect } from "./web-agent-model-profile.ts";
import { getWebAgentSubagentRegistry as getWebAgentSubagentRegistryDirect } from "./web-agent-subagent-registry.ts";
import { getWebAgentHookRegistry as getWebAgentHookRegistryDirect } from "./web-agent-hook-registry.ts";
import { getWebAgentMcpRegistry as getWebAgentMcpRegistryDirect } from "./web-agent-mcp-registry.ts";
import { getWebAgentSkillCompatRegistry as getWebAgentSkillCompatRegistryDirect } from "./web-agent-skill-compat.ts";

test("web agent capability scaffold defaults stay safe and preview-only", () => {
  const capabilities = getWebAgentCapabilityRegistry();
  const policy = getWebAgentPermissionPolicyDirect();
  const crossCheck = getWebAgentCapabilityPermissionPolicyCrossCheck();

  assert.equal(capabilities.length, 8);
  assert.equal(policy.length, 8);
  assert.equal(crossCheck.every((row) => row.matches), true);

  const capabilityMap = new Map(
    capabilities.map((capability) => [capability.capabilityId, capability]),
  );

  assert.equal(capabilityMap.get("network")?.defaultPermission, "devOnlyLive");
  assert.equal(capabilityMap.get("file")?.defaultPermission, "disabled");
  assert.equal(capabilityMap.get("shell")?.defaultPermission, "disabled");
  assert.equal(capabilityMap.get("mcp")?.defaultPermission, "disabled");
  assert.equal(capabilityMap.get("browser")?.defaultPermission, "requiresUserApproval");
  assert.equal(capabilityMap.get("code")?.defaultPermission, "readOnly");
  assert.equal(capabilityMap.get("internalRead")?.defaultPermission, "previewOnly");
  assert.equal(capabilityMap.get("internalWrite")?.defaultPermission, "forbidden");

  assert.equal(
    policy.find((rule) => rule.capabilityId === "network")?.liveExecutionAllowed,
    true,
  );
  assert.equal(
    policy.filter((rule) => rule.liveExecutionAllowed === true).length,
    1,
  );
  assert.equal(getWebAgentPermissionLegendDirect().includes("devOnlyLive"), true);
  assert.equal(getWebAgentCapabilityById("internalRead")?.defaultPermission, "previewOnly");
  assert.equal(getWebAgentCapabilityById("unknown-capability" ), null);
  assert.equal(
    evaluateWebAgentPermissionPolicy("unknown-capability").permission,
    "disabled",
  );
});

test("web agent model, hook, mcp, subagent, and skill metadata stay preview-only", () => {
  const modelProfiles = getWebAgentModelProfilesDirect();
  const subagents = getWebAgentSubagentRegistryDirect();
  const hooks = getWebAgentHookRegistryDirect();
  const mcp = getWebAgentMcpRegistryDirect();
  const skills = getWebAgentSkillCompatRegistryDirect();

  assert.equal(modelProfiles.length, 3);
  assert.equal(getWebAgentModelProfileByIdDirect("current-dev")?.modelFamily, "openai-compatible");
  assert.equal(subagents.some((subagent) => subagent.role === "planner"), true);
  assert.equal(
    subagents.find((subagent) => subagent.role === "critic")?.modelProfileId,
    "fast-cheap",
  );
  assert.equal(hooks.length, 2);
  assert.equal(mcp.length, 2);
  assert.equal(skills.length, 4);
  assert.equal(mcp.every((entry) => entry.liveConnectionEnabled === false), true);
  assert.equal(skills.every((entry) => entry.claudeCodeCompatible === true), true);

  const serialized = JSON.stringify({
    modelProfiles,
    subagents,
    hooks,
    mcp,
    skills,
  });

  assert.equal(serialized.includes("DATABASE_URL"), false);
  assert.equal(serialized.includes("raw prompt"), false);
  assert.equal(serialized.includes("api_key"), false);
});
