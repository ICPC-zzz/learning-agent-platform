import {
  AutonomyLevel,
  AutonomyRiskLevel,
  type AutonomyLevel as AutonomyLevelValue,
} from "../autonomy/types";
import { isRiskAtLeast, maxRiskLevel } from "../autonomy/risk";
import {
  SkillRiskLevel,
  type SkillManifest,
  type SkillMetadata,
  type SkillToolRequirement,
} from "../skills/types";
import {
  getSkillToolName,
  hasRequiredAutonomyLevel,
  isRequiredTool,
} from "../skills/utils";
import {
  AgentTaskPlanExecutionStatus,
  AgentTaskPlanStepKind,
  AgentTaskPlanToolCategory,
  type AgentTaskPlanPreview,
  type AgentTaskPlanStep,
  type AgentTaskPlanToolCategory as AgentTaskPlanToolCategoryValue,
} from "./plan-preview";
import type {
  AgentToolRequirementCategory,
  AgentToolRequirementReviewPreview,
} from "./tool-requirement-review-preview";

export const AgentSkillSuggestionPreviewStatus = {
  PreviewOnly: "preview_only",
  NoInstalledSkills: "no_installed_skills",
  NoMatchingSkill: "no_matching_skill",
  Disabled: "disabled",
} as const;

export type AgentSkillSuggestionPreviewStatus =
  (typeof AgentSkillSuggestionPreviewStatus)[keyof typeof AgentSkillSuggestionPreviewStatus];

export const AgentSkillSuggestionMatchLevel = {
  Low: "low",
  Medium: "medium",
  High: "high",
} as const;

export type AgentSkillSuggestionMatchLevel =
  (typeof AgentSkillSuggestionMatchLevel)[keyof typeof AgentSkillSuggestionMatchLevel];

export const AgentSkillSuggestionRiskLevel = {
  Low: AutonomyRiskLevel.Low,
  Medium: AutonomyRiskLevel.Medium,
  High: AutonomyRiskLevel.High,
  Critical: AutonomyRiskLevel.Critical,
  Unknown: "unknown",
} as const;

export type AgentSkillSuggestionRiskLevel =
  (typeof AgentSkillSuggestionRiskLevel)[keyof typeof AgentSkillSuggestionRiskLevel];

export type AgentSkillSuggestionExecutionStatus =
  AgentTaskPlanExecutionStatus;

export interface AgentSkillSuggestionPreviewInput {
  planPreview: AgentTaskPlanPreview;
  installedSkills: readonly SkillManifest[];
  autonomyLevel?: AutonomyLevelValue;
  maxSuggestions?: number;
  toolRequirementReview?: AgentToolRequirementReviewPreview;
}

export interface AgentSkillSuggestionPreviewItem {
  skillId?: string;
  skillName: string;
  skillDescription?: string;
  matchScore: number;
  matchLevel: AgentSkillSuggestionMatchLevel;
  matchReasons: readonly string[];
  coveredStepIds: readonly string[];
  coveredStepIndexes: readonly number[];
  coveredStepSummaries: readonly string[];
  requiredToolNames: readonly string[];
  requiredToolCategories: readonly AgentTaskPlanToolCategoryValue[];
  riskLevel: AgentSkillSuggestionRiskLevel;
  requiredAutonomyLevel: AutonomyLevelValue;
  requiresConfirmation: boolean;
  allowedByCurrentAutonomy: boolean;
  executable: false;
  disabledReason: string;
  blockedReason: string;
  safetyNotes: readonly string[];
}

export interface AgentSkillSuggestionPreview {
  previewId: string;
  planPreviewId: string;
  taskSummary: string;
  autonomyLevel: AutonomyLevelValue;
  suggestionStatus: AgentSkillSuggestionPreviewStatus;
  overallRiskLevel: AgentSkillSuggestionRiskLevel;
  executable: false;
  executionStatus: AgentSkillSuggestionExecutionStatus;
  disabledReason: string;
  suggestions: readonly AgentSkillSuggestionPreviewItem[];
  matchedSkillCount: number;
  confirmationRequiredCount: number;
  blockedSuggestionCount: number;
  safetyNotes: readonly string[];
}

interface NormalizedSkill {
  readonly manifest: SkillManifest;
  readonly skillId: string | undefined;
  readonly skillName: string;
  readonly skillDescription: string;
  readonly metadataTags: readonly string[];
  readonly requiredToolNames: readonly string[];
  readonly requiredToolCategories: readonly AgentTaskPlanToolCategoryValue[];
  readonly riskLevel: AgentSkillSuggestionRiskLevel;
  readonly requiredAutonomyLevel: AutonomyLevelValue;
  readonly hasCompletePreviewMetadata: boolean;
}

interface MatchResult {
  readonly skill: NormalizedSkill;
  readonly score: number;
  readonly reasons: readonly string[];
  readonly coveredSteps: readonly CoveredStep[];
}

interface CoveredStep {
  readonly step: AgentTaskPlanStep;
  readonly stepIndex: number;
}

