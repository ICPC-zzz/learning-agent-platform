"use server";

import {
  getPrismaClient,
  PrismaLearningRepository,
  type ProblemDifficulty,
} from "@learning-agent-platform/db";

import { getProblemApiPreviewStatus } from "../problems/problem-api-status";
import { evaluateImportDbPersistGuard } from "../import/text-import-db-persist-guard";
import { evaluateProblemImportEligibility } from "./problem-import-eligibility";

export interface ProblemApiImportInput {
  providerId: string;
  externalProblemId: string;
  title: string;
  difficulty: "easy" | "medium" | "hard" | "challenge" | "unknown";
  tags: string[];
  summary: string;
  sourceUrl: string;
  statement?: string;
  inputDescription?: string;
  outputDescription?: string;
  examples?: Array<{ input: string; output: string; explanation?: string; label?: string }>;
  judgeTestCases?: Array<{ input: string; output: string; explanation?: string; label?: string }>;
  constraints?: string;
  source?: string;
}

export interface ProblemApiImportResult {
  success: boolean;
  dbWritten: boolean;
  localProblemId: string | null;
  dbId: string | null;
  message: string;
  reasonCode: string;
  devOnly: true;
  productionReady: false;
  safeToExposeToClient: true;
  rawResponseStored: false;
  blockedReason: string | null;
  existing: boolean;
  existingDetailLink: string | null;
}

export async function importProblemApiItemAction(
  input: ProblemApiImportInput | null,
): Promise<ProblemApiImportResult> {
  const problemApiStatus = getProblemApiPreviewStatus();
  if (problemApiStatus.providerMode === "blocked") {
    return blockedResult(
      "Problem API is blocked. Cannot import.",
      "problem-api-blocked",
      problemApiStatus.blockedReason,
    );
  }

  if (safeReadNodeEnv() === "production") {
    return blockedResult(
      "Problem import is not available in production.",
      "production-blocked",
      "NODE_ENV is production",
    );
  }

  if (!input) {
    return blockedResult("No problem data provided.", "invalid-input", null);
  }

  const sanitizedTitle = input.title?.trim() ?? "";
  const trimmedSourceUrl = input.sourceUrl?.trim() ?? "";
  if (sanitizedTitle.length === 0 || trimmedSourceUrl.length === 0) {
    return blockedResult("Problem title and source URL are required.", "invalid-input", null);
  }

  const eligibility = evaluateProblemImportEligibility({
    title: input.title,
    summary: input.summary,
    statement: input.statement,
    inputDescription: input.inputDescription,
    outputDescription: input.outputDescription,
    examples: input.examples,
    constraints: input.constraints,
    source: input.source ?? input.providerId,
    sourceUrl: input.sourceUrl,
    tags: input.tags,
  });

  if (!eligibility.canImport) {
    return blockedResult(
      eligibility.blockedReason ?? "Problem does not meet the import requirements.",
      "not-importable",
      eligibility.blockedReason,
    );
  }

  const sanitizedDifficulty = normalizeDifficulty(input.difficulty);
  const sanitizedTags = normalizeTags(input.tags);
  const sanitizedSummary = input.summary.trim().slice(0, 500);
  const sanitizedStatement = (input.statement ?? "").trim().slice(0, 10000);
  const sanitizedInputDesc = (input.inputDescription ?? "").trim().slice(0, 2000);
  const sanitizedOutputDesc = (input.outputDescription ?? "").trim().slice(0, 2000);
  const sanitizedExamples = normalizeExamples(input.examples ?? []);
  const sanitizedJudgeTestCases = normalizeExamples(input.judgeTestCases ?? []);
  const sanitizedConstraints = (input.constraints ?? "").trim().slice(0, 2000);
  const sanitizedSourceUrl = trimmedSourceUrl.slice(0, 2000);
  const sanitizedSource = (input.source ?? input.providerId ?? "").trim().slice(0, 200);
  const now = new Date().toISOString();

  const dbGuard = evaluateImportDbPersistGuard();
  if (!dbGuard.enabled || !hasDatabaseUrl()) {
    return blockedResult(
      "DB persistence is disabled. Enable the local database guard before importing.",
      "db-persist-disabled",
      "DB write guard is disabled",
    );
  }

  let existingId: string | null = null;
  if (isDbReadAllowed()) {
    try {
      const repository = new PrismaLearningRepository(getPrismaClient());
      const existingList = await repository.listProblems({ limit: 20000 });
      const existingMatch = existingList.find((problem) => {
        if (!problem.metadata || typeof problem.metadata !== "object") {
          return false;
        }

        const meta = problem.metadata as Record<string, unknown>;
        return (
          typeof meta.providerId === "string" &&
          meta.providerId === input.providerId &&
          typeof meta.externalProblemId === "string" &&
          meta.externalProblemId === input.externalProblemId
        );
      });

      if (existingMatch) {
        existingId = existingMatch.id;
      }
    } catch {
      // Ignore duplicate lookup failures and continue to write attempt.
    }
  }

  if (existingId) {
    return {
      success: true,
      dbWritten: true,
      localProblemId: existingId,
      dbId: existingId,
      message: `题目已存在于数据库中（ID: ${existingId}）。未重复写入。`,
      reasonCode: "existing-db",
      devOnly: true,
      productionReady: false,
      safeToExposeToClient: true,
      rawResponseStored: false,
      blockedReason: null,
      existing: true,
      existingDetailLink: `/problems/${encodeURIComponent(existingId)}`,
    };
  }

  try {
    const repository = new PrismaLearningRepository(getPrismaClient());
    const problemRecord = await repository.createProblem({
      title: sanitizedTitle.slice(0, 200),
      description: sanitizedStatement || sanitizedSummary || null,
      difficulty: sanitizedDifficulty,
      tags: sanitizedTags,
      source: sanitizedSource ? `external-dev:${sanitizedSource}` : `external-dev:${input.providerId}`,
      sourceUrl: sanitizedSourceUrl || null,
      metadata: {
        importGuard: "dev-only",
        importedAt: now,
        providerId: input.providerId,
        externalProblemId: input.externalProblemId,
        notProduction: true,
        statement: sanitizedStatement || undefined,
        inputDescription: sanitizedInputDesc || undefined,
        outputDescription: sanitizedOutputDesc || undefined,
        examples: sanitizedExamples.length > 0 ? sanitizedExamples : undefined,
        judgeTestCases: sanitizedJudgeTestCases.length > 0 ? sanitizedJudgeTestCases : undefined,
        constraints: sanitizedConstraints || undefined,
        summary: sanitizedSummary || undefined,
        sourceUrl: sanitizedSourceUrl || undefined,
      },
    });

    return {
      success: true,
      dbWritten: true,
      localProblemId: problemRecord.id,
      dbId: problemRecord.id,
      message: `题目已导入到本地数据库。ID: ${problemRecord.id}`,
      reasonCode: "db-import-saved",
      devOnly: true,
      productionReady: false,
      safeToExposeToClient: true,
      rawResponseStored: false,
      blockedReason: null,
      existing: false,
      existingDetailLink: `/problems/${encodeURIComponent(problemRecord.id)}`,
    };
  } catch (error) {
    const safeMessage =
      error instanceof Error
        ? `DB write failed: ${redactSensitiveMessage(error.message)}`
        : "DB write failed: unknown error";

    return blockedResult(
      safeMessage,
      "db-write-failed",
      safeMessage,
    );
  }
}

