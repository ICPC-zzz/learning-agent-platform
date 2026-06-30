import type { PrismaClient } from "@prisma/client";

import type {
  CreateWebSessionInput,
  UserRole,
  WebSessionRecord,
  WebSessionRepository,
} from "../types.js";

type WebSessionDelegateRecord = Omit<WebSessionRecord, "user"> & {
  user?: {
    id: string;
    email: string | null;
    name: string | null;
    role: UserRole;
    disabledAt: Date | null;
  };
};

interface WebSessionDelegate {
  create(args: Record<string, unknown>): Promise<WebSessionDelegateRecord>;
  findFirst(args: Record<string, unknown>): Promise<WebSessionDelegateRecord | null>;
  update(args: Record<string, unknown>): Promise<WebSessionDelegateRecord>;
}

export class PrismaWebSessionRepository implements WebSessionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createSession(input: CreateWebSessionInput): Promise<WebSessionRecord> {
    const userId = normalizeRequiredText(input.userId, "User id is required.");
    const tokenHash = normalizeRequiredText(input.tokenHash, "Session token hash is required.");
    const expiresAt = normalizeRequiredDate(input.expiresAt, "Session expiry is required.");
    const record = await this.delegate().create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        userAgentHash: normalizeOptionalText(input.userAgentHash),
        ipHash: normalizeOptionalText(input.ipHash),
      },
      include: sessionInclude,
    });
    return toWebSessionRecord(record);
  }

  async findActiveSessionByTokenHash(tokenHash: string, now = new Date()): Promise<WebSessionRecord | null> {
    const normalizedTokenHash = normalizeRequiredText(tokenHash, "Session token hash is required.");
    const record = await this.delegate().findFirst({
      where: {
        tokenHash: normalizedTokenHash,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      include: sessionInclude,
    });
    return record ? toWebSessionRecord(record) : null;
  }

  async touchSession(sessionId: string, lastSeenAt = new Date()): Promise<WebSessionRecord | null> {
    try {
      const record = await this.delegate().update({
        where: { id: normalizeRequiredText(sessionId, "Session id is required.") },
        data: { lastSeenAt },
        include: sessionInclude,
      });
      return toWebSessionRecord(record);
    } catch {
      return null;
    }
  }

  async revokeSession(sessionId: string, revokedAt = new Date()): Promise<WebSessionRecord | null> {
    try {
      const record = await this.delegate().update({
        where: { id: normalizeRequiredText(sessionId, "Session id is required.") },
        data: { revokedAt },
        include: sessionInclude,
      });
      return toWebSessionRecord(record);
    } catch {
      return null;
    }
  }

  async revokeSessionByTokenHash(tokenHash: string, revokedAt = new Date()): Promise<WebSessionRecord | null> {
    try {
      const record = await this.delegate().update({
        where: { tokenHash: normalizeRequiredText(tokenHash, "Session token hash is required.") },
        data: { revokedAt },
        include: sessionInclude,
      });
      return toWebSessionRecord(record);
    } catch {
      return null;
    }
  }

  private delegate(): WebSessionDelegate {
    return (this.prisma as unknown as { webSession: WebSessionDelegate }).webSession;
  }
}

const sessionInclude = {
  user: {
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      disabledAt: true,
    },
  },
};

function toWebSessionRecord(record: WebSessionDelegateRecord): WebSessionRecord {
  return {
    id: record.id,
    userId: record.userId,
    tokenHash: record.tokenHash,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    lastSeenAt: record.lastSeenAt,
    revokedAt: record.revokedAt,
    userAgentHash: record.userAgentHash,
    ipHash: record.ipHash,
    ...(record.user
      ? {
          user: {
            id: record.user.id,
            email: record.user.email,
            name: record.user.name,
            role: record.user.role === "ADMIN" ? "ADMIN" : "USER",
            disabledAt: record.user.disabledAt,
          },
        }
      : {}),
  };
}

function normalizeRequiredText(value: string, message: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) throw new Error(message);
  return normalized;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeRequiredDate(value: Date, message: string): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) throw new Error(message);
  return value;
}
