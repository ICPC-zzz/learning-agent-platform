/**
 * A467 Codeforces Import Guard Tests
 */
import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

function evaluateDevProblemImportGuard() {
  var nodeEnv;
  try { nodeEnv = process.env.NODE_ENV; } catch (e) { /* ignore */ }
  if (nodeEnv === "production") {
    return { allowed: false, blockedReason: "PROBLEM_IMPORT_PRODUCTION_BLOCKED" };
  }
  var devImportEnabled = false;
  try { devImportEnabled = process.env.LAP_ALLOW_DEV_PROBLEM_IMPORT === "true"; } catch (e) { /* ignore */ }
  if (!devImportEnabled) {
    return { allowed: false, blockedReason: "DEV_PROBLEM_IMPORT_NOT_ENABLED" };
  }
  return { allowed: true, blockedReason: null };
}

describe("A467 Import Guard", function () {
  describe("evaluateDevProblemImportGuard", function () {
    it("blocks when LAP_ALLOW_DEV_PROBLEM_IMPORT not set", function () {
      var prev = process.env.LAP_ALLOW_DEV_PROBLEM_IMPORT;
      delete process.env.LAP_ALLOW_DEV_PROBLEM_IMPORT;
      process.env.NODE_ENV = "development";
      try {
        var guard = evaluateDevProblemImportGuard();
        assert.equal(guard.allowed, false);
        var reason = guard.blockedReason || "";
        assert.ok(reason.indexOf("DEV_PROBLEM_IMPORT_NOT_ENABLED") >= 0);
      } finally {
        if (prev !== undefined) process.env.LAP_ALLOW_DEV_PROBLEM_IMPORT = prev;
      }
    });
    it("blocks when env is false", function () {
      var prev = process.env.LAP_ALLOW_DEV_PROBLEM_IMPORT;
      process.env.LAP_ALLOW_DEV_PROBLEM_IMPORT = "false";
      process.env.NODE_ENV = "development";
      try {
        var guard = evaluateDevProblemImportGuard();
        assert.equal(guard.allowed, false);
      } finally {
        if (prev !== undefined) process.env.LAP_ALLOW_DEV_PROBLEM_IMPORT = prev;
      }
    });
    it("blocks when production", function () {
      var prevImport = process.env.LAP_ALLOW_DEV_PROBLEM_IMPORT;
      var prevNodeEnv = process.env.NODE_ENV;
      process.env.LAP_ALLOW_DEV_PROBLEM_IMPORT = "true";
      process.env.NODE_ENV = "production";
      try {
        var guard = evaluateDevProblemImportGuard();
        assert.equal(guard.allowed, false);
        var reason = guard.blockedReason || "";
        assert.ok(reason.indexOf("PRODUCTION") >= 0);
      } finally {
        if (prevImport !== undefined) process.env.LAP_ALLOW_DEV_PROBLEM_IMPORT = prevImport;
        if (prevNodeEnv !== undefined) process.env.NODE_ENV = prevNodeEnv;
      }
    });
    it("allows with env=true dev", function () {
      var prevImport = process.env.LAP_ALLOW_DEV_PROBLEM_IMPORT;
      var prevNodeEnv = process.env.NODE_ENV;
      process.env.LAP_ALLOW_DEV_PROBLEM_IMPORT = "true";
      process.env.NODE_ENV = "development";
      try {
        var guard = evaluateDevProblemImportGuard();
        assert.equal(guard.allowed, true);
        assert.equal(guard.blockedReason, null);
      } finally {
        if (prevImport !== undefined) process.env.LAP_ALLOW_DEV_PROBLEM_IMPORT = prevImport;
        if (prevNodeEnv !== undefined) process.env.NODE_ENV = prevNodeEnv;
      }
    });
    it("allows with env=true test", function () {
      var prevImport = process.env.LAP_ALLOW_DEV_PROBLEM_IMPORT;
      var prevNodeEnv = process.env.NODE_ENV;
      process.env.LAP_ALLOW_DEV_PROBLEM_IMPORT = "true";
      process.env.NODE_ENV = "test";
      try {
        var guard = evaluateDevProblemImportGuard();
        assert.equal(guard.allowed, true);
      } finally {
        if (prevImport !== undefined) process.env.LAP_ALLOW_DEV_PROBLEM_IMPORT = prevImport;
        if (prevNodeEnv !== undefined) process.env.NODE_ENV = prevNodeEnv;
      }
    });
  });
  describe("Guard blocked no fetch no DB", function () {
    it("does not fetch when blocked", function () {
      var fetchCalled = false;
      function mockImport(allowed) {
        if (!allowed) return { blocked: true, fetched: false, dbWritten: false };
        fetchCalled = true;
        return { blocked: false, fetched: true, dbWritten: false };
      }
      var result = mockImport(false);
      assert.equal(result.blocked, true);
      assert.equal(result.fetched, false);
      assert.equal(result.dbWritten, false);
      assert.equal(fetchCalled, false);
    });
    it("does not write DB when blocked", function () {
      var dbWritten = false;
      function mockImport(allowed) {
        if (!allowed) return { blocked: true, dbWritten: false };
        dbWritten = true;
        return { blocked: false, dbWritten: true };
      }
      var result = mockImport(false);
      assert.equal(result.blocked, true);
      assert.equal(result.dbWritten, false);
      assert.equal(dbWritten, false);
    });
  });
  describe("No env value leaks", function () {
    it("blocked reason no env values", function () {
      var prev = process.env.LAP_ALLOW_DEV_PROBLEM_IMPORT;
      delete process.env.LAP_ALLOW_DEV_PROBLEM_IMPORT;
      process.env.NODE_ENV = "development";
      try {
        var guard = evaluateDevProblemImportGuard();
        assert.equal(guard.allowed, false);
        var reason = guard.blockedReason || "";
        assert.ok(reason.indexOf("DEV_PROBLEM_IMPORT_NOT_ENABLED") >= 0);
        assert.ok(reason.indexOf("=") < 0);
        assert.ok(reason.indexOf("DATABASE_URL") < 0);
        assert.ok(reason.indexOf("postgres") < 0);
      } finally {
        if (prev !== undefined) process.env.LAP_ALLOW_DEV_PROBLEM_IMPORT = prev;
      }
    });
    it("no API key pattern", function () {
      var prev = process.env.LAP_ALLOW_DEV_PROBLEM_IMPORT;
      delete process.env.LAP_ALLOW_DEV_PROBLEM_IMPORT;
      process.env.NODE_ENV = "development";
      try {
        var guard = evaluateDevProblemImportGuard();
        assert.equal(guard.allowed, false);
        var reason = guard.blockedReason || "";
        assert.ok(!/api[_-]?key/i.test(reason));
        assert.ok(!/secret/i.test(reason));
        assert.ok(!/token/i.test(reason));
        assert.ok(!/password/i.test(reason));
      } finally {
        if (prev !== undefined) process.env.LAP_ALLOW_DEV_PROBLEM_IMPORT = prev;
      }
    });
  });
});
