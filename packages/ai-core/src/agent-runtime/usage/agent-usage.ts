// ============================================================
// Agent Runtime v1  --  Usage & Cost Tracking
// ============================================================
// Unified token/cost/types, configurable pricing, aggregation
// across call/agent/task/run levels. No API key storage.
// No hardcoded unreliable prices  --  pricing table is configurable.

import type { AgentId, RunId, TaskId } from "../core/agent-types.ts";

// -----------------------------------------------------------
// Usage Snapshot (per-call)
// -----------------------------------------------------------

export interface LlmUsageSnapshot {
  readonly provider: string;
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedInputTokens: number;
  readonly reasoningTokens: number;
  readonly toolCalls: number;
  readonly estimatedCost: number | null;
  readonly currency: string;
  readonly isEstimated: boolean;
}

// -----------------------------------------------------------
// Pricing Table
// -----------------------------------------------------------

export interface ModelPricingEntry {
  readonly provider: string;
  readonly model: string;
  readonly inputPricePer1k: number; // USD per 1000 tokens
  readonly outputPricePer1k: number;
  readonly cachedInputPricePer1k?: number;
}

export interface PricingTable {
  getPrice(provider: string, model: string): ModelPricingEntry | undefined;
  listProviders(): string[];
  listModels(provider: string): string[];
}

export class InMemoryPricingTable implements PricingTable {
  private readonly entries: ModelPricingEntry[];

  constructor(entries: readonly ModelPricingEntry[] = []) {
    this.entries = [...entries];
  }

  getPrice(
    provider: string,
    model: string,
  ): ModelPricingEntry | undefined {
    return this.entries.find(
      (e) =>
        e.provider.toLowerCase() === provider.toLowerCase() &&
        e.model.toLowerCase() === model.toLowerCase(),
    );
  }

  listProviders(): string[] {
    return [...new Set(this.entries.map((e) => e.provider))];
  }

  listModels(provider: string): string[] {
    return this.entries
      .filter(
        (e) => e.provider.toLowerCase() === provider.toLowerCase(),
      )
      .map((e) => e.model);
  }

  addEntry(entry: ModelPricingEntry): void {
    this.entries.push(entry);
  }
}

// -----------------------------------------------------------
// Cost Calculator
// -----------------------------------------------------------

export interface CostEstimate {
  readonly cost: number;
  readonly currency: string;
  readonly breakdown: {
    readonly inputCost: number;
    readonly outputCost: number;
    readonly cachedInputCost: number;
  };
  readonly isEstimated: boolean;
}

export function calculateCost(
  usage: {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly cachedInputTokens: number;
  },
  pricing: ModelPricingEntry,
): CostEstimate {
  const inputCost =
    (usage.inputTokens / 1000) * pricing.inputPricePer1k;
  const outputCost =
    (usage.outputTokens / 1000) * pricing.outputPricePer1k;
  const cachedInputCost =
    (usage.cachedInputTokens / 1000) *
    (pricing.cachedInputPricePer1k ?? pricing.inputPricePer1k);

  return {
    cost: inputCost + outputCost + cachedInputCost,
    currency: "USD",
    breakdown: {
      inputCost: Math.round(inputCost * 10_000) / 10_000,
      outputCost: Math.round(outputCost * 10_000) / 10_000,
      cachedInputCost: Math.round(cachedInputCost * 10_000) / 10_000,
    },
    isEstimated: true,
  };
}

// -----------------------------------------------------------
// Usage Aggregator
// -----------------------------------------------------------

export interface AggregatedUsage {
  readonly totalInputTokens: number;
  readonly totalOutputTokens: number;
  readonly totalCachedInputTokens: number;
  readonly totalReasoningTokens: number;
  readonly totalToolCalls: number;
  readonly totalEstimatedCost: number | null;
  readonly currency: string;
  readonly calls: readonly LlmUsageSnapshot[];
}

export class UsageAggregator {
  private calls: LlmUsageSnapshot[] = [];

  record(snapshot: LlmUsageSnapshot): void {
    this.calls.push(snapshot);
  }

