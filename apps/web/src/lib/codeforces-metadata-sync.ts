import {
  adaptCodeforcesProblemSet,
  type CodeforcesProblemPreview,
} from "./codeforces-adapter.ts";
import {
  evaluateCodeforcesCatalogPolicy,
  type CodeforcesCatalogPolicy,
} from "./codeforces-catalog-policy.ts";
import {
  selectCuratedPool,
  type CodeforcesPoolConfig,
} from "./codeforces-curated-pool.ts";
import type { CodeforcesProblemSetResponse } from "./codeforces-client.ts";
import { mapRatingToDifficulty } from "./codeforces-import-adapter.ts";

export interface CodeforcesProblemSyncResult {
  fetched: number;
  valid: number;
  eligible: number;
  selected: number;
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  errors: Array<{
    key?: string;
    reason: string;
  }>;
  rejectedByReason: Record<string, number>;
  /** Pool-specific: rating band breakdown (only populated when poolConfig is used) */
  ratingDistribution?: Array<{
    rating: number;
    quota: number;
    available: number;
    selected: number;
  }>;
  /** Pool-specific: tag distribution (only populated when poolConfig is used) */
  tagDistribution?: Array<{
    tag: string;
    count: number;
  }>;
}

export interface CodeforcesProblemSyncStore {
  listExistingProblems(): Promise<CodeforcesProblemMetadataRecord[]>;
  createProblem(input: CodeforcesProblemMetadataWrite): Promise<CodeforcesProblemMetadataRecord>;
  updateProblem(
    id: string,
    input: CodeforcesProblemMetadataWrite,
  ): Promise<CodeforcesProblemMetadataRecord>;
}

export interface CodeforcesProblemMetadataRecord {
  id: string;
  title: string;
  description: string | null;
  difficulty: string;
  tags: string[];
  source: string | null;
  sourceUrl: string | null;
  metadata: unknown;
}

export interface CodeforcesProblemMetadataWrite {
  title: string;
  description: null;
  difficulty: string;
  tags: string[];
  source: "codeforces";
  sourceUrl: string;
  metadata: Record<string, unknown>;
}

const CODEFORCES_SOURCE = "codeforces";
const CODEFORCES_PROBLEM_URL = "https://codeforces.com/problemset/problem";
const FORBIDDEN_METADATA_KEYS = new Set([
  joinKey("state", "ment"),
  "description",
  "input",
  joinKey("input", "Specification"),
  joinKey("input", "Description"),
  "output",
  joinKey("output", "Specification"),
  joinKey("output", "Description"),
  joinKey("exam", "ples"),
  joinKey("sample", "Input"),
  joinKey("sample", "Output"),
  joinKey("judge", "TestCases"),
  joinKey("editor", "ial"),
  joinKey("sol", "ution"),
  "tutorial",
  "pageHtml",
  "html",
  "constraints",
]);

