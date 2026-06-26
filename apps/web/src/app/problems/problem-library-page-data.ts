import {
  getPrismaClient,
  hasDatabaseUrl,
} from "@learning-agent-platform/db";

import {
  mapProblemRecordToCodeforcesMetadata,
  type CodeforcesProblemMetadataView,
} from "./codeforces-problem-metadata.js";

import {
  DEFAULT_CODEFORCES_CATALOG_POLICY,
  type CodeforcesCatalogPolicy,
} from "../../lib/codeforces-catalog-policy.ts";

export interface CodeforcesProblemListItem extends CodeforcesProblemMetadataView {
  detailHref: string;
}

export interface ProblemLibrarySearchParamsInput {
  q?: string | string[];
  tags?: string | string[];
  minRating?: string | string[];
  maxRating?: string | string[];
  page?: string | string[];
  pageSize?: string | string[];
}

export interface ProblemLibraryPageData {
  problems: CodeforcesProblemListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  query: string;
  tagsText: string;
  minRating: string;
  maxRating: string;
  sourceNote: string;
  dbLoaded: boolean;
  dbError: string | null;
}

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;
const MIN_PAGE_SIZE = 10;
const DEFAULT_SOURCE_NOTE =
  "当前只展示本地数据库中的 Codeforces 最小元数据：名称、Rating、标签和原题链接。";
const EMPTY_CODEFORCES_NOTE =
  "Codeforces 题库尚未完成同步，请稍后重试或等待管理员更新。";

export async function loadProblemLibraryPageData(
  params: ProblemLibrarySearchParamsInput = {},
  options?: {
    hideCompleted?: boolean;
    cfProblemStatusMap?: Map<string, { accepted: boolean }>;
  },
): Promise<ProblemLibraryPageData> {
  const query = normalizeSearchText(params.q);
  const tagsText = normalizeTagsText(params.tags);
  const tags = parseTags(tagsText);
  const minRatingText = normalizeRatingText(params.minRating);
  const maxRatingText = normalizeRatingText(params.maxRating);
  const minRating = parseRating(minRatingText);
  const maxRating = parseRating(maxRatingText);
  const pageSize = normalizePageSize(params.pageSize);
  const requestedPage = normalizePageNumber(params.page);

  if (!isProblemDbReadAllowed()) {
    return {
      problems: [],
      totalCount: 0,
      page: 1,
      pageSize,
      totalPages: 1,
      query,
      tagsText,
      minRating: minRatingText,
      maxRating: maxRatingText,
      sourceNote: "数据库读取尚未开启，因此题库为空。",
      dbLoaded: false,
      dbError: "DB read guard blocked",
    };
  }

  try {
    const prisma = getPrismaClient();
    const records = await prisma.problem.findMany({
      where: {
        source: "codeforces",
        ...(tags.length > 0 ? { tags: { hasEvery: tags } } : {}),
      },
      take: 30000,
      orderBy: [{ createdAt: "desc" }, { title: "asc" }, { id: "asc" }],
      select: {
        id: true,
        title: true,
        tags: true,
        source: true,
        sourceUrl: true,
        metadata: true,
        createdAt: true,
      },
    });

    const codeforcesProblems = records
      .map(mapProblemRecordToListItem)
      .filter((problem): problem is CodeforcesProblemListItem => problem !== null)
      .filter((problem) => matchesSearchFilter(problem, query))
      .filter((problem) => matchesCatalogPolicyFilter(problem))
      .filter((problem) => matchesRatingFilter(problem, minRating, maxRating));

    // Apply "hide completed" filter if requested
    let displayProblems = codeforcesProblems;
    if (options?.hideCompleted && options?.cfProblemStatusMap) {
      displayProblems = codeforcesProblems.filter((p) => {
        const key = buildCfProblemKey(p);
        const stat = options.cfProblemStatusMap!.get(key);
        return !stat || !stat.accepted;
      });
    }

    const totalCount = displayProblems.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const page = clampPage(requestedPage, totalPages);
    const start = (page - 1) * pageSize;
    const pageProblems = displayProblems.slice(start, start + pageSize);

    return {
      problems: pageProblems,
      totalCount,
      page,
      pageSize,
      totalPages,
      query,
      tagsText,
      minRating: minRatingText,
      maxRating: maxRatingText,
      sourceNote: totalCount === 0 ? EMPTY_CODEFORCES_NOTE : DEFAULT_SOURCE_NOTE,
      dbLoaded: true,
      dbError: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown DB error";

    return {
      problems: [],
      totalCount: 0,
      page: 1,
      pageSize,
      totalPages: 1,
      query,
      tagsText,
      minRating: minRatingText,
      maxRating: maxRatingText,
      sourceNote: DEFAULT_SOURCE_NOTE,
      dbLoaded: false,
      dbError: message,
    };
  }
}

function mapProblemRecordToListItem(record: {
  id: string;
  title: string;
  tags: string[];
  source: string | null;
  sourceUrl: string | null;
  metadata: unknown;
  createdAt?: Date | string | null;
}): CodeforcesProblemListItem | null {
  const metadata = mapProblemRecordToCodeforcesMetadata(record);
  if (metadata === null) {
    return null;
  }

  return {
    ...metadata,
    detailHref: `/problems/${encodeURIComponent(record.id)}`,
  };
}

function matchesSearchFilter(problem: CodeforcesProblemListItem, query: string): boolean {
  if (query.length === 0) {
    return true;
  }
  const normalized = query.toLowerCase();
  return (
    problem.title.toLowerCase().includes(normalized) ||
    problem.tags.some((tag) => tag.toLowerCase().includes(normalized))
  );
}

function normalizeSearchText(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return normalizeSearchText(value[0]);
  }

  if (typeof value !== "string") {
    return "";
  }

  return stripControlCharacters(value).trim();
}

