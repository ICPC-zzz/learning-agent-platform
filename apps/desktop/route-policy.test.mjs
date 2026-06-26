import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const {
  DEFAULT_WEB_ROUTE,
  getAllowedWebUrlFromValue,
  getAllowedWebRouteFromValue,
  buildWebEntryUrl,
  resolveDesktopWebTarget,
} = require("./route-policy.js");

function mustAllowedUrl(raw) {
  const result = getAllowedWebUrlFromValue(raw);
  assert.ok(result.url, "expected URL to be allowed");
  return result.url;
}

test("allows localhost / 127.0.0.1 / [::1] with explicit port", () => {
  assert.equal(getAllowedWebUrlFromValue("http://localhost:3000").url?.origin, "http://localhost:3000");
  assert.equal(getAllowedWebUrlFromValue("http://127.0.0.1:5173").url?.origin, "http://127.0.0.1:5173");
  assert.equal(getAllowedWebUrlFromValue("http://[::1]:8080").url?.origin, "http://[::1]:8080");
});

test("rejects https, public hostname, missing port, and credentials", () => {
  assert.equal(getAllowedWebUrlFromValue("https://localhost:3000").error, "protocol");
  assert.equal(getAllowedWebUrlFromValue("http://example.com:3000").error, "hostname");
  assert.equal(getAllowedWebUrlFromValue("http://localhost").error, "port");
  assert.equal(getAllowedWebUrlFromValue("http://user:pass@localhost:3000").error, "credentials");
});

test("protocol rejection does not affect later legal URL/route resolution", () => {
  const rejected = getAllowedWebUrlFromValue("https://localhost:3000");
  assert.equal(rejected.error, "protocol");
  assert.equal(rejected.url, null);

  const allowed = getAllowedWebUrlFromValue("http://localhost:3000");
  assert.equal(allowed.error, null);
  assert.equal(allowed.url?.origin, "http://localhost:3000");
  assert.equal(getAllowedWebRouteFromValue("/books").route, "/books");
});

test("route defaults to /books when unset", () => {
  assert.equal(getAllowedWebRouteFromValue(undefined).route, DEFAULT_WEB_ROUTE);
});

test("allows /books and /learning routes", () => {
  assert.equal(getAllowedWebRouteFromValue("/books").route, "/books");
  assert.equal(getAllowedWebRouteFromValue("/learning").route, "/learning");
});

test("builds fixed /learning target without query parameters", () => {
  const allowedUrl = mustAllowedUrl("http://localhost:3000");
  const entry = buildWebEntryUrl(allowedUrl, "/learning", {});
  assert.equal(entry.error, null);
  assert.equal(entry.targetError, null);
  assert.equal(entry.url, "http://localhost:3000/learning");
});

test("rejects dangerous query and external protocol route values for /learning", () => {
  const withDangerousQuery = getAllowedWebRouteFromValue("/learning?next=http://evil.example");
  assert.equal(withDangerousQuery.route, "/books");
  assert.equal(withDangerousQuery.error, "safety_rule");

  const javascriptProtocol = getAllowedWebRouteFromValue("javascript:alert(1)");
  assert.equal(javascriptProtocol.route, "/books");
  assert.equal(javascriptProtocol.error, "safety_rule");

  const externalHttpRoute = getAllowedWebRouteFromValue("http://evil.example/learning");
  assert.equal(externalHttpRoute.route, "/books");
  assert.equal(externalHttpRoute.error, "safety_rule");
});

test("allows /agent route for fixed preview-mode construction only", () => {
  assert.equal(getAllowedWebRouteFromValue("/agent").route, "/agent");
  assert.equal(getAllowedWebRouteFromValue("/agent").error, null);
});

test("normalizes converted Windows-like route path to allow-listed route", () => {
  const route = getAllowedWebRouteFromValue("D:/tmp/sandbox/books");
  assert.equal(route.route, "/books");
  assert.equal(route.error, null);
});

test("normalizes converted Windows-like agent route path", () => {
  const route = getAllowedWebRouteFromValue("D:/tmp/sandbox/agent");
  assert.equal(route.route, "/agent");
  assert.equal(route.error, null);
});

