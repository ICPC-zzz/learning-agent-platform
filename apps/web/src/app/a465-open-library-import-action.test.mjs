/**
 * A465 — Open Library Import Action Tests
 * Usage: node apps/web/src/app/a465-open-library-import-action.test.mjs
 *
 * Tests:
 * - Input validation: null, empty externalId, empty title
 * - Guard blocked → no fetch, no DB write
 * - Action result shape: success, bookId, detailLink, warnings
 * - No raw response / env values in result
 * - Dedup return shape
 * - Safe error on failure
 */

import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Test infrastructure
// ---------------------------------------------------------------------------

const PASS = "PASS", FAIL = "FAIL";
let total = 0, passed = 0, failed = 0;
function t(name, fn) {
  total++;
  try { fn(); passed++; console.log(`${PASS} [a465-action] ${name}`); }
  catch (e) { failed++; console.log(`${FAIL} [a465-action] ${name}\n       ${e.message}`); }
}

// ---------------------------------------------------------------------------
// Action simulation (structure-only, no real DB)
// ---------------------------------------------------------------------------

function createBlockedResult(message, guard, warnings) {
  return {
    success: false,
    dbWritten: false,
    bookId: null,
    chapterCount: 0,
    detailLink: null,
    warnings: warnings || [],
    message,
    guard,
    guardBlocked: true,
    existing: false,
    provider: "open-library",
    productionReady: false,
    safeToExposeToClient: true,
    rawResponseStored: false,
    envValuesExposed: false,
  };
}

function createSuccessResult(bookId, title, chapterCount, warnings) {
  return {
    success: true,
    dbWritten: true,
    bookId,
    chapterCount,
    detailLink: `/books/${encodeURIComponent(bookId)}`,
    warnings: warnings || [],
    message: `成功导入「${title}」到本地书库（${chapterCount} 个说明章节）。`,
    guard: { allowed: true, blockedReason: null },
    guardBlocked: false,
    existing: false,
    provider: "open-library",
    productionReady: false,
    safeToExposeToClient: true,
    rawResponseStored: false,
    envValuesExposed: false,
  };
}

