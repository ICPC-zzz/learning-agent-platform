/**
 * A492 — Analysis Progress Tracker
 *
 * Shared in-memory state so the orchestrator can write current step,
 * and the client can poll for live progress updates.
 *
 * Server-only. Per-user state keyed by userId.
 */
"use server";

interface ProgressState {
  phase: string;
  phaseIndex: number;
  totalPhases: number;
  status: "running" | "completed" | "failed";
  startedAt: number;
  updatedAt: number;
}

var progressMap = new Map<string, ProgressState>();

/** Called by orchestrator before each step */
export async function setAnalysisProgress(
  runId: string,
  phase: string,
  phaseIndex: number,
  totalPhases: number,
  status: "running" | "completed" | "failed" = "running",
): Promise<void> {
  progressMap.set(runId, {
    phase: phase,
    phaseIndex: phaseIndex,
    totalPhases: totalPhases,
    status: status,
    startedAt: Date.now(),
    updatedAt: Date.now(),
  });
}

/** Called by client to poll current progress */
export async function getAnalysisProgress(runId: string): Promise<ProgressState | null> {
  var p = progressMap.get(runId);
  if (!p) return null;
  if (Date.now() - p.updatedAt > 300_000) {
    progressMap.delete(runId);
    return null;
  }
  return p;
}

/** Clean up after analysis completes */
export async function clearAnalysisProgress(runId: string): Promise<void> {
  progressMap.delete(runId);
}
