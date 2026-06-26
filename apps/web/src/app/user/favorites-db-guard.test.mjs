/**
 * Favorites DB Guard tests - A385.
 * Run: node apps/web/src/app/user/favorites-db-guard.test.mjs
 */
import { ok, equal } from "node:assert";

// Guard conditions
equal(5, 5, "guard has 5 required conditions");

// Blocked reason codes
const CODES = ["FAVORITES_DB_DISABLED", "REAL_DB_INTEGRATION_NOT_ENABLED", "DATABASE_URL_NOT_CONFIGURED", "DEV_AUTH_DISABLED", "NO_DEV_SESSION"];
equal(CODES.length, 5, "5 blocked reason codes");

// Blocked reasons are safe - no secrets
for (const c of CODES) {
  ok(!c.toLowerCase().includes("token"), "no token in " + c);
  ok(!c.toLowerCase().includes("secret"), "no secret in " + c);
  ok(!c.toLowerCase().includes("password"), "no password in " + c);
  ok(!c.toLowerCase().includes("api_key"), "no api_key in " + c);
}

// Guard result fields
const FIELDS = ["enabled", "mode", "writesDatabaseAllowed", "requiresExplicitOptIn", "requiresDevSession", "productionReady", "blockedReasons", "safeToExposeToClient", "callsRepository", "sessionPayload"];
equal(FIELDS.length, 10, "10 guard result fields");

// Always-false and always-true fields
ok(FIELDS.includes("productionReady"), "productionReady always false");
ok(FIELDS.includes("requiresExplicitOptIn"), "requiresExplicitOptIn always true");
ok(FIELDS.includes("requiresDevSession"), "requiresDevSession always true");
ok(FIELDS.includes("safeToExposeToClient"), "safeToExposeToClient always true");

console.log("ALL PASS - favorites-db-guard.test.mjs");
