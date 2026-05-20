import type { AutonomyLevel as AutonomyLevelValue } from "../autonomy/types";
import type { AgentMetadata } from "./types";
import type { AgentTaskPlanPreview } from "./plan-preview";
import type { AgentToolRequirementReviewPreview } from "./tool-requirement-review-preview";
import type { AgentSkillSuggestionPreview } from "./skill-suggestion-preview";
import type { AgentMemoryContextPreview } from "./memory-context-preview";
import type {
  AgentExecutionReadinessPreview,
  AgentExecutionReadinessRiskLevel,
} from "./execution-readiness-preview";

export const AgentTaskLifecycleStatus = {
  PreviewCreated: "preview_created",
  PreviewUpdated: "preview_updated",
  ReadinessReviewed: "readiness_reviewed",
  Blocked: "blocked",
  NeedsConfirmation: "needs_confirmation",
  ReadyForFutureManualReview: "ready_for_future_manual_review",
  ExecutionDisabled: "execution_disabled",
  ArchivedPreview: "archived_preview",
} as const;

export type AgentTaskLifecycleStatus =
  (typeof AgentTaskLifecycleStatus)[keyof typeof AgentTaskLifecycleStatus];

export const AgentTaskRecordMode = {
  PreviewOnly: "preview_only",
  Disabled: "disabled",
} as const;

export type AgentTaskRecordMode =
  (typeof AgentTaskRecordMode)[keyof typeof AgentTaskRecordMode];

export const AgentTaskRecordSource = {
  User: "user",
  SystemPreview: "system_preview",
  AgentPreview: "agent_preview",
  SafetyPreview: "safety_preview",
} as const;

export type AgentTaskRecordSource =
  (typeof AgentTaskRecordSource)[keyof typeof AgentTaskRecordSource];

export const AgentTaskSnapshotKind = {
  PlanPreview: "plan_preview",
  ToolRequirementReview: "tool_requirement_review",
  SkillSuggestion: "skill_suggestion",
  MemoryContext: "memory_context",
  ExecutionReadiness: "execution_readiness",
  CombinedPreview: "combined_preview",
} as const;

export type AgentTaskSnapshotKind =
  (typeof AgentTaskSnapshotKind)[keyof typeof AgentTaskSnapshotKind];

export const AgentTaskEventType = {
  PreviewCreated: "preview_created",
  PreviewUpdated: "preview_updated",
  PlanPreviewGenerated: "plan_preview_generated",
  ToolRequirementReviewed: "tool_requirement_reviewed",
  SkillSuggestionsReviewed: "skill_suggestions_reviewed",
  MemoryContextPreviewed: "memory_context_previewed",
  ExecutionReadinessReviewed: "execution_readiness_reviewed",
  BlockedDetected: "blocked_detected",
  ConfirmationRequiredDetected: "confirmation_required_detected",
  ExecutionDisabledConfirmed: "execution_disabled_confirmed",
} as const;

export type AgentTaskEventType =
  (typeof AgentTaskEventType)[keyof typeof AgentTaskEventType];

export const AgentTaskEventSeverity = {
  Info: "info",
  Warning: "warning",
  Blocked: "blocked",
} as const;

export type AgentTaskEventSeverity =
  (typeof AgentTaskEventSeverity)[keyof typeof AgentTaskEventSeverity];

export type AgentTaskRecordRiskLevel = AgentExecutionReadinessRiskLevel;

export interface AgentTaskRecordSafetyFlags {
  executable: false;
  realExecutionEnabled: false;
  toolsExecuted: false;
  llmCalled: false;
  networkUsed: false;
  memoryRetrievalExecuted: false;
  embeddingsUsed: false;
  vectorSearchUsed: false;
  ragUsed: false;
  dataSaved: false;
  skillGenerated: false;
  skillInstalled: false;
  skillExecuted: false;
}

export const AGENT_TASK_RECORD_PREVIEW_SAFETY_FLAGS = {
  executable: false,
  realExecutionEnabled: false,
  toolsExecuted: false,
  llmCalled: false,
  networkUsed: false,
  memoryRetrievalExecuted: false,
  embeddingsUsed: false,
  vectorSearchUsed: false,
  ragUsed: false,
  dataSaved: false,
  skillGenerated: false,
  skillInstalled: false,
  skillExecuted: false,
} as const satisfies AgentTaskRecordSafetyFlags;

export interface AgentTaskRecordPreview {
  id?: string;
  taskText: string;
  taskSummary: string;
  source: AgentTaskRecordSource;
  mode: AgentTaskRecordMode;
  lifecycleStatus: AgentTaskLifecycleStatus;
  autonomyLevel: AutonomyLevelValue;
  overallRiskLevel: AgentTaskRecordRiskLevel;
  executable: false;
  realExecutionEnabled: false;
  createdAt?: string;
  updatedAt?: string;
  planPreview?: AgentTaskPlanPreview;
  toolRequirementReview?: AgentToolRequirementReviewPreview;
  skillSuggestionPreview?: AgentSkillSuggestionPreview;
  memoryContextPreview?: AgentMemoryContextPreview;
  executionReadinessPreview?: AgentExecutionReadinessPreview;
  snapshots: readonly AgentTaskSnapshotPreview[];
  events: readonly AgentTaskEventPreview[];
  safetyFlags: AgentTaskRecordSafetyFlags;
  safetyNotes: readonly string[];
  metadata?: AgentMetadata;
}

export interface AgentTaskSnapshotPreview {
  id?: string;
  taskRecordId?: string;
  snapshotKind: AgentTaskSnapshotKind;
  lifecycleStatus: AgentTaskLifecycleStatus;
  taskSummary: string;
  capturedAt?: string;
  executable: false;
  realExecutionEnabled: false;
  planPreview?: AgentTaskPlanPreview;
  toolRequirementReview?: AgentToolRequirementReviewPreview;
  skillSuggestionPreview?: AgentSkillSuggestionPreview;
  memoryContextPreview?: AgentMemoryContextPreview;
  executionReadinessPreview?: AgentExecutionReadinessPreview;
  safetyNotes: readonly string[];
  metadata?: AgentMetadata;
}

export interface AgentTaskEventPreview {
  id?: string;
  taskRecordId?: string;
  eventType: AgentTaskEventType;
  source: AgentTaskRecordSource;
  message: string;
  severity: AgentTaskEventSeverity;
  occurredAt?: string;
  relatedStepIds?: readonly string[];
  relatedStepIndexes?: readonly number[];
  relatedToolNames?: readonly string[];
  relatedSkillNames?: readonly string[];
  safetyNotes?: readonly string[];
  metadata?: AgentMetadata;
}
