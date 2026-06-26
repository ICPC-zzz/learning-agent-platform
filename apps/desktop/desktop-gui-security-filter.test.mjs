/**
 * Unit tests for Desktop GUI Security Filter functions.
 *
 * A279: Created to provide node:test coverage of the allowlist/denylist
 * filtering logic extracted from desktop-gui-regression.test.mjs.
 * These tests run without Electron/CDP - they exercise the pure
 * filtering rules in isolation.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  isNextJsDevInternalUrl,
  isConsoleNoise,
  isLocalUrl,
  isSuspiciousRequest,
  NEXTJS_DEV_INTERNAL_PATH_PREFIXES,
  SECURITY_PATH_BLOCKLIST,
} from "./desktop-gui-security-filter.mjs";

const DEV_ORIGIN = "http://localhost:3000";

test("isNextJsDevInternalUrl: allows Next.js static chunk paths on same origin", () => {
  assert.equal(
    isNextJsDevInternalUrl("http://localhost:3000/_next/static/chunks/main.js", DEV_ORIGIN),
    true
  );
  assert.equal(
    isNextJsDevInternalUrl("http://localhost:3000/_next/webpack-hmr", DEV_ORIGIN),
    true
  );
});

test("isNextJsDevInternalUrl: allows __nextjs_original-stack-frames on same origin", () => {
  assert.equal(
    isNextJsDevInternalUrl(
      "http://localhost:3000/__nextjs_original-stack-frames?file=page.tsx",
      DEV_ORIGIN
    ),
    true
  );
});

test("isNextJsDevInternalUrl: allows __nextjs_launch-editor on same origin", () => {
  assert.equal(
    isNextJsDevInternalUrl(
      "http://localhost:3000/__nextjs_launch-editor?file=src/app/page.tsx",
      DEV_ORIGIN
    ),
    true
  );
});

test("isNextJsDevInternalUrl: rejects same path but different hostname", () => {
  assert.equal(
    isNextJsDevInternalUrl("http://127.0.0.1:3000/_next/static/chunks/main.js", DEV_ORIGIN),
    false
  );
});

test("isNextJsDevInternalUrl: rejects same path but different port", () => {
  assert.equal(
    isNextJsDevInternalUrl("http://localhost:4000/_next/static/chunks/main.js", DEV_ORIGIN),
    false
  );
});

test("isNextJsDevInternalUrl: rejects same path but external domain", () => {
  assert.equal(
    isNextJsDevInternalUrl("https://evil.example.com/_next/static/chunks/main.js", DEV_ORIGIN),
    false
  );
});

test("isNextJsDevInternalUrl: rejects empty / null / undefined input", () => {
  assert.equal(isNextJsDevInternalUrl("", DEV_ORIGIN), false);
  assert.equal(isNextJsDevInternalUrl(null, DEV_ORIGIN), false);
  assert.equal(isNextJsDevInternalUrl(undefined, DEV_ORIGIN), false);
});

test("isNextJsDevInternalUrl: rejects /api path even on same origin", () => {
  assert.equal(
    isNextJsDevInternalUrl("http://localhost:3000/api/learning", DEV_ORIGIN),
    false
  );
});

test("isNextJsDevInternalUrl: rejects /llm path even on same origin", () => {
  assert.equal(
    isNextJsDevInternalUrl("http://localhost:3000/llm/chat", DEV_ORIGIN),
    false
  );
});

test("isNextJsDevInternalUrl: rejects /tool path even on same origin", () => {
  assert.equal(
    isNextJsDevInternalUrl("http://localhost:3000/tool/run", DEV_ORIGIN),
    false
  );
});

test("isConsoleNoise: matches React DevTools download message", () => {
  assert.equal(isConsoleNoise("Download the React DevTools for a better development experience"), true);
});

test("isConsoleNoise: matches HMR messages", () => {
  assert.equal(isConsoleNoise("[HMR] connected"), true);
  assert.equal(isConsoleNoise("[Fast Refresh] rebuilding"), true);
});

test("isConsoleNoise: matches webpack messages", () => {
  assert.equal(isConsoleNoise("[webpack-dev-server] Server started"), true);
  assert.equal(isConsoleNoise("webpack hot update checking..."), true);
  assert.equal(isConsoleNoise("Hot Module Replacement enabled"), true);
});

test("isConsoleNoise: matches webSocket connection failure messages", () => {
  assert.equal(isConsoleNoise("webSocket connection to 'ws://localhost:3000/_next/webpack-hmr' failed"), true);
  assert.equal(isConsoleNoise("ECONNREFUSED webpack-hmr"), true);
});

test("isConsoleNoise: matches React Warning prefixes", () => {
  assert.equal(isConsoleNoise("Warning: React does not recognize the foo prop"), true);
});

test("isConsoleNoise: matches __nextjs_original-stack-frames noise", () => {
  assert.equal(
    isConsoleNoise("Failed to fetch __nextjs_original-stack-frames"),
    true
  );
});

test("isConsoleNoise: matches React hydration mismatch errors in dev mode", () => {
  assert.equal(
    isConsoleNoise("Error: Hydration failed because the server rendered HTML didn't match the client. As a result this tree will be regenerated on the client."),
    true
  );
  // Shorter variant
  assert.equal(
    isConsoleNoise("Hydration failed because the server rendered HTML didn't match the client."),
    true
  );
});

test("isConsoleNoise: rejects real application errors", () => {
  assert.equal(isConsoleNoise("Uncaught TypeError: Cannot read properties of undefined"), false);
  assert.equal(isConsoleNoise("ReferenceError: foo is not defined"), false);
  assert.equal(isConsoleNoise("Network request failed for /api/data"), false);
  assert.equal(isConsoleNoise("Error: Database connection failed"), false);
});

test("isConsoleNoise: rejects empty / null / undefined input", () => {
  assert.equal(isConsoleNoise(""), false);
  assert.equal(isConsoleNoise(null), false);
  assert.equal(isConsoleNoise(undefined), false);
});

test("isLocalUrl: allows same-host same-port HTTP requests", () => {
  assert.equal(isLocalUrl("http://localhost:3000/books", DEV_ORIGIN), true);
  assert.equal(isLocalUrl("http://localhost:3000/learning", DEV_ORIGIN), true);
  assert.equal(isLocalUrl("http://localhost:3000/_next/static/chunks/main.js", DEV_ORIGIN), true);
});

test("isLocalUrl: allows data: blob: about: file: protocols", () => {
  assert.equal(isLocalUrl("data:text/html,hello", DEV_ORIGIN), true);
  assert.equal(isLocalUrl("blob:http://localhost:3000/some-uuid", DEV_ORIGIN), true);
  assert.equal(isLocalUrl("about:blank", DEV_ORIGIN), true);
  assert.equal(isLocalUrl("file:///C:/Users/test/index.html", DEV_ORIGIN), true);
});

test("isLocalUrl: allows WebSocket connections to same origin", () => {
  assert.equal(isLocalUrl("ws://localhost:3000/_next/webpack-hmr", DEV_ORIGIN), true);
  assert.equal(isLocalUrl("wss://localhost:3000/_next/webpack-hmr", DEV_ORIGIN), true);
});

test("isLocalUrl: rejects external domains", () => {
  assert.equal(isLocalUrl("https://example.com/api", DEV_ORIGIN), false);
  assert.equal(isLocalUrl("http://evil.example:3000/books", DEV_ORIGIN), false);
  assert.equal(isLocalUrl("https://google.com", DEV_ORIGIN), false);
});

test("isLocalUrl: rejects different port on localhost", () => {
  assert.equal(isLocalUrl("http://localhost:4000/books", DEV_ORIGIN), false);
});

test("isLocalUrl: rejects different hostname (127.0.0.1 vs localhost)", () => {
  assert.equal(isLocalUrl("http://127.0.0.1:3000/books", DEV_ORIGIN), false);
});

test("isLocalUrl: rejects empty / null / undefined input", () => {
  assert.equal(isLocalUrl("", DEV_ORIGIN), false);
  assert.equal(isLocalUrl(null, DEV_ORIGIN), false);
  assert.equal(isLocalUrl(undefined, DEV_ORIGIN), false);
});

test("isSuspiciousRequest: flags write methods POST PUT PATCH DELETE", () => {
  assert.equal(isSuspiciousRequest("http://localhost:3000/books", "POST", DEV_ORIGIN), true);
  assert.equal(isSuspiciousRequest("http://localhost:3000/books", "PUT", DEV_ORIGIN), true);
  assert.equal(isSuspiciousRequest("http://localhost:3000/books", "PATCH", DEV_ORIGIN), true);
  assert.equal(isSuspiciousRequest("http://localhost:3000/books", "DELETE", DEV_ORIGIN), true);
});

test("isSuspiciousRequest: flags URLs containing /api", () => {
  assert.equal(isSuspiciousRequest("http://localhost:3000/api/learning", "GET", DEV_ORIGIN), true);
  assert.equal(isSuspiciousRequest("http://localhost:3000/api/v2/users", "GET", DEV_ORIGIN), true);
});

test("isSuspiciousRequest: flags URLs containing /actions", () => {
  assert.equal(isSuspiciousRequest("http://localhost:3000/actions/run", "GET", DEV_ORIGIN), true);
});

test("isSuspiciousRequest: flags URLs containing /llm", () => {
  assert.equal(isSuspiciousRequest("http://localhost:3000/llm/chat", "GET", DEV_ORIGIN), true);
  assert.equal(isSuspiciousRequest("http://localhost:3000/llm/completion", "GET", DEV_ORIGIN), true);
});

test("isSuspiciousRequest: flags URLs containing /tool", () => {
  assert.equal(isSuspiciousRequest("http://localhost:3000/tool/run", "GET", DEV_ORIGIN), true);
  assert.equal(isSuspiciousRequest("http://localhost:3000/tool/search", "GET", DEV_ORIGIN), true);
});

test("isSuspiciousRequest: flags external domain with blocklist path", () => {
  assert.equal(isSuspiciousRequest("https://evil.example.com/api/steal", "GET", DEV_ORIGIN), true);
});

test("isSuspiciousRequest: does NOT flag Next.js dev internal GET requests", () => {
  assert.equal(
    isSuspiciousRequest("http://localhost:3000/_next/static/chunks/main.js", "GET", DEV_ORIGIN),
    false
  );
  assert.equal(
    isSuspiciousRequest("http://localhost:3000/__nextjs_original-stack-frames", "GET", DEV_ORIGIN),
    false
  );
  assert.equal(
    isSuspiciousRequest("http://localhost:3000/__nextjs_launch-editor", "GET", DEV_ORIGIN),
    false
  );
});

test("isSuspiciousRequest: does NOT flag normal GET to allowed business routes", () => {
  assert.equal(isSuspiciousRequest("http://localhost:3000/books", "GET", DEV_ORIGIN), false);
  assert.equal(isSuspiciousRequest("http://localhost:3000/learning", "GET", DEV_ORIGIN), false);
  assert.equal(isSuspiciousRequest("http://localhost:3000/reader?bookId=test", "GET", DEV_ORIGIN), false);
});

test("isSuspiciousRequest: does NOT flag write method on Next.js dev path", () => {
  assert.equal(
    isSuspiciousRequest("http://localhost:3000/_next/static/chunks/main.js", "POST", DEV_ORIGIN),
    false
  );
});

test("isSuspiciousRequest: flags /api on external domain regardless of origin", () => {
  assert.equal(
    isSuspiciousRequest("https://evil.example.com/api/data", "GET", DEV_ORIGIN),
    true
  );
});

test("SECURITY_PATH_BLOCKLIST contains all required blocked paths", () => {
  assert.equal(SECURITY_PATH_BLOCKLIST.includes("/api"), true);
  assert.equal(SECURITY_PATH_BLOCKLIST.includes("/actions"), true);
  assert.equal(SECURITY_PATH_BLOCKLIST.includes("/llm"), true);
  assert.equal(SECURITY_PATH_BLOCKLIST.includes("/tool"), true);
});

test("SECURITY_PATH_BLOCKLIST does NOT include Next.js dev paths", () => {
  for (const prefix of NEXTJS_DEV_INTERNAL_PATH_PREFIXES) {
    assert.equal(SECURITY_PATH_BLOCKLIST.includes(prefix), false);
  }
});

test("NEXTJS_DEV_INTERNAL_PATH_PREFIXES contains required dev paths", () => {
  assert.equal(NEXTJS_DEV_INTERNAL_PATH_PREFIXES.includes("/_next/"), true);
  assert.equal(NEXTJS_DEV_INTERNAL_PATH_PREFIXES.includes("/__nextjs_original-stack-frames"), true);
  assert.equal(NEXTJS_DEV_INTERNAL_PATH_PREFIXES.includes("/__nextjs_launch-editor"), true);
});

test("NEXTJS_DEV_INTERNAL_PATH_PREFIXES does NOT include dangerous paths", () => {
  for (const prefix of NEXTJS_DEV_INTERNAL_PATH_PREFIXES) {
    assert.equal(prefix.startsWith("/api"), false);
    assert.equal(prefix.startsWith("/llm"), false);
    assert.equal(prefix.startsWith("/tool"), false);
    assert.equal(prefix.startsWith("/actions"), false);
  }
});