interface PlanSearchIndex {
  readonly planText: string;
  readonly taskTokens: ReadonlySet<string>;
  readonly planTokens: ReadonlySet<string>;
  readonly requiredToolNames: readonly string[];
  readonly requiredToolCategories: readonly AgentTaskPlanToolCategoryValue[];
}

interface SkillSearchIndex {
  readonly skillText: string;
  readonly nameTokens: ReadonlySet<string>;
  readonly descriptionTokens: ReadonlySet<string>;
  readonly metadataTokens: ReadonlySet<string>;
  readonly toolTokens: ReadonlySet<string>;
  readonly allTokens: ReadonlySet<string>;
}

const DEFAULT_MAX_SUGGESTIONS = 5;
const MIN_MATCH_SCORE = 10;

const SKILL_SUGGESTION_DISABLED_REASON =
  "智能体 Skill 建议预览仅用于展示。真实 Skill 执行、Skill 生成、Skill 安装、模型调用、工具、网络访问、数据库访问、持久化、社区访问和智能体运行时执行均已禁用。";

const BLOCKED_REASON = {
  PreviewOnly: "skill_execution_not_enabled",
  PlanPreviewDisabled: "plan_preview_disabled",
  MissingSkillMetadata: "missing_skill_metadata",
  CriticalRiskDisabled: "critical_risk_disabled",
  BlockedByCurrentAutonomy: "blocked_by_current_autonomy",
  ConfirmationRequired: "confirmation_required_before_future_execution",
} as const;

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "be",
  "by",
  "for",
  "from",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "preview",
  "task",
  "the",
  "this",
  "to",
  "tool",
  "tools",
  "user",
  "with",
]);

const PLAN_TOOL_CATEGORY_KEYWORDS: Record<
  AgentTaskPlanToolCategoryValue,
  readonly string[]
> = {
  [AgentTaskPlanToolCategory.FileSystem]: [
    "file",
    "filesystem",
    "folder",
    "directory",
    "path",
    "read",
    "write",
    "edit",
    "save",
  ],
  [AgentTaskPlanToolCategory.Shell]: [
    "shell",
    "terminal",
    "powershell",
    "cmd",
    "command",
    "script",
    "run",
    "execute",
  ],
  [AgentTaskPlanToolCategory.Browser]: [
    "browser",
    "webpage",
    "page",
    "click",
    "navigate",
  ],
  [AgentTaskPlanToolCategory.Network]: [
    "network",
    "web",
    "http",
    "api",
    "fetch",
    "download",
    "upload",
    "publish",
  ],
  [AgentTaskPlanToolCategory.Memory]: [
    "memory",
    "remember",
    "database",
    "db",
    "record",
    "query",
  ],
  [AgentTaskPlanToolCategory.Skill]: [
    "skill",
    "manifest",
    "install",
    "community",
  ],
  [AgentTaskPlanToolCategory.Unknown]: [],
};

export function createAgentSkillSuggestionPreview(
  input: AgentSkillSuggestionPreviewInput,
): AgentSkillSuggestionPreview {
  const autonomyLevel =
    input.autonomyLevel ?? input.planPreview.suggestedAutonomyLevel;
  const normalizedMaxSuggestions = normalizeMaxSuggestions(
    input.maxSuggestions,
  );

  if (!input.planPreview.isValid) {
    return createEmptyPreview({
      input,
      autonomyLevel,
      suggestionStatus: AgentSkillSuggestionPreviewStatus.Disabled,
      executionStatus: AgentTaskPlanExecutionStatus.Disabled,
      disabledReason:
        "来源智能体任务计划预览已禁用，因此 Skill 建议预览不能变为可执行。",
      safetyNotes: [
        "来源计划预览已禁用；不会把任何 Skill 建议视为可执行。",
      ],
    });
  }

  if (input.installedSkills.length === 0) {
    return createEmptyPreview({
      input,
      autonomyLevel,
      suggestionStatus: AgentSkillSuggestionPreviewStatus.NoInstalledSkills,
      executionStatus: AgentTaskPlanExecutionStatus.PreviewOnly,
      disabledReason: SKILL_SUGGESTION_DISABLED_REASON,
      safetyNotes: [
        "未提供已安装 Skill manifest；建议列表保持为空。",
      ],
    });
  }

  const planSearchIndex = createPlanSearchIndex(
    input.planPreview,
    input.toolRequirementReview,
  );
  const suggestions = normalizeSkills(input.installedSkills)
    .map((skill) =>
      createSuggestionMatch({
        skill,
        planPreview: input.planPreview,
        planSearchIndex,
      }),
    )
    .filter((match): match is MatchResult => match !== undefined)
    .filter((match) => match.score >= MIN_MATCH_SCORE)
    .sort(compareMatchResults)
    .slice(0, normalizedMaxSuggestions)
    .map((match) =>
      createSuggestionItem({
        match,
        autonomyLevel,
      }),
    );
  const overallRiskLevel = getOverallRiskLevel(suggestions);
  const confirmationRequiredCount = suggestions.filter(
    (suggestion) => suggestion.requiresConfirmation,
  ).length;
  const blockedSuggestionCount = suggestions.filter(
    (suggestion) => suggestion.blockedReason !== BLOCKED_REASON.PreviewOnly,
  ).length;

  return {
    previewId: createPreviewId(input, autonomyLevel, normalizedMaxSuggestions),
    planPreviewId: input.planPreview.previewId,
    taskSummary: input.planPreview.taskSummary,
    autonomyLevel,
    suggestionStatus:
      suggestions.length === 0
        ? AgentSkillSuggestionPreviewStatus.NoMatchingSkill
        : AgentSkillSuggestionPreviewStatus.PreviewOnly,
    overallRiskLevel,
    executable: false,
    executionStatus: AgentTaskPlanExecutionStatus.PreviewOnly,
    disabledReason: SKILL_SUGGESTION_DISABLED_REASON,
    suggestions,
    matchedSkillCount: suggestions.length,
    confirmationRequiredCount,
    blockedSuggestionCount,
    safetyNotes: createPreviewSafetyNotes({
      input,
      suggestionCount: suggestions.length,
      overallRiskLevel,
    }),
  };
}