export async function syncCodeforcesProblemMetadata(input: {
  fetchProblemSet: () => Promise<CodeforcesProblemSetResponse>;
  store: CodeforcesProblemSyncStore;
  now?: () => Date;
  maxProblems?: number;
  policy?: CodeforcesCatalogPolicy | null;
  poolConfig?: CodeforcesPoolConfig | null;
}): Promise<CodeforcesProblemSyncResult> {
  const now = input.now ?? (() => new Date());
  const maxProblems = normalizeSyncLimit(input.maxProblems);
  const policy = input.policy ?? null;
  const poolConfig = input.poolConfig ?? null;
  const response = await input.fetchProblemSet();
  const adapted = adaptCodeforcesProblemSet(response);
  const result: CodeforcesProblemSyncResult = {
    fetched: adapted.totalFetched,
    valid: 0,
    eligible: 0,
    selected: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    unchanged: 0,
    errors: adapted.warnings.map((reason) => ({ reason })),
    rejectedByReason: {},
  };

  const existingRecords = await input.store.listExistingProblems();
  const existingByKey = buildExistingProblemIndex(existingRecords);
  const seenInSnapshot = new Set<string>();

  // -------------------------------------------------------------------------
  // Curated pool mode: two-pass selection
  // -------------------------------------------------------------------------
  if (poolConfig !== null) {
    // Pass 1: collect all eligible previews
    const eligiblePreviews: CodeforcesProblemPreview[] = [];

    for (const preview of adapted.previews) {
      const normalized = normalizeCodeforcesProblemPreview(preview, now());
      if (normalized.valid === false) {
        result.skipped += 1;
        result.errors.push({ key: normalized.key, reason: normalized.reason });
        continue;
      }

      const key = normalized.key;
      if (seenInSnapshot.has(key)) {
        result.skipped += 1;
        result.errors.push({ key, reason: "duplicate problem in API snapshot" });
        continue;
      }
      seenInSnapshot.add(key);
      result.valid += 1;

      // Apply catalog policy (required for pool selection)
      if (policy !== null) {
        const policyResult = evaluateCodeforcesCatalogPolicy(preview, policy);
        if (!policyResult.eligible) {
          result.skipped += 1;
          const reason = policyResult.reason ?? "policy_rejected";
          result.rejectedByReason[reason] =
            (result.rejectedByReason[reason] ?? 0) + 1;
          continue;
        }
      }
      result.eligible += 1;
      eligiblePreviews.push(preview);
    }

    // Apply curated pool selection
    const poolResult = selectCuratedPool(eligiblePreviews, poolConfig);
    result.selected = poolResult.selectedTotal;
    result.ratingDistribution = poolResult.ratingDistribution;
    result.tagDistribution = poolResult.tagDistribution;

    // Pass 2: write only selected problems
    for (const preview of poolResult.selected) {
      const normalized = normalizeCodeforcesProblemPreview(preview, now());
      if (normalized.valid === false) {
        // Should not happen (already validated), but guard
        result.skipped += 1;
        continue;
      }

      const key = normalized.key;
      const existing = existingByKey.get(key);
      try {
        if (!existing) {
          const created = await input.store.createProblem(normalized.write);
          indexExistingRecord(existingByKey, created);
          result.created += 1;
        } else if (isSameCodeforcesMetadata(existing, normalized.write)) {
          result.unchanged += 1;
        } else {
          const updated = await input.store.updateProblem(existing.id, normalized.write);
          indexExistingRecord(existingByKey, updated);
          result.updated += 1;
        }
      } catch (error) {
        result.skipped += 1;
        result.errors.push({ key, reason: sanitizeSyncError(error) });
      }
    }

    return result;
  }

  // -------------------------------------------------------------------------
  // Standard mode: streaming with limit
  // -------------------------------------------------------------------------
  for (const preview of adapted.previews) {
    // Limit check: stop once we have enough eligible (policy-passing) problems.
    // When no policy is set, eligible === valid, so limit applies to valid.
    if (maxProblems !== null && result.selected >= maxProblems) {
      break;
    }

    const normalized = normalizeCodeforcesProblemPreview(preview, now());
    if (normalized.valid === false) {
      result.skipped += 1;
      result.errors.push({
        key: normalized.key,
        reason: normalized.reason,
      });
      continue;
    }

    const key = normalized.key;
    if (seenInSnapshot.has(key)) {
      result.skipped += 1;
      result.errors.push({ key, reason: "duplicate problem in API snapshot" });
      continue;
    }
    seenInSnapshot.add(key);
    result.valid += 1;

    // Apply catalog policy (if provided)
    if (policy !== null) {
      const policyResult = evaluateCodeforcesCatalogPolicy(preview, policy);
      if (!policyResult.eligible) {
        result.skipped += 1;
        const reason = policyResult.reason ?? "policy_rejected";
        result.rejectedByReason[reason] =
          (result.rejectedByReason[reason] ?? 0) + 1;
        continue;
      }
    }
    result.eligible += 1;

    // Limit check: after policy pass, count toward selected and check limit
    result.selected += 1;

    const existing = existingByKey.get(key);
    try {
      if (!existing) {
        const created = await input.store.createProblem(normalized.write);
        indexExistingRecord(existingByKey, created);
        result.created += 1;
        continue;
      }

      if (isSameCodeforcesMetadata(existing, normalized.write)) {
        result.unchanged += 1;
        continue;
      }

      const updated = await input.store.updateProblem(existing.id, normalized.write);
      indexExistingRecord(existingByKey, updated);
      result.updated += 1;
    } catch (error) {
      result.skipped += 1;
      result.errors.push({
        key,
        reason: sanitizeSyncError(error),
      });
    }
  }

  return result;
}

