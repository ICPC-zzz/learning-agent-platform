import assert from "node:assert/strict";
import test from "node:test";

import {
  LAP_WEB_AGENT_TOOLS_DEV_ENABLED_KEY,
  evaluateWebAgentToolsDevGuard,
} from "./web-agent-tools-dev-guard.ts";

test("tool guard is blocked by default", () => {
  const result = evaluateWebAgentToolsDevGuard({
    NODE_ENV: "development",
  });

  assert.equal(result.enabled, false);
  assert.equal(result.allowed, false);
  assert.equal(result.devOnly, true);
  assert.equal(result.productionReady, false);
  assert.equal(result.blockedReasons.some((reason) => reason.includes(LAP_WEB_AGENT_TOOLS_DEV_ENABLED_KEY)), true);
});

test("tool guard allows dev preview when explicitly enabled", () => {
  const result = evaluateWebAgentToolsDevGuard({
    NODE_ENV: "development",
    LAP_WEB_AGENT_TOOLS_DEV_ENABLED: "1",
  });

  assert.equal(result.enabled, true);
  assert.equal(result.allowed, true);
  assert.equal(result.blockedReasons.length, 0);
  assert.equal(result.sourceLabel, "tool-guard-enabled (dev-only preview)");
});

test("tool guard blocks production even when enabled", () => {
  const result = evaluateWebAgentToolsDevGuard({
    NODE_ENV: "production",
    LAP_WEB_AGENT_TOOLS_DEV_ENABLED: "1",
  });

  assert.equal(result.enabled, false);
  assert.equal(result.allowed, false);
  assert.equal(result.blockedReasons.some((reason) => reason.includes("non_production_required")), true);
  assert.equal(result.sourceLabel, "tool-guard-blocked (preview disabled)");
});
