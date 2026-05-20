import {
  AutonomyLevel,
  AutonomyRiskLevel,
  type AutonomyLevel as AutonomyLevelValue,
  type AutonomyRiskLevel as RiskLevel,
} from "../autonomy/types";
import { isRiskAtLeast } from "../autonomy/risk";
import {
  AgentExecutionReadinessBlockerSeverity,
  AgentExecutionReadinessRiskLevel,
  AgentExecutionReadinessSource,
  AgentExecutionReadinessStatus,
  type AgentExecutionReadinessBlocker,
  type AgentExecutionReadinessPreview,
  type AgentExecutionReadinessRiskLevel as AgentExecutionReadinessRiskLevelValue,
  type AgentExecutionReadinessSource as AgentExecutionReadinessSourceValue,
} from "./execution-readiness-preview";
import type { AgentTaskPlanPreview } from "./plan-preview";
import {
  AgentToolRequirementReviewStatus,
  type AgentToolRequirementPreviewItem,
  type AgentToolRequirementReviewPreview,
} from "./tool-requirement-review-preview";
import {
  AgentSkillSuggestionRiskLevel,
  type AgentSkillSuggestionPreview,
  type AgentSkillSuggestionPreviewItem,
  type AgentSkillSuggestionRiskLevel as AgentSkillSuggestionRiskLevelValue,
} from "./skill-suggestion-preview";
import type { AgentMemoryContextPreview } from "./memory-context-preview";

export const AgentPermissionRequestStatus = {
  PreviewOnly: "preview_only",
  NoPermissionRequired: "no_permission_required",
  ConfirmationRequired: "confirmation_required",
  Blocked: "blocked",
  NotReady: "not_ready",
  Disabled: "disabled",
} as const;

export type AgentPermissionRequestStatus =
  (typeof AgentPermissionRequestStatus)[keyof typeof AgentPermissionRequestStatus];

export const AgentPermissionRequestKind = {
  ToolPermission: "tool_permission",
  AutonomyEscalation: "autonomy_escalation",
  RiskConfirmation: "risk_confirmation",
  HighRiskConfirmation: "high_risk_confirmation",
  CriticalRiskBlock: "critical_risk_block",
  SkillPermission: "skill_permission",
  MemoryContextNotice: "memory_context_notice",
  PersistenceNotice: "persistence_notice",
  ExecutionDisabledNotice: "execution_disabled_notice",
} as const;

export type AgentPermissionRequestKind =
  (typeof AgentPermissionRequestKind)[keyof typeof AgentPermissionRequestKind];

export const AgentPermissionRequestSource = {
  ToolRequirement: "tool_requirement",
  ExecutionReadiness: "execution_readiness",
  Autonomy: "autonomy",
  SkillSuggestion: "skill_suggestion",
  MemoryContext: "memory_context",
  Persistence: "persistence",
  Safety: "safety",
} as const;

export type AgentPermissionRequestSource =
  (typeof AgentPermissionRequestSource)[keyof typeof AgentPermissionRequestSource];

export const AgentPermissionRequestSeverity = {
  Info: "info",
  Warning: "warning",
  Required: "required",
  Blocked: "blocked",
} as const;

export type AgentPermissionRequestSeverity =
  (typeof AgentPermissionRequestSeverity)[keyof typeof AgentPermissionRequestSeverity];

export const AgentPermissionDecisionStatus = {
  PreviewOnly: "preview_only",
  PendingUserConfirmation: "pending_user_confirmation",
  Blocked: "blocked",
  Disabled: "disabled",
  NoDecisionCaptured: "no_decision_captured",
} as const;

export type AgentPermissionDecisionStatus =
  (typeof AgentPermissionDecisionStatus)[keyof typeof AgentPermissionDecisionStatus];

export const AgentPermissionDecisionKind = {
  WouldRequireUserApproval: "would_require_user_approval",
  WouldRemainBlocked: "would_remain_blocked",
  InformationalOnly: "informational_only",
  NotApplicable: "not_applicable",
} as const;

export type AgentPermissionDecisionKind =
  (typeof AgentPermissionDecisionKind)[keyof typeof AgentPermissionDecisionKind];

export const AgentPermissionDecisionValue = {
  Approve: "approve",
  Reject: "reject",
  Acknowledge: "acknowledge",
  None: "none",
} as const;

export type AgentPermissionDecisionValue =
  (typeof AgentPermissionDecisionValue)[keyof typeof AgentPermissionDecisionValue];

export const AgentPermissionDefaultFutureDecision = {
  Pending: "pending",
  Blocked: "blocked",
  AcknowledgeOnly: "acknowledge_only",
  NotApplicable: "not_applicable",
} as const;

export type AgentPermissionDefaultFutureDecision =
  (typeof AgentPermissionDefaultFutureDecision)[keyof typeof AgentPermissionDefaultFutureDecision];

export type AgentPermissionRequestRiskLevel =
  AgentExecutionReadinessRiskLevelValue;

export interface AgentPermissionRequestPreviewOptions {
  includeInformationalRequests?: boolean;
  blockCriticalRisk?: boolean;
  requireConfirmationForHighRisk?: boolean;
  requireConfirmationForMediumRisk?: boolean;
  requireToolConfirmation?: boolean;
  maxRequests?: number;
}

export interface AgentPermissionRequestPreviewInput {
  executionReadinessPreview: AgentExecutionReadinessPreview;
  toolRequirementReview: AgentToolRequirementReviewPreview;
  autonomyLevel: AutonomyLevelValue;
  overallRiskLevel?: AgentPermissionRequestRiskLevel;
  planPreview?: AgentTaskPlanPreview;
  skillSuggestionPreview?: AgentSkillSuggestionPreview;
  memoryContextPreview?: AgentMemoryContextPreview;
  options?: AgentPermissionRequestPreviewOptions;
}

export interface AgentPermissionRequestPreviewItem {
  id: string;
  requestKind: AgentPermissionRequestKind;
  title: string;
  description: string;
  source: AgentPermissionRequestSource;
  severity: AgentPermissionRequestSeverity;
  riskLevel?: AgentPermissionRequestRiskLevel;
  requiredAutonomyLevel?: AutonomyLevelValue;
  currentAutonomyLevel: AutonomyLevelValue;
  relatedToolNames: readonly string[];
  relatedToolCategories: readonly string[];
  relatedSkillNames: readonly string[];
  relatedStepIds: readonly string[];
  relatedStepIndexes: readonly number[];
  requiresUserConfirmation: boolean;
  allowedByCurrentAutonomy: boolean;
  blockedReason?: string;
  confirmationPromptText?: string;
  safetyNotes: readonly string[];
}

export interface AgentPermissionConfirmationSummary {
  requiresUserConfirmation: boolean;
  requiredRequestCount: number;
  blockedRequestCount: number;
  informationalRequestCount: number;
  approvableRequestIds: readonly string[];
  blockedRequestIds: readonly string[];
  confirmationPromptTexts: readonly string[];
  summaryText: string;
}

export interface AgentPermissionRiskSummary {
  overallRiskLevel: AgentPermissionRequestRiskLevel;
  criticalRiskBlocked: boolean;
  highRiskRequiresConfirmation: boolean;
  mediumRiskRequiresConfirmation: boolean;
  unknownRiskRequiresConfirmation: boolean;
  riskReasons: readonly string[];
}

export interface AgentPermissionRequestPreview {
  previewId: string;
  requestStatus: AgentPermissionRequestStatus;
  executable: false;
  realExecutionEnabled: false;
  permissionFlowEnabled: false;
  autonomyLevel: AutonomyLevelValue;
  overallRiskLevel: AgentPermissionRequestRiskLevel;
  allowedByCurrentAutonomy: boolean;
  requiresConfirmation: boolean;
  permissionRequests: readonly AgentPermissionRequestPreviewItem[];
  requiredRequests: readonly AgentPermissionRequestPreviewItem[];
  blockedRequests: readonly AgentPermissionRequestPreviewItem[];
  informationalRequests: readonly AgentPermissionRequestPreviewItem[];
  confirmationSummary: AgentPermissionConfirmationSummary;
  riskSummary: AgentPermissionRiskSummary;
  safetyNotes: readonly string[];
  recommendedNextActions: readonly string[];
  toolsExecuted: false;
  llmCalled: false;
  networkUsed: false;
  memoryRetrievalExecuted: false;
  dataSaved: false;
}

