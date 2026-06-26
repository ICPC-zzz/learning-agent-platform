import {
  AutonomyLevel,
  AutonomyRiskLevel,
  type AutonomyLevel as AutonomyLevelValue,
  type AutonomyRiskLevel as RiskLevel,
} from "../autonomy/types";
import { compareRiskLevel, isRiskAtLeast, maxRiskLevel } from "../autonomy/risk";
import {
  AgentTaskPlanExecutionStatus,
  type AgentTaskPlanExecutionStatus as AgentTaskPlanExecutionStatusValue,
  type AgentTaskPlanPreview,
} from "./plan-preview";
import {
  AgentMemoryContextStatus,
  type AgentMemoryContextPreview,
  type AgentMemoryContextStatus as AgentMemoryContextStatusValue,
} from "./memory-context-preview";
import {
  AgentSkillSuggestionPreviewStatus,
  AgentSkillSuggestionRiskLevel,
  type AgentSkillSuggestionPreview,
  type AgentSkillSuggestionPreviewStatus as AgentSkillSuggestionPreviewStatusValue,
} from "./skill-suggestion-preview";
import {
  AgentToolRequirementReviewStatus,
  type AgentToolRequirementPreviewItem,
  type AgentToolRequirementReviewPreview,
  type AgentToolRequirementReviewStatus as AgentToolRequirementReviewStatusValue,
} from "./tool-requirement-review-preview";

export const AgentExecutionReadinessStatus = {
  PreviewOnly: "preview_only",
  NotReady: "not_ready",
  Blocked: "blocked",
  NeedsConfirmation: "needs_confirmation",
  ReadyForFutureManualReview: "ready_for_future_manual_review",
} as const;

export type AgentExecutionReadinessStatus =
  (typeof AgentExecutionReadinessStatus)[keyof typeof AgentExecutionReadinessStatus];

export type AgentExecutionReadinessExecutionStatus =
  AgentTaskPlanExecutionStatusValue;

export const AgentExecutionReadinessCheckStatus = {
  Pass: "pass",
  Warning: "warning",
  Blocked: "blocked",
  NotApplicable: "not_applicable",
} as const;

export type AgentExecutionReadinessCheckStatus =
  (typeof AgentExecutionReadinessCheckStatus)[keyof typeof AgentExecutionReadinessCheckStatus];

export const AgentExecutionReadinessSource = {
  Plan: "plan",
  Tools: "tools",
  Skills: "skills",
  Memory: "memory",
  Autonomy: "autonomy",
  Risk: "risk",
  Safety: "safety",
} as const;

export type AgentExecutionReadinessSource =
  (typeof AgentExecutionReadinessSource)[keyof typeof AgentExecutionReadinessSource];

export const AgentExecutionReadinessBlockerSeverity = {
  Medium: "medium",
  High: "high",
  Critical: "critical",
} as const;

export type AgentExecutionReadinessBlockerSeverity =
  (typeof AgentExecutionReadinessBlockerSeverity)[keyof typeof AgentExecutionReadinessBlockerSeverity];

export const AgentExecutionReadinessRiskLevel = {
  Low: AutonomyRiskLevel.Low,
  Medium: AutonomyRiskLevel.Medium,
  High: AutonomyRiskLevel.High,
  Critical: AutonomyRiskLevel.Critical,
  Unknown: "unknown",
} as const;

export type AgentExecutionReadinessRiskLevel =
  (typeof AgentExecutionReadinessRiskLevel)[keyof typeof AgentExecutionReadinessRiskLevel];

export interface AgentExecutionReadinessOptions {
  strictMode?: boolean;
  requireMemoryContext?: boolean;
  requireSkillSuggestion?: boolean;
  allowHighRiskPreview?: boolean;
  maxAllowedRiskLevel?: RiskLevel;
  requireAllToolRequirementsResolvable?: boolean;
}

export interface AgentExecutionReadinessInput {
  planPreview: AgentTaskPlanPreview | undefined;
  toolRequirementReview: AgentToolRequirementReviewPreview | undefined;
  skillSuggestionPreview: AgentSkillSuggestionPreview | undefined;
  memoryContextPreview: AgentMemoryContextPreview | undefined;
  autonomyLevel: AutonomyLevelValue;
  options?: AgentExecutionReadinessOptions;
}

export interface AgentExecutionReadinessCheck {
  id: string;
  label: string;
  status: AgentExecutionReadinessCheckStatus;
  reason: string;
  source: AgentExecutionReadinessSource;
}

export interface AgentExecutionReadinessBlocker {
  code: string;
  message: string;
  source: AgentExecutionReadinessSource;
  severity: AgentExecutionReadinessBlockerSeverity;
  relatedStepIds?: readonly string[];
  relatedStepIndexes?: readonly number[];
  relatedToolNames?: readonly string[];
  relatedSkillNames?: readonly string[];
}

export interface AgentExecutionReadinessWarning {
  code: string;
  message: string;
  source: AgentExecutionReadinessSource;
  relatedStepIds?: readonly string[];
  relatedStepIndexes?: readonly number[];
}

export interface AgentExecutionMissingRequirement {
  code: string;
  message: string;
  source: AgentExecutionReadinessSource;
  required: boolean;
  relatedStepIds?: readonly string[];
  relatedStepIndexes?: readonly number[];
  relatedToolNames?: readonly string[];
  relatedSkillNames?: readonly string[];
}

export interface AgentExecutionPlanReadinessSummary {
  previewId?: string;
  taskSummary: string;
  isValid: boolean;
  stepCount: number;
  estimatedRiskLevel?: RiskLevel;
  requiresConfirmation: boolean;
  executable: false;
  executionStatus: AgentExecutionReadinessExecutionStatus;
  disabledReason?: string;
}

export interface AgentExecutionToolReadinessSummary {
  reviewStatus?: AgentToolRequirementReviewStatusValue;
  requirementCount: number;
  blockedRequirementCount: number;
  confirmationRequiredCount: number;
  unresolvedRequirementCount: number;
  requiredToolNames: readonly string[];
  missingToolRequirementCount: number;
  executable: false;
  executionStatus: AgentExecutionReadinessExecutionStatus;
  disabledReason?: string;
}

export interface AgentExecutionSkillReadinessSummary {
  suggestionStatus?: AgentSkillSuggestionPreviewStatusValue;
  matchedSkillCount: number;
  blockedSuggestionCount: number;
  confirmationRequiredCount: number;
  candidateSkillNames: readonly string[];
  noMatchingSkill: boolean;
  executable: false;
  executionStatus: AgentExecutionReadinessExecutionStatus;
  disabledReason?: string;
}

export interface AgentExecutionMemoryReadinessSummary {
  contextStatus?: AgentMemoryContextStatusValue;
  candidateMemoryCount: number;
  selectedMemoryCount: number;
  contextBlockCount: number;
  requireMemoryContext: boolean;
  retrievalExecuted: false;
  embeddingUsed: false;
  llmUsed: false;
  executable: false;
  executionStatus: AgentExecutionReadinessExecutionStatus;
  disabledReason?: string;
}

export interface AgentExecutionRiskSummary {
  overallRiskLevel: AgentExecutionReadinessRiskLevel;
  planRiskLevel?: RiskLevel;
  toolRiskLevel?: RiskLevel;
  skillRiskLevel?: AgentExecutionReadinessRiskLevel;
  maxAllowedRiskLevel?: RiskLevel;
  criticalRiskDetected: boolean;
  highRiskDetected: boolean;
  unknownRiskDetected: boolean;
  riskReasons: readonly string[];
}

