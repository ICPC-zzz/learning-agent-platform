import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const configSource = readFileSync("apps/web/src/lib/email/email-runtime-config.ts", "utf8");
const doctorSource = readFileSync("scripts/email-doctor.ts", "utf8");

test("A524 email runtime config gives RESEND env priority over legacy LAP aliases", () => {
  assert.match(configSource, /\["RESEND_API_KEY",\s*"LAP_EMAIL_API_KEY"\]/);
  assert.match(configSource, /\["RESEND_FROM_EMAIL",\s*"LAP_EMAIL_FROM",\s*"EMAIL_FROM"\]/);
  assert.doesNotMatch(configSource, /\["LAP_EMAIL_API_KEY",\s*"RESEND_API_KEY"\]/);
  assert.doesNotMatch(configSource, /\["LAP_EMAIL_FROM",\s*"RESEND_FROM_EMAIL"/);
});

test("A524 email runtime config validates the exact Resend sender domain", () => {
  assert.match(configSource, /EXPECTED_RESEND_FROM_DOMAIN = "auth\.cfagent\.fun"/);
  assert.match(configSource, /unexpected_from_domain/);
  assert.match(configSource, /hasUnsafeWhitespace/);
  assert.match(configSource, /hasWrappingQuotes/);
});

test("A524 email runtime config loads root env fallback when Next runs from apps web cwd", () => {
  assert.match(configSource, /withLocalEmailEnvFallbacks/);
  assert.match(configSource, /apps\/web/);
  assert.match(configSource, /\.env\.local/);
  assert.match(configSource, /\.env\.production/);
});

test("A524 email doctor prints only safe presence and source summaries", () => {
  assert.match(doctorSource, /apiKeyPresent/);
  assert.match(doctorSource, /apiKeySource/);
  assert.match(doctorSource, /fromDomain/);
  assert.doesNotMatch(doctorSource, /console\.log\([^)]*apiKey\.value/);
  assert.doesNotMatch(doctorSource, /console\.log\([^)]*DATABASE_URL/);
});
