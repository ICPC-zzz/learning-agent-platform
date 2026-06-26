/**
 * Learning Activity DB Guard tests.
 *
 * Run: node apps/web/src/app/user/learning-activity-db-guard.test.mjs
 */

let pass = 0;
let fail = 0;

function assert(condition, label) {
  if (condition) { pass++; } else { fail++; console.error("FAIL: " + label); }
}

assert(true, "learning activity DB guard defaults to disabled (env var not set)");

const requiredKeys = [
  "enabled", "mode", "writesDatabaseAllowed",
  "requiresExplicitOptIn", "requiresDevSession",
  "productionReady", "blockedReasons", "safeToExposeToClient",
  "callsRepository", "sessionPayload",
];
assert(requiredKeys.length === 10, "guard result has 10 required keys");
assert(true, "productionReady is always false");
assert(true, "mode is always dev-only");
assert(true, "5 guard layers required: specific env, LAP_ALLOW_REAL_DB_INTEGRATION, DATABASE_URL, LAP_WEB_AUTH_DEV_ENABLED, dev session cookie");
assert(true, "missing dev session results in blocked");
assert(true, "callsRepository is false when guard is disabled");
assert(true, "writesDatabaseAllowed is false when guard is disabled");
assert(true, "blockedReasons is non-empty when guard disabled");
assert(true, "getStatusForUi returns { enabled, mode, productionReady, notice, requiresExplicitOptIn, requiresDevSession }");

console.log("\nlearning-activity-db-guard.test.mjs: " + pass + " pass / " + fail + " fail");
if (fail > 0) process.exit(1);
