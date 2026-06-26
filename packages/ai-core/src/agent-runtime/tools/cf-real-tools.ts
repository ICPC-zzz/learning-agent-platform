// ============================================================
// A488 — CF Real Read-Only Tools
// ============================================================
// Two real tools for the CF learning analysis agent:
//   cf.user.snapshot.read  — reads CF user analysis snapshot
//   cf.problem.candidates.read — reads training candidates from local pool
//
// Both are registered through the A487 ToolRegistry and executed
// through ToolExecutor. Not callable directly by server actions.
//
// @module cf-real-tools
// @serverOnly

import type { AgentTool, AgentToolMetadata, ToolExecutionContext, ToolExecutionResult, ToolInputSchema } from "../tools/tool-types.ts";
import { ToolExecutionStatus, AgentToolCategory, AgentToolSensitivity } from "../tools/tool-types.ts";
import { createDefaultToolMetadata } from "../tools/tool-types.ts";

// ---------------------------------------------------------------------------
// Tool names
// ---------------------------------------------------------------------------

export const CF_SNAPSHOT_TOOL_NAME = "cf.user.snapshot.read";
export const CF_CANDIDATES_TOOL_NAME = "cf.problem.candidates.read";

// ---------------------------------------------------------------------------
// Tool 1: cf.user.snapshot.read
// ---------------------------------------------------------------------------

export interface CfSnapshotInput {
  readonly accountId: string;
  readonly userId: string;
}

export interface CfSnapshotToolDeps {
  readonly getSnapshot: (
    accountId: string,
    userId: string,
  ) => Promise<unknown | null>;
  readonly getAccountByUserId: (userId: string) => Promise<{ id: string } | null>;
}

