import fs from "node:fs";
import path from "node:path";

import {
  addAssistantMemory,
  deleteAssistantMemory,
  listAssistantMemories,
} from "./memory-service.ts";
import type { AssistantMemoryRecord } from "./assistant-types.ts";
import {
  LEARNING_ARTIFACT_KIND_CODE_ANALYSIS,
  LEARNING_ARTIFACT_KIND_LEARNING_REPORT,
  LEARNING_ARTIFACT_KIND_REVIEW_PLAN,
  artifactKindOfMemory,
} from "./learning-artifact-classification.ts";

const ARTIFACT_KIND_LEARNING_REPORT = LEARNING_ARTIFACT_KIND_LEARNING_REPORT;
const ARTIFACT_KIND_REVIEW_PLAN = LEARNING_ARTIFACT_KIND_REVIEW_PLAN;
const ARTIFACT_KIND_CODE_ANALYSIS = LEARNING_ARTIFACT_KIND_CODE_ANALYSIS;
const MAX_MEMORY_CONTENT_CHARS = 480;
const MAX_ANALYSIS_HISTORY = 5;

export async function persistCfLearningReportMemory(input: {
  userId: string;
  report: Record<string, unknown>;
  runId?: string | null;
}): Promise<void> {
  const content = limitText(summarizeCfLearningReport(input.report), MAX_MEMORY_CONTENT_CHARS);
  if (!content) return;
  await replaceArtifactMemory({
    userId: input.userId,
    artifactKind: ARTIFACT_KIND_LEARNING_REPORT,
    content,
    metadata: {
      artifactKind: ARTIFACT_KIND_LEARNING_REPORT,
      memoryKind: "readonly_context",
      contextKind: "learning_artifact",
      readonlyContext: true,
      retrievable: true,
      artifactSource: "learning_report",
      generatedAt: readString(input.report.generatedAt),
      handle: readString(readRecord(input.report.profileSummary).handle),
      runId: input.runId ?? null,
    },
    importance: 0.86,
  });
}

export async function persistCfReviewPlanMemory(input: {
  userId: string;
  report: Record<string, unknown>;
  runId?: string | null;
}): Promise<void> {
  const content = limitText(summarizeCfReviewPlan(input.report), MAX_MEMORY_CONTENT_CHARS);
  if (!content) return;
  await replaceArtifactMemory({
    userId: input.userId,
    artifactKind: ARTIFACT_KIND_REVIEW_PLAN,
    content,
    metadata: {
      artifactKind: ARTIFACT_KIND_REVIEW_PLAN,
      memoryKind: "readonly_context",
      contextKind: "learning_artifact",
      readonlyContext: true,
      retrievable: true,
      artifactSource: "review_plan",
      generatedAt: readString(input.report.generatedAt),
      runId: input.runId ?? null,
    },
    importance: 0.84,
  });
}

export async function persistCodeAnalysisHistoryMemory(input: {
  userId: string;
  summary: string;
  runId: string;
  problemRating: number | null;
  userRating: number | null;
  findingCount: number;
  personalized: boolean;
  modelName: string;
}): Promise<void> {
  const content = limitText(
    [
      "Recent code analysis:",
      input.summary,
      input.problemRating !== null ? `problem rating ${input.problemRating}` : "",
      input.userRating !== null ? `user rating ${input.userRating}` : "",
      `findings ${input.findingCount}`,
      input.personalized ? "personalized with Codeforces profile" : "base analysis",
    ].filter(Boolean).join("; "),
    MAX_MEMORY_CONTENT_CHARS,
  );
  if (!content) return;

  await addAssistantMemory(input.userId, {
    content,
    category: "learning",
    source: "assistant_suggested",
    enabled: true,
    importance: 0.72,
    metadata: {
      memoryType: "RETRIEVABLE",
      artifactKind: ARTIFACT_KIND_CODE_ANALYSIS,
      memoryKind: "readonly_context",
      contextKind: "learning_artifact",
      readonlyContext: true,
      retrievable: true,
      artifactSource: "code_analysis",
      runId: input.runId,
      problemRating: input.problemRating,
      userRating: input.userRating,
      findingCount: input.findingCount,
      personalized: input.personalized,
      modelName: input.modelName,
    },
  }).catch(() => undefined);
}

export async function collectLearningArtifactSummaries(userId: string): Promise<{
  learningReportSummary: string;
  reviewPlanSummary: string;
  recentCodeAnalysisSummary: string;
}> {
  const memories = await listAssistantMemories(userId, { includeInternal: true });
  const learningReportSummary = latestArtifact(memories, ARTIFACT_KIND_LEARNING_REPORT)?.content ?? "";
  const reviewPlanSummary = latestArtifact(memories, ARTIFACT_KIND_REVIEW_PLAN)?.content ?? "";
  const codeAnalysisMemories = memories
    .filter((memory) => artifactKindOf(memory) === ARTIFACT_KIND_CODE_ANALYSIS)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, MAX_ANALYSIS_HISTORY);

  return {
    learningReportSummary,
    reviewPlanSummary,
    recentCodeAnalysisSummary: codeAnalysisMemories.map((memory, index) => `${index + 1}. ${memory.content}`).join("\n"),
  };
}

