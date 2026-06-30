import type { PrismaClient } from "@prisma/client";

import type {
  CreateEmailOtpInput,
  EmailOtpPurpose,
  EmailOtpRecordSafe,
  EmailOtpRepository,
} from "../types.js";
import { VALID_EMAIL_OTP_PURPOSES } from "../types.js";

export class PrismaEmailOtpRepository implements EmailOtpRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createEmailOtp(input: CreateEmailOtpInput): Promise<EmailOtpRecordSafe> {
    const email = normalizeEmail(input.email);
    const purpose = validatePurpose(input.purpose);
    if (input.codeHash.trim().length === 0) throw new Error("codeHash is required.");
    if (!(input.expiresAt instanceof Date) || Number.isNaN(input.expiresAt.getTime())) {
      throw new Error("expiresAt must be a valid Date.");
    }

    const record = await this.prisma.emailOtpCode.create({
      data: {
        email,
        codeHash: input.codeHash,
        purpose,
        expiresAt: input.expiresAt,
      },
    });
    return toSafeRecord(record);
  }

  async findLatestActiveEmailOtp(email: string, purpose: EmailOtpPurpose): Promise<EmailOtpRecordSafe | null> {
    const record = await this.prisma.emailOtpCode.findFirst({
      where: {
        email: normalizeEmail(email),
        purpose: validatePurpose(purpose),
        expiresAt: { gt: new Date() },
        consumedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });
    return record ? toSafeRecord(record) : null;
  }

  async consumeActiveEmailOtps(email: string, purpose: EmailOtpPurpose): Promise<number> {
    const result = await this.prisma.emailOtpCode.updateMany({
      where: {
        email: normalizeEmail(email),
        purpose: validatePurpose(purpose),
        consumedAt: null,
      },
      data: { consumedAt: new Date() },
    });
    return result.count;
  }

  async markEmailOtpConsumed(id: string): Promise<EmailOtpRecordSafe | null> {
    const normalizedId = id.trim();
    if (normalizedId.length === 0) return null;
    try {
      const record = await this.prisma.emailOtpCode.update({
        where: { id: normalizedId },
        data: { consumedAt: new Date() },
      });
      return toSafeRecord(record);
    } catch {
      return null;
    }
  }

  async incrementEmailOtpAttempts(id: string): Promise<EmailOtpRecordSafe | null> {
    const normalizedId = id.trim();
    if (normalizedId.length === 0) return null;
    try {
      const record = await this.prisma.emailOtpCode.update({
        where: { id: normalizedId },
        data: { attemptCount: { increment: 1 } },
      });
      return toSafeRecord(record);
    } catch {
      return null;
    }
  }

  async deleteExpiredEmailOtps(): Promise<number> {
    const result = await this.prisma.emailOtpCode.deleteMany({
      where: {
        OR: [
          { expiresAt: { lte: new Date() } },
          { consumedAt: { not: null } },
        ],
      },
    });
    return result.count;
  }

  async getEmailOtpById(id: string): Promise<EmailOtpRecordSafe | null> {
    const normalizedId = id.trim();
    if (normalizedId.length === 0) return null;
    const record = await this.prisma.emailOtpCode.findUnique({
      where: { id: normalizedId },
    });
    return record ? toSafeRecord(record) : null;
  }

  async getCodeHashForVerification(id: string): Promise<string | null> {
    const normalizedId = id.trim();
    if (normalizedId.length === 0) return null;
    const record = await this.prisma.emailOtpCode.findUnique({
      where: { id: normalizedId },
      select: { codeHash: true },
    });
    return record?.codeHash ?? null;
  }
}

function normalizeEmail(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) throw new Error("Email is required.");
  return normalized;
}

function validatePurpose(purpose: string): EmailOtpPurpose {
  if (!VALID_EMAIL_OTP_PURPOSES.has(purpose as EmailOtpPurpose)) {
    throw new Error(`Invalid OTP purpose: ${purpose}.`);
  }
  return purpose as EmailOtpPurpose;
}

function toSafeRecord(record: {
  id: string;
  email: string;
  purpose: string;
  expiresAt: Date;
  consumedAt: Date | null;
  attemptCount: number;
  createdAt: Date;
  updatedAt: Date;
}): EmailOtpRecordSafe {
  return {
    id: record.id,
    email: record.email,
    purpose: validatePurpose(record.purpose),
    expiresAt: record.expiresAt,
    consumedAt: record.consumedAt,
    attemptCount: record.attemptCount,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