export type AgentPermissionFutureDecisionRecordField =
  | "requestId"
  | "decision"
  | "decidedByUserId"
  | "decidedAt"
  | "reason"
  | "expiresAt"
  | "scope"
  | "auditMetadata";

export interface AgentPermissionDecisionShapePreview {
  futureDecisionRecordNeeded: true;
  suggestedFields: readonly AgentPermissionFutureDecisionRecordField[];
  persistenceNotImplemented: true;
  confirmationUiNotImplemented: true;
  runtimeNotImplemented: true;
}

export interface AgentPermissionDecisionPreviewOptions {
  includeDecisionShapePreview?: boolean;
  allowApproveForHighRiskPreview?: boolean;
  blockCriticalRisk?: boolean;
  includeInformationalItems?: boolean;
  maxItems?: number;
}

export interface AgentPermissionDecisionPreviewInput {
  permissionRequestPreview: AgentPermissionRequestPreview;
  options?: AgentPermissionDecisionPreviewOptions;
}

export interface AgentPermissionDecisionItemPreview {
  requestId: string;
  requestKind: AgentPermissionRequestKind;
  decisionKind: AgentPermissionDecisionKind;
  title: string;
  severity: AgentPermissionRequestSeverity;
  riskLevel?: AgentPermissionRequestRiskLevel;
  allowedDecisionValues: readonly AgentPermissionDecisionValue[];
  defaultFutureDecision: AgentPermissionDefaultFutureDecision;
  decisionCaptured: false;
  requiresUserConfirmation: boolean;
  blockedReason?: string;
  safetyNotes: readonly string[];
}

export interface AgentPermissionDecisionPreview {
  sourcePreviewId: string;
  sourceRequestStatus: AgentPermissionRequestStatus;
  decisionStatus: AgentPermissionDecisionStatus;
  permissionFlowEnabled: false;
  decisionCaptured: false;
  decisionNotCaptured: true;
  executable: false;
  realExecutionEnabled: false;
  decisionItems: readonly AgentPermissionDecisionItemPreview[];
  approvableRequestIds: readonly string[];
  blockedRequestIds: readonly string[];
  informationalRequestIds: readonly string[];
  requiredBeforeExecution: boolean;
  requiredBeforeExecutionRequestIds: readonly string[];
  missingDecisionReasons: readonly string[];
  blockedReasons: readonly string[];
  decisionShapePreview: AgentPermissionDecisionShapePreview;
  safetyNotes: readonly string[];
  recommendedNextActions: readonly string[];
  toolsExecuted: false;
  llmCalled: false;
  networkUsed: false;
  memoryRetrievalExecuted: false;
  dataSaved: false;
}

interface NormalizedOptions {
  readonly includeInformationalRequests: boolean;
  readonly blockCriticalRisk: boolean;
  readonly requireConfirmationForHighRisk: boolean;
  readonly requireConfirmationForMediumRisk: boolean;
  readonly requireToolConfirmation: boolean;
  readonly maxRequests: number | undefined;
}

interface NormalizedDecisionOptions {
  readonly includeDecisionShapePreview: boolean;
  readonly allowApproveForHighRiskPreview: boolean;
  readonly blockCriticalRisk: boolean;
  readonly includeInformationalItems: boolean;
  readonly maxItems: number | undefined;
}

interface CreateRequestItemInput {
  readonly id: string;
  readonly requestKind: AgentPermissionRequestKind;
  readonly title: string;
  readonly description: string;
  readonly source: AgentPermissionRequestSource;
  readonly severity: AgentPermissionRequestSeverity;
  readonly currentAutonomyLevel: AutonomyLevelValue;
  readonly riskLevel?: AgentPermissionRequestRiskLevel | undefined;
  readonly requiredAutonomyLevel?: AutonomyLevelValue | undefined;
  readonly relatedToolNames?: readonly string[] | undefined;
  readonly relatedToolCategories?: readonly string[] | undefined;
  readonly relatedSkillNames?: readonly string[] | undefined;
  readonly relatedStepIds?: readonly string[] | undefined;
  readonly relatedStepIndexes?: readonly number[] | undefined;
  readonly requiresUserConfirmation?: boolean | undefined;
  readonly allowedByCurrentAutonomy?: boolean | undefined;
  readonly blockedReason?: string | undefined;
  readonly confirmationPromptText?: string | undefined;
  readonly safetyNotes?: readonly string[] | undefined;
}

const REAL_EXECUTION_DISABLED_NOTE =
  "权限请求预览仅用于展示。它不会捕获用户决策，也不能授权或执行智能体任务。";

const FUTURE_DECISION_RECORD_FIELDS: readonly AgentPermissionFutureDecisionRecordField[] =
  [
    "requestId",
    "decision",
    "decidedByUserId",
    "decidedAt",
    "reason",
    "expiresAt",
    "scope",
    "auditMetadata",
  ];

const TOOL_HARD_BLOCKED_REASONS = new Set([
  "plan_preview_disabled",
  "missing_tool_metadata",
  "no_available_tool_for_required_category",
  "candidate_tool_disabled",
  "critical_risk_disabled",
  "risk_denied_by_current_autonomy",
]);

const SKILL_HARD_BLOCKED_REASONS = new Set([
  "missing_skill_metadata",
  "critical_risk_disabled",
  "plan_preview_disabled",
]);

export function createAgentPermissionRequestPreview(
  input: AgentPermissionRequestPreviewInput,
): AgentPermissionRequestPreview {
  const options = normalizeOptions(input.options);
  const overallRiskLevel =
    input.overallRiskLevel ??
    input.executionReadinessPreview.overallRiskLevel;
  const rawRequests = [
    ...createReadinessBlockerRequests(input),
    ...createToolPermissionRequests(input, options),
    ...createRiskPermissionRequests(input, options, overallRiskLevel),
    ...createAutonomyRequests(input, overallRiskLevel),
    ...createSkillPermissionRequests(input, options),
    ...createInformationalRequests(input, options),
  ];
  const permissionRequests = applyRequestLimit(
    rawRequests,
    options.maxRequests,
  );
  const blockedRequests = permissionRequests.filter(
    (request) =>
      request.severity === AgentPermissionRequestSeverity.Blocked,
  );
  const requiredRequests = permissionRequests.filter(
    (request) =>
      request.severity === AgentPermissionRequestSeverity.Required,
  );
  const informationalRequests = permissionRequests.filter(
    (request) =>
      request.severity === AgentPermissionRequestSeverity.Info ||
      request.severity === AgentPermissionRequestSeverity.Warning,
  );
  const requiresConfirmation =
    requiredRequests.length > 0 ||
    (input.executionReadinessPreview.requiresConfirmation &&
      blockedRequests.length === 0);
  const allowedByCurrentAutonomy =
    input.executionReadinessPreview.allowedByCurrentAutonomy &&
    blockedRequests.length === 0 &&
    requiredRequests.length === 0;
  const requestStatus = getRequestStatus({
    executionReadinessPreview: input.executionReadinessPreview,
    blockedRequests,
    requiredRequests,
    requiresConfirmation,
    permissionRequests,
  });
  const riskSummary = createRiskSummary({
    input,
    options,
    overallRiskLevel,
  });

  return {
    previewId: createPreviewId(input, options, overallRiskLevel, requestStatus),
    requestStatus,
    executable: false,
    realExecutionEnabled: false,
    permissionFlowEnabled: false,
    autonomyLevel: input.autonomyLevel,
    overallRiskLevel,
    allowedByCurrentAutonomy,
    requiresConfirmation,
    permissionRequests,
    requiredRequests,
    blockedRequests,
    informationalRequests,
    confirmationSummary: createConfirmationSummary({
      requiredRequests,
      blockedRequests,
      informationalRequests,
    }),
    riskSummary,
    safetyNotes: createSafetyNotes({
      input,
      options,
      originalRequestCount: rawRequests.length,
      visibleRequestCount: permissionRequests.length,
    }),
    recommendedNextActions: createRecommendedNextActions({
      input,
      blockedRequests,
      requiredRequests,
      informationalRequests,
      riskSummary,
    }),
    toolsExecuted: false,
    llmCalled: false,
    networkUsed: false,
    memoryRetrievalExecuted: false,
    dataSaved: false,
  };
}

