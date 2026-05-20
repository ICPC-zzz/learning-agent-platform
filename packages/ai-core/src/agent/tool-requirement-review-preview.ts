import {
  AutonomyLevel,
  AutonomyRiskLevel,
  type AutonomyLevel as AutonomyLevelValue,
  type AutonomyRiskLevel as RiskLevel,
} from "../autonomy/types";
import { isRiskAtLeast, maxRiskLevel } from "../autonomy/risk";
import type { ToolDefinition } from "../tools/types";
import {
  AgentTaskPlanExecutionStatus,
  AgentTaskPlanToolCategory,
  type AgentTaskPlanPreview,
  type AgentTaskPlanStep,
  type AgentTaskPlanToolCategory as AgentTaskPlanToolCategoryValue,
} from "./plan-preview";

export const AgentToolRequirementCategory = {
  FileRead: "file_read",
  FileWrite: "file_write",
  ShellCommand: "shell_command",
  WebRequest: "web_request",
  DatabaseRead: "database_read",
  DatabaseWrite: "database_write",
  EmailSend: "email_send",
  CalendarWrite: "calendar_write",
  SkillInstall: "skill_install",
  Unknown: "unknown",
} as const;

export type AgentToolRequirementCategory =
  (typeof AgentToolRequirementCategory)[keyof typeof AgentToolRequirementCategory];

export const AgentToolRequirementReviewStatus = {
  NoToolRequirementsDetected: "no_tool_requirements_detected",
  PreviewOnly: "preview_only",
  NeedsConfirmation: "needs_confirmation",
  Blocked: "blocked",
  Disabled: "disabled",
} as const;

export type AgentToolRequirementReviewStatus =
  (typeof AgentToolRequirementReviewStatus)[keyof typeof AgentToolRequirementReviewStatus];

export type AgentToolRequirementExecutionStatus =
  AgentTaskPlanExecutionStatus;

export interface AgentAvailableToolMetadata {
  name: string;
  description?: string;
  category?: AgentToolRequirementCategory | AgentTaskPlanToolCategoryValue | string;
  riskLevel?: RiskLevel;
  requiresConfirmation?: boolean;
  enabled?: boolean;
}

export interface AgentToolRequirementPreviewItem {
  stepId?: string;
  stepIndex: number;
  stepTitle: string;
  stepSummary: string;
  requiredToolCategories: readonly AgentToolRequirementCategory[];
  candidateToolNames: readonly string[];
  riskLevel: RiskLevel;
  requiresConfirmation: boolean;
  allowedByCurrentAutonomy: boolean;
  executable: false;
  disabledReason: string;
  blockedReason: string;
  safetyNotes: readonly string[];
}

export interface AgentToolRequirementReviewPreview {
  planPreviewId: string;
  taskSummary: string;
  autonomyLevel: AutonomyLevelValue;
  overallRiskLevel: RiskLevel;
  reviewStatus: AgentToolRequirementReviewStatus;
  executable: false;
  executionStatus: AgentToolRequirementExecutionStatus;
  disabledReason: string;
  requirements: readonly AgentToolRequirementPreviewItem[];
  blockedRequirementCount: number;
  confirmationRequiredCount: number;
  safetyNotes: readonly string[];
}

interface NormalizedAvailableTool {
  readonly name: string;
  readonly description: string;
  readonly category: AgentToolRequirementCategory | undefined;
  readonly riskLevel: RiskLevel | undefined;
  readonly requiresConfirmation: boolean;
  readonly enabled: boolean;
  readonly hasCompletePreviewMetadata: boolean;
}

interface RequirementCandidate {
  readonly step: AgentTaskPlanStep;
  readonly stepIndex: number;
  readonly categories: readonly AgentToolRequirementCategory[];
}

const TOOL_REVIEW_DISABLED_REASON =
  "智能体工具需求审查仅为预览。真实工具执行、工具注册、模型调用、网络访问、数据库访问、持久化和智能体运行时执行均已禁用。";

