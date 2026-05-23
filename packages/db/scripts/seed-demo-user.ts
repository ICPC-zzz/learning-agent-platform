/**
 * Minimal demo user seed script for local development preview.
 *
 * Creates or reuses a single demo user for Reader DB sync and other
 * dev-only database features.  This script is NOT production‑grade —
 * it intentionally skips auth, passwords, and role management.
 *
 * ## Usage
 *
 *   pnpm --filter @learning-agent-platform/db seed:demo-user
 *
 * Requires DATABASE_URL in the environment (no hardcoded fallback).
 *
 * Safety:
 * - Never outputs DATABASE_URL.
 * - Demo user is explicitly a development‑preview identity.
 * - No real passwords, tokens, or secrets are stored.
 */

import {
  createPrismaClient,
  disconnectPrismaClient,
  PrismaUserRepository,
} from "../src/index.js";

const demoEmail = "demo@example.com";
const demoName = "Demo User";
const demoAuthProvider = "demo";
const demoAuthProviderId = "demo-user";

async function main(): Promise<void> {
  const prisma = createPrismaClient();
  const userRepository = new PrismaUserRepository(prisma);

  try {
    const user = await userRepository.findOrCreateUser({
      email: demoEmail,
      name: demoName,
      authProvider: demoAuthProvider,
      authProviderId: demoAuthProviderId,
    });

    console.info("Demo user seed complete.");
    console.info(`  email : ${demoEmail}`);
    console.info(`  name  : ${user.name ?? "(not set)"}`);
    console.info(`  id    : ${user.id}`);
    console.info(
      "This user is a development-preview identity only.  It does not represent a real account.",
    );
  } finally {
    await disconnectPrismaClient(prisma);
  }
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : String(error);

  // Never output DATABASE_URL or full connection strings.
  const safeMessage = message.replace(
    /postgres(ql)?:\/\/[^\s]+/gi,
    "postgresql://***",
  );

  console.error("Failed to seed demo user:", safeMessage);
  process.exitCode = 1;
});
