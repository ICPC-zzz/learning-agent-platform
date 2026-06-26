import {
  ExternalChatCompletionsProvider,
  loadExternalProviderConfig,
  type ExternalProviderFetch,
} from "@learning-agent-platform/ai-core/llm/external-chat-completions-provider";
import type { LlmProvider } from "@learning-agent-platform/ai-core/llm/llm-provider-contract";
import {
  evaluateWebAgentDevGuard,
  type WebAgentDevEnv,
} from "@learning-agent-platform/ai-core/llm/web-agent-dev-guard";
import {
  evaluateWebAgentNetworkDevGuard,
  type WebAgentNetworkDevEnv,
} from "@learning-agent-platform/ai-core/agent/web-agent-network-dev-guard";
import {
  evaluateWebAgentMcpConnectorGuard,
} from "@learning-agent-platform/ai-core/agent/web-agent-mcp-connector-runtime";
import {
  runWebAgentBoundedLoop,
  type WebAgentBoundedLoopRunnerResult,
} from "@learning-agent-platform/ai-core/agent/web-agent-bounded-loop-runner";
import {
  evaluateWebAgentToolsDevGuard,
} from "@learning-agent-platform/ai-core/agent/web-agent-tools-dev-guard";
import type { WebAgentToolsDevEnv } from "@learning-agent-platform/ai-core/agent/web-agent-tools-dev-guard";
import {
  createDefaultToolJobPolicy,
  createWebAgentToolJobPreviewFromExecution,
  type ToolJob,
  type ToolJobPolicy,
} from "@learning-agent-platform/ai-core/agent/web-agent-tool-job-runtime";
import {
  getPrismaClient,
  PrismaBookRepository,
  PrismaReadingProgressRepository,
  PrismaUserRepository,
  type BookRepository,
  type ReadingProgressRepository,
  type UserRepository,
} from "@learning-agent-platform/db";
import type { WebAgentToolDataLoaders } from "@learning-agent-platform/ai-core/agent/web-agent-tool-framework";
import {
  isWebAgentToolName,
  WebAgentToolName,
} from "@learning-agent-platform/ai-core/agent/web-agent-readonly-tool-registry";

const DEFAULT_DEV_USER_EMAIL = "demo@example.com";

export interface WebAgentMessageRequest {
  message: string;
  useExternalLlmDev?: boolean;
  toolPreviewEnabled?: boolean;
  requestedToolName?: string | null;
  requestedToolInput?: Record<string, unknown>;
}

export interface WebAgentMessageCoreDeps {
  env?: WebAgentMessageCoreEnv;
  fetchImpl?: ExternalProviderFetch;
  externalProvider?: LlmProvider;
  mockProvider?: LlmProvider;
  bookRepository?: Pick<BookRepository, "listBooks" | "getBookReaderData">;
  readingProgressRepository?: Pick<
    ReadingProgressRepository,
    "listReadingProgress"
  >;
  userRepository?: Pick<UserRepository, "getUserByEmail">;
}

export type WebAgentMessageCoreResult = WebAgentBoundedLoopRunnerResult & {
  answerPreview: string;
  guardNotice: string;
  guardSourceLabel: string;
  mcpGuard: ReturnType<typeof evaluateWebAgentMcpConnectorGuard>;
  networkGuard: ReturnType<typeof evaluateWebAgentNetworkDevGuard>;
  selectedMcpToolId: WebAgentToolName | null;
  toolJob: ToolJob | null;
  toolBlockedReasons: readonly string[];
  toolWarnings: readonly string[];
  rawPromptStored: false;
  rawResponseStored: false;
  secretSafe: true;
};

type WebAgentMessageCoreEnv = WebAgentDevEnv &
  WebAgentToolsDevEnv & {
    LAP_WEB_AGENT_MCP_DEV_ENABLED?: string;
    LAP_ALLOW_AGENT_MCP?: string;
    LAP_AGENT_GITHUB_READONLY_ENABLED?: string;
    LAP_AGENT_GITHUB_ALLOWED_REPOS?: string;
    GITHUB_TOKEN?: string;
    LAP_WEB_AGENT_NETWORK_DEV_ENABLED?: string;
    LAP_ALLOW_AGENT_NETWORK?: string;
    LAP_LLM_DEV_TIMEOUT_MS?: string;
  };

