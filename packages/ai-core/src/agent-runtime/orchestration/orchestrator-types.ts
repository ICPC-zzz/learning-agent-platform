// ============================================================
// Agent Runtime v1  --  Orchestrator Contracts & Agent Descriptors
// ============================================================
// Type-level contracts only. No real LLM routing, no real multi-agent
// execution. Includes FakeOrchestrator for testing.

import type {
  AgentId,
  AgentRole,
  AgentTask,
  AgentTaskStatus,
  RunId,
  TaskId,
  AgentExecutionStatus,
} from "../core/agent-types.ts";
import type { AgentEvent } from "../core/agent-events.ts";
import type { AgentToolCategory } from "../tools/tool-types.ts";
import type { MemoryAccessLevel } from "../memory/agent-memory-adapter.ts";

// -----------------------------------------------------------
// Agent Descriptor
// -----------------------------------------------------------

export interface AgentDescriptor {
  readonly id: AgentId;
  readonly name: string;
  readonly description: string;
  readonly role: AgentRole;
  readonly capabilities: readonly string[];
  readonly allowedToolCategories: readonly AgentToolCategory[];
  readonly memoryAccess: MemoryAccessLevel;
  readonly parallelSafe: boolean;
  readonly enabled: boolean;
}

// -----------------------------------------------------------
// Agent Request / Intent / Plan
// -----------------------------------------------------------

export interface AgentRequest {
  readonly requestId: string;
  readonly userId?: string;
  readonly conversationId?: string;
  readonly intent: string;
  readonly input: Readonly<Record<string, unknown>>;
  readonly context?: Readonly<Record<string, unknown>>;
}

export interface AgentIntent {
  readonly kind: string;
  readonly description: string;
  readonly confidence: number;
  readonly suggestedAgentIds: readonly AgentId[];
}

export interface AgentPlanStep {
  readonly stepId: string;
  readonly agentId: AgentId;
  readonly description: string;
  readonly dependencies: readonly string[]; // stepIds
  readonly expectedOutput: string;
}

export interface AgentPlan {
  readonly planId: string;
  readonly requestId: string;
  readonly intent: AgentIntent;
  readonly steps: readonly AgentPlanStep[];
  readonly createdAt: string;
}

export interface AgentResult {
  readonly agentId: AgentId;
  readonly taskId: TaskId;
  readonly status: AgentTaskStatus;
  readonly summary: string;
  readonly data?: Readonly<Record<string, unknown>>;
  readonly completedAt: string;
}

export interface AggregatedAgentResult {
  readonly runId: RunId;
  readonly status: AgentExecutionStatus;
  readonly results: readonly AgentResult[];
  readonly summary: string;
  readonly completedAt: string;
}

// -----------------------------------------------------------
// Orchestrator Interface (Contract Only)
// -----------------------------------------------------------

export interface AgentOrchestrator {
  /**
   * Analyze a request and produce an execution plan.
   * In v1, this is deterministic or fake  --  no LLM routing.
   */
  plan(request: AgentRequest): Promise<AgentPlan>;

  /**
   * Execute a plan, yielding events as agents progress.
   * In v1, this iterates over steps synchronously  --  no real parallelism.
   */
  execute(plan: AgentPlan): AsyncIterable<AgentEvent>;

  /**
   * Cancel an in-progress run.
   */
  cancel(runId: RunId): Promise<void>;
}

// -----------------------------------------------------------
// Fake Orchestrator (for Testing)
// -----------------------------------------------------------

export class FakeOrchestrator implements AgentOrchestrator {
  private cancelledRuns = new Set<RunId>();

  async plan(request: AgentRequest): Promise<AgentPlan> {
    return {
      planId: `plan_${Date.now()}`,
      requestId: request.requestId,
      intent: {
        kind: "test",
        description: `Fake plan for: ${request.intent}`,
        confidence: 0.9,
        suggestedAgentIds: ["orchestrator"],
      },
      steps: [
        {
          stepId: "step_1",
          agentId: "orchestrator",
          description: "Analyze request",
          dependencies: [],
          expectedOutput: "Intent analysis result",
        },
        {
          stepId: "step_2",
          agentId: "orchestrator",
          description: "Execute task",
          dependencies: ["step_1"],
          expectedOutput: "Task execution result",
        },
      ],
      createdAt: new Date().toISOString(),
    };
  }

  async *execute(plan: AgentPlan): AsyncIterable<AgentEvent> {
    const runId = `run_${Date.now()}`;

    // Yield plan steps as agent progress events
    for (const step of plan.steps) {
      if (this.cancelledRuns.has(runId)) {
        break;
      }

      yield {
        eventId: `evt_${Math.random().toString(36).slice(2)}`,
        sequence: 0, // simplified for fake
        runId,
        timestamp: new Date().toISOString(),
        type: "agent.progress",
        agentId: step.agentId,
        payload: {
          message: `Executing step: ${step.description}`,
        },
      } as AgentEvent;
    }
  }

  async cancel(runId: RunId): Promise<void> {
    this.cancelledRuns.add(runId);
  }
}

// -----------------------------------------------------------
// Agent Descriptors (All Disabled)
// -----------------------------------------------------------

