type ExternalApiProviderMode = "mock" | "blocked" | "external-dev";

interface ExternalApiDevGuardResult {
  providerMode: ExternalApiProviderMode;
  safeToExposeToClient: true;
  productionReady: false;
  allowed: boolean;
  blockedReason: string | null;
  requiredEnvNames: readonly string[];
  configuredEnvNames: readonly string[];
  missingEnvNames: readonly string[];
}

export interface ProblemPreviewItem {
  providerId: string;
  externalProblemId: string;
  title: string;
  difficulty: "easy" | "medium" | "hard" | "challenge" | "unknown";
  tags: string[];
  summary: string;
  sourceUrl: string;
  /** Enhanced fields — safe mapped from provider. */
  statement?: string;
  inputDescription?: string;
  outputDescription?: string;
  examples?: Array<{ input: string; output: string; explanation?: string }>;
  constraints?: string;
  source?: string;
}

export type ProblemApiDifficultyFilter = ProblemPreviewItem["difficulty"] | null;

export interface ProblemApiFilters {
  difficulty: ProblemApiDifficultyFilter;
  tags: string[];
  page: number;
  pageSize: number;
}

export interface ProblemPaginationPreview {
  page: number;
  pageSize: number;
  totalResults: number;
  totalPages: number;
  hasNextPage: boolean;
  nextPage: number | null;
}

export interface ProblemApiProviderSafetyMetadata {
  providerId: string;
  providerMode: ExternalApiProviderMode;
  productionReady: false;
  externalApiUsed: boolean;
  llmUsed: false;
  writesDatabase: false;
  rawResponseStored: false;
  safeToExposeToClient: true;
  guardBlocked: boolean;
  blockedReason: string | null;
  blockedReasons: string[];
  missingEnvNames: string[];
  fallbackSource: "builtin" | "empty" | "none";
}

export interface ProblemSearchParams {
  query: string;
  difficulty?: ProblemApiDifficultyFilter;
  tags?: readonly string[] | string;
  page?: number;
  pageSize?: number;
  maxResults?: number;
  language?: string;
}

export interface ProblemListParams {
  difficulty?: ProblemApiDifficultyFilter;
  tags?: readonly string[] | string;
  page?: number;
  pageSize?: number;
  maxResults?: number;
  language?: string;
}

export interface ProblemSearchResult {
  providerMode: ExternalApiProviderMode;
  safeToExposeToClient: true;
  productionReady: false;
  apiBlocked: boolean;
  blockedReason: string | null;
  error: string | null;
  missingEnvNames: string[];
  rawResponseStored: false;
  filters: ProblemApiFilters;
  paginationPreview: ProblemPaginationPreview;
  itemsPreview: ProblemPreviewItem[];
  problems: ProblemPreviewItem[];
  totalResults: number;
  query: string;
  safety: ProblemApiProviderSafetyMetadata;
}

export interface ProblemListResult {
  providerMode: ExternalApiProviderMode;
  safeToExposeToClient: true;
  productionReady: false;
  apiBlocked: boolean;
  blockedReason: string | null;
  error: string | null;
  missingEnvNames: string[];
  rawResponseStored: false;
  filters: ProblemApiFilters;
  paginationPreview: ProblemPaginationPreview;
  itemsPreview: ProblemPreviewItem[];
  problems: ProblemPreviewItem[];
  totalResults: number;
  safety: ProblemApiProviderSafetyMetadata;
}

export interface ProblemApiProvider {
  readonly providerId: string;
  readonly isRealApiEnabled: boolean;
  searchProblems(params: ProblemSearchParams): Promise<ProblemSearchResult>;
  listProblems(params?: ProblemListParams): Promise<ProblemListResult>;
  getGuardStatus(): ProblemApiProviderSafetyMetadata;
}

export interface ProblemApiProviderOptions {
  fetch?: SafeFetch;
  timeoutMs?: number;
  env?: {
    allowExternalProblemApi?: boolean;
    problemApiBaseUrl?: string | null;
    problemApiProvider?: string | null;
  };
}

