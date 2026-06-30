import type { PrismaClient } from "@prisma/client";

import type {
  AuthAuditEventRecord,
  AuthAuditRepository,
  CreateAuthAuditEventInput,
} from "../types.js";

interface AuthAuditDelegate {
  create(args: Record<string, unknown>): Promise<AuthAuditEventRecord>;
}

export class PrismaAuthAuditRepository implements AuthAuditRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async recordEvent(input: CreateAuthAuditEventInput): Promise<AuthAuditEventRecord> {
    const eventType = input.eventType.trim();
    if (eventType.length === 0) throw new Error("Auth event type is required.");
    const result = normalizeResult(input.result);
    const record = await this.delegate().create({
      data: {
        userId: normalizeOptionalText(input.userId),
        eventType,
        sourceSummary: normalizeOptionalText(input.sourceSummary),
        result,
        errorCode: normalizeOptionalText(input.errorCode),
      },
    });
    return record;
  }

  private delegate(): AuthAuditDelegate {
    return (this.prisma as unknown as { authAuditEvent: AuthAuditDelegate }).authAuditEvent;
  }
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeResult(value: string): "success" | "failure" | "blocked" {
  if (value === "success" || value === "failure" || value === "blocked") return value;
  return "failure";
}
