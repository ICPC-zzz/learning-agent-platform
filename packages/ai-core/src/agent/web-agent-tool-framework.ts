/**
 * Web Agent tool framework.
 *
 * This module keeps the Web Agent preview path structured and safe:
 * - tool registry is metadata-first
 * - tool execution stays preview-only and read-only
 * - skill candidates are advisory previews only
 */

import { evaluateWebAgentNetworkDevGuard, type WebAgentNetworkDevGuardResult } from "./web-agent-network-dev-guard.ts";
import {
  createWebAgentToolExecutionResultFromMcpCallResult,
  executeMcpConnectorCallPreview,
} from "./web-agent-mcp-connector-runtime.ts";
import type { McpConnectorRuntimeEnv } from "./web-agent-mcp-connector-runtime.ts";

export const WebAgentToolName = {
  ListBooks: "listBooks",
  GetReadingProgressSummary: "getReadingProgressSummary",
  GetBookDetail: "getBookDetail",
  GithubListIssues: "githubListIssues",
  GithubGetRepoSummary: "githubGetRepoSummary",
  SafeWebFetch: "safeWebFetch",
} as const;

export type WebAgentToolName =
  (typeof WebAgentToolName)[keyof typeof WebAgentToolName];

export type WebAgentToolRiskLevel = "low" | "medium" | "high" | "critical";

export interface WebAgentToolInputField {
  name: string;
  type: "string" | "number" | "boolean";
  required: boolean;
  description: string;
  example?: string;
}

export interface WebAgentToolInputSchema {
  type: "object";
  fields: readonly WebAgentToolInputField[];
}

export interface WebAgentToolDefinition {
  toolId: WebAgentToolName;
  displayName: string;
  description: string;
  inputSchema: WebAgentToolInputSchema;
  riskLevel: WebAgentToolRiskLevel;
  readOnly: true;
  safeToExposeToClient: true;
  enabledByDefault: false;
  productionReady: false;
}

export interface WebAgentToolExecutionPreviewInput {
  message: string;
  toolId: WebAgentToolName;
  toolPreviewEnabled: boolean;
  toolInput: Record<string, unknown>;
  dataLoaders: WebAgentToolDataLoaders;
  fetchImpl?: typeof globalThis.fetch;
  networkGuard?: WebAgentNetworkDevGuardResult;
  mcpConnectorEnv?: McpConnectorRuntimeEnv;
}

export interface WebAgentToolExecutionResult {
  toolId: WebAgentToolName | null;
  status: "success" | "error" | "blocked";
  safeToExposeToClient: true;
  providerMode?: "fake" | "live" | "blocked";
  githubRepoAccessStatus?: "allowed" | "blocked" | "not_checked";
  toolResultPreview: string | null;
  finalUrl?: string | null;
  contentType?: string | null;
  textPreview?: string | null;
  truncated?: boolean;
  blockedReason: string | null;
  errorReason: string | null;
  warnings: readonly string[];
  inputSummary: string;
  readOnly: true;
  enabledByDefault: false;
  productionReady: false;
}

export type WebAgentToolExecutionEnvelope = WebAgentToolExecutionResult;

export interface WebAgentToolInputValidationResult {
  valid: boolean;
  blockedReason: string | null;
  warnings: readonly string[];
  normalizedInput: Record<string, unknown>;
  inputSummary: string;
  productionReady: false;
}

export interface WebAgentSkillCandidatePreview {
  name: string;
  description: string;
  triggerHints: readonly string[];
  requiredTools: readonly WebAgentToolName[];
  safetyNotes: readonly string[];
  productionReady: false;
}

export interface WebAgentBookSummary {
  bookId: string;
  title: string;
  author: string | null;
  sourceType: string;
  createdAt: string;
}

export interface WebAgentBookChapterSummary {
  chapterId: string;
  title: string;
  orderIndex: number;
  summary: string | null;
}

export interface WebAgentBookDetailSummary {
  book: WebAgentBookSummary;
  chapters: readonly WebAgentBookChapterSummary[];
}

export interface WebAgentReadingProgressSummaryRecord {
  bookId: string;
  bookTitle: string;
  chapterId: string;
  chapterTitle: string;
  progressRatio: number;
  updatedAt: string;
}

export interface WebAgentReadingProgressSummary {
  userLabel: string;
  records: readonly WebAgentReadingProgressSummaryRecord[];
}

export interface WebAgentToolDataLoaders {
  listBooks(limit: number): Promise<readonly WebAgentBookSummary[]>;
  getBookDetail(bookId: string): Promise<WebAgentBookDetailSummary | null>;
  getReadingProgressSummary(limit: number): Promise<WebAgentReadingProgressSummary | null>;
}

const DEFAULT_PREVIEW_LIMIT = 5;
const DEFAULT_PROGRESS_LIMIT = 5;
const DEFAULT_PREVIEW_CHARS = 880;
const DEFAULT_SAFE_WEB_FETCH_TIMEOUT_MS = 2_500;
const MAX_SAFE_WEB_FETCH_TIMEOUT_MS = 5_000;
const DEFAULT_SAFE_WEB_FETCH_MAX_BYTES = 4_096;
const MAX_SAFE_WEB_FETCH_MAX_BYTES = 8_192;
const MAX_SAFE_WEB_FETCH_REDIRECTS = 3;

