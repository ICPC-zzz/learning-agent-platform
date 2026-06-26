export interface SessionSummaryRecord {
  sessionId: string;
  summaryText: string;
  boundaryId?: string;
  sourceMessageIds: readonly string[];
  createdAt: string;
  updatedAt: string;
}

export class SessionSummaryStore {
  private readonly summaries = new Map<string, SessionSummaryRecord>();

  upsert(summary: Omit<SessionSummaryRecord, "updatedAt">): SessionSummaryRecord {
    const now = new Date().toISOString();
    const next: SessionSummaryRecord = {
      sessionId: summary.sessionId,
      summaryText: summary.summaryText,
      ...(summary.boundaryId ? { boundaryId: summary.boundaryId } : {}),
      sourceMessageIds: [...summary.sourceMessageIds],
      createdAt: summary.createdAt,
      updatedAt: now,
    };
    this.summaries.set(summary.sessionId, next);
    return cloneSummary(next);
  }

  get(sessionId: string): SessionSummaryRecord | null {
    const summary = this.summaries.get(sessionId);
    return summary ? cloneSummary(summary) : null;
  }

  list(): SessionSummaryRecord[] {
    return Array.from(this.summaries.values()).map((summary) => cloneSummary(summary));
  }

  clear(sessionId?: string): void {
    if (sessionId === undefined) {
      this.summaries.clear();
      return;
    }

    this.summaries.delete(sessionId);
  }
}

function cloneSummary(summary: SessionSummaryRecord): SessionSummaryRecord {
  return {
    sessionId: summary.sessionId,
    summaryText: summary.summaryText,
    ...(summary.boundaryId ? { boundaryId: summary.boundaryId } : {}),
    sourceMessageIds: [...summary.sourceMessageIds],
    createdAt: summary.createdAt,
    updatedAt: summary.updatedAt,
  };
}
