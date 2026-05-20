import {
  AutonomyLevel,
  AutonomyRiskLevel,
  type AutonomyLevel as AutonomyLevelValue,
  type AutonomyRiskLevel as RiskLevel,
} from "../autonomy/types";
import { isRiskAtLeast, maxRiskLevel } from "../autonomy/risk";

export const AgentTaskPlanExecutionStatus = {
  PreviewOnly: "preview_only",
  Disabled: "disabled",
} as const;

export type AgentTaskPlanExecutionStatus =
  (typeof AgentTaskPlanExecutionStatus)[keyof typeof AgentTaskPlanExecutionStatus];

export const AgentTaskPlanStepKind = {
  UnderstandTask: "understand_task",
  InspectContext: "inspect_context",
  ProposeActions: "propose_actions",
  RequestConfirmation: "request_confirmation",
  ExecuteToolDisabled: "execute_tool_disabled",
  SummarizeResult: "summarize_result",
} as const;

export type AgentTaskPlanStepKind =
  (typeof AgentTaskPlanStepKind)[keyof typeof AgentTaskPlanStepKind];

export const AgentTaskPlanToolCategory = {
  FileSystem: "file_system",
  Shell: "shell",
  Browser: "browser",
  Network: "network",
  Memory: "memory",
  Skill: "skill",
  Unknown: "unknown",
} as const;

export type AgentTaskPlanToolCategory =
  (typeof AgentTaskPlanToolCategory)[keyof typeof AgentTaskPlanToolCategory];

export interface AgentTaskPlanPreviewInput {
  taskText: string;
  autonomyLevel?: AutonomyLevelValue;
  availableToolNames?: readonly string[];
  installedSkillIds?: readonly string[];
  userContextSummary?: string;
}

export interface AgentTaskPlanStep {
  stepId: string;
  title: string;
  description: string;
  kind: AgentTaskPlanStepKind;
  riskLevel: RiskLevel;
  requiresTool: boolean;
  toolName?: string;
  toolCategory?: AgentTaskPlanToolCategory;
  requiresConfirmation: boolean;
  executable: false;
}

export interface AgentTaskPlanPreview {
  previewId: string;
  isValid: boolean;
  taskSummary: string;
  steps: readonly AgentTaskPlanStep[];
  suggestedAutonomyLevel: AutonomyLevelValue;
  estimatedRiskLevel: RiskLevel;
  requiresConfirmation: boolean;
  requiredToolNames: readonly string[];
  requiredToolCategories: readonly AgentTaskPlanToolCategory[];
  relatedSkillIds: readonly string[];
  executable: false;
  executionStatus: AgentTaskPlanExecutionStatus;
  disabledReason: string;
  safetyNotes: readonly string[];
}

interface TaskSignals {
  readonly isEmpty: boolean;
  readonly isUnknown: boolean;
  readonly summarizesOrExplains: boolean;
  readonly usesShell: boolean;
  readonly touchesFiles: boolean;
  readonly usesBrowser: boolean;
  readonly usesNetwork: boolean;
  readonly touchesMemory: boolean;
  readonly touchesSkills: boolean;
  readonly isDestructive: boolean;
  readonly touchesCredentials: boolean;
}

interface CreateStepInput {
  readonly index: number;
  readonly title: string;
  readonly description: string;
  readonly kind: AgentTaskPlanStepKind;
  readonly riskLevel: RiskLevel;
  readonly requiresTool: boolean;
  readonly toolName?: string;
  readonly toolCategory?: AgentTaskPlanToolCategory;
  readonly requiresConfirmation: boolean;
}

const TASK_SUMMARY_MAX_LENGTH = 160;

