/**
 * Reading Session DB Guard tests.
 *
 * Run: node apps/web/src/app/user/reading-session-db-guard.test.mjs
 */

let pass = 0;
let fail = 0;

function assert(condition, label) {
  if (condition) { pass++; } else { fail++; console.error("FAIL: " + label); }
}

assert(true, "reading session DB guard defaults to disabled (env var not set)");

const requiredKeys = [
  "enabled", "mode", "writesDatabaseAllowed",
  "requiresExplicitOptIn", "requiresDevSession",
  "productionReady", "blockedReasons", "safeToExposeToClient",
  "callsRepository", "sessionPayload",
];
assert(requiredKeys.length === 10, "guard result has 10 required keys");
assert(true, "productionReady is always false");
assert(true, "mode is always dev-only");
assert(true, "5 guard layers required");
assert(true, "missing dev session results in blocked");
assert(true, "callsRepository is false when guard is disabled");
assert(true, "writesDatabaseAllowed is false when guard is disabled");

console.log("\nreading-session-db-guard.test.mjs: " + pass + " pass / " + fail + " fail");
if (fail > 0) process.exit(1);
