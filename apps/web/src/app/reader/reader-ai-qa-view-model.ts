/**
 * Reader AI QA View Model — UI 状态计算与安全标签检查。
 *
 * 确保 UI 文案不误导用户；不出现"生产 AI 已接入 / 真实工具执行 / Agent 已运行"等文案。
 *
 * Designation: **开发预览 · dev-only · mock 默认**
 *
 * @module reader-ai-qa-view-model
 * @previewOnly
 */

import type { readerAiQaServerAction } from "./reader-ai-qa-server-action";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReaderAiQaActionResult = Awaited<
  ReturnType<typeof readerAiQaServerAction>
>;

export interface ReaderAiQaPanelViewModelInput {
  result: ReaderAiQaActionResult | null;
  submitError: string | null;
  isSubmitting: boolean;
  question: string;
}

export interface ReaderAiQaPanelViewModel {
  /** Eyebrow label above the panel title. */
  eyebrowLabel: string;
  /** Provider mode label for the mode badge. */
  modeLabel: string;
  /** CSS class modifier for the mode badge. */
  modeCssClass: string;
  /** Description text below the mode badge. */
  modeDescription: string;
  /** Whether the question input is disabled. */
  inputDisabled: boolean;
  /** Whether the submit button is disabled (beyond empty question). */
  submitDisabled: boolean;
  /** Submit button label. */
  submitLabel: string;
  /** Max question characters. */
  maxQuestionChars: number;
  /** Whether the UI labels pass safety checks. */
  labelsSafe: boolean;
  /** Any forbidden label violations found. */
  labelViolations: readonly string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MAX_QUESTION_CHARS = 1000;

// ---------------------------------------------------------------------------
// Forbidden labels — these must never appear in UI
// ---------------------------------------------------------------------------

const FORBIDDEN_LABELS = [
  "生产 AI 已接入",
  "生产 AI 服务已上线",
  "真实工具执行",
  "Agent 已运行",
  "Agent 正在执行",
  "已连接生产模型",
  "真实 AI 已连接",
  "已接入生产 LLM",
  "核心 AI 服务已启用",
  "真实 API 调用中",
  "生产环境可用",
  "正式版本已发布",
  "云端 AI 服务",
  "真实问答系统",
  "AI Agent 已激活",
];

const REQUIRED_SAFE_LABELS = [
  "开发预览",
  "dev-only",
  "mock",
  "未接生产",
];

// ---------------------------------------------------------------------------
// View model builder
// ---------------------------------------------------------------------------

export function buildReaderAiQaPanelViewModel(
  input: ReaderAiQaPanelViewModelInput,
): ReaderAiQaPanelViewModel {
  const { result } = input;

  // Determine mode
  let modeLabel: string;
  let modeCssClass: string;
  let modeDescription: string;
  let inputDisabled = false;
  let submitDisabled = false;
  let submitLabel = "提交问题";
  let eyebrowLabel = "AI 问答（开发预览）";

  if (!result) {
    // Initial state
    modeLabel = "mock（默认）";
    modeCssClass = "mock";
    modeDescription =
      "开发预览 · 默认使用 mock provider，不调用真实 AI 模型。";
    submitLabel = "提交问题（mock）";
  } else if (result.providerMode === "blocked") {
    modeLabel = "blocked（已阻止）";
    modeCssClass = "blocked";
    modeDescription = `LLM 调用被阻止: ${result.blockedReasons.join(", ")}`;
    inputDisabled = true;
    submitDisabled = true;
    submitLabel = "已阻止";
  } else if (result.providerMode === "external-dev-only") {
    modeLabel = "external-dev（真实调用）";
    modeCssClass = "external";
    modeDescription =
      "已连接 dev-only external provider。回答由真实 AI 模型生成（开发预览）。";
    submitLabel = "提交问题（external-dev）";
  } else {
    // mock
    modeLabel = "mock（模拟回答）";
    modeCssClass = "mock";
    modeDescription =
      "使用 mock provider。回答为固定规则生成，未调用真实 AI 模型。";
    submitLabel = "提交问题（mock）";
  }

  // Label safety check
  const allUiText = [
    eyebrowLabel,
    modeLabel,
    modeDescription,
    submitLabel,
  ].join(" ");
  const labelCheck = checkLabels(allUiText);

  return {
    eyebrowLabel,
    modeLabel,
    modeCssClass,
    modeDescription,
    inputDisabled,
    submitDisabled,
    submitLabel,
    maxQuestionChars: MAX_QUESTION_CHARS,
    labelsSafe: labelCheck.safe,
    labelViolations: labelCheck.violations,
  };
}

// ---------------------------------------------------------------------------
// Label safety check
// ---------------------------------------------------------------------------

export interface LabelSafetyResult {
  safe: boolean;
  violations: readonly string[];
}

export function checkLabels(text: string): LabelSafetyResult {
  const violations = FORBIDDEN_LABELS.filter((label) =>
    text.includes(label),
  );

  return {
    safe: violations.length === 0,
    violations,
  };
}

/**
 * Check that required safe labels are present in the UI text.
 * Returns the list of missing safe labels.
 */
export function checkRequiredSafeLabels(text: string): readonly string[] {
  return REQUIRED_SAFE_LABELS.filter((label) => !text.includes(label));
}

/**
 * Check if text contains any forbidden claims about AI capability.
 */
export function hasForbiddenAIClaims(text: string): boolean {
  return FORBIDDEN_LABELS.some((label) => text.includes(label));
}

/**
 * Check if the server action result is safe to render.
 * Verifies that the result doesn't contain sensitive data or forbidden labels.
 */
export function isServerActionResultSafe(
  result: ReaderAiQaActionResult,
): { safe: boolean; violations: readonly string[] } {
  const violations: string[] = [];

  // Check answerPreview for forbidden labels
  if (hasForbiddenAIClaims(result.answerPreview)) {
    violations.push("answerPreview 包含禁止标签");
  }

  // Check warnings for forbidden labels
  const warningText = result.warnings.join(" ");
  if (hasForbiddenAIClaims(warningText)) {
    violations.push("warnings 包含禁止标签");
  }

  // Verify productionReady is false
  if (result.productionReady !== false) {
    violations.push("productionReady 未标记为 false");
  }

  // Verify devOnly is true
  if (result.devOnly !== true) {
    violations.push("devOnly 未标记为 true");
  }

  // Check for raw prompt/response leaks
  const allText =
    result.answerPreview +
    result.warnings.join(" ") +
    result.blockedReasons.join(" ");
  if (/\braw[_\s]*(prompt|response|request)\b/i.test(allText)) {
    violations.push("结果可能包含 raw prompt/response 引用");
  }

  return {
    safe: violations.length === 0,
    violations,
  };
}