export interface AgentExecutionReadinessPreview {
  previewId: string;
  readinessStatus: AgentExecutionReadinessStatus;
  executable: false;
  realExecutionEnabled: false;
  executionStatus: AgentExecutionReadinessExecutionStatus;
  taskSummary: string;
  autonomyLevel: AutonomyLevelValue;
  overallRiskLevel: AgentExecutionReadinessRiskLevel;
  allowedByCurrentAutonomy: boolean;
  requiresConfirmation: boolean;
  confirmationReasons: readonly string[];
  blockers: readonly AgentExecutionReadinessBlocker[];
  warnings: readonly AgentExecutionReadinessWarning[];
  missingRequirements: readonly AgentExecutionMissingRequirement[];
  readyChecks: readonly AgentExecutionReadinessCheck[];
  planReadiness: AgentExecutionPlanReadinessSummary;
  toolReadiness: AgentExecutionToolReadinessSummary;
  skillReadiness: AgentExecutionSkillReadinessSummary;
  memoryReadiness: AgentExecutionMemoryReadinessSummary;
  riskSummary: AgentExecutionRiskSummary;
  safetyNotes: readonly string[];
  recommendedNextActions: readonly string[];
  toolsExecuted: false;
  llmCalled: false;
  networkUsed: false;
  memoryRetrievalExecuted: false;
  dataSaved: false;
}

interface NormalizedOptions {
  readonly strictMode: boolean;
  readonly requireMemoryContext: boolean;
  readonly requireSkillSuggestion: boolean;
  readonly allowHighRiskPreview: boolean;
  readonly maxAllowedRiskLevel: RiskLevel | undefined;
  readonly requireAllToolRequirementsResolvable: boolean;
}

interface CollectionResult {
  readonly blockers: readonly AgentExecutionReadinessBlocker[];
  readonly warnings: readonly AgentExecutionReadinessWarning[];
  readonly missingRequirements: readonly AgentExecutionMissingRequirement[];
  readonly confirmationReasons: readonly string[];
}

const EXECUTION_READINESS_DISABLED_REASON =
  "智能体执行就绪预览仅为预览。真实智能体执行、工具、模型调用、网络访问、MemoryStore.search、embedding、Skill、数据库访问和持久化均已禁用。";

const TOOL_BLOCKED_REASON = {
  PreviewOnly: "preview_only_execution_disabled",
  NoAvailableToolForRequiredCategory: "no_available_tool_for_required_category",
  CandidateToolDisabled: "candidate_tool_disabled",
} as const;

export function createAgentExecutionReadinessPreview(
  input: AgentExecutionReadinessInput,
): AgentExecutionReadinessPreview {
  const options = normalizeOptions(input.options);
  const planReadiness = createPlanReadiness(input.planPreview);
  const toolReadiness = createToolReadiness(input.toolRequirementReview);
  const skillReadiness = createSkillReadiness(input.skillSuggestionPreview);
  const memoryReadiness = createMemoryReadiness(
    input.memoryContextPreview,
    options,
  );
  const riskSummary = createRiskSummary({
    planPreview: input.planPreview,
    toolRequirementReview: input.toolRequirementReview,
    skillSuggestionPreview: input.skillSuggestionPreview,
    options,
  });
  const collection = collectReadinessFindings({
    input,
    options,
    riskSummary,
    planReadiness,
    toolReadiness,
    skillReadiness,
    memoryReadiness,
  });
  const requiresConfirmation = collection.confirmationReasons.length > 0;
  const allowedByCurrentAutonomy = isAllowedByCurrentAutonomy({
    autonomyLevel: input.autonomyLevel,
    overallRiskLevel: riskSummary.overallRiskLevel,
    requiresConfirmation,
    blockerCount: collection.blockers.length,
    toolRequirementReview: input.toolRequirementReview,
    skillSuggestionPreview: input.skillSuggestionPreview,
    planPreview: input.planPreview,
  });
  const readyChecks = createReadyChecks({
    planReadiness,
    toolReadiness,
    skillReadiness,
    memoryReadiness,
    riskSummary,
    allowedByCurrentAutonomy,
    requiresConfirmation,
    blockerCount: collection.blockers.length,
  });
  const readinessStatus = getReadinessStatus({
    blockers: collection.blockers,
    requiresConfirmation,
  });

  return {
    previewId: createPreviewId(input, options, riskSummary.overallRiskLevel),
    readinessStatus,
    executable: false,
    realExecutionEnabled: false,
    executionStatus: getExecutionStatus(readinessStatus),
    taskSummary: planReadiness.taskSummary,
    autonomyLevel: input.autonomyLevel,
    overallRiskLevel: riskSummary.overallRiskLevel,
    allowedByCurrentAutonomy,
    requiresConfirmation,
    confirmationReasons: collection.confirmationReasons,
    blockers: collection.blockers,
    warnings: collection.warnings,
    missingRequirements: collection.missingRequirements,
    readyChecks,
    planReadiness,
    toolReadiness,
    skillReadiness,
    memoryReadiness,
    riskSummary,
    safetyNotes: createSafetyNotes(),
    recommendedNextActions: createRecommendedNextActions({
      readinessStatus,
      blockers: collection.blockers,
      warnings: collection.warnings,
      missingRequirements: collection.missingRequirements,
      riskSummary,
      requiresConfirmation,
    }),
    toolsExecuted: false,
    llmCalled: false,
    networkUsed: false,
    memoryRetrievalExecuted: false,
    dataSaved: false,
  };
}

function createPlanReadiness(
  planPreview: AgentTaskPlanPreview | undefined,
): AgentExecutionPlanReadinessSummary {
  if (planPreview === undefined) {
    return {
      taskSummary: "未提供任务计划预览。",
      isValid: false,
      stepCount: 0,
      requiresConfirmation: false,
      executable: false,
      executionStatus: AgentTaskPlanExecutionStatus.Disabled,
      disabledReason: "缺少智能体任务计划预览。",
    };
  }

  return {
    previewId: planPreview.previewId,
    taskSummary: planPreview.taskSummary,
    isValid: planPreview.isValid,
    stepCount: planPreview.steps.length,
    estimatedRiskLevel: planPreview.estimatedRiskLevel,
    requiresConfirmation: planPreview.requiresConfirmation,
    executable: false,
    executionStatus: planPreview.executionStatus,
    disabledReason: planPreview.disabledReason,
  };
}

function createToolReadiness(
  toolRequirementReview: AgentToolRequirementReviewPreview | undefined,
): AgentExecutionToolReadinessSummary {
  if (toolRequirementReview === undefined) {
    return {
      requirementCount: 0,
      blockedRequirementCount: 0,
      confirmationRequiredCount: 0,
      unresolvedRequirementCount: 0,
      requiredToolNames: [],
      missingToolRequirementCount: 0,
      executable: false,
      executionStatus: AgentTaskPlanExecutionStatus.Disabled,
      disabledReason: "缺少智能体工具需求审查预览。",
    };
  }

  const unresolvedRequirements = toolRequirementReview.requirements.filter(
    isUnresolvedToolRequirement,
  );
  const requiredToolNames = normalizeUniqueStrings(
    toolRequirementReview.requirements.flatMap(
      (requirement) => requirement.candidateToolNames,
    ),
  );

  return {
    reviewStatus: toolRequirementReview.reviewStatus,
    requirementCount: toolRequirementReview.requirements.length,
    blockedRequirementCount: toolRequirementReview.blockedRequirementCount,
    confirmationRequiredCount:
      toolRequirementReview.confirmationRequiredCount,
    unresolvedRequirementCount: unresolvedRequirements.length,
    requiredToolNames,
    missingToolRequirementCount: toolRequirementReview.requirements.filter(
      (requirement) => requirement.candidateToolNames.length === 0,
    ).length,
    executable: false,
    executionStatus: toolRequirementReview.executionStatus,
    disabledReason: toolRequirementReview.disabledReason,
  };
}

