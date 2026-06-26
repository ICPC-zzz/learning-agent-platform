/**
 * Email OTP Repository — uses real Prisma delegate (requires prisma generate/db push).
 *
 * After `npx prisma db push`, the generated Prisma client includes
 * the emailOtpCode delegate with full typed CRUD methods.
 * No raw SQL needed — the native engine works correctly with Next.js.
 *
 * @module email-otp-repository
 * @devOnly — A468/A471
 */

import type { PrismaClient } from "@prisma/client";

import type {
  CreateEmailOtpInput,
  EmailOtpPurpose,
  EmailOtpRecordSafe,
  EmailOtpRepository,
} from "../types.js";
import { VALID_EMAIL_OTP_PURPOSES } from "../types.js";

function normalizeEmail(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) throw new Error("Email is required.");
  return normalized;
}

function validatePurpose(purpose: string): EmailOtpPurpose {
  if (!VALID_EMAIL_OTP_PURPOSES.has(purpose as EmailOtpPurpose)) {
    throw new Error(`Invalid OTP purpose: ${purpose}. Must be one of: ${[...VALID_EMAIL_OTP_PURPOSES].join(", ")}`);
  }
  return purpose as EmailOtpPurpose;
}

function toSafeRecord(record: {
  id: string; email: string; codeHash: string; purpose: string;
  expiresAt: Date; consumedAt: Date | null;
  attemptCount: number; createdAt: Date; updatedAt: Date;
}): EmailOtpRecordSafe {
  return {
    id: record.id, email: record.email,
    purpose: record.purpose as EmailOtpPurpose,
    expiresAt: record.expiresAt, consumedAt: record.consumedAt,
    attemptCount: record.attemptCount,
    createdAt: record.createdAt, updatedAt: record.updatedAt,
  };
}

export class PrismaEmailOtpRepository implements EmailOtpRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async createEmailOtp(input: CreateEmailOtpInput): Promise<EmailOtpRecordSafe> {
    const email = normalizeEmail(input.email);
    const purpose = validatePurpose(input.purpose);
    if (!input.codeHash) throw new Error("codeHash is required.");
    if (!(input.expiresAt instanceof Date) || isNaN(input.expiresAt.getTime())) {
      throw new Error("expiresAt must be a valid Date.");
    }

    const record = await this.prisma.emailOtpCode.create({
      data: { email, codeHash: input.codeHash, purpose, expiresAt: input.expiresAt },
    });
    return toSafeRecord(record);
  }

  async findLatestActiveEmailOtp(email: string, purpose: EmailOtpPurpose): Promise<EmailOtpRecordSafe | null> {
    const normalizedEmail = normalizeEmail(email);
    const validatedPurpose = validatePurpose(purpose);
    const now = new Date();

    const record = await this.prisma.emailOtpCode.findFirst({
      where: { email: normalizedEmail, purpose: validatedPurpose, expiresAt: { gt: now }, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });
    return record ? toSafeRecord(record) : null;
  }

  async markEmailOtpConsumed(id: string): Promise<EmailOtpRecordSafe | null> {
    if (!id?.trim()) return null;
    try {
      return toSafeRecord(await this.prisma.emailOtpCode.update({
        where: { id: id.trim() }, data: { consumedAt: new Date() },
      }));
    } catch { return null; }
  }

  async incrementEmailOtpAttempts(id: string): Promise<EmailOtpRecordSafe | null> {
    if (!id?.trim()) return null;
    try {
      return toSafeRecord(await this.prisma.emailOtpCode.update({
        where: { id: id.trim() }, data: { attemptCount: { increment: 1 } },
      }));
    } catch { return null; }
  }

  async deleteExpiredEmailOtps(): Promise<number> {
    const now = new Date();
    const result = await this.prisma.emailOtpCode.deleteMany({
      where: { OR: [{ expiresAt: { lte: now } }, { consumedAt: { not: null } }] },
    });
    return result.count;
  }

  async getEmailOtpById(id: string): Promise<EmailOtpRecordSafe | null> {
    if (!id?.trim()) return null;
    const record = await this.prisma.emailOtpCode.findUnique({ where: { id: id.trim() } });
    return record ? toSafeRecord(record) : null;
  }

  async getCodeHashForVerification(id: string): Promise<string | null> {
    if (!id?.trim()) return null;
    try {
      const record = await this.prisma.emailOtpCode.findUnique({
        where: { id: id.trim() }, select: { codeHash: true },
      });
      return record?.codeHash ?? null;
    } catch { return null; }
  }
}