export async function sendWebAgentMessageCore(
  input: WebAgentMessageRequest,
  deps: WebAgentMessageCoreDeps = {},
): Promise<WebAgentMessageCoreResult> {
  const message = normalizeMessage(input.message);
  const env = deps.env ?? readWebAgentDevEnv();
  const externalGuard = evaluateWebAgentDevGuard(
    env,
    input.useExternalLlmDev === true,
  );
  const toolGuard = evaluateWebAgentToolsDevGuard(env);
  const mcpGuard = evaluateWebAgentMcpConnectorGuard(env);
  const networkGuard = evaluateWebAgentNetworkDevGuard(env);
  const clientToolPreviewEnabled = input.toolPreviewEnabled === true;
  const effectiveToolGuardNotice =
    toolGuard.allowed && !clientToolPreviewEnabled
      ? "Read-only tool preview is disabled by the client toggle."
      : toolGuard.notice;
  const llmSelectionAllowed =
    input.useExternalLlmDev === true &&
    externalGuard.allowed &&
    clientToolPreviewEnabled &&
    toolGuard.allowed;

  const result = await runWebAgentBoundedLoop({
    userMessage: message,
    availableTools: [],
    toolDataLoaders: createToolDataLoaders(deps),
    toolPreviewEnabled: clientToolPreviewEnabled,
    toolExecutionAllowed: toolGuard.allowed,
    toolGuardNotice: effectiveToolGuardNotice,
    toolGuardSourceLabel: toolGuard.sourceLabel,
    mcpConnectorEnv: env,
    requestedToolInput: input.requestedToolInput,
    requestedExternalLlmDev: input.useExternalLlmDev === true,
    llmSelectionAllowed,
    fetchImpl: deps.fetchImpl,
    networkGuard,
    llmProvider:
      llmSelectionAllowed
        ? deps.externalProvider ??
          createExternalProviderFromEnv(env, deps.fetchImpl)
      : null,
  });
  const toolJob = createToolJobPreview(result, {
    message,
    requestedToolName: isWebAgentToolName(input.requestedToolName)
      ? input.requestedToolName
      : null,
    requestedToolInput: input.requestedToolInput,
    toolPreviewEnabled: clientToolPreviewEnabled,
    toolPolicyEnabled: toolGuard.allowed,
  });

  return {
    ...result,
    answerPreview: result.finalAnswer,
    guardNotice: externalGuard.notice,
    guardSourceLabel: externalGuard.sourceLabel,
    mcpGuard,
    networkGuard,
    selectedMcpToolId: isGitHubToolName(result.selectedToolId),
    toolJob,
    toolBlockedReasons:
      result.toolExecution.blockedReason === null
        ? []
        : [result.toolExecution.blockedReason],
    toolWarnings: result.toolExecution.warnings,
    rawPromptStored: false,
    rawResponseStored: false,
    secretSafe: true,
  };
}

function isGitHubToolName(toolId: WebAgentToolName | null): WebAgentToolName | null {
  if (
    toolId === WebAgentToolName.GithubListIssues ||
    toolId === WebAgentToolName.GithubGetRepoSummary
  ) {
    return toolId;
  }

  return null;
}

function createExternalProviderFromEnv(
  env: WebAgentMessageCoreEnv,
  fetchImpl?: ExternalProviderFetch,
) {
  return new ExternalChatCompletionsProvider(
    loadExternalProviderConfig({
      endpoint: env.LAP_LLM_DEV_ENDPOINT,
      apiKey: env.LAP_LLM_DEV_API_KEY,
      apiPassword: env.LAP_LLM_DEV_APIPassword,
      model: env.LAP_LLM_DEV_MODEL,
      timeoutMs: env.LAP_LLM_DEV_TIMEOUT_MS,
    }),
    fetchImpl,
  );
}