function createSuggestionMatch(input: {
  readonly skill: NormalizedSkill;
  readonly planPreview: AgentTaskPlanPreview;
  readonly planSearchIndex: PlanSearchIndex;
}): MatchResult | undefined {
  const skillSearchIndex = createSkillSearchIndex(input.skill);
  const reasons: string[] = [];
  let score = 0;

  const relatedSkillMatch = matchesRelatedSkillId(
    input.skill,
    input.planPreview.relatedSkillIds,
  );

  if (relatedSkillMatch) {
    score += 80;
    reasons.push("Skill ID 或名称出现在计划预览的相关 Skill ID 中。");
  }

  const nameOverlap = getTokenOverlap(
    input.planSearchIndex.taskTokens,
    skillSearchIndex.nameTokens,
  );

  if (nameOverlap.length > 0) {
    score += Math.min(60, nameOverlap.length * 25);
    reasons.push(
      `Skill 名称匹配任务关键词：${nameOverlap.join(", ")}。`,
    );
  }

  const descriptionOverlap = getTokenOverlap(
    input.planSearchIndex.planTokens,
    skillSearchIndex.descriptionTokens,
  );

  if (descriptionOverlap.length > 0) {
    score += Math.min(40, descriptionOverlap.length * 10);
    reasons.push(
      `Skill 描述与计划预览存在重合：${descriptionOverlap
        .slice(0, 5)
        .join(", ")}。`,
    );
  }

  const metadataOverlap = getTokenOverlap(
    input.planSearchIndex.planTokens,
    skillSearchIndex.metadataTokens,
  );

  if (metadataOverlap.length > 0) {
    score += Math.min(35, metadataOverlap.length * 12);
    reasons.push(
      `Skill 元数据标签匹配计划关键词：${metadataOverlap
        .slice(0, 5)
        .join(", ")}。`,
    );
  }

  const toolNameOverlap = getStringOverlap(
    input.planSearchIndex.requiredToolNames,
    input.skill.requiredToolNames,
  );

  if (toolNameOverlap.length > 0) {
    score += Math.min(60, toolNameOverlap.length * 30);
    reasons.push(
      `Skill 所需工具与计划候选工具重合：${toolNameOverlap.join(", ")}。`,
    );
  }

  const toolCategoryOverlap = getStringOverlap(
    input.planSearchIndex.requiredToolCategories,
    input.skill.requiredToolCategories,
  );

  if (toolCategoryOverlap.length > 0) {
    score += Math.min(40, toolCategoryOverlap.length * 20);
    reasons.push(
      `Skill 工具类别与计划需求重合：${toolCategoryOverlap.join(", ")}。`,
    );
  }

  const toolKeywordOverlap = getTokenOverlap(
    input.planSearchIndex.planTokens,
    skillSearchIndex.toolTokens,
  );

  if (toolKeywordOverlap.length > 0) {
    score += Math.min(25, toolKeywordOverlap.length * 8);
    reasons.push(
      `Skill 工具元数据匹配计划关键词：${toolKeywordOverlap
        .slice(0, 5)
        .join(", ")}。`,
    );
  }

  if (score <= 0) {
    return undefined;
  }

  return {
    skill: input.skill,
    score,
    reasons,
    coveredSteps: getCoveredSteps({
      skill: input.skill,
      skillSearchIndex,
      planPreview: input.planPreview,
      planSearchIndex: input.planSearchIndex,
      hasToolCategoryMatch: toolCategoryOverlap.length > 0,
      hasToolNameMatch: toolNameOverlap.length > 0,
    }),
  };
}