export function createAgentPermissionDecisionPreview(
  input: AgentPermissionDecisionPreviewInput | AgentPermissionRequestPreview,
): AgentPermissionDecisionPreview {
  const { permissionRequestPreview, options } =
    normalizeDecisionPreviewInput(input);
  const decisionItems = applyDecisionItemLimit(
    permissionRequestPreview.permissionRequests
      .filter((request) =>
        options.includeInformationalItems
          ? true
          : !isInformationalRequest(request),
      )
      .map((request) => createDecisionItemPreview(request, options)),
    options.maxItems,
  );
  const approvableRequestIds = decisionItems
    .filter(
      (item) =>
        item.decisionKind ===
        AgentPermissionDecisionKind.WouldRequireUserApproval,
    )
    .map((item) => item.requestId);
  const blockedRequestIds = decisionItems
    .filter(
      (item) =>
        item.decisionKind === AgentPermissionDecisionKind.WouldRemainBlocked,
    )
    .map((item) => item.requestId);
  const informationalRequestIds = decisionItems
    .filter(
      (item) =>
        item.decisionKind === AgentPermissionDecisionKind.InformationalOnly,
    )
    .map((item) => item.requestId);
  const requiredBeforeExecutionRequestIds = normalizeUniqueStrings([
    ...approvableRequestIds,
    ...blockedRequestIds,
  ]);
  const decisionStatus = getDecisionStatus({
    preview: permissionRequestPreview,
    approvableRequestIds,
    blockedRequestIds,
  });

  return {
    sourcePreviewId: permissionRequestPreview.previewId,
    sourceRequestStatus: permissionRequestPreview.requestStatus,
    decisionStatus,
    permissionFlowEnabled: false,
    decisionCaptured: false,
    decisionNotCaptured: true,
    executable: false,
    realExecutionEnabled: false,
    decisionItems,
    approvableRequestIds,
    blockedRequestIds,
    informationalRequestIds,
    requiredBeforeExecution: requiredBeforeExecutionRequestIds.length > 0,
    requiredBeforeExecutionRequestIds,
    missingDecisionReasons: createMissingDecisionReasons({
      permissionRequestPreview,
      approvableRequestIds,
      blockedRequestIds,
      decisionStatus,
    }),
    blockedReasons: createDecisionBlockedReasons(decisionItems),
    decisionShapePreview: createDecisionShapePreview(options),
    safetyNotes: createDecisionSafetyNotes({
      options,
      decisionItems,
      approvableRequestIds,
      blockedRequestIds,
      informationalRequestIds,
    }),
    recommendedNextActions: createDecisionRecommendedNextActions({
      decisionStatus,
      approvableRequestIds,
      blockedRequestIds,
      informationalRequestIds,
      decisionItems,
    }),
    toolsExecuted: false,
    llmCalled: false,
    networkUsed: false,
    memoryRetrievalExecuted: false,
    dataSaved: false,
  };
}

function normalizeDecisionPreviewInput(
  input: AgentPermissionDecisionPreviewInput | AgentPermissionRequestPreview,
): {
  readonly permissionRequestPreview: AgentPermissionRequestPreview;
  readonly options: NormalizedDecisionOptions;
} {
  if ("permissionRequestPreview" in input) {
    return {
      permissionRequestPreview: input.permissionRequestPreview,
      options: normalizeDecisionOptions(input.options),
    };
  }

  return {
    permissionRequestPreview: input,
    options: normalizeDecisionOptions(undefined),
  };
}

function normalizeDecisionOptions(
  options: AgentPermissionDecisionPreviewOptions | undefined,
): NormalizedDecisionOptions {
  return {
    includeDecisionShapePreview:
      options?.includeDecisionShapePreview ?? true,
    allowApproveForHighRiskPreview:
      options?.allowApproveForHighRiskPreview ?? true,
    blockCriticalRisk: options?.blockCriticalRisk ?? true,
    includeInformationalItems: options?.includeInformationalItems ?? true,
    maxItems: normalizeMaxRequests(options?.maxItems),
  };
}

function createDecisionItemPreview(
  request: AgentPermissionRequestPreviewItem,
  options: NormalizedDecisionOptions,
): AgentPermissionDecisionItemPreview {
  if (isCriticalRiskRequest(request)) {
    return createBlockedDecisionItem({
      request,
      blockedReason: options.blockCriticalRisk
        ? (request.blockedReason ?? "critical_risk_blocked_by_preview_policy")
        : "critical_risk_blocked_even_when_option_disabled",
      safetyNotes: [
        "严重风险请求必须保持阻断。",
        "严重风险不能通过自主性等级或仅预览决策批准。",
      ],
    });
  }

  if (request.severity === AgentPermissionRequestSeverity.Blocked) {
    return createBlockedDecisionItem({
      request,
      blockedReason:
        request.blockedReason ??
        "request_blocked_by_permission_request_preview",
      safetyNotes: [
        "已阻断的权限请求不能在该预览边界中批准。",
      ],
    });
  }

  if (
    request.severity === AgentPermissionRequestSeverity.Required ||
    request.requiresUserConfirmation
  ) {
    if (
      request.riskLevel !== undefined &&
      isKnownRiskLevel(request.riskLevel) &&
      isRiskAtLeast(request.riskLevel, AutonomyRiskLevel.High) &&
      !options.allowApproveForHighRiskPreview
    ) {
      return createBlockedDecisionItem({
        request,
        blockedReason: "high_risk_approval_preview_disabled_by_options",
        safetyNotes: [
          "决策预览选项已禁用高风险批准。",
        ],
      });
    }

    return {
      requestId: request.id,
      requestKind: request.requestKind,
      decisionKind: AgentPermissionDecisionKind.WouldRequireUserApproval,
      title: request.title,
      severity: request.severity,
      ...(request.riskLevel === undefined
        ? {}
        : { riskLevel: request.riskLevel }),
      allowedDecisionValues: [
        AgentPermissionDecisionValue.Approve,
        AgentPermissionDecisionValue.Reject,
      ],
      defaultFutureDecision: AgentPermissionDefaultFutureDecision.Pending,
      decisionCaptured: false,
      requiresUserConfirmation: true,
      safetyNotes: normalizeUniqueStrings([
        "批准和拒绝只是未来决策形状值。",
        "该预览没有捕获任何批准或拒绝。",
        "必须先具备真实确认 UI、审计边界和持久化层，才能决定该请求。",
        ...request.safetyNotes,
      ]),
    };
  }

  if (isInformationalRequest(request)) {
    return {
      requestId: request.id,
      requestKind: request.requestKind,
      decisionKind: AgentPermissionDecisionKind.InformationalOnly,
      title: request.title,
      severity: request.severity,
      ...(request.riskLevel === undefined
        ? {}
        : { riskLevel: request.riskLevel }),
      allowedDecisionValues: [AgentPermissionDecisionValue.Acknowledge],
      defaultFutureDecision:
        AgentPermissionDefaultFutureDecision.AcknowledgeOnly,
      decisionCaptured: false,
      requiresUserConfirmation: false,
      safetyNotes: normalizeUniqueStrings([
        "该请求仅用于提示信息。",
        "未来的确认知悉也不会授予执行权限。",
        ...request.safetyNotes,
      ]),
    };
  }

  return {
    requestId: request.id,
    requestKind: request.requestKind,
    decisionKind: AgentPermissionDecisionKind.NotApplicable,
    title: request.title,
    severity: request.severity,
    ...(request.riskLevel === undefined
      ? {}
      : { riskLevel: request.riskLevel }),
    allowedDecisionValues: [AgentPermissionDecisionValue.None],
    defaultFutureDecision:
      AgentPermissionDefaultFutureDecision.NotApplicable,
    decisionCaptured: false,
    requiresUserConfirmation: false,
    safetyNotes: normalizeUniqueStrings([
      "该请求在预览边界中没有适用的决策。",
      ...request.safetyNotes,
    ]),
  };
}