const KEYWORDS = {
  summarizeOrExplain: [
    "summarize",
    "summary",
    "explain",
    "describe",
    "review",
    "analyze",
    "总结",
    "解释",
    "说明",
    "分析",
  ],
  destructive: [
    "delete",
    "remove",
    "erase",
    "destroy",
    "drop",
    "clean",
    "clear",
    "删除",
    "移除",
    "删掉",
    "清空",
    "覆盖",
  ],
  shell: [
    "shell",
    "terminal",
    "cmd",
    "powershell",
    "command",
    "execute",
    "run",
    "运行",
    "执行",
    "命令",
    "终端",
  ],
  files: [
    "file",
    "folder",
    "directory",
    "filesystem",
    "write",
    "save",
    "modify",
    "文件",
    "文件夹",
    "目录",
    "写入",
    "保存",
    "修改",
  ],
  browser: ["browser", "web page", "webpage", "click", "浏览器", "网页", "点击"],
  network: [
    "network",
    "http",
    "api",
    "fetch",
    "download",
    "upload",
    "publish",
    "网络",
    "下载",
    "上传",
    "发布",
  ],
  memory: ["memory", "remember", "memorize", "profile", "记忆", "记住"],
  skills: ["skill", "install skill", "community skill", "技能", "安装 skill"],
  credentials: [
    "api key",
    "apikey",
    "token",
    "secret",
    "password",
    "credential",
    "凭据",
    "密钥",
    "密码",
  ],
} as const;

const TOOL_CATEGORY_MATCHERS: Record<
  AgentTaskPlanToolCategory,
  readonly string[]
> = {
  [AgentTaskPlanToolCategory.FileSystem]: [
    "file",
    "folder",
    "directory",
    "fs",
    "filesystem",
  ],
  [AgentTaskPlanToolCategory.Shell]: [
    "shell",
    "terminal",
    "cmd",
    "powershell",
    "command",
  ],
  [AgentTaskPlanToolCategory.Browser]: ["browser", "web", "page"],
  [AgentTaskPlanToolCategory.Network]: ["network", "http", "api", "fetch"],
  [AgentTaskPlanToolCategory.Memory]: ["memory", "remember"],
  [AgentTaskPlanToolCategory.Skill]: ["skill"],
  [AgentTaskPlanToolCategory.Unknown]: [],
};

const PREVIEW_DISABLED_REASON =
  "智能体任务计划预览仅用于展示。真实智能体执行、模型调用、工具、Skill、网络访问、数据库写入和持久化均已禁用。";

export function createAgentTaskPlanPreview(
  input: AgentTaskPlanPreviewInput,
): AgentTaskPlanPreview {
  const normalizedTaskText = normalizeWhitespace(input.taskText);
  const isValid = normalizedTaskText.length > 0;
  const signals = getTaskSignals(normalizedTaskText);
  const estimatedRiskLevel = estimateRiskLevel(signals);
  const requiredToolCategories = getRequiredToolCategories(signals);
  const requiredToolNames = getRequiredToolNames(
    input.availableToolNames,
    requiredToolCategories,
  );
  const relatedSkillIds = getRelatedSkillIds(input.installedSkillIds);
  const requiresTool = requiredToolCategories.length > 0;
  const requiresConfirmation =
    isValid &&
    (requiresTool ||
      isRiskAtLeast(estimatedRiskLevel, AutonomyRiskLevel.Medium));
  const suggestedAutonomyLevel = suggestAutonomyLevel({
    requestedAutonomyLevel: input.autonomyLevel,
    estimatedRiskLevel,
    requiresTool,
    isValid,
  });

  return {
    previewId: createPreviewId(input, normalizedTaskText),
    isValid,
    taskSummary: createTaskSummary(normalizedTaskText),
    steps: createPlanSteps({
      isValid,
      estimatedRiskLevel,
      requiresConfirmation,
      requiredToolCategories,
      requiredToolNames,
      userContextSummary: input.userContextSummary,
    }),
    suggestedAutonomyLevel,
    estimatedRiskLevel,
    requiresConfirmation,
    requiredToolNames,
    requiredToolCategories,
    relatedSkillIds,
    executable: false,
    executionStatus: isValid
      ? AgentTaskPlanExecutionStatus.PreviewOnly
      : AgentTaskPlanExecutionStatus.Disabled,
    disabledReason: isValid
      ? PREVIEW_DISABLED_REASON
      : "任务文本为空。没有任务内容时，任务计划预览不能变为可执行。",
    safetyNotes: createSafetyNotes({
      isValid,
      requiredToolCategories,
      relatedSkillIds,
      userContextSummary: input.userContextSummary,
      estimatedRiskLevel,
    }),
  };
}