  aggregate(): AggregatedUsage {
    let input = 0;
    let output = 0;
    let cached = 0;
    let reasoning = 0;
    let toolCalls = 0;
    let cost: number | null = 0;
    let costUnknown = false;

    for (const call of this.calls) {
      input += call.inputTokens;
      output += call.outputTokens;
      cached += call.cachedInputTokens;
      reasoning += call.reasoningTokens;
      toolCalls += call.toolCalls;

      if (call.estimatedCost === null) {
        costUnknown = true;
      } else {
        (cost as number) += call.estimatedCost;
      }
    }

    return {
      totalInputTokens: input,
      totalOutputTokens: output,
      totalCachedInputTokens: cached,
      totalReasoningTokens: reasoning,
      totalToolCalls: toolCalls,
      totalEstimatedCost: costUnknown ? null : cost,
      currency: "USD",
      calls: this.calls,
    };
  }

  reset(): void {
    this.calls = [];
  }
}

// -----------------------------------------------------------
// Multi-level Usage Tracker
// -----------------------------------------------------------

export interface AgentUsageTracker {
  recordCall(call: LlmUsageSnapshot): void;
  getCallUsage(): AggregatedUsage;
  getAgentUsage(agentId: AgentId): AggregatedUsage;
  getTaskUsage(taskId: TaskId): AggregatedUsage;
  getRunUsage(runId: RunId): AggregatedUsage;
  reset(): void;
}

export class InMemoryAgentUsageTracker implements AgentUsageTracker {
  private readonly runAggregators = new Map<RunId, UsageAggregator>();
  private readonly agentAggregators = new Map<AgentId, UsageAggregator>();
  private readonly taskAggregators = new Map<TaskId, UsageAggregator>();
  private readonly globalAggregator = new UsageAggregator();

  private currentRunId?: RunId;
  private currentAgentId?: AgentId;
  private currentTaskId?: TaskId;

  setCurrentContext(params: {
    readonly runId?: RunId;
    readonly agentId?: AgentId;
    readonly taskId?: TaskId;
  }): void {
    if (params.runId !== undefined) this.currentRunId = params.runId;
    if (params.agentId !== undefined) this.currentAgentId = params.agentId;
    if (params.taskId !== undefined) this.currentTaskId = params.taskId;
  }

  recordCall(call: LlmUsageSnapshot): void {
    this.globalAggregator.record(call);

    if (this.currentRunId) {
      this.getOrCreateRunAggregator(this.currentRunId).record(call);
    }

    if (this.currentAgentId) {
      this.getOrCreateAgentAggregator(this.currentAgentId).record(call);
    }

    if (this.currentTaskId) {
      this.getOrCreateTaskAggregator(this.currentTaskId).record(call);
    }
  }

  getCallUsage(): AggregatedUsage {
    return this.globalAggregator.aggregate();
  }

  getAgentUsage(agentId: AgentId): AggregatedUsage {
    return this.agentAggregators.get(agentId)?.aggregate() ?? {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCachedInputTokens: 0,
      totalReasoningTokens: 0,
      totalToolCalls: 0,
      totalEstimatedCost: null,
      currency: "USD",
      calls: [],
    };
  }

  getTaskUsage(taskId: TaskId): AggregatedUsage {
    return this.taskAggregators.get(taskId)?.aggregate() ?? {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCachedInputTokens: 0,
      totalReasoningTokens: 0,
      totalToolCalls: 0,
      totalEstimatedCost: null,
      currency: "USD",
      calls: [],
    };
  }

  getRunUsage(runId: RunId): AggregatedUsage {
    return this.runAggregators.get(runId)?.aggregate() ?? {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCachedInputTokens: 0,
      totalReasoningTokens: 0,
      totalToolCalls: 0,
      totalEstimatedCost: null,
      currency: "USD",
      calls: [],
    };
  }

  reset(): void {
    this.runAggregators.clear();
    this.agentAggregators.clear();
    this.taskAggregators.clear();
    this.globalAggregator.reset();
    this.currentRunId = undefined;
    this.currentAgentId = undefined;
    this.currentTaskId = undefined;
  }

  private getOrCreateRunAggregator(runId: RunId): UsageAggregator {
    if (!this.runAggregators.has(runId)) {
      this.runAggregators.set(runId, new UsageAggregator());
    }

    return this.runAggregators.get(runId)!;
  }

  private getOrCreateAgentAggregator(
    agentId: AgentId,
  ): UsageAggregator {
    if (!this.agentAggregators.has(agentId)) {
      this.agentAggregators.set(agentId, new UsageAggregator());
    }

    return this.agentAggregators.get(agentId)!;
  }

  private getOrCreateTaskAggregator(
    taskId: TaskId,
  ): UsageAggregator {
    if (!this.taskAggregators.has(taskId)) {
      this.taskAggregators.set(taskId, new UsageAggregator());
    }

    return this.taskAggregators.get(taskId)!;
  }
}
