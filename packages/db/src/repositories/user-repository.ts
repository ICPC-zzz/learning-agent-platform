import type { Prisma, PrismaClient } from "@prisma/client";

import type {
  CreateUserInput,
  FindUserInput,
  UpdateUserInput,
  UserRole,
  UserRecord,
  UserRepository,
} from "../types.js";

export class PrismaUserRepository implements UserRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async createUser(input: CreateUserInput): Promise<UserRecord> {
    const data: Prisma.UserCreateInput & Record<string, unknown> = {
      authProvider: normalizeOptionalText(input.authProvider),
      authProviderId: normalizeOptionalText(input.authProviderId),
      email: normalizeOptionalEmail(input.email),
      name: normalizeOptionalText(input.name),
    };
    const role = normalizeRole(input.role);
    if (role !== null) data.role = role;
    if (input.emailVerifiedAt !== undefined) data.emailVerifiedAt = normalizeOptionalDate(input.emailVerifiedAt);

    return this.prisma.user.create({ data });
  }

  async getUserById(userId: string): Promise<UserRecord | null> {
    const normalizedUserId = normalizeRequiredText(
      userId,
      "User id is required.",
    );

    return this.prisma.user.findUnique({
      where: { id: normalizedUserId },
    });
  }

  async getUserByEmail(email: string): Promise<UserRecord | null> {
    const normalizedEmail = normalizeRequiredEmail(email);

    return this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
  }

  async updateUser(
    userId: string,
    input: UpdateUserInput,
  ): Promise<UserRecord> {
    const normalizedUserId = normalizeRequiredText(
      userId,
      "User id is required.",
    );
    const data: Prisma.UserUpdateInput & Record<string, unknown> = {};

    if (input.email !== undefined) {
      data.email = normalizeOptionalEmail(input.email);
    }

    if (input.name !== undefined) {
      data.name = normalizeOptionalText(input.name);
    }

    if (input.role !== undefined) {
      data.role = normalizeRole(input.role) ?? "USER";
    }

    if (input.disabledAt !== undefined) {
      data.disabledAt = normalizeOptionalDate(input.disabledAt);
    }

    if (input.emailVerifiedAt !== undefined) {
      data.emailVerifiedAt = normalizeOptionalDate(input.emailVerifiedAt);
    }

    return this.prisma.user.update({
      where: { id: normalizedUserId },
      data,
    });
  }

  async findOrCreateUser(input: CreateUserInput): Promise<UserRecord> {
    const existingUser = await this.findUserByInput({
      email: input.email ?? undefined,
      authProvider: input.authProvider ?? undefined,
      authProviderId: input.authProviderId ?? undefined,
    });

    if (existingUser !== null) {
      return existingUser;
    }

    return this.createUser(input);
  }

  private async findUserByInput(
    input: FindUserInput,
  ): Promise<UserRecord | null> {
    const email = normalizeOptionalEmail(input.email);

    if (email !== null) {
      const user = await this.prisma.user.findUnique({
        where: { email },
      });

      if (user !== null) {
        return user;
      }
    }

    const authProvider = normalizeOptionalText(input.authProvider);
    const authProviderId = normalizeOptionalText(input.authProviderId);

    if (authProvider !== null && authProviderId !== null) {
      return this.prisma.user.findUnique({
        where: {
          authProvider_authProviderId: {
            authProvider,
            authProviderId,
          },
        },
      });
    }

    return null;
  }
}

function normalizeRequiredText(value: string, errorMessage: string): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new Error(errorMessage);
  }

  return normalized;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = value.trim();

  return normalized.length === 0 ? null : normalized;
}

function normalizeRequiredEmail(value: string): string {
  const normalizedEmail = value.trim().toLowerCase();

  if (normalizedEmail.length === 0) {
    throw new Error("User email is required.");
  }

  return normalizedEmail;
}

function normalizeOptionalEmail(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const normalizedEmail = value.trim().toLowerCase();

  return normalizedEmail.length === 0 ? null : normalizedEmail;
}

function normalizeRole(value: UserRole | null | undefined): UserRole | null {
  if (value === "ADMIN" || value === "USER") return value;
  return null;
}

function normalizeOptionalDate(value: Date | null | undefined): Date | null {
  if (value === undefined || value === null) return null;
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
  return value;
}