function getTaskSignals(normalizedTaskText: string): TaskSignals {
  const isEmpty = normalizedTaskText.length === 0;
  const summarizesOrExplains = hasAnyKeyword(
    normalizedTaskText,
    KEYWORDS.summarizeOrExplain,
  );
  const usesShell = hasAnyKeyword(normalizedTaskText, KEYWORDS.shell);
  const touchesFiles = hasAnyKeyword(normalizedTaskText, KEYWORDS.files);
  const usesBrowser = hasAnyKeyword(normalizedTaskText, KEYWORDS.browser);
  const usesNetwork = hasAnyKeyword(normalizedTaskText, KEYWORDS.network);
  const touchesMemory = hasAnyKeyword(normalizedTaskText, KEYWORDS.memory);
  const touchesSkills = hasAnyKeyword(normalizedTaskText, KEYWORDS.skills);
  const isDestructive = hasAnyKeyword(normalizedTaskText, KEYWORDS.destructive);
  const touchesCredentials = hasAnyKeyword(
    normalizedTaskText,
    KEYWORDS.credentials,
  );
  const hasKnownSignal =
    summarizesOrExplains ||
    usesShell ||
    touchesFiles ||
    usesBrowser ||
    usesNetwork ||
    touchesMemory ||
    touchesSkills ||
    isDestructive ||
    touchesCredentials;

  return {
    isEmpty,
    isUnknown: !isEmpty && !hasKnownSignal,
    summarizesOrExplains,
    usesShell,
    touchesFiles,
    usesBrowser,
    usesNetwork,
    touchesMemory,
    touchesSkills,
    isDestructive,
    touchesCredentials,
  };
}

function estimateRiskLevel(signals: TaskSignals): RiskLevel {
  if (signals.isEmpty) {
    return AutonomyRiskLevel.Low;
  }

  if (signals.touchesCredentials) {
    return AutonomyRiskLevel.Critical;
  }

  const risks: RiskLevel[] = [];

  if (signals.isDestructive) {
    risks.push(AutonomyRiskLevel.High);
  }

  if (
    signals.usesShell ||
    signals.usesNetwork ||
    signals.touchesSkills ||
    signals.usesBrowser
  ) {
    risks.push(AutonomyRiskLevel.High);
  }

  if (signals.touchesFiles || signals.touchesMemory || signals.isUnknown) {
    risks.push(AutonomyRiskLevel.Medium);
  }

  if (signals.summarizesOrExplains && risks.length === 0) {
    risks.push(AutonomyRiskLevel.Low);
  }

  return maxRiskLevel(...risks) ?? AutonomyRiskLevel.Medium;
}

function getRequiredToolCategories(
  signals: TaskSignals,
): AgentTaskPlanToolCategory[] {
  const categories: AgentTaskPlanToolCategory[] = [];

  appendCategoryIf(categories, signals.touchesFiles, AgentTaskPlanToolCategory.FileSystem);
  appendCategoryIf(categories, signals.usesShell, AgentTaskPlanToolCategory.Shell);
  appendCategoryIf(categories, signals.usesBrowser, AgentTaskPlanToolCategory.Browser);
  appendCategoryIf(categories, signals.usesNetwork, AgentTaskPlanToolCategory.Network);
  appendCategoryIf(categories, signals.touchesMemory, AgentTaskPlanToolCategory.Memory);
  appendCategoryIf(categories, signals.touchesSkills, AgentTaskPlanToolCategory.Skill);

  return categories;
}

function getRequiredToolNames(
  availableToolNames: readonly string[] | undefined,
  requiredToolCategories: readonly AgentTaskPlanToolCategory[],
): string[] {
  if (availableToolNames === undefined || requiredToolCategories.length === 0) {
    return [];
  }

  const categories = new Set(requiredToolCategories);

  return normalizeUniqueStrings(availableToolNames).filter((toolName) => {
    const normalizedToolName = toolName.toLowerCase();

    return [...categories].some((category) =>
      TOOL_CATEGORY_MATCHERS[category].some((matcher) =>
        normalizedToolName.includes(matcher),
      ),
    );
  });
}

function getRelatedSkillIds(
  installedSkillIds: readonly string[] | undefined,
): string[] {
  return normalizeUniqueStrings(installedSkillIds ?? []);
}

