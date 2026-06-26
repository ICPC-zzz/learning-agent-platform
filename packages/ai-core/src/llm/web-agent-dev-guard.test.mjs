import assert from "node:assert/strict";
import test from "node:test";

import { evaluateWebAgentDevGuard } from "./web-agent-dev-guard.ts";

test("default path stays mock when external LLM is not requested", () => {
  const result = evaluateWebAgentDevGuard({}, false);

  assert.equal(result.mode, "mock");
  assert.equal(result.allowed, true);
  assert.equal(result.blockedReasons.length, 0);
  assert.equal(result.devOnly, true);
  assert.equal(result.productionReady, false);
});

test("requested external path is blocked when env is incomplete", () => {
  const result = evaluateWebAgentDevGuard(
    {
      LAP_WEB_AGENT_EXTERNAL_LLM_DEV_ENABLED: "true",
      LAP_ALLOW_EXTERNAL_LLM_PROVIDER: "true",
      LAP_LLM_DEV_ENDPOINT: "https://api.example.com/v1",
      LAP_LLM_DEV_API_KEY: "key-123",
    },
    true,
  );

  assert.equal(result.mode, "blocked");
  assert.equal(result.allowed, false);
  assert.ok(result.blockedReasons.some((reason) => reason.includes("LAP_LLM_DEV_MODEL")));
});

test("requested external path becomes external-llm-dev when guards pass", () => {
  const result = evaluateWebAgentDevGuard(
    {
      LAP_WEB_AGENT_EXTERNAL_LLM_DEV_ENABLED: "1",
      LAP_ALLOW_EXTERNAL_LLM_PROVIDER: "1",
      LAP_LLM_DEV_ENDPOINT: "https://api.example.com/v1",
      LAP_LLM_DEV_API_KEY: "key-123",
      LAP_LLM_DEV_MODEL: "test-model",
      NODE_ENV: "development",
    },
    true,
  );

  assert.equal(result.mode, "external-llm-dev");
  assert.equal(result.allowed, true);
  assert.equal(result.blockedReasons.length, 0);
});

test("production blocks the external dev path", () => {
  const result = evaluateWebAgentDevGuard(
    {
      LAP_WEB_AGENT_EXTERNAL_LLM_DEV_ENABLED: "1",
      LAP_ALLOW_EXTERNAL_LLM_PROVIDER: "1",
      LAP_LLM_DEV_ENDPOINT: "https://api.example.com/v1",
      LAP_LLM_DEV_API_KEY: "key-123",
      LAP_LLM_DEV_MODEL: "test-model",
      NODE_ENV: "production",
    },
    true,
  );

  assert.equal(result.mode, "blocked");
  assert.equal(result.allowed, false);
  assert.ok(result.blockedReasons.includes("non_production_required"));
});

test("guard result does not leak secret values", () => {
  const endpoint = "https://api.example.com/v1";
  const apiKey = "key-123";
  const result = evaluateWebAgentDevGuard(
    {
      LAP_WEB_AGENT_EXTERNAL_LLM_DEV_ENABLED: "1",
      LAP_ALLOW_EXTERNAL_LLM_PROVIDER: "1",
      LAP_LLM_DEV_ENDPOINT: endpoint,
      LAP_LLM_DEV_API_KEY: apiKey,
      LAP_LLM_DEV_MODEL: "test-model",
    },
    true,
  );

  const payload = JSON.stringify(result);
  assert.equal(payload.includes(endpoint), false);
  assert.equal(payload.includes(apiKey), false);
});