function createSkillReadiness(
  skillSuggestionPreview: AgentSkillSuggestionPreview | undefined,
): AgentExecutionSkillReadinessSummary {
  if (skillSuggestionPreview === undefined) {
    return {
      matchedSkillCount: 0,
      blockedSuggestionCount: 0,
      confirmationRequiredCount: 0,
      candidateSkillNames: [],
      noMatchingSkill: true,
      executable: false,
      executionStatus: AgentTaskPlanExecutionStatus.Disabled,
      disabledReason: "缺少智能体 Skill 建议预览。",
    };
  }

  return {
    suggestionStatus: skillSuggestionPreview.suggestionStatus,
    matchedSkillCount: skillSuggestionPreview.matchedSkillCount,
    blockedSuggestionCount: skillSuggestionPreview.blockedSuggestionCount,
    confirmationRequiredCount:
      skillSuggestionPreview.confirmationRequiredCount,
    candidateSkillNames: normalizeUniqueStrings(
      skillSuggestionPreview.suggestions.map(
        (suggestion) => suggestion.skillName,
      ),
    ),
    noMatchingSkill:
      skillSuggestionPreview.suggestionStatus ===
        AgentSkillSuggestionPreviewStatus.NoInstalledSkills ||
      skillSuggestionPreview.suggestionStatus ===
        AgentSkillSuggestionPreviewStatus.NoMatchingSkill,
    executable: false,
    executionStatus: skillSuggestionPreview.executionStatus,
    disabledReason: skillSuggestionPreview.disabledReason,
  };
}

function createMemoryReadiness(
  memoryContextPreview: AgentMemoryContextPreview | undefined,
  options: NormalizedOptions,
): AgentExecutionMemoryReadinessSummary {
  if (memoryContextPreview === undefined) {
    return {
      candidateMemoryCount: 0,
      selectedMemoryCount: 0,
      contextBlockCount: 0,
      requireMemoryContext: options.requireMemoryContext,
      retrievalExecuted: false,
      embeddingUsed: false,
      llmUsed: false,
      executable: false,
      executionStatus: AgentTaskPlanExecutionStatus.Disabled,
      disabledReason: "缺少智能体记忆上下文预览。",
    };
  }

  return {
    contextStatus: memoryContextPreview.contextStatus,
    candidateMemoryCount: memoryContextPreview.candidateMemoryCount,
    selectedMemoryCount: memoryContextPreview.selectedMemoryCount,
    contextBlockCount: memoryContextPreview.contextBlocks.length,
    requireMemoryContext: options.requireMemoryContext,
    retrievalExecuted: false,
    embeddingUsed: false,
    llmUsed: false,
    executable: false,
    executionStatus: memoryContextPreview.executionStatus,
    disabledReason: memoryContextPreview.disabledReason,
  };
}

function createRiskSummary(input: {
  readonly planPreview: AgentTaskPlanPreview | undefined;
  readonly toolRequirementReview: AgentToolRequirementReviewPreview | undefined;
  readonly skillSuggestionPreview: AgentSkillSuggestionPreview | undefined;
  readonly options: NormalizedOptions;
}): AgentExecutionRiskSummary {
  const skillRiskLevel = normalizeSkillRiskLevel(
    input.skillSuggestionPreview?.overallRiskLevel,
  );
  const unknownRiskDetected =
    skillRiskLevel === AgentExecutionReadinessRiskLevel.Unknown;
  const knownRiskLevels = [
    input.planPreview?.estimatedRiskLevel,
    input.toolRequirementReview?.overallRiskLevel,
    isKnownReadinessRiskLevel(skillRiskLevel) ? skillRiskLevel : undefined,
  ];
  const highestKnownRisk =
    maxRiskLevel(...knownRiskLevels) ?? AutonomyRiskLevel.Low;
  const overallRiskLevel = unknownRiskDetected
    ? AgentExecutionReadinessRiskLevel.Unknown
    : highestKnownRisk;
  const criticalRiskDetected =
    overallRiskLevel === AgentExecutionReadinessRiskLevel.Critical;
  const highRiskDetected =
    overallRiskLevel !== AgentExecutionReadinessRiskLevel.Unknown &&
    isRiskAtLeast(overallRiskLevel, AutonomyRiskLevel.High);
  const riskReasons = createRiskReasons({
    planRiskLevel: input.planPreview?.estimatedRiskLevel,
    toolRiskLevel: input.toolRequirementReview?.overallRiskLevel,
    skillRiskLevel,
    overallRiskLevel,
    maxAllowedRiskLevel: input.options.maxAllowedRiskLevel,
  });
  const summary: AgentExecutionRiskSummary = {
    overallRiskLevel,
    criticalRiskDetected,
    highRiskDetected,
    unknownRiskDetected,
    riskReasons,
  };

  if (input.planPreview?.estimatedRiskLevel !== undefined) {
    summary.planRiskLevel = input.planPreview.estimatedRiskLevel;
  }

  if (input.toolRequirementReview?.overallRiskLevel !== undefined) {
    summary.toolRiskLevel = input.toolRequirementReview.overallRiskLevel;
  }

  if (skillRiskLevel !== undefined) {
    summary.skillRiskLevel = skillRiskLevel;
  }

  if (input.options.maxAllowedRiskLevel !== undefined) {
    summary.maxAllowedRiskLevel = input.options.maxAllowedRiskLevel;
  }

  return summary;
}

function collectReadinessFindings(input: {
  readonly input: AgentExecutionReadinessInput;
  readonly options: NormalizedOptions;
  readonly riskSummary: AgentExecutionRiskSummary;
  readonly planReadiness: AgentExecutionPlanReadinessSummary;
  readonly toolReadiness: AgentExecutionToolReadinessSummary;
  readonly skillReadiness: AgentExecutionSkillReadinessSummary;
  readonly memoryReadiness: AgentExecutionMemoryReadinessSummary;
}): CollectionResult {
  const blockers: AgentExecutionReadinessBlocker[] = [];
  const warnings: AgentExecutionReadinessWarning[] = [];
  const missingRequirements: AgentExecutionMissingRequirement[] = [];
  const confirmationReasons: string[] = [];

  collectMissingPreviewInputs({
    input: input.input,
    blockers,
    missingRequirements,
  });
  collectPlanFindings({
    planPreview: input.input.planPreview,
    planReadiness: input.planReadiness,
    options: input.options,
    blockers,
    warnings,
    missingRequirements,
    confirmationReasons,
  });
  collectToolFindings({
    planPreview: input.input.planPreview,
    toolRequirementReview: input.input.toolRequirementReview,
    options: input.options,
    blockers,
    warnings,
    missingRequirements,
    confirmationReasons,
  });
  collectSkillFindings({
    skillSuggestionPreview: input.input.skillSuggestionPreview,
    options: input.options,
    blockers,
    warnings,
    missingRequirements,
    confirmationReasons,
  });
  collectMemoryFindings({
    memoryContextPreview: input.input.memoryContextPreview,
    options: input.options,
    blockers,
    warnings,
    missingRequirements,
  });
  collectRiskFindings({
    riskSummary: input.riskSummary,
    options: input.options,
    blockers,
    warnings,
    confirmationReasons,
  });

  return {
    blockers,
    warnings,
    missingRequirements,
    confirmationReasons: normalizeUniqueStrings(confirmationReasons),
  };
}