const registry: readonly WebAgentToolDefinition[] = [
  {
    toolId: WebAgentToolName.ListBooks,
    displayName: "listBooks",
    description:
      "Read-only preview of saved books. Returns a short safe list only.",
    inputSchema: {
      type: "object",
      fields: [
        {
          name: "limit",
          type: "number",
          required: false,
          description: "Optional preview limit for the number of books.",
          example: "5",
        },
      ],
    },
    riskLevel: "low",
    readOnly: true,
    safeToExposeToClient: true,
    enabledByDefault: false,
    productionReady: false,
  },
  {
    toolId: WebAgentToolName.GetReadingProgressSummary,
    displayName: "getReadingProgressSummary",
    description:
      "Read-only preview of recent reading progress. Returns a short safe summary only.",
    inputSchema: {
      type: "object",
      fields: [
        {
          name: "limit",
          type: "number",
          required: false,
          description: "Optional preview limit for the number of progress rows.",
          example: "5",
        },
      ],
    },
    riskLevel: "low",
    readOnly: true,
    safeToExposeToClient: true,
    enabledByDefault: false,
    productionReady: false,
  },
  {
    toolId: WebAgentToolName.GetBookDetail,
    displayName: "getBookDetail",
    description:
      "Read-only preview of one saved book and its chapter summaries. Uses a preview-safe fallback when no bookId is supplied.",
    inputSchema: {
      type: "object",
      fields: [
        {
          name: "bookId",
          type: "string",
          required: false,
          description:
            "Optional book id. When omitted, the preview may auto-select the newest saved book.",
          example: "book-123",
        },
      ],
    },
    riskLevel: "low",
    readOnly: true,
    safeToExposeToClient: true,
    enabledByDefault: false,
    productionReady: false,
  },
  {
    toolId: WebAgentToolName.SafeWebFetch,
    displayName: "safeWebFetch",
    description:
      "Dev-only read-only web fetch preview. Fetches a safe HTTPS or HTTP page and returns a short sanitized text preview only.",
    inputSchema: {
      type: "object",
      fields: [
        {
          name: "url",
          type: "string",
          required: true,
          description: "Target http or https URL to preview safely.",
          example: "https://example.com",
        },
        {
          name: "maxBytes",
          type: "number",
          required: false,
          description: "Optional preview byte cap for the fetched response body.",
          example: "4096",
        },
        {
          name: "timeoutMs",
          type: "number",
          required: false,
          description: "Optional request timeout in milliseconds.",
          example: "2500",
        },
      ],
    },
    riskLevel: "critical",
    readOnly: true,
    safeToExposeToClient: true,
    enabledByDefault: false,
    productionReady: false,
  },
  {
    toolId: WebAgentToolName.GithubListIssues,
    displayName: "githubListIssues",
    description:
      "Dev-only read-only GitHub issues preview. Returns a short sanitized issue list only.",
    inputSchema: {
      type: "object",
      fields: [
        {
          name: "repoFullName",
          type: "string",
          required: true,
          description: "GitHub repository in owner/name form.",
          example: "openai/openai",
        },
        {
          name: "state",
          type: "string",
          required: false,
          description: "Optional issue state filter.",
          example: "open",
        },
        {
          name: "perPage",
          type: "number",
          required: false,
          description: "Optional preview limit for issue rows.",
          example: "5",
        },
        {
          name: "limit",
          type: "number",
          required: false,
          description: "Legacy alias for perPage.",
          example: "5",
        },
      ],
    },
    riskLevel: "high",
    readOnly: true,
    safeToExposeToClient: true,
    enabledByDefault: false,
    productionReady: false,
  },
  {
    toolId: WebAgentToolName.GithubGetRepoSummary,
    displayName: "githubGetRepoSummary",
    description:
      "Dev-only read-only GitHub repository summary preview. Returns repo metadata plus a short issue preview only.",
    inputSchema: {
      type: "object",
      fields: [
        {
          name: "repoFullName",
          type: "string",
          required: true,
          description: "GitHub repository in owner/name form.",
          example: "openai/openai",
        },
        {
          name: "issueNumber",
          type: "number",
          required: false,
          description: "Optional issue number to fetch a single issue detail preview.",
          example: "123",
        },
        {
          name: "perPage",
          type: "number",
          required: false,
          description: "Optional issue preview count when a list preview is included.",
          example: "3",
        },
      ],
    },
    riskLevel: "high",
    readOnly: true,
    safeToExposeToClient: true,
    enabledByDefault: false,
    productionReady: false,
  },
] as const;

const listBooksKeywords = [
  "list books",
  "books",
  "book list",
  "library",
  "book summary",
  "book summaries",
  "书",
  "书籍",
  "书单",
];

const readingProgressKeywords = [
  "reading progress",
  "progress",
  "progress summary",
  "recent reading",
  "reading status",
  "阅读进度",
  "进度",
  "最近阅读",
];

const bookDetailKeywords = [
  "book detail",
  "book details",
  "detail",
  "details",
  "chapter summary",
  "chapter summaries",
  "book info",
  "查看书籍详情",
  "书籍详情",
  "书详情",
  "章节摘要",
];

const safeWebFetchKeywords = [
  "safe web fetch",
  "safe fetch",
  "web fetch",
  "fetch url",
  "fetch webpage",
  "fetch website",
  "open url",
  "open website",
  "browse url",
  "webpage",
  "website",
  "网页",
  "网页获取",
  "网站",
];

const githubListIssuesKeywords = [
  "github issues",
  "github issue",
  "list github issues",
  "list issues",
  "issue list",
  "open issues",
  "github repo issues",
  "github issues list",
  "github list issues",
  "github issue preview",
];

const githubRepoSummaryKeywords = [
  "github repo summary",
  "repo summary",
  "repository summary",
  "github repository summary",
  "github repo info",
  "github repository info",
  "repo info",
  "repository info",
  "github summary",
];

export function getWebAgentToolRegistry(): readonly WebAgentToolDefinition[] {
  return registry.map((tool) => cloneWebAgentToolDefinition(tool));
}

export function getWebAgentReadOnlyToolRegistry(): readonly WebAgentToolDefinition[] {
  return getWebAgentToolRegistry();
}

export function createWebAgentToolRegistryMetadata(
  tools: readonly WebAgentToolDefinition[] = registry,
): readonly WebAgentToolDefinition[] {
  return tools.map((tool) => cloneWebAgentToolDefinition(tool));
}

export function isWebAgentToolName(value: unknown): value is WebAgentToolName {
  return (
    typeof value === "string" &&
    (Object.values(WebAgentToolName) as readonly string[]).includes(value)
  );
}

