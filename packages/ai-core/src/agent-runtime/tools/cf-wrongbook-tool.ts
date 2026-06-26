// ============================================================
// A489 — CF Wrong Book Read Tool
// ============================================================
// Real read-only tool: cf.wrongbook.read
//
// Reads the current user's wrong book (错题本) from the database.
// Associates each wrong book entry with:
//   - Local Problem metadata (rating, tags, originalUrl)
//   - CF submission status (attempts, accepted, lastVerdict)
//
// Constraints:
//   - Read-only — no database writes
//   - No Codeforces API calls
//   - No LLM calls
//   - Only returns minimum metadata
//   - Never returns: full problem statement, examples, judge test cases,
//     user submission source code, raw DB models, email, tokens, secrets
//
// @module cf-wrongbook-tool
// @serverOnly

import type { AgentTool, AgentToolMetadata, ToolExecutionContext, ToolExecutionResult, ToolInputSchema } from "../tools/tool-types.ts";
import { ToolExecutionStatus, AgentToolCategory, AgentToolSensitivity } from "../tools/tool-types.ts";
import { createDefaultToolMetadata } from "../tools/tool-types.ts";

// ---------------------------------------------------------------------------
// Tool name
// ---------------------------------------------------------------------------

export const CF_WRONGBOOK_TOOL_NAME = "cf.wrongbook.read";

// ---------------------------------------------------------------------------
// Input / Output types
// ---------------------------------------------------------------------------

export interface CfWrongBookInput {
  readonly userId: string;
}

export interface CfWrongBookItem {
  readonly problemKey: string;
  readonly problemId: string;
  readonly name: string;
  readonly rating: number | null;
  readonly tags: string[];
  readonly originalUrl: string;
  readonly wrongBookCreatedAt: string;
  readonly attempts: number;
  readonly accepted: boolean;
  readonly lastSubmittedAt: string | null;
  readonly lastVerdict: string | null;
}

export interface CfWrongBookToolDeps {
  /** List wrong book entries by owner ID */
  readonly listWrongBookByOwner: (ownerId: string) => Promise<Array<{
    id: string;
    ownerId: string;
    problemId: string;
    problemTitle: string;
    difficulty: string;
    tagsJson: string;
    wrongCount: number;
    lastWrongAt: Date;
    reviewStatus: string;
    notePreview: string | null;
    sourceType: string;
    createdAt: Date;
    updatedAt: Date;
  }>>;

  /** Look up Problem records by IDs (only CF source) */
  readonly getProblemsByIds: (problemIds: string[]) => Promise<Array<{
    id: string;
    title: string;
    source: string | null;
    sourceUrl: string | null;
    metadata: Record<string, unknown> | null;
  }>>;

  /** Get CF problem stats for a user's account */
  readonly getProblemStatsByAccount: (accountId: string) => Promise<Array<{
    problemKey: string;
    contestId: number;
    index: string;
    name: string;
    rating: number | null;
    tags: string[];
    attempts: number;
    accepted: boolean;
    lastSubmittedAt: Date | null;
    lastVerdict: string | null;
  }>>;