function collectMissingPreviewInputs(input: {
  readonly input: AgentExecutionReadinessInput;
  readonly blockers: AgentExecutionReadinessBlocker[];
  readonly missingRequirements: AgentExecutionMissingRequirement[];
}): void {
  appendMissingPreviewInput({
    previewName: "智能体任务计划预览",
    code: "missing_plan_preview",
    source: AgentExecutionReadinessSource.Plan,
    isMissing: input.input.planPreview === undefined,
    blockers: input.blockers,
    missingRequirements: input.missingRequirements,
  });
  appendMissingPreviewInput({
    previewName: "智能体工具需求审查预览",
    code: "missing_tool_requirement_review",
    source: AgentExecutionReadinessSource.Tools,
    isMissing: input.input.toolRequirementReview === undefined,
    blockers: input.blockers,
    missingRequirements: input.missingRequirements,
  });
  appendMissingPreviewInput({
    previewName: "智能体 Skill 建议预览",
    code: "missing_skill_suggestion_preview",
    source: AgentExecutionReadinessSource.Skills,
    isMissing: input.input.skillSuggestionPreview === undefined,
    blockers: input.blockers,
    missingRequirements: input.missingRequirements,
  });
  appendMissingPreviewInput({
    previewName: "智能体记忆上下文预览",
    code: "missing_memory_context_preview",
    source: AgentExecutionReadinessSource.Memory,
    isMissing: input.input.memoryContextPreview === undefined,
    blockers: input.blockers,
    missingRequirements: input.missingRequirements,
  });
}

function collectPlanFindings(input: {
  readonly planPreview: AgentTaskPlanPreview | undefined;
  readonly planReadiness: AgentExecutionPlanReadinessSummary;
  readonly options: NormalizedOptions;
  readonly blockers: AgentExecutionReadinessBlocker[];
  readonly warnings: AgentExecutionReadinessWarning[];
  readonly missingRequirements: AgentExecutionMissingRequirement[];
  readonly confirmationReasons: string[];
}): void {
  const planPreview = input.planPreview;

  if (planPreview === undefined) {
    return;
  }

  if (!planPreview.isValid) {
    input.blockers.push({
      code: "plan_preview_disabled",
      message:
        "来源智能体任务计划预览无效或已禁用，因此无法继续执行就绪检查。",
      source: AgentExecutionReadinessSource.Plan,
      severity: AgentExecutionReadinessBlockerSeverity.Medium,
    });
  }

  if (planPreview.steps.length === 0) {
    input.blockers.push({
      code: "plan_has_no_steps",
      message:
        "任务计划预览没有步骤，因此没有可审查的未来执行路径。",
      source: AgentExecutionReadinessSource.Plan,
      severity: AgentExecutionReadinessBlockerSeverity.Medium,
    });
    input.missingRequirements.push({
      code: "missing_plan_steps",
      message: "请先添加确定性的计划预览步骤，再进行就绪审查。",
      source: AgentExecutionReadinessSource.Plan,
      required: true,
    });
  }

  if (planPreview.requiresConfirmation) {
    input.confirmationReasons.push(
      "任务计划预览在进入任何未来执行边界前需要用户确认。",
    );
  }

  if (input.options.strictMode && input.planReadiness.stepCount < 2) {
    input.blockers.push({
      code: "strict_mode_plan_incomplete",
      message:
        "严格模式要求更完整的任务计划预览，就绪检查才能通过。",
      source: AgentExecutionReadinessSource.Plan,
      severity: AgentExecutionReadinessBlockerSeverity.Medium,
    });
  }
}

function collectToolFindings(input: {
  readonly planPreview: AgentTaskPlanPreview | undefined;
  readonly toolRequirementReview: AgentToolRequirementReviewPreview | undefined;
  readonly options: NormalizedOptions;
  readonly blockers: AgentExecutionReadinessBlocker[];
  readonly warnings: AgentExecutionReadinessWarning[];
  readonly missingRequirements: AgentExecutionMissingRequirement[];
  readonly confirmationReasons: string[];
}): void {
  const toolRequirementReview = input.toolRequirementReview;

  if (toolRequirementReview === undefined) {
    return;
  }

  if (
    (input.planPreview?.requiredToolCategories.length ?? 0) > 0 &&
    toolRequirementReview.requirements.length === 0
  ) {
    input.missingRequirements.push({
      code: "missing_tool_requirement_items",
      message:
        "任务计划预览需要工具类别，但工具需求审查没有需求项。",
      source: AgentExecutionReadinessSource.Tools,
      required: true,
    });
    input.blockers.push({
      code: "required_tool_review_items_missing",
      message:
        "必须先审查工具需求并映射到候选工具，之后才能考虑未来执行。",
      source: AgentExecutionReadinessSource.Tools,
      severity: AgentExecutionReadinessBlockerSeverity.High,
    });
  }

  if (
    toolRequirementReview.reviewStatus ===
    AgentToolRequirementReviewStatus.Blocked
  ) {
    input.blockers.push({
      code: "tool_requirement_review_blocked",
      message:
        "工具需求审查预览包含已阻断的需求。",
      source: AgentExecutionReadinessSource.Tools,
      severity: AgentExecutionReadinessBlockerSeverity.High,
      relatedStepIds: getToolRequirementStepIds(
        toolRequirementReview.requirements,
      ),
      relatedStepIndexes: getToolRequirementStepIndexes(
        toolRequirementReview.requirements,
      ),
      relatedToolNames: getToolRequirementCandidateNames(
        toolRequirementReview.requirements,
      ),
    });
  }

  if (toolRequirementReview.confirmationRequiredCount > 0) {
    input.confirmationReasons.push(
      "一个或多个工具需求在未来执行前需要确认。",
    );
  }

  const unresolvedRequirements =
    toolRequirementReview.requirements.filter(isUnresolvedToolRequirement);

  for (const requirement of unresolvedRequirements) {
    const missingRequirement = createMissingToolRequirement(requirement);

    input.missingRequirements.push(missingRequirement);

    if (
      input.options.requireAllToolRequirementsResolvable ||
      requirement.blockedReason !== TOOL_BLOCKED_REASON.PreviewOnly
    ) {
      input.blockers.push({
        code: "tool_requirement_unresolved",
        message: missingRequirement.message,
        source: AgentExecutionReadinessSource.Tools,
        severity: AgentExecutionReadinessBlockerSeverity.High,
        relatedStepIds: getOptionalStepIds(requirement.stepId),
        relatedStepIndexes: [requirement.stepIndex],
        relatedToolNames: requirement.candidateToolNames,
      });
    } else {
      input.warnings.push({
        code: "tool_requirement_unresolved_preview",
        message: missingRequirement.message,
        source: AgentExecutionReadinessSource.Tools,
        relatedStepIds: getOptionalStepIds(requirement.stepId),
        relatedStepIndexes: [requirement.stepIndex],
      });
    }
  }

  if (
    toolRequirementReview.reviewStatus ===
    AgentToolRequirementReviewStatus.NoToolRequirementsDetected
  ) {
    input.warnings.push({
      code: "no_tool_requirements_detected",
      message:
        "未检测到工具需求；这不代表授权执行，仍然只是预览。",
      source: AgentExecutionReadinessSource.Tools,
    });
  }
}

