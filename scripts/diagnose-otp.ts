/**
 * One-shot OTP diagnostic — tries to create an EmailOtpCode record directly.
 * Run: npx tsx scripts/diagnose-otp.ts
 */
import { getPrismaClient } from "../packages/db/src/client.js";
import { PrismaEmailOtpRepository } from "../packages/db/src/repositories/email-otp-repository.js";

async function main() {
  console.log("=== OTP Storage Diagnostic ===\n");

  // 1. Check DB connection
  console.log("1. Testing DB connection...");
  let prisma;
  try {
    prisma = getPrismaClient();
    await prisma.$queryRaw`SELECT 1 as ok`;
    console.log("   ✅ DB connected\n");
  } catch (e) {
    console.log("   ❌ DB connection failed:", String(e).slice(0, 200), "\n");
    return;
  }

  // 2. Check if emailOtpCode table exists
  console.log("2. Checking if EmailOtpCode table exists...");
  try {
    const result = await prisma.$queryRaw`SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'EmailOtpCode'
    )`;
    console.log("   Result:", JSON.stringify(result), "\n");
  } catch (e) {
    console.log("   ❌ Query failed:", String(e).slice(0, 200), "\n");
  }

  // 3. Check if prisma.emailOtpCode is available
  console.log("3. Checking prisma.emailOtpCode delegate...");
  try {
    const delegate = (prisma as any).emailOtpCode;
    if (delegate && typeof delegate.create === "function") {
      console.log("   ✅ emailOtpCode delegate exists\n");
    } else {
      console.log("   ❌ emailOtpCode delegate missing or not a function\n");
      console.log("   Available delegates:", Object.keys(prisma).filter(k => !k.startsWith('_') && !k.startsWith('$')).join(", "), "\n");
    }
  } catch (e) {
    console.log("   ❌ Check failed:", String(e).slice(0, 200), "\n");
  }

  // 4. Try creating a test record via repository
  console.log("4. Trying createEmailOtp via repository...");
  try {
    const repo = new PrismaEmailOtpRepository(prisma);
    const result = await repo.createEmailOtp({
      email: "diagnostic-test@example.com",
      codeHash: "test-hash-not-real",
      purpose: "LOGIN",
      expiresAt: new Date(Date.now() + 600000),
    });
    console.log("   ✅ Created:", JSON.stringify(result), "\n");

    // Cleanup
    await prisma.$executeRaw`DELETE FROM "EmailOtpCode" WHERE email = 'diagnostic-test@example.com'`;
    console.log("   ✅ Cleaned up test record\n");
  } catch (e) {
    console.log("   ❌ Create failed:", String(e).slice(0, 300), "\n");
  }

  console.log("=== Diagnostic complete ===");
  await prisma.$disconnect();
}

main().catch(console.error);
