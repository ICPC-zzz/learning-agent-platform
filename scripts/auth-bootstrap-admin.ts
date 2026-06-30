import {
  disconnectPrismaClient,
  getPrismaClient,
  PrismaAuthAuditRepository,
  PrismaUserRepository,
} from "@learning-agent-platform/db";

async function main() {
  const emails = parseEmailList(process.env.LAP_ADMIN_EMAILS);
  if (emails.length === 0) {
    console.log("No LAP_ADMIN_EMAILS configured. No users were changed.");
    return;
  }

  const userRepository = new PrismaUserRepository(getPrismaClient());
  const auditRepository = new PrismaAuthAuditRepository(getPrismaClient());
  let promoted = 0;
  let missing = 0;

  for (const email of emails) {
    const user = await userRepository.getUserByEmail(email);
    if (!user) {
      missing += 1;
      console.log(`Skipped missing user: ${email}`);
      continue;
    }
    if (user.role !== "ADMIN") {
      await userRepository.updateUser(user.id, { role: "ADMIN" });
      promoted += 1;
      await auditRepository.recordEvent({
        userId: user.id,
        eventType: "auth_role_changed",
        result: "success",
        errorCode: null,
        sourceSummary: "bootstrap-admin",
      });
    }
  }

  console.log(`Admin bootstrap complete. promoted=${promoted} missing=${missing}`);
}

function parseEmailList(value: string | undefined): string[] {
  if (!value) return [];
  return Array.from(new Set(value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item))));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrismaClient().catch(() => undefined);
  });