export type SafeFetch = (
  url: string | URL,
  init?: { signal?: AbortSignal; headers?: Record<string, string> },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const MAX_PAGE_SIZE = 50;
const MAX_TAG_COUNT = 12;
const MAX_TAG_LENGTH = 48;
const MAX_QUERY_LENGTH = 200;
const MAX_ITEM_COUNT = 20;

export class GenericProblemApiProvider implements ProblemApiProvider {
  readonly providerId = "problem-api-dev";
  readonly #fetch: SafeFetch;
  readonly #timeoutMs: number;
  readonly #env: {
    allowExternalProblemApi: boolean;
    problemApiBaseUrl: string | null;
    problemApiProvider: string | null;
  };

  constructor(options: ProblemApiProviderOptions = {}) {
    this.#fetch = options.fetch ?? (globalThis as unknown as { fetch: SafeFetch }).fetch;
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.#env = options.env
      ? {
          allowExternalProblemApi: options.env.allowExternalProblemApi ?? false,
          problemApiBaseUrl: options.env.problemApiBaseUrl ?? null,
          problemApiProvider: options.env.problemApiProvider ?? null,
        }
      : {
          allowExternalProblemApi: parseBooleanEnv(readEnvString("LAP_ALLOW_EXTERNAL_PROBLEM_API") ?? undefined),
          problemApiBaseUrl: readEnvString("LAP_PROBLEM_API_BASE_URL"),
          problemApiProvider: readEnvString("LAP_PROBLEM_API_PROVIDER"),
        };
  }

  get isRealApiEnabled(): boolean {
    return this.#evaluateRawGuard().allowed;
  }

  getGuardStatus(): ProblemApiProviderSafetyMetadata {
    return this.#createSafety(this.#evaluateRawGuard(), false, "empty");
  }

  async searchProblems(params: ProblemSearchParams): Promise<ProblemSearchResult> {
    const guard = this.#evaluateRawGuard();
    const query = normalizeQuery(params.query);
    const filters = normalizeProblemFilters(params);

    if (!guard.allowed) {
      return this.#createEmptySearchResult(query, filters, guard);
    }

    const baseUrl = this.#env.problemApiBaseUrl!;
    const url = buildProblemApiUrl(baseUrl, "/search", query, filters, params.language);

    try {
      const data = await this.#safeFetchJson(url);
      const itemsPreview = this.#normalizeItems(data);
      const totalResults = extractTotalResults(data, itemsPreview.length);
      const paginationPreview = extractPaginationPreview(data, filters, totalResults, itemsPreview.length);
      const safety = this.#createSafety(guard, true, "none");

      return {
        providerMode: "external-dev",
        safeToExposeToClient: true,
        productionReady: false,
        apiBlocked: false,
        blockedReason: null,
        error: null,
        missingEnvNames: [],
        rawResponseStored: false,
        filters,
        paginationPreview,
        itemsPreview,
        problems: itemsPreview,
        totalResults,
        query,
        safety,
      };
    } catch (error) {
      return this.#createErrorSearchResult(query, filters, error);
    }
  }

  async listProblems(params: ProblemListParams = {}): Promise<ProblemListResult> {
    const guard = this.#evaluateRawGuard();
    const filters = normalizeProblemFilters(params);

    if (!guard.allowed) {
      return this.#createEmptyListResult(filters, guard);
    }

    const baseUrl = this.#env.problemApiBaseUrl!;
    const url = buildProblemApiUrl(baseUrl, "/list", "", filters, params.language);

    try {
      const data = await this.#safeFetchJson(url);
      const itemsPreview = this.#normalizeItems(data);
      const totalResults = extractTotalResults(data, itemsPreview.length);
      const paginationPreview = extractPaginationPreview(data, filters, totalResults, itemsPreview.length);
      const safety = this.#createSafety(guard, true, "none");

      return {
        providerMode: "external-dev",
        safeToExposeToClient: true,
        productionReady: false,
        apiBlocked: false,
        blockedReason: null,
        error: null,
        missingEnvNames: [],
        rawResponseStored: false,
        filters,
        paginationPreview,
        itemsPreview,
        problems: itemsPreview,
        totalResults,
        safety,
      };
    } catch (error) {
      return this.#createErrorListResult(filters, guard, error);
    }
  }

  #evaluateRawGuard(): ReturnType<typeof evaluateExternalApiDevGuard> {
    return evaluateExternalApiDevGuard({
      providerLabel: "Problem API",
      allowExternalEnvName: "LAP_ALLOW_EXTERNAL_PROBLEM_API",
      requiredEnvNames: ["LAP_PROBLEM_API_BASE_URL", "LAP_PROBLEM_API_PROVIDER"],
      env: {
        NODE_ENV: safeReadNodeEnv(),
        LAP_ALLOW_EXTERNAL_PROBLEM_API: this.#env.allowExternalProblemApi ? "1" : undefined,
        LAP_PROBLEM_API_BASE_URL: this.#env.problemApiBaseUrl ?? undefined,
        LAP_PROBLEM_API_PROVIDER: this.#env.problemApiProvider ?? undefined,
      },
    });
  }

  #createSafety(
    guard: ReturnType<typeof evaluateExternalApiDevGuard>,
    externalApiUsed: boolean,
    fallbackSource: "builtin" | "empty" | "none",
  ): ProblemApiProviderSafetyMetadata {
    return {
      providerId: this.providerId,
      providerMode: guard.providerMode,
      productionReady: false,
      externalApiUsed,
      llmUsed: false,
      writesDatabase: false,
      rawResponseStored: false,
      safeToExposeToClient: true,
      guardBlocked: !guard.allowed,
      blockedReason: guard.blockedReason,
      blockedReasons: guard.blockedReason ? [guard.blockedReason] : [],
      missingEnvNames: [...guard.missingEnvNames],
      fallbackSource,
    };
  }

  #createEmptySearchResult(
    query: string,
    filters: ProblemApiFilters,
    guard: ReturnType<typeof evaluateExternalApiDevGuard>,
  ): ProblemSearchResult {
    const safety = this.#createSafety(guard, false, "empty");
    return {
      providerMode: "blocked",
      safeToExposeToClient: true,
      productionReady: false,
      apiBlocked: true,
      blockedReason: safety.blockedReason,
      error: null,
      missingEnvNames: safety.missingEnvNames,
      rawResponseStored: false,
      filters,
      paginationPreview: createEmptyPaginationPreview(filters),
      itemsPreview: [],
      problems: [],
      totalResults: 0,
      query,
      safety,
    };
  }

  #createErrorSearchResult(
    query: string,
    filters: ProblemApiFilters,
    error: unknown,
  ): ProblemSearchResult {
    const guard = this.#evaluateRawGuard();
    const safety = this.#createSafety(guard, false, "empty");
    const safeMessage = safeProblemApiErrorMessage(error);
    const blockedReason = `PROVIDER_ERROR: ${safeMessage}`;

    return {
      providerMode: "blocked",
      safeToExposeToClient: true,
      productionReady: false,
      apiBlocked: true,
      blockedReason,
      error: safeMessage,
      missingEnvNames: safety.missingEnvNames,
      rawResponseStored: false,
      filters,
      paginationPreview: createEmptyPaginationPreview(filters),
      itemsPreview: [],
      problems: [],
      totalResults: 0,
      query,
      safety: {
        ...safety,
        providerMode: "blocked",
        guardBlocked: true,
        blockedReason,
        blockedReasons: [blockedReason],
      },
    };
  }

  #createEmptyListResult(
    filters: ProblemApiFilters,
    guard: ReturnType<typeof evaluateExternalApiDevGuard>,
  ): ProblemListResult {
    const safety = this.#createSafety(guard, false, "empty");
    return {
      providerMode: "blocked",
      safeToExposeToClient: true,
      productionReady: false,
      apiBlocked: true,
      blockedReason: safety.blockedReason,
      error: null,
      missingEnvNames: safety.missingEnvNames,
      rawResponseStored: false,
      filters,
      paginationPreview: createEmptyPaginationPreview(filters),
      itemsPreview: [],
      problems: [],
      totalResults: 0,
      safety,
    };
  }

  #createErrorListResult(
    filters: ProblemApiFilters,
    guard: ReturnType<typeof evaluateExternalApiDevGuard>,
    error: unknown,
  ): ProblemListResult {
    const safeMessage = safeProblemApiErrorMessage(error);
    const blockedReason = `PROVIDER_ERROR: ${safeMessage}`;
    const safety = this.#createSafety(guard, false, "empty");

    return {
      providerMode: "blocked",
      safeToExposeToClient: true,
      productionReady: false,
      apiBlocked: true,
      blockedReason,
      error: safeMessage,
      missingEnvNames: safety.missingEnvNames,
      rawResponseStored: false,
      filters,
      paginationPreview: createEmptyPaginationPreview(filters),
      itemsPreview: [],
      problems: [],
      totalResults: 0,
      safety: {
        ...safety,
        providerMode: "blocked",
        guardBlocked: true,
        blockedReason,
        blockedReasons: [blockedReason],
      },
    };
  }

  async #safeFetchJson(url: string): Promise<unknown> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.#timeoutMs);

    try {
      const response = await this.#fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: upstream problem API returned non-OK status`);
      }

      const data = await response.json();
      if (data === null || data === undefined) {
        throw new Error("Upstream problem API returned null/undefined body");
      }

      return data;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error(`Request timed out after ${this.#timeoutMs}ms`);
      }
      if (error instanceof Error && error.message.startsWith("HTTP ")) {
        throw error;
      }
      throw new Error("Problem API request failed");
    } finally {
      clearTimeout(timeoutId);
    }
  }

  #normalizeItems(data: unknown): ProblemPreviewItem[] {
    const items = extractItemsArray(data);
    return items.slice(0, MAX_ITEM_COUNT).map((item) => normalizeProblemItem(item, this.providerId));
  }
}

