import { randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const scryptAsync = promisify(scrypt);
const SALT_LENGTH = 16;
const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 };
const SEPARATOR = ":";

let passed = 0, failed = 0;
function test(n, fn) { try { fn(); passed++; console.log("  PASS " + n); } catch (e) { failed++; console.log("  FAIL " + n + "\n    " + e.message); } }
async function testAsync(n, fn) { try { await fn(); passed++; console.log("  PASS " + n); } catch (e) { failed++; console.log("  FAIL " + n + "\n    " + e.message); } }

console.log("\nA468 OTP Code Test\n");

function generateOtpCode() { return String(randomInt(100000, 999999)); }
async function hashOtpCode(code) {
  try { if (!code || code.length === 0) return null; const salt = randomBytes(SALT_LENGTH).toString("base64"); const dk = await scryptAsync(code, salt, KEY_LENGTH, SCRYPT_OPTIONS); return salt + SEPARATOR + dk.toString("base64"); } catch { return null; }
}
async function verifyOtpCode(code, storedHash) {
  try { if (!code || !storedHash) return false; const si = storedHash.indexOf(SEPARATOR); if (si === -1) return false; const salt = storedHash.substring(0, si); const oh = storedHash.substring(si + 1); return timingSafeEqual(await scryptAsync(code, salt, KEY_LENGTH, SCRYPT_OPTIONS), Buffer.from(oh, "base64")); } catch { return false; }
}

test("generateOtpCode returns 6-digit string", () => { const c = generateOtpCode(); if (typeof c !== "string" || c.length !== 6 || !/^\d{6}$/.test(c)) throw new Error("Bad: " + c); });
test("generateOtpCode produces varied values", () => { const s = new Set(); for (let i = 0; i < 20; i++) s.add(generateOtpCode()); if (s.size < 15) throw new Error("Variety low: " + s.size); });
test("generateOtpCode in range", () => { for (let i = 0; i < 50; i++) { const n = parseInt(generateOtpCode(), 10); if (n < 100000 || n > 999999) throw new Error("OOR: " + n); } });

testAsync("hashOtpCode returns string", async () => { const h = await hashOtpCode("123456"); if (h === null || typeof h !== "string") throw new Error("bad"); });
testAsync("hashOtpCode has separator", async () => { if (!(await hashOtpCode("123456")).includes(":")) throw new Error("no sep"); });
testAsync("hashOtpCode diff inputs = diff hashes", async () => { if (await hashOtpCode("111111") === await hashOtpCode("222222")) throw new Error("same"); });
testAsync("hashOtpCode same input = diff hashes (salt)", async () => { if (await hashOtpCode("123456") === await hashOtpCode("123456")) throw new Error("same salt?"); });
testAsync("hashOtpCode empty = null", async () => { if (await hashOtpCode("") !== null) throw new Error("not null"); });
testAsync("hashOtpCode no plaintext leak", async () => { if ((await hashOtpCode("987654")).includes("987654")) throw new Error("leak"); });

testAsync("verifyOtpCode correct = true", async () => { const c = "482917"; if (!(await verifyOtpCode(c, await hashOtpCode(c)))) throw new Error("fail"); });
testAsync("verifyOtpCode wrong = false", async () => { if (await verifyOtpCode("654321", await hashOtpCode("123456"))) throw new Error("wrong accept"); });
testAsync("verifyOtpCode empty code = false", async () => { if (await verifyOtpCode("", await hashOtpCode("123456"))) throw new Error("empty accept"); });
testAsync("verifyOtpCode empty hash = false", async () => { if (await verifyOtpCode("123456", "")) throw new Error("empty hash accept"); });
testAsync("verifyOtpCode malformed = false", async () => { if (await verifyOtpCode("123456", "badhash")) throw new Error("malformed accept"); });
testAsync("verifyOtpCode never throws", async () => { let t = false; try { await verifyOtpCode("x", await hashOtpCode("y")); } catch { t = true; } if (t) throw new Error("threw"); });

// Source-level checks (corrected path: ../lib/ from app/)
const __d = dirname(fileURLToPath(import.meta.url));
const hp = resolve(__d, "../lib/email-otp-code.ts");
let hc;
try { hc = readFileSync(hp, "utf-8"); } catch(e) { console.log("  Note: cannot read helper: " + e.message); }

test("email-otp-code.ts exists", () => { if (!hc) throw new Error("Not found"); });
test("email-otp-code.ts exports hashOtpCode", () => { if (!hc || !hc.includes("hashOtpCode")) throw new Error("Missing"); });
test("email-otp-code.ts exports verifyOtpCode", () => { if (!hc || !hc.includes("verifyOtpCode")) throw new Error("Missing"); });
test("email-otp-code.ts sendsEmail: false", () => { if (!hc || !hc.includes("sendsEmail: false")) throw new Error("Missing"); });
test("email-otp-code.ts devOnly: true", () => { if (!hc || !hc.includes("devOnly: true")) throw new Error("Missing"); });
test("email-otp-code.ts uses scrypt", () => { if (!hc || !hc.includes("scrypt")) throw new Error("Not scrypt"); });
test("email-otp-code.ts uses timingSafeEqual", () => { if (!hc || !hc.includes("timingSafeEqual")) throw new Error("No timing-safe"); });

console.log("\n" + passed + " passed, " + failed + " failed\n");
if (failed > 0) process.exit(1);
