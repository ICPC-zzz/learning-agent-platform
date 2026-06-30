"use client";

import React, { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { getImportedProblemById } from "../../../lib/local-imported-problem-store";
import type { ProblemExampleLike } from "../../../lib/problem-judge";
import { normalizeJudgeTestCases } from "../../../lib/problem-judge";
import {
  getJudgeStarterCode,
  normalizeJudgeLanguage,
} from "../../../lib/judge/language-runners";
import {
  applyProblemCodeCompletion,
  buildProblemCodeCompletionContext,
  type CodeCompletionSuggestion,
} from "./code-completion";
import {
  formatJudgeCaseStatus,
  formatJudgeSubmissionStatus,
  getJudgeLanguageOptions,
  type JudgeGuardStatusForUi,
  type JudgeLanguageId,
  type JudgeSubmissionResult,
  type JudgeTestCase,
  type JudgeTestCaseResult,
} from "../../../lib/judge/judge-types";
import { submitProblemCodeAction } from "./submit-code-actions";

export interface ProblemCodeSubmissionControlProps {
  problemId: string;
  problemTitle: string;
  sourceKind: "builtin" | "db" | "localStorage";
  initialTestCases: readonly ProblemExampleLike[];
  judgeGuardStatus: JudgeGuardStatusForUi;
}

type LocalStorageLoadState = "idle" | "loading" | "ready" | "missing";

const DEFAULT_LANGUAGE: JudgeLanguageId = "python";

export function ProblemCodeSubmissionControl({
  problemId,
  problemTitle,
  sourceKind,
  initialTestCases,
  judgeGuardStatus,
}: ProblemCodeSubmissionControlProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<JudgeLanguageId>(DEFAULT_LANGUAGE);
  const [codeByLanguage, setCodeByLanguage] = useState<Record<JudgeLanguageId, string>>(
    () => createInitialCodeMap(),
  );
  const [testCases, setTestCases] = useState<JudgeTestCase[]>(() =>
    normalizeJudgeTestCases(initialTestCases),
  );
  const [activeTitle, setActiveTitle] = useState(problemTitle);
  const [loadState, setLoadState] = useState<LocalStorageLoadState>(
    sourceKind === "localStorage" ? "idle" : "ready",
  );
  const [result, setResult] = useState<JudgeSubmissionResult | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [codeSelection, setCodeSelection] = useState({ start: 0, end: 0 });
  const [completionManualOpen, setCompletionManualOpen] = useState(false);
  const [completionDismissedPrefix, setCompletionDismissedPrefix] = useState<string | null>(null);
  const [activeCompletionIndex, setActiveCompletionIndex] = useState(0);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (sourceKind !== "localStorage") {
      setLoadState("ready");
      setActiveTitle(problemTitle);
      setTestCases(normalizeJudgeTestCases(initialTestCases));
      return;
    }

    setLoadState("loading");
    try {
      const imported = getImportedProblemById(problemId);
      if (!imported) {
        setActiveTitle(problemTitle);
        setTestCases([]);
        setLoadState("missing");
        return;
      }

      setActiveTitle(imported.title || problemTitle);
      setTestCases(normalizeJudgeTestCases(imported.judgeTestCases ?? imported.examples));
      setLoadState("ready");
    } catch {
      setActiveTitle(problemTitle);
      setTestCases([]);
      setLoadState("missing");
    }
  }, [initialTestCases, problemId, problemTitle, sourceKind]);

  useEffect(() => {
    setCodeByLanguage((current) => {
      const next = { ...current };
      for (const option of getJudgeLanguageOptions()) {
        if (!next[option.id]) {
          next[option.id] = getJudgeStarterCode(option.id);
        }
      }
      return next;
    });
  }, []);

  const currentCode = codeByLanguage[selectedLanguage];
  const completionContext = useMemo(
    () =>
      buildProblemCodeCompletionContext({
        language: selectedLanguage,
        code: currentCode,
        selectionStart: codeSelection.start,
        selectionEnd: codeSelection.end,
        manualOpen: completionManualOpen,
      }),
    [
      selectedLanguage,
      currentCode,
      codeSelection.start,
      codeSelection.end,
      completionManualOpen,
    ],
  );
  const completionVisible =
    completionManualOpen ||
    (completionContext.prefix.length > 0 &&
      completionContext.prefix !== completionDismissedPrefix);
  const completionSuggestions = completionVisible ? completionContext.suggestions : [];
  const safeCompletionIndex =
    completionSuggestions.length > 0
      ? Math.min(activeCompletionIndex, completionSuggestions.length - 1)
      : 0;
  const activeCompletionSuggestion =
    completionSuggestions[safeCompletionIndex] ?? null;

  useEffect(() => {
    setActiveCompletionIndex(0);
  }, [selectedLanguage, completionContext.prefix, completionManualOpen]);

  const hasTestCases = testCases.length > 0;
  const canJudge = judgeGuardStatus.enabled && hasTestCases && !isPending;
  const submitButtonLabel = isPending
    ? "判题中..."
    : !judgeGuardStatus.enabled
      ? "需要 Docker 沙箱"
      : !hasTestCases
        ? "暂无本地样例"
        : "运行样例";
  const submitDisabledReason = !judgeGuardStatus.enabled
    ? "当前环境未开启本地判题。"
    : !hasTestCases
      ? "该题暂无本地测试用例，无法自动判题。"
      : null;
  const isLocalStorageLoading = sourceKind === "localStorage" && (loadState === "idle" || loadState === "loading");
  const isLocalStorageMissing = sourceKind === "localStorage" && loadState === "missing";
  const summaryLabel = result ? formatJudgeSubmissionStatus(result.status) : "未提交";

  function updateCode(language: JudgeLanguageId, code: string) {
    setCodeByLanguage((current) => ({
      ...current,
      [language]: code,
    }));
  }

  function syncCodeSelection(element: HTMLTextAreaElement) {
    const start = element.selectionStart ?? element.value.length;
    const end = element.selectionEnd ?? start;
    setCodeSelection({ start, end });
  }

  function handleCodeChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    updateCode(selectedLanguage, event.currentTarget.value);
    syncCodeSelection(event.currentTarget);
  }

  function handleCodeSelectionChange(event: React.SyntheticEvent<HTMLTextAreaElement>) {
    syncCodeSelection(event.currentTarget);
  }

  function commitCompletion(suggestion: CodeCompletionSuggestion) {
    const next = applyProblemCodeCompletion({
      code: currentCode,
      replaceStart: completionContext.replaceStart,
      replaceEnd: completionContext.replaceEnd,
      suggestion,
    });

    updateCode(selectedLanguage, next.code);
    setCompletionManualOpen(false);
    setCompletionDismissedPrefix(null);
    setActiveCompletionIndex(0);

    window.requestAnimationFrame(() => {
      const element = textareaRef.current;
      if (!element) {
        return;
      }

      element.focus();
      element.setSelectionRange(next.selectionStart, next.selectionEnd);
      setCodeSelection({ start: next.selectionStart, end: next.selectionEnd });
    });
  }

  function handleCodeKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.code === "Space") {
      event.preventDefault();
      syncCodeSelection(event.currentTarget);
      setCompletionManualOpen(true);
      setCompletionDismissedPrefix(null);
      setActiveCompletionIndex(0);
      return;
    }

    if (!completionVisible || completionSuggestions.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveCompletionIndex((current) =>
        completionSuggestions.length === 0 ? 0 : (current + 1) % completionSuggestions.length,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveCompletionIndex((current) =>
        completionSuggestions.length === 0
          ? 0
          : (current - 1 + completionSuggestions.length) % completionSuggestions.length,
      );
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setCompletionManualOpen(false);
      setCompletionDismissedPrefix(completionContext.prefix || null);
      return;
    }

    if (event.key === "Tab" || event.key === "Enter") {
      event.preventDefault();
      const suggestion = activeCompletionSuggestion ?? completionSuggestions[0];
      if (suggestion) {
        commitCompletion(suggestion);
      }
    }
  }

  function handleLanguageChange(nextLanguage: string) {
    const normalized = normalizeJudgeLanguage(nextLanguage) ?? DEFAULT_LANGUAGE;
    setSelectedLanguage(normalized);
    setResult(null);
    setCodeSelection({ start: 0, end: 0 });
    setCompletionManualOpen(false);
    setCompletionDismissedPrefix(null);
    setActiveCompletionIndex(0);

    setCodeByLanguage((current) => {
      if (current[normalized] && current[normalized].length > 0) {
        return current;
      }

      return {
        ...current,
        [normalized]: getJudgeStarterCode(normalized),
      };
    });
  }

  function handleSubmit() {
    if (!canJudge) {
      return;
    }

    const request = {
      problemId,
      problemTitle: activeTitle,
      language: selectedLanguage,
      code: codeByLanguage[selectedLanguage] ?? getJudgeStarterCode(selectedLanguage),
      testCases,
    };

    setResult(null);
    startTransition(async () => {
      try {
        const next = await submitProblemCodeAction(request);
        setResult(next);
      } catch {
        setResult(
          createLocalSystemErrorResult({
            problemId,
            problemTitle: activeTitle,
            language: selectedLanguage,
            guard: judgeGuardStatus,
            message: "本地判题请求失败。",
          }),
        );
      }
    });
  }

  return (
    <section className="learningPanel" aria-labelledby="problem-code-submit-title">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">代码提交</p>
          <h2 id="problem-code-submit-title">{activeTitle || "题目代码提交"}</h2>
          <p style={helperTextStyle}>
            仅支持标准输入 / 标准输出的一次性判题，不支持交互题。
          </p>
        </div>
        <span style={submissionBadgeStyle(result?.status)}>
          {summaryLabel}
        </span>
      </div>

      <div style={layoutStyle}>
        <div>
          <label style={fieldLabelStyle}>语言</label>
          <select
            value={selectedLanguage}
            onChange={(event) => handleLanguageChange(event.target.value)}
            style={selectStyle}
          >
            {getJudgeLanguageOptions().map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>

          <label style={{ ...fieldLabelStyle, marginTop: "12px" }}>代码</label>
          <div style={{ position: "relative" }}>
            <textarea
              ref={textareaRef}
              value={currentCode}
              onChange={handleCodeChange}
              onClick={handleCodeSelectionChange}
              onKeyDown={handleCodeKeyDown}
              onKeyUp={handleCodeSelectionChange}
              onSelect={handleCodeSelectionChange}
              rows={22}
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              style={textareaStyle}
              placeholder="在这里编写代码。"
            />

            <div style={completionHintStyle}>
              <span>输入 `for`、`pr`、`main` 或 `import`，也可以按 `Ctrl+Space` 打开模板补全。</span>
              <span>{currentCode.length} chars</span>
            </div>

            {completionVisible ? (
              <div style={completionPanelStyle} aria-label="代码补全建议" role="listbox">
                <div style={completionPanelHeaderStyle}>
                  <strong style={{ fontSize: "12px" }}>代码补全</strong>
                  <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                    Tab / Enter 接受，Esc 关闭
                  </span>
                </div>
                {completionSuggestions.length > 0 ? (
                  <div style={completionListStyle}>
                    {completionSuggestions.map((suggestion, index) => (
                      <button
                        key={suggestion.id}
                        type="button"
                        role="option"
                        aria-selected={index === safeCompletionIndex}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          commitCompletion(suggestion);
                        }}
                        onMouseEnter={() => setActiveCompletionIndex(index)}
                        style={completionItemStyle(index === safeCompletionIndex)}
                        title={suggestion.detail}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "12px",
                            alignItems: "baseline",
                          }}
                        >
                          <span style={{ fontWeight: 700 }}>{suggestion.label}</span>
                          <span style={{ fontSize: "10px", color: "#94a3b8", flexShrink: 0 }}>
                            {suggestion.id}
                          </span>
                        </div>
                        <div style={completionDetailStyle}>{suggestion.detail}</div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div style={completionEmptyStyle}>
                    没有匹配的补全，继续输入前缀或按 `Ctrl+Space` 查看模板。
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <aside style={sideStyle}>
          <div style={infoCardStyle}>
            <p style={cardTitleStyle}>判题说明</p>
            <p style={cardTextStyle}>使用题目本地样例做一次 stdin → stdout 判题。</p>
            <p style={cardTextStyle}>Java 主类必须是 <code>Main</code>。</p>
            <p style={cardTextStyle}>提交前会自动填充每种语言的 starter code。</p>
          </div>

          <div style={infoCardStyle}>
            <p style={cardTitleStyle}>本地用例</p>
            {isLocalStorageLoading ? (
              <p style={cardTextStyle}>正在读取本地导入题目的样例。</p>
            ) : isLocalStorageMissing ? (
              <p style={cardTextStyle}>本地导入题目未找到，无法自动判题。</p>
            ) : hasTestCases ? (
              <p style={cardTextStyle}>共有 {testCases.length} 个本地测试用例。</p>
            ) : (
              <p style={cardTextStyle}>该题暂无本地测试用例，无法自动判题。</p>
            )}
            <p style={cardTextStyle}>{judgeGuardStatus.notice}</p>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canJudge}
            style={submitButtonStyle(canJudge)}
          >
            {submitButtonLabel}
          </button>

          {submitDisabledReason ? <p style={warningNoteStyle}>{submitDisabledReason}</p> : null}
        </aside>
      </div>

      {result ? (
        <div style={resultCardStyle} aria-live="polite">
          <div style={resultHeaderStyle}>
            <div>
              <p style={cardTitleStyle}>判题结果</p>
              <p style={cardTextStyle}>{result.message}</p>
            </div>
            <span style={resultStatusStyle(result.status)}>
              {result.statusLabel}
            </span>
          </div>

          <dl style={resultStatsStyle}>
            <div>
              <dt>状态</dt>
              <dd>{result.statusLabel}</dd>
            </div>
            <div>
              <dt>通过 / 总数</dt>
              <dd>
                {result.passedCount} / {result.totalCount}
              </dd>
            </div>
            <div>
              <dt>耗时</dt>
              <dd>{result.durationMs} ms</dd>
            </div>
            <div>
              <dt>语言</dt>
              <dd>{result.languageLabel}</dd>
            </div>
          </dl>

          {result.compileErrorPreview ? (
            <OutputBlock title="编译错误 stderr" value={result.compileErrorPreview} />
          ) : null}

          {result.runtimeErrorPreview ? (
            <OutputBlock title="运行错误 stderr" value={result.runtimeErrorPreview} />
          ) : null}

          {result.systemErrorPreview ? (
            <OutputBlock title="系统错误信息" value={result.systemErrorPreview} />
          ) : null}

          {result.status === "wrong_answer" ? (
            <OutputBlock
              title={
                result.failedCaseIndex !== null
                  ? `第 ${result.failedCaseIndex} 个测试点输出`
                  : "输出不匹配"
              }
              value={buildWrongAnswerPreview(result)}
            />
          ) : null}

          {result.testCaseResults.length > 0 ? (
            <div style={{ marginTop: "14px" }}>
              <p style={cardTitleStyle}>测试点状态</p>
              <div style={caseListStyle}>
                {result.testCaseResults.map((item) => (
                  <div key={`${item.index}-${item.label}`} style={caseCardStyle}>
                    <div style={caseCardHeaderStyle}>
                      <strong>{item.label}</strong>
                      <span style={caseBadgeStyle(item.status)}>{formatJudgeCaseStatus(item.status)}</span>
                    </div>
                    <p style={cardTextStyle}>耗时 {item.durationMs} ms</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function createInitialCodeMap(): Record<JudgeLanguageId, string> {
  return {
    python: getJudgeStarterCode("python"),
    c: getJudgeStarterCode("c"),
    cpp: getJudgeStarterCode("cpp"),
    java: getJudgeStarterCode("java"),
    go: getJudgeStarterCode("go"),
    javascript: getJudgeStarterCode("javascript"),
  };
}

function createLocalSystemErrorResult(input: {
  problemId: string;
  problemTitle: string;
  language: JudgeLanguageId;
  guard: JudgeGuardStatusForUi;
  message: string;
}): JudgeSubmissionResult {
  return {
    success: false,
    status: "system_error",
    statusLabel: formatJudgeSubmissionStatus("system_error"),
    problemId: input.problemId,
    problemTitle: input.problemTitle,
    language: input.language,
    languageLabel: getJudgeLanguageOptions().find((item) => item.id === input.language)?.label ?? input.language,
    guard: input.guard,
    noTestCases: false,
    passedCount: 0,
    totalCount: 0,
    durationMs: 0,
    message: input.message,
    compileErrorPreview: null,
    runtimeErrorPreview: null,
    systemErrorPreview: null,
    failedCaseIndex: null,
    testCaseResults: [],
    safeToExposeToClient: true,
    productionReady: false,
  };
}

function buildWrongAnswerPreview(result: JudgeSubmissionResult): string {
  const failedCase = result.testCaseResults.find((item) => item.status === "wrong_answer");
  if (!failedCase) {
    return "输出与预期不一致。";
  }

  const expected = failedCase.expectedOutputPreview;
  const actual = failedCase.actualOutputPreview ?? "";
  return `预期输出:\n${expected}\n\n实际输出:\n${actual}`;
}

function submissionBadgeStyle(status: JudgeSubmissionResult["status"] | null | undefined): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "4px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 600,
    color: "#0f172a",
    background: badgeBackground(status),
    border: "1px solid rgba(15, 23, 42, 0.08)",
  };
}

function badgeBackground(status: JudgeSubmissionResult["status"] | null | undefined): string {
  if (!status) {
    return "#e2e8f0";
  }

  switch (status) {
    case "accepted":
      return "#dcfce7";
    case "wrong_answer":
      return "#fef3c7";
    case "compile_error":
      return "#fee2e2";
    case "runtime_error":
      return "#fecaca";
    case "time_limit_exceeded":
      return "#fde68a";
    case "system_error":
      return "#e2e8f0";
    case "no_test_cases":
      return "#e0e7ff";
  }
}

function resultStatusStyle(status: JudgeSubmissionResult["status"]): React.CSSProperties {
  const palette: Record<JudgeSubmissionResult["status"], { background: string; color: string }> = {
    accepted: { background: "#dcfce7", color: "#166534" },
    wrong_answer: { background: "#fef3c7", color: "#92400e" },
    compile_error: { background: "#fee2e2", color: "#b91c1c" },
    runtime_error: { background: "#fecaca", color: "#b91c1c" },
    time_limit_exceeded: { background: "#fde68a", color: "#92400e" },
    system_error: { background: "#e2e8f0", color: "#334155" },
    no_test_cases: { background: "#e0e7ff", color: "#3730a3" },
  };

  const chosen = palette[status];
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 12px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 700,
    color: chosen.color,
    background: chosen.background,
    whiteSpace: "nowrap",
  };
}

function caseBadgeStyle(status: JudgeTestCaseResult["status"]): React.CSSProperties {
  const palette: Record<JudgeTestCaseResult["status"], { background: string; color: string }> = {
    accepted: { background: "#dcfce7", color: "#166534" },
    wrong_answer: { background: "#fef3c7", color: "#92400e" },
    runtime_error: { background: "#fecaca", color: "#b91c1c" },
    time_limit_exceeded: { background: "#fde68a", color: "#92400e" },
    system_error: { background: "#e2e8f0", color: "#334155" },
  };

  const chosen = palette[status];
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "3px 8px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 700,
    color: chosen.color,
    background: chosen.background,
  };
}

function OutputBlock({ title, value }: { title: string; value: string }) {
  return (
    <div style={{ marginTop: "14px" }}>
      <p style={cardTitleStyle}>{title}</p>
      <pre style={outputBlockStyle}>{value}</pre>
    </div>
  );
}

const layoutStyle: React.CSSProperties = {
  marginTop: "14px",
  display: "grid",
  gridTemplateColumns: "minmax(0, 2fr) minmax(280px, 1fr)",
  gap: "16px",
};

const sideStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const infoCardStyle: React.CSSProperties = {
  padding: "14px",
  borderRadius: "12px",
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
};

const cardTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "12px",
  fontWeight: 700,
  color: "#0f172a",
  letterSpacing: "0.02em",
  textTransform: "uppercase",
};

const cardTextStyle: React.CSSProperties = {
  margin: "6px 0 0 0",
  fontSize: "13px",
  color: "#475569",
  lineHeight: 1.6,
};

const helperTextStyle: React.CSSProperties = {
  margin: "6px 0 0 0",
  fontSize: "13px",
  color: "#475569",
  lineHeight: 1.6,
};

const fieldLabelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: "6px",
  fontSize: "12px",
  fontWeight: 600,
  color: "#334155",
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  padding: "10px 12px",
  fontSize: "14px",
  background: "#fff",
  color: "#0f172a",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "420px",
  border: "1px solid #cbd5e1",
  borderRadius: "12px",
  padding: "14px",
  fontSize: "13px",
  lineHeight: 1.6,
  fontFamily:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  resize: "vertical",
  background: "#0f172a",
  color: "#e2e8f0",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
};

const completionHintStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "center",
  marginTop: "8px",
  fontSize: "12px",
  color: "#64748b",
  flexWrap: "wrap",
};

const completionPanelStyle: React.CSSProperties = {
  marginTop: "10px",
  border: "1px solid #1e293b",
  borderRadius: "14px",
  background: "linear-gradient(180deg, #111827 0%, #0f172a 100%)",
  color: "#e2e8f0",
  boxShadow: "0 14px 34px rgba(15, 23, 42, 0.18)",
  overflow: "hidden",
};

const completionPanelHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "center",
  padding: "10px 12px",
  borderBottom: "1px solid rgba(148, 163, 184, 0.18)",
};

const completionListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1px",
  maxHeight: "260px",
  overflowY: "auto",
};

const completionItemStyle = (active: boolean): React.CSSProperties => ({
  width: "100%",
  border: "none",
  borderBottom: "1px solid rgba(148, 163, 184, 0.1)",
  background: active ? "rgba(59, 130, 246, 0.16)" : "transparent",
  color: "#e2e8f0",
  cursor: "pointer",
  padding: "10px 12px",
  textAlign: "left",
  transition: "background 0.12s ease",
});

const completionDetailStyle: React.CSSProperties = {
  marginTop: "4px",
  fontSize: "11px",
  lineHeight: 1.5,
  color: "#94a3b8",
};

const completionEmptyStyle: React.CSSProperties = {
  padding: "12px",
  fontSize: "12px",
  color: "#94a3b8",
};

const warningNoteStyle: React.CSSProperties = {
  margin: 0,
  padding: "12px 14px",
  borderRadius: "12px",
  border: "1px solid #fde68a",
  background: "#fffbeb",
  color: "#92400e",
  fontSize: "13px",
  lineHeight: 1.6,
};

const submitButtonStyle = (enabled: boolean): React.CSSProperties => ({
  border: "none",
  borderRadius: "12px",
  padding: "12px 16px",
  fontSize: "14px",
  fontWeight: 700,
  cursor: enabled ? "pointer" : "not-allowed",
  color: "#fff",
  background: enabled ? "linear-gradient(135deg, #1d4ed8, #0f766e)" : "#94a3b8",
});

const resultCardStyle: React.CSSProperties = {
  marginTop: "18px",
  padding: "16px",
  borderRadius: "14px",
  border: "1px solid #e2e8f0",
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
};

const resultHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "12px",
  flexWrap: "wrap",
};

const resultStatsStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "12px",
  margin: "14px 0 0 0",
};

const caseListStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "12px",
  marginTop: "10px",
};

const caseCardStyle: React.CSSProperties = {
  padding: "12px",
  borderRadius: "12px",
  border: "1px solid #e2e8f0",
  background: "#fff",
};

const caseCardHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "8px",
  alignItems: "center",
};

const outputBlockStyle: React.CSSProperties = {
  marginTop: "8px",
  padding: "12px",
  borderRadius: "12px",
  background: "#0f172a",
  color: "#e2e8f0",
  fontSize: "12px",
  lineHeight: 1.6,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  overflowX: "auto",
};