export function createProblemApiProvider(
  options?: ProblemApiProviderOptions,
): ProblemApiProvider {
  return new GenericProblemApiProvider(options);
}

function extractItemsArray(data: unknown): unknown[] {
  if (!isRecord(data)) {
    return [];
  }

  if (Array.isArray(data.items)) {
    return data.items;
  }

  if (Array.isArray(data.problems)) {
    return data.problems;
  }

  if (Array.isArray(data.results)) {
    return data.results;
  }

  if (Array.isArray(data.data)) {
    return data.data;
  }

  return [];
}

function extractTotalResults(data: unknown, fallbackCount: number): number {
  if (!isRecord(data)) {
    return fallbackCount;
  }

  const candidate = data.totalResults ?? data.total ?? data.count ?? data.numFound;
  if (typeof candidate === "number" && Number.isFinite(candidate) && candidate >= 0) {
    return candidate;
  }

  return fallbackCount;
}

function extractPaginationPreview(
  data: unknown,
  filters: ProblemApiFilters,
  totalResults: number,
  itemCount: number,
): ProblemPaginationPreview {
  const pagination = isRecord(data) && isRecord(data.pagination) ? data.pagination : null;
  const page = normalizePositiveInteger(
    extractNumberLike(pagination?.page ?? (isRecord(data) ? data.page : undefined), filters.page),
    filters.page,
  );
  const pageSize = clampNumber(
    normalizePositiveInteger(
      extractNumberLike(
        pagination?.pageSize ??
          pagination?.limit ??
          (isRecord(data) ? data.pageSize ?? data.limit : undefined),
        filters.pageSize,
      ),
      filters.pageSize,
    ),
    1,
    MAX_PAGE_SIZE,
  );
  const hasNextPage = normalizeBooleanLike(
    pagination?.hasNextPage ?? (isRecord(data) ? data.hasNextPage : undefined),
    page * pageSize < totalResults || itemCount >= pageSize,
  );
  const totalPages = totalResults <= 0 ? 0 : Math.max(1, Math.ceil(totalResults / pageSize));

  return {
    page,
    pageSize,
    totalResults,
    totalPages,
    hasNextPage,
    nextPage: hasNextPage ? page + 1 : null,
  };
}