const BLOCKED_REASON = {
  PreviewOnly: "preview_only_execution_disabled",
  PlanPreviewDisabled: "plan_preview_disabled",
  MissingToolMetadata: "missing_tool_metadata",
  NoAvailableToolForRequiredCategory: "no_available_tool_for_required_category",
  CandidateToolDisabled: "candidate_tool_disabled",
  CriticalRiskDisabled: "critical_risk_disabled",
  ConfirmationRequiredByAutonomy: "confirmation_required_by_current_autonomy",
  RiskDeniedByAutonomy: "risk_denied_by_current_autonomy",
} as const;

const hardBlockedReasons = new Set<string>([
  BLOCKED_REASON.PlanPreviewDisabled,
  BLOCKED_REASON.MissingToolMetadata,
  BLOCKED_REASON.NoAvailableToolForRequiredCategory,
  BLOCKED_REASON.CandidateToolDisabled,
  BLOCKED_REASON.CriticalRiskDisabled,
  BLOCKED_REASON.RiskDeniedByAutonomy,
]);

const categoryRiskLevel: Record<AgentToolRequirementCategory, RiskLevel> = {
  [AgentToolRequirementCategory.FileRead]: AutonomyRiskLevel.Low,
  [AgentToolRequirementCategory.FileWrite]: AutonomyRiskLevel.Medium,
  [AgentToolRequirementCategory.ShellCommand]: AutonomyRiskLevel.High,
  [AgentToolRequirementCategory.WebRequest]: AutonomyRiskLevel.High,
  [AgentToolRequirementCategory.DatabaseRead]: AutonomyRiskLevel.Medium,
  [AgentToolRequirementCategory.DatabaseWrite]: AutonomyRiskLevel.High,
  [AgentToolRequirementCategory.EmailSend]: AutonomyRiskLevel.High,
  [AgentToolRequirementCategory.CalendarWrite]: AutonomyRiskLevel.High,
  [AgentToolRequirementCategory.SkillInstall]: AutonomyRiskLevel.High,
  [AgentToolRequirementCategory.Unknown]: AutonomyRiskLevel.Medium,
};

const CATEGORY_KEYWORDS: Record<AgentToolRequirementCategory, readonly string[]> = {
  [AgentToolRequirementCategory.FileRead]: [
    "read file",
    "open file",
    "list file",
    "inspect file",
    "view file",
    "filesystem",
    "directory",
    "folder",
  ],
  [AgentToolRequirementCategory.FileWrite]: [
    "write file",
    "save file",
    "create file",
    "modify file",
    "edit file",
    "delete file",
    "overwrite",
    "remove file",
  ],
  [AgentToolRequirementCategory.ShellCommand]: [
    "shell",
    "terminal",
    "powershell",
    "command",
    "execute",
    "run",
    "script",
  ],
  [AgentToolRequirementCategory.WebRequest]: [
    "web",
    "browser",
    "network",
    "http",
    "api",
    "fetch",
    "download",
    "upload",
    "publish",
  ],
  [AgentToolRequirementCategory.DatabaseRead]: [
    "database read",
    "db read",
    "query",
    "select",
    "load record",
  ],
  [AgentToolRequirementCategory.DatabaseWrite]: [
    "database write",
    "db write",
    "insert",
    "update record",
    "delete record",
    "migration",
  ],
  [AgentToolRequirementCategory.EmailSend]: [
    "email",
    "mail",
    "send message",
    "send to",
  ],
  [AgentToolRequirementCategory.CalendarWrite]: [
    "calendar",
    "schedule",
    "meeting",
    "event",
  ],
  [AgentToolRequirementCategory.SkillInstall]: [
    "skill",
    "install skill",
    "community skill",
  ],
  [AgentToolRequirementCategory.Unknown]: [],
};