export function isWebAgentReadOnlyToolName(
  value: unknown,
): value is WebAgentToolName {
  return isWebAgentToolName(value);
}

export function validateWebAgentToolInput(
  tool: WebAgentToolDefinition,
  input: Record<string, unknown>,
): WebAgentToolInputValidationResult {
  if (tool.readOnly !== true || tool.safeToExposeToClient !== true) {
    return {
      valid: false,
      blockedReason: "unsafe_tool_definition",
      warnings: [
        "The tool definition failed the read-only safety boundary.",
      ],
      normalizedInput: {},
      inputSummary: buildToolInputSummary(input),
      productionReady: false,
    };
  }

  const normalizedInput: Record<string, unknown> = {};

  for (const field of tool.inputSchema.fields) {
    const value = input[field.name];

    if (value === undefined) {
      if (field.required) {
        return {
          valid: false,
          blockedReason: `missing_required_field:${field.name}`,
          warnings: [`Missing required tool input field: ${field.name}.`],
          normalizedInput,
          inputSummary: buildToolInputSummary(normalizedInput),
          productionReady: false,
        };
      }

      continue;
    }

    if (!isFieldTypeMatch(field.type, value)) {
      return {
        valid: false,
        blockedReason: `invalid_field_type:${field.name}`,
        warnings: [
          `Invalid input type for field ${field.name}; expected ${field.type}.`,
        ],
        normalizedInput,
        inputSummary: buildToolInputSummary(normalizedInput),
        productionReady: false,
      };
    }

    normalizedInput[field.name] = value;
  }

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || key in normalizedInput) {
      continue;
    }

    normalizedInput[key] = value;
  }

  return {
    valid: true,
    blockedReason: null,
    warnings: [],
    normalizedInput,
    inputSummary: buildToolInputSummary(normalizedInput),
    productionReady: false,
  };
}

export function cloneWebAgentToolDefinition(
  tool: WebAgentToolDefinition,
): WebAgentToolDefinition {
  return {
    ...tool,
    inputSchema: {
      ...tool.inputSchema,
      fields: tool.inputSchema.fields.map((field) => ({ ...field })),
    },
  };
}

export function inferWebAgentToolName(message: string): WebAgentToolName | null {
  const normalized = normalizeText(message);

  if (normalized.length === 0) {
    return null;
  }

  if (bookDetailKeywords.some((keyword) => normalized.includes(keyword))) {
    return WebAgentToolName.GetBookDetail;
  }

  if (listBooksKeywords.some((keyword) => normalized.includes(keyword))) {
    return WebAgentToolName.ListBooks;
  }

  if (
    readingProgressKeywords.some((keyword) => normalized.includes(keyword))
  ) {
    return WebAgentToolName.GetReadingProgressSummary;
  }

  if (
    githubRepoSummaryKeywords.some((keyword) => normalized.includes(keyword))
  ) {
    return WebAgentToolName.GithubGetRepoSummary;
  }

  if (githubListIssuesKeywords.some((keyword) => normalized.includes(keyword))) {
    return WebAgentToolName.GithubListIssues;
  }

  if (containsSafeWebFetchHint(normalized)) {
    return WebAgentToolName.SafeWebFetch;
  }

  return null;
}

export function inferWebAgentReadOnlyToolName(
  message: string,
): WebAgentToolName | null {
  return inferWebAgentToolName(message);
}

export async function executeWebAgentToolPreview(
  input: WebAgentToolExecutionPreviewInput,
): Promise<WebAgentToolExecutionResult> {
  if (!input.toolPreviewEnabled) {
    return createBlockedToolResult(
      input.toolId,
      "tool_preview_disabled_by_default",
      "Read-only tool previews are disabled by default.",
      "Tool preview was requested but the preview toggle is off.",
      buildToolInputSummary(input.toolInput),
    );
  }

  try {
    if (input.toolId === WebAgentToolName.ListBooks) {
      const limit = normalizePositiveInteger(
        readNumber(input.toolInput.limit),
        DEFAULT_PREVIEW_LIMIT,
      );
      const books = await input.dataLoaders.listBooks(limit);

      return createSuccessToolResult({
        toolId: input.toolId,
        inputSummary: buildToolInputSummary({ limit }),
        preview: buildBooksPreview(books, limit),
        warnings: [
          "Read-only book summary loaded without writing to the database.",
        ],
      });
    }

    if (input.toolId === WebAgentToolName.GetReadingProgressSummary) {
      const limit = normalizePositiveInteger(
        readNumber(input.toolInput.limit),
        DEFAULT_PROGRESS_LIMIT,
      );
      const summary = await input.dataLoaders.getReadingProgressSummary(limit);

      if (summary === null) {
        return createBlockedToolResult(
          input.toolId,
          "no_reading_progress_available",
          "No demo user or reading progress records were available.",
          "Read-only reading progress preview could not find a safe summary.",
          buildToolInputSummary({ limit }),
        );
      }

      return createSuccessToolResult({
        toolId: input.toolId,
        inputSummary: buildToolInputSummary({ limit }),
        preview: buildReadingProgressPreview(summary, limit),
        warnings: [
          "Read-only reading progress summary loaded without writing to the database.",
        ],
      });
    }

    if (input.toolId === WebAgentToolName.SafeWebFetch) {
      return executeSafeWebFetchPreview({
        toolInput: input.toolInput,
        fetchImpl: input.fetchImpl,
        networkGuard:
          input.networkGuard ??
          evaluateWebAgentNetworkDevGuard({
            LAP_WEB_AGENT_NETWORK_DEV_ENABLED:
              process.env.LAP_WEB_AGENT_NETWORK_DEV_ENABLED,
            LAP_ALLOW_AGENT_NETWORK: process.env.LAP_ALLOW_AGENT_NETWORK,
            NODE_ENV: process.env.NODE_ENV,
          }),
      });
    }

    if (
      input.toolId === WebAgentToolName.GithubListIssues ||
      input.toolId === WebAgentToolName.GithubGetRepoSummary
    ) {
      const result = await executeMcpConnectorCallPreview({
        connectorId: "github",
        toolId: input.toolId,
        toolInput: input.toolInput,
        messagePreview: input.message,
        toolPreviewEnabled: input.toolPreviewEnabled,
        fetchImpl: input.fetchImpl,
        env: createMcpConnectorRuntimeEnvPreview(input.mcpConnectorEnv),
      });

      return createWebAgentToolExecutionResultFromMcpCallResult(result);
    }

    const requestedBookId = normalizeOptionalText(
      readString(input.toolInput.bookId),
    );
    const detail = await resolveBookDetailPreview(
      input.dataLoaders,
      requestedBookId,
    );

    if (detail.result === null) {
      return createBlockedToolResult(
        input.toolId,
        "book_not_found",
        "No saved book detail was available for preview.",
        "The book detail preview could not find a matching saved book.",
        buildToolInputSummary({
          ...(requestedBookId === null ? {} : { bookId: requestedBookId }),
        }),
      );
    }

    return createSuccessToolResult({
      toolId: input.toolId,
      inputSummary: buildToolInputSummary(
        requestedBookId === null
          ? { bookId: `[auto-selected] ${detail.result.book.bookId}` }
          : { bookId: requestedBookId },
      ),
      preview: buildBookDetailPreview(detail.result, detail.resolutionNote),
      warnings: detail.warnings,
    });
  } catch {
    return createErrorToolResult(
      input.toolId,
      "preview_execution_failed_safely",
      "The read-only tool preview failed safely before exposing raw data.",
      buildToolInputSummary(input.toolInput),
    );
  }
}

