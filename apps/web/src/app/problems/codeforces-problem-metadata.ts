import { normalizeProblemSourceKey } from "./problem-source-label.ts";

export interface CodeforcesProblemMetadataView {
  id: string;
  title: string;
  rating: number | null;
  tags: string[];
  contestId: number | null;
  index: string | null;
  source: "codeforces";
  sourceLabel: "Codeforces";
  originalUrl: string | null;
  externalId: string | null;
  providerId: string | null;
  importedAt: string | null;
  createdAt: Date | string | null;
}

export interface ProblemRecordForCodeforcesMetadata {
  id: string;
  title: string;
  tags: string[];
  source: string | null;
  sourceUrl: string | null;
  metadata: unknown;
  createdAt?: Date | string | null;
}

const CODEFORCES_PROBLEM_URL = "https://codeforces.com/problemset/problem";

export function mapProblemRecordToCodeforcesMetadata(
  record: ProblemRecordForCodeforcesMetadata,
): CodeforcesProblemMetadataView | null {
  const metadata = asRecord(record.metadata);
  if (!isCodeforcesRecord(record, metadata)) {
    return null;
  }

  const parsedIdentity = parseCodeforcesIdentity(record, metadata);
  const contestId = parsedIdentity.contestId;
  const index = parsedIdentity.index;
  const originalUrl = pickCodeforcesUrl(record, metadata) ?? createCodeforcesUrl(contestId, index);

  return {
    id: record.id,
    title: record.title,
    rating: extractRating(metadata),
    tags: Array.isArray(record.tags)
      ? record.tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0)
      : [],
    contestId,
    index,
    source: "codeforces",
    sourceLabel: "Codeforces",
    originalUrl,
    externalId: extractExternalId(metadata),
    providerId: extractText(metadata.providerId ?? metadata.provider ?? metadata.platform),
    importedAt: extractText(metadata.importedAt),
    createdAt: record.createdAt ?? null,
  };
}

export function createCodeforcesUrl(
  contestId: number | null,
  index: string | null,
): string | null {
  if (!Number.isInteger(contestId) || contestId === null || contestId <= 0 || !index) {
    return null;
  }

  return `${CODEFORCES_PROBLEM_URL}/${contestId}/${encodeURIComponent(index)}`;
}

export function formatCodeforcesContestIndex(
  contestId: number | null,
  index: string | null,
): string {
  if (contestId === null || !index) {
    return "比赛编号或题号暂缺";
  }

  return `${contestId}${index}`;
}

function isCodeforcesRecord(
  record: ProblemRecordForCodeforcesMetadata,
  metadata: Record<string, unknown>,
): boolean {
  if (normalizeProblemSourceKey(record.source, record.sourceUrl) === "codeforces") {
    return true;
  }

  const sourceCandidates = [
    metadata.source,
    metadata.provider,
    metadata.providerId,
    metadata.platform,
    metadata.sourcePlatform,
  ];

  if (
    sourceCandidates.some((value) => {
      const text = extractText(value);
      return text ? normalizeProblemSourceKey(text, null) === "codeforces" : false;
    })
  ) {
    return true;
  }

  const urlCandidates = [metadata.originalUrl, metadata.sourceUrl, metadata.url];
  if (
    urlCandidates.some((value) => {
      const text = extractText(value);
      return text ? normalizeProblemSourceKey(null, text) === "codeforces" : false;
    })
  ) {
    return true;
  }

  const externalId = extractExternalId(metadata);
  return externalId !== null && /^codeforces:/i.test(externalId);
}

function parseCodeforcesIdentity(
  record: ProblemRecordForCodeforcesMetadata,
  metadata: Record<string, unknown>,
): { contestId: number | null; index: string | null } {
  const explicitContestId = extractInteger(
    metadata.contestId ?? metadata.cfContestId ?? metadata.codeforcesContestId,
  );
  const explicitIndex = extractText(
    metadata.index ?? metadata.problemIndex ?? metadata.cfIndex ?? metadata.codeforcesIndex,
  );

  if (explicitContestId !== null && explicitIndex !== null) {
    return { contestId: explicitContestId, index: explicitIndex };
  }

  const externalIdentity = parseIdentityFromExternalId(extractExternalId(metadata));
  if (externalIdentity.contestId !== null || externalIdentity.index !== null) {
    return {
      contestId: explicitContestId ?? externalIdentity.contestId,
      index: explicitIndex ?? externalIdentity.index,
    };
  }

  const urlIdentity = parseIdentityFromUrl(
    pickCodeforcesUrl(record, metadata) ?? undefined,
  );
  return {
    contestId: explicitContestId ?? urlIdentity.contestId,
    index: explicitIndex ?? urlIdentity.index,
  };
}

function parseIdentityFromExternalId(
  externalId: string | null,
): { contestId: number | null; index: string | null } {
  if (!externalId) {
    return { contestId: null, index: null };
  }

  const match = externalId.match(/^codeforces:(\d+):([A-Za-z0-9]+)$/i);
  if (!match) {
    return { contestId: null, index: null };
  }

  return {
    contestId: extractInteger(match[1]),
    index: match[2],
  };
}

function parseIdentityFromUrl(
  sourceUrl: string | undefined,
): { contestId: number | null; index: string | null } {
  if (!sourceUrl) {
    return { contestId: null, index: null };
  }

  try {
    const url = new URL(sourceUrl);
    const path = url.pathname;
    const problemSetMatch = path.match(/\/problemset\/problem\/(\d+)\/([^/]+)/i);
    if (problemSetMatch) {
      return {
        contestId: extractInteger(problemSetMatch[1]),
        index: decodeURIComponent(problemSetMatch[2]),
      };
    }

    const contestMatch = path.match(/\/contest\/(\d+)\/problem\/([^/]+)/i);
    if (contestMatch) {
      return {
        contestId: extractInteger(contestMatch[1]),
        index: decodeURIComponent(contestMatch[2]),
      };
    }
  } catch {
    return { contestId: null, index: null };
  }

  return { contestId: null, index: null };
}

function pickCodeforcesUrl(
  record: ProblemRecordForCodeforcesMetadata,
  metadata: Record<string, unknown>,
): string | null {
  const candidates = [
    record.sourceUrl,
    extractText(metadata.originalUrl),
    extractText(metadata.sourceUrl),
    extractText(metadata.url),
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    if (normalizeProblemSourceKey(null, candidate) === "codeforces") {
      return candidate;
    }
  }

  return null;
}

function extractExternalId(metadata: Record<string, unknown>): string | null {
  return extractText(
    metadata.externalId ??
      metadata.externalProblemId ??
      metadata.codeforcesExternalId,
  );
}

function extractRating(metadata: Record<string, unknown>): number | null {
  const value = extractInteger(metadata.rating ?? metadata.codeforcesRating);
  return value === null ? null : value;
}

function extractInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

function extractText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = stripControlCharacters(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function stripControlCharacters(value: string): string {
  let result = "";
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    result += code < 32 || code === 127 ? " " : value[i];
  }
  return result;
}