function collectSkillFindings(input: {
  readonly skillSuggestionPreview: AgentSkillSuggestionPreview | undefined;
  readonly options: NormalizedOptions;
  readonly blockers: AgentExecutionReadinessBlocker[];
  readonly warnings: AgentExecutionReadinessWarning[];
  readonly missingRequirements: AgentExecutionMissingRequirement[];
  readonly confirmationReasons: string[];
}): void {
  const skillSuggestionPreview = input.skillSuggestionPreview;

  if (skillSuggestionPreview === undefined) {
    return;
  }

  if (skillSuggestionPreview.confirmationRequiredCount > 0) {
    input.confirmationReasons.push(
      "一个或多个 Skill 建议在进入任何未来 Skill 执行边界前需要确认。",
    );
  }

  if (skillSuggestionPreview.blockedSuggestionCount > 0) {
    input.warnings.push({
      code: "skill_suggestions_blocked_for_execution",
      message:
        "至少一个 Skill 建议已被阻断，不能用于未来执行；建议仍仅供参考。",
      source: AgentExecutionReadinessSource.Skills,
    });
  }

  if (
    skillSuggestionPreview.suggestionStatus ===
      AgentSkillSuggestionPreviewStatus.NoInstalledSkills ||
    skillSuggestionPreview.suggestionStatus ===
      AgentSkillSuggestionPreviewStatus.NoMatchingSkill
  ) {
    const missingRequirement: AgentExecutionMissingRequirement = {
      code: "no_matching_skill_suggestion",
      message:
        "没有可用的匹配 Skill 建议。除非选项要求 Skill 建议，否则这只是可选项。",
      source: AgentExecutionReadinessSource.Skills,
      required: input.options.requireSkillSuggestion,
    };

    input.missingRequirements.push(missingRequirement);

    if (input.options.requireSkillSuggestion) {
      input.blockers.push({
        code: "required_skill_suggestion_missing",
        message: missingRequirement.message,
        source: AgentExecutionReadinessSource.Skills,
        severity: AgentExecutionReadinessBlockerSeverity.Medium,
      });
    } else {
      input.warnings.push({
        code: "no_matching_skill_suggestion",
        message:
          "未找到匹配的 Skill；请把 Skill 建议保持为仅预览的可选增强。",
        source: AgentExecutionReadinessSource.Skills,
      });
    }
  }

  if (
    input.options.strictMode &&
    skillSuggestionPreview.suggestionStatus ===
      AgentSkillSuggestionPreviewStatus.Disabled
  ) {
    input.blockers.push({
      code: "strict_mode_skill_preview_disabled",
      message:
        "严格模式要求启用 Skill 建议预览。",
      source: AgentExecutionReadinessSource.Skills,
      severity: AgentExecutionReadinessBlockerSeverity.Medium,
    });
  }
}

function collectMemoryFindings(input: {
  readonly memoryContextPreview: AgentMemoryContextPreview | undefined;
  readonly options: NormalizedOptions;
  readonly blockers: AgentExecutionReadinessBlocker[];
  readonly warnings: AgentExecutionReadinessWarning[];
  readonly missingRequirements: AgentExecutionMissingRequirement[];
}): void {
  const memoryContextPreview = input.memoryContextPreview;

  if (memoryContextPreview === undefined) {
    return;
  }

  const hasNoUsableMemory =
    memoryContextPreview.contextStatus ===
      AgentMemoryContextStatus.NoCandidateMemory ||
    memoryContextPreview.contextStatus ===
      AgentMemoryContextStatus.NoRelevantMemory ||
    memoryContextPreview.selectedMemoryCount === 0;

  if (hasNoUsableMemory) {
    const missingRequirement: AgentExecutionMissingRequirement = {
      code: "no_usable_memory_context",
      message:
        "未选择可用记忆上下文。除非选项要求记忆上下文，否则这只是可选项。",
      source: AgentExecutionReadinessSource.Memory,
      required: input.options.requireMemoryContext,
    };

    input.missingRequirements.push(missingRequirement);

    if (input.options.requireMemoryContext) {
      input.blockers.push({
        code: "required_memory_context_missing",
        message: missingRequirement.message,
        source: AgentExecutionReadinessSource.Memory,
        severity: AgentExecutionReadinessBlockerSeverity.Medium,
      });
    } else {
      input.warnings.push({
        code: "no_usable_memory_context",
        message:
          "未选择相关记忆上下文；未来真实检索必须在单独边界中添加。",
        source: AgentExecutionReadinessSource.Memory,
      });
    }
  }

  if (
    input.options.strictMode &&
    memoryContextPreview.contextStatus === AgentMemoryContextStatus.Disabled
  ) {
    input.blockers.push({
      code: "strict_mode_memory_preview_disabled",
      message: "严格模式要求启用记忆上下文预览。",
      source: AgentExecutionReadinessSource.Memory,
      severity: AgentExecutionReadinessBlockerSeverity.Medium,
    });
  }
}

function collectRiskFindings(input: {
  readonly riskSummary: AgentExecutionRiskSummary;
  readonly options: NormalizedOptions;
  readonly blockers: AgentExecutionReadinessBlocker[];
  readonly warnings: AgentExecutionReadinessWarning[];
  readonly confirmationReasons: string[];
}): void {
  if (input.riskSummary.criticalRiskDetected) {
    input.blockers.push({
      code: "critical_risk_detected",
      message:
        "检测到严重风险，必须在该预览边界中保持阻断。",
      source: AgentExecutionReadinessSource.Risk,
      severity: AgentExecutionReadinessBlockerSeverity.Critical,
    });
  }

  if (input.riskSummary.unknownRiskDetected) {
    input.confirmationReasons.push(
      "检测到未知风险，需要进行保守的人工审查。",
    );

    if (input.options.strictMode) {
      input.blockers.push({
        code: "strict_mode_unknown_risk",
        message:
          "严格模式会阻断未知风险，直到预览元数据被澄清。",
        source: AgentExecutionReadinessSource.Risk,
        severity: AgentExecutionReadinessBlockerSeverity.High,
      });
    } else {
      input.warnings.push({
        code: "unknown_risk_detected",
        message:
          "检测到未知风险，将按保守方式处理为需要确认。",
        source: AgentExecutionReadinessSource.Risk,
      });
    }
  }

  if (input.riskSummary.highRiskDetected) {
    input.confirmationReasons.push(
      "检测到高风险，在进入任何未来执行边界前需要人工审查。",
    );

    if (!input.options.allowHighRiskPreview) {
      input.blockers.push({
        code: "high_risk_preview_not_allowed",
        message:
          "高风险预览已被选项禁用，不能视为就绪。",
        source: AgentExecutionReadinessSource.Risk,
        severity: AgentExecutionReadinessBlockerSeverity.High,
      });
    } else {
      input.warnings.push({
        code: "high_risk_requires_confirmation",
        message:
          "高风险不会在此执行，进入任何未来运行时前都必须确认。",
        source: AgentExecutionReadinessSource.Risk,
      });
    }
  }

  if (
    input.options.maxAllowedRiskLevel !== undefined &&
    isKnownReadinessRiskLevel(input.riskSummary.overallRiskLevel) &&
    compareRiskLevel(
      input.riskSummary.overallRiskLevel,
      input.options.maxAllowedRiskLevel,
    ) > 0
  ) {
    input.blockers.push({
      code: "risk_exceeds_max_allowed_risk_level",
      message: `Overall risk ${input.riskSummary.overallRiskLevel} exceeds max allowed risk ${input.options.maxAllowedRiskLevel}.`,
      source: AgentExecutionReadinessSource.Risk,
      severity: AgentExecutionReadinessBlockerSeverity.High,
    });
  }
}

