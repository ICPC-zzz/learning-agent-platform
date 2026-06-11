/**
 * Problem Practice DB Actions Tests — standalone JS tests.
 * Verifies the action structure without importing TS source modules.
 */

import test from "node:test";
import { ok, equal } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

var __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// File existence
// ---------------------------------------------------------------------------

test("problem-practice-db-actions.ts file exists", function () {
  var path = resolve(__dirname, "problem-practice-db-actions.ts");
  ok(readFileSync(path, "utf-8").length > 0, "file should exist and be non-empty");
});

// ---------------------------------------------------------------------------
// Source code structure checks
// ---------------------------------------------------------------------------

test("actions file exports doRecordPracticeActivity", function () {
  var source = readFileSync(resolve(__dirname, "problem-practice-db-actions.ts"), "utf-8");
  ok(source.indexOf("doRecordPracticeActivity") >= 0, "should export doRecordPracticeActivity");
});

test("actions file exports doRemovePracticeActivity", function () {
  var source = readFileSync(resolve(__dirname, "problem-practice-db-actions.ts"), "utf-8");
  ok(source.indexOf("doRemovePracticeActivity") >= 0, "should export doRemovePracticeActivity");
});

test("actions file uses PrismaProblemPracticeRepository", function () {
  var source = readFileSync(resolve(__dirname, "problem-practice-db-actions.ts"), "utf-8");
  ok(source.indexOf("PrismaProblemPracticeRepository") >= 0,
    "should use PrismaProblemPracticeRepository");
  ok(source.indexOf("new PrismaProblemPracticeRepository") >= 0,
    "should construct PrismaProblemPracticeRepository");
});

test("actions file has blocked guard check", function () {
  var source = readFileSync(resolve(__dirname, "problem-practice-db-actions.ts"), "utf-8");
  ok(source.indexOf("guard.enabled") >= 0, "should check guard.enabled");
  ok(source.indexOf("writesDatabase") >= 0, "should set writesDatabase");
  ok(source.indexOf("reasonCode") >= 0, "should set reasonCode");
});

test("actions file has status validation", function () {
  var source = readFileSync(resolve(__dirname, "problem-practice-db-actions.ts"), "utf-8");
  ok(source.indexOf("VALID_STATUSES") >= 0, "should have VALID_STATUSES");
  ok(source.indexOf("validatePracticeInput") >= 0, "should have input validation");
});

test("actions file has DANGEROUS_FIELD_PATTERNS", function () {
  var source = readFileSync(resolve(__dirname, "problem-practice-db-actions.ts"), "utf-8");
  ok(source.indexOf("DANGEROUS_FIELD_PATTERNS") >= 0, "should have dangerous field detection");
});

test("actions file has error sanitization", function () {
  var source = readFileSync(resolve(__dirname, "problem-practice-db-actions.ts"), "utf-8");
  ok(source.indexOf("mapActionError") >= 0, "should have error mapping");
});

// ---------------------------------------------------------------------------
// Safety checks
// ---------------------------------------------------------------------------

test("actions source has no hardcoded DATABASE_URL", function () {
  var source = readFileSync(resolve(__dirname, "problem-practice-db-actions.ts"), "utf-8");
  ok(source.indexOf("DATABASE_URL") < 0, "no DATABASE_URL literal in source");
});

test("actions source has no hardcoded secrets", function () {
  var source = readFileSync(resolve(__dirname, "problem-practice-db-actions.ts"), "utf-8");
  ok(source.indexOf("postgres://") < 0, "no postgres URL in source");
});

test("actions file exports safety check helper", function () {
  var source = readFileSync(resolve(__dirname, "problem-practice-db-actions.ts"), "utf-8");
  ok(source.indexOf("problemPracticeDbActionResultIsSafe") >= 0,
    "should export safety check helper");
});

// ---------------------------------------------------------------------------
// Production readiness checks
// ---------------------------------------------------------------------------

test("actions file always sets productionReady: false", function () {
  var source = readFileSync(resolve(__dirname, "problem-practice-db-actions.ts"), "utf-8");
  ok(source.indexOf("productionReady: false") >= 0, "should always set productionReady: false");
  ok(source.indexOf("productionReady: true") < 0, "should never set productionReady: true");
});

test("actions file always sets devOnly: true", function () {
  var source = readFileSync(resolve(__dirname, "problem-practice-db-actions.ts"), "utf-8");
  ok(source.indexOf("devOnly: true") >= 0, "should always set devOnly: true");
});

// ---------------------------------------------------------------------------
// No misleading labels
// ---------------------------------------------------------------------------

test("actions source has no production labels", function () {
  var source = readFileSync(resolve(__dirname, "problem-practice-db-actions.ts"), "utf-8");
  ok(source.indexOf("真实判题已接入") < 0, "no real judge label");
  ok(source.indexOf("生产同步成功") < 0, "no production sync label");
  ok(source.indexOf("云端保存完成") < 0, "no cloud save label");
  ok(source.indexOf("正式用户题库") < 0, "no production user label");
});

// ---------------------------------------------------------------------------
// Practice status validation
// ---------------------------------------------------------------------------

test("actions validates status enum values", function () {
  var source = readFileSync(resolve(__dirname, "problem-practice-db-actions.ts"), "utf-8");
  ok(source.indexOf("not-started") >= 0, "should allow not-started");
  ok(source.indexOf("practiced") >= 0, "should allow practiced");
  ok(source.indexOf("completed") >= 0, "should allow completed");
  ok(source.indexOf("needs-review") >= 0, "should allow needs-review");
});

test("actions has safeDifficulty function", function () {
  var source = readFileSync(resolve(__dirname, "problem-practice-db-actions.ts"), "utf-8");
  ok(source.indexOf("safeDifficulty") >= 0, "should have safeDifficulty");
});

// ---------------------------------------------------------------------------
// Repository usage
// ---------------------------------------------------------------------------

test("actions file calls repository.recordPractice", function () {
  var source = readFileSync(resolve(__dirname, "problem-practice-db-actions.ts"), "utf-8");
  ok(source.indexOf("recordPractice") >= 0, "should call recordPractice");
});

test("actions file calls repository.removeProblemPractice", function () {
  var source = readFileSync(resolve(__dirname, "problem-practice-db-actions.ts"), "utf-8");
  ok(source.indexOf("removeProblemPractice") >= 0, "should call removeProblemPractice");
});