function readWebAgentDevEnv(): WebAgentMessageCoreEnv {
  return {
    LAP_WEB_AGENT_EXTERNAL_LLM_DEV_ENABLED:
      process.env.LAP_WEB_AGENT_EXTERNAL_LLM_DEV_ENABLED,
    LAP_WEB_AGENT_TOOLS_DEV_ENABLED:
      process.env.LAP_WEB_AGENT_TOOLS_DEV_ENABLED,
    LAP_WEB_AGENT_MCP_DEV_ENABLED:
      process.env.LAP_WEB_AGENT_MCP_DEV_ENABLED,
    LAP_ALLOW_AGENT_MCP: process.env.LAP_ALLOW_AGENT_MCP,
    LAP_AGENT_GITHUB_READONLY_ENABLED:
      process.env.LAP_AGENT_GITHUB_READONLY_ENABLED,
    LAP_AGENT_GITHUB_ALLOWED_REPOS:
      process.env.LAP_AGENT_GITHUB_ALLOWED_REPOS,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    LAP_WEB_AGENT_NETWORK_DEV_ENABLED:
      process.env.LAP_WEB_AGENT_NETWORK_DEV_ENABLED,
    LAP_ALLOW_AGENT_NETWORK: process.env.LAP_ALLOW_AGENT_NETWORK,
    LAP_ALLOW_EXTERNAL_LLM_PROVIDER: process.env.LAP_ALLOW_EXTERNAL_LLM_PROVIDER,
    LAP_LLM_DEV_ENDPOINT: process.env.LAP_LLM_DEV_ENDPOINT,
    LAP_LLM_DEV_API_KEY: process.env.LAP_LLM_DEV_API_KEY,
    LAP_LLM_DEV_APIPassword: process.env.LAP_LLM_DEV_APIPassword,
    LAP_LLM_DEV_MODEL: process.env.LAP_LLM_DEV_MODEL,
    LAP_LLM_DEV_TIMEOUT_MS: process.env.LAP_LLM_DEV_TIMEOUT_MS,
    NODE_ENV: process.env.NODE_ENV,
  };
}

function createToolDataLoaders(
  deps: WebAgentMessageCoreDeps,
): WebAgentToolDataLoaders {
  const bookRepository =
    deps.bookRepository ?? createBookRepositoryFromRuntime();
  const readingProgressRepository =
    deps.readingProgressRepository ?? createReadingProgressRepositoryFromRuntime();
  const userRepository = deps.userRepository ?? createUserRepositoryFromRuntime();

  return {
    async listBooks(limit: number) {
      const books = await bookRepository.listBooks({
        limit,
      });

      return books.map((book) => ({
        bookId: book.id,
        title: book.title,
        author: book.author ?? null,
        sourceType: book.sourceType,
        createdAt: formatSafeDate(book.createdAt),
      }));
    },
    async getBookDetail(bookId: string) {
      const readerData = await bookRepository.getBookReaderData(bookId);

      if (readerData === null) {
        return null;
      }

      return {
        book: {
          bookId: readerData.book.id,
          title: readerData.book.title,
          author: readerData.book.author ?? null,
          sourceType: readerData.book.sourceType,
          createdAt: formatSafeDate(readerData.book.createdAt),
        },
        chapters: readerData.chapters.map((chapter) => ({
          chapterId: chapter.id,
          title: chapter.title,
          orderIndex: chapter.orderIndex,
          summary: normalizeOptionalText(chapter.summary ?? null),
        })),
      };
    },
    async getReadingProgressSummary(limit: number) {
      const demoUser = await userRepository.getUserByEmail(DEFAULT_DEV_USER_EMAIL);

      if (demoUser === null) {
        return null;
      }

      const records = await readingProgressRepository.listReadingProgress({
        userId: demoUser.id,
        limit,
      });
      const bookCache = new Map<
        string,
        { bookTitle: string; chapterTitles: Map<string, string> }
      >();

      for (const record of records) {
        if (bookCache.has(record.bookId)) {
          continue;
        }

        const readerData = await bookRepository.getBookReaderData(record.bookId);
        const chapterTitles = new Map<string, string>();

        if (readerData !== null) {
          for (const chapter of readerData.chapters) {
            chapterTitles.set(chapter.id, chapter.title);
          }

          bookCache.set(record.bookId, {
            bookTitle: readerData.book.title,
            chapterTitles,
          });
          continue;
        }

        bookCache.set(record.bookId, {
          bookTitle: record.bookId,
          chapterTitles,
        });
      }

      const userLabel =
        demoUser.name && demoUser.name.trim().length > 0
          ? `${demoUser.name} (${DEFAULT_DEV_USER_EMAIL})`
          : DEFAULT_DEV_USER_EMAIL;

      return {
        userLabel,
        records: records.map((record) => {
          const bookInfo = bookCache.get(record.bookId);
          return {
            bookId: record.bookId,
            bookTitle: bookInfo?.bookTitle ?? record.bookId,
            chapterId: record.chapterId,
            chapterTitle:
              bookInfo?.chapterTitles.get(record.chapterId) ?? record.chapterId,
            progressRatio: record.progressRatio,
            updatedAt: formatSafeDate(record.updatedAt),
          };
        }),
      };
    },
  };
}