export function createWebAgentSkillCandidatePreview(input: {
  message: string;
  toolId: WebAgentToolName | null;
  toolExecution: WebAgentToolExecutionResult;
}): WebAgentSkillCandidatePreview {
  const toolDisplayName =
    registry.find((tool) => tool.toolId === input.toolId)?.displayName ??
    "web-agent";
  const triggerHints = createTriggerHints(input.message, input.toolId);
  const description = buildSkillDescription(
    input.message,
    toolDisplayName,
    input.toolExecution.status,
  );

  return {
    name: buildSkillName(input.toolId, toolDisplayName),
    description,
    triggerHints,
    requiredTools:
      input.toolId === null ? [] : [input.toolId],
    safetyNotes: [
      "Skill candidate is preview-only and never written to the database.",
      "productionReady=false",
      "Tool execution remains read-only and disabled-by-default.",
      input.toolExecution.blockedReason === null
        ? "Preview run stayed within the read-only boundary."
        : `Preview run blocked safely: ${input.toolExecution.blockedReason}`,
    ],
    productionReady: false,
  };
}

function createSuccessToolResult(input: {
  toolId: WebAgentToolName;
  inputSummary: string;
  preview: string;
  warnings: readonly string[];
  finalUrl?: string | null;
  contentType?: string | null;
  textPreview?: string | null;
  truncated?: boolean;
}): WebAgentToolExecutionResult {
  return {
    toolId: input.toolId,
    status: "success",
    safeToExposeToClient: true,
    toolResultPreview: truncatePreview(input.preview),
    finalUrl: input.finalUrl ?? null,
    contentType: input.contentType ?? null,
    textPreview: input.textPreview ?? null,
    truncated: input.truncated ?? false,
    blockedReason: null,
    errorReason: null,
    warnings: normalizeWarnings(input.warnings),
    inputSummary: input.inputSummary,
    readOnly: true,
    enabledByDefault: false,
    productionReady: false,
  };
}

function createBlockedToolResult(
  toolId: WebAgentToolName,
  blockedReason: string,
  preview: string,
  warning: string,
  inputSummary: string,
  extra?: {
    finalUrl?: string | null;
    contentType?: string | null;
    textPreview?: string | null;
    truncated?: boolean;
  },
): WebAgentToolExecutionResult {
  return {
    toolId,
    status: "blocked",
    safeToExposeToClient: true,
    toolResultPreview: truncatePreview(`[blocked] ${preview}`),
    finalUrl: extra?.finalUrl ?? null,
    contentType: extra?.contentType ?? null,
    textPreview: extra?.textPreview ?? null,
    truncated: extra?.truncated ?? false,
    blockedReason,
    errorReason: null,
    warnings: normalizeWarnings([warning]),
    inputSummary,
    readOnly: true,
    enabledByDefault: false,
    productionReady: false,
  };
}

function createErrorToolResult(
  toolId: WebAgentToolName,
  errorReason: string,
  preview: string,
  inputSummary: string,
  extra?: {
    finalUrl?: string | null;
    contentType?: string | null;
    textPreview?: string | null;
    truncated?: boolean;
  },
): WebAgentToolExecutionResult {
  return {
    toolId,
    status: "error",
    safeToExposeToClient: true,
    toolResultPreview: truncatePreview(`[error] ${preview}`),
    finalUrl: extra?.finalUrl ?? null,
    contentType: extra?.contentType ?? null,
    textPreview: extra?.textPreview ?? null,
    truncated: extra?.truncated ?? false,
    blockedReason: null,
    errorReason,
    warnings: [
      "The preview failed safely; no raw stack, secret, or database detail was exposed.",
    ],
    inputSummary,
    readOnly: true,
    enabledByDefault: false,
    productionReady: false,
  };
}