function isAllowedByCurrentAutonomy(input: {
  readonly autonomyLevel: AutonomyLevelValue;
  readonly overallRiskLevel: AgentExecutionReadinessRiskLevel;
  readonly requiresConfirmation: boolean;
  readonly blockerCount: number;
  readonly toolRequirementReview: AgentToolRequirementReviewPreview | undefined;
  readonly skillSuggestionPreview: AgentSkillSuggestionPreview | undefined;
  readonly planPreview: AgentTaskPlanPreview | undefined;
}): boolean {
  if (input.blockerCount > 0 || input.requiresConfirmation) {
    return false;
  }

  if (
    input.overallRiskLevel === AgentExecutionReadinessRiskLevel.Unknown ||
    input.overallRiskLevel === AgentExecutionReadinessRiskLevel.Critical
  ) {
    return false;
  }

  const hasToolRequirements =
    (input.toolRequirementReview?.requirements.length ?? 0) > 0 ||
    (input.planPreview?.requiredToolCategories.length ?? 0) > 0;
  const hasSkillSuggestions =
    (input.skillSuggestionPreview?.matchedSkillCount ?? 0) > 0;

  if (input.autonomyLevel === AutonomyLevel.Manual) {
    return (
      input.overallRiskLevel === AgentExecutionReadinessRiskLevel.Low &&
      !hasToolRequirements &&
      !hasSkillSuggestions
    );
  }

  if (input.autonomyLevel === AutonomyLevel.ConfirmTools) {
    return (
      input.overallRiskLevel === AgentExecutionReadinessRiskLevel.Low &&
      !hasToolRequirements &&
      !hasSkillSuggestions
    );
  }

  if (input.autonomyLevel === AutonomyLevel.Supervised) {
    return (
      compareRiskLevel(input.overallRiskLevel, AutonomyRiskLevel.Medium) <= 0
    );
  }

  return compareRiskLevel(input.overallRiskLevel, AutonomyRiskLevel.High) <= 0;
}

function createReadyChecks(input: {
  readonly planReadiness: AgentExecutionPlanReadinessSummary;
  readonly toolReadiness: AgentExecutionToolReadinessSummary;
  readonly skillReadiness: AgentExecutionSkillReadinessSummary;
  readonly memoryReadiness: AgentExecutionMemoryReadinessSummary;
  readonly riskSummary: AgentExecutionRiskSummary;
  readonly allowedByCurrentAutonomy: boolean;
  readonly requiresConfirmation: boolean;
  readonly blockerCount: number;
}): AgentExecutionReadinessCheck[] {
  return [
    {
      id: "plan_preview_available",
      label: "任务计划预览可用",
      status:
        input.planReadiness.isValid && input.planReadiness.stepCount > 0
          ? AgentExecutionReadinessCheckStatus.Pass
          : AgentExecutionReadinessCheckStatus.Blocked,
      reason:
        input.planReadiness.isValid && input.planReadiness.stepCount > 0
          ? "任务计划预览存在，并包含确定性步骤。"
          : "任务计划预览缺失、无效或为空。",
      source: AgentExecutionReadinessSource.Plan,
    },
    {
      id: "tool_requirements_reviewed",
      label: "工具需求已审查",
      status: getToolCheckStatus(input.toolReadiness),
      reason: getToolCheckReason(input.toolReadiness),
      source: AgentExecutionReadinessSource.Tools,
    },
    {
      id: "skill_suggestions_reviewed",
      label: "Skill 建议已审查",
      status: getSkillCheckStatus(input.skillReadiness),
      reason: getSkillCheckReason(input.skillReadiness),
      source: AgentExecutionReadinessSource.Skills,
    },
    {
      id: "memory_context_reviewed",
      label: "记忆上下文已审查",
      status: getMemoryCheckStatus(input.memoryReadiness),
      reason: getMemoryCheckReason(input.memoryReadiness),
      source: AgentExecutionReadinessSource.Memory,
    },
    {
      id: "risk_reviewed",
      label: "风险已审查",
      status: getRiskCheckStatus(input.riskSummary),
      reason: getRiskCheckReason(input.riskSummary),
      source: AgentExecutionReadinessSource.Risk,
    },
    {
      id: "autonomy_reviewed",
      label: "自主性等级已审查",
      status:
        input.allowedByCurrentAutonomy && !input.requiresConfirmation
          ? AgentExecutionReadinessCheckStatus.Pass
          : AgentExecutionReadinessCheckStatus.Warning,
      reason: input.allowedByCurrentAutonomy
        ? "当前自主性等级满足保守预览检查。"
        : "当前自主性等级不允许自动执行；需要人工审查或确认。",
      source: AgentExecutionReadinessSource.Autonomy,
    },
    {
      id: "execution_disabled",
      label: "执行保持禁用",
      status:
        input.blockerCount > 0
          ? AgentExecutionReadinessCheckStatus.Blocked
          : AgentExecutionReadinessCheckStatus.Pass,
      reason:
        input.blockerCount > 0
          ? "执行已禁用，必须先解决阻断项，之后才能进入任何未来运行时边界。"
          : "执行按设计保持禁用，该预览不会授予任何执行权限。",
      source: AgentExecutionReadinessSource.Safety,
    },
  ];
}

function getReadinessStatus(input: {
  readonly blockers: readonly AgentExecutionReadinessBlocker[];
  readonly requiresConfirmation: boolean;
}): AgentExecutionReadinessStatus {
  if (input.blockers.some(isHardBlocker)) {
    return AgentExecutionReadinessStatus.Blocked;
  }

  if (input.blockers.length > 0) {
    return AgentExecutionReadinessStatus.NotReady;
  }

  if (input.requiresConfirmation) {
    return AgentExecutionReadinessStatus.NeedsConfirmation;
  }

  return AgentExecutionReadinessStatus.ReadyForFutureManualReview;
}

function getExecutionStatus(
  readinessStatus: AgentExecutionReadinessStatus,
): AgentExecutionReadinessExecutionStatus {
  if (
    readinessStatus === AgentExecutionReadinessStatus.Blocked ||
    readinessStatus === AgentExecutionReadinessStatus.NotReady
  ) {
    return AgentTaskPlanExecutionStatus.Disabled;
  }

  return AgentTaskPlanExecutionStatus.PreviewOnly;
}