function createBlockedDecisionItem(input: {
  readonly request: AgentPermissionRequestPreviewItem;
  readonly blockedReason: string;
  readonly safetyNotes: readonly string[];
}): AgentPermissionDecisionItemPreview {
  return {
    requestId: input.request.id,
    requestKind: input.request.requestKind,
    decisionKind: AgentPermissionDecisionKind.WouldRemainBlocked,
    title: input.request.title,
    severity: input.request.severity,
    ...(input.request.riskLevel === undefined
      ? {}
      : { riskLevel: input.request.riskLevel }),
    allowedDecisionValues: [AgentPermissionDecisionValue.None],
    defaultFutureDecision: AgentPermissionDefaultFutureDecision.Blocked,
    decisionCaptured: false,
    requiresUserConfirmation: false,
    blockedReason: input.blockedReason,
    safetyNotes: normalizeUniqueStrings([
      ...input.safetyNotes,
      "已阻断请求没有可用的批准值。",
      "未捕获用户决策。",
      ...input.request.safetyNotes,
    ]),
  };
}

function createDecisionShapePreview(
  options: NormalizedDecisionOptions,
): AgentPermissionDecisionShapePreview {
  return {
    futureDecisionRecordNeeded: true,
    suggestedFields: options.includeDecisionShapePreview
      ? FUTURE_DECISION_RECORD_FIELDS
      : [],
    persistenceNotImplemented: true,
    confirmationUiNotImplemented: true,
    runtimeNotImplemented: true,
  };
}

function createMissingDecisionReasons(input: {
  readonly permissionRequestPreview: AgentPermissionRequestPreview;
  readonly approvableRequestIds: readonly string[];
  readonly blockedRequestIds: readonly string[];
  readonly decisionStatus: AgentPermissionDecisionStatus;
}): string[] {
  const reasons = [
    "该预览边界未捕获用户决策。",
    "permissionFlowEnabled=false，因此批准、拒绝和确认知悉动作不可用。",
    "realExecutionEnabled=false，因此预览决策不能启动运行时执行。",
    "权限决策持久化尚未实现。",
  ];

  if (input.approvableRequestIds.length > 0) {
    reasons.push("可批准请求需要先具备真实确认 UI，之后才能做出决策。");
  }

  if (input.blockedRequestIds.length > 0) {
    reasons.push("在未来明确边界中解决底层阻断原因前，已阻断请求必须保持阻断。");
  }

  if (
    input.permissionRequestPreview.requestStatus ===
    AgentPermissionRequestStatus.NoPermissionRequired
  ) {
    reasons.push("来源请求预览不需要权限，但当前没有启用运行时。");
  }

  if (
    input.decisionStatus === AgentPermissionDecisionStatus.NoDecisionCaptured
  ) {
    reasons.push("该请求预览不需要权限决策，也没有授予执行权限。");
  }

  return normalizeUniqueStrings(reasons);
}

function createDecisionBlockedReasons(
  decisionItems: readonly AgentPermissionDecisionItemPreview[],
): string[] {
  return normalizeUniqueStrings(
    decisionItems
      .filter(
        (item) =>
          item.decisionKind ===
          AgentPermissionDecisionKind.WouldRemainBlocked,
      )
      .map(
        (item) =>
          `${item.requestId}: ${
            item.blockedReason ?? "blocked_by_decision_preview"
          }`,
      ),
  );
}

function createDecisionSafetyNotes(input: {
  readonly options: NormalizedDecisionOptions;
  readonly decisionItems: readonly AgentPermissionDecisionItemPreview[];
  readonly approvableRequestIds: readonly string[];
  readonly blockedRequestIds: readonly string[];
  readonly informationalRequestIds: readonly string[];
}): string[] {
  const notes = [
    "这只是决策形状预览。",
    "未捕获用户决策。",
    "未授予权限。",
    "未执行工具。",
    "未调用模型。",
    "未发起网络请求。",
    "未调用 MemoryStore.search。",
    "未执行 embedding、向量搜索或 RAG。",
    "未生成、安装、下载或执行 Skill。",
    "未保存权限请求或决策。",
    "未启用运行时。",
  ];

  if (input.blockedRequestIds.length > 0) {
    notes.push("已阻断请求和严重风险请求不能通过该预览批准。");
  }

  if (input.approvableRequestIds.length > 0) {
    notes.push("可批准请求 ID 只描述未来 UI 形状，不代表当前用户动作。");
  }

  if (input.informationalRequestIds.length > 0) {
    notes.push("提示类请求不是批准请求。");
  }

  if (input.decisionItems.length === 0) {
    notes.push("该预览未包含决策项。");
  }

  if (!input.options.includeDecisionShapePreview) {
    notes.push("预览选项已故意省略未来决策记录字段。");
  }

  return normalizeUniqueStrings(notes);
}

function createDecisionRecommendedNextActions(input: {
  readonly decisionStatus: AgentPermissionDecisionStatus;
  readonly approvableRequestIds: readonly string[];
  readonly blockedRequestIds: readonly string[];
  readonly informationalRequestIds: readonly string[];
  readonly decisionItems: readonly AgentPermissionDecisionItemPreview[];
}): string[] {
  const actions = [
    "在未来明确边界中构建真实确认 UI。",
    "只有在专用 schema / repository 边界完成后，才持久化权限决策。",
    "不要从预览决策执行工具。",
    "在启用运行时前添加审计日志。",
  ];

  if (input.blockedRequestIds.length > 0) {
    actions.push("保持严重风险和已阻断请求处于阻断状态。");
    actions.push("在未来执行前先解决权限请求被阻断的原因。");
  }

  if (input.approvableRequestIds.length > 0) {
    actions.push("在任何未来执行前收集明确的用户批准或拒绝。");
  }

  if (input.informationalRequestIds.length > 0) {
    actions.push("将提示信息和批准决策分开处理。");
  }

  if (
    input.decisionStatus === AgentPermissionDecisionStatus.NoDecisionCaptured
  ) {
    actions.push("在运行时存在前，把无需权限的预览也视为不可执行。");
  }

  if (
    input.decisionItems.some((item) => item.riskLevel === AgentExecutionReadinessRiskLevel.Critical)
  ) {
    actions.push("保持严重风险请求阻断。");
  }

  return normalizeUniqueStrings(actions);
}

function createReadinessBlockerRequests(
  input: AgentPermissionRequestPreviewInput,
): AgentPermissionRequestPreviewItem[] {
  return input.executionReadinessPreview.blockers.map((blocker, index) =>
    createReadinessBlockerRequest(input, blocker, index),
  );
}

function createReadinessBlockerRequest(
  input: AgentPermissionRequestPreviewInput,
  blocker: AgentExecutionReadinessBlocker,
  index: number,
): AgentPermissionRequestPreviewItem {
  const isCritical =
    blocker.severity === AgentExecutionReadinessBlockerSeverity.Critical ||
    blocker.code.includes("critical");

  return createRequestItem({
    id: `permission-readiness-blocker-${index}`,
    requestKind: isCritical
      ? AgentPermissionRequestKind.CriticalRiskBlock
      : AgentPermissionRequestKind.ExecutionDisabledNotice,
    title: isCritical
      ? "严重就绪阻断项"
      : "执行就绪阻断项",
    description: blocker.message,
    source: mapReadinessSource(blocker.source),
    severity: AgentPermissionRequestSeverity.Blocked,
    currentAutonomyLevel: input.autonomyLevel,
    riskLevel: isCritical
      ? AgentExecutionReadinessRiskLevel.Critical
      : input.executionReadinessPreview.overallRiskLevel,
    relatedToolNames: blocker.relatedToolNames,
    relatedSkillNames: blocker.relatedSkillNames,
    relatedStepIds: blocker.relatedStepIds,
    relatedStepIndexes: blocker.relatedStepIndexes,
    blockedReason: blocker.code,
    safetyNotes: [
      "就绪阻断项不能在该预览边界内批准。",
      "必须先解决阻断项，之后才能考虑任何未来权限流程。",
    ],
  });
}