export async function executeSafeWebFetchPreview(input: {
  toolInput: Record<string, unknown>;
  fetchImpl?: typeof globalThis.fetch;
  networkGuard: WebAgentNetworkDevGuardResult;
}): Promise<WebAgentToolExecutionResult> {
  const rawUrl = normalizeOptionalText(readString(input.toolInput.url));

  if (!input.networkGuard.allowed) {
    return createBlockedToolResult(
      WebAgentToolName.SafeWebFetch,
      "network_guard_disabled",
      "Network fetch is disabled until the dev-only network guard is enabled.",
      "The dev-only network guard blocked the fetch before any request started.",
      buildSafeWebFetchInputSummary({ url: null }),
      {
        finalUrl: null,
        contentType: null,
        textPreview: null,
        truncated: false,
      },
    );
  }

  if (rawUrl === null) {
    return createBlockedToolResult(
      WebAgentToolName.SafeWebFetch,
      "missing_required_field:url",
      "The url field is required for safe web fetch.",
      "The fetch request did not include a valid url field.",
      "url=[missing]",
    );
  }

  const normalizedUrlResult = normalizeSafeWebFetchUrl(rawUrl);

  if (normalizedUrlResult.blockedReason !== null) {
    return createBlockedToolResult(
      WebAgentToolName.SafeWebFetch,
      normalizedUrlResult.blockedReason,
      normalizedUrlResult.message,
      normalizedUrlResult.warning,
      buildSafeWebFetchInputSummary({ url: normalizedUrlResult.previewUrl }),
      {
        finalUrl: null,
        contentType: null,
        textPreview: null,
        truncated: false,
      },
    );
  }

  const timeoutMs = normalizeSafeWebFetchLimit(
    readNumber(input.toolInput.timeoutMs),
    DEFAULT_SAFE_WEB_FETCH_TIMEOUT_MS,
    MAX_SAFE_WEB_FETCH_TIMEOUT_MS,
  );
  const maxBytes = normalizeSafeWebFetchLimit(
    readNumber(input.toolInput.maxBytes),
    DEFAULT_SAFE_WEB_FETCH_MAX_BYTES,
    MAX_SAFE_WEB_FETCH_MAX_BYTES,
  );
  const fetchImpl = input.fetchImpl ?? globalThis.fetch;

  if (typeof fetchImpl !== "function") {
    return createErrorToolResult(
      WebAgentToolName.SafeWebFetch,
      "fetch_impl_unavailable",
      "The safe web fetch preview could not start because fetch is unavailable.",
      buildSafeWebFetchInputSummary({
        url: normalizedUrlResult.previewUrl ?? rawUrl,
        maxBytes,
        timeoutMs,
      }),
      {
        finalUrl: normalizedUrlResult.previewUrl,
        contentType: null,
        textPreview: null,
        truncated: false,
      },
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let requestUrl = normalizedUrlResult.href;
  let redirectCount = 0;

  try {
    while (true) {
      const response = await fetchImpl(requestUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          accept:
            "text/html, text/plain, application/xhtml+xml, application/json;q=0.9, */*;q=0.8",
        },
      });

      if (isSafeWebFetchRedirectStatus(response.status)) {
        const location = response.headers?.get?.("location") ?? null;

        if (location === null || location.trim().length === 0) {
          return createErrorToolResult(
            WebAgentToolName.SafeWebFetch,
            "redirect_missing_location",
            "The server returned a redirect without a location header.",
            buildSafeWebFetchInputSummary({
              url: normalizedUrlResult.previewUrl ?? rawUrl,
              maxBytes,
              timeoutMs,
            }),
            {
              finalUrl: sanitizeUrlForPreview(requestUrl),
              contentType: null,
              textPreview: null,
              truncated: false,
            },
          );
        }

        const redirectedUrl = new URL(location, requestUrl);
        const redirectValidation = normalizeSafeWebFetchUrl(
          redirectedUrl.toString(),
        );

        if (redirectValidation.blockedReason !== null) {
          return createBlockedToolResult(
            WebAgentToolName.SafeWebFetch,
            redirectValidation.blockedReason,
            redirectValidation.message,
            redirectValidation.warning,
            buildSafeWebFetchInputSummary({
              url: normalizedUrlResult.previewUrl,
              maxBytes,
              timeoutMs,
            }),
            {
              finalUrl: null,
              contentType: null,
              textPreview: null,
              truncated: false,
            },
          );
        }

        redirectCount += 1;

        if (redirectCount > MAX_SAFE_WEB_FETCH_REDIRECTS) {
          return createBlockedToolResult(
            WebAgentToolName.SafeWebFetch,
            "redirect_limit_exceeded",
            "The redirect limit was exceeded before the page could be previewed.",
            "The safe web fetch preview stopped after too many redirects.",
            buildSafeWebFetchInputSummary({
              url: normalizedUrlResult.previewUrl,
              maxBytes,
              timeoutMs,
            }),
            {
              finalUrl: null,
              contentType: null,
              textPreview: null,
              truncated: false,
            },
          );
        }

        requestUrl = redirectValidation.href;
        continue;
      }

      const contentType = normalizeOptionalText(
        response.headers?.get?.("content-type") ?? null,
      );
      const safeContentType = contentType ?? "unknown";
      const rawText = await readSafeWebFetchResponseText(response);
      const sanitizedText = sanitizeSafeWebFetchPreviewText(rawText);
      const previewText = buildSafeWebFetchTextPreview(
        sanitizedText,
        safeContentType,
        maxBytes,
      );

      return createSuccessToolResult({
        toolId: WebAgentToolName.SafeWebFetch,
        inputSummary: buildSafeWebFetchInputSummary({
          url: normalizedUrlResult.previewUrl ?? rawUrl,
          maxBytes,
          timeoutMs,
        }),
        preview: buildSafeWebFetchResultPreview({
          finalUrl: sanitizeUrlForPreview(response.url || requestUrl),
          contentType: safeContentType,
          textPreview: previewText.textPreview,
          truncated: previewText.truncated,
        }),
        warnings: [
          "Safe web fetch stayed dev-only, read-only, and preview-only.",
        ],
        finalUrl: sanitizeUrlForPreview(response.url || requestUrl),
        contentType: safeContentType,
        textPreview: previewText.textPreview,
        truncated: previewText.truncated,
      });
    }
  } catch (error) {
    if (isAbortError(error) || controller.signal.aborted) {
      return createErrorToolResult(
        WebAgentToolName.SafeWebFetch,
        "request_timeout",
        `The safe web fetch preview timed out after ${timeoutMs}ms.`,
        buildSafeWebFetchInputSummary({
          url: normalizedUrlResult.previewUrl ?? rawUrl,
          maxBytes,
          timeoutMs,
        }),
        {
          finalUrl: normalizedUrlResult.previewUrl,
          contentType: null,
          textPreview: null,
          truncated: false,
        },
      );
    }

    return createErrorToolResult(
      WebAgentToolName.SafeWebFetch,
      "fetch_failed_safely",
      "The safe web fetch preview failed safely before exposing raw response data.",
      buildSafeWebFetchInputSummary({
        url: normalizedUrlResult.previewUrl ?? rawUrl,
        maxBytes,
        timeoutMs,
      }),
      {
        finalUrl: normalizedUrlResult.previewUrl,
        contentType: null,
        textPreview: null,
        truncated: false,
      },
    );
  } finally {
    clearTimeout(timer);
  }
}

