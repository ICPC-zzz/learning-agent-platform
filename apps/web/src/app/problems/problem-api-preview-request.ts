export interface ProblemApiPreviewRequest {
  query?: string;
  difficulty?: string | null;
  tags?: string[] | string;
  page?: number;
  pageSize?: number;
  maxResults?: number;
  language?: string;
}

export function normalizeProblemApiPreviewRequest(
  request: ProblemApiPreviewRequest,
): ProblemApiPreviewRequest {
  return {
    query: normalizeQuery(request.query),
    difficulty: normalizeDifficulty(request.difficulty),
    tags: normalizeTags(request.tags),
    page: normalizePositiveInteger(request.page, 1),
    pageSize: clampNumber(normalizePositiveInteger(request.pageSize ?? request.maxResults, 10), 1, 50),
    language: normalizeOptionalText(request.language),
  };
}

function normalizeQuery(value: string | undefined): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 200);
}

function normalizeDifficulty(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (
    normalized === "easy" ||
    normalized === "medium" ||
    normalized === "hard" ||
    normalized === "challenge" ||
    normalized === "unknown"
  ) {
    return normalized;
  }

  return null;
}

function normalizeTags(value: string[] | string | undefined): string[] {
  if (value === undefined) {
    return [];
  }

  const source = Array.isArray(value) ? value : [value];
  const tags: string[] = [];
  const seen = new Set<string>();

  for (const entry of source) {
    const parts = String(entry)
      .split(/[\s,;]+/)
      .map((item) => item.replace(/[\u0000-\u001f\u007f]/g, " ").trim())
      .filter(Boolean);

    for (const tag of parts) {
      const key = tag.toLowerCase();
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      tags.push(tag.slice(0, 48));

      if (tags.length >= 12) {
        return tags;
      }
    }
  }

  return tags;
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  const integer = Math.trunc(value);
  return integer > 0 ? integer : fallback;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return normalized.length > 0 ? normalized.slice(0, 64) : undefined;
}
