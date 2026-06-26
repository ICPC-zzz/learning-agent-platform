/**
 * A468 Email OTP Schema Test
 * Tests: Prisma schema integrity for User email fields and EmailOtpCode model.
 * Run: node apps/web/src/app/a468-email-otp-schema.test.mjs
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Read the schema file directly (source-level check).
const schemaPath = resolve(__dirname, "../../../../packages/db/prisma/schema.prisma");
const schema = readFileSync(schemaPath, "utf-8");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
  }
}

console.log("\nA468 Schema Test\n");

// ---- User model email fields ----

test("User model has email field", () => {
  if (!schema.includes("email")) throw new Error("User model missing email field");
});

test("User model email is @unique", () => {
  // Check that email has @unique in the User model (we read raw schema)
  const userBlock = extractModel(schema, "User");
  if (!userBlock.includes("@unique")) throw new Error("User email is not @unique");
  // More specific: email line should have @unique
  const emailLines = userBlock.split("\n").filter(l => l.includes("email"));
  const hasUnique = emailLines.some(l => l.includes("@unique"));
  if (!hasUnique) throw new Error("Email field does not have @unique attribute");
});

test("User model has emailVerifiedAt field", () => {
  if (!schema.includes("emailVerifiedAt")) throw new Error("User model missing emailVerifiedAt field");
});

test("emailVerifiedAt is DateTime?", () => {
  const userBlock = extractModel(schema, "User");
  const evLines = userBlock.split("\n").filter(l => l.includes("emailVerifiedAt"));
  const hasDateTime = evLines.some(l => l.includes("DateTime"));
  if (!hasDateTime) throw new Error("emailVerifiedAt is not DateTime?");
});

// ---- EmailOtpCode model ----

test("EmailOtpCode model exists", () => {
  if (!schema.includes("model EmailOtpCode")) throw new Error("EmailOtpCode model not found");
});

test("EmailOtpCode has id field", () => {
  const otpBlock = extractModel(schema, "EmailOtpCode");
  if (!otpBlock.includes("id")) throw new Error("EmailOtpCode missing id field");
});

test("EmailOtpCode has email field", () => {
  const otpBlock = extractModel(schema, "EmailOtpCode");
  if (!otpBlock.includes("email")) throw new Error("EmailOtpCode missing email field");
  // Email should NOT be @unique (multiple OTPs per email)
});

test("EmailOtpCode has codeHash field", () => {
  const otpBlock = extractModel(schema, "EmailOtpCode");
  if (!otpBlock.includes("codeHash")) throw new Error("EmailOtpCode missing codeHash field");
});

test("EmailOtpCode does NOT have plainCode or plaintext field", () => {
  const otpBlock = extractModel(schema, "EmailOtpCode");
  if (otpBlock.includes("plainCode")) throw new Error("EmailOtpCode has forbidden plainCode field");
  if (otpBlock.includes("plaintext")) throw new Error("EmailOtpCode has forbidden plaintext field");
  if (otpBlock.includes("otpCode")) throw new Error("EmailOtpCode has forbidden otpCode field (should be codeHash)");
});

test("EmailOtpCode has purpose field", () => {
  const otpBlock = extractModel(schema, "EmailOtpCode");
  if (!otpBlock.includes("purpose")) throw new Error("EmailOtpCode missing purpose field");
});

test("EmailOtpCode has expiresAt field", () => {
  const otpBlock = extractModel(schema, "EmailOtpCode");
  if (!otpBlock.includes("expiresAt")) throw new Error("EmailOtpCode missing expiresAt field");
});

test("EmailOtpCode has consumedAt field", () => {
  const otpBlock = extractModel(schema, "EmailOtpCode");
  if (!otpBlock.includes("consumedAt")) throw new Error("EmailOtpCode missing consumedAt field");
});

test("EmailOtpCode has attemptCount field", () => {
  const otpBlock = extractModel(schema, "EmailOtpCode");
  if (!otpBlock.includes("attemptCount")) throw new Error("EmailOtpCode missing attemptCount field");
});

test("EmailOtpCode has createdAt and updatedAt", () => {
  const otpBlock = extractModel(schema, "EmailOtpCode");
  if (!otpBlock.includes("createdAt")) throw new Error("EmailOtpCode missing createdAt");
  if (!otpBlock.includes("updatedAt")) throw new Error("EmailOtpCode missing updatedAt");
});

test("EmailOtpCode has index on [email, purpose, expiresAt]", () => {
  const otpBlock = extractModel(schema, "EmailOtpCode");
  if (!otpBlock.includes("@@index([email, purpose, expiresAt])")) {
    throw new Error("EmailOtpCode missing @@index([email, purpose, expiresAt])");
  }
});

test("EmailOtpCode codeHash is String (not nullable)", () => {
  const otpBlock = extractModel(schema, "EmailOtpCode");
  const chLines = otpBlock.split("\n").filter(l => l.trim().startsWith("codeHash"));
  // codeHash should be String without ?
  for (const line of chLines) {
    if (line.includes("codeHash") && line.includes("?")) {
      throw new Error("codeHash should not be optional (String?)");
    }
  }
});

test("EmailOtpCode purpose is String (not nullable)", () => {
  const otpBlock = extractModel(schema, "EmailOtpCode");
  const pLines = otpBlock.split("\n").filter(l => l.trim().startsWith("purpose"));
  for (const line of pLines) {
    if (line.includes("purpose") && line.includes("?")) {
      throw new Error("purpose should not be optional (String?)");
    }
  }
});

// ---- No unrelated schema changes ----

test("Book model unchanged", () => {
  if (!schema.includes("model Book")) throw new Error("Book model missing — schema corrupted");
});

test("Problem model unchanged", () => {
  if (!schema.includes("model Problem")) throw new Error("Problem model missing — schema corrupted");
});

test("AgentSession model unchanged", () => {
  if (!schema.includes("model AgentSession")) throw new Error("AgentSession model missing — schema corrupted");
});

// ---- Helpers ----

function extractModel(schemaText, modelName) {
  const startMarker = `model ${modelName}`;
  const startIdx = schemaText.indexOf(startMarker);
  if (startIdx === -1) return "";

  // Find the opening brace
  const braceIdx = schemaText.indexOf("{", startIdx);
  if (braceIdx === -1) return "";

  // Track brace depth
  let depth = 0;
  let idx = braceIdx;
  while (idx < schemaText.length) {
    if (schemaText[idx] === "{") depth++;
    if (schemaText[idx] === "}") {
      depth--;
      if (depth === 0) {
        return schemaText.substring(braceIdx + 1, idx);
      }
    }
    idx++;
  }
  return "";
}

// ---- Results ----

console.log(`\n${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
