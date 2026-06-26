// Agent Runtime v1 -- Agent Memory Adapter
// Thin adapter over the existing three-layer memory system.
// Does NOT replace or rewrite the existing memory implementation.

import type { AgentId } from "../core/agent-types.ts";

export interface ShortTermMemoryEntry {
  readonly id: string;
  readonly content: string;
  readonly role: string;
  readonly createdAt: string;
}

export interface CompressedMemorySnapshot {
  readonly summaryText: string;
  readonly keyDecisions: readonly string[];
  readonly completedSteps: readonly string[];
  readonly pendingTasks: readonly string[];
  readonly createdAt: string;
}

export interface LongTermMemoryEntry {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly content: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type MemoryAccessLevel = "none" | "short" | "compressed" | "learning";

export interface LongTermMemoryCandidate {
  readonly type: string;
  readonly title: string;
  readonly content: string;
  readonly confidence: number;
  readonly sourceMessageIds: readonly string[];
}

export interface AgentMemoryAdapter {
  loadShortTerm(params: {
    readonly sessionId: string;
    readonly maxEntries?: number;
  }): Promise<ShortTermMemoryEntry[]>;

  loadCompressedMemory(params: {
    readonly sessionId: string;
  }): Promise<CompressedMemorySnapshot[]>;

  loadLongTermLearningMemory(params: {
    readonly agentId: AgentId;
    readonly userId?: string;
    readonly query?: string;
    readonly maxResults?: number;
  }): Promise<LongTermMemoryEntry[]>;

  compact(params: {
    readonly sessionId: string;
    readonly trigger: string;
    readonly sourceMessageIds: readonly string[];
    readonly preTokenEstimate: number;
  }): Promise<CompressedMemorySnapshot>;

  proposeLongTermUpdates(params: {
    readonly agentId: AgentId;
    readonly sessionId: string;
    readonly candidates: readonly LongTermMemoryCandidate[];
  }): Promise<void>;
}

export interface MemoryAuthorization {
  readonly agentId: AgentId;
  readonly accessLevel: MemoryAccessLevel;
}

export function checkMemoryAccess(
  authorization: MemoryAuthorization,
  requiredLevel: MemoryAccessLevel,
): boolean {
  const levels: MemoryAccessLevel[] = ["none", "short", "compressed", "learning"];
  const agentIdx = levels.indexOf(authorization.accessLevel);
  const requiredIdx = levels.indexOf(requiredLevel);
  return agentIdx >= requiredIdx;
}

export class NoOpMemoryAdapter implements AgentMemoryAdapter {
  async loadShortTerm(): Promise<ShortTermMemoryEntry[]> { return []; }
  async loadCompressedMemory(): Promise<CompressedMemorySnapshot[]> { return []; }
  async loadLongTermLearningMemory(): Promise<LongTermMemoryEntry[]> { return []; }
  async compact(): Promise<CompressedMemorySnapshot> {
    return { summaryText: "", keyDecisions: [], completedSteps: [], pendingTasks: [], createdAt: new Date().toISOString() };
  }
  async proposeLongTermUpdates(): Promise<void> {}
}