function buildSafeWebFetchInputSummary(input: {
  url: string | null;
  maxBytes?: number;
  timeoutMs?: number;
}): string {
  const parts = [
    `url=${input.url === null ? "[missing]" : sanitizeUrlForPreview(input.url)}`,
  ];

  if (input.maxBytes !== undefined) {
    parts.push(`maxBytes=${String(input.maxBytes)}`);
  }

  if (input.timeoutMs !== undefined) {
    parts.push(`timeoutMs=${String(input.timeoutMs)}`);
  }

  return parts.join(", ");
}

function buildSafeWebFetchResultPreview(input: {
  finalUrl: string;
  contentType: string;
  textPreview: string | null;
  truncated: boolean;
}): string {
  return [
    "Safe web fetch preview",
    `Final URL: ${input.finalUrl}`,
    `Content type: ${input.contentType}`,
    `Truncated: ${input.truncated ? "yes" : "no"}`,
    `Preview: ${input.textPreview ?? "none"}`,
  ].join("\n");
}

function buildSafeWebFetchTextPreview(
  text: string,
  contentType: string,
  maxBytes: number,
): { textPreview: string | null; truncated: boolean } {
  const bodyText =
    isHtmlLikeContentType(contentType) ? stripHtmlForPreview(text) : text;

  if (!isTextLikeContentType(contentType)) {
    return {
      textPreview: `[${contentType}] non-text content omitted`,
      truncated: true,
    };
  }

  const normalized = sanitizeSafeWebFetchPreviewText(bodyText);
  const truncatedText = truncateTextByBytes(normalized, maxBytes);
  return {
    textPreview: truncatedText,
    truncated: byteLength(normalized) > byteLength(truncatedText),
  };
}

function containsSafeWebFetchHint(normalizedMessage: string): boolean {
  return (
    normalizedMessage.includes("http://") ||
    normalizedMessage.includes("https://") ||
    safeWebFetchKeywords.some((keyword) => normalizedMessage.includes(keyword))
  );
}

function normalizeSafeWebFetchLimit(
  value: number | null,
  fallback: number,
  maxLimit: number,
): number {
  const normalized = normalizePositiveInteger(value, fallback);
  return Math.min(normalized, maxLimit);
}

function normalizeSafeWebFetchUrl(rawUrl: string): {
  href: string;
  previewUrl: string;
  blockedReason: string | null;
  warning: string;
  message: string;
} {
  try {
    const parsed = new URL(rawUrl);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return {
        href: "",
        previewUrl: sanitizeUrlForPreview(rawUrl),
        blockedReason: "unsupported_protocol",
        warning: "Only http and https URLs are allowed for safe web fetch.",
        message: "The requested URL used a blocked protocol.",
      };
    }

    if (parsed.username.length > 0 || parsed.password.length > 0) {
      return {
        href: "",
        previewUrl: sanitizeUrlForPreview(rawUrl),
        blockedReason: "credentials_in_url",
        warning: "Credential-bearing URLs are blocked before fetch starts.",
        message: "The requested URL contained embedded credentials.",
      };
    }

    if (isBlockedSafeWebFetchHost(parsed.hostname)) {
      return {
        href: "",
        previewUrl: "[blocked internal target]",
        blockedReason: "blocked_private_address",
        warning:
          "Localhost, private IP, metadata, and other internal targets are blocked.",
        message: "The requested URL points at an internal or reserved address.",
      };
    }

    parsed.username = "";
    parsed.password = "";
    parsed.hash = "";
    parsed.search = "";

    return {
      href: parsed.toString(),
      previewUrl: sanitizeUrlForPreview(parsed.toString()),
      blockedReason: null,
      warning: "",
      message: "",
    };
  } catch {
    return {
      href: "",
      previewUrl: sanitizeUrlForPreview(rawUrl),
      blockedReason: "invalid_url",
      warning: "The URL could not be parsed safely.",
      message: "The requested URL was invalid.",
    };
  }
}

function readSafeWebFetchResponseText(response: {
  text?: () => Promise<string>;
  arrayBuffer?: () => Promise<ArrayBuffer>;
}): Promise<string> {
  if (typeof response.text === "function") {
    return response.text();
  }

  if (typeof response.arrayBuffer === "function") {
    return response.arrayBuffer().then((buffer) => new TextDecoder().decode(buffer));
  }

  return Promise.resolve("");
}

