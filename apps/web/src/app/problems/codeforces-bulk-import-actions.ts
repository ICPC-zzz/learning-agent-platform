"use server";

import type { ExternalApiDevGuardResult } from "@learning-agent-platform/shared";

export interface CodeforcesBulkImportInput {
  tag?: string;
  minRating?: number;
  maxRating?: number;
  maxCount?: number;
}

export interface CodeforcesBulkImportItemResult {
  externalId: string;
  name: string;
  rating?: number;
  tags: string[];
  status: "created" | "existing" | "failed";
  problemId: string | null;
  detailLink: string | null;
  message: string;
}

export interface CodeforcesBulkImportResult {
  success: boolean;
  created: number;
  existing: number;
  failed: number;
  items: CodeforcesBulkImportItemResult[];
  guard: ExternalApiDevGuardResult;
  guardBlocked: boolean;
  message: string;
  provider: "codeforces";
  productionReady: false;
  safeToExposeToClient: true;
  rawResponseStored: false;
  envValuesExposed: false;
}

export async function bulkImportCodeforcesAction(
  _input: CodeforcesBulkImportInput = {},
): Promise<CodeforcesBulkImportResult> {
  const guard = createSafeGuard();

  return {
    success: false,
    created: 0,
    existing: 0,
    failed: 0,
    items: [],
    guard,
    guardBlocked: true,
    message: "Codeforces 批量导入已移除，请直接在搜索结果中打开原题。",
    provider: "codeforces",
    productionReady: false,
    safeToExposeToClient: true,
    rawResponseStored: false,
    envValuesExposed: false,
  };
}

function createSafeGuard(): ExternalApiDevGuardResult {
  return {
    providerMode: "blocked",
    safeToExposeToClient: true,
    productionReady: false,
    allowed: false,
    blockedReason: "Codeforces 导入已移除",
    requiredEnvNames: [],
    configuredEnvNames: [],
    missingEnvNames: [],
  };
}