const CRITICAL_KEYWORDS = [
  "api key",
  "apikey",
  "token",
  "secret",
  "password",
  "credential",
  "payment",
  "billing",
  "production",
  "prod",
  "irreversible",
  "sensitive",
  "exfiltrate",
];

const WRITE_KEYWORDS = [
  "write",
  "save",
  "create",
  "modify",
  "edit",
  "delete",
  "remove",
  "overwrite",
  "update",
  "insert",
  "migration",
];

export function createAgentToolRequirementReviewPreview(
  planPreview: AgentTaskPlanPreview,
  availableTools: readonly (AgentAvailableToolMetadata | ToolDefinition)[] = [],
  autonomyLevel: AutonomyLevelValue = planPreview.suggestedAutonomyLevel,
): AgentToolRequirementReviewPreview {
  const normalizedTools = normalizeAvailableTools(availableTools);
  const requirementCandidates = getRequirementCandidates(planPreview);
  const requirements = requirementCandidates.map((candidate) =>
    createRequirementItem({
      candidate,
      planPreview,
      availableTools: normalizedTools,
      autonomyLevel,
    }),
  );
  const overallRiskLevel = getOverallRiskLevel(planPreview, requirements);
  const blockedRequirementCount = requirements.filter(
    (requirement) =>
      requirement.blockedReason !== BLOCKED_REASON.PreviewOnly,
  ).length;
  const confirmationRequiredCount = requirements.filter(
    (requirement) => requirement.requiresConfirmation,
  ).length;

  return {
    planPreviewId: planPreview.previewId,
    taskSummary: planPreview.taskSummary,
    autonomyLevel,
    overallRiskLevel,
    reviewStatus: getReviewStatus({
      planPreview,
      requirements,
      confirmationRequiredCount,
    }),
    executable: false,
    executionStatus: planPreview.isValid
      ? AgentTaskPlanExecutionStatus.PreviewOnly
      : AgentTaskPlanExecutionStatus.Disabled,
    disabledReason: planPreview.isValid
      ? TOOL_REVIEW_DISABLED_REASON
      : "来源智能体任务计划预览已禁用，因此工具需求审查不能变为可执行。",
    requirements,
    blockedRequirementCount,
    confirmationRequiredCount,
    safetyNotes: createReviewSafetyNotes({
      planPreview,
      availableToolCount: normalizedTools.length,
      requirements,
      overallRiskLevel,
    }),
  };
}

function createRequirementItem(input: {
  readonly candidate: RequirementCandidate;
  readonly planPreview: AgentTaskPlanPreview;
  readonly availableTools: readonly NormalizedAvailableTool[];
  readonly autonomyLevel: AutonomyLevelValue;
}): AgentToolRequirementPreviewItem {
  const stepText = createStepText(input.candidate.step, input.planPreview);
  const categories = normalizeUniqueCategories(input.candidate.categories);
  const matchingTools = findMatchingTools({
    categories,
    step: input.candidate.step,
    stepText,
    availableTools: input.availableTools,
  });
  const riskLevel = getRequirementRiskLevel({
    stepRiskLevel: input.candidate.step.riskLevel,
    categories,
    matchingTools,
    stepText,
  });
  const requiresConfirmation = requiresConfirmationForRequirement({
    riskLevel,
    autonomyLevel: input.autonomyLevel,
    matchingTools,
  });
  const allowedByCurrentAutonomy = isAllowedByCurrentAutonomy({
    riskLevel,
    autonomyLevel: input.autonomyLevel,
    requiresConfirmation,
  });
  const blockedReason = getBlockedReason({
    categories,
    matchingTools,
    riskLevel,
    requiresConfirmation,
    allowedByCurrentAutonomy,
    planPreview: input.planPreview,
  });

  return {
    stepId: input.candidate.step.stepId,
    stepIndex: input.candidate.stepIndex,
    stepTitle: input.candidate.step.title,
    stepSummary: input.candidate.step.description,
    requiredToolCategories: categories,
    candidateToolNames: matchingTools.map((tool) => tool.name),
    riskLevel,
    requiresConfirmation,
    allowedByCurrentAutonomy,
    executable: false,
    disabledReason: TOOL_REVIEW_DISABLED_REASON,
    blockedReason,
    safetyNotes: createRequirementSafetyNotes({
      categories,
      matchingTools,
      riskLevel,
      requiresConfirmation,
      allowedByCurrentAutonomy,
      blockedReason,
    }),
  };
}