function sanitizeSafeWebFetchPreviewText(value: string): string {
  let result = value.trim().replace(/\s+/g, " ");
  result = result.replace(/\bhttps?:\/\/[^\s"'<>]+/gi, (match) =>
    sanitizeUrlForPreview(match),
  );
  result = result.replace(/\bfile:\/\/[^\s"'<>]+/gi, "file://[redacted]");
  result = result.replace(/\bbearer\s+\S+/gi, "bearer [redacted]");
  result = result.replace(
    /\b(api[_-]?key|api[_-]?secret|access[_-]?token|refresh[_-]?token|authorization|password|secret|credential|credentials|cookie|private[_-]?key|client[_-]?secret)\b\s*[:=]\s*\S+/gi,
    "$1=[redacted]",
  );
  result = result.replace(/\bDATABASE_URL\s*[:=]\s*\S+/gi, "DATABASE_URL=[redacted]");
  result = result.replace(
    /\b(raw[_-]?prompt|raw[_-]?messages|raw[_-]?completion|raw[_-]?request|raw[_-]?response|raw[_-]?provider[_-]?response|headers|raw[_-]?headers)\b\s*[:=]\s*\S+/gi,
    "$1=[redacted]",
  );
  return result;
}

function sanitizeUrlForPreview(value: string): string {
  try {
    const parsed = new URL(value);
    parsed.username = "";
    parsed.password = "";
    parsed.hash = "";
    parsed.search = "";
    if (parsed.protocol === "file:") {
      return "file://[redacted]";
    }
    return parsed.toString();
  } catch {
    return truncateText(value.trim().replace(/\s+/g, " "), 200);
  }
}

function isBlockedSafeWebFetchHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();

  if (normalized.length === 0) {
    return true;
  }

  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "metadata" ||
    normalized === "metadata.google.internal" ||
    normalized.startsWith("metadata.") ||
    normalized === "0.0.0.0" ||
    normalized === "127.0.0.1" ||
    normalized === "::1"
  ) {
    return true;
  }

  if (
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal") ||
    normalized.endsWith(".lan") ||
    normalized.endsWith(".home") ||
    normalized.endsWith(".corp")
  ) {
    return true;
  }

  return isPrivateIPv4Address(normalized) || isPrivateIPv6Address(normalized);
}

function isPrivateIPv4Address(value: string): boolean {
  const match = value.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);

  if (match === null) {
    return false;
  }

  const [a, b, c, d] = match.slice(1).map((part) => Number(part));

  if ([a, b, c, d].some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  if (a === 10 || a === 127 || a === 0 || a === 255) {
    return true;
  }

  if (a === 100 && b >= 64 && b <= 127) {
    return true;
  }

  if (a === 169 && b === 254) {
    return true;
  }

  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }

  if (a === 192 && b === 168) {
    return true;
  }

  if (a === 198 && (b === 18 || b === 19)) {
    return true;
  }

  return a >= 224;
}

function isPrivateIPv6Address(value: string): boolean {
  const normalized = value.trim().toLowerCase();

  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("ff")
  );
}

function isSafeWebFetchRedirectStatus(status: number): boolean {
  return (
    status === 301 ||
    status === 302 ||
    status === 303 ||
    status === 307 ||
    status === 308
  );
}

function isTextLikeContentType(contentType: string): boolean {
  const normalized = contentType.trim().toLowerCase();

  if (normalized.length === 0 || normalized === "unknown") {
    return true;
  }

  if (
    normalized.startsWith("image/") ||
    normalized.startsWith("audio/") ||
    normalized.startsWith("video/") ||
    normalized.includes("octet-stream") ||
    normalized.includes("application/pdf")
  ) {
    return false;
  }

  return (
    normalized.startsWith("text/") ||
    normalized.includes("json") ||
    normalized.includes("xml") ||
    normalized.includes("javascript") ||
    normalized.includes("xhtml") ||
    normalized.includes("csv") ||
    normalized.includes("form-urlencoded")
  );
}

function isHtmlLikeContentType(contentType: string): boolean {
  const normalized = contentType.trim().toLowerCase();

  return normalized.includes("html") || normalized.includes("xhtml");
}

function stripHtmlForPreview(value: string): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateTextByBytes(value: string, maxBytes: number): string {
  if (byteLength(value) <= maxBytes) {
    return value;
  }

  if (maxBytes <= 3) {
    return ".".repeat(maxBytes);
  }

  let usedBytes = 0;
  let result = "";

  for (const char of value) {
    const charBytes = byteLength(char);

    if (usedBytes + charBytes > maxBytes - 3) {
      break;
    }

    usedBytes += charBytes;
    result += char;
  }

  return `${result.trimEnd()}...`;
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function isAbortError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const candidate = error as { name?: unknown };
  return candidate.name === "AbortError";
}

async function resolveBookDetailPreview(
  dataLoaders: WebAgentToolDataLoaders,
  requestedBookId: string | null,
): Promise<{
  result: WebAgentBookDetailSummary | null;
  resolutionNote: string;
  warnings: readonly string[];
}> {
  if (requestedBookId !== null) {
    const result = await dataLoaders.getBookDetail(requestedBookId);

    return {
      result,
      resolutionNote: `Requested book id: ${requestedBookId}`,
      warnings: ["Book detail was resolved from an explicit bookId."],
    };
  }

  const books = await dataLoaders.listBooks(1);
  const firstBook = books[0];

  if (firstBook === undefined) {
    return {
      result: null,
      resolutionNote: "No saved book was available for preview selection.",
      warnings: ["No bookId was supplied and no safe fallback book existed."],
    };
  }

  const result = await dataLoaders.getBookDetail(firstBook.bookId);

  return {
    result,
    resolutionNote: `Auto-selected newest saved book preview: ${firstBook.title} (${firstBook.bookId})`,
    warnings: [
      "No bookId was supplied, so the preview auto-selected the newest saved book.",
    ],
  };
}

function buildBooksPreview(
  books: readonly WebAgentBookSummary[],
  limit: number,
): string {
  if (books.length === 0) {
    return [
      "Read-only book preview",
      "No saved books were found.",
      `Requested limit: ${limit}`,
    ].join("\n");
  }

  const lines = [
    "Read-only book preview",
    `Items shown: ${books.length}`,
  ];

  for (const book of books) {
    lines.push(
      `- ${book.title}${book.author ? ` by ${book.author}` : ""} | ${book.sourceType} | ${formatSafeDate(book.createdAt)}`,
    );
  }

  return lines.join("\n");
}

