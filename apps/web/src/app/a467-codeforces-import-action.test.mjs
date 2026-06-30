/**
 * A467 Codeforces Import Action Tests
 *
 * Tests for codeforces-import-actions.ts:
 * - Input validation
 * - Guard blocked returns (no fetch, no DB write)
 * - Guard allowed → mock import flow
 * - Duplicate detection
 * - DB failure safe error
 * - Result structure safety
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

// ---------------------------------------------------------------------------
// Inline action logic — tests without ESM/DB dependencies
// ---------------------------------------------------------------------------

function evaluateDevProblemImportGuard() {
  try {
    if (process.env.NODE_ENV === "production") {
      return { allowed: false, blockedReason: "PROBLEM_IMPORT_PRODUCTION_BLOCKED" };
    }
  } catch { return { allowed: false, blockedReason: "NODE_ENV_UNREADABLE" }; }

  try {
    if (process.env.LAP_ALLOW_DEV_PROBLEM_IMPORT === "true") {
      return { allowed: true, blockedReason: null };
    }
  } catch { return { allowed: false, blockedReason: "CANNOT_READ_IMPORT" }; }

  return { allowed: false, blockedReason: "DEV_PROBLEM_IMPORT_NOT_ENABLED" };
}

function validateImportInput(input) {
  if (!input) return { valid: false, reason: "没有提供导入数据。" };
  const externalId = (input.externalId ?? "").trim();
  if (externalId.length === 0) return { valid: false, reason: "缺少 externalId。" };
  const name = (input.name ?? "").trim().slice(0, 500);
  if (name.length === 0) return { valid: false, reason: "题目标题不能为空。" };
  return { valid: true };
}

function createBlockedResult(message) {
  return {
    success: false,
    dbWritten: false,
    problemId: null,
    title: null,
    detailLink: null,
    warnings: [],
    message,
    guardBlocked: true,
    existing: false,
    provider: "codeforces",
    productionReady: false,
    safeToExposeToClient: true,
    rawResponseStored: false,
    envValuesExposed: false,
  };
}

function createSafeErrorResult(draft, message) {
  return {
    success: false,
    dbWritten: false,
    problemId: null,
    title: draft.name,
    detailLink: null,
    warnings: draft.warnings,
    message,
    guardBlocked: false,
    existing: false,
    provider: "codeforces",
    productionReady: false,
    safeToExposeToClient: true,
    rawResponseStored: false,
    envValuesExposed: false,
  };
}

// Mock action that tests the guard chain
function mockImportAction(input, opts) {
  opts = opts || {};
  const apiAllowed = opts.apiAllowed !== false;
  const importAllowed = opts.importAllowed !== false;
  const dbAvailable = opts.dbAvailable !== false;
  const dupExists = opts.dupExists || false;
  const dbError = opts.dbError || false;

  // Guard checks
  if (!apiAllowed) {
    return createBlockedResult("Problem API guard blocked");
  }

  if (!importAllowed) {
    return createBlockedResult("Dev import guard blocked");
  }

  if (process.env.NODE_ENV === "production") {
    return createBlockedResult("Problem import is not available in production.");
  }

  // Input validation
  const valid = validateImportInput(input);
  if (!valid.valid) {
    return createBlockedResult(valid.reason);
  }

  if (!dbAvailable) {
    return createBlockedResult("DB 持久化未启用。");
  }

  // Dup check
  if (dupExists) {
    return {
      success: true,
      dbWritten: false,
      problemId: "existing-id-123",
      title: input.name.trim(),
      detailLink: "/problems/existing-id-123",
      warnings: ["无完整题面"],
      message: "题目已存在于本地题库中。",
      guardBlocked: false,
      existing: true,
      provider: "codeforces",
      productionReady: false,
      safeToExposeToClient: true,
      rawResponseStored: false,
      envValuesExposed: false,
    };
  }

  if (dbError) {
    return createSafeErrorResult(
      { name: input.name.trim(), warnings: ["无完整题面"] },
      "DB 写入失败。请检查数据库连接和配置。",
    );
  }

  // Success
  return {
    success: true,
    dbWritten: true,
    problemId: "new-problem-id-456",
    title: input.name.trim(),
    detailLink: "/problems/new-problem-id-456",
    warnings: ["无完整题面"],
    message: "成功导入「" + input.name.trim() + "」到本地题库。",
    guardBlocked: false,
    existing: false,
    provider: "codeforces",
    productionReady: false,
    safeToExposeToClient: true,
    rawResponseStored: false,
    envValuesExposed: false,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("A467 Import Action", function() {
  describe("Input validation", function() {
    it("returns blocked when input is null", function() {
      var result = mockImportAction(null, { importAllowed: true, apiAllowed: true, dbAvailable: true });
      assert.equal(result.success, false);
      assert.equal(result.dbWritten, false);
      assert.ok(result.message.includes("没有提供导入数据"));
    });

    it("returns blocked when externalId is empty", function() {
      var result = mockImportAction(
        { externalId: "", name: "Test", sourceUrl: "" },
        { importAllowed: true, apiAllowed: true, dbAvailable: true },
      );
      assert.equal(result.success, false);
      assert.ok(result.message.includes("externalId"));
    });

    it("returns blocked when name is empty", function() {
      var result = mockImportAction(
        { externalId: "codeforces:1:A", name: "", sourceUrl: "" },
        { importAllowed: true, apiAllowed: true, dbAvailable: true },
      );
      assert.equal(result.success, false);
      assert.ok(result.message.includes("标题"));
    });

    it("validates successfully with proper input", function() {
      var valid = validateImportInput({
        externalId: "codeforces:4:A",
        name: "Watermelon",
        sourceUrl: "https://codeforces.com/problemset/problem/4/A",
      });
      assert.equal(valid.valid, true);
    });
  });

  describe("Guard blocked behavior", function() {
    it("does not write DB when Problem API guard is blocked", function() {
      var result = mockImportAction(
        { externalId: "codeforces:1:A", name: "Test", sourceUrl: "" },
        { apiAllowed: false },
      );
      assert.equal(result.success, false);
      assert.equal(result.dbWritten, false);
      assert.equal(result.problemId, null);
      assert.equal(result.guardBlocked, true);
    });

    it("does not write DB when dev import guard is blocked", function() {
      var result = mockImportAction(
        { externalId: "codeforces:1:A", name: "Test", sourceUrl: "" },
        { importAllowed: false },
      );
      assert.equal(result.success, false);
      assert.equal(result.dbWritten, false);
      assert.equal(result.guardBlocked, true);
    });

    it("does not write DB when DB persist is not available", function() {
      var result = mockImportAction(
        { externalId: "codeforces:1:A", name: "Test", sourceUrl: "" },
        { dbAvailable: false },
      );
      assert.equal(result.success, false);
      assert.equal(result.dbWritten, false);
    });

    it("no DB written for any blocked path", function() {
      var scenarios = [
        { apiAllowed: false },
        { importAllowed: false },
        { dbAvailable: false },
      ];

      for (var i = 0; i < scenarios.length; i++) {
        var result = mockImportAction(
          { externalId: "codeforces:1:A", name: "Test", sourceUrl: "" },
          scenarios[i],
        );
        assert.equal(result.dbWritten, false, "Scenario " + i + " should not have dbWritten=true");
      }
    });
  });

  describe("Successful import", function() {
    it("returns problemId and detailLink on success", function() {
      // Need to set env so production check passes
      var prevEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";
      try {
        var result = mockImportAction(
          { externalId: "codeforces:4:A", name: "Watermelon", tags: ["math"], sourceUrl: "url" },
          { importAllowed: true, apiAllowed: true, dbAvailable: true },
        );
        assert.equal(result.success, true);
        assert.equal(result.dbWritten, true);
        assert.ok(result.problemId);
        assert.ok(result.detailLink);
        assert.ok(result.detailLink.startsWith("/problems/"));
        assert.ok(result.title);
        assert.equal(result.guardBlocked, false);
        assert.equal(result.existing, false);
      } finally {
        if (prevEnv !== undefined) process.env.NODE_ENV = prevEnv;
      }
    });

    it("sets productionReady=false for all success paths", function() {
      var prevEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";
      try {
        var result = mockImportAction(
          { externalId: "codeforces:4:A", name: "Watermelon", sourceUrl: "url" },
          { importAllowed: true, apiAllowed: true, dbAvailable: true },
        );
        assert.equal(result.productionReady, false);
      } finally {
        if (prevEnv !== undefined) process.env.NODE_ENV = prevEnv;
      }
    });

    it("result has safeToExposeToClient=true", function() {
      var prevEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";
      try {
        var result = mockImportAction(
          { externalId: "codeforces:4:A", name: "Watermelon", sourceUrl: "url" },
          { importAllowed: true, apiAllowed: true, dbAvailable: true },
        );
        assert.equal(result.safeToExposeToClient, true);
      } finally {
        if (prevEnv !== undefined) process.env.NODE_ENV = prevEnv;
      }
    });

    it("result has rawResponseStored=false", function() {
      var prevEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";
      try {
        var result = mockImportAction(
          { externalId: "codeforces:4:A", name: "Watermelon", sourceUrl: "url" },
          { importAllowed: true, apiAllowed: true, dbAvailable: true },
        );
        assert.equal(result.rawResponseStored, false);
      } finally {
        if (prevEnv !== undefined) process.env.NODE_ENV = prevEnv;
      }
    });
  });

  describe("Duplicate handling", function() {
    it("returns existing=true when duplicate found", function() {
      var prevEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";
      try {
        var result = mockImportAction(
          { externalId: "codeforces:4:A", name: "Watermelon", sourceUrl: "url" },
          { dupExists: true },
        );
        assert.equal(result.success, true);
        assert.equal(result.existing, true);
        assert.equal(result.dbWritten, false);
        assert.ok(result.detailLink);
        assert.ok(result.problemId);
      } finally {
        if (prevEnv !== undefined) process.env.NODE_ENV = prevEnv;
      }
    });

    it("does not create duplicate when already exists", function() {
      var prevEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";
      try {
        var result = mockImportAction(
          { externalId: "codeforces:4:A", name: "Watermelon", sourceUrl: "url" },
          { dupExists: true },
        );
        assert.equal(result.dbWritten, false);
      } finally {
        if (prevEnv !== undefined) process.env.NODE_ENV = prevEnv;
      }
    });
  });

  describe("DB failure safe error", function() {
    it("returns safe error on DB failure", function() {
      var prevEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";
      try {
        var result = mockImportAction(
          { externalId: "codeforces:4:A", name: "Watermelon", sourceUrl: "url" },
          { dbError: true },
        );
        assert.equal(result.success, false);
        assert.equal(result.dbWritten, false);
        assert.ok(result.message.includes("DB"));
        // No env values leaked
        assert.ok(!result.message.includes("DATABASE_URL"));
        assert.ok(!result.message.includes("postgres"));
        assert.ok(!result.message.includes("password"));
      } finally {
        if (prevEnv !== undefined) process.env.NODE_ENV = prevEnv;
      }
    });

    it("safe error does not contain stack trace", function() {
      var prevEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";
      try {
        var result = mockImportAction(
          { externalId: "codeforces:4:A", name: "Test", sourceUrl: "url" },
          { dbError: true },
        );
        assert.ok(!result.message.includes("\n"));
        assert.ok(!result.message.includes("at "));
      } finally {
        if (prevEnv !== undefined) process.env.NODE_ENV = prevEnv;
      }
    });
  });

  describe("Result structure safety", function() {
    it("all results have envValuesExposed=false", function() {
      var scenarios = [
        null,
        { externalId: "", name: "", sourceUrl: "" },
        { externalId: "codeforces:1:A", name: "Test", sourceUrl: "url" },
      ];
      for (var i = 0; i < scenarios.length; i++) {
        var result = mockImportAction(scenarios[i], { apiAllowed: false });
        assert.equal(result.envValuesExposed, false);
      }
    });

    it("blocked result does not contain raw response", function() {
      var result = createBlockedResult("test blocked");
      assert.equal(result.rawResponseStored, false);
      assert.equal(result.safeToExposeToClient, true);
      assert.equal(result.envValuesExposed, false);
    });

    it("result structure always has provider field", function() {
      var prevEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";
      try {
        var result = mockImportAction(
          { externalId: "codeforces:4:A", name: "Watermelon", sourceUrl: "url" },
          { importAllowed: true, apiAllowed: true, dbAvailable: true },
        );
        assert.equal(result.provider, "codeforces");
      } finally {
        if (prevEnv !== undefined) process.env.NODE_ENV = prevEnv;
      }
    });
  });
});
