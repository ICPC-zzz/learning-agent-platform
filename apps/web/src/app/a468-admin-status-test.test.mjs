import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __d = dirname(fileURLToPath(import.meta.url));
const ap = resolve(__d, "../lib/admin-status-center.ts");

let passed = 0, failed = 0;
function test(n, fn) { try { fn(); passed++; console.log("  PASS " + n); } catch (e) { failed++; console.log("  FAIL " + n + "\n    " + e.message); } }

console.log("\nA468 Admin Status Test\n");

let ac;
try { ac = readFileSync(ap, "utf-8"); } catch(e) { console.log("  Cannot read admin: " + e.message); }

test("Admin imports getEmailOtpGuardStatus", () => { if (!ac || !ac.includes("getEmailOtpGuardStatus")) throw new Error("Missing import"); });
test("Admin has email-auth.otp_storage", () => { if (!ac || !ac.includes("email-auth.otp_storage")) throw new Error("Missing otp_storage"); });
test("Admin has email-auth.otp_guard", () => { if (!ac || !ac.includes("email-auth.otp_guard")) throw new Error("Missing otp_guard"); });
test("Admin has email-auth.sends_email", () => { if (!ac || !ac.includes("email-auth.sends_email")) throw new Error("Missing sends_email"); });
test("Admin mentions A468", () => { if (!ac || !ac.includes("A468")) throw new Error("Missing A468"); });
test("Admin mentions sendsEmail", () => { if (!ac || !ac.includes("sendsEmail")) throw new Error("Missing sendsEmail"); });
test("Admin refs A469/A470", () => { if (!ac) return; if (!ac.includes("A469") && !ac.includes("A470")) throw new Error("Missing next rounds"); });
test("Admin no API keys", () => { if (!ac) return; if (/re_[a-zA-Z0-9]{20,}/.test(ac) || /sk-[a-zA-Z0-9]{20,}/.test(ac)) throw new Error("API key pattern"); });
test("Admin no DB URLs", () => { if (!ac) return; if (ac.includes("postgres://") || ac.includes("postgresql://")) throw new Error("DB URL"); });
test("Admin has book-api", () => { if (!ac || !ac.includes("book-api.guard")) throw new Error("book-api missing"); });
test("Admin has problem-api", () => { if (!ac || !ac.includes("problem-api.guard")) throw new Error("problem-api missing"); });
test("Admin has phone-auth", () => { if (!ac || !ac.includes("phone-auth.guard")) throw new Error("phone-auth missing"); });

console.log("\n" + passed + " passed, " + failed + " failed\n");
if (failed > 0) process.exit(1);
