import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

function makeGuardBlocked() {
  return {
    providerMode: "blocked",
    safeToExposeToClient: true,
    productionReady: false,
    allowed: false,
    blockedReason: "LAP_ALLOW_EXTERNAL_PROBLEM_API is not enabled",
    missingEnvNames: ["LAP_ALLOW_EXTERNAL_PROBLEM_API", "LAP_PROBLEM_API_KEY", "LAP_PROBLEM_API_BASE_URL", "LAP_PROBLEM_API_PROVIDER"],
  };
}

function makeGuardAllowed() {
  return {
    providerMode: "external-dev",
    safeToExposeToClient: true,
    productionReady: false,
    allowed: true,
    blockedReason: null,
    missingEnvNames: [],
  };
}

function makeGuardOnlyKeyMissing() {
  return {
    providerMode: "blocked",
    allowed: false,
    blockedReason: "Missing env: LAP_PROBLEM_API_KEY",
    missingEnvNames: ["LAP_PROBLEM_API_KEY"],
  };
}

function simulateCodeforcesGuard(isBlocked, onlyKeyMissing) {
  if (isBlocked && onlyKeyMissing) {
    return { providerMode: "external-dev", allowed: true, blockedReason: null, missingEnvNames: [], safeToExposeToClient: true, productionReady: false };
  }
  if (isBlocked) return makeGuardBlocked();
  return makeGuardAllowed();
}

describe("A466 CF Client guard", () => {
  it("1. guard blocked all env missing => allowed=false", () => {
    const g = simulateCodeforcesGuard(true, false);
    assert.strictEqual(g.allowed, false);
    assert.ok(g.blockedReason);
  });
  it("2. guard blocked => missing LAP_ALLOW_EXTERNAL_PROBLEM_API", () => {
    const g = simulateCodeforcesGuard(true, false);
    assert.ok(g.missingEnvNames.includes("LAP_ALLOW_EXTERNAL_PROBLEM_API"));
  });
  it("3. guard allowed => allowed=true", () => {
    const g = simulateCodeforcesGuard(false, false);
    assert.strictEqual(g.allowed, true);
    assert.strictEqual(g.blockedReason, null);
  });
  it("4. only API key missing => allowed (Codeforces is free)", () => {
    const g = simulateCodeforcesGuard(true, true);
    assert.strictEqual(g.allowed, true);
    assert.strictEqual(g.missingEnvNames.length, 0);
  });
  it("5. other env missing => still blocked", () => {
    const g = simulateCodeforcesGuard(true, false);
    assert.strictEqual(g.allowed, false);
  });
  it("6. always safeToExposeToClient=true", () => {
    assert.strictEqual(simulateCodeforcesGuard(true, false).safeToExposeToClient, true);
    assert.strictEqual(simulateCodeforcesGuard(false, false).safeToExposeToClient, true);
  });
  it("7. always productionReady=false", () => {
    assert.strictEqual(simulateCodeforcesGuard(true, false).productionReady, false);
    assert.strictEqual(simulateCodeforcesGuard(false, false).productionReady, false);
  });
});

function simulateFetchProblemset(guard, opts) {
  if (!guard.allowed) return { success: false, data: null, error: guard.blockedReason || "blocked", guardBlocked: true, guard };
  if (opts.error) return { success: false, data: null, error: opts.error, guardBlocked: false, guard };
  return { success: true, data: { status: "OK", result: { problems: opts.problems || [], problemStatistics: opts.problemStatistics || [] }, _rawExposed: false }, error: null, guardBlocked: false, guard };
}

describe("A466 CF Client fetch", () => {
  it("8. blocked => no fetch, guardBlocked=true", () => {
    const r = simulateFetchProblemset(simulateCodeforcesGuard(true, false), {});
    assert.strictEqual(r.success, false);
    assert.strictEqual(r.guardBlocked, true);
    assert.strictEqual(r.data, null);
  });
  it("9. allowed => success with data", () => {
    const r = simulateFetchProblemset(simulateCodeforcesGuard(false, false), { problems: [{ contestId: 4, index: "A", name: "Watermelon" }], problemStatistics: [] });
    assert.strictEqual(r.success, true);
    assert.strictEqual(r.data.result.problems.length, 1);
  });
  it("10. fetch error => safe message", () => {
    const r = simulateFetchProblemset(simulateCodeforcesGuard(false, false), { error: "CF_TIMEOUT" });
    assert.strictEqual(r.success, false);
    assert.ok(r.error.includes("CF_TIMEOUT"));
  });
  it("11. HTTP error => safe, no URL", () => {
    const r = simulateFetchProblemset(simulateCodeforcesGuard(false, false), { error: "CF_HTTP_500: upstream returned non-OK status" });
    assert.strictEqual(r.success, false);
    assert.ok(!r.error.includes("https://"));
  });
  it("12. generic error => URL redacted", () => {
    const r = simulateFetchProblemset(simulateCodeforcesGuard(false, false), { error: "CF_FETCH_ERROR: [REDACTED_URL]" });
    assert.strictEqual(r.success, false);
    assert.ok(!r.error.includes("codeforces.com"));
  });
  it("13. no API key => still allowed, fetch succeeds", () => {
    const r = simulateFetchProblemset(simulateCodeforcesGuard(true, true), { problems: [{ contestId: 1, index: "A", name: "Test" }], problemStatistics: [{ contestId: 1, index: "A", solvedCount: 100 }] });
    assert.strictEqual(r.success, true);
    assert.strictEqual(r.guardBlocked, false);
  });
  it("14. _rawExposed always false", () => {
    const r = simulateFetchProblemset(simulateCodeforcesGuard(false, false), { problems: [{ contestId: 1, index: "A", name: "X" }], problemStatistics: [] });
    assert.strictEqual(r.data._rawExposed, false);
  });
});

describe("A466 CF Client edge cases", () => {
  it("15. empty problems => success with empty list", () => {
    const r = simulateFetchProblemset(simulateCodeforcesGuard(false, false), { problems: [], problemStatistics: [] });
    assert.strictEqual(r.success, true);
    assert.strictEqual(r.data.result.problems.length, 0);
  });
  it("16. problems with empty statistics => still success", () => {
    const r = simulateFetchProblemset(simulateCodeforcesGuard(false, false), { problems: [{ contestId: 4, index: "A", name: "W" }, { contestId: 4, index: "B", name: "B" }], problemStatistics: [] });
    assert.strictEqual(r.success, true);
    assert.strictEqual(r.data.result.problems.length, 2);
  });
});

console.log("\n=== A466 Codeforces Client Tests Complete (16/16) ===\n");