function createToolPermissionRequests(
  input: AgentPermissionRequestPreviewInput,
  options: NormalizedOptions,
): AgentPermissionRequestPreviewItem[] {
  return input.toolRequirementReview.requirements.flatMap(
    (requirement, index) => {
      const isBlocked = isHardBlockedToolRequirement(
        input.toolRequirementReview,
        requirement,
      );
      const shouldRequireConfirmation =
        options.requireToolConfirmation && requirement.requiresConfirmation;
      const shouldInclude =
        isBlocked ||
        shouldRequireConfirmation ||
        options.includeInformationalRequests;

      if (!shouldInclude) {
        return [];
      }

      return [
        createRequestItem({
          id: `permission-tool-${index}`,
          requestKind: AgentPermissionRequestKind.ToolPermission,
          title: `Tool permission for step ${requirement.stepIndex}`,
          description: createToolRequestDescription(requirement, isBlocked),
          source: AgentPermissionRequestSource.ToolRequirement,
          severity: isBlocked
            ? AgentPermissionRequestSeverity.Blocked
            : shouldRequireConfirmation
              ? AgentPermissionRequestSeverity.Required
              : AgentPermissionRequestSeverity.Info,
          currentAutonomyLevel: input.autonomyLevel,
          riskLevel: requirement.riskLevel,
          relatedToolNames: requirement.candidateToolNames,
          relatedToolCategories: requirement.requiredToolCategories,
          relatedStepIds: getOptionalStepIds(requirement.stepId),
          relatedStepIndexes: [requirement.stepIndex],
          requiresUserConfirmation: shouldRequireConfirmation && !isBlocked,
          allowedByCurrentAutonomy:
            requirement.allowedByCurrentAutonomy &&
            !isBlocked &&
            !shouldRequireConfirmation,
          blockedReason: isBlocked ? requirement.blockedReason : undefined,
          confirmationPromptText:
            shouldRequireConfirmation && !isBlocked
              ? `Confirm future use of candidate tools for step ${requirement.stepIndex}: ${formatList(
                  requirement.candidateToolNames,
                )}.`
              : undefined,
          safetyNotes: [
            "工具需求只是预览元数据。",
            "未执行或授权任何工具。",
            ...requirement.safetyNotes,
          ],
        }),
      ];
    },
  );
}

function createRiskPermissionRequests(
  input: AgentPermissionRequestPreviewInput,
  options: NormalizedOptions,
  overallRiskLevel: AgentPermissionRequestRiskLevel,
): AgentPermissionRequestPreviewItem[] {
  const requests: AgentPermissionRequestPreviewItem[] = [];

  if (overallRiskLevel === AgentExecutionReadinessRiskLevel.Critical) {
    if (options.blockCriticalRisk) {
      requests.push(
        createRequestItem({
          id: "permission-risk-critical-0",
          requestKind: AgentPermissionRequestKind.CriticalRiskBlock,
          title: "严重风险已阻断",
          description:
            "严重风险任务不能通过自主性等级或权限预览批准。",
          source: AgentPermissionRequestSource.Safety,
          severity: AgentPermissionRequestSeverity.Blocked,
          currentAutonomyLevel: input.autonomyLevel,
          riskLevel: overallRiskLevel,
          blockedReason: "critical_risk_blocked_by_preview_policy",
          safetyNotes: [
            "严重风险默认保持阻断。",
            "未来运行时不得允许自主性绕过严重风险审查。",
          ],
        }),
      );
    }

    return requests;
  }

  if (
    isKnownRiskLevel(overallRiskLevel) &&
    isRiskAtLeast(overallRiskLevel, AutonomyRiskLevel.High) &&
    options.requireConfirmationForHighRisk
  ) {
    requests.push(
      createRequestItem({
        id: "permission-risk-high-0",
        requestKind: AgentPermissionRequestKind.HighRiskConfirmation,
        title: "高风险需要确认",
        description:
          "高风险任务在进入任何未来执行边界前需要明确的用户确认。",
        source: AgentPermissionRequestSource.Safety,
        severity: AgentPermissionRequestSeverity.Required,
        currentAutonomyLevel: input.autonomyLevel,
        riskLevel: overallRiskLevel,
        requiresUserConfirmation: true,
        allowedByCurrentAutonomy: false,
        confirmationPromptText:
          "请确认你理解高风险，并且仍希望未来运行时继续。",
        safetyNotes: [
          "高风险不会在此执行。",
          "该预览只记录未来需要确认 UI。",
        ],
      }),
    );
  }

  if (
    overallRiskLevel === AgentExecutionReadinessRiskLevel.Medium &&
    options.requireConfirmationForMediumRisk
  ) {
    requests.push(
      createRequestItem({
        id: "permission-risk-medium-0",
        requestKind: AgentPermissionRequestKind.RiskConfirmation,
        title: "中风险需要确认",
        description:
          "预览选项要求中风险确认。",
        source: AgentPermissionRequestSource.Safety,
        severity: AgentPermissionRequestSeverity.Required,
        currentAutonomyLevel: input.autonomyLevel,
        riskLevel: overallRiskLevel,
        requiresUserConfirmation: true,
        allowedByCurrentAutonomy: false,
        confirmationPromptText:
          "请确认你已在未来执行前审查中风险。",
      }),
    );
  }

  if (overallRiskLevel === AgentExecutionReadinessRiskLevel.Unknown) {
    requests.push(
      createRequestItem({
        id: "permission-risk-unknown-0",
        requestKind: AgentPermissionRequestKind.RiskConfirmation,
        title: "未知风险需要审查",
        description:
          "未知风险元数据必须在未来执行前澄清或确认。",
        source: AgentPermissionRequestSource.Safety,
        severity: AgentPermissionRequestSeverity.Required,
        currentAutonomyLevel: input.autonomyLevel,
        riskLevel: overallRiskLevel,
        requiresUserConfirmation: true,
        allowedByCurrentAutonomy: false,
        confirmationPromptText:
          "请确认未知风险元数据已在未来执行前完成审查。",
      }),
    );
  }

  return requests;
}

function createAutonomyRequests(
  input: AgentPermissionRequestPreviewInput,
  overallRiskLevel: AgentPermissionRequestRiskLevel,
): AgentPermissionRequestPreviewItem[] {
  const requiredAutonomyLevel = getRequiredAutonomyLevel(input);
  const currentAutonomyInsufficient =
    !input.executionReadinessPreview.allowedByCurrentAutonomy ||
    (requiredAutonomyLevel !== undefined &&
      !hasRequiredAutonomyLevel(input.autonomyLevel, requiredAutonomyLevel));

  if (!currentAutonomyInsufficient) {
    return [];
  }

  const isCritical =
    overallRiskLevel === AgentExecutionReadinessRiskLevel.Critical;

  return [
    createRequestItem({
      id: "permission-autonomy-0",
      requestKind: AgentPermissionRequestKind.AutonomyEscalation,
      title: "当前自主性等级不足",
      description:
        "当前自主性等级不允许该预览自动执行。未来运行时需要明确确认，或单独授予更高自主性。",
      source: AgentPermissionRequestSource.Autonomy,
      severity: isCritical
        ? AgentPermissionRequestSeverity.Blocked
        : AgentPermissionRequestSeverity.Required,
      currentAutonomyLevel: input.autonomyLevel,
      requiredAutonomyLevel,
      riskLevel: overallRiskLevel,
      requiresUserConfirmation: !isCritical,
      allowedByCurrentAutonomy: false,
      blockedReason: isCritical
        ? "critical_risk_cannot_be_solved_by_autonomy_escalation"
        : undefined,
      confirmationPromptText: isCritical
        ? undefined
        : "请确认未来执行是否应请求更高自主性边界，或继续保持手动。",
      safetyNotes: [
        "该函数不会应用自主性升级。",
        "未保存权限授予或决策。",
      ],
    }),
  ];
}

