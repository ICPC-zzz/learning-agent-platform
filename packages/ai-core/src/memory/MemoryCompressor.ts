import { summarizeSessionText } from "./session-summary.ts";
import type {
  CompactionBoundary,
  CompactionTrigger,
  MemoryContextBundle,
  WorkingMemoryMessage,
} from "./types.ts";
import { createMemoryId, normalizeMemoryText } from "./utils.ts";

const DEFAULT_WORKING_MEMORY_MESSAGES = 6;
const DEFAULT_MAX_WORKING_MEMORY_CHARS = 1000;

export function summarizeWorkingMemoryMessages(
  messages: readonly WorkingMemoryMessage[],
  options: {
    maxMessages?: number;
    maxChars?: number;
  } = {},
): string {
  const maxMessages = normalizePositiveInteger(
    options.maxMessages,
    DEFAULT_WORKING_MEMORY_MESSAGES,
  );
  const maxChars = normalizePositiveInteger(
    options.maxChars,
    DEFAULT_MAX_WORKING_MEMORY_CHARS,
  );

  const lines = messages
    .slice(-maxMessages)
    .map((message) => {
      const roleLabel = message.role === "assistant" ? "assistant" : message.role;
      return `[${roleLabel}] ${normalizePlainText(message.content)}`;
    })
    .filter((line) => line.trim().length > 0);

  return summarizeSessionText(lines, maxChars);
}

export function createCompactionBoundary(input: {
  sessionId: string;
  trigger?: CompactionTrigger;
  sourceMessageIds: readonly string[];
  sourceMessageRange: readonly [number, number];
  preservedTailMessageIds: readonly string[];
  preTokenEstimate: number;
  postTokenEstimate: number;
  summaryId?: string;
  createdAt?: string;
}): CompactionBoundary {
  const createdAt = input.createdAt ?? new Date().toISOString();

  return {
    id: createMemoryId(hashText(`${input.sessionId}|${createdAt}|${input.preTokenEstimate}`), "boundary"),
    sessionId: input.sessionId,
    trigger: input.trigger ?? "auto",
    sourceMessageIds: [...input.sourceMessageIds],
    sourceMessageRange: [input.sourceMessageRange[0], input.sourceMessageRange[1]],
    preTokenEstimate: Math.max(0, Math.trunc(input.preTokenEstimate)),
    postTokenEstimate: Math.max(0, Math.trunc(input.postTokenEstimate)),
    preservedTailMessageIds: [...input.preservedTailMessageIds],
    ...(input.summaryId ? { summaryId: input.summaryId } : {}),
    createdAt,
  };
}

export function createSessionSummaryBundle(input: {
  sessionId: string;
  messages: readonly WorkingMemoryMessage[];
  summaryMaxChars?: number;
  workingMemoryMaxMessages?: number;
}): MemoryContextBundle {
  const workingMemoryText = summarizeWorkingMemoryMessages(input.messages, {
    maxMessages: input.workingMemoryMaxMessages,
    maxChars: input.summaryMaxChars,
  });
  const sessionSummaryText = summarizeSessionText(
    input.messages.map((message) => `[${message.role}] ${message.content}`),
    input.summaryMaxChars,
  );

  return {
    workingMemoryText,
    sessionSummaryText,
    retrievedMemoryText: "",
    promptText: buildMemoryContextText({
      workingMemoryText,
      sessionSummaryText,
      retrievedMemoryText: "",
    }),
  };
}

export function buildMemoryContextText(input: {
  workingMemoryText?: string;
  sessionSummaryText?: string;
  retrievedMemoryText?: string;
}): string {
  const sections: string[] = [];

  if (normalizePlainText(input.workingMemoryText ?? "").length > 0) {
    sections.push(["WORKING_MEMORY", normalizePlainText(input.workingMemoryText ?? "")].join("\n"));
  }

  if (normalizePlainText(input.sessionSummaryText ?? "").length > 0) {
    sections.push(["SESSION_SUMMARY", normalizePlainText(input.sessionSummaryText ?? "")].join("\n"));
  }

  if (normalizePlainText(input.retrievedMemoryText ?? "").length > 0) {
    sections.push(["LONG_TERM_MEMORIES", normalizePlainText(input.retrievedMemoryText ?? "")].join("\n"));
  }

  return sections.join("\n\n");
}

function normalizePlainText(value: string): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.trunc(value));
}

function hashText(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619) >>> 0;
  }
  return hash;
}
