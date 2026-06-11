"use client";

/**
 * Reader AI Question Panel — "向 AI 提问本章" 客户端面板。
 *
 * 功能:
 * - 输入问题
 * - 显示当前模式（mock / external-dev / blocked）
 * - 显示回答
 * - 保存安全问答摘要到 localStorage 历史
 * - 展示当前章节最近 3 条问答历史
 * - 安全提示：开发预览、mock 默认、需显式 env 开启、不保存 prompt/response
 *
 * Designation: **开发预览 · dev-only · mock 默认 · 未接生产 AI 服务**
 *
 * @module ReaderAiQuestionPanel
 * @previewOnly
 */

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { readerAiQaServerAction } from "./reader-ai-qa-server-action";
import { buildReaderAiQaPanelViewModel } from "./reader-ai-qa-view-model";

// ---------------------------------------------------------------------------
// Types for history (mirrors local-reader-ai-history-store types)
// ---------------------------------------------------------------------------

interface ReaderAiHistoryEntry {
  historyId: string;
  bookId: string;
  chapterId: string;
  bookTitle: string;
  chapterTitle: string;
  questionPreview: string;
  answerPreview: string;
  providerMode: string;
  realProviderCalled: boolean;
  createdAt: string;
  sourceType: string;
  codeBlockCount: number;
  safeToExposeToClient: boolean;
}

var HISTORY_STORE_KEY = "lap.web.reader.aiHistory";
var MAX_QUESTION_PREVIEW = 200;
var MAX_ANSWER_PREVIEW = 500;
var MAX_RECENT_DISPLAY = 3;

function readLocalHistory(): ReaderAiHistoryEntry[] {
  try {
    var raw = window.localStorage.getItem(HISTORY_STORE_KEY);
    if (!raw) return [];
    var parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(function (e: unknown) {
      return e && typeof e === "object" && "historyId" in (e as Record<string, unknown>);
    }) as ReaderAiHistoryEntry[];
  } catch {
    return [];
  }
}

function saveToLocalHistory(entry: ReaderAiHistoryEntry): void {
  try {
    var entries = readLocalHistory();
    entries.unshift(entry);
    if (entries.length > 100) entries = entries.slice(0, 100);
    window.localStorage.setItem(HISTORY_STORE_KEY, JSON.stringify(entries));
  } catch {
    // Silently ignore
  }
}