function createSuggestionItem(input: {
  readonly match: MatchResult;
  readonly autonomyLevel: AutonomyLevelValue;
}): AgentSkillSuggestionPreviewItem {
  const requiresConfirmation = getRequiresConfirmation({
    skill: input.match.skill,
    autonomyLevel: input.autonomyLevel,
  });
  const allowedByCurrentAutonomy = getAllowedByCurrentAutonomy({
    skill: input.match.skill,
    autonomyLevel: input.autonomyLevel,
    requiresConfirmation,
  });
  const blockedReason = getBlockedReason({
    skill: input.match.skill,
    requiresConfirmation,
    allowedByCurrentAutonomy,
  });
  const item: AgentSkillSuggestionPreviewItem = {
    skillName: input.match.skill.skillName,
    matchScore: input.match.score,
    matchLevel: getMatchLevel(input.match.score),
    matchReasons: input.match.reasons,
    coveredStepIds: input.match.coveredSteps.map((coveredStep) => coveredStep.step.stepId),
    coveredStepIndexes: input.match.coveredSteps.map(
      (coveredStep) => coveredStep.stepIndex,
    ),
    coveredStepSummaries: input.match.coveredSteps.map(
      (coveredStep) => coveredStep.step.description,
    ),
    requiredToolNames: input.match.skill.requiredToolNames,
    requiredToolCategories: input.match.skill.requiredToolCategories,
    riskLevel: input.match.skill.riskLevel,
    requiredAutonomyLevel: input.match.skill.requiredAutonomyLevel,
    requiresConfirmation,
    allowedByCurrentAutonomy,
    executable: false,
    disabledReason: SKILL_SUGGESTION_DISABLED_REASON,
    blockedReason,
    safetyNotes: createSuggestionSafetyNotes({
      skill: input.match.skill,
      requiresConfirmation,
      allowedByCurrentAutonomy,
      blockedReason,
    }),
  };

  if (input.match.skill.skillId !== undefined) {
    item.skillId = input.match.skill.skillId;
  }

  if (input.match.skill.skillDescription.length > 0) {
    item.skillDescription = input.match.skill.skillDescription;
  }

  return item;
}

function createEmptyPreview(input: {
  readonly input: AgentSkillSuggestionPreviewInput;
  readonly autonomyLevel: AutonomyLevelValue;
  readonly suggestionStatus: AgentSkillSuggestionPreviewStatus;
  readonly executionStatus: AgentSkillSuggestionExecutionStatus;
  readonly disabledReason: string;
  readonly safetyNotes: readonly string[];
}): AgentSkillSuggestionPreview {
  return {
    previewId: createPreviewId(
      input.input,
      input.autonomyLevel,
      normalizeMaxSuggestions(input.input.maxSuggestions),
    ),
    planPreviewId: input.input.planPreview.previewId,
    taskSummary: input.input.planPreview.taskSummary,
    autonomyLevel: input.autonomyLevel,
    suggestionStatus: input.suggestionStatus,
    overallRiskLevel: normalizeRiskLevel(input.input.planPreview.estimatedRiskLevel),
    executable: false,
    executionStatus: input.executionStatus,
    disabledReason: input.disabledReason,
    suggestions: [],
    matchedSkillCount: 0,
    confirmationRequiredCount: 0,
    blockedSuggestionCount: 0,
    safetyNotes: [
      "Skill 建议预览是确定性元数据分析，绝不会执行 Skill。",
      ...input.safetyNotes,
    ],
  };
}