  /** Get CF account by user ID */
  readonly getAccountByUserId: (userId: string) => Promise<{ id: string } | null>;
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

function createCfWrongBookMetadata(): AgentToolMetadata {
  return {
    ...createDefaultToolMetadata({
      name: CF_WRONGBOOK_TOOL_NAME,
      description:
        "读取当前登录用户的错题本。只返回 Codeforces 题目的最小元数据，关联 CF 提交状态。只读，不修改错题本，不调用 Codeforces API。",
    }),
    version: "1.0.0",
    category: AgentToolCategory.ReadOnly,
    readOnly: true,
    sideEffect: false,
    parallelSafe: true,
    requiresConfirmation: false,
    requiresAuthentication: true,
    sensitivity: AgentToolSensitivity.High,
    timeoutMs: 30_000,
    allowedAgents: [
      "cf-data-analyst",
      "cf-report-writer",
      "cf-problem-recommender",
      "orchestrator",
    ],
    disabledByDefault: true,
  };
}

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const cfWrongBookInputSchema: ToolInputSchema<CfWrongBookInput> = {
  _brand: "ToolInputSchema" as const,
  _inputType: undefined as unknown as CfWrongBookInput,
  schema: {
    type: "object",
    properties: {
      userId: { type: "string" },
    },
    required: ["userId"],
  },
  validate(input: unknown): CfWrongBookInput {
    if (!input || typeof input !== "object") {
      throw new Error("Input must be an object with userId");
    }
    const obj = input as Record<string, unknown>;
    if (typeof obj.userId !== "string" || !obj.userId.trim()) {
      throw new Error("userId must be a non-empty string");
    }
    return { userId: obj.userId };
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build the stable CF problem key from metadata */
function buildProblemKey(metadata: Record<string, unknown> | null): string | null {
  if (!metadata) return null;
  const contestId = metadata.contestId ?? metadata.contest_id;
  const index = metadata.index;
  if (typeof contestId === "number" && typeof index === "string" && index.length > 0) {
    return `codeforces:${contestId}:${index}`;
  }
  return null;
}

/** Build the original CF problem URL */
function buildOriginalUrl(
  metadata: Record<string, unknown> | null,
  sourceUrl: string | null,
): string {
  if (sourceUrl) return sourceUrl;
  if (!metadata) return "";
  const contestId = metadata.contestId ?? metadata.contest_id;
  const index = metadata.index;
  if (typeof contestId === "number" && typeof index === "string") {
    return `https://codeforces.com/problemset/problem/${contestId}/${index}`;
  }
  return "";
}

/** Safely parse tags JSON */
function safeParseTags(tagsJson: string): string[] {
  try {
    const parsed = JSON.parse(tagsJson);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((t: unknown) => (typeof t === "string" ? t.trim() : ""))
      .filter((t: string) => t.length > 0)
      .slice(0, 50);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Tool factory
// ---------------------------------------------------------------------------

export function createCfWrongBookTool(deps: CfWrongBookToolDeps): AgentTool<CfWrongBookInput, CfWrongBookItem[]> {
  return {
    metadata: createCfWrongBookMetadata(),
    inputSchema: cfWrongBookInputSchema,

    async execute(
      input: CfWrongBookInput,
      context: ToolExecutionContext,
    ): Promise<ToolExecutionResult<CfWrongBookItem[]>> {
      const startedAt = new Date().toISOString();
      const toolCallId = `tcall_cf_wrongbook_${Date.now()}`;

      try {
        // Security: verify the requesting user matches
        if (context.userId !== input.userId) {
          return {
            toolCallId,
            status: ToolExecutionStatus.Rejected,
            safeSummary: "权限拒绝：只能读取自己的错题本",
            errorCode: "PERMISSION_DENIED",
            retryable: false,
            startedAt,
            completedAt: new Date().toISOString(),
            durationMs: 0,
          };
        }

        // 1. Read wrong book entries for this user
        const wrongBookEntries = await deps.listWrongBookByOwner(input.userId);

        if (wrongBookEntries.length === 0) {
          return {
            toolCallId,
            status: ToolExecutionStatus.Success,
            data: [],
            safeSummary: "错题本为空",
            retryable: false,
            startedAt,
            completedAt: new Date().toISOString(),
            durationMs: Date.now() - new Date(startedAt).getTime(),
          };
        }

        // 2. Look up Problem records for the wrong book entries
        const problemIds = wrongBookEntries.map((e) => e.problemId);
        const problems = await deps.getProblemsByIds(problemIds);
        const problemMap = new Map(problems.map((p) => [p.id, p]));

        // 3. Get CF account and submission stats
        const account = await deps.getAccountByUserId(input.userId);
        let statMap = new Map<string, {
          problemKey: string;
          attempts: number;
          accepted: boolean;
          lastSubmittedAt: Date | null;
          lastVerdict: string | null;
        }>();

        if (account) {
          const stats = await deps.getProblemStatsByAccount(account.id);
          for (const s of stats) {
            statMap.set(s.problemKey, s);
          }
        }

        // 4. Build output items
        const items: CfWrongBookItem[] = [];
        const warnings: string[] = [];

        for (const entry of wrongBookEntries) {
          const problem = problemMap.get(entry.problemId);

          if (!problem) {
            warnings.push(`问题 ${entry.problemId}（${entry.problemTitle}）已被清理或数据不完整`);
            continue;
          }

          const metadata = problem.metadata as Record<string, unknown> | null;
          const problemKey = buildProblemKey(metadata);

          // Non-CF problems in wrong book — skip with warning
          if (!problemKey) {
            warnings.push(`错题 ${entry.problemTitle} 不是 Codeforces 题目，已跳过`);
            continue;
          }

          // Get CF submission stats
          const stat = problemKey ? statMap.get(problemKey) : undefined;
          const tags = metadata && Array.isArray(metadata.tags)
            ? (metadata.tags as string[]).filter((t): t is string => typeof t === "string")
            : safeParseTags(entry.tagsJson);

          items.push({
            problemKey,
            problemId: entry.problemId,
            name: problem.title || entry.problemTitle,
            rating: (metadata && typeof metadata.rating === "number" ? metadata.rating : null),
            tags,
            originalUrl: buildOriginalUrl(metadata, problem.sourceUrl),
            wrongBookCreatedAt: entry.createdAt.toISOString(),
            attempts: stat?.attempts ?? 0,
            accepted: stat?.accepted ?? false,
            lastSubmittedAt: stat?.lastSubmittedAt?.toISOString() ?? null,
            lastVerdict: stat?.lastVerdict ?? null,
          });
        }

        return {
          toolCallId,
          status: ToolExecutionStatus.Success,
          data: items,
          safeSummary: `成功读取 ${items.length} 条错题数据${warnings.length > 0 ? `（${warnings.length} 条警告）` : ""}`,
          retryable: false,
          startedAt,
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - new Date(startedAt).getTime(),
        };
      } catch (err) {
        return {
          toolCallId,
          status: ToolExecutionStatus.Failed,
          safeSummary: "读取错题本失败",
          errorCode: "INTERNAL_ERROR",
          retryable: true,
          startedAt,
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - new Date(startedAt).getTime(),
        };
      }
    },
  };
}
