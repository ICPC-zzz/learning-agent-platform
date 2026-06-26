"use client";

import { useState, useCallback } from "react";
import { CODE_ANALYSIS_LIMITS, VALID_LANGUAGES, type CodeLanguage } from "@learning-agent-platform/ai-core/code-analysis/types";
import { CF_RATING_MIN, CF_RATING_MAX, MAX_USER_TAGS, CF_COMMON_TAGS, CF_TAG_NORMALIZATION } from "@learning-agent-platform/ai-core/code-analysis/a492-types";

export interface CodeAnalysisFormData {
  problemStatement: string;
  sourceCode: string;
  selectedLanguage: CodeLanguage;
  errorInfo: string;
  testInput: string;
  actualOutput: string;
  expectedOutput: string;
  failedCases: string;
  /** A492: user-provided problem rating (800-3500 or empty) */
  problemRating: string;
  /** A492: user-provided tags (comma-separated or individual) */
  problemTags: string[];
  /** A492: enable CF learning profile integration */
  enableCfProfile: boolean;
  /** A492: refresh CF data before analysis */
  refreshCfData: boolean;
  /** A492: recommend follow-up problems */
  recommendFollowUp: boolean;
}

export function CodeAnalysisPanel({
  onSubmit,
  isSubmitting,
  hasCfBinding,
}: {
  onSubmit: (data: CodeAnalysisFormData) => void;
  isSubmitting: boolean;
  hasCfBinding?: boolean;
}) {
  const [form, setForm] = useState<CodeAnalysisFormData>({
    problemStatement: "",
    sourceCode: "",
    selectedLanguage: "auto",
    errorInfo: "",
    testInput: "",
    actualOutput: "",
    expectedOutput: "",
    failedCases: "",
    problemRating: "",
    problemTags: [],
    enableCfProfile: false,
    refreshCfData: false,
    recommendFollowUp: false,
  });
  const [showTestFields, setShowTestFields] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const updateField = useCallback(
    <K extends keyof CodeAnalysisFormData>(field: K, value: CodeAnalysisFormData[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      setErrors([]);
    },
    [],
  );

  const handleSubmit = useCallback(() => {
    const errs: string[] = [];

    if (!form.sourceCode.trim()) {
      errs.push("源代码不能为空");
    }
    if (form.sourceCode.length > CODE_ANALYSIS_LIMITS.maxSourceCodeChars) {
      errs.push(`源代码过长（最多 ${CODE_ANALYSIS_LIMITS.maxSourceCodeChars} 字符）`);
    }
    if (form.problemStatement.length > CODE_ANALYSIS_LIMITS.maxProblemStatementChars) {
      errs.push(`题目描述过长（最多 ${CODE_ANALYSIS_LIMITS.maxProblemStatementChars} 字符）`);
    }

    // A492: validate rating
    if (form.problemRating.trim()) {
      const rVal = parseInt(form.problemRating, 10);
      if (isNaN(rVal) || rVal < CF_RATING_MIN || rVal > CF_RATING_MAX) {
        errs.push(`题目 Rating 必须在 ${CF_RATING_MIN}～${CF_RATING_MAX} 之间`);
      }
    }

    // A492: validate tags count
    if (form.problemTags.length > MAX_USER_TAGS) {
      errs.push(`题目标签最多 ${MAX_USER_TAGS} 个`);
    }

    const totalChars =
      form.problemStatement.length +
      form.sourceCode.length +
      form.errorInfo.length +
      form.testInput.length +
      form.actualOutput.length +
      form.expectedOutput.length +
      form.failedCases.length;

    if (totalChars > CODE_ANALYSIS_LIMITS.totalInputHardLimit) {
      errs.push(`总输入过长（最多 ${CODE_ANALYSIS_LIMITS.totalInputHardLimit} 字符，当前 ${totalChars} 字符）`);
    }

    if (errs.length > 0) {
      setErrors(errs);
      return;
    }

    onSubmit(form);
  }, [form, onSubmit]);

  const addTag = useCallback((raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    // Normalize
    const normalized = CF_TAG_NORMALIZATION[trimmed.toLowerCase()] ?? trimmed.toLowerCase();
    setForm((prev) => {
      if (prev.problemTags.includes(normalized)) return prev;
      if (prev.problemTags.length >= MAX_USER_TAGS) return prev;
      return { ...prev, problemTags: [...prev.problemTags, normalized] };
    });
    setTagInput("");
  }, []);

  const removeTag = useCallback((tag: string) => {
    setForm((prev) => ({ ...prev, problemTags: prev.problemTags.filter((t) => t !== tag) }));
  }, []);

  const languageOptions = [
    { value: "auto" as const, label: "自动识别" },
    { value: "cpp" as const, label: "C++" },
    { value: "python" as const, label: "Python" },
    { value: "java" as const, label: "Java" },
    { value: "javascript" as const, label: "JavaScript" },
    { value: "typescript" as const, label: "TypeScript" },
    { value: "other" as const, label: "其他" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* Errors */}
      {errors.length > 0 && (
        <div style={errorBoxStyle}>
          {errors.map((e, i) => (
            <div key={i} style={{ fontSize: "0.85rem" }}>{e}</div>
          ))}
        </div>
      )}

      {/* Problem Statement */}
      <div>
        <label style={labelStyle}>
          题目描述 <span style={optionalStyle}>(可选)</span>
        </label>
        <textarea
          value={form.problemStatement}
          onChange={(e) => updateField("problemStatement", e.target.value)}
          placeholder="粘贴题目描述、约束条件等..."
          rows={4}
          maxLength={CODE_ANALYSIS_LIMITS.maxProblemStatementChars}
          style={textareaStyle}
        />
        <div style={charCountStyle}>
          {form.problemStatement.length} / {CODE_ANALYSIS_LIMITS.maxProblemStatementChars}
        </div>
      </div>

      {/* Source Code */}
      <div>
        <label style={labelStyle}>
          源代码 <span style={requiredStyle}>*</span>
        </label>
        <textarea
          value={form.sourceCode}
          onChange={(e) => updateField("sourceCode", e.target.value)}
          placeholder="粘贴需要分析的源代码..."
          rows={9}
          maxLength={CODE_ANALYSIS_LIMITS.maxSourceCodeChars}
          style={{ ...textareaStyle, fontFamily: "'Fira Code', 'Cascadia Code', 'Consolas', monospace", fontSize: "0.85rem" }}
        />
        <div style={charCountStyle}>
          {form.sourceCode.length} / {CODE_ANALYSIS_LIMITS.maxSourceCodeChars}
          {form.sourceCode.length > 0 && ` · ${form.sourceCode.split("\n").length} 行`}
        </div>
      </div>

      {/* Language */}
      <div>
        <label style={labelStyle}>编程语言</label>
        <select
          value={form.selectedLanguage}
          onChange={(e) => updateField("selectedLanguage", e.target.value as CodeLanguage)}
          style={selectStyle}
        >
          {languageOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* A492: Problem Rating */}
      <div>
        <label style={labelStyle}>
          题目 Rating <span style={optionalStyle}>(可选, {CF_RATING_MIN}～{CF_RATING_MAX})</span>
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <input
            type="number"
            value={form.problemRating}
            onChange={(e) => updateField("problemRating", e.target.value)}
            placeholder="留空由模型推断"
            min={CF_RATING_MIN}
            max={CF_RATING_MAX}
            step={100}
            style={ratingInputStyle}
          />
          {form.problemRating.trim() && (
            <span style={{ fontSize: "0.75rem", color: "#6366f1" }}>以用户填写为准</span>
          )}
        </div>
      </div>

      {/* A492: Problem Tags */}
      <div>
        <label style={labelStyle}>
          题目标签 <span style={optionalStyle}>(可选, 最多 {MAX_USER_TAGS} 个)</span>
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "6px" }}>
          {form.problemTags.map((tag) => (
            <span key={tag} style={tagChipStyle}>
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                style={tagRemoveStyle}
                aria-label={`移除标签 ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); addTag(tagInput); }
            }}
            placeholder="输入标签后按回车添加 (如: dp, graphs, greedy...)"
            style={tagInputStyle}
          />
          <button
            type="button"
            onClick={() => addTag(tagInput)}
            style={tagAddButtonStyle}
          >
            添加
          </button>
        </div>
        <div style={{ marginTop: "4px" }}>
          <span style={{ fontSize: "0.7rem", color: "#9ca3af" }}>常用: </span>
          {CF_COMMON_TAGS.slice(0, 12).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => addTag(t)}
              style={tagSuggestionStyle}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* A492: CF Profile Toggles */}
      <div style={{
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
        padding: "12px 16px",
        background: "#f9fafb",
      }}>
        <div style={{ fontSize: "0.82rem", fontWeight: 600, marginBottom: "10px", color: "#374151" }}>
          Codeforces 学习画像
        </div>

        {!hasCfBinding ? (
          <div style={{ fontSize: "0.8rem", color: "#92400e", background: "#fefce8", padding: "8px 12px", borderRadius: "6px" }}>
            绑定 Codeforces 账号后可启用学习画像分析。
          </div>
        ) : (
          <>
            <label style={checkboxLabelStyle}>
              <input
                type="checkbox"
                checked={form.enableCfProfile}
                onChange={(e) => updateField("enableCfProfile", e.target.checked)}
                style={{ marginRight: "6px" }}
              />
              结合我的 Codeforces 学习画像
              <span style={{ fontSize: "0.7rem", color: "#d97706", marginLeft: "6px" }}>（+数据读取时间）</span>
            </label>
            {form.enableCfProfile && (
              <>
                <label style={{ ...checkboxLabelStyle, marginTop: "6px" }}>
                  <input
                    type="checkbox"
                    checked={form.refreshCfData}
                    onChange={(e) => updateField("refreshCfData", e.target.checked)}
                    style={{ marginRight: "6px" }}
                  />
                  分析前刷新 Codeforces 数据
                  <span style={{ fontSize: "0.7rem", color: "#dc2626", marginLeft: "4px" }}>（+网络请求）</span>
                </label>
                <label style={{ ...checkboxLabelStyle, marginTop: "6px" }}>
                  <input
                    type="checkbox"
                    checked={form.recommendFollowUp}
                    onChange={(e) => updateField("recommendFollowUp", e.target.checked)}
                    style={{ marginRight: "6px" }}
                  />
                  推荐后续训练题
                </label>
              </>
            )}
          </>
        )}
      </div>

      {/* Error Information */}
      <div>
        <label style={labelStyle}>
          错误信息 <span style={optionalStyle}>(可选)</span>
        </label>
        <textarea
          value={form.errorInfo}
          onChange={(e) => updateField("errorInfo", e.target.value)}
          placeholder="粘贴编译错误、运行错误、Codeforces Verdict 等..."
          rows={3}
          maxLength={CODE_ANALYSIS_LIMITS.maxErrorInfoChars}
          style={textareaStyle}
        />
        <div style={charCountStyle}>
          {form.errorInfo.length} / {CODE_ANALYSIS_LIMITS.maxErrorInfoChars}
        </div>
      </div>

      {/* Test Information Toggle */}
      <div>
        <button
          type="button"
          onClick={() => setShowTestFields(!showTestFields)}
          style={toggleButtonStyle}
        >
          {showTestFields ? "▾ 隐藏" : "▸ 展开"}测试信息（可选）
        </button>

        {showTestFields && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "10px" }}>
            <div>
              <label style={labelStyle}>输入数据</label>
              <textarea
                value={form.testInput}
                onChange={(e) => updateField("testInput", e.target.value)}
                placeholder="样例输入数据..."
                rows={2}
                maxLength={CODE_ANALYSIS_LIMITS.maxTestInfoChars}
                style={textareaStyle}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label style={labelStyle}>实际输出</label>
                <textarea
                  value={form.actualOutput}
                  onChange={(e) => updateField("actualOutput", e.target.value)}
                  placeholder="程序实际输出..."
                  rows={2}
                  maxLength={CODE_ANALYSIS_LIMITS.maxTestInfoChars}
                  style={textareaStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>预期输出</label>
                <textarea
                  value={form.expectedOutput}
                  onChange={(e) => updateField("expectedOutput", e.target.value)}
                  placeholder="期望的正确输出..."
                  rows={2}
                  maxLength={CODE_ANALYSIS_LIMITS.maxTestInfoChars}
                  style={textareaStyle}
                />
              </div>
            </div>
            <div>
              <label style={labelStyle}>失败样例</label>
              <textarea
                value={form.failedCases}
                onChange={(e) => updateField("failedCases", e.target.value)}
                placeholder="失败的测试用例描述..."
                rows={2}
                maxLength={CODE_ANALYSIS_LIMITS.maxTestInfoChars}
                style={textareaStyle}
              />
            </div>
          </div>
        )}
      </div>

      {/* Submit */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
        <div style={{ fontSize: "0.72rem", color: "#9ca3af" }}>
          {form.enableCfProfile && form.refreshCfData
            ? "预计 ~120 秒（含 CF 刷新）"
            : form.enableCfProfile
            ? "预计 ~100 秒（含画像拉取）"
            : "预计 ~60 秒"}
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          style={submitButtonStyle}
        >
          {isSubmitting ? "分析中..." : "开始分析"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.82rem",
  fontWeight: 600,
  color: "#374151",
  marginBottom: "4px",
};

const optionalStyle: React.CSSProperties = {
  fontWeight: 400,
  color: "#9ca3af",
  fontSize: "0.75rem",
};

const requiredStyle: React.CSSProperties = {
  color: "#ef4444",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  resize: "vertical",
  borderRadius: "8px",
  border: "1px solid #dbe4ee",
  padding: "10px 12px",
  fontFamily: "inherit",
  fontSize: "0.88rem",
  outline: "none",
  lineHeight: 1.5,
  background: "#fff",
};

const selectStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: "8px",
  border: "1px solid #dbe4ee",
  background: "#fff",
  fontSize: "0.88rem",
  outline: "none",
  cursor: "pointer",
};

const charCountStyle: React.CSSProperties = {
  fontSize: "0.7rem",
  color: "#9ca3af",
  textAlign: "right",
  marginTop: "2px",
};

const errorBoxStyle: React.CSSProperties = {
  borderRadius: "8px",
  border: "1px solid #fecaca",
  background: "#fef2f2",
  padding: "10px 14px",
  color: "#991b1b",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const toggleButtonStyle: React.CSSProperties = {
  border: "none",
  background: "none",
  color: "#6366f1",
  fontSize: "0.82rem",
  cursor: "pointer",
  padding: "4px 0",
  fontWeight: 500,
};

const submitButtonStyle: React.CSSProperties = {
  minWidth: "120px",
  border: "none",
  borderRadius: "999px",
  padding: "0 20px",
  height: "40px",
  background: "linear-gradient(135deg, #6366f1, #7c3aed)",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: "0.9rem",
};

// A492: Additional styles for rating, tags, CF profile
const ratingInputStyle: React.CSSProperties = {
  width: "140px",
  padding: "8px 12px",
  borderRadius: "8px",
  border: "1px solid #dbe4ee",
  background: "#fff",
  fontSize: "0.88rem",
  outline: "none",
};

const tagInputStyle: React.CSSProperties = {
  flex: 1,
  padding: "8px 12px",
  borderRadius: "8px",
  border: "1px solid #dbe4ee",
  background: "#fff",
  fontSize: "0.85rem",
  outline: "none",
};

const tagAddButtonStyle: React.CSSProperties = {
  padding: "6px 14px",
  borderRadius: "8px",
  border: "1px solid #6366f1",
  background: "#eef2ff",
  color: "#4338ca",
  fontSize: "0.82rem",
  cursor: "pointer",
  fontWeight: 500,
};

const tagChipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  padding: "3px 10px",
  borderRadius: "999px",
  background: "#eef2ff",
  color: "#4338ca",
  fontSize: "0.78rem",
  fontWeight: 500,
  border: "1px solid #c7d2fe",
};

const tagRemoveStyle: React.CSSProperties = {
  border: "none",
  background: "none",
  color: "#6366f1",
  fontSize: "1rem",
  cursor: "pointer",
  padding: "0 2px",
  lineHeight: 1,
  fontWeight: 700,
};

const tagSuggestionStyle: React.CSSProperties = {
  border: "none",
  background: "none",
  color: "#6366f1",
  fontSize: "0.7rem",
  cursor: "pointer",
  padding: "2px 4px",
  textDecoration: "underline",
};

const checkboxLabelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  fontSize: "0.82rem",
  color: "#374151",
  cursor: "pointer",
};