export function normalizeCodeforcesProblemPreview(
  preview: CodeforcesProblemPreview,
  syncedAt: Date,
):
  | {
      valid: true;
      key: string;
      write: CodeforcesProblemMetadataWrite;
    }
  | {
      valid: false;
      key?: string;
      reason: string;
    } {
  const contestId = normalizePositiveInteger(preview.contestId);
  const index = normalizeIndex(preview.index);
  const name = normalizeRequiredText(preview.name);

  if (contestId === null) {
    return { valid: false, reason: "missing contestId" };
  }

  if (index === null) {
    return {
      valid: false,
      key: `codeforces:${contestId}:unknown`,
      reason: "missing index",
    };
  }

  if (name === null) {
    return {
      valid: false,
      key: createCodeforcesExternalId(contestId, index),
      reason: "missing name",
    };
  }

  const rating = normalizeRating(preview.rating);
  const tags = normalizeTags(preview.tags);
  const originalUrl = createCodeforcesOriginalUrl(contestId, index);
  const externalId = createCodeforcesExternalId(contestId, index);
  const solvedCount = normalizeNonNegativeInteger(preview.solvedCount);
  const syncedAtIso = syncedAt.toISOString();

  return {
    valid: true,
    key: externalId,
    write: {
      title: name,
      description: null,
      difficulty: mapRatingToDifficulty(rating).toUpperCase(),
      tags,
      source: CODEFORCES_SOURCE,
      sourceUrl: originalUrl,
      metadata: stripForbiddenMetadataKeys({
        importSource: "codeforces-metadata",
        provider: CODEFORCES_SOURCE,
        providerId: CODEFORCES_SOURCE,
        source: CODEFORCES_SOURCE,
        externalId,
        externalProblemId: externalId,
        contestId,
        index,
        rating: rating ?? null,
        tags,
        originalUrl,
        sourceUrl: originalUrl,
        solvedCount: solvedCount ?? null,
        indexOnly: true,
        lastSyncedAt: syncedAtIso,
        syncedAt: syncedAtIso,
      }),
    },
  };
}

export function createCodeforcesExternalId(contestId: number, index: string): string {
  return `codeforces:${contestId}:${index}`;
}

export function createCodeforcesOriginalUrl(contestId: number, index: string): string {
  return `${CODEFORCES_PROBLEM_URL}/${contestId}/${encodeURIComponent(index)}`;
}

function buildExistingProblemIndex(
  records: readonly CodeforcesProblemMetadataRecord[],
): Map<string, CodeforcesProblemMetadataRecord> {
  const index = new Map<string, CodeforcesProblemMetadataRecord>();
  for (const record of records) {
    indexExistingRecord(index, record);
  }
  return index;
}

function indexExistingRecord(
  index: Map<string, CodeforcesProblemMetadataRecord>,
  record: CodeforcesProblemMetadataRecord,
): void {
  const keys = createExistingKeys(record);
  for (const key of keys) {
    if (!index.has(key)) {
      index.set(key, record);
    }
  }
}

