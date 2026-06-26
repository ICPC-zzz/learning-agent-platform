/**
 * A468 Email OTP Guard Test (Source-level)
 * Tests web-auth-email-otp-guard.ts structure and safety.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../../../..");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); passed++; console.log("  PASS " + name); }
  catch (err) { failed++; console.log("  FAIL " + name + "\n    " + err.message); }
}

console.log("\nA468 Email OTP Guard Test (Source-level)\n");

const guardPath = resolve(projectRoot, "apps/web/src/lib/web-auth-email-otp-guard.ts");
let guardContent;
try { guardContent = readFileSync(guardPath, "utf-8"); } catch (e) {
  console.log("  Cannot read guard: " + e.message);
}

test("Guard file exists", () => {
  if (!guardContent) throw new Error("File not found");
});

test("Guard exports getEmailOtpGuardStatus", () => {
  if (!guardContent || !guardContent.includes("getEmailOtpGuardStatus")) throw new Error("Missing export");
});

test("Guard exports isEmailOtpAllowed", () => {
  if (!guardContent || !guardContent.includes("isEmailOtpAllowed")) throw new Error("Missing export");
});

test("Guard exports emailOtpGuardStatusIsSafe", () => {
  if (!guardContent || !guardContent.includes("emailOtpGuardStatusIsSafe")) throw new Error("Missing export");
});

test("Guard uses LAP_ALLOW_DEV_EMAIL_OTP env var", () => {
  if (!guardContent || !guardContent.includes("LAP_ALLOW_DEV_EMAIL_OTP")) throw new Error("Missing env var name");
});

test("Guard has production check", () => {
  if (!guardContent || !guardContent.includes("NODE_ENV") || !guardContent.includes("production")) throw new Error("No production check");
});

test("Guard provider is resend", () => {
  if (!guardContent || !guardContent.includes('"resend"')) throw new Error("Provider not resend");
});

test("Guard sendsEmail is false", () => {
  if (!guardContent || !guardContent.includes("sendsEmail")) throw new Error("Missing sendsEmail field");
  // Verify it defaults to false before env-based opt-in.
  if (guardContent && !guardContent.includes("let sendsEmail = false")) throw new Error("sendsEmail should default to false");
});

test("Guard devOnly is true", () => {
  if (!guardContent || !guardContent.includes("devOnly: true")) throw new Error("devOnly should be true");
});

test("Guard status type includes all required fields", () => {
  if (!guardContent) return;
  const fields = ["enabled", "blocked", "reason", "requiredEnvNames", "configuredEnvNames", "missingEnvNames", "devOnly", "productionBlocked", "provider", "sendsEmail"];
  for (const f of fields) {
    if (!guardContent.includes(f)) throw new Error("Missing field: " + f);
  }
});

test("Guard status does NOT expose env values in return", () => {
  if (!guardContent) return;
  // The return block should not contain process.env references
  const returnBlocks = guardContent.split("return {");
  for (let i = 1; i < returnBlocks.length; i++) {
    if (returnBlocks[i].includes("process.env")) {
      throw new Error("Return block contains process.env reference");
    }
  }
});

test("Guard safety check rejects secrets", () => {
  if (!guardContent) return;
  if (!guardContent.includes("RESEND_API_KEY")) throw new Error("Safety check should catch RESEND_API_KEY");
  if (!guardContent.includes("DATABASE_URL")) throw new Error("Safety check should catch DATABASE_URL");
});

test("Guard blocks by default (env var not set → blocked)", () => {
  if (!guardContent) return;
  if (!guardContent.includes("not true") && !guardContent.includes("disabled by default")) throw new Error("Should block by default");
});

test("Guard productionBlocked reason contains PRODUCTION_BLOCKED", () => {
  if (!guardContent) return;
  if (!guardContent.includes("PRODUCTION_BLOCKED")) throw new Error("Missing PRODUCTION_BLOCKED reason");
});

console.log("\n" + passed + " passed, " + failed + " failed\n");
if (failed > 0) process.exit(1);
