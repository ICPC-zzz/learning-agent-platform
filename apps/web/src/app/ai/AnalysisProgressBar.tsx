"use client";

import { useState, useEffect, useRef } from "react";
import { getAnalysisProgress } from "./analysis-progress-actions.ts";

interface ProgressState {
  phase: string;
  phaseIndex: number;
  totalPhases: number;
  status: "running" | "completed" | "failed";
}

/**
 * Shows live analysis progress by polling the server every 800ms.
 * Only visible during analysis (isRunning=true).
 */
export function AnalysisProgressBar({
  isRunning,
  runId,
  onComplete,
}: {
  isRunning: boolean;
  runId: string;
  onComplete?: () => void;
}) {
  var [progress, setProgress] = useState<ProgressState | null>(null);
  var pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(function() {
    if (!isRunning || !runId) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }

    var poll = function() {
      getAnalysisProgress(runId).then(function(p) {
        if (!p) return;
        setProgress(p);
        if (p.status === "completed" || p.status === "failed") {
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          if (onComplete) onComplete();
        }
      }).catch(function() {});
    };

    poll();
    pollRef.current = setInterval(poll, 800);

    return function() {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [isRunning, runId, onComplete]);

  if (!isRunning) return null;

  var pct = progress ? Math.round((progress.phaseIndex / progress.totalPhases) * 100) : 0;

  return (
    <div style={{
      padding: "10px 16px",
      background: "#eef2ff",
      border: "1px solid #c7d2fe",
      borderRadius: "8px",
      marginBottom: "14px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
        <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#3730a3" }}>
          {progress ? "正在分析: " + progress.phase : "正在初始化..."}
        </span>
        <span style={{ fontSize: "0.72rem", color: "#6366f1" }}>
          {progress ? progress.phaseIndex + "/" + progress.totalPhases : ""}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{
        height: "6px", background: "#c7d2fe", borderRadius: "3px", overflow: "hidden",
      }}>
        <div style={{
          height: "100%", width: pct + "%",
          background: "linear-gradient(90deg, #6366f1, #7c3aed)",
          borderRadius: "3px",
          transition: "width 0.6s ease",
        }} />
      </div>

      {/* Phase dots */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px" }}>
        {progress && Array.from({ length: progress.totalPhases }, function(_, i) {
          var done = i < progress.phaseIndex;
          var current = i === progress.phaseIndex - 1;
          return (
            <span key={i} style={{
              width: "8px", height: "8px", borderRadius: "50%",
              background: done ? "#6366f1" : "#c7d2fe",
              opacity: current ? 1 : 0.6,
              transform: current ? "scale(1.3)" : "scale(1)",
              transition: "all 0.3s ease",
            }} />
          );
        })}
      </div>
    </div>
  );
}
