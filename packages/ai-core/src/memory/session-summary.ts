import { MemoryLayer } from "./types";
import type { MemoryAddInput, MemorySessionSummaryInput } from "./types";
import { cloneMemoryMetadata, normalizeMemoryText } from "./utils";

export const SESSION_SUMMARY_MEMORY_TYPE = "SESSION_SUMMARY";
export const DEFAULT_SESSION_SUMMARY_MAX_LENGTH = 1_000;

export function summarizeSessionText(
  textOrMessages: string | readonly string[],
  maxLength = DEFAULT_SESSION_SUMMARY_MAX_LENGTH,
): string {
  const rawText =
    typeof textOrMessages === "string"
      ? textOrMessages
      : textOrMessages.join("\n");
  const normalized = normalizeMemoryText(rawText);

  if (normalized.length === 0) {
    return "No session content provided.";
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

export function createSessionSummaryMemoryItem(
  input: MemorySessionSummaryInput,
): MemoryAddInput {
  const sourceText = input.text ?? input.messages ?? "";
  const metadata = cloneMemoryMetadata(input.metadata) ?? {};

  return {
    userId: input.userId,
    sessionId: input.sessionId,
    layer: MemoryLayer.Session,
    content: summarizeSessionText(sourceText, input.maxLength),
    importance: 0.7,
    metadata: {
      ...metadata,
      memoryType: SESSION_SUMMARY_MEMORY_TYPE,
      summaryKind: "deterministic-placeholder",
      ...(input.sourceItemIds === undefined
        ? {}
        : { sourceItemIds: [...input.sourceItemIds] }),
    },
  };
}
