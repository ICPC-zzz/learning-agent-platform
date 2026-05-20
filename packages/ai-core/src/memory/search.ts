import type {
  MemoryItem,
  MemorySearchFilters,
  MemorySearchQuery,
  MemorySearchResult,
} from "./types";
import {
  cloneMemoryItem,
  memoryMetadataMatches,
  normalizeMemoryLimit,
  normalizeMemoryText,
} from "./utils";

export function normalizeSearchText(text: string): string {
  return normalizeMemoryText(text);
}

export function tokenizeSearchText(text: string): string[] {
  const normalized = normalizeSearchText(text);
  if (normalized.length === 0) {
    return [];
  }

  return Array.from(new Set(normalized.split(" ").filter(Boolean)));
}

export function getMemorySearchText(query: MemorySearchQuery): string {
  return query.text ?? query.query ?? "";
}

export function calculateKeywordMatchScore(
  content: string,
  query: string,
): number {
  const normalizedContent = normalizeSearchText(content);
  const normalizedQuery = normalizeSearchText(query);

  if (normalizedContent.length === 0 || normalizedQuery.length === 0) {
    return 0;
  }

  const tokens = tokenizeSearchText(normalizedQuery);
  const tokenScore =
    tokens.length === 0
      ? 0
      : tokens.filter((token) => normalizedContent.includes(token)).length /
        tokens.length;

  const exactScore = normalizedContent.includes(normalizedQuery) ? 1 : 0;

  return exactScore + tokenScore;
}

export function matchesMemorySearchFilters(
  item: MemoryItem,
  filters: MemorySearchFilters,
): boolean {
  if (filters.userId !== undefined && item.userId !== filters.userId) {
    return false;
  }

  if (
    filters.sessionId !== undefined &&
    item.sessionId !== filters.sessionId
  ) {
    return false;
  }

  if (filters.layer !== undefined && item.layer !== filters.layer) {
    return false;
  }

  if (
    filters.layers !== undefined &&
    filters.layers.length > 0 &&
    !filters.layers.includes(item.layer)
  ) {
    return false;
  }

  return memoryMetadataMatches(item.metadata, filters.metadata);
}

export function rankMemoryResults(
  items: readonly MemoryItem[],
  query: MemorySearchQuery,
): MemorySearchResult[] {
  const searchText = getMemorySearchText(query);
  const normalizedSearchText = normalizeSearchText(searchText);

  return items
    .map((item): MemorySearchResult => {
      const keywordScore = calculateKeywordMatchScore(
        item.content,
        normalizedSearchText,
      );
      const importanceBoost = item.importance * 0.1;
      const score =
        normalizedSearchText.length === 0
          ? item.importance
          : keywordScore + importanceBoost;
      const reason =
        normalizedSearchText.length === 0
          ? "recent-memory"
          : keywordScore > 0
            ? "keyword-match"
            : "no-keyword-match";

      return {
        item: cloneMemoryItem(item),
        score,
        reason,
      };
    })
    .filter(
      (result) =>
        normalizedSearchText.length === 0 || result.score > result.item.importance * 0.1,
    )
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return (
        new Date(right.item.createdAt).getTime() -
        new Date(left.item.createdAt).getTime()
      );
    })
    .slice(0, normalizeMemoryLimit(query.limit));
}