function getRequirementCandidates(
  planPreview: AgentTaskPlanPreview,
): RequirementCandidate[] {
  const candidates: RequirementCandidate[] = [];

  planPreview.steps.forEach((step, index) => {
    const stepIndex = index + 1;
    const categories = inferStepRequirementCategories(step, planPreview);
    const shouldReviewStep =
      step.requiresTool ||
      step.toolName !== undefined ||
      step.toolCategory !== undefined ||
      categories.length > 0 ||
      (!step.requiresTool &&
        planPreview.requiredToolCategories.length === 0 &&
        isRiskAtLeast(step.riskLevel, AutonomyRiskLevel.Medium));

    if (!shouldReviewStep) {
      return;
    }

    candidates.push({
      step,
      stepIndex,
      categories:
        categories.length > 0
          ? categories
          : [AgentToolRequirementCategory.Unknown],
    });
  });

  return candidates;
}

function inferStepRequirementCategories(
  step: AgentTaskPlanStep,
  planPreview: AgentTaskPlanPreview,
): AgentToolRequirementCategory[] {
  const shouldUsePlanSummaryForInference =
    step.requiresTool ||
    step.toolName !== undefined ||
    step.toolCategory !== undefined ||
    (planPreview.requiredToolCategories.length === 0 &&
      isRiskAtLeast(step.riskLevel, AutonomyRiskLevel.Medium));
  const stepText = shouldUsePlanSummaryForInference
    ? createStepText(step, planPreview)
    : createStepOnlyText(step);
  const categories: AgentToolRequirementCategory[] = [];

  if (step.toolCategory !== undefined) {
    categories.push(
      ...mapPlanToolCategoryToRequirementCategories(
        step.toolCategory,
        stepText,
      ),
    );
  }

  for (const category of planPreview.requiredToolCategories) {
    if (
      step.toolCategory === category ||
      step.requiresTool ||
      step.toolName !== undefined
    ) {
      categories.push(
        ...mapPlanToolCategoryToRequirementCategories(category, stepText),
      );
    }
  }

  categories.push(...inferCategoriesFromText(stepText));

  return normalizeUniqueCategories(categories);
}

function mapPlanToolCategoryToRequirementCategories(
  category: AgentTaskPlanToolCategoryValue,
  stepText: string,
): AgentToolRequirementCategory[] {
  switch (category) {
    case AgentTaskPlanToolCategory.FileSystem:
      return [
        hasAnyKeyword(stepText, WRITE_KEYWORDS)
          ? AgentToolRequirementCategory.FileWrite
          : AgentToolRequirementCategory.FileRead,
      ];
    case AgentTaskPlanToolCategory.Shell:
      return [AgentToolRequirementCategory.ShellCommand];
    case AgentTaskPlanToolCategory.Browser:
    case AgentTaskPlanToolCategory.Network:
      return [AgentToolRequirementCategory.WebRequest];
    case AgentTaskPlanToolCategory.Memory:
      return [
        hasAnyKeyword(stepText, WRITE_KEYWORDS)
          ? AgentToolRequirementCategory.DatabaseWrite
          : AgentToolRequirementCategory.DatabaseRead,
      ];
    case AgentTaskPlanToolCategory.Skill:
      return [AgentToolRequirementCategory.SkillInstall];
    case AgentTaskPlanToolCategory.Unknown:
      return [AgentToolRequirementCategory.Unknown];
  }
}