function createEmptyPaginationPreview(filters: ProblemApiFilters): ProblemPaginationPreview {
  return {
    page: filters.page,
    pageSize: filters.pageSize,
    totalResults: 0,
    totalPages: 0,
    hasNextPage: false,
    nextPage: null,
  };
}

function normalizeProblemItem(item: unknown, providerId: string): ProblemPreviewItem {
  if (!isRecord(item)) {
    return {
      providerId,
      externalProblemId: "unknown",
      title: "Unknown problem",
      difficulty: "unknown",
      tags: [],
      summary: "",
      sourceUrl: "",
    };
  }

  const externalProblemId =
    safeString(item.id) ||
    safeString(item.problemId) ||
    safeString(item.slug) ||
    safeString(item.externalProblemId) ||
    "unknown";

  const title = safeString(item.title) || safeString(item.name) || "Unknown problem";

  const difficulty = normalizeDifficulty(safeString(item.difficulty) || safeString(item.level));

  const tags = normalizeTags(item.tags ?? item.labels ?? item.topics ?? item.categories);
  const summary =
    safeString(item.summary) ||
    safeString(item.description) ||
    safeString(item.statementPreview) ||
    "";
  const sourceUrl =
    safeString(item.sourceUrl) ||
    safeString(item.url) ||
    safeString(item.link) ||
    "";

  // Enhanced fields — safe mapping from provider
  const statement =
    safeString(item.statement) ||
    safeString(item.fullDescription) ||
    safeString(item.problemStatement) ||
    undefined;
  const inputDescription =
    safeString(item.inputDescription) ||
    safeString(item.inputFormat) ||
    safeString(item.input) ||
    undefined;
  const outputDescription =
    safeString(item.outputDescription) ||
    safeString(item.outputFormat) ||
    safeString(item.output) ||
    undefined;
  const constraints =
    safeString(item.constraints) ||
    safeString(item.limits) ||
    safeString(item.notes) ||
    undefined;
  const source =
    safeString(item.source) ||
    safeString(item.platform) ||
    providerId;

  // Normalize examples if present
  let examples: Array<{ input: string; output: string; explanation?: string }> | undefined;
  const rawExamples = item.examples ?? item.sampleInputs ?? item.sampleTestcases;
  if (Array.isArray(rawExamples) && rawExamples.length > 0 && rawExamples.length <= 10) {
    examples = rawExamples.map((ex: unknown) => {
      if (!isRecord(ex)) return { input: "", output: "" };
      return {
        input: safeString(ex.input) ?? safeString(ex.stdin) ?? "",
        output: safeString(ex.output) ?? safeString(ex.stdout) ?? safeString(ex.expectedOutput) ?? "",
        explanation: safeString(ex.explanation) ?? safeString(ex.note) ?? undefined,
      };
    }).filter((ex) => ex.input || ex.output);
    if (examples.length === 0) examples = undefined;
  }

  return {
    providerId,
    externalProblemId,
    title: truncateSafe(title, 200),
    difficulty,
    tags,
    summary: truncateSafe(summary, 500),
    sourceUrl: truncateSafe(sourceUrl, 2000),
    statement: statement ? truncateSafe(statement, 10000) : undefined,
    inputDescription: inputDescription ? truncateSafe(inputDescription, 2000) : undefined,
    outputDescription: outputDescription ? truncateSafe(outputDescription, 2000) : undefined,
    examples,
    constraints: constraints ? truncateSafe(constraints, 2000) : undefined,
    source,
  };
}