function createSkillPermissionRequests(
  input: AgentPermissionRequestPreviewInput,
  options: NormalizedOptions,
): AgentPermissionRequestPreviewItem[] {
  return (input.skillSuggestionPreview?.suggestions ?? []).flatMap(
    (suggestion, index) => {
      const isBlocked = isHardBlockedSkillSuggestion(suggestion);
      const isCritical =
        suggestion.riskLevel === AgentSkillSuggestionRiskLevel.Critical;
      const isHigh =
        isKnownSkillRiskLevel(suggestion.riskLevel) &&
        isRiskAtLeast(suggestion.riskLevel, AutonomyRiskLevel.High);
      const shouldRequireConfirmation =
        suggestion.requiresConfirmation || isHigh;
      const shouldInclude =
        isBlocked ||
        isCritical ||
        isHigh ||
        shouldRequireConfirmation ||
        options.includeInformationalRequests;

      if (!shouldInclude) {
        return [];
      }

      return [
        createRequestItem({
          id: `permission-skill-${index}`,
          requestKind: AgentPermissionRequestKind.SkillPermission,
          title: `Skill permission for ${suggestion.skillName}`,
          description: createSkillRequestDescription(suggestion, isBlocked),
          source: AgentPermissionRequestSource.SkillSuggestion,
          severity:
            isBlocked || isCritical
              ? AgentPermissionRequestSeverity.Blocked
              : shouldRequireConfirmation
                ? AgentPermissionRequestSeverity.Required
                : AgentPermissionRequestSeverity.Info,
          currentAutonomyLevel: input.autonomyLevel,
          requiredAutonomyLevel: suggestion.requiredAutonomyLevel,
          riskLevel: normalizeSkillRiskLevel(suggestion.riskLevel),
          relatedToolNames: suggestion.requiredToolNames,
          relatedToolCategories: suggestion.requiredToolCategories,
          relatedSkillNames: [suggestion.skillName],
          relatedStepIds: suggestion.coveredStepIds,
          relatedStepIndexes: suggestion.coveredStepIndexes,
          requiresUserConfirmation:
            shouldRequireConfirmation && !isBlocked && !isCritical,
          allowedByCurrentAutonomy:
            suggestion.allowedByCurrentAutonomy &&
            !isBlocked &&
            !shouldRequireConfirmation &&
            !isCritical,
          blockedReason:
            isBlocked || isCritical ? suggestion.blockedReason : undefined,
          confirmationPromptText:
            shouldRequireConfirmation && !isBlocked && !isCritical
              ? `确认未来使用 Skill“${suggestion.skillName}”。`
              : undefined,
          safetyNotes: [
            "Skill 建议只是参考性预览元数据。",
            "未安装、生成、下载或执行 Skill。",
            ...suggestion.safetyNotes,
          ],
        }),
      ];
    },
  );
}

function createInformationalRequests(
  input: AgentPermissionRequestPreviewInput,
  options: NormalizedOptions,
): AgentPermissionRequestPreviewItem[] {
  if (!options.includeInformationalRequests) {
    return [];
  }

  const requests: AgentPermissionRequestPreviewItem[] = [];

  if (input.memoryContextPreview !== undefined) {
    requests.push(
      createRequestItem({
        id: "permission-memory-context-0",
        requestKind: AgentPermissionRequestKind.MemoryContextNotice,
        title: "记忆上下文仅为预览",
        description:
          "记忆上下文只由调用方提供的预览片段组装而成。未执行 MemoryStore.search、embedding、向量搜索、RAG 或模型摘要。",
        source: AgentPermissionRequestSource.MemoryContext,
        severity: AgentPermissionRequestSeverity.Info,
        currentAutonomyLevel: input.autonomyLevel,
        riskLevel: AgentExecutionReadinessRiskLevel.Low,
        allowedByCurrentAutonomy: true,
        safetyNotes: [
          "该提示本身不会阻断执行就绪。",
          "真实记忆检索仍需要未来明确的安全边界。",
        ],
      }),
    );
  }

  requests.push(
    createRequestItem({
      id: "permission-execution-disabled-0",
      requestKind: AgentPermissionRequestKind.ExecutionDisabledNotice,
      title: "真实执行仍已禁用",
      description:
        "该预览不能执行工具、调用模型、读取记忆、写入数据、保存权限决策或启动智能体运行时。",
      source: AgentPermissionRequestSource.Safety,
      severity: AgentPermissionRequestSeverity.Info,
      currentAutonomyLevel: input.autonomyLevel,
      riskLevel: input.executionReadinessPreview.overallRiskLevel,
      allowedByCurrentAutonomy: true,
      safetyNotes: [REAL_EXECUTION_DISABLED_NOTE],
    }),
  );

  return requests;
}

function createRequestItem(
  input: CreateRequestItemInput,
): AgentPermissionRequestPreviewItem {
  const request: AgentPermissionRequestPreviewItem = {
    id: input.id,
    requestKind: input.requestKind,
    title: input.title,
    description: input.description,
    source: input.source,
    severity: input.severity,
    currentAutonomyLevel: input.currentAutonomyLevel,
    relatedToolNames: normalizeUniqueStrings(input.relatedToolNames ?? []),
    relatedToolCategories: normalizeUniqueStrings(
      input.relatedToolCategories ?? [],
    ),
    relatedSkillNames: normalizeUniqueStrings(input.relatedSkillNames ?? []),
    relatedStepIds: normalizeUniqueStrings(input.relatedStepIds ?? []),
    relatedStepIndexes: normalizeUniqueNumbers(input.relatedStepIndexes ?? []),
    requiresUserConfirmation:
      input.requiresUserConfirmation ??
      input.severity === AgentPermissionRequestSeverity.Required,
    allowedByCurrentAutonomy:
      input.allowedByCurrentAutonomy ??
      input.severity === AgentPermissionRequestSeverity.Info,
    safetyNotes: normalizeUniqueStrings(input.safetyNotes ?? []),
  };

  if (input.riskLevel !== undefined) {
    request.riskLevel = input.riskLevel;
  }

  if (input.requiredAutonomyLevel !== undefined) {
    request.requiredAutonomyLevel = input.requiredAutonomyLevel;
  }

  if (input.blockedReason !== undefined) {
    request.blockedReason = input.blockedReason;
  }

  if (input.confirmationPromptText !== undefined) {
    request.confirmationPromptText = input.confirmationPromptText;
  }

  return request;
}

function getRequestStatus(input: {
  readonly executionReadinessPreview: AgentExecutionReadinessPreview;
  readonly blockedRequests: readonly AgentPermissionRequestPreviewItem[];
  readonly requiredRequests: readonly AgentPermissionRequestPreviewItem[];
  readonly requiresConfirmation: boolean;
  readonly permissionRequests: readonly AgentPermissionRequestPreviewItem[];
}): AgentPermissionRequestStatus {
  if (input.blockedRequests.length > 0) {
    return AgentPermissionRequestStatus.Blocked;
  }

  if (
    input.executionReadinessPreview.readinessStatus ===
      AgentExecutionReadinessStatus.NotReady ||
    input.executionReadinessPreview.blockers.length > 0
  ) {
    return AgentPermissionRequestStatus.NotReady;
  }

  if (
    input.executionReadinessPreview.readinessStatus ===
    AgentExecutionReadinessStatus.Blocked
  ) {
    return AgentPermissionRequestStatus.Blocked;
  }

  if (input.requiredRequests.length > 0 || input.requiresConfirmation) {
    return AgentPermissionRequestStatus.ConfirmationRequired;
  }

  if (
    input.executionReadinessPreview.readinessStatus ===
    AgentExecutionReadinessStatus.PreviewOnly
  ) {
    return AgentPermissionRequestStatus.PreviewOnly;
  }

  if (input.permissionRequests.length > 0) {
    return AgentPermissionRequestStatus.NoPermissionRequired;
  }

  return AgentPermissionRequestStatus.NoPermissionRequired;
}

function createConfirmationSummary(input: {
  readonly requiredRequests: readonly AgentPermissionRequestPreviewItem[];
  readonly blockedRequests: readonly AgentPermissionRequestPreviewItem[];
  readonly informationalRequests: readonly AgentPermissionRequestPreviewItem[];
}): AgentPermissionConfirmationSummary {
  const confirmationPromptTexts = normalizeUniqueStrings(
    input.requiredRequests
      .map((request) => request.confirmationPromptText)
      .filter((text): text is string => text !== undefined),
  );

  return {
    requiresUserConfirmation: input.requiredRequests.length > 0,
    requiredRequestCount: input.requiredRequests.length,
    blockedRequestCount: input.blockedRequests.length,
    informationalRequestCount: input.informationalRequests.length,
    approvableRequestIds: input.requiredRequests.map((request) => request.id),
    blockedRequestIds: input.blockedRequests.map((request) => request.id),
    confirmationPromptTexts,
    summaryText: createConfirmationSummaryText(input),
  };
}

