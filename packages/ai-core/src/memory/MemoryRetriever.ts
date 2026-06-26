import type {
  MemoryItem,
  MemorySearchQuery,
  MemorySearchResult,
} from "./types.ts";
import {
  rankMemoryResults,
} from "./search.ts";
import { normalizeMemoryText } from "./utils.ts";

export function retrieveRelevantMemories(input: {
  memories: readonly MemoryItem[];
  query: string;
  limit?: number;
}): MemorySearchResult[] {
  const normalizedQuery = normalizeMemoryText(input.query);
  const query: MemorySearchQuery = {
    query: normalizedQuery,
    limit: input.limit,
  };

  return rankMemoryResults(input.memories, query);
}

export function buildMemoryRetrievalText(results: readonly MemorySearchResult[]): string {
  if (results.length === 0) {
    return "";
  }

  return results
    .map((result, index) => {
      const item = result.item;
      const tags = createTagText(item.metadata);
      const prefix = `${index + 1}. [${item.layer}]`;
      const reason = result.reason ? ` (${result.reason})` : "";
      const meta = tags.length > 0 ? ` | ${tags}` : "";
      return `${prefix}${reason}${meta} ${normalizeMemoryText(item.content)}`;
    })
    .join("\n");
}

function createTagText(metadata: MemoryItem["metadata"]): string {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return "";
  }

  const record = metadata as Record<string, unknown>;
  const parts: string[] = [];

  if (typeof record.category === "string") {
    parts.push(`category=${record.category}`);
  }

  if (typeof record.source === "string") {
    parts.push(`source=${record.source}`);
  }

  if (typeof record.sessionId === "string") {
    parts.push(`session=${record.sessionId}`);
  }

  return parts.join(", ");
}