function createToolJobPreview(
  result: WebAgentBoundedLoopRunnerResult,
  input: {
    message: string;
    requestedToolName: WebAgentToolName | null;
    requestedToolInput: Record<string, unknown> | undefined;
    toolPreviewEnabled: boolean;
    toolPolicyEnabled: boolean;
  },
): ToolJob | null {
  const selectedToolId =
    input.requestedToolName ?? result.selectedToolId ?? null;

  if (selectedToolId === null) {
    return null;
  }

  const selectedToolInput =
    input.requestedToolInput ??
    deriveToolInputFromMessage(input.message, selectedToolId);
  const policy: ToolJobPolicy = {
    ...createDefaultToolJobPolicy(),
    enabled: input.toolPolicyEnabled && input.toolPreviewEnabled,
  };

  if (result.toolExecution === null) {
    return null;
  }

  return createWebAgentToolJobPreviewFromExecution({
    request: {
      messagePreview: input.message,
      selectedToolId,
      selectedToolInput,
      selectedBy: result.toolSelectionSource,
      selectionSource: result.toolSelectionSource,
      toolPreviewEnabled: input.toolPreviewEnabled,
    },
    toolExecution: result.toolExecution,
    policy,
  });
}

function deriveToolInputFromMessage(
  message: string,
  toolId: WebAgentToolName | null,
): Record<string, unknown> {
  if (toolId === null) {
    return {};
  }

  if (toolId === WebAgentToolName.GetBookDetail) {
    const bookId = extractBookId(message);
    return bookId === null ? {} : { bookId };
  }

  if (toolId === WebAgentToolName.SafeWebFetch) {
    const url = extractUrl(message);
    return url === null ? {} : { url };
  }

  if (
    toolId === WebAgentToolName.GithubListIssues ||
    toolId === WebAgentToolName.GithubGetRepoSummary
  ) {
    const repoFullName = extractGithubRepoFullName(message);

    return repoFullName === null ? {} : { repoFullName };
  }

  if (
    toolId === WebAgentToolName.ListBooks ||
    toolId === WebAgentToolName.GetReadingProgressSummary
  ) {
    return { limit: 5 };
  }

  return {};
}

function extractGithubRepoFullName(message: string): string | null {
  const normalized = normalizeMessage(message);
  const patterns = [
    /\bgithub\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\b/i,
    /\b([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\b/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);

    if (match?.[1] !== undefined) {
      return match[1];
    }
  }

  return null;
}

function extractBookId(message: string): string | null {
  const normalized = normalizeMessage(message);
  const patterns = [
    /bookId[:=]\s*([A-Za-z0-9_-]+)/i,
    /book[:=]\s*([A-Za-z0-9_-]+)/i,
    /\b(book-[A-Za-z0-9_-]+)\b/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);

    if (match?.[1] !== undefined) {
      return match[1];
    }
  }

  return null;
}

function extractUrl(message: string): string | null {
  const normalized = normalizeMessage(message);
  const patterns = [
    /\b(https?:\/\/[^\s<>"')\]]+)/i,
    /\b(www\.[^\s<>"')\]]+)/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);

    if (match?.[1] !== undefined) {
      return match[1].startsWith("www.")
        ? `https://${match[1]}`
        : match[1];
    }
  }

  return null;
}

function createBookRepositoryFromRuntime(): Pick<
  BookRepository,
  "listBooks" | "getBookReaderData"
> {
  const prisma = getPrismaClient();
  return new PrismaBookRepository(prisma);
}

function createReadingProgressRepositoryFromRuntime(): Pick<
  ReadingProgressRepository,
  "listReadingProgress"
> {
  const prisma = getPrismaClient();
  return new PrismaReadingProgressRepository(prisma);
}

function createUserRepositoryFromRuntime(): Pick<UserRepository, "getUserByEmail"> {
  const prisma = getPrismaClient();
  return new PrismaUserRepository(prisma);
}

function normalizeMessage(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = value.trim();

  return normalized.length === 0 ? null : normalized;
}

function formatSafeDate(value: Date): string {
  return Number.isNaN(value.getTime()) ? "unknown" : value.toISOString();
}
