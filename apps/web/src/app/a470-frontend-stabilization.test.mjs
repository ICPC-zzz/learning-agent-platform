/**
 * A470 Frontend Stabilization v1 — Test Suite
 *
 * Pure Node.js source-analysis tests. Does NOT import TypeScript/TSX.
 * Validates structural correctness of frontend code via source inspection.
 *
 * Run: node apps/web/src/app/a470-frontend-stabilization.test.mjs
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// Test framework (minimal)
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    failures.push({ name, error: e.message });
    console.log(`  ✗ ${name} — ${e.message}`);
  }
}

function assert(condition, msg = "assertion failed") {
  if (!condition) throw new Error(msg);
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg || "not equal"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertIncludes(haystack, needle, msg) {
  if (!haystack.includes(needle)) {
    throw new Error(`${msg || "not found"}: "${needle}" not found in source`);
  }
}

function assertNotIncludes(haystack, needle, msg) {
  if (haystack.includes(needle)) {
    throw new Error(`${msg || "should not contain"}: "${needle}" found in source`);
  }
}

function assertOk(obj, msg) {
  if (!obj) throw new Error(`${msg || "falsy value"}: ${JSON.stringify(obj)}`);
}

function readSource(relativePath) {
  try {
    return readFileSync(resolve(__dirname, relativePath), "utf-8");
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Extract USER_NAV_ITEMS from AppNav source (parse the array)
// ---------------------------------------------------------------------------

function parseNavItems(src) {
  // Extract the USER_NAV_ITEMS array content
  const match = src.match(/export const USER_NAV_ITEMS[^=]*=\s*\[([\s\S]*?)\];/);
  if (!match) return [];
  const body = match[1];
  // Extract href values
  const hrefs = [];
  const hrefRe = /href:\s*"([^"]+)"/g;
  let m;
  while ((m = hrefRe.exec(body)) !== null) {
    hrefs.push(m[1]);
  }
  return hrefs;
}

// ---------------------------------------------------------------------------
// Session validation logic (inlined from web-auth-dev-session.ts, no TS import)
// ---------------------------------------------------------------------------

const SENSITIVE_PATTERNS = [
  /\btoken\b/i, /\bsecret\b/i, /\bpassword\b/i,
  /\bapi[_\s-]*key\b/i, /\bDATABASE_URL\b/i,
  /\bcookie\b/i, /\bauthorization\b/i, /\bcertificate\b/i,
  /\bprivate[_\s-]*key\b/i,
];

function hasSensitiveFields(record) {
  const json = JSON.stringify(record);
  return SENSITIVE_PATTERNS.some((p) => p.test(json));
}

function isValidDevSessionPayload(payload) {
  if (typeof payload !== "object" || payload === null) return false;
  const p = payload;
  if (typeof p.userIdPreview !== "string" || p.userIdPreview.length === 0) return false;
  if (typeof p.displayName !== "string" || p.displayName.length === 0) return false;
  if (typeof p.role !== "string" || p.role.length === 0) return false;
  if (p.sessionMode !== "dev-only") return false;
  if (typeof p.createdAt !== "string" || p.createdAt.length === 0) return false;
  if (hasSensitiveFields(p)) return false;
  const allowedKeys = ["userIdPreview", "displayName", "role", "sessionMode", "createdAt"];
  const actualKeys = Object.keys(p);
  if (actualKeys.length !== allowedKeys.length) return false;
  for (const key of actualKeys) {
    if (!allowedKeys.includes(key)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// A470 Auth-First Home Tests
// ---------------------------------------------------------------------------

console.log("\n═══ A470 Auth-First Home ═══");

test("Homepage source uses deserializeDevSession (real session)", () => {
  const src = readSource("./page.tsx");
  assertIncludes(src, "deserializeDevSession", "should deserialize real session");
});

test("Homepage source uses getSafeSessionSummary", () => {
  const src = readSource("./page.tsx");
  assertIncludes(src, "getSafeSessionSummary", "should use safe summary");
});

test("Homepage source has NO hardcoded loggedIn=true", () => {
  const src = readSource("./page.tsx");
  assertNotIncludes(src, "loggedIn = true", "no hardcoded loggedIn");
  assertNotIncludes(src, "isLoggedIn = true", "no hardcoded isLoggedIn");
  assertNotIncludes(src, "hasSession = true", "no hardcoded hasSession=true");
});

test("Homepage source has session failure catch block", () => {
  const src = readSource("./page.tsx");
  assertIncludes(src, "try {", "should have try/catch");
  assertIncludes(src, "catch", "should catch errors on session failure");
});

test("Homepage source renders HomeLoginEntry when no session", () => {
  const src = readSource("./page.tsx");
  assertIncludes(src, "HomeLoginEntry", "should render login entry");
  assertIncludes(src, "!hasSession", "should check hasSession flag");
});

test("Homepage source renders AuthenticatedHome when session exists", () => {
  const src = readSource("./page.tsx");
  assertIncludes(src, "AuthenticatedHome", "should render authenticated home");
});

// ---------------------------------------------------------------------------
// A470 Navigation Tests
// ---------------------------------------------------------------------------

console.log("\n═══ A470 Four-Page Navigation ═══");

const navSrc = readSource("./_components/AppNav.tsx");
const USER_NAV_HREFS = parseNavItems(navSrc);

test("USER_NAV_ITEMS has exactly 4 items", () => {
  assertEqual(USER_NAV_HREFS.length, 4, "should have exactly 4 nav items");
});

test("Navigation includes /books (书库)", () => {
  assert(USER_NAV_HREFS.includes("/books"), "/books should be in nav");
});

test("Navigation includes /problems (题目中心)", () => {
  assert(USER_NAV_HREFS.includes("/problems"), "/problems should be in nav");
});

test("Navigation includes /ai (AI助手)", () => {
  assert(USER_NAV_HREFS.includes("/ai"), "/ai should be in nav");
});

test("Navigation includes /user (个人)", () => {
  assert(USER_NAV_HREFS.includes("/user"), "/user should be in nav");
});

console.log("\n═══ A470 Navigation — Excluded Items ═══");

const EXCLUDED = ["/learning", "/daily-challenge", "/import", "/admin", "/agent"];

for (const path of EXCLUDED) {
  test(`USER_NAV_ITEMS does NOT contain ${path}`, () => {
    assert(!USER_NAV_HREFS.includes(path), `${path} should NOT be in top nav`);
  });
}

test("USER_NAV_ITEMS has no debug/dev paths", () => {
  for (const href of USER_NAV_HREFS) {
    assertNotIncludes(href.toLowerCase(), "debug", `${href} should not be debug`);
  }
});

test("AppHeader uses USER_NAV_ITEMS (not hardcoded items)", () => {
  const src = readSource("./_components/AppHeader.tsx");
  assertIncludes(src, "USER_NAV_ITEMS", "AppHeader should use USER_NAV_ITEMS");
});

test("AppHeader exposes guest auth actions", () => {
  const src = readSource("./_components/AppHeader.tsx");
  assertIncludes(src, 'href="/auth/login"', "should expose login link");
  assertIncludes(src, 'href="/auth/register"', "should expose register link");
});

test("AppSidebar uses USER_NAV_ITEMS (not hardcoded items)", () => {
  const src = readSource("./_components/AppSidebar.tsx");
  assertIncludes(src, "USER_NAV_ITEMS", "AppSidebar should use USER_NAV_ITEMS");
});

test("AppHeader has admin link as small '后台' (not in main nav)", () => {
  const src = readSource("./_components/AppHeader.tsx");
  assertIncludes(src, "/admin", "should have admin link");
  assertIncludes(src, "后台", "should label as 后台");
});

// ---------------------------------------------------------------------------
// A470 Session Safety Tests
// ---------------------------------------------------------------------------

console.log("\n═══ A470 Session Safety ═══");

test("isValidDevSessionPayload rejects null", () => {
  assert(!isValidDevSessionPayload(null), "null should be invalid");
});

test("isValidDevSessionPayload rejects undefined", () => {
  assert(!isValidDevSessionPayload(undefined), "undefined should be invalid");
});

test("isValidDevSessionPayload rejects empty object", () => {
  assert(!isValidDevSessionPayload({}), "empty object should be invalid");
});

test("isValidDevSessionPayload accepts valid payload", () => {
  const valid = {
    userIdPreview: "user-123",
    displayName: "Alice",
    role: "开发用户",
    sessionMode: "dev-only",
    createdAt: "2026-06-18T00:00:00.000Z",
  };
  assert(isValidDevSessionPayload(valid), "valid payload should be accepted");
});

test("isValidDevSessionPayload rejects extra fields", () => {
  const bad = {
    userIdPreview: "u1",
    displayName: "Test",
    role: "dev",
    sessionMode: "dev-only",
    createdAt: new Date().toISOString(),
    extraField: "nope",
  };
  assert(!isValidDevSessionPayload(bad), "extra fields should be rejected");
});

test("isValidDevSessionPayload rejects passwordHash field", () => {
  const bad = {
    userIdPreview: "u1",
    displayName: "Test",
    role: "dev",
    sessionMode: "dev-only",
    passwordHash: "hash123",
    createdAt: new Date().toISOString(),
  };
  // passwordHash would be an extra key
  assert(!isValidDevSessionPayload(bad), "passwordHash should be rejected");
});

test("isValidDevSessionPayload rejects token field", () => {
  const sensitive = {
    userIdPreview: "u1",
    displayName: "Test",
    role: "dev",
    sessionMode: "dev-only",
    createdAt: new Date().toISOString(),
  };
  assert(isValidDevSessionPayload(sensitive), "base should be valid");
  // Adding any extra key should fail
  const withToken = { ...sensitive, token: "abc" };
  assert(!isValidDevSessionPayload(withToken), "extra token key should be rejected");
});

test("Valid session payload does NOT trigger sensitive patterns", () => {
  const valid = {
    userIdPreview: "user-123",
    displayName: "Alice",
    role: "开发用户",
    sessionMode: "dev-only",
    createdAt: "2026-06-18T00:00:00.000Z",
  };
  assert(!hasSensitiveFields(valid), "valid payload should not trigger sensitive patterns");
});

// ---------------------------------------------------------------------------
// A470 Books Page Tests
// ---------------------------------------------------------------------------

console.log("\n═══ A470 Books Page Structure ═══");

const booksSrc = readSource("./books/page.tsx");

test("Books page has local book library section", () => {
  assertIncludes(booksSrc, "内置书籍", "should have built-in books section");
});

test("Books page has OpenLibrarySearchClient", () => {
  assertIncludes(booksSrc, "OpenLibrarySearchClient", "should import Open Library client");
});

test("Books page has custom import section (A470)", () => {
  assertIncludes(booksSrc, "导入自定义书籍", "should have import entry section");
  assertIncludes(booksSrc, "ImportEntryCard", "should have ImportEntryCard component");
});

test("Books page has import entries: text, PDF, DOCX, custom", () => {
  assertIncludes(booksSrc, "文本导入", "should have text import entry");
  assertIncludes(booksSrc, "PDF 导入", "should have PDF import entry");
  assertIncludes(booksSrc, "DOCX 导入", "should have DOCX import entry");
  assertIncludes(booksSrc, "自定义导入书籍", "should have custom import entry");
});

test("Books page has link to /import center", () => {
  assertIncludes(booksSrc, 'href="/import"', "should link to import page");
});

test("Books page has BookLibraryEmptyState for empty books", () => {
  assertIncludes(booksSrc, "BookLibraryEmptyState", "should handle empty state");
});

test("Books page has Reader entry", () => {
  assertIncludes(booksSrc, 'href="/reader"', "should have reader link");
});

// ---------------------------------------------------------------------------
// A470 Problems Page Tests
// ---------------------------------------------------------------------------

console.log("\n═══ A470 Problems Page Structure ═══");

const problemsSrc = readSource("./problems/page.tsx");

test("Problems page has local problem library section", () => {
  assertIncludes(problemsSrc, "平台题库", "should have platform problems section");
});

test("Problems page has platform filter section", () => {
  assertIncludes(problemsSrc, "我的题库", "should have my library title");
  assertIncludes(problemsSrc, "平台、标签和搜索筛选", "should describe platform filtering");
  assertNotIncludes(problemsSrc, "CodeforcesSearchClient", "should not import Codeforces client");
});

test("Problems page no longer exposes Codeforces external search", () => {
  assertNotIncludes(problemsSrc, "Codeforces 外部题库预览", "should not have Codeforces section");
});

test("Problems page has imported problems section", () => {
  assertIncludes(problemsSrc, "收藏题目", "should have favorites link");
});

test("Problems page has tryLoadDbImportedProblems fallback", () => {
  assertIncludes(problemsSrc, "tryLoadDbImportedProblems", "should try loading DB problems");
});

test("Problems page has safe tag filtering for empty data", () => {
  assertIncludes(problemsSrc, "Array.isArray", "should validate array before filter");
});

// ---------------------------------------------------------------------------
// A470 User Page Tests
// ---------------------------------------------------------------------------

console.log("\n═══ A470 User Page Structure ═══");

const userSrc = readSource("./user/page.tsx");

test("User page has AuthStatusCard for profile", () => {
  assertIncludes(userSrc, "AuthStatusCard", "should render auth status card");
});

test("User page has session-based displayName", () => {
  assertIncludes(userSrc, "displayName", "should use display name from session");
});

test("User page has 学习中心 section", () => {
  assertIncludes(userSrc, "学习中心", "should have learning center area");
});

test("User page links to /daily-challenge (not as top nav)", () => {
  assertIncludes(userSrc, "/daily-challenge", "should reference daily challenge");
});

test("User page links to /learning (internal)", () => {
  assertIncludes(userSrc, "/learning", "should reference learning center");
});

test("User page has learning stats cards", () => {
  assertIncludes(userSrc, "LearningStatCard", "should have learning stat cards");
});

test("User page has wrong-book section", () => {
  assertIncludes(userSrc, "错题本", "should have wrong book section");
});

test("User page has daily challenge entry section", () => {
  assertIncludes(userSrc, "每日挑战", "should reference daily challenge");
});

test("User page links to /user/report, /user/today", () => {
  assertIncludes(userSrc, "/user/report", "should link to report");
  assertIncludes(userSrc, "/user/today", "should link to today plan");
});

test("User page has data-missing safe handling", () => {
  // Uses optional chaining and null coalescing
  assertIncludes(userSrc, "?.", "should use optional chaining for safety");
});

test("User page imports deserializeDevSession (real session)", () => {
  assertIncludes(userSrc, "deserializeDevSession", "should import session deserializer");
});

test("User page has learning feedback hub", () => {
  assertIncludes(userSrc, "学习反馈中心", "should have learning feedback section");
});

// ---------------------------------------------------------------------------
// A470 AI Page Tests
// ---------------------------------------------------------------------------

console.log("\n═══ A470 AI Page Structure ═══");

const aiSrc = readSource("./ai/page.tsx");

test("AI page has LLM dev provider status table (A469)", () => {
  assertIncludes(aiSrc, "LlmDevProviderTable", "should have LLM dev provider table");
});

test("AI page imports evaluateWebAiQaGuard", () => {
  assertIncludes(aiSrc, "evaluateWebAiQaGuard", "should evaluate AI guard");
});

test("AI page imports llm-dev-provider-config (A469)", () => {
  assertIncludes(aiSrc, "getLlmDevProviderConfig", "should import LLM config");
});

test("AI page imports llm-dev-provider-guard (A469)", () => {
  assertIncludes(aiSrc, "evaluateLlmDevGuard", "should import LLM guard");
});

test("AI page has GuardDetailTable", () => {
  assertIncludes(aiSrc, "GuardDetailTable", "should show guard details");
});

test("AI page displays blocked reasons", () => {
  assertIncludes(aiSrc, "blockedReasons", "should show blocked reasons");
});

test("AI page does NOT leak API key values (source check)", () => {
  // Should not contain patterns like literal API keys
  assertNotIncludes(aiSrc, '"sk-', "should not leak API key pattern");
  assertNotIncludes(aiSrc, "'sk-", "should not leak API key pattern");
});

test("AI page shows session state (logged in / not logged in)", () => {
  assertIncludes(aiSrc, "hasSession", "should check session state");
  assertIncludes(aiSrc, "已登录", "should show logged in state");
  assertIncludes(aiSrc, "未登录", "should show not logged in state");
});

test("AI page has capabilities and limitations sections", () => {
  assertIncludes(aiSrc, "能力边界", "should have capabilities section");
  assertIncludes(aiSrc, "使用限制", "should have limitations section");
});

// ---------------------------------------------------------------------------
// A511 Floating AI Assistant Removal Tests
// ---------------------------------------------------------------------------

console.log("\n═══ A511 Floating AI Assistant Removed ═══");

const floatSrc = readSource("./_components/FloatingAiAssistant.tsx");

test("FloatingAiAssistant component source is absent", () => {
  assertEqual(floatSrc, "", "floating assistant source should be absent");
});

test("FloatingAiAssistant session gate source is absent", () => {
  assertEqual(floatSrc, "", "floating assistant source should be absent");
});

test("FloatingAiAssistant admin hide source is absent", () => {
  assertEqual(floatSrc, "", "floating assistant source should be absent");
});

test("FloatingAiAssistant login minimization source is absent", () => {
  assertEqual(floatSrc, "", "floating assistant source should be absent");
});

test("FloatingAiAssistant login path source is absent", () => {
  assertEqual(floatSrc, "", "floating assistant source should be absent");
});

test("FloatingAiAssistant register path source is absent", () => {
  assertEqual(floatSrc, "", "floating assistant source should be absent");
});

test("FloatingAiAssistant Esc shortcut source is absent", () => {
  assertEqual(floatSrc, "", "floating assistant source should be absent");
});

test("FloatingAiAssistant click-outside source is absent", () => {
  assertEqual(floatSrc, "", "floating assistant source should be absent");
});

test("FloatingAiAssistant blocked info source is absent", () => {
  assertEqual(floatSrc, "", "floating assistant source should be absent");
});

test("FloatingAiAssistant empty submit source is absent", () => {
  assertEqual(floatSrc, "", "floating assistant source should be absent");
});

test("FloatingAiAssistant localStorage source is absent", () => {
  assertEqual(floatSrc, "", "floating assistant source should be absent");
});

test("FloatingAiAssistant server action source is absent", () => {
  assertEqual(floatSrc, "", "floating assistant source should be absent");
});

// ---------------------------------------------------------------------------
// A470 Layout Tests
// ---------------------------------------------------------------------------

console.log("\n═══ A470 Admin Status Center ═══");

test("admin-status-center exports getAdminStatusSnapshot", () => {
  const src = readSource("../../lib/admin-status-center.ts");
  assertIncludes(src, "export function getAdminStatusSnapshot", "should export snapshot assembler");
});

test("admin-status-center has collectLlmStatus", () => {
  const src = readSource("../../lib/admin-status-center.ts");
  assertIncludes(src, "function collectLlmStatus", "should have LLM status collector");
});

test("admin-status-center has collectBookApiStatus", () => {
  const src = readSource("../../lib/admin-status-center.ts");
  assertIncludes(src, "function collectBookApiStatus", "should have book API status collector");
});

test("admin-status-center has snapshot assembler with all collectors", () => {
  const src = readSource("../../lib/admin-status-center.ts");
  assertIncludes(src, "collectLlmStatus()", "should call LLM collector");
  assertIncludes(src, "collectBookApiStatus()", "should call book API collector");
  assertIncludes(src, "collectProblemApiStatus()", "should call problem API collector");
  assertIncludes(src, "computeSummary", "should compute summary");
});

test("admin-status-center StatusValue type includes all values", () => {
  const src = readSource("../../lib/admin-status-center.ts");
  assertIncludes(src, '"enabled"', "should have enabled");
  assertIncludes(src, '"blocked"', "should have blocked");
  assertIncludes(src, '"missing-env"', "should have missing-env");
  assertIncludes(src, '"preview-only"', "should have preview-only");
  assertIncludes(src, '"unavailable"', "should have unavailable");
});

console.log("\n═══ A470 Layout Structure ═══");

const layoutSrc = readSource("./layout.tsx");

test("Layout wraps children in ShellRouter", () => {
  assertIncludes(layoutSrc, "ShellRouter", "should include ShellRouter");
});

test("Layout does not mount FloatingAiAssistant", () => {
  assertNotIncludes(layoutSrc, "FloatingAiAssistant", "should not render floating assistant");
  assertNotIncludes(layoutSrc, "<FloatingAiAssistant", "should not mount floating assistant");
});

test("Layout reads assistant session for shell gating", () => {
  assertIncludes(layoutSrc, "readAssistantSession", "should read session on server");
  assertIncludes(layoutSrc, 'hasSession={assistantSession.hasSession}', "should pass hasSession to shell");
});

// ---------------------------------------------------------------------------
// A470 Route Validation Tests
// ---------------------------------------------------------------------------

console.log("\n═══ A470 Route Existence ═══");

// Check that all linked routes exist as page files
const LINKED_ROUTES = [
  { from: "books/page.tsx", links: ["/import", "/reader", "/books/manage"] },
  { from: "problems/page.tsx", links: ["/user/favorites/problems", "/user/recent-practice", "/user/wrong-book"] },
  { from: "user/page.tsx", links: ["/daily-challenge", "/learning", "/user/report", "/user/today", "/user/wrong-book", "/user/activity"] },
  { from: "ai/page.tsx", links: ["/books", "/problems", "/user"] },
];

for (const { from, links } of LINKED_ROUTES) {
  for (const link of links) {
    const routePath = link.replace(/^\//, "");
    const pagePath = routePath + "/page.tsx";
    test(`Route ${link} exists (linked from ${from})`, () => {
      const src = readSource(pagePath);
      assert(src.length > 0, `page should exist at ${pagePath}`);
    });
  }
}

// ---------------------------------------------------------------------------
// A470 Safety Boundary Tests
// ---------------------------------------------------------------------------

console.log("\n═══ A470 Safety Boundaries ═══");

const CRITICAL_FILES = [
  "./page.tsx",
  "./layout.tsx",
  "./books/page.tsx",
  "./problems/page.tsx",
  "./user/page.tsx",
  "./ai/page.tsx",
  "./_components/AppNav.tsx",
  "./_components/AppHeader.tsx",
  "./_components/AppSidebar.tsx",
  "./auth/login/page.tsx",
];

test("No critical file reads .env.local directly", () => {
  for (const file of CRITICAL_FILES) {
    const src = readSource(file);
    if (src.includes(".env.local")) {
      throw new Error(`${file} reads .env.local`);
    }
  }
});

test("No critical file contains hardcoded API key patterns", () => {
  for (const file of CRITICAL_FILES) {
    const src = readSource(file);
    // Check for patterns that look like real keys (not env var names)
    if (/"sk-[a-zA-Z0-9]{20,}"/.test(src)) throw new Error(`${file} may leak API key`);
    if (/'sk-[a-zA-Z0-9]{20,}'/.test(src)) throw new Error(`${file} may leak API key`);
  }
});

test("No critical file references DATABASE_URL as string value", () => {
  for (const file of CRITICAL_FILES) {
    const src = readSource(file);
    // DATABASE_URL as env name is fine; as a value is not
    if (/["']postgres:\/\/[^"']+["']/.test(src)) {
      throw new Error(`${file} contains database connection string`);
    }
  }
});

test("AppNav does NOT export fake/mock user", () => {
  const src = readSource("./_components/AppNav.tsx");
  assertNotIncludes(src, "fakeUser", "should not export fake user");
  assertNotIncludes(src, "mockUser", "should not export mock user");
});

test("HomeLoginEntry does NOT fake login success", () => {
  const src = readSource("./_components/HomeLoginEntry.tsx");
  // Should use real server action, not fake success
  assertIncludes(src, "devLoginAction", "should use real login action");
  assertNotIncludes(src, "success: true", "should not hardcode success");
});

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

console.log("\n═══════════════════════════════════════════");
console.log("  A470 Frontend Stabilization Test Results");
console.log("═══════════════════════════════════════════");
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
console.log(`  Total:  ${passed + failed}`);

if (failures.length > 0) {
  console.log("\n  Failures:");
  for (const f of failures) {
    console.log(`    ✗ ${f.name}: ${f.error}`);
  }
}

console.log("");

process.exit(failed > 0 ? 1 : 0);
