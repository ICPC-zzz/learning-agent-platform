import "server-only";

import type { ChapterQaProviderRuntimeStatus } from "@learning-agent-platform/ai-core";

import type { OpenAiChapterQaProviderConfig } from "./openai-chapter-qa-types";

const defaultOpenAiBaseUrl = "https://api.openai.com/v1";
const defaultOpenAiTimeoutMs = 15_000;
const minimumOpenAiTimeoutMs = 1_000;
const maximumOpenAiTimeoutMs = 60_000;

export function getOpenAiChapterQaProviderConfig(
  status: ChapterQaProviderRuntimeStatus,
): OpenAiChapterQaProviderConfig | null {
  const apiKey = readRequiredEnvValue(process.env.OPENAI_API_KEY);
  const model = readRequiredEnvValue(process.env.OPENAI_MODEL);

  if (apiKey === null || model === null) {
    return null;
  }

  return {
    apiKey,
    model,
    baseUrl: readOpenAiBaseUrl(process.env.OPENAI_BASE_URL),
    timeoutMs: readOpenAiTimeoutMs(process.env.OPENAI_TIMEOUT_MS),
    status,
  };
}

function readRequiredEnvValue(value: string | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  return normalized.length === 0 ? null : normalized;
}

function readOpenAiBaseUrl(value: string | undefined): string {
  const normalized = readRequiredEnvValue(value);

  if (normalized === null) {
    return defaultOpenAiBaseUrl;
  }

  return normalized.replace(/\/+$/, "");
}

function readOpenAiTimeoutMs(value: string | undefined): number {
  const normalized = readRequiredEnvValue(value);

  if (normalized === null) {
    return defaultOpenAiTimeoutMs;
  }

  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    return defaultOpenAiTimeoutMs;
  }

  return Math.min(
    Math.max(Math.trunc(parsed), minimumOpenAiTimeoutMs),
    maximumOpenAiTimeoutMs,
  );
}
