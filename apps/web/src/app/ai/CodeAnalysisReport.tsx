"use client";

import { useState, useCallback } from "react";
import type {
  CodeAnalysisReport as Report,
  CodeAnalysisTimeline,
  CodeFinding,
  PatchSuggestion,
  CodeAnalysisResult,
  FindingSeverity,
} from "@learning-agent-platform/ai-core/code-analysis/types";

export function CodeAnalysisReportView({
  result,
  onReset,
}: {
  result: CodeAnalysisResult;
  onReset: () => void;
}) {
  if (!result.success || !result.report) {
    return <ErrorView result={result} onReset={onReset} />;
  }

  const report = result.report;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Safety Notice */}
      <SafetyNotice />

      {/* Model Info */}
      {result.modelInfo && (
        <ModelInfoBar info={result.modelInfo} timeline={result.timeline} />
      )}

      {/* Task Overview */}
      <Section title="任务概览">
        <TaskOverviewView overview={report.taskOverview} />
      </Section>

      {/* Problem Understanding */}
      <Section title="题目理解">
        <ProblemUnderstandingView pu={report.problemUnderstanding} />
      </Section>

      {/* Code Behavior */}
      <Section title="代码行为">
        <CodeBehaviorView cb={report.codeBehavior} />
      </Section>

      {/* Complexity */}
      <Section title="复杂度分析">
        <ComplexityView complexity={report.complexity} />
      </Section>

      {/* Findings */}
      {report.findings.length > 0 && (
        <Section title={`问题列表 (${report.findings.length})`}>
          <FindingsView findings={report.findings} />
        </Section>
      )}

      {/* Patch Suggestions */}
      {report.patchSuggestions.length > 0 && (
        <Section title="修改建议">
          <PatchesView patches={report.patchSuggestions} />
        </Section>
      )}

      {/* Unconfirmed Issues */}
      {report.unconfirmedIssues.length > 0 && (
        <Section title="尚未确认的问题">
          <UnconfirmedView issues={report.unconfirmedIssues} />
        </Section>
      )}

      {/* Final Assessment */}
      <Section title="综合评估">
        <FinalAssessmentView fa={report.finalAssessment} />
      </Section>

      {/* Reset Button */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <button onClick={onReset} style={resetButtonStyle}>
          进行新的分析
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SafetyNotice() {
  return (
    <div style={safetyBoxStyle}>
      ⚠️ 本报告基于静态代码与模型分析生成，未在真实运行环境中编译或执行。所有分析结果均为模型推断，仅供参考。
    </div>
  );
}

function ModelInfoBar({
  info,
  timeline,
}: {
  info: NonNullable<CodeAnalysisResult["modelInfo"]>;
  timeline: CodeAnalysisTimeline;
}) {
  return (
    <div style={modelInfoStyle}>
      <span style={{ fontWeight: 600 }}>分析模型：</span>
      {info.providerName} / {info.modelDisplayName}
      {info.isFallback && (
        <span style={{ color: "#92400e", fontSize: "0.75rem" }}>
          {" "}(无代码分析专用模型，使用默认对话模型)
        </span>
      )}
      <span style={{ marginLeft: "12px", color: "#9ca3af", fontSize: "0.78rem" }}>
        耗时 {timeline.totalDurationMs > 0 ? `${(timeline.totalDurationMs / 1000).toFixed(1)}s` : "--"}
        {timeline.hadFormatRepair ? " · 格式修复" : ""}
      </span>
    </div>
  );
}

function TaskOverviewView({ overview }: { overview: Report["taskOverview"] }) {
  return (
    <div style={gridStyle}>
      <InfoChip label="语言" value={overview.language} />
      <InfoChip label="置信度" value={`${(overview.languageConfidence * 100).toFixed(0)}%`} />
      <InfoChip label="题目描述" value={overview.hasProblemStatement ? "✓ 已提供" : "✗ 未提供"} />
      <InfoChip label="错误信息" value={overview.hasErrorInformation ? "✓ 已提供" : "—"} />
      <InfoChip label="测试样例" value={overview.hasTestCase ? "✓ 已提供" : "—"} />
    </div>
  );
}

function ProblemUnderstandingView({ pu }: { pu: Report["problemUnderstanding"] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <p style={{ fontSize: "0.9rem", lineHeight: 1.6 }}>{pu.summary}</p>

      {pu.inputOutputUnderstanding.length > 0 && (
        <SubSection title="输入输出理解">
          <StringList items={pu.inputOutputUnderstanding} />
        </SubSection>
      )}

      {pu.constraints.length > 0 && (
        <SubSection title="约束条件">
          <StringList items={pu.constraints} />
        </SubSection>
      )}

      {pu.assumptions.length > 0 && (
        <SubSection title="分析假设">
          <StringList items={pu.assumptions} />
        </SubSection>
      )}

      {pu.missingInformation.length > 0 && (
        <SubSection title="缺失信息" warning>
          <StringList items={pu.missingInformation} />
        </SubSection>
      )}
    </div>
  );
}

function CodeBehaviorView({ cb }: { cb: Report["codeBehavior"] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <p style={{ fontSize: "0.9rem", lineHeight: 1.6 }}>{cb.summary}</p>

      {cb.mainSteps.length > 0 && (
        <SubSection title="主要执行步骤">
          <ol style={{ margin: 0, paddingLeft: "20px", fontSize: "0.88rem", lineHeight: 1.8 }}>
            {cb.mainSteps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </SubSection>
      )}

      {cb.importantDataStructures.length > 0 && (
        <SubSection title="重要数据结构">
          <StringList items={cb.importantDataStructures} />
        </SubSection>
      )}
    </div>
  );
}

function ComplexityView({ complexity }: { complexity: Report["complexity"] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Time */}
      <div>
        <h4 style={subHeadingStyle}>时间复杂度</h4>
        <table style={tableStyle}>
          <tbody>
            <tr>
              <td style={tdLabelStyle}>最坏</td>
              <td style={tdValueStyle}><code>{complexity.time.worst}</code></td>
            </tr>
            {complexity.time.average && (
              <tr>
                <td style={tdLabelStyle}>平均</td>
                <td style={tdValueStyle}><code>{complexity.time.average}</code></td>
              </tr>
            )}
            {complexity.time.best && (
              <tr>
                <td style={tdLabelStyle}>最好</td>
                <td style={tdValueStyle}><code>{complexity.time.best}</code></td>
              </tr>
            )}
            <tr>
              <td style={tdLabelStyle}>置信度</td>
              <td style={tdValueStyle}>{(complexity.time.confidence * 100).toFixed(0)}%</td>
            </tr>
          </tbody>
        </table>
        {complexity.time.derivation.length > 0 && (
          <div style={{ marginTop: "8px" }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#6b7280" }}>推导：</span>
            {complexity.time.derivation.map((d, i) => (
              <span key={i} style={{ fontSize: "0.82rem", color: "#4b5563", marginLeft: "8px" }}>
                {d}{i < complexity.time.derivation.length - 1 ? "；" : ""}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Space */}
      <div>
        <h4 style={subHeadingStyle}>空间复杂度</h4>
        <table style={tableStyle}>
          <tbody>
            <tr>
              <td style={tdLabelStyle}>辅助空间</td>
              <td style={tdValueStyle}><code>{complexity.space.auxiliary}</code></td>
            </tr>
            {complexity.space.total && (
              <tr>
                <td style={tdLabelStyle}>总空间</td>
                <td style={tdValueStyle}><code>{complexity.space.total}</code></td>
              </tr>
            )}
            <tr>
              <td style={tdLabelStyle}>置信度</td>
              <td style={tdValueStyle}>{(complexity.space.confidence * 100).toFixed(0)}%</td>
            </tr>
          </tbody>
        </table>
        {complexity.space.derivation.length > 0 && (
          <div style={{ marginTop: "8px" }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#6b7280" }}>推导：</span>
            {complexity.space.derivation.map((d, i) => (
              <span key={i} style={{ fontSize: "0.82rem", color: "#4b5563", marginLeft: "8px" }}>
                {d}{i < complexity.space.derivation.length - 1 ? "；" : ""}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Constraint Fit */}
      <div>
        <h4 style={subHeadingStyle}>
          约束匹配：
          <ConstraintBadge status={complexity.constraintFit.status} />
        </h4>
        <p style={{ fontSize: "0.85rem", color: "#4b5563", margin: "4px 0 0" }}>
          {complexity.constraintFit.reasoning}
        </p>
      </div>
    </div>
  );
}

function FindingsView({ findings }: { findings: CodeFinding[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {findings.map((finding, idx) => (
        <FindingCard key={finding.id || idx} finding={finding} index={idx + 1} />
      ))}
    </div>
  );
}

function FindingCard({ finding, index }: { finding: CodeFinding; index: number }) {
  return (
    <div style={findingCardStyle}>
      <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "10px" }}>
        <SeverityBadge severity={finding.severity} />
        <span style={{ fontSize: "0.82rem", color: "#9ca3af" }}>#{index}</span>
        {finding.category && (
          <span style={categoryChipStyle}>{finding.category}</span>
        )}
        {finding.startLine && (
          <span style={lineChipStyle}>
            行 {finding.startLine}{finding.endLine && finding.endLine !== finding.startLine ? `–${finding.endLine}` : ""}
          </span>
        )}
      </div>

      <h4 style={{ fontSize: "0.95rem", fontWeight: 700, margin: "0 0 8px", color: "#111827" }}>
        {finding.title}
      </h4>

      <div style={findingSectionStyle}>
        <span style={findingLabelStyle}>证据</span>
        <p style={{ margin: "2px 0 0", fontSize: "0.85rem", lineHeight: 1.6 }}>{finding.evidence}</p>
      </div>

      {finding.trigger && (
        <div style={findingSectionStyle}>
          <span style={findingLabelStyle}>触发条件</span>
          <p style={{ margin: "2px 0 0", fontSize: "0.85rem", fontFamily: "monospace" }}>{finding.trigger}</p>
        </div>
      )}

      <div style={findingSectionStyle}>
        <span style={findingLabelStyle}>根因</span>
        <p style={{ margin: "2px 0 0", fontSize: "0.85rem", lineHeight: 1.6 }}>{finding.rootCause}</p>
      </div>

      <div style={findingSectionStyle}>
        <span style={findingLabelStyle}>修复建议</span>
        <p style={{ margin: "2px 0 0", fontSize: "0.85rem", fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
          {finding.suggestedFix}
        </p>
      </div>

      <div style={{ display: "flex", gap: "12px", marginTop: "8px", fontSize: "0.78rem" }}>
        <span style={{ color: "#6b7280" }}>
          置信度：{(finding.confidence * 100).toFixed(0)}%
        </span>
        <VerificationBadge verification={finding.verification} />
      </div>
    </div>
  );
}

function PatchesView({ patches }: { patches: PatchSuggestion[] }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    }).catch(() => {});
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {patches.map((patch, idx) => (
        <div key={idx} style={patchCardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#374151" }}>
              {patch.description}
            </span>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              {patch.isMinimalPatch && (
                <span style={minimalChipStyle}>最小修改</span>
              )}
              <span style={{ fontSize: "0.72rem", color: "#9ca3af" }}>
                未真实运行
              </span>
            </div>
          </div>

          <div style={diffBoxStyle}>
            <pre style={{ margin: 0, fontSize: "0.8rem", lineHeight: 1.5, whiteSpace: "pre-wrap", fontFamily: "'Fira Code', 'Cascadia Code', 'Consolas', monospace" }}>
              {patch.diff}
            </pre>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "6px" }}>
            <button
              type="button"
              onClick={() => handleCopy(patch.diff, `${idx}-${patch.findingId}`)}
              style={copyButtonStyle}
            >
              {copiedId === `${idx}-${patch.findingId}` ? "已复制 ✓" : "复制 Diff"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function UnconfirmedView({ issues }: { issues: string[] }) {
  return (
    <div style={warningBoxStyle}>
      <StringList items={issues} />
    </div>
  );
}

function FinalAssessmentView({ fa }: { fa: Report["finalAssessment"] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <p style={{ fontSize: "0.9rem", lineHeight: 1.6 }}>{fa.summary}</p>
      <div style={{ display: "flex", gap: "16px", fontSize: "0.82rem", color: "#6b7280" }}>
        <span>综合置信度：{(fa.overallConfidence * 100).toFixed(0)}%</span>
        <span>
          {fa.requiresRuntimeVerification ? "⚠ 建议实际运行验证" : "静态分析可确认"}
        </span>
      </div>
    </div>
  );
}

function ErrorView({ result, onReset }: { result: CodeAnalysisResult; onReset: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <SafetyNotice />

      <div style={errorBoxStyle2}>
        <h3 style={{ margin: 0, fontSize: "1rem", color: "#991b1b" }}>分析失败</h3>
        <p style={{ margin: "8px 0 0", fontSize: "0.9rem" }}>
          {result.error?.safeMessage ?? "未知错误"}
        </p>
        {result.error?.retryable && (
          <p style={{ margin: "8px 0 0", fontSize: "0.82rem", color: "#92400e" }}>
            此错误可以重试，请稍后再次提交。
          </p>
        )}
      </div>

      {/* Timeline for debugging */}
      {result.timeline.events.length > 0 && (
        <Section title="执行过程">
          <TimelineView events={result.timeline.events} />
        </Section>
      )}

      <div style={{ display: "flex", justifyContent: "center" }}>
        <button onClick={onReset} style={resetButtonStyle}>
          返回重新输入
        </button>
      </div>
    </div>
  );
}

function TimelineView({ events }: { events: CodeAnalysisTimeline["events"] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {events.map((event, i) => (
        <div key={i} style={{ display: "flex", gap: "8px", alignItems: "flex-start", fontSize: "0.82rem" }}>
          <span style={{
            display: "inline-block",
            width: "16px",
            height: "16px",
            borderRadius: "50%",
            flexShrink: 0,
            marginTop: "2px",
            background:
              event.status === "completed" ? "#22c55e" :
              event.status === "failed" ? "#ef4444" :
              event.status === "running" ? "#3b82f6" : "#d1d5db",
          }} />
          <div>
            <span style={{ fontWeight: 600, color: "#374151" }}>
              {stepLabel(event.step)}
            </span>
            <span style={{ color: "#9ca3af", marginLeft: "8px" }}>
              {event.durationMs > 0 ? `${(event.durationMs / 1000).toFixed(1)}s` : ""}
            </span>
            <div style={{ color: "#6b7280" }}>{event.summary}</div>
            {event.metadata?.hadFormatRepair && (
              <div style={{ color: "#f59e0b", fontSize: "0.75rem" }}>已尝试格式修复</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small atoms
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={sectionStyle}>
      <h3 style={sectionTitleStyle}>{title}</h3>
      {children}
    </div>
  );
}

function SubSection({ title, children, warning }: { title: string; children: React.ReactNode; warning?: boolean }) {
  return (
    <div>
      <span style={{ fontSize: "0.78rem", fontWeight: 600, color: warning ? "#92400e" : "#6b7280" }}>
        {title}
      </span>
      <div style={{ marginTop: "4px" }}>{children}</div>
    </div>
  );
}

function StringList({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "0.85rem", lineHeight: 1.7 }}>
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      padding: "8px 12px",
      borderRadius: "8px",
      border: "1px solid #e5e7eb",
      background: "#f9fafb",
    }}>
      <div style={{ fontSize: "0.7rem", color: "#9ca3af", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#111827", marginTop: "2px" }}>{value}</div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: FindingSeverity }) {
  const colors: Record<FindingSeverity, { bg: string; text: string; label: string }> = {
    critical: { bg: "#fecaca", text: "#991b1b", label: "严重" },
    high: { bg: "#fed7aa", text: "#9a3412", label: "高" },
    medium: { bg: "#fde68a", text: "#92400e", label: "中" },
    low: { bg: "#e0e7ff", text: "#3730a3", label: "低" },
    info: { bg: "#e5e7eb", text: "#374151", label: "信息" },
  };
  const c = colors[severity];
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: "4px",
      background: c.bg,
      color: c.text,
      fontSize: "0.72rem",
      fontWeight: 700,
    }}>
      {c.label}
    </span>
  );
}

function VerificationBadge({ verification }: { verification: string }) {
  const labels: Record<string, string> = {
    static_confirmed: "静态确认",
    model_inference: "模型推断",
    needs_runtime_verification: "需运行验证",
    insufficient_information: "信息不足",
  };
  return (
    <span style={{ color: "#9ca3af" }}>
      {labels[verification] ?? verification}
    </span>
  );
}

function ConstraintBadge({ status }: { status: string }) {
  const labels: Record<string, { label: string; color: string }> = {
    fits: { label: "可满足", color: "#16a34a" },
    risky: { label: "有风险", color: "#ea580c" },
    does_not_fit: { label: "不满足", color: "#dc2626" },
    unknown: { label: "未知", color: "#9ca3af" },
  };
  const info = labels[status] ?? { label: status, color: "#9ca3af" };
  return (
    <span style={{ color: info.color, fontSize: "0.85rem", fontWeight: 600, marginLeft: "8px" }}>
      {info.label}
    </span>
  );
}

function stepLabel(step: string): string {
  const labels: Record<string, string> = {
    validating_input: "校验输入",
    identifying_language: "识别语言",
    preparing_context: "整理上下文",
    calling_model: "调用模型",
    validating_report: "校验报告",
    completed: "分析完成",
    failed: "分析失败",
  };
  return labels[step] ?? step;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const sectionStyle: React.CSSProperties = {
  borderRadius: "12px",
  border: "1px solid #e5e7eb",
  background: "#fff",
  padding: "16px 18px",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "0.95rem",
  fontWeight: 700,
  color: "#111827",
  margin: "0 0 12px",
  paddingBottom: "8px",
  borderBottom: "1px solid #f3f4f6",
};

const subHeadingStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  fontWeight: 600,
  color: "#374151",
  margin: "0 0 6px",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "8px",
};

const tableStyle: React.CSSProperties = {
  borderCollapse: "collapse",
  width: "100%",
  maxWidth: "400px",
};

const tdLabelStyle: React.CSSProperties = {
  padding: "4px 12px 4px 0",
  fontSize: "0.82rem",
  color: "#6b7280",
  fontWeight: 500,
};

const tdValueStyle: React.CSSProperties = {
  padding: "4px 0",
  fontSize: "0.85rem",
  color: "#111827",
  fontWeight: 600,
};

const safetyBoxStyle: React.CSSProperties = {
  borderRadius: "10px",
  border: "1px solid #fde68a",
  background: "linear-gradient(135deg, #fffbeb, #fef3c7)",
  padding: "12px 16px",
  color: "#92400e",
  fontSize: "0.85rem",
  fontWeight: 500,
  lineHeight: 1.6,
};

const modelInfoStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  color: "#374151",
  padding: "10px 14px",
  borderRadius: "8px",
  border: "1px solid #e0e7ff",
  background: "#eef2ff",
};

const warningBoxStyle: React.CSSProperties = {
  borderRadius: "8px",
  border: "1px solid #fde68a",
  background: "#fffbeb",
  padding: "10px 14px",
  color: "#92400e",
};

const errorBoxStyle2: React.CSSProperties = {
  borderRadius: "12px",
  border: "1px solid #fecaca",
  background: "#fef2f2",
  padding: "16px 18px",
};

const findingCardStyle: React.CSSProperties = {
  borderRadius: "10px",
  border: "1px solid #e5e7eb",
  background: "#fafafa",
  padding: "14px 16px",
};

const findingSectionStyle: React.CSSProperties = {
  marginBottom: "8px",
};

const findingLabelStyle: React.CSSProperties = {
  fontSize: "0.72rem",
  fontWeight: 700,
  color: "#6b7280",
  textTransform: "uppercase",
  display: "block",
  marginBottom: "2px",
};

const categoryChipStyle: React.CSSProperties = {
  display: "inline-flex",
  padding: "2px 8px",
  borderRadius: "999px",
  background: "rgba(99, 102, 241, 0.1)",
  color: "#6366f1",
  fontSize: "0.72rem",
  fontWeight: 600,
};

const lineChipStyle: React.CSSProperties = {
  display: "inline-flex",
  padding: "2px 8px",
  borderRadius: "999px",
  background: "#e5e7eb",
  color: "#374151",
  fontSize: "0.72rem",
  fontWeight: 600,
  fontFamily: "monospace",
};

const minimalChipStyle: React.CSSProperties = {
  display: "inline-flex",
  padding: "2px 8px",
  borderRadius: "999px",
  background: "#d1fae5",
  color: "#065f46",
  fontSize: "0.72rem",
  fontWeight: 600,
};

const patchCardStyle: React.CSSProperties = {
  borderRadius: "10px",
  border: "1px solid #e5e7eb",
  background: "#fff",
  padding: "14px 16px",
};

const diffBoxStyle: React.CSSProperties = {
  borderRadius: "8px",
  border: "1px solid #dbe4ee",
  background: "#f3f4f6",
  padding: "12px 14px",
  overflow: "auto",
};

const copyButtonStyle: React.CSSProperties = {
  border: "1px solid #dbe4ee",
  borderRadius: "6px",
  background: "#fff",
  padding: "4px 12px",
  fontSize: "0.78rem",
  cursor: "pointer",
  color: "#374151",
};

const resetButtonStyle: React.CSSProperties = {
  border: "1px solid #dbe4ee",
  borderRadius: "999px",
  padding: "8px 24px",
  background: "#fff",
  color: "#374151",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: "0.88rem",
};
