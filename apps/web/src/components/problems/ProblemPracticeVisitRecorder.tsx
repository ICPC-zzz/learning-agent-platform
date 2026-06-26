"use client";

import { useEffect, useRef } from "react";
import {
  addRecentPractice,
  loadRecentPractice,
  persistRecentPractice,
  type RecentPracticeEntry,
} from "../../lib/local-user-problem-store";

export interface ProblemPracticeVisitRecorderProps {
  problemId: string;
  title: string;
  difficulty: string;
}

/**
 * Records a visit to the problem detail page as a "practiced" entry
 * in localStorage. Fires once per mount.
 *
 * Does NOT call any DB actions — uses only localStorage, matching the
 * ProblemPracticeStatusControl component's approach.
 */
export function ProblemPracticeVisitRecorder({
  problemId,
  title,
  difficulty,
}: ProblemPracticeVisitRecorderProps) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;

    try {
      const entries = loadRecentPractice();
      const entry: RecentPracticeEntry = {
        problemId,
        title,
        difficulty,
        status: "practiced",
        updatedAt: new Date().toISOString(),
      };
      const updated = addRecentPractice(entries, entry);
      persistRecentPractice(updated);
    } catch {
      // Silently ignore — localStorage may be unavailable
    }
  }, [problemId, title, difficulty]);

  return null;
}