function normalizeSkills(
  installedSkills: readonly SkillManifest[],
): NormalizedSkill[] {
  const normalizedSkills: NormalizedSkill[] = [];
  const seen = new Set<string>();

  for (const manifest of installedSkills) {
    const skillName = normalizeDisplayText(manifest.name);
    const skillId = normalizeOptionalText(manifest.id);
    const key = (skillId ?? skillName).toLowerCase();

    if (skillName.length === 0 || seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalizedSkills.push({
      manifest,
      skillId,
      skillName,
      skillDescription: normalizeDisplayText(manifest.description),
      metadataTags: getSkillMetadataTags(manifest.metadata),
      requiredToolNames: normalizeUniqueStrings(
        Array.isArray(manifest.requiredTools)
          ? manifest.requiredTools
              .filter((tool) => isRequiredTool(tool))
              .map((tool) => getSkillToolName(tool))
              .filter((toolName): toolName is string => toolName !== undefined)
          : [],
      ),
      requiredToolCategories: getSkillToolCategories(manifest.requiredTools),
      riskLevel: getSkillSuggestionRiskLevel(manifest),
      requiredAutonomyLevel: normalizeAutonomyLevel(
        manifest.requiredAutonomyLevel,
      ),
      hasCompletePreviewMetadata: hasCompletePreviewMetadata(manifest),
    });
  }

  return normalizedSkills.sort(compareNormalizedSkills);
}

function createPlanSearchIndex(
  planPreview: AgentTaskPlanPreview,
  toolRequirementReview: AgentToolRequirementReviewPreview | undefined,
): PlanSearchIndex {
  const requiredToolNames = normalizeUniqueStrings([
    ...planPreview.requiredToolNames,
    ...(toolRequirementReview?.requirements ?? []).flatMap(
      (requirement) => requirement.candidateToolNames,
    ),
  ]);
  const requiredToolCategories = normalizeUniqueStrings([
    ...planPreview.requiredToolCategories,
    ...(toolRequirementReview?.requirements ?? []).flatMap((requirement) =>
      requirement.requiredToolCategories.map(mapToolRequirementCategory),
    ),
  ]).filter(isPlanToolCategory);
  const planText = normalizeSearchText(
    [
      planPreview.taskSummary,
      ...planPreview.steps.flatMap((step) => [
        step.title,
        step.description,
        step.toolName ?? "",
        step.toolCategory ?? "",
      ]),
      ...requiredToolNames,
      ...requiredToolCategories,
    ].join(" "),
  );

  return {
    planText,
    taskTokens: createTokenSet(planPreview.taskSummary),
    planTokens: createTokenSet(planText),
    requiredToolNames,
    requiredToolCategories,
  };
}

function createSkillSearchIndex(skill: NormalizedSkill): SkillSearchIndex {
  const nameTokens = createTokenSet(skill.skillName);
  const descriptionTokens = createTokenSet(skill.skillDescription);
  const metadataTokens = createTokenSet(skill.metadataTags.join(" "));
  const toolTokens = createTokenSet(
    [...skill.requiredToolNames, ...skill.requiredToolCategories].join(" "),
  );
  const skillText = normalizeSearchText(
    [
      skill.skillId ?? "",
      skill.skillName,
      skill.skillDescription,
      ...skill.metadataTags,
      ...skill.requiredToolNames,
      ...skill.requiredToolCategories,
      ...skill.manifest.requiredTools.flatMap((tool) => [
        tool.reason ?? "",
        tool.riskNote ?? "",
      ]),
    ].join(" "),
  );

  return {
    skillText,
    nameTokens,
    descriptionTokens,
    metadataTokens,
    toolTokens,
    allTokens: createTokenSet(skillText),
  };
}

function getCoveredSteps(input: {
  readonly skill: NormalizedSkill;
  readonly skillSearchIndex: SkillSearchIndex;
  readonly planPreview: AgentTaskPlanPreview;
  readonly planSearchIndex: PlanSearchIndex;
  readonly hasToolCategoryMatch: boolean;
  readonly hasToolNameMatch: boolean;
}): CoveredStep[] {
  const coveredSteps: CoveredStep[] = [];

  input.planPreview.steps.forEach((step, index) => {
    const stepText = normalizeSearchText(
      [
        step.title,
        step.description,
        step.toolName ?? "",
        step.toolCategory ?? "",
      ].join(" "),
    );
    const stepTokens = createTokenSet(stepText);
    const tokenOverlap = getTokenOverlap(stepTokens, input.skillSearchIndex.allTokens);
    const stepToolCategoryMatched =
      step.toolCategory !== undefined &&
      input.skill.requiredToolCategories.includes(step.toolCategory);
    const stepToolNameMatched =
      step.toolName !== undefined &&
      input.skill.requiredToolNames.some(
        (toolName) => normalizeKey(toolName) === normalizeKey(step.toolName ?? ""),
      );

    if (
      tokenOverlap.length > 0 ||
      stepToolCategoryMatched ||
      stepToolNameMatched ||
      (step.requiresTool &&
        (input.hasToolCategoryMatch || input.hasToolNameMatch))
    ) {
      coveredSteps.push({
        step,
        stepIndex: index + 1,
      });
    }
  });

  if (coveredSteps.length > 0) {
    return coveredSteps;
  }

  const fallbackStep =
    input.planPreview.steps.find(
      (step) => step.kind === AgentTaskPlanStepKind.ProposeActions,
    ) ??
    input.planPreview.steps.find((step) => step.requiresTool) ??
    input.planPreview.steps.at(0);

  if (fallbackStep === undefined) {
    return [];
  }

  const fallbackIndex = input.planPreview.steps.indexOf(fallbackStep) + 1;

  return [
    {
      step: fallbackStep,
      stepIndex: fallbackIndex,
    },
  ];
}

function getRequiresConfirmation(input: {
  readonly skill: NormalizedSkill;
  readonly autonomyLevel: AutonomyLevelValue;
}): boolean {
  if (!input.skill.hasCompletePreviewMetadata) {
    return true;
  }

  if (input.skill.riskLevel === AgentSkillSuggestionRiskLevel.Unknown) {
    return true;
  }

  if (isRiskAtLeast(input.skill.riskLevel, AutonomyRiskLevel.Medium)) {
    return true;
  }

  if (input.skill.requiredToolNames.length > 0) {
    return true;
  }

  if (
    !hasRequiredAutonomyLevel(
      input.autonomyLevel,
      input.skill.requiredAutonomyLevel,
    )
  ) {
    return true;
  }

  return false;
}

function getAllowedByCurrentAutonomy(input: {
  readonly skill: NormalizedSkill;
  readonly autonomyLevel: AutonomyLevelValue;
  readonly requiresConfirmation: boolean;
}): boolean {
  if (!input.skill.hasCompletePreviewMetadata) {
    return false;
  }

  if (
    input.skill.riskLevel === AgentSkillSuggestionRiskLevel.Unknown ||
    input.skill.riskLevel === AgentSkillSuggestionRiskLevel.Critical
  ) {
    return false;
  }

  if (input.requiresConfirmation) {
    return false;
  }

  return hasRequiredAutonomyLevel(
    input.autonomyLevel,
    input.skill.requiredAutonomyLevel,
  );
}

function getBlockedReason(input: {
  readonly skill: NormalizedSkill;
  readonly requiresConfirmation: boolean;
  readonly allowedByCurrentAutonomy: boolean;
}): string {
  if (!input.skill.hasCompletePreviewMetadata) {
    return BLOCKED_REASON.MissingSkillMetadata;
  }

  if (input.skill.riskLevel === AgentSkillSuggestionRiskLevel.Critical) {
    return BLOCKED_REASON.CriticalRiskDisabled;
  }

  if (input.skill.riskLevel === AgentSkillSuggestionRiskLevel.Unknown) {
    return BLOCKED_REASON.MissingSkillMetadata;
  }

  if (!input.allowedByCurrentAutonomy && input.requiresConfirmation) {
    return BLOCKED_REASON.ConfirmationRequired;
  }

  if (!input.allowedByCurrentAutonomy) {
    return BLOCKED_REASON.BlockedByCurrentAutonomy;
  }

  return BLOCKED_REASON.PreviewOnly;
}

function createPreviewSafetyNotes(input: {
  readonly input: AgentSkillSuggestionPreviewInput;
  readonly suggestionCount: number;
  readonly overallRiskLevel: AgentSkillSuggestionRiskLevel;
}): string[] {
  const notes = [
    "该预览基于已有智能体任务计划预览和已安装 Skill manifest 做确定性元数据匹配。",
    "所有 Skill 建议仅供参考；不会生成、安装、执行、下载、持久化 Skill，也不会连接社区来源。",
    "所有建议都会保持 executable=false，因为真实 Skill 执行不在当前包级预览边界内。",
  ];

  if (input.suggestionCount === 0) {
    notes.push("没有已安装 Skill manifest 达到保守匹配阈值。");
  }

  if (input.input.toolRequirementReview !== undefined) {
    notes.push("工具需求审查元数据仅作为额外的预览匹配上下文使用。");
  }

  if (input.overallRiskLevel === AgentSkillSuggestionRiskLevel.Unknown) {
    notes.push("至少一个匹配的 Skill 风险元数据未知或不完整，因此按保守方式处理。");
  } else if (
    isRiskAtLeast(input.overallRiskLevel, AutonomyRiskLevel.Critical)
  ) {
    notes.push("严重风险 Skill 建议会被阻断，不能通过自主性等级绕过。");
  } else if (isRiskAtLeast(input.overallRiskLevel, AutonomyRiskLevel.High)) {
    notes.push("高风险 Skill 建议在进入任何未来执行边界前需要确认。");
  }

  return notes;
}

function createSuggestionSafetyNotes(input: {
  readonly skill: NormalizedSkill;
  readonly requiresConfirmation: boolean;
  readonly allowedByCurrentAutonomy: boolean;
  readonly blockedReason: string;
}): string[] {
  const notes = [
    "该 Skill 建议仅为预览；executable 始终为 false。",
    "未来 Skill 执行仍需要单独的运行时、安装状态、权限、工具检查、日志和用户授权。",
  ];

  if (!input.skill.hasCompletePreviewMetadata) {
    notes.push("Skill 元数据不足，无法完成预览审查，因此按保守方式处理。");
  }

  if (input.skill.riskLevel === AgentSkillSuggestionRiskLevel.Unknown) {
    notes.push("未知 Skill 风险需要确认，并且保持阻断，不能自动执行。");
  } else if (
    input.skill.riskLevel === AgentSkillSuggestionRiskLevel.Critical
  ) {
    notes.push("即使自主性等级较高，严重风险也保持阻断。");
  } else if (isRiskAtLeast(input.skill.riskLevel, AutonomyRiskLevel.High)) {
    notes.push("高风险在进入任何未来 Skill 执行边界前需要确认。");
  }

  if (input.requiresConfirmation) {
    notes.push("confirmation_required_before_future_execution");
  }

  if (!input.allowedByCurrentAutonomy) {
    notes.push("当前自主性等级不允许自动执行该 Skill 建议。");
  }

  if (input.skill.manifest.safetyNotes !== undefined) {
    notes.push(...input.skill.manifest.safetyNotes);
  }

  if (input.blockedReason !== BLOCKED_REASON.PreviewOnly) {
    notes.push(`阻断原因：${input.blockedReason}。`);
  }

  return normalizeUniqueStrings(notes);
}

function getOverallRiskLevel(
  suggestions: readonly AgentSkillSuggestionPreviewItem[],
): AgentSkillSuggestionRiskLevel {
  if (suggestions.length === 0) {
    return AgentSkillSuggestionRiskLevel.Low;
  }

  if (
    suggestions.some(
      (suggestion) =>
        suggestion.riskLevel === AgentSkillSuggestionRiskLevel.Unknown,
    )
  ) {
    return AgentSkillSuggestionRiskLevel.Unknown;
  }

  const knownRiskLevels = suggestions
    .map((suggestion) => suggestion.riskLevel)
    .filter(isKnownRiskLevel);

  return (
    maxRiskLevel(...knownRiskLevels) ??
    AgentSkillSuggestionRiskLevel.Low
  );
}

function getMatchLevel(score: number): AgentSkillSuggestionMatchLevel {
  if (score >= 80) {
    return AgentSkillSuggestionMatchLevel.High;
  }

  if (score >= 35) {
    return AgentSkillSuggestionMatchLevel.Medium;
  }

  return AgentSkillSuggestionMatchLevel.Low;
}

function getSkillMetadataTags(
  metadata: SkillMetadata | undefined,
): readonly string[] {
  if (metadata === undefined) {
    return [];
  }

  return normalizeUniqueStrings([
    ...getMetadataStringList(metadata.tags),
    ...getMetadataStringList(metadata.keywords),
    ...getMetadataStringList(metadata.categories),
    ...getMetadataStringList(metadata.category),
  ]);
}

function getMetadataStringList(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  return [];
}

function getSkillToolCategories(
  requiredTools: readonly SkillToolRequirement[] | undefined,
): AgentTaskPlanToolCategoryValue[] {
  const categories = (requiredTools ?? []).flatMap((tool) =>
    inferToolCategoriesFromText(
      [getSkillToolName(tool) ?? "", tool.reason ?? "", tool.riskNote ?? ""].join(
        " ",
      ),
    ),
  );

  return normalizeUniqueStrings(categories).filter(isPlanToolCategory);
}

function inferToolCategoriesFromText(
  text: string,
): AgentTaskPlanToolCategoryValue[] {
  const normalizedText = normalizeSearchText(text);
  const categories: AgentTaskPlanToolCategoryValue[] = [];

  for (const [category, keywords] of Object.entries(PLAN_TOOL_CATEGORY_KEYWORDS)) {
    if (
      keywords.some((keyword) =>
        normalizedText.includes(normalizeSearchText(keyword)),
      )
    ) {
      categories.push(category as AgentTaskPlanToolCategoryValue);
    }
  }

  return categories.length > 0
    ? categories
    : [AgentTaskPlanToolCategory.Unknown];
}

function normalizeRiskLevel(value: unknown): AgentSkillSuggestionRiskLevel {
  if (
    value === SkillRiskLevel.Low ||
    value === SkillRiskLevel.Medium ||
    value === SkillRiskLevel.High ||
    value === SkillRiskLevel.Critical
  ) {
    return value;
  }

  return AgentSkillSuggestionRiskLevel.Unknown;
}

function normalizeOptionalRiskLevel(
  value: unknown,
): AgentSkillSuggestionRiskLevel | undefined {
  if (value === undefined) {
    return undefined;
  }

  return normalizeRiskLevel(value);
}

function getSkillSuggestionRiskLevel(
  manifest: SkillManifest,
): AgentSkillSuggestionRiskLevel {
  const manifestRiskLevel = normalizeRiskLevel(manifest.riskLevel);
  const toolRiskLevels = (manifest.requiredTools ?? [])
    .map((tool) => normalizeOptionalRiskLevel(tool.riskLevel))
    .filter((riskLevel): riskLevel is AgentSkillSuggestionRiskLevel =>
      riskLevel !== undefined,
    );

  if (
    manifestRiskLevel === AgentSkillSuggestionRiskLevel.Unknown ||
    toolRiskLevels.includes(AgentSkillSuggestionRiskLevel.Unknown)
  ) {
    return AgentSkillSuggestionRiskLevel.Unknown;
  }

  const knownRiskLevels = [manifestRiskLevel, ...toolRiskLevels].filter(
    isKnownRiskLevel,
  );

  return (
    maxRiskLevel(...knownRiskLevels) ?? AgentSkillSuggestionRiskLevel.Unknown
  );
}

function normalizeAutonomyLevel(value: unknown): AutonomyLevelValue {
  if (
    value === AutonomyLevel.Manual ||
    value === AutonomyLevel.ConfirmTools ||
    value === AutonomyLevel.Supervised ||
    value === AutonomyLevel.Autonomous
  ) {
    return value;
  }

  return AutonomyLevel.ConfirmTools;
}

function hasCompletePreviewMetadata(manifest: SkillManifest): boolean {
  return (
    normalizeDisplayText(manifest.name).length > 0 &&
    normalizeDisplayText(manifest.description).length > 0 &&
    normalizeRiskLevel(manifest.riskLevel) !==
      AgentSkillSuggestionRiskLevel.Unknown &&
    normalizeAutonomyLevel(manifest.requiredAutonomyLevel) ===
      manifest.requiredAutonomyLevel &&
    Array.isArray(manifest.requiredTools) &&
    manifest.requiredTools.every((tool) => {
      const toolName = getSkillToolName(tool);

      return toolName !== undefined && toolName.length > 0;
    })
  );
}

function mapToolRequirementCategory(
  category: AgentToolRequirementCategory,
): AgentTaskPlanToolCategoryValue {
  if (category.includes("file")) {
    return AgentTaskPlanToolCategory.FileSystem;
  }

  if (category.includes("shell")) {
    return AgentTaskPlanToolCategory.Shell;
  }

  if (category.includes("web")) {
    return AgentTaskPlanToolCategory.Network;
  }

  if (category.includes("database")) {
    return AgentTaskPlanToolCategory.Memory;
  }

  if (category.includes("skill")) {
    return AgentTaskPlanToolCategory.Skill;
  }

  return AgentTaskPlanToolCategory.Unknown;
}

function matchesRelatedSkillId(
  skill: NormalizedSkill,
  relatedSkillIds: readonly string[],
): boolean {
  const relatedKeys = new Set(relatedSkillIds.map(normalizeKey));

  return (
    (skill.skillId !== undefined && relatedKeys.has(normalizeKey(skill.skillId))) ||
    relatedKeys.has(normalizeKey(skill.skillName))
  );
}

function getTokenOverlap(
  left: ReadonlySet<string>,
  right: ReadonlySet<string>,
): string[] {
  return [...left]
    .filter((token) => right.has(token))
    .sort((a, b) => a.localeCompare(b));
}

function getStringOverlap(
  left: readonly string[],
  right: readonly string[],
): string[] {
  const rightKeys = new Set(right.map(normalizeKey));

  return left
    .filter((value) => rightKeys.has(normalizeKey(value)))
    .sort((a, b) => normalizeKey(a).localeCompare(normalizeKey(b)));
}

function createTokenSet(value: string): ReadonlySet<string> {
  const tokens = normalizeSearchText(value).match(/[\p{L}\p{N}_-]+/gu) ?? [];

  return new Set(
    tokens.filter((token) => {
      if (STOP_WORDS.has(token)) {
        return false;
      }

      return token.length >= 3 || token === "ai" || token === "db";
    }),
  );
}

function normalizeSearchText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeDisplayText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = normalizeDisplayText(value);

  return normalized.length > 0 ? normalized : undefined;
}

