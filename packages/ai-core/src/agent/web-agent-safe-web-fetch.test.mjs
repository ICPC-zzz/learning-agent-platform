import assert from "node:assert/strict";
import test from "node:test";

import {
  executeWebAgentToolPreview,
  WebAgentToolName,
} from "./web-agent-tool-framework.ts";

function createNetworkGuard(allowed) {
  return allowed
    ? {
        enabled: true,
        nonProduction: true,
        networkDevEnabled: true,
        allowAgentNetwork: true,
        allowed: true,
        blockedReasons: [],
        notice: "enabled",
        sourceLabel: "network-guard-enabled (dev-only preview)",
        devOnly: true,
        productionReady: false,
      }
    : {
        enabled: false,
        nonProduction: true,
        networkDevEnabled: false,
        allowAgentNetwork: false,
        allowed: false,
        blockedReasons: [
          "LAP_WEB_AGENT_NETWORK_DEV_ENABLED is not enabled",
          "LAP_ALLOW_AGENT_NETWORK is not enabled",
        ],
        notice: "disabled",
        sourceLabel: "network-guard-blocked (preview disabled)",
        devOnly: true,
        productionReady: false,
      };
}

function createFetchResponse({
  status = 200,
  url = "https://example.com/",
  contentType = "text/html; charset=utf-8",
  body = "",
  location = null,
} = {}) {
  return {
    status,
    url,
    headers: new Headers({
      ...(contentType === null ? {} : { "content-type": contentType }),
      ...(location === null ? {} : { location }),
    }),
    async text() {
      return body;
    },
  };
}

function createSafeFetchInput(overrides = {}) {
  return {
    message: "fetch page",
    toolId: WebAgentToolName.SafeWebFetch,
    toolPreviewEnabled: true,
    toolInput: {
      url: "https://example.com/",
      maxBytes: 4096,
      timeoutMs: 2500,
      ...overrides.toolInput,
    },
    dataLoaders: {
      async listBooks() {
        return [];
      },
      async getBookDetail() {
        return null;
      },
      async getReadingProgressSummary() {
        return null;
      },
    },
    fetchImpl: overrides.fetchImpl,
    networkGuard: overrides.networkGuard ?? createNetworkGuard(true),
  };
}

test("safeWebFetch is blocked when the network guard is disabled", async () => {
  let fetchCalls = 0;
  const result = await executeWebAgentToolPreview(
    createSafeFetchInput({
      networkGuard: createNetworkGuard(false),
      fetchImpl: async () => {
        fetchCalls += 1;
        throw new Error("fetch must not run");
      },
    }),
  );

  assert.equal(fetchCalls, 0);
  assert.equal(result.status, "blocked");
  assert.equal(result.blockedReason, "network_guard_disabled");
  assert.equal(result.finalUrl, null);
});

test("safeWebFetch returns a sanitized preview for a public HTTPS page", async () => {
  const result = await executeWebAgentToolPreview(
    createSafeFetchInput({
      fetchImpl: async () =>
        createFetchResponse({
          url: "https://example.com/?token=abc",
          contentType: "text/html; charset=utf-8",
          body:
            "<html><body>Welcome! api_key=sk-test <a href=\"https://example.com/secret?token=abc\">link</a></body></html>",
        }),
    }),
  );

  const payload = JSON.stringify(result);

  assert.equal(result.status, "success");
  assert.equal(result.finalUrl, "https://example.com/");
  assert.equal(result.contentType, "text/html; charset=utf-8");
  assert.equal(result.truncated, false);
  assert.equal(result.textPreview?.includes("Welcome!"), true);
  assert.equal(result.textPreview?.includes("sk-test"), false);
  assert.equal(result.textPreview?.includes("token=abc"), false);
  assert.equal(payload.includes("token=abc"), false);
  assert.equal(payload.includes("sk-test"), false);
  assert.equal(result.toolResultPreview?.includes("Safe web fetch preview"), true);
});

test("safeWebFetch blocks localhost, private IP, and file URLs", async () => {
  const cases = [
    ["http://localhost:3000/", "blocked_private_address"],
    ["http://127.0.0.1/", "blocked_private_address"],
    ["http://10.0.0.1/", "blocked_private_address"],
    ["file:///etc/passwd", "unsupported_protocol"],
  ];

  for (const [url, expectedReason] of cases) {
    const result = await executeWebAgentToolPreview(
      createSafeFetchInput({
        toolInput: { url },
        fetchImpl: async () => {
          throw new Error("fetch must not run");
        },
      }),
    );

    assert.equal(result.status, "blocked");
    assert.equal(result.blockedReason, expectedReason);
  }
});

test("safeWebFetch blocks redirect targets that point at internal addresses", async () => {
  let fetchCalls = 0;
  const result = await executeWebAgentToolPreview(
    createSafeFetchInput({
      fetchImpl: async () => {
        fetchCalls += 1;
        return createFetchResponse({
          status: 302,
          url: "https://example.com/start",
          location: "http://127.0.0.1/private",
          body: "",
        });
      },
    }),
  );

  assert.equal(fetchCalls, 1);
  assert.equal(result.status, "blocked");
  assert.equal(result.blockedReason, "blocked_private_address");
});

test("safeWebFetch times out safely", async () => {
  const result = await executeWebAgentToolPreview(
    createSafeFetchInput({
      toolInput: {
        url: "https://example.com/slow",
        timeoutMs: 5,
      },
      fetchImpl: async (_url, init) =>
        new Promise((_, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(Object.assign(new Error("AbortError"), { name: "AbortError" })),
            { once: true },
          );
        }),
    }),
  );

  assert.equal(result.status, "error");
  assert.equal(result.errorReason, "request_timeout");
  assert.equal(result.toolResultPreview?.includes("timed out"), true);
});

test("safeWebFetch truncates by maxBytes", async () => {
  const result = await executeWebAgentToolPreview(
    createSafeFetchInput({
      toolInput: {
        url: "https://example.com/long",
        maxBytes: 24,
      },
      fetchImpl: async () =>
        createFetchResponse({
          url: "https://example.com/long",
          contentType: "text/plain; charset=utf-8",
          body: "abcdefghijklmnopqrstuvwxyz0123456789",
        }),
    }),
  );

  assert.equal(result.status, "success");
  assert.equal(result.truncated, true);
  assert.equal((result.textPreview ?? "").length <= 24, true);
});

test("safeWebFetch falls back safely on fetch errors", async () => {
  const result = await executeWebAgentToolPreview(
    createSafeFetchInput({
      fetchImpl: async () => {
        throw new Error("DATABASE_URL=postgres://secret");
      },
    }),
  );

  const payload = JSON.stringify(result);

  assert.equal(result.status, "error");
  assert.equal(result.errorReason, "fetch_failed_safely");
  assert.equal(payload.includes("DATABASE_URL"), false);
  assert.equal(payload.includes("postgres://secret"), false);
});