function blockedResult(
  message: string,
  reasonCode: string,
  blockedReason: string | null,
): ProblemApiImportResult {
  return {
    success: false,
    dbWritten: false,
    localProblemId: null,
    dbId: null,
    message,
    reasonCode,
    devOnly: true,
    productionReady: false,
    safeToExposeToClient: true,
    rawResponseStored: false,
    blockedReason,
    existing: false,
    existingDetailLink: null,
  };
}

function normalizeDifficulty(
  value: string,
): ProblemDifficulty {
  const normalized = value.trim().toLowerCase();
  switch (normalized) {
    case "easy":
      return "EASY";
    case "medium":
      return "MEDIUM";
    case "hard":
      return "HARD";
    case "challenge":
      return "CHALLENGE";
    default:
      return "MEDIUM";
  }
}

function normalizeTags(tags: string[]): string[] {
  if (!Array.isArray(tags)) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    const normalized = tag.trim().slice(0, 48);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
    if (result.length >= 12) break;
  }
  return result;
}

function normalizeExamples(
  examples: Array<{ input: string; output: string; explanation?: string; label?: string }>,
): Array<{ input: string; output: string; explanation?: string; label?: string }> {
  return examples
    .slice(0, 10)
    .map((example) => ({
      input: (example.input ?? "").trim().slice(0, 2000),
      output: (example.output ?? "").trim().slice(0, 2000),
      explanation: (example.explanation ?? "").trim().slice(0, 500) || undefined,
      label: (example.label ?? "").trim().slice(0, 100) || undefined,
    }))
    .filter((example) => example.input.length > 0 && example.output.length > 0);
}

function safeReadNodeEnv(): string | undefined {
  try {
    return process.env.NODE_ENV;
  } catch {
    return undefined;
  }
}

function hasDatabaseUrl(): boolean {
  try {
    const { hasDatabaseUrl: check } = require("@learning-agent-platform/db") as typeof import("@learning-agent-platform/db");
    return check();
  } catch {
    return false;
  }
}

function isDbReadAllowed(): boolean {
  try {
    if (!hasDatabaseUrl()) return false;
    if (process.env["LAP_ALLOW_REAL_DB_INTEGRATION"] !== "true") return false;
    if (process.env["LAP_IMPORT_DB_PERSIST_DEV_ENABLED"] !== "true") return false;
    return true;
  } catch {
    return false;
  }
}

const SENSITIVE_ERROR_PATTERNS: ReadonlyArray<RegExp> = [
  /postgres(ql)?:\/\/\S*/gi,
  /DATABASE_URL[=:]\s*\S*/gi,
  /connection\s+string[=:]\s*\S*/gi,
  /password[=:]\s*\S*/gi,
  /secret[=:]\s*\S*/gi,
  /token[=:]\s*\S*/gi,
  /api[_-]?key[=:]\s*\S*/gi,
];

function redactSensitiveMessage(message: string): string {
  let redacted = message;
  for (const pattern of SENSITIVE_ERROR_PATTERNS) {
    redacted = redacted.replace(pattern, "[hidden]");
  }
  return redacted;
}
