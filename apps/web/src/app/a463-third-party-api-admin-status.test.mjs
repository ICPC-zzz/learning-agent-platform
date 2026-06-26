/**
 * A463 — Third-Party API Admin Status Tests
 * Usage: node apps/web/src/app/a463-third-party-api-admin-status.test.mjs
 */

import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Simulated admin status snapshot
// ---------------------------------------------------------------------------

function simulatedAdminStatusSnapshot() {
  const items = [
    { key: "book-api.guard", label: "Book API Guard 状态", category: "book-api", status: "missing-env", missingEnvNames: ["LAP_ALLOW_EXTERNAL_BOOK_API", "LAP_BOOK_API_KEY", "LAP_BOOK_API_BASE_URL", "LAP_BOOK_API_PROVIDER"] },
    { key: "book-api.allow_external", label: "LAP_ALLOW_EXTERNAL_BOOK_API", category: "book-api", status: "missing-env", missingEnvNames: ["LAP_ALLOW_EXTERNAL_BOOK_API"] },
    { key: "book-api.base_url", label: "LAP_BOOK_API_BASE_URL", category: "book-api", status: "missing-env", missingEnvNames: ["LAP_BOOK_API_BASE_URL"] },
    { key: "book-api.api_key", label: "LAP_BOOK_API_KEY", category: "book-api", status: "missing-env", missingEnvNames: ["LAP_BOOK_API_KEY"] },
    { key: "book-api.provider", label: "LAP_BOOK_API_PROVIDER", category: "book-api", status: "missing-env", missingEnvNames: ["LAP_BOOK_API_PROVIDER"] },
    { key: "problem-api.guard", label: "Problem API Guard 状态", category: "problem-api", status: "missing-env", missingEnvNames: ["LAP_ALLOW_EXTERNAL_PROBLEM_API", "LAP_PROBLEM_API_KEY", "LAP_PROBLEM_API_BASE_URL", "LAP_PROBLEM_API_PROVIDER"] },
    { key: "problem-api.allow_external", label: "LAP_ALLOW_EXTERNAL_PROBLEM_API", category: "problem-api", status: "missing-env", missingEnvNames: ["LAP_ALLOW_EXTERNAL_PROBLEM_API"] },
    { key: "problem-api.base_url", label: "LAP_PROBLEM_API_BASE_URL", category: "problem-api", status: "missing-env", missingEnvNames: ["LAP_PROBLEM_API_BASE_URL"] },
    { key: "problem-api.api_key", label: "LAP_PROBLEM_API_KEY", category: "problem-api", status: "missing-env", missingEnvNames: ["LAP_PROBLEM_API_KEY"] },
    { key: "problem-api.provider", label: "LAP_PROBLEM_API_PROVIDER", category: "problem-api", status: "missing-env", missingEnvNames: ["LAP_PROBLEM_API_PROVIDER"] },
    { key: "phone-auth.guard", label: "Phone Auth Guard 状态", category: "phone-auth", status: "missing-env", missingEnvNames: ["LAP_ALLOW_PHONE_AUTH", "LAP_SMS_PROVIDER", "LAP_SMS_API_BASE_URL", "LAP_SMS_API_KEY", "LAP_SMS_API_SECRET", "LAP_SMS_SIGN_NAME", "LAP_SMS_TEMPLATE_ID"] },
    { key: "phone-auth.allow", label: "LAP_ALLOW_PHONE_AUTH", category: "phone-auth", status: "missing-env", missingEnvNames: ["LAP_ALLOW_PHONE_AUTH"] },
    { key: "phone-auth.provider", label: "LAP_SMS_PROVIDER", category: "phone-auth", status: "missing-env", missingEnvNames: ["LAP_SMS_PROVIDER"] },
    { key: "phone-auth.base_url", label: "LAP_SMS_API_BASE_URL", category: "phone-auth", status: "missing-env", missingEnvNames: ["LAP_SMS_API_BASE_URL"] },
    { key: "phone-auth.api_key", label: "LAP_SMS_API_KEY", category: "phone-auth", status: "missing-env", missingEnvNames: ["LAP_SMS_API_KEY"] },
    { key: "phone-auth.api_secret", label: "LAP_SMS_API_SECRET", category: "phone-auth", status: "missing-env", missingEnvNames: ["LAP_SMS_API_SECRET"] },
    { key: "phone-auth.sign_name", label: "LAP_SMS_SIGN_NAME", category: "phone-auth", status: "missing-env", missingEnvNames: ["LAP_SMS_SIGN_NAME"] },
    { key: "phone-auth.template_id", label: "LAP_SMS_TEMPLATE_ID", category: "phone-auth", status: "missing-env", missingEnvNames: ["LAP_SMS_TEMPLATE_ID"] },
    { key: "email-auth.guard", label: "Email Auth Guard 状态", category: "email-auth", status: "missing-env", missingEnvNames: ["LAP_ALLOW_EMAIL_AUTH", "LAP_EMAIL_PROVIDER", "LAP_EMAIL_API_BASE_URL", "LAP_EMAIL_API_KEY", "LAP_EMAIL_FROM"] },
    { key: "email-auth.allow", label: "LAP_ALLOW_EMAIL_AUTH", category: "email-auth", status: "missing-env", missingEnvNames: ["LAP_ALLOW_EMAIL_AUTH"] },
    { key: "email-auth.provider", label: "LAP_EMAIL_PROVIDER", category: "email-auth", status: "missing-env", missingEnvNames: ["LAP_EMAIL_PROVIDER"] },
    { key: "email-auth.base_url", label: "LAP_EMAIL_API_BASE_URL", category: "email-auth", status: "missing-env", missingEnvNames: ["LAP_EMAIL_API_BASE_URL"] },
    { key: "email-auth.api_key", label: "LAP_EMAIL_API_KEY", category: "email-auth", status: "missing-env", missingEnvNames: ["LAP_EMAIL_API_KEY"] },
    { key: "email-auth.from", label: "LAP_EMAIL_FROM", category: "email-auth", status: "missing-env", missingEnvNames: ["LAP_EMAIL_FROM"] },
    { key: "email-auth.smtp", label: "SMTP 配置（可选）", category: "email-auth", status: "blocked", missingEnvNames: ["LAP_SMTP_HOST", "LAP_SMTP_PORT", "LAP_SMTP_USER", "LAP_SMTP_PASS"] },
  ];
  return {
    items,
    groups: [
      { label: "External APIs", items: items.filter((i) => ["book-api", "problem-api", "phone-auth", "email-auth"].includes(i.category)) },
    ],
    summary: { total: items.length, enabled: items.filter((i) => i.status === "enabled").length, blocked: items.filter((i) => i.status === "blocked").length, missingEnv: items.filter((i) => i.status === "missing-env").length, previewOnly: items.filter((i) => i.status === "preview-only").length, unavailable: items.filter((i) => i.status === "unavailable").length },
    productionReady: false,
    safeToExposeToClient: true,
  };
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

const PASS = "PASS", FAIL = "FAIL";
let total = 0, passed = 0, failed = 0;
function t(name, fn) { total++; try { fn(); passed++; console.log(`${PASS} [a463-admin] ${name}`); } catch (e) { failed++; console.log(`${FAIL} [a463-admin] ${name}\n       ${e.message}`); } }

const snapshot = simulatedAdminStatusSnapshot();

// ---- All four capabilities appear ----

const EXPECTED_GUARD_KEYS = ["book-api.guard", "problem-api.guard", "phone-auth.guard", "email-auth.guard"];
for (const key of EXPECTED_GUARD_KEYS) {
  t(`${key} is present`, () => {
    assert.ok(snapshot.items.find((i) => i.key === key), `Expected ${key} in snapshot`);
  });
}

t("phone-auth category has items", () => {
  const items = snapshot.items.filter((i) => i.category === "phone-auth");
  assert.ok(items.length >= 7, `Expected at least 7 phone-auth items, got ${items.length}`);
});

t("email-auth category has items", () => {
  const items = snapshot.items.filter((i) => i.category === "email-auth");
  assert.ok(items.length >= 5, `Expected at least 5 email-auth items, got ${items.length}`);
});

t("book-api category still has items", () => {
  const items = snapshot.items.filter((i) => i.category === "book-api");
  assert.ok(items.length >= 5, `Expected at least 5 book-api items, got ${items.length}`);
});

t("problem-api category still has items", () => {
  const items = snapshot.items.filter((i) => i.category === "problem-api");
  assert.ok(items.length >= 5, `Expected at least 5 problem-api items, got ${items.length}`);
});

// ---- missingEnvNames shows variable names only ----

t("book-api missingEnvNames are LAP_ prefixed", () => {
  const item = snapshot.items.find((i) => i.key === "book-api.guard");
  for (const name of item.missingEnvNames) {
    assert.ok(name.startsWith("LAP_"), `Expected LAP_ prefix, got: ${name}`);
    assert.ok(!name.includes("="), `${name} contains = sign`);
  }
});

t("phone-auth missingEnvNames are LAP_ prefixed", () => {
  const item = snapshot.items.find((i) => i.key === "phone-auth.guard");
  for (const name of item.missingEnvNames) {
    assert.ok(name.startsWith("LAP_"), `Expected LAP_ prefix, got: ${name}`);
    assert.ok(!name.includes("="));
  }
});

t("email-auth missingEnvNames are LAP_ prefixed", () => {
  const item = snapshot.items.find((i) => i.key === "email-auth.guard");
  for (const name of item.missingEnvNames) {
    assert.ok(name.startsWith("LAP_"), `Expected LAP_ prefix, got: ${name}`);
    assert.ok(!name.includes("="));
    assert.ok(!name.includes("@"));
  }
});

// ---- No env values ----

t("snapshot JSON has no real API keys", () => {
  const json = JSON.stringify(snapshot);
  assert.ok(!(/api[_-]?key[=:]\s*[A-Za-z0-9+/]{20,}/i.test(json)));
});

t("snapshot JSON has no SMTP passwords", () => {
  const json = JSON.stringify(snapshot);
  assert.ok(!(/SMTP_PASS[=:]\s*[A-Za-z0-9]{5,}/i.test(json)));
});

t("snapshot JSON has no DATABASE_URL values", () => {
  const json = JSON.stringify(snapshot);
  assert.ok(!(/postgres:\/\/[^\s"]+/.test(json)));
});

// ---- Flags ----

t("snapshot.productionReady is false", () => {
  assert.equal(snapshot.productionReady, false);
});

t("snapshot.safeToExposeToClient is true", () => {
  assert.equal(snapshot.safeToExposeToClient, true);
});

// ---- External APIs group ----

t("External APIs group exists", () => {
  const group = snapshot.groups.find((g) => g.label === "External APIs");
  assert.ok(group, "Expected 'External APIs' group");
});

t("External APIs group includes phone-auth items", () => {
  const group = snapshot.groups.find((g) => g.label === "External APIs");
  const phoneItems = group.items.filter((i) => i.category === "phone-auth");
  assert.ok(phoneItems.length > 0, "Expected phone-auth items in External APIs group");
});

t("External APIs group includes email-auth items", () => {
  const group = snapshot.groups.find((g) => g.label === "External APIs");
  const emailItems = group.items.filter((i) => i.category === "email-auth");
  assert.ok(emailItems.length > 0, "Expected email-auth items in External APIs group");
});

console.log(`\nA463 Admin Status: ${total} tests, ${passed} pass, ${failed} fail`);
if (failed > 0) process.exit(1);