export function summarizeAnalysisHistoryFromDisk(userId: string): string {
  try {
    const file = path.join(process.cwd(), ".data", "analysis-history", `${userId}.json`);
    if (!fs.existsSync(file)) return "";
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8")) as Array<Record<string, unknown>>;
    return parsed
      .slice(0, MAX_ANALYSIS_HISTORY)
      .map((record, index) => {
        const summary = readString(record.summary) || "analysis";
        const problemRating = readNumber(record.problemRating);
        const userRating = readNumber(record.userRating);
        const findingCount = readNumber(record.findingCount);
        return `${index + 1}. ${summary}${problemRating !== null ? `; problem ${problemRating}` : ""}${userRating !== null ? `; user ${userRating}` : ""}${findingCount !== null ? `; findings ${findingCount}` : ""}`;
      })
      .join("\n");
  } catch {
    return "";
  }
}

async function replaceArtifactMemory(input: {
  userId: string;
  artifactKind: string;
  content: string;
  metadata: Record<string, unknown>;
  importance: number;
}): Promise<void> {
  const existing = await listAssistantMemories(input.userId, { includeInternal: true });
  await Promise.all(
    existing
      .filter((memory) => artifactKindOf(memory) === input.artifactKind)
      .map((memory) => deleteAssistantMemory(input.userId, memory.id).catch(() => false)),
  );

  await addAssistantMemory(input.userId, {
    content: input.content,
    category: "learning",
    source: "assistant_suggested",
    enabled: true,
    importance: input.importance,
    metadata: {
      memoryType: "RETRIEVABLE",
      ...input.metadata,
    },
  }).catch(() => undefined);
}

function latestArtifact(memories: readonly AssistantMemoryRecord[], kind: string): AssistantMemoryRecord | null {
  return memories
    .filter((memory) => artifactKindOf(memory) === kind)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
}

function artifactKindOf(memory: AssistantMemoryRecord): string {
  return artifactKindOfMemory(memory);
}

function summarizeCfLearningReport(report: Record<string, unknown>): string {
  const profile = readRecord(report.profileSummary);
  const progress = readRecord(report.progress);
  const activity = readRecord(report.activity);
  const estimate = readRecord(report.ratingEstimate);
  const weakTags = readArray(report.weakTags)
    .map((item) => readRecord(item).tag ?? readRecord(item).name)
    .filter((item): item is string => typeof item === "string")
    .slice(0, 5);
  return [
    "Codeforces learning report",
    readString(profile.handle) ? `handle ${readString(profile.handle)}` : "",
    readNumber(profile.currentRating) !== null ? `official ${readNumber(profile.currentRating)}` : "",
    readNumber(estimate.estimatedRating) !== null ? `estimated ${readNumber(estimate.estimatedRating)}` : "",
    formatTrainingRange(report.ratingPlan),
    readNumber(progress.solvedProblems) !== null ? `solved ${readNumber(progress.solvedProblems)}` : "",
    readNumber(progress.unfinishedProblems) !== null ? `unfinished ${readNumber(progress.unfinishedProblems)}` : "",
    readNumber(activity.submissionsLast7Days) !== null ? `7d submissions ${readNumber(activity.submissionsLast7Days)}` : "",
    weakTags.length > 0 ? `weak tags ${weakTags.join(", ")}` : "",
  ].filter(Boolean).join("; ");
}

function formatTrainingRange(value: unknown): string {
  const ratingPlan = readRecord(value);
  const training = ratingPlan.training;
  if (!Array.isArray(training) || training.length < 2) {
    return "";
  }

  const min = readNumber(training[0]);
  const max = readNumber(training[1]);
  return min !== null && max !== null ? `training ${min}-${max}` : "";
}

function summarizeCfReviewPlan(report: Record<string, unknown>): string {
  const summary = readRecord(report.summary);
  const advice = readRecord(report.reviewAdvice);
  const recommendations = readArray(report.recommendations)
    .map((item) => {
      const record = readRecord(item);
      return readString(record.name) || readString(record.problemKey);
    })
    .filter((item): item is string => Boolean(item))
    .slice(0, 5);
  const focusTags = readArray(report.focusTags)
    .map((item) => readRecord(item).tag ?? readRecord(item).name ?? item)
    .filter((item): item is string => typeof item === "string")
    .slice(0, 5);
  return [
    "Codeforces review plan",
    readNumber(report.estimatedRating) !== null ? `estimated ${readNumber(report.estimatedRating)}` : "",
    readNumber(summary.totalWaProblems) !== null ? `WA problems ${readNumber(summary.totalWaProblems)}` : "",
    readNumber(summary.weakTagCount) !== null ? `weak tag count ${readNumber(summary.weakTagCount)}` : "",
    readNumber(advice.suggestedSessionMinutes) !== null ? `duration ${readNumber(advice.suggestedSessionMinutes)} min` : "",
    focusTags.length > 0 ? `focus ${focusTags.join(", ")}` : "",
    recommendations.length > 0 ? `recommended ${recommendations.join(", ")}` : "",
  ].filter(Boolean).join("; ");
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function limitText(value: string, maxChars: number): string {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars - 3).trimEnd()}...`;
}
