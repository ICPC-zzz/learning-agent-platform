"use client";

import { useState, useEffect, useCallback } from "react";
import { listAnalysisHistory, getAnalysisReport, deleteAnalysis } from "./analysis-history-actions.ts";
import type { SavedAnalysisRecord } from "./analysis-history-actions.ts";
import { A492PersonalizedReportView } from "./A492PersonalizedReport.tsx";
import { CodeAnalysisReportView } from "./CodeAnalysisReport.tsx";
import type { A492PersonalizedResult } from "@learning-agent-platform/ai-core/code-analysis/a492-types";
import type { CodeAnalysisResult } from "@learning-agent-platform/ai-core/code-analysis/types";

export function AnalysisHistoryPanel() {
  var [history, setHistory] = useState<SavedAnalysisRecord[]>([]);
  var [loading, setLoading] = useState(false);
  var [activeResult, setActiveResult] = useState<A492PersonalizedResult | CodeAnalysisResult | null>(null);
  var [activeId, setActiveId] = useState<string | null>(null);

  var loadHistory = useCallback(function() {
    setLoading(true);
    listAnalysisHistory().then(function(r) { setHistory(r); }).finally(function() { setLoading(false); });
  }, []);
  useEffect(function() { loadHistory(); }, [loadHistory]);

  var handleDelete = useCallback(function(id: string) {
    if (!confirm("确定删除？")) return;
    deleteAnalysis(id).then(function(ok) {
      if (ok) {
        setHistory(function(p) { return p.filter(function(h) { return h.id !== id; }); });
        if (activeId === id) { setActiveResult(null); setActiveId(null); }
      }
    });
  }, [activeId]);

  // Click: load & jump to full report view
  var handleView = useCallback(function(item: SavedAnalysisRecord) {
    setActiveId(item.id);
    getAnalysisReport(item.id).then(function(data) {
      if (data && (data as any).report) setActiveResult(data as A492PersonalizedResult);
      else if (data && (data as any).findings) setActiveResult(data as CodeAnalysisResult);
    });
  }, []);

  var handleClose = useCallback(function() { setActiveResult(null); setActiveId(null); }, []);

  // Show full report mode
  if (activeResult && activeId) {
    return (
      <div>
        <div style={{ padding: "8px 12px", background: "#fefce8", border: "1px solid #fef08a", borderRadius: "6px", marginBottom: "14px", fontSize: "0.78rem", color: "#92400e" }}>
          历史分析记录，仅作浏览参考。用户水平随时间变化，不再适合作为当前分析依据。
        </div>
        {isA492(activeResult) ? (
          <A492PersonalizedReportView result={activeResult} onReset={handleClose} historyMode={true} />
        ) : (
          <CodeAnalysisReportView result={activeResult} onReset={handleClose} />
        )}
        <div style={{ textAlign: "center", padding: "14px 0" }}>
          <button onClick={handleClose} style={{ border: "1px solid #d1d5db", borderRadius: "6px", background: "#fff", padding: "6px 24px", fontSize: "0.82rem", color: "#374151", cursor: "pointer" }}>
            返回历史列表
          </button>
        </div>
      </div>
    );
  }

  // List mode
  if (loading && history.length === 0) return <div style={{ padding: "12px", color: "#9ca3af", fontSize: "0.85rem" }}>加载中...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#374151" }}>分析历史 ({history.length}条)</span>
        <button type="button" onClick={loadHistory} style={{ border: "1px solid #d1d5db", borderRadius: "6px", background: "#fff", padding: "3px 12px", fontSize: "0.75rem", color: "#6b7280", cursor: "pointer" }}>刷新</button>
      </div>
      {history.length === 0 ? (
        <div style={{ padding: "16px", textAlign: "center", color: "#9ca3af", fontSize: "0.85rem" }}>暂无记录</div>
      ) : history.map(function(item) {
        return (
          <div key={item.id} style={{ padding: "10px 14px", border: "1px solid #e5e7eb", borderRadius: "8px", background: "#fafbfc", cursor: "pointer" }}
            onClick={function() { handleView(item); }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#111827", marginBottom: "4px" }}>{item.summary}</div>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", fontSize: "0.72rem", color: "#6b7280" }}>
                  <span>{item.createdAt.slice(0, 19).replace("T", " ")}</span>
                  {item.problemRating != null && <span>题目: {item.problemRating}</span>}
                  {item.userRating != null && <span>用户: {item.userRating}</span>}
                  {item.findingCount > 0 && <span>{item.findingCount}个发现</span>}
                  <span style={{ padding: "1px 6px", borderRadius: "4px", fontSize: "0.68rem", background: item.personalized ? "#ede9fe" : "#f3f4f6", color: item.personalized ? "#7c3aed" : "#6b7280" }}>{item.personalized ? "个性化" : "基础"}</span>
                  <span style={{ color: "#9ca3af" }}>{item.modelName}</span>
                </div>
              </div>
              <button type="button" onClick={function(e) { e.stopPropagation(); handleDelete(item.id); }} style={{ border: "none", background: "none", color: "#9ca3af", fontSize: "1.1rem", cursor: "pointer", padding: "0 4px", lineHeight: 1 }}>×</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function isA492(r: CodeAnalysisResult | A492PersonalizedResult): r is A492PersonalizedResult {
  return r.success && r.report !== null && "problemProfile" in r.report;
}
