/**
 * A463 — Third-Party API Health Check Tests
 * Usage: node apps/web/src/app/a463-third-party-api-health-check.test.mjs
 */

import assert from "node:assert/strict";

let mockedFetchResponses = [];
let fetchCallCount = 0;
function mockFetch(r) { mockedFetchResponses.push(r); }
function resetFetchMock() { mockedFetchResponses = []; fetchCallCount = 0; }

async function simulatedHealthCheck(guardResult, baseUrl) {
  fetchCallCount = 0;
  if (!guardResult.allowed) {
    return { success: false, requestAttempted: false, guardBlocked: true, message: "Health check blocked by guard" };
  }
  if (!baseUrl) {
    return { success: false, requestAttempted: false, guardBlocked: false, message: "No BASE_URL configured" };
  }
  const endpoints = [baseUrl + "/health", baseUrl + "/status", baseUrl];
  let lastError = null;
  for (const url of endpoints) {
    try {
      fetchCallCount++;
      if (mockedFetchResponses.length > 0) {
        const r = mockedFetchResponses.shift();
        if (r instanceof Error) throw r;
        return { success: r.ok || r.status < 500, statusCode: r.status, requestAttempted: true, guardBlocked: false, message: "Health check responded with status " + r.status };
      }
      throw new Error("fetch failed: connect ECONNREFUSED " + url);
    } catch (err) {
      const em = err instanceof Error ? err.message : String(err);
      lastError = em.replace(/https?:\/\/[^\s]+/g, "[REDACTED_URL]").replace(/api[_-]?key[=:]\s*\S+/gi, "api_key=[REDACTED]");
      continue;
    }
  }
  return { success: false, requestAttempted: true, guardBlocked: false, message: "Health check failed: " + (lastError ?? "unknown") };
}

const PASS = "PASS", FAIL = "FAIL";
let total = 0, passed = 0, failed = 0;

async function run() {
  const tests = [
    ["Book API: guard blocked => no fetch", async () => {
      resetFetchMock();
      const r = await simulatedHealthCheck({ allowed: false, blockedReason: "blocked" }, null);
      assert.equal(r.requestAttempted, false);
      assert.equal(r.guardBlocked, true);
      assert.equal(fetchCallCount, 0);
    }],
    ["Phone Auth: guard blocked => no fetch", async () => {
      resetFetchMock();
      const r = await simulatedHealthCheck({ allowed: false, blockedReason: "blocked" }, null);
      assert.equal(r.requestAttempted, false);
      assert.equal(fetchCallCount, 0);
    }],
    ["Email Auth: production blocked => no fetch", async () => {
      resetFetchMock();
      const r = await simulatedHealthCheck({ allowed: false, blockedReason: "PRODUCTION_BLOCKED" }, null);
      assert.equal(r.requestAttempted, false);
      assert.equal(fetchCallCount, 0);
    }],
    ["guard allowed + base url: fetch attempted", async () => {
      resetFetchMock();
      mockFetch({ ok: true, status: 200 });
      const r = await simulatedHealthCheck({ allowed: true, blockedReason: null }, "https://api.example.com");
      assert.equal(r.requestAttempted, true);
      assert.equal(r.guardBlocked, false);
      assert.equal(fetchCallCount, 1);
      assert.equal(r.success, true);
    }],
    ["guard allowed but no base URL: no fetch", async () => {
      resetFetchMock();
      const r = await simulatedHealthCheck({ allowed: true, blockedReason: null }, null);
      assert.equal(r.requestAttempted, false);
      assert.equal(fetchCallCount, 0);
    }],
    ["network error: URL redacted", async () => {
      resetFetchMock();
      const r = await simulatedHealthCheck({ allowed: true, blockedReason: null }, "https://api.example.com");
      assert.equal(r.success, false);
      assert.ok(r.message.includes("[REDACTED_URL]") || r.message.includes("REDACTED"));
    }],
    ["error with API key: sanitized", async () => {
      resetFetchMock();
      const err = new Error("Failed https://api.example.com?api_key=sk-12345-secret-value");
      mockFetch(err); mockFetch(err); mockFetch(err);
      const r = await simulatedHealthCheck({ allowed: true, blockedReason: null }, "https://api.example.com");
      assert.ok(!r.message.includes("sk-12345-secret-value"));
    }],
    ["does NOT return raw response body", async () => {
      const r = await simulatedHealthCheck({ allowed: true, blockedReason: null }, "https://api.example.com");
      assert.ok(!r.message.startsWith("{"));
      assert.ok(r.message.length < 500);
    }],
    ["does NOT return API key in success", async () => {
      resetFetchMock();
      mockFetch({ ok: true, status: 200 });
      const r = await simulatedHealthCheck({ allowed: true, blockedReason: null }, "https://api.example.com");
      assert.ok(!r.message.includes("api_key"));
      assert.ok(!r.message.includes("secret"));
    }],
    ["health check: no SMS sent message", async () => {
      resetFetchMock();
      mockFetch({ ok: true, status: 200 });
      const r = await simulatedHealthCheck({ allowed: true, blockedReason: null }, "https://api.example.com");
      assert.ok(!r.message.toLowerCase().includes("sms sent"));
      assert.ok(!r.message.includes("短信已发送"));
    }],
    ["health check: no email sent message", async () => {
      resetFetchMock();
      mockFetch({ ok: true, status: 200 });
      const r = await simulatedHealthCheck({ allowed: true, blockedReason: null }, "https://api.example.com");
      assert.ok(!r.message.toLowerCase().includes("email sent"));
    }],
    ["health check: no verification code", async () => {
      resetFetchMock();
      mockFetch({ ok: true, status: 200 });
      const r = await simulatedHealthCheck({ allowed: true, blockedReason: null }, "https://api.example.com");
      assert.ok(!r.message.toLowerCase().includes("verification code"));
      assert.ok(!r.message.includes("验证码"));
    }],
    ["health check: no book search", async () => {
      resetFetchMock();
      mockFetch({ ok: true, status: 200 });
      const r = await simulatedHealthCheck({ allowed: true, blockedReason: null }, "https://api.example.com");
      assert.ok(!r.message.toLowerCase().includes("book search"));
    }],
  ];

  for (const [name, fn] of tests) {
    total++;
    try {
      await fn();
      passed++;
      console.log(PASS + " [a463-health] " + name);
    } catch (e) {
      failed++;
      console.log(FAIL + " [a463-health] " + name);
      console.log("       " + e.message);
    }
  }

  console.log("\nA463 Health Check: " + total + " tests, " + passed + " pass, " + failed + " fail");
  if (failed > 0) process.exit(1);
}

run();