function normalizeTagsText(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value.map((part) => normalizeTagsText(part)).filter(Boolean).join(", ");
  }

  if (typeof value !== "string") {
    return "";
  }

  return stripControlCharacters(value).trim();
}

function parseTags(value: string): string[] {
  if (!value) {
    return [];
  }

  const seen = new Set<string>();
  const tags: string[] = [];

  for (const rawTag of value.split(/[,;\n]+/)) {
    const tag = rawTag.trim().toLowerCase();
    if (!tag || seen.has(tag)) {
      continue;
    }

    seen.add(tag);
    tags.push(tag);
  }

  return tags;
}

function normalizeRatingText(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return normalizeRatingText(value[0]);
  }

  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/[^\d]/g, "").slice(0, 4);
}

function parseRating(value: string): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function matchesCatalogPolicyFilter(
  problem: CodeforcesProblemListItem,
  policy: CodeforcesCatalogPolicy = DEFAULT_CODEFORCES_CATALOG_POLICY,
): boolean {
  // Rating check
  if (problem.rating === null) {
    if (!policy.includeUnrated) {
      return false;
    }
  } else {
    if (problem.rating < policy.minRating) {
      return false;
    }
    if (problem.rating > policy.maxRating) {
      return false;
    }
  }

  // Exclude tags check (e.g. interactive)
  if (policy.excludeTags.length > 0 && Array.isArray(problem.tags)) {
    const lowerTags = new Set(
      problem.tags
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.toLowerCase()),
    );

    for (const excluded of policy.excludeTags) {
      if (lowerTags.has(excluded.toLowerCase())) {
        return false;
      }
    }
  }

  // Type check: only PROGRAMMING type problems are imported by the policy,
  // but we also check source to ensure only codeforces problems pass through.
  // Non-codeforces problems are already filtered out by mapProblemRecordToListItem.

  return true;
}

function matchesRatingFilter(
  problem: CodeforcesProblemListItem,
  minRating: number | null,
  maxRating: number | null,
): boolean {
  if (minRating === null && maxRating === null) {
    return true;
  }

  if (problem.rating === null) {
    return false;
  }

  if (minRating !== null && problem.rating < minRating) {
    return false;
  }

  if (maxRating !== null && problem.rating > maxRating) {
    return false;
  }

  return true;
}

function normalizePageNumber(value: string | string[] | undefined): number {
  if (Array.isArray(value)) {
    return normalizePageNumber(value[0]);
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    return 1;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
}

function normalizePageSize(value: string | string[] | undefined): number {
  if (Array.isArray(value)) {
    return normalizePageSize(value[0]);
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    return DEFAULT_PAGE_SIZE;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.min(Math.max(parsed, MIN_PAGE_SIZE), MAX_PAGE_SIZE);
}

function clampPage(page: number, totalPages: number): number {
  return Math.min(Math.max(page, 1), Math.max(totalPages, 1));
}

function isProblemDbReadAllowed(): boolean {
  try {
    if (!hasDatabaseUrl()) {
      return false;
    }

    if (process.env["LAP_ALLOW_REAL_DB_INTEGRATION"] !== "true") {
      return false;
    }

    if (process.env["LAP_IMPORT_DB_PERSIST_DEV_ENABLED"] !== "true") {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function stripControlCharacters(value: string): string {
  let result = "";
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    result += code < 32 || code === 127 ? " " : value[i];
  }
  return result;
}

function buildCfProblemKey(problem: { contestId: number | null; index: string | null }): string {
  if (problem.contestId !== null && problem.index !== null) {
    return `codeforces:${problem.contestId}:${problem.index}`;
  }
  return "";
}
