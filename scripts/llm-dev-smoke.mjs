/**
 * llm-dev-smoke.mjs — CLI entry point for LLM dev smoke test.
 *
 * Usage:
 *   node scripts/llm-dev-smoke.mjs          # dry-run (default)
 *   node scripts/llm-dev-smoke.mjs --live   # live test (requires all guards)
 *
 * NEVER prints: API keys, passwords, prompts, raw responses, headers,
 * or database URLs. Output is safe metadata only.
 *
 * @previewOnly
 */

import { runLlmDevSmokeTest, formatSmokeTestResult } from "../packages/ai-core/src/llm/llm-dev-smoke-runner.ts";

// ---------------------------------------------------------------------------
// Parse CLI args
// ---------------------------------------------------------------------------

var args = process.argv.slice(2);
var live = args.includes("--live");
var dryRun = !live;
var allowNetwork = live;

if (live) {
  console.log("=== LLM Dev Smoke Test (LIVE MODE) ===");
  console.log("WARNING: This will make a real network call to the configured");
  console.log("external LLM provider. A minimal safe health-check prompt will");
  console.log("be sent. No prompt, response, keys, or passwords will be printed.");
  console.log("");
}

// ---------------------------------------------------------------------------
// Build env from process.env (never print real values)
// ---------------------------------------------------------------------------

var env = {
  LAP_LLM_DEV_SMOKE_TEST_ENABLED: process.env.LAP_LLM_DEV_SMOKE_TEST_ENABLED,
  LAP_READER_QA_EXTERNAL_LLM_DEV_ENABLED: process.env.LAP_READER_QA_EXTERNAL_LLM_DEV_ENABLED,
  LAP_ALLOW_EXTERNAL_LLM_PROVIDER: process.env.LAP_ALLOW_EXTERNAL_LLM_PROVIDER,
  LAP_LLM_PROVIDER: process.env.LAP_LLM_PROVIDER,
  LAP_LLM_DEV_ENDPOINT: process.env.LAP_LLM_DEV_ENDPOINT,
  LAP_LLM_DEV_API_KEY: process.env.LAP_LLM_DEV_API_KEY,
  LAP_LLM_DEV_APIPassword: process.env.LAP_LLM_DEV_APIPassword,
  LAP_LLM_DEV_MODEL: process.env.LAP_LLM_DEV_MODEL,
  LAP_LLM_DEV_TIMEOUT_MS: process.env.LAP_LLM_DEV_TIMEOUT_MS,
  LAP_LLM_DEV_PROVIDER_ENABLED: process.env.LAP_LLM_DEV_PROVIDER_ENABLED,
};

// ---------------------------------------------------------------------------
// Run smoke test
// ---------------------------------------------------------------------------

try {
  var result = await runLlmDevSmokeTest(env, {
    dryRun: dryRun,
    allowNetwork: allowNetwork,
  });

  var output = formatSmokeTestResult(result);
  console.log(output);

  if (!result.ok && result.mode !== "dry-run") {
    process.exitCode = 1;
  }
} catch (err) {
  console.error("FATAL: Smoke test runner threw an unhandled exception.");
  console.error("This should not happen — the runner is designed to catch all errors.");
  console.error("Error type: " + (err?.constructor?.name ?? "unknown"));
  // Do NOT print the error message — it may contain sensitive data
  console.error("Error details suppressed for safety.");
  process.exitCode = 2;
}
