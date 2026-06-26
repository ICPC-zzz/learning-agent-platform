// ============================================================
// Agent Runtime v1  --  In-Memory Append-Only Event Store
// ============================================================

import type { AgentEvent } from "../core/agent-events.ts";
import type { RunId } from "../core/agent-types.ts";
import {
  type AgentRunEventStore,
  SequenceConflictError,
} from "./event-store.ts";

/**
 * An in-memory implementation of AgentRunEventStore.
 * Events are stored in insertion order. Sequence conflicts are detected.
 */
export class InMemoryAgentRunEventStore implements AgentRunEventStore {
  /** RunId → ordered array of events. */
  private readonly events = new Map<RunId, AgentEvent[]>();

  /** RunId → Set of already-used sequence numbers. */
  private readonly sequences = new Map<RunId, Set<number>>();

  async append(event: AgentEvent): Promise<void> {
    const runSeq = this.sequences.get(event.runId);

    if (runSeq?.has(event.sequence)) {
      throw new SequenceConflictError(event.runId, event.sequence);
    }

    // Lazy init
    if (!this.events.has(event.runId)) {
      this.events.set(event.runId, []);
      this.sequences.set(event.runId, new Set());
    }

    const runEvents = this.events.get(event.runId)!;
    const runSeqSet = this.sequences.get(event.runId)!;

    // Insert in sequence order (events should arrive monotonically, but
    // we sort defensively on list())
    runEvents.push(event);
    runSeqSet.add(event.sequence);
  }

  async list(runId: RunId): Promise<AgentEvent[]> {
    const events = this.events.get(runId);
    if (!events) return [];

    // Return sorted by sequence
    return [...events].sort((a, b) => a.sequence - b.sequence);
  }

  async count(runId: RunId): Promise<number> {
    return this.events.get(runId)?.length ?? 0;
  }

  /** Reset all stored events. For testing only. */
  reset(): void {
    this.events.clear();
    this.sequences.clear();
  }

  /** Get events unsorted (for testing speed). */
  _raw(runId: RunId): AgentEvent[] {
    return this.events.get(runId) ?? [];
  }
}
