import type {
  MemoryContextBundle,
  MemoryItem,
  MemorySearchResult,
  WorkingMemoryMessage,
} from "./types.ts";
import { buildMemoryRetrievalText } from "./MemoryRetriever.ts";
import { buildMemoryContextText, summarizeWorkingMemoryMessages } from "./MemoryCompressor.ts";
import { normalizeMemoryText } from "./utils.ts";

export function buildMemoryContextBundle(input: {
  workingMessages?: readonly WorkingMemoryMessage[];
  sessionSummaryText?: string;
  retrievedMemories?: readonly MemorySearchResult[];
  memoryBudgetChars?: number;
}): MemoryContextBundle {
  const workingMemoryText = summarizeWorkingMemoryMessages(
    input.workingMessages ?? [],
    { maxChars: input.memoryBudgetChars },
  );
  const sessionSummaryText = normalizeText(input.sessionSummaryText ?? "");
  const retrievedMemoryText = buildMemoryRetrievalText(input.retrievedMemories ?? []);
  const promptText = buildMemoryContextText({
    workingMemoryText,
    sessionSummaryText,
    retrievedMemoryText,
  });

  return {
    workingMemoryText,
    sessionSummaryText,
    retrievedMemoryText,
    promptText,
  };
}

export function flattenMemoryItemsForPrompt(items: readonly MemoryItem[]): string {
  if (items.length === 0) {
    return "";
  }

  return items
    .map((item, index) => `${index + 1}. [${item.layer}] ${normalizeMemoryText(item.content)}`)
    .join("\n");
}

function normalizeText(value: string): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}
