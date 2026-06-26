// ============================================================
// Agent Runtime v1  --  Agent Run Event Store Interface
// ============================================================
// Append-only event storage. Events cannot be overwritten; sequence
// collisions are rejected.

import type { AgentEvent, AgentEventSequence } from "../core/agent-events.ts";
import type { RunId } from "../core/agent-types.ts";

/**
 * Contract for an append-only event store.
 * Events are keyed by runId and must be appendable only.
 * No overwrite or update semantics are exposed.
 */
export interface AgentRunEventStore {
  /**
   * Append a single event to the run's event stream.
   * MUST reject if an event with the same sequence and runId already exists.
   */
  append(event: AgentEvent): Promise<void>;

  /**
   * List all events for a run in sequence order (ascending).
   */
  list(runId: RunId): Promise<AgentEvent[]>;

  /**
   * Count events for a run.
   */
  count(runId: RunId): Promise<number>;
}

// -----------------------------------------------------------
// Sequence Conflict Error
// -----------------------------------------------------------

export class SequenceConflictError extends Error {
  public readonly runId: RunId;
  public readonly sequence: AgentEventSequence;

  constructor(runId: RunId, sequence: AgentEventSequence) {
    super(
      `Sequence ${sequence} already exists for run "${runId}". Events are append-only.`,
    );
    this.name = "SequenceConflictError";
    this.runId = runId;
    this.sequence = sequence;
  }
}
