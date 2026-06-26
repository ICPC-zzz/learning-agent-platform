import { PrismaClient } from "@prisma/client";

export type PrismaClientOptions = ConstructorParameters<typeof PrismaClient>[0];

const prismaClientGlobalKey = "__learningAgentPlatformPrismaClient" as const;

type GlobalWithPrismaClient = typeof globalThis & {
  [prismaClientGlobalKey]?: PrismaClient;
};

function getGlobalPrismaClientCache(): GlobalWithPrismaClient {
  return globalThis as GlobalWithPrismaClient;
}

export function createPrismaClient(
  options?: PrismaClientOptions,
): PrismaClient {
  return new PrismaClient(options);
}

export function getPrismaClient(): PrismaClient {
  const globalCache = getGlobalPrismaClientCache();

  globalCache[prismaClientGlobalKey] ??= createPrismaClient();

  return globalCache[prismaClientGlobalKey];
}

export async function disconnectPrismaClient(
  client?: PrismaClient,
): Promise<void> {
  const globalCache = getGlobalPrismaClientCache();
  const targetClient = client ?? globalCache[prismaClientGlobalKey];

  if (targetClient === undefined) {
    return;
  }

  await targetClient.$disconnect();

  if (globalCache[prismaClientGlobalKey] === targetClient) {
    delete globalCache[prismaClientGlobalKey];
  }
}