export const AGENT_DESCRIPTORS: readonly AgentDescriptor[] = [
  {
    id: "orchestrator",
    name: "Orchestrator",
    description: "Central orchestrator agent  --  entry point for all user requests.",
    role: "orchestrator",
    capabilities: ["intent_recognition", "task_routing", "result_aggregation"],
    allowedToolCategories: [],
    memoryAccess: "compressed",
    parallelSafe: false,
    enabled: false,
  },
  {
    id: "cf-data-collector",
    name: "CF Data Collector",
    description: "Collects Codeforces user data including submissions, ratings, and contest history.",
    role: "cf-data-collector",
    capabilities: ["cf_api_read", "submission_fetch", "rating_history"],
    allowedToolCategories: ["readonly", "content_fetch"],
    memoryAccess: "short",
    parallelSafe: true,
    enabled: false,
  },
  {
    id: "cf-data-analyst",
    name: "CF Data Analyst",
    description: "Analyzes CF user data to identify weaknesses, trends, and training recommendations.",
    role: "cf-data-analyst",
    capabilities: ["performance_analysis", "weakness_detection", "trend_analysis"],
    allowedToolCategories: ["readonly", "analysis"],
    memoryAccess: "compressed",
    parallelSafe: true,
    enabled: false,
  },
  {
    id: "cf-report-writer",
    name: "CF Report Writer",
    description: "Generates structured CF training reports and visualizations.",
    role: "cf-report-writer",
    capabilities: ["report_generation", "data_visualization", "summary_writing"],
    allowedToolCategories: ["readonly", "analysis"],
    memoryAccess: "compressed",
    parallelSafe: false,
    enabled: false,
  },
  {
    id: "cf-problem-recommender",
    name: "CF Problem Recommender",
    description: "Recommends Codeforces problems based on user profile and training goals.",
    role: "cf-problem-recommender",
    capabilities: ["problem_selection", "difficulty_matching", "tag_based_filtering"],
    allowedToolCategories: ["readonly", "recommendation"],
    memoryAccess: "learning",
    parallelSafe: false,
    enabled: false,
  },
  {
    id: "problem-parser",
    name: "Problem Parser",
    description: "Parses and structures programming problem statements.",
    role: "problem-parser",
    capabilities: ["problem_parsing", "constraint_extraction", "input_output_analysis"],
    allowedToolCategories: ["readonly", "analysis"],
    memoryAccess: "short",
    parallelSafe: true,
    enabled: false,
  },
  {
    id: "complexity-analyzer",
    name: "Complexity Analyzer",
    description: "Analyzes time and space complexity of algorithms and solutions.",
    role: "complexity-analyzer",
    capabilities: ["time_complexity", "space_complexity", "algorithm_comparison"],
    allowedToolCategories: ["readonly", "analysis"],
    memoryAccess: "short",
    parallelSafe: true,
    enabled: false,
  },
  {
    id: "debugger",
    name: "Debugger",
    description: "Diagnoses issues in code solutions and suggests fixes.",
    role: "debugger",
    capabilities: ["error_diagnosis", "edge_case_detection", "fix_suggestion"],
    allowedToolCategories: ["readonly", "debug"],
    memoryAccess: "short",
    parallelSafe: false,
    enabled: false,
  },
  {
    id: "code-optimizer",
    name: "Code Optimizer",
    description: "Suggests code optimizations and alternative implementations.",
    role: "code-optimizer",
    capabilities: ["performance_optimization", "code_refactoring", "alternative_approaches"],
    allowedToolCategories: ["readonly", "code_generation"],
    memoryAccess: "short",
    parallelSafe: false,
    enabled: false,
  },
  {
    id: "content-collector",
    name: "Content Collector",
    description: "Collects external content such as tech news, articles, and GitHub trends.",
    role: "content-collector",
    capabilities: ["content_fetching", "source_aggregation"],
    allowedToolCategories: ["readonly", "content_fetch"],
    memoryAccess: "none",
    parallelSafe: true,
    enabled: false,
  },
  {
    id: "content-summarizer",
    name: "Content Summarizer",
    description: "Summarizes collected content into digestible reports.",
    role: "content-summarizer",
    capabilities: ["text_summarization", "key_point_extraction"],
    allowedToolCategories: ["readonly", "analysis"],
    memoryAccess: "none",
    parallelSafe: true,
    enabled: false,
  },
];

// -----------------------------------------------------------
// Descriptor Lookup Helpers
// -----------------------------------------------------------

export function getAgentDescriptor(
  agentId: AgentId,
): AgentDescriptor | undefined {
  return AGENT_DESCRIPTORS.find((d) => d.id === agentId);
}

export function getEnabledAgents(): AgentDescriptor[] {
  return AGENT_DESCRIPTORS.filter((d) => d.enabled);
}

export function getAgentsByRole(role: AgentRole): AgentDescriptor[] {
  return AGENT_DESCRIPTORS.filter((d) => d.role === role);
}

// -----------------------------------------------------------
// Future Tool Mapping (Documentation Only  --  Not Registered)
// -----------------------------------------------------------

/**
 * Candidate tool mappings for future rounds.
 * These are NOT registered in the ToolRegistry and exist only as documentation.
 */
export const FUTURE_TOOL_MAPPINGS: Readonly<
  Record<string, { readonly category: string; readonly description: string }>
> = {
  "cf.user.snapshot.read": {
    category: "readonly",
    description: "Read CF user profile snapshot  --  contest history, rating, submissions summary.",
  },
  "cf.problem.candidates.read": {
    category: "readonly",
    description: "Read curated CF problem candidates filtered by user profile.",
  },
  "content.daily.hotspots.read": {
    category: "readonly",
    description: "Read daily tech hotspots from HN + DEV.to.",
  },
  "content.github.report.read": {
    category: "readonly",
    description: "Read daily GitHub trending report.",
  },
};