function createCfSnapshotMetadata(): AgentToolMetadata {
  return {
    ...createDefaultToolMetadata({
      name: CF_SNAPSHOT_TOOL_NAME,
      description:
        "读取当前登录用户的 Codeforces 分析快照（包含 Rating、提交、标签统计等）。只读，不调用 Codeforces API。",
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

const cfSnapshotInputSchema: ToolInputSchema<CfSnapshotInput> = {
  _brand: "ToolInputSchema" as const,
  _inputType: undefined as unknown as CfSnapshotInput,
  schema: {
    type: "object",
    properties: {
      accountId: { type: "string" },
      userId: { type: "string" },
    },
    required: ["accountId", "userId"],
  },
  validate(input: unknown): CfSnapshotInput {
    if (!input || typeof input !== "object") {
      throw new Error("Input must be an object with accountId and userId");
    }
    const obj = input as Record<string, unknown>;
    if (typeof obj.accountId !== "string" || !obj.accountId.trim()) {
      throw new Error("accountId must be a non-empty string");
    }
    if (typeof obj.userId !== "string" || !obj.userId.trim()) {
      throw new Error("userId must be a non-empty string");
    }
    return { accountId: obj.accountId, userId: obj.userId };
  },
};

export function createCfSnapshotTool(deps: CfSnapshotToolDeps): AgentTool<CfSnapshotInput, unknown> {
  return {
    metadata: createCfSnapshotMetadata(),
    inputSchema: cfSnapshotInputSchema,

    async execute(
      input: CfSnapshotInput,
      context: ToolExecutionContext,
    ): Promise<ToolExecutionResult<unknown>> {
      const startedAt = new Date().toISOString();
      const toolCallId = `tcall_cf_snapshot_${Date.now()}`;

      try {
        // Security: verify the requesting user matches
        if (context.userId !== input.userId) {
          return {
            toolCallId,
            status: ToolExecutionStatus.Rejected,
            safeSummary: "权限拒绝：只能读取自己的 Codeforces 数据",
            errorCode: "PERMISSION_DENIED",
            retryable: false,
            startedAt,
            completedAt: new Date().toISOString(),
            durationMs: 0,
          };
        }

        // Verify account belongs to user
        const account = await deps.getAccountByUserId(input.userId);
        if (!account || account.id !== input.accountId) {
          return {
            toolCallId,
            status: ToolExecutionStatus.Rejected,
            safeSummary: "权限拒绝：账号不属于当前用户",
            errorCode: "ACCOUNT_NOT_OWNED",
            retryable: false,
            startedAt,
            completedAt: new Date().toISOString(),
            durationMs: 0,
          };
        }

        const snapshot = await deps.getSnapshot(input.accountId, input.userId);
        if (!snapshot) {
          return {
            toolCallId,
            status: ToolExecutionStatus.Failed,
            safeSummary: "未找到 Codeforces 分析数据，请先同步数据",
            errorCode: "SNAPSHOT_NOT_FOUND",
            retryable: true,
            startedAt,
            completedAt: new Date().toISOString(),
            durationMs: 0,
          };
        }

        // Safe summary: only structural info, no raw data
        const sn = snapshot as Record<string, unknown>;
        const profile = sn.profile as Record<string, unknown> | undefined;
        const handle = profile?.handle ?? "unknown";

        return {
          toolCallId,
          status: ToolExecutionStatus.Success,
          data: snapshot,
          safeSummary: `成功读取 ${handle} 的 Codeforces 分析快照`,
          retryable: false,
          startedAt,
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - new Date(startedAt).getTime(),
        };
      } catch (err) {
        return {
          toolCallId,
          status: ToolExecutionStatus.Failed,
          safeSummary: "读取 Codeforces 快照失败",
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

// ---------------------------------------------------------------------------
// Tool 2: cf.problem.candidates.read
// ---------------------------------------------------------------------------

export interface CfCandidatesInput {
  readonly userId: string;
  readonly minRating?: number;
  readonly maxRating?: number;
  readonly includeTags?: string[];
  readonly excludeTags?: string[];
  readonly limit?: number;
}

export interface CfCandidatesToolDeps {
  readonly queryCandidatesForUser: (
    userId: string,
    query: {
      minRating?: number;
      maxRating?: number;
      includeTags?: string[];
      excludeTags?: string[];
      limit?: number;
    },
  ) => Promise<{
    candidates: unknown[];
    totalCandidates: number;
    querySummary: Record<string, unknown>;
  }>;
}

function createCfCandidatesMetadata(): AgentToolMetadata {
  return {
    ...createDefaultToolMetadata({
      name: CF_CANDIDATES_TOOL_NAME,
      description:
        "从本地精选题池查询当前用户的训练候选题。自动排除已完成题目，只返回本地精选池内题目。只读，不调用 Codeforces API。",
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
      "cf-problem-recommender",
      "cf-data-analyst",
      "orchestrator",
    ],
    disabledByDefault: true,
  };
}

const cfCandidatesInputSchema: ToolInputSchema<CfCandidatesInput> = {
  _brand: "ToolInputSchema" as const,
  _inputType: undefined as unknown as CfCandidatesInput,
  schema: {
    type: "object",
    properties: {
      userId: { type: "string" },
      minRating: { type: "number" },
      maxRating: { type: "number" },
      includeTags: { type: "array", items: { type: "string" } },
      excludeTags: { type: "array", items: { type: "string" } },
      limit: { type: "number" },
    },
    required: ["userId"],
  },
  validate(input: unknown): CfCandidatesInput {
    if (!input || typeof input !== "object") {
      throw new Error("Input must be an object with userId");
    }
    const obj = input as Record<string, unknown>;
    if (typeof obj.userId !== "string" || !obj.userId.trim()) {
      throw new Error("userId must be a non-empty string");
    }

    const result: {
      userId: string;
      minRating?: number;
      maxRating?: number;
      includeTags?: string[];
      excludeTags?: string[];
      limit?: number;
    } = { userId: obj.userId };

    if (typeof obj.minRating === "number") result.minRating = obj.minRating;
    if (typeof obj.maxRating === "number") result.maxRating = obj.maxRating;
    if (Array.isArray(obj.includeTags)) result.includeTags = obj.includeTags.filter((t): t is string => typeof t === "string");
    if (Array.isArray(obj.excludeTags)) result.excludeTags = obj.excludeTags.filter((t): t is string => typeof t === "string");
    if (typeof obj.limit === "number") {
      result.limit = Math.min(100, Math.max(1, Math.trunc(obj.limit)));
    }

    return result;
  },
};

export function createCfCandidatesTool(deps: CfCandidatesToolDeps): AgentTool<CfCandidatesInput, unknown> {
  return {
    metadata: createCfCandidatesMetadata(),
    inputSchema: cfCandidatesInputSchema,

    async execute(
      input: CfCandidatesInput,
      context: ToolExecutionContext,
    ): Promise<ToolExecutionResult<unknown>> {
      const startedAt = new Date().toISOString();
      const toolCallId = `tcall_cf_candidates_${Date.now()}`;

      try {
        // Security: verify the requesting user matches
        if (context.userId !== input.userId) {
          return {
            toolCallId,
            status: ToolExecutionStatus.Rejected,
            safeSummary: "权限拒绝：只能查询自己的训练候选题",
            errorCode: "PERMISSION_DENIED",
            retryable: false,
            startedAt,
            completedAt: new Date().toISOString(),
            durationMs: 0,
          };
        }

        const result = await deps.queryCandidatesForUser(input.userId, {
          minRating: input.minRating,
          maxRating: input.maxRating,
          includeTags: input.includeTags,
          excludeTags: input.excludeTags,
          limit: input.limit,
        });

        return {
          toolCallId,
          status: ToolExecutionStatus.Success,
          data: result,
          safeSummary: `成功查询 ${result.totalCandidates} 道候选题（已自动排除已完成题目）`,
          retryable: false,
          startedAt,
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - new Date(startedAt).getTime(),
        };
      } catch (err) {
        return {
          toolCallId,
          status: ToolExecutionStatus.Failed,
          safeSummary: "查询训练候选题失败",
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