function normalizeUniqueStrings(values: readonly string[]): string[] {
  const normalizedValues: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const normalized = normalizeDisplayText(value);
    const key = normalizeKey(normalized);

    if (normalized.length > 0 && !seen.has(key)) {
      seen.add(key);
      normalizedValues.push(normalized);
    }
  }

  return normalizedValues.sort((left, right) =>
    normalizeKey(left).localeCompare(normalizeKey(right)),
  );
}

function normalizeKey(value: string): string {
  return normalizeSearchText(value);
}

function isPlanToolCategory(
  value: string,
): value is AgentTaskPlanToolCategoryValue {
  return Object.values(AgentTaskPlanToolCategory).includes(
    value as AgentTaskPlanToolCategoryValue,
  );
}

function isKnownRiskLevel(
  value: AgentSkillSuggestionRiskLevel,
): value is Exclude<
  AgentSkillSuggestionRiskLevel,
  typeof AgentSkillSuggestionRiskLevel.Unknown
> {
  return value !== AgentSkillSuggestionRiskLevel.Unknown;
}

function normalizeMaxSuggestions(maxSuggestions: number | undefined): number {
  if (maxSuggestions === undefined || !Number.isFinite(maxSuggestions)) {
    return DEFAULT_MAX_SUGGESTIONS;
  }

  return Math.max(1, Math.floor(maxSuggestions));
}