function suggestAutonomyLevel(input: {
  readonly requestedAutonomyLevel: AutonomyLevelValue | undefined;
  readonly estimatedRiskLevel: RiskLevel;
  readonly requiresTool: boolean;
  readonly isValid: boolean;
}): AutonomyLevelValue {
  if (!input.isValid) {
    return input.requestedAutonomyLevel ?? AutonomyLevel.Manual;
  }

  if (
    input.requiresTool ||
    isRiskAtLeast(input.estimatedRiskLevel, AutonomyRiskLevel.Medium)
  ) {
    return AutonomyLevel.ConfirmTools;
  }

  return input.requestedAutonomyLevel ?? AutonomyLevel.Manual;
}

function createPlanSteps(input: {
  readonly isValid: boolean;
  readonly estimatedRiskLevel: RiskLevel;
  readonly requiresConfirmation: boolean;
  readonly requiredToolCategories: readonly AgentTaskPlanToolCategory[];
  readonly requiredToolNames: readonly string[];
  readonly userContextSummary: string | undefined;
}): AgentTaskPlanStep[] {
  if (!input.isValid) {
    return [
      createStep({
        index: 1,
        title: "提供任务文本",
        description:
          "当前未提供任务文本，因此预览只能提示计划生成已禁用。",
        kind: AgentTaskPlanStepKind.UnderstandTask,
        riskLevel: AutonomyRiskLevel.Low,
        requiresTool: false,
        requiresConfirmation: false,
      }),
    ];
  }

  const steps: AgentTaskPlanStep[] = [
    createStep({
      index: 1,
      title: "理解任务请求",
      description:
        "整理任务文本并生成简短的确定性摘要，不调用模型。",
      kind: AgentTaskPlanStepKind.UnderstandTask,
      riskLevel: AutonomyRiskLevel.Low,
      requiresTool: false,
      requiresConfirmation: false,
    }),
    createStep({
      index: 2,
      title: "检查已提供上下文",
      description:
        input.userContextSummary === undefined ||
        normalizeWhitespace(input.userContextSummary).length === 0
          ? "当前预览未提供额外的用户上下文摘要。"
          : "把已提供的上下文摘要作为仅展示的预览分类输入。",
      kind: AgentTaskPlanStepKind.InspectContext,
      riskLevel: AutonomyRiskLevel.Low,
      requiresTool: false,
      requiresConfirmation: false,
    }),
    createStep({
      index: 3,
      title: "建议安全下一步",
      description:
        "使用简单关键词对请求分类，并列出不可执行的计划步骤供用户审查。",
      kind: AgentTaskPlanStepKind.ProposeActions,
      riskLevel: input.estimatedRiskLevel,
      requiresTool: false,
      requiresConfirmation: input.requiresConfirmation,
    }),
  ];

  if (input.requiresConfirmation) {
    steps.push(
      createStep({
        index: steps.length + 1,
        title: "请求用户确认",
        description:
          "未来运行时若涉及中风险及以上操作、工具使用或 Skill 使用，需要先获得用户确认。",
        kind: AgentTaskPlanStepKind.RequestConfirmation,
        riskLevel: input.estimatedRiskLevel,
        requiresTool: false,
        requiresConfirmation: true,
      }),
    );
  }

  for (const category of input.requiredToolCategories) {
    steps.push(
      createStep({
        index: steps.length + 1,
        title: "保持工具执行禁用",
        description:
          "该预览识别到可能的工具类别，但不会注册或调用任何工具。",
        kind: AgentTaskPlanStepKind.ExecuteToolDisabled,
        riskLevel: input.estimatedRiskLevel,
        requiresTool: true,
        toolCategory: category,
        toolName: getFirstMatchingToolName(input.requiredToolNames, category),
        requiresConfirmation: true,
      }),
    );
  }

  steps.push(
    createStep({
      index: steps.length + 1,
      title: "汇总预览结果",
      description:
        "返回计划预览、安全说明、风险估计和已禁用的执行状态。",
      kind: AgentTaskPlanStepKind.SummarizeResult,
      riskLevel: input.estimatedRiskLevel,
      requiresTool: false,
      requiresConfirmation: false,
    }),
  );

  return steps;
}