function createRecommendedNextActions(input: {
  readonly readinessStatus: AgentExecutionReadinessStatus;
  readonly blockers: readonly AgentExecutionReadinessBlocker[];
  readonly warnings: readonly AgentExecutionReadinessWarning[];
  readonly missingRequirements: readonly AgentExecutionMissingRequirement[];
  readonly riskSummary: AgentExecutionRiskSummary;
  readonly requiresConfirmation: boolean;
}): string[] {
  const actions: string[] = [];

  if (input.blockers.length > 0) {
    actions.push("在设计任何未来执行边界前，先解决就绪阻断项。");
  }

  if (
    input.blockers.some(
      (blocker) => blocker.source === AgentExecutionReadinessSource.Tools,
    ) ||
    input.missingRequirements.some(
      (requirement) =>
        requirement.source === AgentExecutionReadinessSource.Tools,
    )
  ) {
    actions.push("先为所需类别添加或启用候选工具，之后才能考虑执行。");
  }

  if (input.riskSummary.highRiskDetected) {
    actions.push("在启用执行前，先审查高风险工具、Skill 或任务需求。");
  }

  if (input.riskSummary.unknownRiskDetected) {
    actions.push("先澄清未知风险元数据，再把任务视为就绪。");
  }

  if (input.requiresConfirmation) {
    actions.push("在任何未来执行前添加人工确认流程。");
  }

  if (
    input.warnings.some(
      (warning) => warning.source === AgentExecutionReadinessSource.Skills,
    )
  ) {
    actions.push("将 Skill 建议保持为仅预览候选项；不要自动安装或运行 Skill。");
  }

  if (
    input.warnings.some(
      (warning) => warning.source === AgentExecutionReadinessSource.Memory,
    )
  ) {
    actions.push("真实记忆检索只能放到未来明确边界中提供。");
  }

  actions.push("在智能体运行时边界实现前，保持真实执行禁用。");

  if (
    input.readinessStatus ===
    AgentExecutionReadinessStatus.ReadyForFutureManualReview
  ) {
    actions.push("将该预览作为未来人工审查输入，而不是执行授权。");
  }

  return normalizeUniqueStrings(actions);
}

function createSafetyNotes(): string[] {
  return [
    "执行就绪结果仅为预览。",
    "未执行智能体任务。",
    "未执行工具。",
    "未调用模型。",
    "未发起网络请求。",
    "未执行记忆检索。",
    "未执行 embedding。",
    "未执行、生成、安装或下载 Skill。",
    "未读取或写入数据库。",
    "未保存数据。",
    "该输出不是执行授权。",
    EXECUTION_READINESS_DISABLED_REASON,
  ];
}

function normalizeOptions(
  options: AgentExecutionReadinessOptions | undefined,
): NormalizedOptions {
  return {
    strictMode: options?.strictMode ?? false,
    requireMemoryContext: options?.requireMemoryContext ?? false,
    requireSkillSuggestion: options?.requireSkillSuggestion ?? false,
    allowHighRiskPreview: options?.allowHighRiskPreview ?? true,
    maxAllowedRiskLevel: options?.maxAllowedRiskLevel,
    requireAllToolRequirementsResolvable:
      options?.requireAllToolRequirementsResolvable ?? true,
  };
}

function appendMissingPreviewInput(input: {
  readonly previewName: string;
  readonly code: string;
  readonly source: AgentExecutionReadinessSource;
  readonly isMissing: boolean;
  readonly blockers: AgentExecutionReadinessBlocker[];
  readonly missingRequirements: AgentExecutionMissingRequirement[];
}): void {
  if (!input.isMissing) {
    return;
  }

  input.missingRequirements.push({
    code: input.code,
    message: `${input.previewName} is required for execution readiness preview.`,
    source: input.source,
    required: true,
  });
  input.blockers.push({
    code: input.code,
    message: `${input.previewName} is missing.`,
    source: input.source,
    severity: AgentExecutionReadinessBlockerSeverity.Medium,
  });
}

function createMissingToolRequirement(
  requirement: AgentToolRequirementPreviewItem,
): AgentExecutionMissingRequirement {
  if (requirement.candidateToolNames.length === 0) {
    return {
      code: "missing_candidate_tool",
      message: `No candidate tool matched requirement for step ${requirement.stepIndex}.`,
      source: AgentExecutionReadinessSource.Tools,
      required: true,
      relatedStepIds: getOptionalStepIds(requirement.stepId),
      relatedStepIndexes: [requirement.stepIndex],
    };
  }

  return {
    code: "unresolved_candidate_tool",
    message: `Candidate tools for step ${requirement.stepIndex} are not fully resolvable or enabled.`,
    source: AgentExecutionReadinessSource.Tools,
    required: true,
    relatedStepIds: getOptionalStepIds(requirement.stepId),
    relatedStepIndexes: [requirement.stepIndex],
    relatedToolNames: requirement.candidateToolNames,
  };
}

function isUnresolvedToolRequirement(
  requirement: AgentToolRequirementPreviewItem,
): boolean {
  return (
    requirement.candidateToolNames.length === 0 ||
    requirement.blockedReason === TOOL_BLOCKED_REASON.CandidateToolDisabled ||
    requirement.blockedReason ===
      TOOL_BLOCKED_REASON.NoAvailableToolForRequiredCategory
  );
}

function normalizeSkillRiskLevel(
  riskLevel: AgentSkillSuggestionRiskLevel | undefined,
): AgentExecutionReadinessRiskLevel | undefined {
  if (riskLevel === undefined) {
    return undefined;
  }

  if (riskLevel === AgentSkillSuggestionRiskLevel.Unknown) {
    return AgentExecutionReadinessRiskLevel.Unknown;
  }

  return riskLevel;
}

function createRiskReasons(input: {
  readonly planRiskLevel: RiskLevel | undefined;
  readonly toolRiskLevel: RiskLevel | undefined;
  readonly skillRiskLevel: AgentExecutionReadinessRiskLevel | undefined;
  readonly overallRiskLevel: AgentExecutionReadinessRiskLevel;
  readonly maxAllowedRiskLevel: RiskLevel | undefined;
}): string[] {
  const reasons: string[] = [];

  if (input.planRiskLevel !== undefined) {
    reasons.push(`Plan risk: ${input.planRiskLevel}.`);
  }

  if (input.toolRiskLevel !== undefined) {
    reasons.push(`Tool requirement risk: ${input.toolRiskLevel}.`);
  }

  if (input.skillRiskLevel !== undefined) {
    reasons.push(`Skill suggestion risk: ${input.skillRiskLevel}.`);
  }

  reasons.push(`Overall readiness risk: ${input.overallRiskLevel}.`);

  if (input.maxAllowedRiskLevel !== undefined) {
    reasons.push(`Max allowed risk option: ${input.maxAllowedRiskLevel}.`);
  }

  return reasons;
}

function getToolCheckStatus(
  toolReadiness: AgentExecutionToolReadinessSummary,
): AgentExecutionReadinessCheckStatus {
  if (toolReadiness.reviewStatus === undefined) {
    return AgentExecutionReadinessCheckStatus.Blocked;
  }

  if (
    toolReadiness.reviewStatus === AgentToolRequirementReviewStatus.Blocked ||
    toolReadiness.unresolvedRequirementCount > 0
  ) {
    return AgentExecutionReadinessCheckStatus.Blocked;
  }

  if (
    toolReadiness.confirmationRequiredCount > 0 ||
    toolReadiness.reviewStatus ===
      AgentToolRequirementReviewStatus.NeedsConfirmation
  ) {
    return AgentExecutionReadinessCheckStatus.Warning;
  }

  return AgentExecutionReadinessCheckStatus.Pass;
}

function getToolCheckReason(
  toolReadiness: AgentExecutionToolReadinessSummary,
): string {
  if (toolReadiness.reviewStatus === undefined) {
    return "缺少工具需求审查预览。";
  }

  if (
    toolReadiness.reviewStatus === AgentToolRequirementReviewStatus.Blocked
  ) {
    return "工具需求审查包含已阻断的需求。";
  }

  if (toolReadiness.unresolvedRequirementCount > 0) {
    return "部分工具需求未解决，或没有已启用的候选工具。";
  }

  if (toolReadiness.confirmationRequiredCount > 0) {
    return "部分工具需求需要确认。";
  }

  return "工具需求已在仅预览模式下审查。";
}