function createConfirmationSummaryText(input: {
  readonly requiredRequests: readonly AgentPermissionRequestPreviewItem[];
  readonly blockedRequests: readonly AgentPermissionRequestPreviewItem[];
  readonly informationalRequests: readonly AgentPermissionRequestPreviewItem[];
}): string {
  if (input.blockedRequests.length > 0) {
    return `${input.blockedRequests.length} request(s) are blocked and cannot be approved in preview.`;
  }

  if (input.requiredRequests.length > 0) {
    return `${input.requiredRequests.length} request(s) would need explicit user confirmation before future execution.`;
  }

  if (input.informationalRequests.length > 0) {
    return "该预览不需要批准；提示信息仍仅用于展示。";
  }

  return "未生成权限请求，执行仍保持禁用。";
}

function createRiskSummary(input: {
  readonly input: AgentPermissionRequestPreviewInput;
  readonly options: NormalizedOptions;
  readonly overallRiskLevel: AgentPermissionRequestRiskLevel;
}): AgentPermissionRiskSummary {
  return {
    overallRiskLevel: input.overallRiskLevel,
    criticalRiskBlocked:
      input.overallRiskLevel === AgentExecutionReadinessRiskLevel.Critical &&
      input.options.blockCriticalRisk,
    highRiskRequiresConfirmation:
      isKnownRiskLevel(input.overallRiskLevel) &&
      isRiskAtLeast(input.overallRiskLevel, AutonomyRiskLevel.High) &&
      input.overallRiskLevel !== AgentExecutionReadinessRiskLevel.Critical &&
      input.options.requireConfirmationForHighRisk,
    mediumRiskRequiresConfirmation:
      input.overallRiskLevel === AgentExecutionReadinessRiskLevel.Medium &&
      input.options.requireConfirmationForMediumRisk,
    unknownRiskRequiresConfirmation:
      input.overallRiskLevel === AgentExecutionReadinessRiskLevel.Unknown,
    riskReasons: normalizeUniqueStrings([
      ...input.input.executionReadinessPreview.riskSummary.riskReasons,
      ...input.input.executionReadinessPreview.confirmationReasons,
    ]),
  };
}

function createRecommendedNextActions(input: {
  readonly input: AgentPermissionRequestPreviewInput;
  readonly blockedRequests: readonly AgentPermissionRequestPreviewItem[];
  readonly requiredRequests: readonly AgentPermissionRequestPreviewItem[];
  readonly informationalRequests: readonly AgentPermissionRequestPreviewItem[];
  readonly riskSummary: AgentPermissionRiskSummary;
}): string[] {
  const actions: string[] = [];

  if (
    input.blockedRequests.some(
      (request) => request.source === AgentPermissionRequestSource.ToolRequirement,
    )
  ) {
    actions.push("在启用执行前审查已阻断的工具需求。");
  }

  if (input.riskSummary.criticalRiskBlocked) {
    actions.push("保持严重风险任务阻断。");
  }

  if (input.requiredRequests.length > 0) {
    actions.push("在运行时前添加真实权限确认 UI。");
  }

  if (input.input.toolRequirementReview.requirements.length > 0) {
    actions.push("允许执行前先实现工具沙箱。");
  }

  if ((input.input.skillSuggestionPreview?.suggestions.length ?? 0) > 0) {
    actions.push("任何 Skill 执行前都要增加 Skill 权限审查。");
  }

  if (input.input.memoryContextPreview !== undefined) {
    actions.push("将真实记忆检索放在未来明确边界之后。");
  }

  if (input.informationalRequests.length > 0) {
    actions.push("将提示信息与可批准请求分开。");
  }

  actions.push("只在未来明确边界中持久化权限决策。");
  actions.push("在智能体运行时、审计日志和权限流程存在前，保持真实执行禁用。");

  return normalizeUniqueStrings(actions);
}

function createSafetyNotes(input: {
  readonly input: AgentPermissionRequestPreviewInput;
  readonly options: NormalizedOptions;
  readonly originalRequestCount: number;
  readonly visibleRequestCount: number;
}): string[] {
  const notes = [
    "权限请求预览是确定性的，且仅为预览。",
    "未捕获用户权限决策。",
    "未执行智能体任务。",
    "未执行工具。",
    "未调用模型。",
    "未发起网络请求。",
    "未调用 MemoryStore.search。",
    "未执行 embedding、向量搜索或 RAG。",
    "未生成、安装、下载或执行 Skill。",
    "未读取或写入数据库。",
    "未保存权限请求或决策。",
    REAL_EXECUTION_DISABLED_NOTE,
  ];

  if (input.visibleRequestCount < input.originalRequestCount) {
    notes.push(
      `Request list was truncated by maxRequests=${input.options.maxRequests?.toString()}.`,
    );
  }

  return normalizeUniqueStrings(notes);
}

function getDecisionStatus(input: {
  readonly preview: AgentPermissionRequestPreview;
  readonly approvableRequestIds: readonly string[];
  readonly blockedRequestIds: readonly string[];
}): AgentPermissionDecisionStatus {
  if (input.preview.requestStatus === AgentPermissionRequestStatus.Disabled) {
    return AgentPermissionDecisionStatus.Disabled;
  }

  if (
    input.preview.requestStatus === AgentPermissionRequestStatus.Blocked ||
    input.preview.requestStatus === AgentPermissionRequestStatus.NotReady ||
    input.blockedRequestIds.length > 0
  ) {
    return AgentPermissionDecisionStatus.Blocked;
  }

  if (input.approvableRequestIds.length > 0) {
    return AgentPermissionDecisionStatus.PendingUserConfirmation;
  }

  if (
    input.preview.requestStatus ===
    AgentPermissionRequestStatus.NoPermissionRequired
  ) {
    return AgentPermissionDecisionStatus.NoDecisionCaptured;
  }

  return AgentPermissionDecisionStatus.PreviewOnly;
}

function isInformationalRequest(
  request: AgentPermissionRequestPreviewItem,
): boolean {
  return (
    request.severity === AgentPermissionRequestSeverity.Info ||
    request.severity === AgentPermissionRequestSeverity.Warning
  );
}

function isCriticalRiskRequest(
  request: AgentPermissionRequestPreviewItem,
): boolean {
  return request.riskLevel === AgentExecutionReadinessRiskLevel.Critical;
}

function applyDecisionItemLimit(
  items: readonly AgentPermissionDecisionItemPreview[],
  maxItems: number | undefined,
): AgentPermissionDecisionItemPreview[] {
  if (maxItems === undefined || items.length <= maxItems) {
    return [...items];
  }

  const selectedIds = new Set(
    items
      .map((item, index) => ({ item, index }))
      .sort((left, right) => {
        const priorityDifference =
          getDecisionKindPriority(right.item.decisionKind) -
          getDecisionKindPriority(left.item.decisionKind);

        if (priorityDifference !== 0) {
          return priorityDifference;
        }

        return left.index - right.index;
      })
      .slice(0, maxItems)
      .map(({ item }) => item.requestId),
  );

  return items.filter((item) => selectedIds.has(item.requestId));
}

function getDecisionKindPriority(
  decisionKind: AgentPermissionDecisionKind,
): number {
  if (decisionKind === AgentPermissionDecisionKind.WouldRemainBlocked) {
    return 4;
  }

  if (
    decisionKind === AgentPermissionDecisionKind.WouldRequireUserApproval
  ) {
    return 3;
  }

  if (decisionKind === AgentPermissionDecisionKind.InformationalOnly) {
    return 2;
  }

  return 1;
}

function normalizeOptions(
  options: AgentPermissionRequestPreviewOptions | undefined,
): NormalizedOptions {
  return {
    includeInformationalRequests:
      options?.includeInformationalRequests ?? true,
    blockCriticalRisk: options?.blockCriticalRisk ?? true,
    requireConfirmationForHighRisk:
      options?.requireConfirmationForHighRisk ?? true,
    requireConfirmationForMediumRisk:
      options?.requireConfirmationForMediumRisk ?? false,
    requireToolConfirmation: options?.requireToolConfirmation ?? true,
    maxRequests: normalizeMaxRequests(options?.maxRequests),
  };
}

