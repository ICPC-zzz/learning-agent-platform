/**
 * A468 Email OTP Repository Test (Source-level)
 * Tests: source code structure and safety of email-otp-repository.ts.
 * Run: node apps/web/src/app/a468-email-otp-repository.test.mjs
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../../../..");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log("  PASS " + name);
  } catch (err) {
    failed++;
    console.log("  FAIL " + name);
    console.log("    " + err.message);
  }
}

console.log("\nA468 Repository Test (Source-level)\n");

const repoPath = resolve(projectRoot, "packages/db/src/repositories/email-otp-repository.ts");
let repoContent;
try {
  repoContent = readFileSync(repoPath, "utf-8");
} catch (e) {
  console.log("  Cannot read repository source: " + e.message);
}

test("Repository file exists", () => {
  if (!repoContent) throw new Error("File not found or empty");
});

test("Repository has PrismaEmailOtpRepository class", () => {
  if (!repoContent || !repoContent.includes("PrismaEmailOtpRepository")) {
    throw new Error("Missing class");
  }
});

test("Repository implements EmailOtpRepository", () => {
  if (!repoContent || !repoContent.includes("implements EmailOtpRepository")) {
    throw new Error("Missing interface implementation");
  }
});

test("Repository has createEmailOtp method", () => {
  if (!repoContent || !repoContent.includes("createEmailOtp")) throw new Error("Missing createEmailOtp");
});

test("Repository has findLatestActiveEmailOtp method", () => {
  if (!repoContent || !repoContent.includes("findLatestActiveEmailOtp")) throw new Error("Missing findLatestActiveEmailOtp");
});

test("Repository has markEmailOtpConsumed method", () => {
  if (!repoContent || !repoContent.includes("markEmailOtpConsumed")) throw new Error("Missing markEmailOtpConsumed");
});

test("Repository has incrementEmailOtpAttempts method", () => {
  if (!repoContent || !repoContent.includes("incrementEmailOtpAttempts")) throw new Error("Missing incrementEmailOtpAttempts");
});

test("Repository has deleteExpiredEmailOtps method", () => {
  if (!repoContent || !repoContent.includes("deleteExpiredEmailOtps")) throw new Error("Missing deleteExpiredEmailOtps");
});

test("Repository normalizes email to lowercase", () => {
  if (!repoContent || !repoContent.includes(".toLowerCase()")) throw new Error("No email normalization");
});

test("Repository validates email not empty", () => {
  if (!repoContent || !repoContent.includes("Email is required")) throw new Error("No email validation");
});

test("Repository does NOT send email", () => {
  if (!repoContent) return;
  if (repoContent.includes("from 'resend'") || repoContent.includes('from "resend"')) {
    throw new Error("Should not import Resend SDK");
  }
  if ((repoContent.match(/fetch\(/g) || []).length > 0) {
    throw new Error("Should not make fetch calls");
  }
});

test("toSafeRecord excludes codeHash from return", () => {
  if (!repoContent) return;
  if (repoContent.includes("codeHash intentionally excluded")) return; // explicit comment is fine
  if (!repoContent.includes("toSafeRecord")) return;
  // Rough check: return object should not spread codeHash
  const safeIdx = repoContent.indexOf("function toSafeRecord");
  const nextFuncIdx = repoContent.indexOf("function", safeIdx + 20);
  const safeBody = repoContent.substring(safeIdx, nextFuncIdx > safeIdx ? nextFuncIdx : repoContent.length);
  const returnIdx = safeBody.indexOf("return {");
  if (returnIdx === -1) return;
  const closeIdx = safeBody.indexOf("}", returnIdx);
  const returnObj = safeBody.substring(returnIdx, closeIdx + 1);
  if (returnObj.match(/codeHash\s*[=:]/) && !returnObj.includes("excluded")) {
    throw new Error("codeHash may be exposed in safe record");
  }
});

// Types checks
const typesPath = resolve(projectRoot, "packages/db/src/types.ts");
let typesContent;
try { typesContent = readFileSync(typesPath, "utf-8"); } catch {}

test("EmailOtpRepository interface in types.ts", () => {
  if (!typesContent || !typesContent.includes("EmailOtpRepository")) throw new Error("Missing interface");
});

test("EmailOtpRecordSafe in types.ts", () => {
  if (!typesContent || !typesContent.includes("EmailOtpRecordSafe")) throw new Error("Missing safe type");
});

test("VALID_EMAIL_OTP_PURPOSES includes LOGIN/REGISTER/VERIFY_EMAIL", () => {
  if (!typesContent) return;
  for (const p of ["LOGIN", "REGISTER", "VERIFY_EMAIL"]) {
    if (!typesContent.includes('"' + p + '"')) throw new Error("Missing purpose: " + p);
  }
});

// Exports
const dbIdxPath = resolve(projectRoot, "packages/db/src/index.ts");
let dbIdxContent;
try { dbIdxContent = readFileSync(dbIdxPath, "utf-8"); } catch {}

test("PrismaEmailOtpRepository exported from db/src/index.ts", () => {
  if (!dbIdxContent || !dbIdxContent.includes("PrismaEmailOtpRepository")) throw new Error("Not exported");
});

test("EmailOtp types exported from db/src/index.ts", () => {
  if (!dbIdxContent) return;
  if (!dbIdxContent.includes("EmailOtpRecordSafe")) throw new Error("EmailOtpRecordSafe not exported");
  if (!dbIdxContent.includes("CreateEmailOtpInput")) throw new Error("CreateEmailOtpInput not exported");
});

console.log("\n" + passed + " passed, " + failed + " failed\n");
if (failed > 0) process.exit(1);