function getSkillCheckStatus(
  skillReadiness: AgentExecutionSkillReadinessSummary,
): AgentExecutionReadinessCheckStatus {
  if (skillReadiness.suggestionStatus === undefined) {
    return AgentExecutionReadinessCheckStatus.Blocked;
  }

  if (
    skillReadiness.suggestionStatus ===
    AgentSkillSuggestionPreviewStatus.Disabled
  ) {
    return AgentExecutionReadinessCheckStatus.Blocked;
  }

  if (
    skillReadiness.noMatchingSkill ||
    skillReadiness.blockedSuggestionCount > 0 ||
    skillReadiness.confirmationRequiredCount > 0
  ) {
    return AgentExecutionReadinessCheckStatus.Warning;
  }

  return AgentExecutionReadinessCheckStatus.Pass;
}

function getSkillCheckReason(
  skillReadiness: AgentExecutionSkillReadinessSummary,
): string {
  if (skillReadiness.suggestionStatus === undefined) {
    return "缺少 Skill 建议预览。";
  }

  if (
    skillReadiness.suggestionStatus ===
    AgentSkillSuggestionPreviewStatus.Disabled
  ) {
    return "Skill 建议预览已禁用。";
  }

  if (skillReadiness.noMatchingSkill) {
    return "没有可用的匹配 Skill 建议；默认情况下这是可选项。";
  }

  if (skillReadiness.confirmationRequiredCount > 0) {
    return "部分 Skill 建议在未来执行前需要确认。";
  }

  return "Skill 建议已作为参考性预览候选项完成审查。";
}

function getMemoryCheckStatus(
  memoryReadiness: AgentExecutionMemoryReadinessSummary,
): AgentExecutionReadinessCheckStatus {
  if (memoryReadiness.contextStatus === undefined) {
    return AgentExecutionReadinessCheckStatus.Blocked;
  }

  if (memoryReadiness.contextStatus === AgentMemoryContextStatus.Disabled) {
    return memoryReadiness.requireMemoryContext
      ? AgentExecutionReadinessCheckStatus.Blocked
      : AgentExecutionReadinessCheckStatus.Warning;
  }

  if (memoryReadiness.selectedMemoryCount === 0) {
    return memoryReadiness.requireMemoryContext
      ? AgentExecutionReadinessCheckStatus.Blocked
      : AgentExecutionReadinessCheckStatus.Warning;
  }

  return AgentExecutionReadinessCheckStatus.Pass;
}

function getMemoryCheckReason(
  memoryReadiness: AgentExecutionMemoryReadinessSummary,
): string {
  if (memoryReadiness.contextStatus === undefined) {
    return "缺少记忆上下文预览。";
  }

  if (memoryReadiness.contextStatus === AgentMemoryContextStatus.Disabled) {
    return "记忆上下文预览已禁用。";
  }

  if (memoryReadiness.selectedMemoryCount === 0) {
    return "未选择记忆上下文；除非选项要求，否则这是可选项。";
  }

  return "记忆上下文由调用方提供的候选记忆组装而成，未执行检索。";
}

function getRiskCheckStatus(
  riskSummary: AgentExecutionRiskSummary,
): AgentExecutionReadinessCheckStatus {
  if (riskSummary.criticalRiskDetected) {
    return AgentExecutionReadinessCheckStatus.Blocked;
  }

  if (riskSummary.highRiskDetected || riskSummary.unknownRiskDetected) {
    return AgentExecutionReadinessCheckStatus.Warning;
  }

  return AgentExecutionReadinessCheckStatus.Pass;
}

function getRiskCheckReason(riskSummary: AgentExecutionRiskSummary): string {
  if (riskSummary.criticalRiskDetected) {
    return "检测到严重风险，已阻断。";
  }

  if (riskSummary.unknownRiskDetected) {
    return "检测到未知风险，需要保守审查。";
  }

  if (riskSummary.highRiskDetected) {
    return "检测到高风险，需要确认。";
  }

  return "未检测到高风险或严重风险。";
}

function isHardBlocker(blocker: AgentExecutionReadinessBlocker): boolean {
  return (
    blocker.severity === AgentExecutionReadinessBlockerSeverity.High ||
    blocker.severity === AgentExecutionReadinessBlockerSeverity.Critical
  );
}

function isKnownReadinessRiskLevel(
  riskLevel: AgentExecutionReadinessRiskLevel | undefined,
): riskLevel is RiskLevel {
  return (
    riskLevel === AutonomyRiskLevel.Low ||
    riskLevel === AutonomyRiskLevel.Medium ||
    riskLevel === AutonomyRiskLevel.High ||
    riskLevel === AutonomyRiskLevel.Critical
  );
}

function getToolRequirementStepIds(
  requirements: readonly AgentToolRequirementPreviewItem[],
): string[] {
  return normalizeUniqueStrings(
    requirements
      .map((requirement) => requirement.stepId)
      .filter((stepId): stepId is string => stepId !== undefined),
  );
}

function getToolRequirementStepIndexes(
  requirements: readonly AgentToolRequirementPreviewItem[],
): number[] {
  return normalizeUniqueNumbers(
    requirements.map((requirement) => requirement.stepIndex),
  );
}

function getToolRequirementCandidateNames(
  requirements: readonly AgentToolRequirementPreviewItem[],
): string[] {
  return normalizeUniqueStrings(
    requirements.flatMap((requirement) => requirement.candidateToolNames),
  );
}

function getOptionalStepIds(stepId: string | undefined): string[] | undefined {
  return stepId === undefined ? undefined : [stepId];
}

function createPreviewId(
  input: AgentExecutionReadinessInput,
  options: NormalizedOptions,
  overallRiskLevel: AgentExecutionReadinessRiskLevel,
): string {
  const stableParts = [
    input.planPreview?.previewId ?? "",
    input.toolRequirementReview?.reviewStatus ?? "",
    input.skillSuggestionPreview?.previewId ?? "",
    input.memoryContextPreview?.previewId ?? "",
    input.autonomyLevel,
    overallRiskLevel,
    options.strictMode.toString(),
    options.requireMemoryContext.toString(),
    options.requireSkillSuggestion.toString(),
    options.allowHighRiskPreview.toString(),
    options.maxAllowedRiskLevel ?? "",
    options.requireAllToolRequirementsResolvable.toString(),
  ];

  return `execution_readiness_preview_${hashString(stableParts.join("|"))}`;
}

function normalizeUniqueStrings(values: readonly string[]): string[] {
  const normalizedValues: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const normalized = value.trim().replace(/\s+/g, " ");
    const key = normalized.toLowerCase();

    if (normalized.length > 0 && !seen.has(key)) {
      seen.add(key);
      normalizedValues.push(normalized);
    }
  }

  return normalizedValues;
}

function normalizeUniqueNumbers(values: readonly number[]): number[] {
  const normalizedValues: number[] = [];
  const seen = new Set<number>();

  for (const value of values) {
    if (Number.isFinite(value) && !seen.has(value)) {
      seen.add(value);
      normalizedValues.push(value);
    }
  }

  return normalizedValues;
}

function hashString(value: string): string {
  let hash = 2_166_136_261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619) >>> 0;
  }

  return hash.toString(36).padStart(7, "0");
}