function normalizeProblemFilters(
  params: {
    difficulty?: ProblemApiDifficultyFilter;
    tags?: readonly string[] | string;
    page?: number;
    pageSize?: number;
    maxResults?: number;
  },
): ProblemApiFilters {
  return {
    difficulty: normalizeDifficultyFilter(params.difficulty),
    tags: normalizeTags(params.tags),
    page: normalizePositiveInteger(params.page, 1),
    pageSize: clampNumber(
      normalizePositiveInteger(params.pageSize ?? params.maxResults, 10),
      1,
      MAX_PAGE_SIZE,
    ),
  };
}

function normalizeDifficulty(value: string | null): ProblemPreviewItem["difficulty"] {
  if (value === null) {
    return "unknown";
  }

  const normalized = value.trim().toLowerCase();
  if (
    normalized === "easy" ||
    normalized === "medium" ||
    normalized === "hard" ||
    normalized === "challenge"
  ) {
    return normalized;
  }

  return "unknown";
}

function normalizeDifficultyFilter(
  value: ProblemApiDifficultyFilter | undefined,
): ProblemApiDifficultyFilter {
  if (value === undefined || value === null) {
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

function normalizeTags(value: unknown): string[] {
  if (value === undefined) {
    return [];
  }

  const rawEntries = Array.isArray(value) ? value : [value];
  const flattened = rawEntries.flatMap((entry) => splitTagTokens(entry));
  const result: string[] = [];
  const seen = new Set<string>();

  for (const tag of flattened) {
    const dedupeKey = tag.toLowerCase();
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    result.push(tag);

    if (result.length >= MAX_TAG_COUNT) {
      break;
    }
  }

  return result;
}

function splitTagTokens(value: unknown): string[] {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(/[\s,;]+/)
    .map((entry) => normalizeTextToken(entry))
    .filter((entry): entry is string => entry !== null);
}

function normalizeTextToken(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  if (normalized.length === 0) {
    return null;
  }

  return truncateSafe(normalized, MAX_TAG_LENGTH);
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  const intValue = Math.trunc(value);
  if (intValue <= 0) {
    return fallback;
  }

  return intValue;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function extractNumberLike(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function normalizeBooleanLike(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "1" || normalized === "true" || normalized === "yes") {
      return true;
    }
    if (normalized === "0" || normalized === "false" || normalized === "no") {
      return false;
    }
  }

  return fallback;
}

function buildProblemApiUrl(
  baseUrl: string,
  path: "/search" | "/list",
  query: string,
  filters: ProblemApiFilters,
  language?: string,
): string {
  const url = new URL(path, ensureTrailingSlash(baseUrl));
  const params = url.searchParams;

  if (query.length > 0) {
    params.set("q", query);
  }

  if (filters.difficulty) {
    params.set("difficulty", filters.difficulty);
  }

  for (const tag of filters.tags) {
    params.append("tags", tag);
  }

  params.set("page", String(filters.page));
  params.set("pageSize", String(filters.pageSize));

  if (language && language.trim().length > 0) {
    params.set("language", language.trim());
  }

  return url.toString();
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeQuery(value: string): string {
  return truncateSafe(value.replace(/[\u0000-\u001f\u007f]/g, " "), MAX_QUERY_LENGTH).trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeString(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function readEnvString(key: string): string | null {
  try {
    const value = process.env[key];
    return value && value.trim().length > 0 ? value.trim() : null;
  } catch {
    return null;
  }
}

function safeReadNodeEnv(): string | undefined {
  try {
    return process.env.NODE_ENV;
  } catch {
    return undefined;
  }
}

function parseBooleanEnv(value: string | undefined): boolean {
  if (value === undefined) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function evaluateExternalApiDevGuard(input: {
  providerLabel: string;
  allowExternalEnvName: string;
  requiredEnvNames: readonly string[];
  env: Record<string, string | undefined>;
}): ExternalApiDevGuardResult {
  const missingEnvNames = new Set<string>();
  const configuredEnvNames = new Set<string>();
  const blockedReasons: string[] = [];
  const allowExternalEnabled = parseBooleanEnv(input.env[input.allowExternalEnvName]);

  if (input.env.NODE_ENV === "production") {
    blockedReasons.push(
      `${input.providerLabel.toUpperCase().replace(/\s+/g, "_")}_PRODUCTION_BLOCKED: NODE_ENV is production; external preview remains disabled.`,
    );
  }

  if (!allowExternalEnabled) {
    missingEnvNames.add(input.allowExternalEnvName);
    blockedReasons.push(
      `${input.allowExternalEnvName} is not enabled; external preview remains disabled.`,
    );
  } else {
    configuredEnvNames.add(input.allowExternalEnvName);
  }

  for (const name of input.requiredEnvNames) {
    const value = input.env[name];
    if (value === undefined || value.trim().length === 0) {
      missingEnvNames.add(name);
    } else {
      configuredEnvNames.add(name);
    }
  }

  if (missingEnvNames.size > 0) {
    blockedReasons.push(`Missing env: ${Array.from(missingEnvNames).join(", ")}`);
  }

  const requiredEnvNames = [
    input.allowExternalEnvName,
    ...input.requiredEnvNames,
  ];
  const allowed = blockedReasons.length === 0;

  return {
    providerMode: allowed ? "external-dev" : "blocked",
    safeToExposeToClient: true,
    productionReady: false,
    allowed,
    blockedReason: blockedReasons[0] ?? null,
    requiredEnvNames,
    configuredEnvNames: Array.from(configuredEnvNames),
    missingEnvNames: Array.from(missingEnvNames),
  };
}

function safeProblemApiErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.startsWith("HTTP ")) {
      return error.message;
    }

    if (error.message.startsWith("Request timed out after ")) {
      return error.message;
    }
  }

  return "Problem API request failed";
}

function truncateSafe(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}