function normalizeMaxRequests(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.max(0, Math.floor(value));
}

function applyRequestLimit(
  requests: readonly AgentPermissionRequestPreviewItem[],
  maxRequests: number | undefined,
): AgentPermissionRequestPreviewItem[] {
  if (maxRequests === undefined || requests.length <= maxRequests) {
    return [...requests];
  }

  const selectedIds = new Set(
    requests
      .map((request, index) => ({ request, index }))
      .sort((left, right) => {
        const priorityDifference =
          getSeverityPriority(right.request.severity) -
          getSeverityPriority(left.request.severity);

        if (priorityDifference !== 0) {
          return priorityDifference;
        }

        return left.index - right.index;
      })
      .slice(0, maxRequests)
      .map(({ request }) => request.id),
  );

  return requests.filter((request) => selectedIds.has(request.id));
}

function getSeverityPriority(
  severity: AgentPermissionRequestSeverity,
): number {
  if (severity === AgentPermissionRequestSeverity.Blocked) {
    return 4;
  }

  if (severity === AgentPermissionRequestSeverity.Required) {
    return 3;
  }

  if (severity === AgentPermissionRequestSeverity.Warning) {
    return 2;
  }

  return 1;
}

function isHardBlockedToolRequirement(
  review: AgentToolRequirementReviewPreview,
  requirement: AgentToolRequirementPreviewItem,
): boolean {
  if (
    review.reviewStatus === AgentToolRequirementReviewStatus.Blocked &&
    requirement.blockedReason !== "preview_only_execution_disabled"
  ) {
    return true;
  }

  return TOOL_HARD_BLOCKED_REASONS.has(requirement.blockedReason);
}

function isHardBlockedSkillSuggestion(
  suggestion: AgentSkillSuggestionPreviewItem,
): boolean {
  return SKILL_HARD_BLOCKED_REASONS.has(suggestion.blockedReason);
}

function createToolRequestDescription(
  requirement: AgentToolRequirementPreviewItem,
  isBlocked: boolean,
): string {
  const toolText =
    requirement.candidateToolNames.length > 0
      ? `候选工具：${formatList(requirement.candidateToolNames)}。`
      : "没有可用的候选工具元数据。";

  if (isBlocked) {
    return `${toolText} 该工具需求已被阻断：${requirement.blockedReason}。`;
  }

  if (requirement.requiresConfirmation) {
    return `${toolText} 该工具需求在未来执行前需要用户确认。`;
  }

  return `${toolText} 该工具需求在预览中仅用于提示信息。`;
}

function createSkillRequestDescription(
  suggestion: AgentSkillSuggestionPreviewItem,
  isBlocked: boolean,
): string {
  if (isBlocked) {
    return `Skill“${suggestion.skillName}”已被阻断，不能用于未来执行：${suggestion.blockedReason}。`;
  }

  if (suggestion.requiresConfirmation) {
    return `Skill“${suggestion.skillName}”在未来执行前需要用户确认。`;
  }

  return `Skill“${suggestion.skillName}”是提示性的预览元数据。`;
}

function getRequiredAutonomyLevel(
  input: AgentPermissionRequestPreviewInput,
): AutonomyLevelValue | undefined {
  const requiredLevels = [
    input.planPreview?.suggestedAutonomyLevel,
    ...(input.skillSuggestionPreview?.suggestions ?? []).map(
      (suggestion) => suggestion.requiredAutonomyLevel,
    ),
  ].filter((level): level is AutonomyLevelValue => level !== undefined);

  return requiredLevels.reduce<AutonomyLevelValue | undefined>(
    (highestLevel, level) => {
      if (
        highestLevel === undefined ||
        compareAutonomyLevel(level, highestLevel) > 0
      ) {
        return level;
      }

      return highestLevel;
    },
    undefined,
  );
}

function hasRequiredAutonomyLevel(
  current: AutonomyLevelValue,
  required: AutonomyLevelValue,
): boolean {
  return compareAutonomyLevel(current, required) >= 0;
}

function compareAutonomyLevel(
  left: AutonomyLevelValue,
  right: AutonomyLevelValue,
): -1 | 0 | 1 {
  const difference = getAutonomyRank(left) - getAutonomyRank(right);

  if (difference < 0) {
    return -1;
  }

  if (difference > 0) {
    return 1;
  }

  return 0;
}

function getAutonomyRank(autonomyLevel: AutonomyLevelValue): number {
  const ranks: Record<AutonomyLevelValue, number> = {
    [AutonomyLevel.Manual]: 1,
    [AutonomyLevel.ConfirmTools]: 2,
    [AutonomyLevel.Supervised]: 3,
    [AutonomyLevel.Autonomous]: 4,
  };

  return ranks[autonomyLevel];
}

function mapReadinessSource(
  source: AgentExecutionReadinessSourceValue,
): AgentPermissionRequestSource {
  if (source === AgentExecutionReadinessSource.Tools) {
    return AgentPermissionRequestSource.ToolRequirement;
  }

  if (source === AgentExecutionReadinessSource.Skills) {
    return AgentPermissionRequestSource.SkillSuggestion;
  }

  if (source === AgentExecutionReadinessSource.Memory) {
    return AgentPermissionRequestSource.MemoryContext;
  }

  if (source === AgentExecutionReadinessSource.Autonomy) {
    return AgentPermissionRequestSource.Autonomy;
  }

  if (source === AgentExecutionReadinessSource.Safety) {
    return AgentPermissionRequestSource.Safety;
  }

  return AgentPermissionRequestSource.ExecutionReadiness;
}

function normalizeSkillRiskLevel(
  riskLevel: AgentSkillSuggestionRiskLevelValue,
): AgentPermissionRequestRiskLevel {
  if (riskLevel === AgentSkillSuggestionRiskLevel.Unknown) {
    return AgentExecutionReadinessRiskLevel.Unknown;
  }

  return riskLevel;
}

function isKnownRiskLevel(
  riskLevel: AgentPermissionRequestRiskLevel,
): riskLevel is RiskLevel {
  return (
    riskLevel === AutonomyRiskLevel.Low ||
    riskLevel === AutonomyRiskLevel.Medium ||
    riskLevel === AutonomyRiskLevel.High ||
    riskLevel === AutonomyRiskLevel.Critical
  );
}

function isKnownSkillRiskLevel(
  riskLevel: AgentSkillSuggestionRiskLevelValue,
): riskLevel is RiskLevel {
  return (
    riskLevel === AutonomyRiskLevel.Low ||
    riskLevel === AutonomyRiskLevel.Medium ||
    riskLevel === AutonomyRiskLevel.High ||
    riskLevel === AutonomyRiskLevel.Critical
  );
}

function getOptionalStepIds(stepId: string | undefined): string[] {
  return stepId === undefined ? [] : [stepId];
}

function formatList(values: readonly string[]): string {
  const normalizedValues = normalizeUniqueStrings(values);

  return normalizedValues.length === 0 ? "无" : normalizedValues.join(", ");
}

function createPreviewId(
  input: AgentPermissionRequestPreviewInput,
  options: NormalizedOptions,
  overallRiskLevel: AgentPermissionRequestRiskLevel,
  requestStatus: AgentPermissionRequestStatus,
): string {
  const stableParts = [
    input.executionReadinessPreview.previewId,
    input.toolRequirementReview.planPreviewId,
    input.planPreview?.previewId ?? "",
    input.skillSuggestionPreview?.previewId ?? "",
    input.memoryContextPreview?.previewId ?? "",
    input.autonomyLevel,
    overallRiskLevel,
    requestStatus,
    options.includeInformationalRequests.toString(),
    options.blockCriticalRisk.toString(),
    options.requireConfirmationForHighRisk.toString(),
    options.requireConfirmationForMediumRisk.toString(),
    options.requireToolConfirmation.toString(),
    options.maxRequests?.toString() ?? "",
  ];

  return `permission_request_preview_${hashString(stableParts.join("|"))}`;
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
