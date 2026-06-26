import type { CompactionBoundary, WorkingMemoryMessage } from "./types.ts";

interface WorkingMemorySessionState {
  messages: WorkingMemoryMessage[];
  boundaries: CompactionBoundary[];
}

export class WorkingMemoryStore {
  private readonly sessions = new Map<string, WorkingMemorySessionState>();

  appendMessages(
    sessionId: string,
    messages: readonly WorkingMemoryMessage[],
  ): WorkingMemoryMessage[] {
    const state = this.getState(sessionId);
    state.messages.push(...messages.map((message) => cloneMessage(message)));
    return this.getMessages(sessionId);
  }

  getMessages(sessionId: string, limit?: number): WorkingMemoryMessage[] {
    const state = this.getState(sessionId);
    const items = limit === undefined ? state.messages : state.messages.slice(-normalizeLimit(limit));
    return items.map((message) => cloneMessage(message));
  }

  setMessages(sessionId: string, messages: readonly WorkingMemoryMessage[]): WorkingMemoryMessage[] {
    const state = this.getState(sessionId);
    state.messages = messages.map((message) => cloneMessage(message));
    return this.getMessages(sessionId);
  }

  appendBoundary(sessionId: string, boundary: CompactionBoundary): CompactionBoundary {
    const state = this.getState(sessionId);
    state.boundaries.push(cloneBoundary(boundary));
    return cloneBoundary(boundary);
  }

  getBoundaries(sessionId: string): CompactionBoundary[] {
    const state = this.getState(sessionId);
    return state.boundaries.map((boundary) => cloneBoundary(boundary));
  }

  clear(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  private getState(sessionId: string): WorkingMemorySessionState {
    const existing = this.sessions.get(sessionId);
    if (existing) {
      return existing;
    }

    const created: WorkingMemorySessionState = {
      messages: [],
      boundaries: [],
    };
    this.sessions.set(sessionId, created);
    return created;
  }
}

function cloneMessage(message: WorkingMemoryMessage): WorkingMemoryMessage {
  return {
    id: message.id,
    sessionId: message.sessionId,
    role: message.role,
    content: message.content,
    ...(message.attachments ? { attachments: [...message.attachments] } : {}),
    createdAt: message.createdAt,
  };
}

function cloneBoundary(boundary: CompactionBoundary): CompactionBoundary {
  return {
    id: boundary.id,
    sessionId: boundary.sessionId,
    trigger: boundary.trigger,
    sourceMessageIds: [...boundary.sourceMessageIds],
    sourceMessageRange: [boundary.sourceMessageRange[0], boundary.sourceMessageRange[1]],
    preTokenEstimate: boundary.preTokenEstimate,
    postTokenEstimate: boundary.postTokenEstimate,
    preservedTailMessageIds: [...boundary.preservedTailMessageIds],
    ...(boundary.summaryId ? { summaryId: boundary.summaryId } : {}),
    createdAt: boundary.createdAt,
  };
}

function normalizeLimit(limit: number): number {
  if (!Number.isFinite(limit)) {
    return 0;
  }

  return Math.max(0, Math.trunc(limit));
}
