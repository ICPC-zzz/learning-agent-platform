import type { MemoryAuditEvent } from "./types.ts";
import { createMemoryId } from "./utils.ts";

export class MemoryAuditLog {
  private readonly events: MemoryAuditEvent[] = [];

  record(input: Omit<MemoryAuditEvent, "id" | "createdAt"> & { id?: string; createdAt?: string }): MemoryAuditEvent {
    const event: MemoryAuditEvent = {
      id: input.id ?? createMemoryId(this.events.length + 1, "audit"),
      sessionId: input.sessionId,
      userId: input.userId,
      eventType: input.eventType,
      message: input.message,
      ...(input.details === undefined ? {} : { details: input.details }),
      createdAt: input.createdAt ?? new Date().toISOString(),
    };

    this.events.push(event);
    return { ...event, ...(event.details ? { details: { ...event.details } } : {}) };
  }

  list(): MemoryAuditEvent[] {
    return this.events.map((event) => ({
      ...event,
      ...(event.details ? { details: { ...event.details } } : {}),
    }));
  }

  clear(): void {
    this.events.length = 0;
  }
}