function inferCategoriesFromText(text: string): AgentToolRequirementCategory[] {
  const categories: AgentToolRequirementCategory[] = [];

  for (const category of Object.values(AgentToolRequirementCategory)) {
    if (
      category !== AgentToolRequirementCategory.Unknown &&
      hasAnyKeyword(text, CATEGORY_KEYWORDS[category])
    ) {
      categories.push(category);
    }
  }

  return categories;
}

function normalizeAvailableTools(
  availableTools: readonly (AgentAvailableToolMetadata | ToolDefinition)[],
): NormalizedAvailableTool[] {
  const normalizedTools: NormalizedAvailableTool[] = [];
  const seen = new Set<string>();

  for (const tool of availableTools) {
    const name = normalizeWhitespace(tool.name);
    const key = name.toLowerCase();
    const category = getAvailableToolCategory(tool);
    const enabled = getAvailableToolEnabled(tool);

    if (name.length === 0 || seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalizedTools.push({
      name,
      description: normalizeWhitespace(tool.description ?? ""),
      category: normalizeToolCategory(category),
      riskLevel: tool.riskLevel,
      requiresConfirmation: tool.requiresConfirmation === true,
      enabled,
      hasCompletePreviewMetadata:
        category !== undefined && tool.riskLevel !== undefined,
    });
  }

  return normalizedTools.sort((left, right) =>
    left.name.toLowerCase().localeCompare(right.name.toLowerCase()),
  );
}

function getAvailableToolCategory(
  tool: AgentAvailableToolMetadata | ToolDefinition,
): AgentAvailableToolMetadata["category"] {
  if ("category" in tool) {
    return tool.category;
  }

  const metadata = "metadata" in tool ? tool.metadata : undefined;
  const metadataCategory = metadata?.category;

  return typeof metadataCategory === "string" ? metadataCategory : undefined;
}

function getAvailableToolEnabled(
  tool: AgentAvailableToolMetadata | ToolDefinition,
): boolean {
  if ("enabled" in tool) {
    return tool.enabled !== false;
  }

  const metadata = "metadata" in tool ? tool.metadata : undefined;
  const metadataEnabled = metadata?.enabled;

  return typeof metadataEnabled === "boolean" ? metadataEnabled : true;
}

function normalizeToolCategory(
  category: AgentAvailableToolMetadata["category"],
): AgentToolRequirementCategory | undefined {
  if (category === undefined) {
    return undefined;
  }

  const categoryText = category.toLowerCase();

  if (isAgentToolRequirementCategory(categoryText)) {
    return categoryText;
  }

  if (categoryText === AgentTaskPlanToolCategory.FileSystem) {
    return AgentToolRequirementCategory.FileRead;
  }

  if (categoryText === AgentTaskPlanToolCategory.Shell) {
    return AgentToolRequirementCategory.ShellCommand;
  }

  if (
    categoryText === AgentTaskPlanToolCategory.Browser ||
    categoryText === AgentTaskPlanToolCategory.Network
  ) {
    return AgentToolRequirementCategory.WebRequest;
  }

  if (categoryText === AgentTaskPlanToolCategory.Memory) {
    return AgentToolRequirementCategory.DatabaseRead;
  }

  if (categoryText === AgentTaskPlanToolCategory.Skill) {
    return AgentToolRequirementCategory.SkillInstall;
  }

  if (categoryText.includes("write") || categoryText.includes("edit")) {
    return AgentToolRequirementCategory.FileWrite;
  }

  if (categoryText.includes("file") || categoryText.includes("read")) {
    return AgentToolRequirementCategory.FileRead;
  }

  if (categoryText.includes("shell") || categoryText.includes("command")) {
    return AgentToolRequirementCategory.ShellCommand;
  }

  if (
    categoryText.includes("web") ||
    categoryText.includes("network") ||
    categoryText.includes("http") ||
    categoryText.includes("api")
  ) {
    return AgentToolRequirementCategory.WebRequest;
  }

  if (categoryText.includes("database") || categoryText.includes("db")) {
    return categoryText.includes("write")
      ? AgentToolRequirementCategory.DatabaseWrite
      : AgentToolRequirementCategory.DatabaseRead;
  }

  if (categoryText.includes("email") || categoryText.includes("mail")) {
    return AgentToolRequirementCategory.EmailSend;
  }

  if (categoryText.includes("calendar") || categoryText.includes("schedule")) {
    return AgentToolRequirementCategory.CalendarWrite;
  }

  if (categoryText.includes("skill")) {
    return AgentToolRequirementCategory.SkillInstall;
  }

  return undefined;
}

function findMatchingTools(input: {
  readonly categories: readonly AgentToolRequirementCategory[];
  readonly step: AgentTaskPlanStep;
  readonly stepText: string;
  readonly availableTools: readonly NormalizedAvailableTool[];
}): NormalizedAvailableTool[] {
  const matchingTools = input.availableTools.filter((tool) => {
    if (
      input.step.toolName !== undefined &&
      tool.name.toLowerCase() === input.step.toolName.toLowerCase()
    ) {
      return true;
    }

    return input.categories.some((category) =>
      doesToolMatchCategory(tool, category),
    );
  });

  if (matchingTools.length > 0) {
    return matchingTools;
  }

  return input.availableTools.filter((tool) =>
    hasAnyKeyword(`${tool.name} ${tool.description}`, [input.stepText]),
  );
}

function doesToolMatchCategory(
  tool: NormalizedAvailableTool,
  category: AgentToolRequirementCategory,
): boolean {
  if (tool.category === category) {
    return true;
  }

  if (
    category === AgentToolRequirementCategory.FileWrite &&
    tool.category === AgentToolRequirementCategory.FileRead
  ) {
    return hasAnyKeyword(`${tool.name} ${tool.description}`, WRITE_KEYWORDS);
  }

  if (tool.category !== undefined) {
    return false;
  }

  const searchableToolText = `${tool.name} ${tool.description}`;

  return hasAnyKeyword(searchableToolText, CATEGORY_KEYWORDS[category]);
}

function getRequirementRiskLevel(input: {
  readonly stepRiskLevel: RiskLevel;
  readonly categories: readonly AgentToolRequirementCategory[];
  readonly matchingTools: readonly NormalizedAvailableTool[];
  readonly stepText: string;
}): RiskLevel {
  if (hasAnyKeyword(input.stepText, CRITICAL_KEYWORDS)) {
    return AutonomyRiskLevel.Critical;
  }

  return (
    maxRiskLevel(
      input.stepRiskLevel,
      ...input.categories.map((category) => categoryRiskLevel[category]),
      ...input.matchingTools.map((tool) => tool.riskLevel),
    ) ?? AutonomyRiskLevel.Medium
  );
}

function requiresConfirmationForRequirement(input: {
  readonly riskLevel: RiskLevel;
  readonly autonomyLevel: AutonomyLevelValue;
  readonly matchingTools: readonly NormalizedAvailableTool[];
}): boolean {
  if (input.matchingTools.some((tool) => tool.requiresConfirmation)) {
    return true;
  }

  if (isRiskAtLeast(input.riskLevel, AutonomyRiskLevel.High)) {
    return true;
  }

  return (
    input.autonomyLevel === AutonomyLevel.Manual ||
    input.autonomyLevel === AutonomyLevel.ConfirmTools
  );
}

function isAllowedByCurrentAutonomy(input: {
  readonly riskLevel: RiskLevel;
  readonly autonomyLevel: AutonomyLevelValue;
  readonly requiresConfirmation: boolean;
}): boolean {
  if (isRiskAtLeast(input.riskLevel, AutonomyRiskLevel.Critical)) {
    return false;
  }

  if (input.requiresConfirmation) {
    return false;
  }

  if (
    input.autonomyLevel === AutonomyLevel.Manual ||
    input.autonomyLevel === AutonomyLevel.ConfirmTools
  ) {
    return false;
  }

  return true;
}

function getBlockedReason(input: {
  readonly categories: readonly AgentToolRequirementCategory[];
  readonly matchingTools: readonly NormalizedAvailableTool[];
  readonly riskLevel: RiskLevel;
  readonly requiresConfirmation: boolean;
  readonly allowedByCurrentAutonomy: boolean;
  readonly planPreview: AgentTaskPlanPreview;
}): string {
  if (!input.planPreview.isValid) {
    return BLOCKED_REASON.PlanPreviewDisabled;
  }

  if (isRiskAtLeast(input.riskLevel, AutonomyRiskLevel.Critical)) {
    return BLOCKED_REASON.CriticalRiskDisabled;
  }

  if (input.categories.includes(AgentToolRequirementCategory.Unknown)) {
    return BLOCKED_REASON.MissingToolMetadata;
  }

  if (input.matchingTools.length === 0) {
    return BLOCKED_REASON.NoAvailableToolForRequiredCategory;
  }

  if (input.matchingTools.every((tool) => !tool.enabled)) {
    return BLOCKED_REASON.CandidateToolDisabled;
  }

  if (input.matchingTools.every((tool) => !tool.hasCompletePreviewMetadata)) {
    return BLOCKED_REASON.MissingToolMetadata;
  }

  if (!input.allowedByCurrentAutonomy && input.requiresConfirmation) {
    return BLOCKED_REASON.ConfirmationRequiredByAutonomy;
  }

  if (!input.allowedByCurrentAutonomy) {
    return BLOCKED_REASON.RiskDeniedByAutonomy;
  }

  return BLOCKED_REASON.PreviewOnly;
}

function getOverallRiskLevel(
  planPreview: AgentTaskPlanPreview,
  requirements: readonly AgentToolRequirementPreviewItem[],
): RiskLevel {
  return (
    maxRiskLevel(
      planPreview.estimatedRiskLevel,
      ...requirements.map((requirement) => requirement.riskLevel),
    ) ?? AutonomyRiskLevel.Medium
  );
}

function getReviewStatus(input: {
  readonly planPreview: AgentTaskPlanPreview;
  readonly requirements: readonly AgentToolRequirementPreviewItem[];
  readonly confirmationRequiredCount: number;
}): AgentToolRequirementReviewStatus {
  if (!input.planPreview.isValid) {
    return AgentToolRequirementReviewStatus.Disabled;
  }

  if (input.requirements.length === 0) {
    return AgentToolRequirementReviewStatus.NoToolRequirementsDetected;
  }

  if (
    input.requirements.some((requirement) =>
      hardBlockedReasons.has(requirement.blockedReason),
    )
  ) {
    return AgentToolRequirementReviewStatus.Blocked;
  }

  if (input.confirmationRequiredCount > 0) {
    return AgentToolRequirementReviewStatus.NeedsConfirmation;
  }

  return AgentToolRequirementReviewStatus.PreviewOnly;
}

function createReviewSafetyNotes(input: {
  readonly planPreview: AgentTaskPlanPreview;
  readonly availableToolCount: number;
  readonly requirements: readonly AgentToolRequirementPreviewItem[];
  readonly overallRiskLevel: RiskLevel;
}): string[] {
  const notes = [
    "该审查基于已有智能体任务计划预览做确定性元数据分析。",
    "该审查仅为预览，绝不会调用模型、工具、Skill、网络、文件、数据库、API Key 或持久化能力。",
    "所有候选工具都只是参考元数据；该函数不会注册、授权、安装或执行任何工具。",
  ];

  if (!input.planPreview.isValid) {
    notes.push("来源计划预览已禁用，因此该审查也保持禁用。");
  }

  if (input.availableToolCount === 0 && input.requirements.length > 0) {
    notes.push("未提供可用工具元数据；所需类别会按不可用处理并阻断。");
  }

  if (input.requirements.length === 0) {
    notes.push("未检测到明确工具需求，但执行仍保持禁用。");
  }

  if (isRiskAtLeast(input.overallRiskLevel, AutonomyRiskLevel.Critical)) {
    notes.push("严重风险需求在预览中会被阻断，不能通过自主性等级绕过。");
  } else if (isRiskAtLeast(input.overallRiskLevel, AutonomyRiskLevel.High)) {
    notes.push("高风险需求在进入任何未来执行边界前需要确认。");
  }

  return notes;
}

function createRequirementSafetyNotes(input: {
  readonly categories: readonly AgentToolRequirementCategory[];
  readonly matchingTools: readonly NormalizedAvailableTool[];
  readonly riskLevel: RiskLevel;
  readonly requiresConfirmation: boolean;
  readonly allowedByCurrentAutonomy: boolean;
  readonly blockedReason: string;
}): string[] {
  const notes = [
    "该需求只是预览项；executable 始终为 false。",
  ];

  if (input.categories.includes(AgentToolRequirementCategory.Unknown)) {
    notes.push("所需工具类别未知，因此在元数据澄清前未来执行必须保持阻断。");
  }

  if (input.matchingTools.length === 0) {
    notes.push("没有候选工具元数据匹配所需类别。");
  }

  if (input.matchingTools.some((tool) => !tool.enabled)) {
    notes.push("至少一个候选工具在已提供元数据中处于禁用状态。");
  }

  if (input.matchingTools.every((tool) => !tool.hasCompletePreviewMetadata)) {
    notes.push("候选工具元数据不足，无法完整审查风险或类别。");
  }

  if (isRiskAtLeast(input.riskLevel, AutonomyRiskLevel.Critical)) {
    notes.push("即使自主性等级较高，严重风险也保持阻断。");
  } else if (isRiskAtLeast(input.riskLevel, AutonomyRiskLevel.High)) {
    notes.push("高风险在进入任何未来执行路径前都需要确认。");
  }

  if (input.requiresConfirmation) {
    notes.push("当前自主性策略语义要求该需求先经过确认。");
  }

  if (!input.allowedByCurrentAutonomy) {
    notes.push("当前自主性等级不允许该需求自动执行。");
  }

  if (input.blockedReason !== BLOCKED_REASON.PreviewOnly) {
    notes.push(`阻断原因：${input.blockedReason}。`);
  }

  return notes;
}

function createStepText(
  step: AgentTaskPlanStep,
  planPreview: AgentTaskPlanPreview,
): string {
  return normalizeWhitespace(
    [
      planPreview.taskSummary,
      step.title,
      step.description,
      step.toolName ?? "",
      step.toolCategory ?? "",
    ].join(" "),
  );
}

function createStepOnlyText(step: AgentTaskPlanStep): string {
  return normalizeWhitespace(
    [
      step.title,
      step.description,
      step.toolName ?? "",
      step.toolCategory ?? "",
    ].join(" "),
  );
}

function hasAnyKeyword(text: string, keywords: readonly string[]): boolean {
  return keywords.some((keyword) =>
    text.includes(normalizeWhitespace(keyword)),
  );
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeUniqueCategories(
  categories: readonly AgentToolRequirementCategory[],
): AgentToolRequirementCategory[] {
  const seen = new Set<AgentToolRequirementCategory>();
  const normalizedCategories: AgentToolRequirementCategory[] = [];

  for (const category of categories) {
    if (!seen.has(category)) {
      seen.add(category);
      normalizedCategories.push(category);
    }
  }

  return normalizedCategories;
}

function isAgentToolRequirementCategory(
  value: string,
): value is AgentToolRequirementCategory {
  return Object.values(AgentToolRequirementCategory).includes(
    value as AgentToolRequirementCategory,
  );
}