function buildReadingProgressPreview(
  summary: WebAgentReadingProgressSummary,
  limit: number,
): string {
  if (summary.records.length === 0) {
    return [
      "Read-only reading progress preview",
      `Demo user: ${summary.userLabel}`,
      "No saved reading progress was found.",
      `Requested limit: ${limit}`,
    ].join("\n");
  }

  const lines = [
    "Read-only reading progress preview",
    `Demo user: ${summary.userLabel}`,
    `Items shown: ${summary.records.length}`,
  ];

  for (const record of summary.records) {
    lines.push(
      `- ${record.bookTitle} / ${record.chapterTitle} | ${(record.progressRatio * 100).toFixed(0)}% | updated ${formatSafeDate(record.updatedAt)}`,
    );
  }

  return lines.join("\n");
}

function buildBookDetailPreview(
  detail: WebAgentBookDetailSummary,
  resolutionNote: string,
): string {
  const lines = [
    "Read-only book detail preview",
    resolutionNote,
    `Book: ${detail.book.title}${detail.book.author ? ` by ${detail.book.author}` : ""}`,
    `Source: ${detail.book.sourceType}`,
    `Created: ${formatSafeDate(detail.book.createdAt)}`,
    `Chapters: ${detail.chapters.length}`,
  ];

  for (const chapter of detail.chapters.slice(0, 6)) {
    lines.push(
      `- #${chapter.orderIndex + 1} ${chapter.title}${chapter.summary ? ` | ${truncatePreview(chapter.summary, 120)}` : ""}`,
    );
  }

  return lines.join("\n");
}

function buildToolInputSummary(value: Record<string, unknown>): string {
  const entries = Object.entries(value).map(([key, item]) => {
    if (typeof item === "string") {
      return `${key}=${truncateText(item, 120)}`;
    }

    if (typeof item === "number" || typeof item === "boolean") {
      return `${key}=${String(item)}`;
    }

    return `${key}=[object]`;
  });

  return entries.length > 0 ? entries.join(", ") : "no-input";
}

function isFieldTypeMatch(
  expectedType: WebAgentToolInputField["type"],
  value: unknown,
): boolean {
  if (expectedType === "string") {
    return typeof value === "string";
  }

  if (expectedType === "number") {
    return typeof value === "number" && Number.isFinite(value);
  }

  return typeof value === "boolean";
}

function createTriggerHints(
  message: string,
  toolId: WebAgentToolName | null,
): readonly string[] {
  const hints = normalizeUniqueStrings([
    ...(toolId === null ? [] : [toolId]),
    ...extractMessageHints(message),
  ]);

  return hints.slice(0, 5);
}

function createMcpConnectorRuntimeEnvPreview(
  env?: Partial<McpConnectorRuntimeEnv>,
): McpConnectorRuntimeEnv {
  return {
    NODE_ENV: env?.NODE_ENV ?? process.env.NODE_ENV,
    LAP_WEB_AGENT_MCP_DEV_ENABLED:
      env?.LAP_WEB_AGENT_MCP_DEV_ENABLED ??
      process.env.LAP_WEB_AGENT_MCP_DEV_ENABLED,
    LAP_ALLOW_AGENT_MCP: env?.LAP_ALLOW_AGENT_MCP ?? process.env.LAP_ALLOW_AGENT_MCP,
    LAP_AGENT_GITHUB_READONLY_ENABLED:
      env?.LAP_AGENT_GITHUB_READONLY_ENABLED ??
      process.env.LAP_AGENT_GITHUB_READONLY_ENABLED,
    LAP_AGENT_GITHUB_ALLOWED_REPOS:
      env?.LAP_AGENT_GITHUB_ALLOWED_REPOS ??
      process.env.LAP_AGENT_GITHUB_ALLOWED_REPOS,
    GITHUB_TOKEN: env?.GITHUB_TOKEN ?? process.env.GITHUB_TOKEN,
  };
}

function extractMessageHints(message: string): string[] {
  const normalized = normalizeText(message);
  const hints: string[] = [];

  if (normalized.includes("书") || normalized.includes("book")) {
    hints.push("books");
  }

  if (normalized.includes("详情") || normalized.includes("detail")) {
    hints.push("detail");
  }

  if (normalized.includes("进度") || normalized.includes("progress")) {
    hints.push("reading progress");
  }

  if (normalized.includes("列出") || normalized.includes("list")) {
    hints.push("list");
  }

  if (normalized.includes("查看")) {
    hints.push("view");
  }

  return hints;
}

function buildSkillName(
  toolId: WebAgentToolName | null,
  toolDisplayName: string,
): string {
  if (toolId === null) {
    return "Web Agent conversation skill draft";
  }

  return `Web Agent ${toolDisplayName} skill draft`;
}

function buildSkillDescription(
  message: string,
  toolDisplayName: string,
  status: WebAgentToolExecutionResult["status"],
): string {
  return truncateText(
    `Generated from a single dev-only Web Agent turn that targeted ${toolDisplayName}. The preview stayed ${status} and is advisory only. Message summary: ${normalizeText(message)}`,
    300,
  );
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

function normalizePositiveInteger(value: number | null, fallback: number): number {
  if (value === null || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.floor(value));
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function truncateText(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }

  if (maxChars <= 3) {
    return ".".repeat(maxChars);
  }

  return `${value.slice(0, maxChars - 3).trimEnd()}...`;
}

function truncatePreview(value: string, maxChars = DEFAULT_PREVIEW_CHARS): string {
  return truncateText(value, maxChars);
}

function formatSafeDate(value: string): string {
  return value.length > 0 ? value : "unknown";
}

function normalizeWarnings(values: readonly string[]): readonly string[] {
  return normalizeUniqueStrings(values).slice(0, 8);
}

function normalizeUniqueStrings(values: readonly string[]): string[] {
  const normalizedValues: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const normalized = value.trim().replace(/\s+/g, " ");
    const key = normalized.toLowerCase();

    if (normalized.length > 0 && !seen.has(key)) {
      seen.add(key);
      normalizedValues.push(normalized);
    }
  }

  return normalizedValues;
}