function removeLocalHistoryItem(historyId: string): void {
  try {
    var entries = readLocalHistory();
    entries = entries.filter(function (e) { return e.historyId !== historyId; });
    window.localStorage.setItem(HISTORY_STORE_KEY, JSON.stringify(entries));
  } catch {
    // Silently ignore
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ReaderAiQuestionPanelProps {
  bookId: string;
  chapterId: string;
  bookTitle: string;
  chapterTitle: string;
  chapterContent: string;
  codeBlockSummaries?: readonly string[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReaderAiQuestionPanel(props: ReaderAiQuestionPanelProps) {
  const {
    bookId,
    chapterId,
    bookTitle,
    chapterTitle,
    chapterContent,
    codeBlockSummaries,
  } = props;

  const [question, setQuestion] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastResult, setLastResult] =
    useState<Awaited<ReturnType<typeof readerAiQaServerAction>> | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [historyEntries, setHistoryEntries] = useState<ReaderAiHistoryEntry[]>([]);

  // Load history on mount
  useEffect(function () {
    var all = readLocalHistory();
    var chapterEntries = all.filter(function (e) {
      return e.bookId === bookId && e.chapterId === chapterId;
    });
    setHistoryEntries(chapterEntries.slice(0, MAX_RECENT_DISPLAY * 2));
  }, [bookId, chapterId]);

  const handleSubmit = useCallback(
    async function (e: FormEvent) {
      e.preventDefault();
      var trimmed = question.trim();
      if (!trimmed || isSubmitting) return;

      setIsSubmitting(true);
      setSubmitError(null);
      setLastResult(null);

      try {
        var result = await readerAiQaServerAction({
          bookId,
          chapterId,
          question: trimmed,
          bookTitle,
          chapterTitle,
          chapterContent,
          codeBlockSummaries,
        });
        setLastResult(result);

        // Save to local history
        var codeBlockCount = codeBlockSummaries ? codeBlockSummaries.length : 0;
        var historyEntry: ReaderAiHistoryEntry = {
          historyId: "local-ai-hist-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
          bookId: bookId,
          chapterId: chapterId,
          bookTitle: bookTitle,
          chapterTitle: chapterTitle,
          questionPreview: trimmed.slice(0, MAX_QUESTION_PREVIEW),
          answerPreview: result.answerPreview.slice(0, MAX_ANSWER_PREVIEW),
          providerMode: result.providerMode,
          realProviderCalled: result.realProviderCalled,
          createdAt: new Date().toISOString(),
          sourceType: "reader-qa",
          codeBlockCount: codeBlockCount,
          safeToExposeToClient: true,
        };
        saveToLocalHistory(historyEntry);

        // Refresh history display
        var updated = readLocalHistory().filter(function (e) {
          return e.bookId === bookId && e.chapterId === chapterId;
        });
        setHistoryEntries(updated.slice(0, MAX_RECENT_DISPLAY * 2));
      } catch (err: unknown) {
        var message =
          err instanceof Error ? err.message : "请求失败，请稍后重试。";
        setSubmitError(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      question,
      isSubmitting,
      bookId,
      chapterId,
      bookTitle,
      chapterTitle,
      chapterContent,
      codeBlockSummaries,
    ],
  );

  var viewModel = buildReaderAiQaPanelViewModel({
    result: lastResult,
    submitError,
    isSubmitting,
    question,
  });

  var recentItems = historyEntries.slice(0, MAX_RECENT_DISPLAY);

  return (
    <section className="askAiPanel" aria-labelledby="ask-ai-title">
      <p className="eyebrow">{viewModel.eyebrowLabel}</p>
      <h2 id="ask-ai-title">向 AI 提问本章</h2>

      {/* Mode indicator */}
      <div className="aiModeNotice" aria-live="polite">
        <span className={`aiModeBadge aiModeBadge--${viewModel.modeCssClass}`}>
          {viewModel.modeLabel}
        </span>
        <p className="aiModeDescription">{viewModel.modeDescription}</p>
      </div>

      {/* Question form */}
      <form onSubmit={handleSubmit}>
        <textarea
          value={question}
          onChange={function (e) { setQuestion(e.target.value); }}
          placeholder="输入关于本章的问题（例如：请解释这段代码的作用）"
          rows={4}
          maxLength={1000}
          disabled={isSubmitting || viewModel.inputDisabled}
          aria-label="向 AI 提问"
        />
        <div className="askAiFormFooter">
          <span className="charCounter">
            {question.length}/{viewModel.maxQuestionChars}
          </span>
          <button
            type="submit"
            disabled={
              isSubmitting ||
              viewModel.submitDisabled ||
              question.trim().length === 0
            }
          >
            {isSubmitting ? "请求中..." : viewModel.submitLabel}
          </button>
        </div>
      </form>

      {/* Error display */}
      {submitError && (
        <div className="aiAnswerError" role="alert">
          <p>{submitError}</p>
        </div>
      )}

      {/* Answer display */}
      {lastResult && (
        <div className="aiAnswer" aria-live="polite">
          <div className="aiAnswerMeta">
            <span className="aiAnswerModeBadge">
              {lastResult.providerMode === "external-dev-only"
                ? "external-dev（真实调用）"
                : lastResult.providerMode === "mock"
                  ? "mock（模拟回答）"
                  : "blocked（已阻止）"}
            </span>
            {lastResult.realProviderCalled && (
              <span className="aiAnswerRealBadge">真实 API 调用</span>
            )}
          </div>
          <pre className="aiAnswerContent">{lastResult.answerPreview}</pre>
          <details className="aiAnswerDetails">
            <summary>安全信息</summary>
            <dl>
              <dt>Provider 模式</dt>
              <dd>{lastResult.providerMode}</dd>
              <dt>真实 provider 调用</dt>
              <dd>{lastResult.realProviderCalled ? "是" : "否"}</dd>
              <dt>devOnly</dt>
              <dd>{lastResult.devOnly ? "是" : "否"}</dd>
              <dt>productionReady</dt>
              <dd>{lastResult.productionReady ? "是" : "否"}</dd>
              {lastResult.safeToExposeToClient.contextUsed && (
                <>
                  <dt>上下文已构建</dt>
                  <dd>是</dd>
                  <dt>上下文截断</dt>
                  <dd>
                    {lastResult.safeToExposeToClient.contextTruncated
                      ? "是"
                      : "否"}
                  </dd>
                  <dt>敏感字段检测</dt>
                  <dd>
                    {lastResult.safeToExposeToClient.sensitiveFieldsDetected
                      ? "是（已脱敏）"
                      : "未检测到"}
                  </dd>
                </>
              )}
              {lastResult.blockedReasons.length > 0 && (
                <>
                  <dt>阻止原因</dt>
                  <dd>{lastResult.blockedReasons.join(", ")}</dd>
                </>
              )}
            </dl>
          </details>
        </div>
      )}

      {/* Warnings */}
      {lastResult && lastResult.warnings.length > 0 && (
        <div className="aiWarnings">
          <p className="aiWarningsTitle">系统提示：</p>
          <ul>
            {lastResult.warnings.map(function (w, i) {
              return <li key={i}>{w}</li>;
            })}
          </ul>
        </div>
      )}

      {/* History section */}
      {recentItems.length > 0 && (
        <div className="aiHistorySection" style={{ marginTop: "16px" }}>
          <div className="aiHistoryHeader" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ fontSize: "12px", color: "#64748b", margin: 0 }}>
              本章问答历史（最近 {MAX_RECENT_DISPLAY} 条 · 仅保存安全摘要）
            </p>
            <button
              type="button"
              onClick={function () {
                for (var i = 0; i < recentItems.length; i++) {
                  removeLocalHistoryItem(recentItems[i].historyId);
                }
                setHistoryEntries([]);
              }}
              style={{
                fontSize: "11px",
                background: "none",
                border: "1px solid #cbd5e1",
                borderRadius: "4px",
                padding: "2px 8px",
                cursor: "pointer",
                color: "#64748b",
              }}
            >
              清除本章历史
            </button>
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0 0" }}>
            {recentItems.map(function (item) {
              return (
                <li
                  key={item.historyId}
                  style={{
                    marginBottom: "8px",
                    padding: "8px",
                    background: "#f8fafc",
                    borderRadius: "6px",
                    fontSize: "12px",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: "0 0 4px 0", color: "#334155", fontWeight: 600, fontSize: "11px" }}>
                        Q: {item.questionPreview}
                      </p>
                      <p style={{ margin: "0", color: "#475569", fontSize: "11px", lineHeight: "1.4" }}>
                        A: {item.answerPreview}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={function () {
                        removeLocalHistoryItem(item.historyId);
                        setHistoryEntries(function (prev) {
                          return prev.filter(function (e) { return e.historyId !== item.historyId; });
                        });
                      }}
                      style={{
                        fontSize: "10px",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#94a3b8",
                        padding: "0 4px",
                      }}
                      title="删除本条历史"
                    >
                      ×
                    </button>
                  </div>
                  <p style={{ margin: "4px 0 0 0", color: "#94a3b8", fontSize: "10px" }}>
                    {item.providerMode} · {item.realProviderCalled ? "真实 API" : "mock"} · {item.codeBlockCount} 代码块
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Static safety notice */}
      <footer className="aiSafetyNotice">
        <p className="aiSafetyTitle">安全声明</p>
        <ul>
          <li>开发预览 · dev-only · 未接生产 AI 服务</li>
          <li>默认 mock，不调用真实 AI</li>
          <li>真实 provider 需显式 env 开启（LAP_LLM_DEV_PROVIDER_ENABLED + LAP_LLM_DEV_ENDPOINT/API_KEY/MODEL）</li>
          <li>不会保存原始 prompt/response</li>
          <li>不执行工具/Agent/RAG</li>
          <li>不写数据库</li>
          <li>仅保存安全摘要（question ≤ 200字，answer ≤ 500字）到 localStorage</li>
        </ul>
      </footer>
    </section>
  );
}