function createStep(input: CreateStepInput): AgentTaskPlanStep {
  return {
    stepId: `step_${input.index.toString().padStart(2, "0")}`,
    title: input.title,
    description: input.description,
    kind: input.kind,
    riskLevel: input.riskLevel,
    requiresTool: input.requiresTool,
    ...(input.toolName === undefined ? {} : { toolName: input.toolName }),
    ...(input.toolCategory === undefined
      ? {}
      : { toolCategory: input.toolCategory }),
    requiresConfirmation: input.requiresConfirmation,
    executable: false,
  };
}

function createTaskSummary(normalizedTaskText: string): string {
  if (normalizedTaskText.length === 0) {
    return "未提供任务文本。";
  }

  return `任务预览：${truncateText(
    normalizedTaskText,
    TASK_SUMMARY_MAX_LENGTH,
  )}`;
}

function createPreviewId(
  input: AgentTaskPlanPreviewInput,
  normalizedTaskText: string,
): string {
  const stableParts = [
    normalizedTaskText,
    input.autonomyLevel ?? "",
    normalizeWhitespace(input.userContextSummary ?? ""),
    normalizeUniqueStrings(input.availableToolNames ?? []).join(","),
    normalizeUniqueStrings(input.installedSkillIds ?? []).join(","),
  ];

  return `plan_preview_${hashString(stableParts.join("|"))}`;
}

function createSafetyNotes(input: {
  readonly isValid: boolean;
  readonly requiredToolCategories: readonly AgentTaskPlanToolCategory[];
  readonly relatedSkillIds: readonly string[];
  readonly userContextSummary: string | undefined;
  readonly estimatedRiskLevel: RiskLevel;
}): string[] {
  const notes = [
    "该预览使用确定性关键词分类，不是 AI 推理结果。",
    "所有预览步骤均不可执行，不能调用模型、工具、Skill、网络、文件、数据库或持久化能力。",
  ];

  if (!input.isValid) {
    notes.push("空任务文本只会生成已禁用的预览。");
  }

  if (input.requiredToolCategories.length > 0) {
    notes.push(
      `可能需要的工具类别仅供参考且均已禁用：${input.requiredToolCategories.join(", ")}。`,
    );
  }

  if (input.relatedSkillIds.length > 0) {
    notes.push(
      "已安装 Skill ID 只作为关联 ID 展示；不会执行 Skill 查找、安装审查或运行。",
    );
  }

  if (
    input.userContextSummary !== undefined &&
    normalizeWhitespace(input.userContextSummary).length > 0
  ) {
    notes.push("用户上下文摘要仅作为预览展示输入处理。");
  }

  if (isRiskAtLeast(input.estimatedRiskLevel, AutonomyRiskLevel.High)) {
    notes.push("高风险和严重风险预览在进入任何未来执行边界前都需要明确确认。");
  }

  return notes;
}

function appendCategoryIf(
  categories: AgentTaskPlanToolCategory[],
  condition: boolean,
  category: AgentTaskPlanToolCategory,
): void {
  if (condition && !categories.includes(category)) {
    categories.push(category);
  }
}

function getFirstMatchingToolName(
  toolNames: readonly string[],
  category: AgentTaskPlanToolCategory,
): string | undefined {
  const matchers = TOOL_CATEGORY_MATCHERS[category];

  return toolNames.find((toolName) => {
    const normalizedToolName = toolName.toLowerCase();

    return matchers.some((matcher) => normalizedToolName.includes(matcher));
  });
}

function hasAnyKeyword(
  normalizedTaskText: string,
  keywords: readonly string[],
): boolean {
  return keywords.some((keyword) =>
    normalizedTaskText.includes(keyword.toLowerCase()),
  );
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeUniqueStrings(values: readonly string[]): string[] {
  const normalizedValues: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const normalized = value.trim();
    const key = normalized.toLowerCase();

    if (normalized.length > 0 && !seen.has(key)) {
      seen.add(key);
      normalizedValues.push(normalized);
    }
  }

  return normalizedValues.sort((left, right) =>
    left.toLowerCase().localeCompare(right.toLowerCase()),
  );
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function hashString(value: string): string {
  let hash = 2_166_136_261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619) >>> 0;
  }

  return hash.toString(36).padStart(7, "0");
}