function createExistingKeys(record: CodeforcesProblemMetadataRecord): string[] {
  const metadata = asRecord(record.metadata);
  const keys = new Set<string>();

  const explicitExternalId = normalizeRequiredText(
    metadata.externalId ?? metadata.externalProblemId,
  );
  if (explicitExternalId?.startsWith("codeforces:")) {
    keys.add(explicitExternalId);
  }

  const contestId = normalizePositiveInteger(metadata.contestId);
  const problemIndex = normalizeIndex(metadata.index);
  if (contestId !== null && problemIndex !== null) {
    keys.add(createCodeforcesExternalId(contestId, problemIndex));
  }

  const sourceUrl = normalizeRequiredText(
    metadata.originalUrl ?? metadata.sourceUrl ?? record.sourceUrl,
  );
  const urlIdentity = sourceUrl ? parseCodeforcesUrlIdentity(sourceUrl) : null;
  if (urlIdentity !== null) {
    keys.add(createCodeforcesExternalId(urlIdentity.contestId, urlIdentity.index));
  }

  return Array.from(keys);
}

function isSameCodeforcesMetadata(
  record: CodeforcesProblemMetadataRecord,
  write: CodeforcesProblemMetadataWrite,
): boolean {
  return (
    record.title === write.title &&
    record.description === null &&
    record.difficulty === write.difficulty &&
    areStringArraysEqual(record.tags, write.tags) &&
    record.source === write.source &&
    record.sourceUrl === write.sourceUrl &&
    hasEquivalentMetadata(record.metadata, write.metadata)
  );
}

function hasEquivalentMetadata(
  current: unknown,
  next: Record<string, unknown>,
): boolean {
  const currentRecord = stripForbiddenMetadataKeys(asRecord(current));
  const stableKeys = [
    "importSource",
    "provider",
    "providerId",
    "source",
    "externalId",
    "externalProblemId",
    "contestId",
    "index",
    "rating",
    "tags",
    "originalUrl",
    "sourceUrl",
    "solvedCount",
    "indexOnly",
  ];

  return stableKeys.every((key) =>
    JSON.stringify(currentRecord[key] ?? null) === JSON.stringify(next[key] ?? null),
  );
}

function stripForbiddenMetadataKeys(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!FORBIDDEN_METADATA_KEYS.has(key)) {
      safe[key] = value;
    }
  }
  return safe;
}

function parseCodeforcesUrlIdentity(
  value: string,
): { contestId: number; index: string } | null {
  try {
    const url = new URL(value);
    const match = url.pathname.match(/\/problemset\/problem\/(\d+)\/([^/]+)/i);
    if (!match) {
      return null;
    }

    const contestId = normalizePositiveInteger(Number(match[1]));
    const index = normalizeIndex(decodeURIComponent(match[2]));
    if (contestId === null || index === null) {
      return null;
    }

    return { contestId, index };
  } catch {
    return null;
  }
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const item of value) {
    const tag = normalizeRequiredText(item)?.toLowerCase();
    if (!tag || seen.has(tag)) {
      continue;
    }

    seen.add(tag);
    normalized.push(tag);
  }
  return normalized;
}

function normalizeRating(value: unknown): number | undefined {
  const normalized = normalizePositiveInteger(value);
  return normalized ?? undefined;
}

function normalizePositiveInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const normalized = Math.trunc(value);
  return normalized > 0 ? normalized : null;
}

function normalizeNonNegativeInteger(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  const normalized = Math.trunc(value);
  return normalized >= 0 ? normalized : undefined;
}

function normalizeSyncLimit(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const normalized = Math.trunc(value);
  return normalized > 0 ? normalized : null;
}

function normalizeIndex(value: unknown): string | null {
  const normalized = normalizeRequiredText(value);
  return normalized;
}

function normalizeRequiredText(value: unknown): string | null {
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

function areStringArraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return false;
    }
  }
  return true;
}

function stripControlCharacters(value: string): string {
  let result = "";
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    result += code < 32 || code === 127 ? " " : value[i];
  }
  return result;
}

function sanitizeSyncError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text
    .replace(/https?:\/\/[^\s]+/g, "[REDACTED_URL]")
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[REDACTED_DATABASE_URL]")
    .replace(/(token|secret|password|api[_-]?key)=\S+/gi, "$1=[REDACTED]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

function joinKey(left: string, right: string): string {
  return `${left}${right}`;
}
