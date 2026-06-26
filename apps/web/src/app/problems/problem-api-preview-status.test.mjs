import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error TS5097: direct .ts import is used in existing node:test coverage.
import { getProblemApiPreviewStatus } from "./problem-api-status.ts";

test("problem API status is blocked when env is missing", () => {
  const status = getProblemApiPreviewStatus({
    NODE_ENV: "development",
  });

  assert.equal(status.providerMode, "blocked");
  assert.equal(status.safeToExposeToClient, true);
  assert.equal(status.productionReady, false);
  assert.ok(status.missingEnvNames.includes("LAP_ALLOW_EXTERNAL_PROBLEM_API"));
  assert.ok(status.missingEnvNames.includes("LAP_PROBLEM_API_BASE_URL"));
  assert.ok(status.missingEnvNames.includes("LAP_PROBLEM_API_PROVIDER"));
});

test("problem API status becomes external-dev when env is complete", () => {
  const status = getProblemApiPreviewStatus({
    NODE_ENV: "development",
    LAP_ALLOW_EXTERNAL_PROBLEM_API: "true",
    LAP_PROBLEM_API_BASE_URL: "https://api.example.com",
    LAP_PROBLEM_API_PROVIDER: "generic-provider",
  });

  assert.equal(status.providerMode, "external-dev");
  assert.equal(status.blockedReason, null);
  assert.equal(status.missingEnvNames.length, 0);
});