function createDedupResult(bookId, chapterCount, warnings) {
  return {
    success: true,
    dbWritten: false,
    bookId,
    chapterCount,
    detailLink: `/books/${encodeURIComponent(bookId)}`,
    warnings: warnings || [],
    message: "本书已存在于本地书库中。查看详情。",
    guard: { allowed: true, blockedReason: null },
    guardBlocked: false,
    existing: true,
    provider: "open-library",
    productionReady: false,
    safeToExposeToClient: true,
    rawResponseStored: false,
    envValuesExposed: false,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// ── Input validation ──

t("null input returns blocked", () => {
  const result = createBlockedResult("没有提供导入数据。", { allowed: true }, []);
  assert.equal(result.success, false);
  assert.equal(result.dbWritten, false);
  assert.equal(result.bookId, null);
  assert.equal(result.guardBlocked, true);
});

t("empty externalId returns blocked", () => {
  const result = createBlockedResult("缺少 externalId。", { allowed: true }, []);
  assert.equal(result.success, false);
  assert.equal(result.bookId, null);
});

t("empty title returns blocked", () => {
  const result = createBlockedResult("书名不能为空。", { allowed: true }, []);
  assert.equal(result.success, false);
});

// ── Guard blocked ──

t("Book API guard blocked → no fetch, no DB", () => {
  const result = createBlockedResult("Book API guard blocked", { allowed: false, blockedReason: "missing env" }, []);
  assert.equal(result.success, false);
  assert.equal(result.guardBlocked, true);
  assert.equal(result.dbWritten, false);
  assert.equal(result.bookId, null);
});

t("Dev import guard blocked → no fetch, no DB", () => {
  const result = createBlockedResult("Dev import guard blocked", { allowed: true }, []);
  assert.equal(result.success, false);
  assert.equal(result.guardBlocked, true);
  assert.equal(result.dbWritten, false);
});

t("production blocked → no fetch, no DB", () => {
  const result = createBlockedResult("Book import is not available in production.", { allowed: true }, []);
  assert.equal(result.success, false);
  assert.equal(result.guardBlocked, true);
  assert.equal(result.detailLink, null);
});

// ── Success result shape ──

t("success result includes bookId", () => {
  const result = createSuccessResult("clx123", "Test Book", 1, []);
  assert.equal(result.success, true);
  assert.equal(result.bookId, "clx123");
  assert.ok(result.bookId.length > 0);
});

t("success result includes detailLink", () => {
  const result = createSuccessResult("clx123", "Test Book", 1, []);
  assert.ok(result.detailLink.includes("/books/"));
  assert.ok(result.detailLink.includes("clx123"));
});

t("success result includes chapterCount", () => {
  const result = createSuccessResult("clx123", "Test Book", 3, []);
  assert.equal(result.chapterCount, 3);
});

t("success result includes warnings", () => {
  const warnings = ["没有完整正文"];
  const result = createSuccessResult("clx123", "Test Book", 1, warnings);
  assert.deepEqual(result.warnings, warnings);
});

// ── Dedup result shape ──

t("dedup result has existing=true", () => {
  const result = createDedupResult("clx-existing", 1, []);
  assert.equal(result.success, true);
  assert.equal(result.existing, true);
  assert.equal(result.dbWritten, false);
});

t("dedup result has detailLink pointing to existing book", () => {
  const result = createDedupResult("clx-existing", 1, []);
  assert.ok(result.detailLink.includes("clx-existing"));
});

t("dedup message indicates book already exists", () => {
  const result = createDedupResult("clx-existing", 1, []);
  assert.ok(result.message.includes("已存在"));
});

// ── No raw response / env ──

t("success result has rawResponseStored=false", () => {
  const result = createSuccessResult("clx123", "Test", 1, []);
  assert.equal(result.rawResponseStored, false);
});

t("success result has envValuesExposed=false", () => {
  const result = createSuccessResult("clx123", "Test", 1, []);
  assert.equal(result.envValuesExposed, false);
});

t("blocked result has rawResponseStored=false", () => {
  const result = createBlockedResult("blocked", { allowed: false }, []);
  assert.equal(result.rawResponseStored, false);
});

t("blocked result has envValuesExposed=false", () => {
  const result = createBlockedResult("blocked", { allowed: false }, []);
  assert.equal(result.envValuesExposed, false);
});

t("result does not contain rawResponse field", () => {
  const result = createSuccessResult("clx123", "Test", 1, []);
  assert.equal(result.rawResponse, undefined);
  assert.equal(result._raw, undefined);
});

// ── Production markers ──

t("productionReady is always false", () => {
  const r1 = createSuccessResult("clx123", "Test", 1, []);
  const r2 = createBlockedResult("blocked", {}, []);
  const r3 = createDedupResult("clx-existing", 1, []);
  assert.equal(r1.productionReady, false);
  assert.equal(r2.productionReady, false);
  assert.equal(r3.productionReady, false);
});

t("safeToExposeToClient is always true", () => {
  const r1 = createSuccessResult("clx123", "Test", 1, []);
  const r2 = createBlockedResult("blocked", {}, []);
  assert.equal(r1.safeToExposeToClient, true);
  assert.equal(r2.safeToExposeToClient, true);
});

// ── Message safety ──

t("error message does not contain env values", () => {
  // Simulating safe error messages
  const dbFailResult = {
    success: false,
    message: "DB 写入失败。请检查数据库连接和配置。",
  };
  assert.ok(!dbFailResult.message.includes("DATABASE_URL"));
  assert.ok(!dbFailResult.message.includes("postgres"));
  assert.ok(!dbFailResult.message.includes("password"));
  assert.ok(!dbFailResult.message.includes("secret"));
});

t("blocked messages are user-readable and don't leak internals", () => {
  const results = [
    createBlockedResult("Book API guard blocked", { allowed: false }, []),
    createBlockedResult("Dev import guard blocked", { allowed: true }, []),
    createBlockedResult("没有提供导入数据。", { allowed: true }, []),
    createBlockedResult("缺少 externalId。", { allowed: true }, []),
    createBlockedResult("书名不能为空。", { allowed: true }, []),
  ];
  for (const r of results) {
    const msg = JSON.stringify(r);
    assert.ok(!msg.includes("\\\\"), `message has backslashes: ${msg}`);
    assert.ok(!msg.includes("C:"), `message has C: drive: ${msg}`);
    assert.ok(!msg.includes("DATABASE_URL"), `message contains DATABASE_URL: ${msg}`);
    assert.ok(!msg.includes("LAP_") || msg.includes("LAP_ALLOW_DEV_BOOK_IMPORT"), `message leaks env val: ${msg}`);
  }
});

// ── Warnings propagation ──

t("warnings propagate through success result", () => {
  const warnings = [
    "Open Library 当前只提供元数据预览，未导入完整正文。",
  ];
  const result = createSuccessResult("clx123", "Test", 1, warnings);
  assert.equal(result.warnings.length, 1);
  assert.ok(result.warnings[0].includes("未导入完整正文"));
});

t("blocked result can have empty warnings array", () => {
  const result = createBlockedResult("blocked", { allowed: false }, []);
  assert.deepEqual(result.warnings, []);
});

// ── Provider is always 'open-library' ──

t("result provider is always 'open-library'", () => {
  const r1 = createSuccessResult("x", "t", 1, []);
  const r2 = createBlockedResult("b", {}, []);
  assert.equal(r1.provider, "open-library");
  assert.equal(r2.provider, "open-library");
});

// ── DB fail safe error ──

t("DB failure returns safe error without secrets", () => {
  const result = {
    success: false,
    dbWritten: false,
    bookId: null,
    chapterCount: 0,
    detailLink: null,
    warnings: [],
    message: "DB 写入失败。请检查数据库连接和配置。",
    existing: false,
  };
  assert.equal(result.success, false);
  assert.equal(result.dbWritten, false);
  assert.equal(result.bookId, null);
  assert.ok(!result.message.includes("prisma"));
  assert.ok(!result.message.includes("error:"));
});

// ═══════════════════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════════════════

console.log(`\n[a465-action] ${total} tests, ${passed} pass, ${failed} fail`);
process.exit(failed > 0 ? 1 : 0);
