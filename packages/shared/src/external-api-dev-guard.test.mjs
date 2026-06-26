import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error TS5097: direct .ts import is used in existing node:test coverage.
import {
  evaluateExternalApiDevGuard,
  createExternalApiPreviewEnvelope,
  createMockExternalApiPreviewEnvelope,
} from "./external-api-dev-guard.ts";

test("guard is blocked when env is missing", () => {
  const result = evaluateExternalApiDevGuard({
    providerLabel: "Book API",
    allowExternalEnvName: "LAP_ALLOW_EXTERNAL_BOOK_API",
    requiredEnvNames: ["LAP_BOOK_API_BASE_URL", "LAP_BOOK_API_PROVIDER"],
    env: {
      NODE_ENV: "development",
    },
  });

  assert.equal(result.allowed, false);
  assert.equal(result.providerMode, "blocked");
  assert.equal(result.safeToExposeToClient, true);
  assert.equal(result.productionReady, false);
  assert.ok(result.missingEnvNames.includes("LAP_ALLOW_EXTERNAL_BOOK_API"));
  assert.ok(result.missingEnvNames.includes("LAP_BOOK_API_BASE_URL"));
  assert.ok(result.missingEnvNames.includes("LAP_BOOK_API_PROVIDER"));
});

test("guard is blocked in production even when env is present", () => {
  const result = evaluateExternalApiDevGuard({
    providerLabel: "Problem API",
    allowExternalEnvName: "LAP_ALLOW_EXTERNAL_PROBLEM_API",
    requiredEnvNames: ["LAP_PROBLEM_API_BASE_URL", "LAP_PROBLEM_API_PROVIDER"],
    env: {
      NODE_ENV: "production",
      LAP_ALLOW_EXTERNAL_PROBLEM_API: "1",
      LAP_PROBLEM_API_BASE_URL: "https://api.example.com",
      LAP_PROBLEM_API_PROVIDER: "generic-provider",
    },
  });

  assert.equal(result.allowed, false);
  assert.equal(result.providerMode, "blocked");
  assert.equal(result.blockedReason?.includes("production"), true);
});

test("external preview envelope is safe to expose to client", () => {
  const envelope = createExternalApiPreviewEnvelope({
    providerMode: "external-dev",
    itemsPreview: [{ id: "1" }],
    blockedReason: null,
    missingEnvNames: [],
  });

  assert.equal(envelope.safeToExposeToClient, true);
  assert.equal(envelope.productionReady, false);
  assert.equal(envelope.providerMode, "external-dev");
  assert.equal(envelope.itemsPreview.length, 1);
});

test("mock preview envelope is safe to expose to client", () => {
  const envelope = createMockExternalApiPreviewEnvelope([{ id: "mock" }]);

  assert.equal(envelope.safeToExposeToClient, true);
  assert.equal(envelope.productionReady, false);
  assert.equal(envelope.providerMode, "mock");
  assert.equal(envelope.itemsPreview.length, 1);
});
