"use server";

import type { ExternalApiDevGuardResult } from "@learning-agent-platform/shared";

interface DevImportGuardResult {
  allowed: boolean;
  blockedReason: string | null;
}

export interface CodeforcesImportInput {
  externalId: string;
  contestId?: number;
  index?: string;
  name: string;
  rating?: number;
  tags?: string[];
  solvedCount?: number;
  sourceUrl: string;
}

export interface CodeforcesImportResult {
  success: boolean;
  dbWritten: boolean;
  problemId: string | null;
  title: string | null;
  warnings: string[];
  detailLink: string | null;
  message: string;
  guard: ExternalApiDevGuardResult;
  guardBlocked: boolean;
  existing: boolean;
  provider: "codeforces";
  productionReady: false;
  safeToExposeToClient: true;
  rawResponseStored: false;
  envValuesExposed: false;
}

export async function evaluateDevProblemImportGuard(): Promise<DevImportGuardResult> {
  try {
    if (process.env.NODE_ENV === "production") {
      return {
        allowed: false,
        blockedReason: "PROBLEM_IMPORT_PRODUCTION_BLOCKED: Problem import is not available in production.",
      };
    }
  } catch {
    return {
      allowed: false,
      blockedReason: "PROBLEM_IMPORT_NODE_ENV_UNREADABLE: Cannot determine environment.",
    };
  }

  try {
    if (process.env.LAP_ALLOW_DEV_PROBLEM_IMPORT !== "true") {
      return {
        allowed: false,
        blockedReason: "DEV_PROBLEM_IMPORT_NOT_ENABLED: LAP_ALLOW_DEV_PROBLEM_IMPORT 未设置为 true。",
      };
    }
  } catch {
    return {
      allowed: false,
      blockedReason: "DEV_PROBLEM_IMPORT_NOT_ENABLED: 无法读取 LAP_ALLOW_DEV_PROBLEM_IMPORT 环境变量。",
    };
  }

  return { allowed: true, blockedReason: null };
}

export async function importCodeforcesProblemAction(
  input: CodeforcesImportInput | null,
): Promise<CodeforcesImportResult> {
  const guard = createSafeGuard();
  const message =
    input && input.sourceUrl
      ? "Codeforces 单题导入已移除。请直接打开原题页面。"
      : "Codeforces 单题导入已移除。";

  return createBlockedResult(message, guard);
}

function createSafeGuard(): ExternalApiDevGuardResult {
  return {
    allowed: false,
    providerMode: "blocked",
    productionReady: false,
    safeToExposeToClient: true,
    blockedReason: "Codeforces 导入已移除",
    requiredEnvNames: [],
    configuredEnvNames: [],
    missingEnvNames: [],
  };
}

function createBlockedResult(
  message: string,
  guard: ExternalApiDevGuardResult,
): CodeforcesImportResult {
  return {
    success: false,
    dbWritten: false,
    problemId: null,
    title: null,
    warnings: [],
    detailLink: null,
    message,
    guard,
    guardBlocked: true,
    existing: false,
    provider: "codeforces",
    productionReady: false,
    safeToExposeToClient: true,
    rawResponseStored: false,
    envValuesExposed: false,
  };
}
