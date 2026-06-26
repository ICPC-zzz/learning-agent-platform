import type { DatabaseEnvStatus } from "./types.js";

// Safe process.env access — avoids @types/node dependency.
declare const process: { env: Record<string, string | undefined> };

const databaseUrlEnvKey = "DATABASE_URL";
const databaseProvider = "postgresql";

export function getDatabaseUrl(): string | undefined {
  const databaseUrl = process.env[databaseUrlEnvKey];
  if (databaseUrl === undefined || databaseUrl.trim().length === 0) {
    return undefined;
  }
  return databaseUrl;
}

export function hasDatabaseUrl(): boolean {
  return getDatabaseUrl() !== undefined;
}

export function assertDatabaseUrl(): string {
  const databaseUrl = getDatabaseUrl();
  if (databaseUrl === undefined) {
    throw new Error(
      "DATABASE_URL is required before using a configured Prisma database connection.",
    );
  }
  return databaseUrl;
}

export function getDatabaseEnvStatus(): DatabaseEnvStatus {
  const isConfigured = hasDatabaseUrl();
  return {
    hasDatabaseUrl: isConfigured,
    provider: databaseProvider,
    isConfigured,
  };
}