function compareMatchResults(left: MatchResult, right: MatchResult): number {
  const scoreDifference = right.score - left.score;

  if (scoreDifference !== 0) {
    return scoreDifference;
  }

  return compareNormalizedSkills(left.skill, right.skill);
}

function compareNormalizedSkills(
  left: NormalizedSkill,
  right: NormalizedSkill,
): number {
  return normalizeKey(left.skillName).localeCompare(normalizeKey(right.skillName));
}

function createPreviewId(
  input: AgentSkillSuggestionPreviewInput,
  autonomyLevel: AutonomyLevelValue,
  maxSuggestions: number,
): string {
  const stableParts = [
    input.planPreview.previewId,
    input.planPreview.taskSummary,
    autonomyLevel,
    maxSuggestions.toString(),
    ...(input.toolRequirementReview?.requirements ?? []).flatMap(
      (requirement) => [
        ...requirement.requiredToolCategories,
        ...requirement.candidateToolNames,
      ],
    ),
    ...normalizeSkills(input.installedSkills).flatMap((skill) => [
      skill.skillId ?? "",
      skill.skillName,
      skill.skillDescription,
      skill.riskLevel,
      skill.requiredAutonomyLevel,
      ...skill.requiredToolNames,
      ...skill.metadataTags,
    ]),
  ];

  return `skill_suggestion_preview_${hashString(stableParts.join("|"))}`;
}

function hashString(value: string): string {
  let hash = 2_166_136_261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619) >>> 0;
  }

  return hash.toString(36).padStart(7, "0");
}