test("reader route falls back to /books when bookId is missing", () => {
  const allowedUrl = mustAllowedUrl("http://localhost:3000");
  const entry = buildWebEntryUrl(allowedUrl, "/reader", {});
  assert.equal(entry.targetError, "reader_book_required");
  assert.equal(entry.url, "http://localhost:3000/books");
});

test("reader route with legal bookId/chapterId builds expected URL", () => {
  const allowedUrl = mustAllowedUrl("http://localhost:3000");
  const entry = buildWebEntryUrl(allowedUrl, "/reader", {
    bookId: "sample-book",
    chapterId: "chapter-1",
  });

  assert.equal(entry.error, null);
  assert.equal(entry.targetError, null);
  assert.equal(entry.url, "http://localhost:3000/reader?bookId=sample-book&chapterId=chapter-1");
});

test("agent route with fixed mode=preview builds expected URL", () => {
  const allowedUrl = mustAllowedUrl("http://localhost:3000");
  const entry = buildWebEntryUrl(allowedUrl, "/agent", {}, "preview");

  assert.equal(entry.error, null);
  assert.equal(entry.targetError, null);
  assert.equal(entry.url, "http://localhost:3000/agent?mode=preview");
});

test("agent route without fixed mode=preview falls back to /books", () => {
  const allowedUrl = mustAllowedUrl("http://localhost:3000");
  const invalidModeInputs = [undefined, "", "manual", "preview#x", " preview "];

  for (const invalidMode of invalidModeInputs) {
    const entry = buildWebEntryUrl(allowedUrl, "/agent", {}, invalidMode);
    assert.equal(entry.targetError, "agent_mode_required");
    assert.equal(entry.url, "http://localhost:3000/books");
  }
});

test("invalid reader params are rejected and fall back to /books", () => {
  const allowedUrl = mustAllowedUrl("http://localhost:3000");
  const invalidBookIds = ["bad/id", "abc?x=1", "abc#x", " "];

  for (const invalidBookId of invalidBookIds) {
    const entry = buildWebEntryUrl(allowedUrl, "/reader", { bookId: invalidBookId });
    assert.equal(entry.targetError, "reader_book_required");
    assert.equal(entry.url, "http://localhost:3000/books");
  }
});

test("does not inherit path/query/hash from allowed URL", () => {
  const allowedUrl = mustAllowedUrl("http://localhost:3000/ignored/path?x=1#frag");
  const entry = buildWebEntryUrl(allowedUrl, "/learning", {});
  assert.equal(entry.error, null);
  assert.equal(entry.url, "http://localhost:3000/learning");
});

test("invalid route /admin?x=1 falls back to /books", () => {
  const route = getAllowedWebRouteFromValue("/admin?x=1");
  assert.equal(route.route, "/books");
  assert.equal(route.error, "safety_rule");
});

test("startup target resolves to static intent when web URL is unset", () => {
  const resolved = resolveDesktopWebTarget({
    webUrlValue: undefined,
    routeValue: "/learning",
  });

  assert.equal(resolved.isAllowedUrl, false);
  assert.equal(resolved.allowedUrl, null);
  assert.equal(resolved.targetUrl, null);
  assert.equal(resolved.fallbackReason, "static_no_allowed_url");
});

test("startup target defaults route to /books for legal web URL when route is unset", () => {
  const resolved = resolveDesktopWebTarget({
    webUrlValue: "http://localhost:3000",
    routeValue: undefined,
  });

  assert.equal(resolved.isAllowedUrl, true);
  assert.equal(resolved.route, "/books");
  assert.equal(resolved.routeDefaultedToBooks, true);
  assert.equal(resolved.targetUrl, "http://localhost:3000/books");
});

test("startup target resolves /learning route for legal web URL", () => {
  const resolved = resolveDesktopWebTarget({
    webUrlValue: "http://localhost:3000",
    routeValue: "/learning",
  });

  assert.equal(resolved.route, "/learning");
  assert.equal(resolved.routeDefaultedToBooks, false);
  assert.equal(resolved.targetUrl, "http://localhost:3000/learning");
});

test("startup target resolves /reader with legal bookId/chapterId", () => {
  const resolved = resolveDesktopWebTarget({
    webUrlValue: "http://localhost:3000",
    routeValue: "/reader",
    readerBookIdValue: "sample-book",
    readerChapterIdValue: "chapter-1",
  });

  assert.equal(resolved.route, "/reader");
  assert.equal(resolved.targetError, null);
  assert.equal(
    resolved.targetUrl,
    "http://localhost:3000/reader?bookId=sample-book&chapterId=chapter-1"
  );
});

test("startup target resolves /agent with fixed mode=preview", () => {
  const resolved = resolveDesktopWebTarget({
    webUrlValue: "http://localhost:3000",
    routeValue: "/agent",
    agentModeValue: "preview",
  });

  assert.equal(resolved.route, "/agent");
  assert.equal(resolved.targetError, null);
  assert.equal(resolved.targetUrl, "http://localhost:3000/agent?mode=preview");
});

test("startup target falls back to /books when /agent mode is missing or invalid", () => {
  const missingMode = resolveDesktopWebTarget({
    webUrlValue: "http://localhost:3000",
    routeValue: "/agent",
  });
  assert.equal(missingMode.route, "/agent");
  assert.equal(missingMode.targetError, "agent_mode_required");
  assert.equal(missingMode.targetUrl, "http://localhost:3000/books");

  const invalidMode = resolveDesktopWebTarget({
    webUrlValue: "http://localhost:3000",
    routeValue: "/agent",
    agentModeValue: "manual",
  });
  assert.equal(invalidMode.route, "/agent");
  assert.equal(invalidMode.targetError, "agent_mode_required");
  assert.equal(invalidMode.targetUrl, "http://localhost:3000/books");
});

test("startup target falls back to /books when /reader misses bookId", () => {
  const resolved = resolveDesktopWebTarget({
    webUrlValue: "http://localhost:3000",
    routeValue: "/reader",
  });

  assert.equal(resolved.route, "/reader");
  assert.equal(resolved.targetError, "reader_book_required");
  assert.equal(resolved.targetUrl, "http://localhost:3000/books");
});

test("startup target returns static intent for illegal web URL", () => {
  const resolved = resolveDesktopWebTarget({
    webUrlValue: "https://localhost:3000",
    routeValue: "/learning",
  });

  assert.equal(resolved.isAllowedUrl, false);
  assert.equal(resolved.allowedUrlError, "protocol");
  assert.equal(resolved.targetUrl, null);
  assert.equal(resolved.fallbackReason, "static_no_allowed_url");
});

test("startup target falls back route to /books for illegal route", () => {
  const resolved = resolveDesktopWebTarget({
    webUrlValue: "http://localhost:3000",
    routeValue: "/admin",
  });

  assert.equal(resolved.route, "/books");
  assert.equal(resolved.routeError, "not_allowed");
  assert.equal(resolved.routeDefaultedToBooks, true);
  assert.equal(resolved.targetUrl, "http://localhost:3000/books");
});

test("startup target does not inherit path/search/hash and rejects credentials URL", () => {
  const pathSearchHashResolved = resolveDesktopWebTarget({
    webUrlValue: "http://localhost:3000/ignored/path?x=1#frag",
    routeValue: "/learning",
  });
  assert.equal(pathSearchHashResolved.targetUrl, "http://localhost:3000/learning");

  const credentialResolved = resolveDesktopWebTarget({
    webUrlValue: "http://user:pass@localhost:3000",
    routeValue: "/learning",
  });
  assert.equal(credentialResolved.allowedUrlError, "credentials");
  assert.equal(credentialResolved.targetUrl, null);
  assert.equal(credentialResolved.fallbackReason, "static_no_allowed_url");
});

test("main startup flow keeps single launch-config resolution call (A203 guard)", () => {
  const currentTestFilePath = fileURLToPath(import.meta.url);
  const desktopDir = path.dirname(currentTestFilePath);
  const mainJsPath = path.join(desktopDir, "main.js");
  const mainSource = readFileSync(mainJsPath, "utf8");
  const resolveCallCount = (mainSource.match(/resolveDesktopLaunchConfigFromEnv\(\);/g) || []).length;

  assert.equal(resolveCallCount, 1);
  assert.match(mainSource, /loadDesktopEntry\(win, launchConfig\);/);
});
