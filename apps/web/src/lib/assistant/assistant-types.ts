export type AssistantPageType =
  | "home"
  | "articles"
  | "article_list"
  | "article_detail"
  | "books"
  | "book_detail"
  | "problems"
  | "problem_detail"
  | "user"
  | "ai"
  | "reader"
  | "learning"
  | "import"
  | "ask"
  | "unknown";

export interface AssistantVisibleItem {
  id?: string;
  title: string;
  summary?: string;
  route?: string;
}

export interface AssistantChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  archivedAt?: string;
  compressionId?: string;
  compressionReason?: "context_budget" | "user_requested" | "conversation_boundary";
  compressionTrigger?: "manual_button" | "conversation_command" | "auto_budget";
  compressionBeforeEstimatedTokens?: number;
  compressionAfterEstimatedTokens?: number;
  archivedMessageCount?: number;
  retainedMessageCount?: number;
  actions?: AssistantAction[];
  sources?: AssistantSource[];
  usedTools?: string[];
  toolTimeline?: AssistantToolTimelineItem[];
  state?: AssistantResponse["state"];
  providerMode?: AssistantResponse["providerMode"];
}

export interface AssistantConversationSnapshot {
  conversationId: string;
  messages: readonly AssistantChatMessage[];
  draftQuestion?: string;
  tasks?: readonly AssistantMultiAgentTaskView[];
}

export interface AssistantStructuredCompressionSummary {
  userCurrentGoal: readonly string[];
  confirmedFacts: readonly string[];
  explicitConstraints: readonly string[];
  decisionsMade: readonly string[];
  unresolvedQuestions: readonly string[];
  importantCodeOrErrorClues: readonly string[];
  recentConversationState: readonly string[];
}

export interface AssistantCompressionRecordView {
  id: string;
  reason: "context_budget" | "user_requested" | "conversation_boundary";
  trigger: "manual_button" | "conversation_command" | "auto_budget";
  summary: AssistantStructuredCompressionSummary;
  summaryText: string;
  beforeEstimatedTokens: number;
  afterEstimatedTokens: number;
  archivedMessageCount: number;
  retainedMessageCount: number;
  compressedThroughMessageId: string;
  createdAt: string;
  compressorKind: "local_structured_v1";
}

export interface AssistantContextBudgetView {
  estimatedTokens: number;
  contextWindowTokens: number;
  effectiveInputLimit: number;
  percentUsed: number;
  status: "within_budget" | "warning" | "needs_compression" | "blocking";
  warningThreshold: number;
  compressionThreshold: number;
  blockingThreshold: number;
  tokenEstimateLabel: "估算值";
  contextWindowSource: "model_profile" | "env" | "development_default";
}

export interface AssistantContextCompressionView {
  conversationId: string;
  lastCompressedAt: string | null;
  compressionCount: number;
  latestCompression: AssistantCompressionRecordView | null;
  budget: AssistantContextBudgetView;
  activeMessageCount: number;
  archivedMessageCount: number;
  includedMessageIds: readonly string[];
  excludedArchivedMessageIds: readonly string[];
}

export type AssistantConversationStatus = "active" | "archived" | "deleted";

export interface AssistantConversationListItem {
  id: string;
  title: string;
  status: AssistantConversationStatus;
  recentMessagePreview: string;
  messageCount: number;
  activeMessageCount: number;
  archivedMessageCount: number;
  compressionCount: number;
  longTermMemoryCount: number;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  deletedAt: string | null;
}

export interface SafeAssistantPageContext {
  route: string;
  pageType: AssistantPageType;
  title?: string;
  entityId?: string;
  summary?: string;
  tags?: string[];
  rating?: number;
  visibleItems?: AssistantVisibleItem[];
}

export interface SafeAssistantPageContextInput {
  route?: string;
  pageType?: AssistantPageType;
  title?: string;
  entityId?: string;
  summary?: string;
  tags?: readonly string[];
  rating?: number;
  visibleItems?: readonly AssistantVisibleItem[];
}

export type AssistantMemoryCategory =
  | "preference"
  | "goal"
  | "learning"
  | "project"
  | "other";

export type AssistantMemorySource =
  | "user_created"
  | "assistant_suggested";

export interface AssistantMemoryRecord {
  id: string;
  userId: string;
  sessionId?: string | null;
  sourceMessageId?: string | null;
  memoryType?: "PROFILE" | "SESSION_SUMMARY" | "RETRIEVABLE";
  content: string;
  category: AssistantMemoryCategory;
  source: AssistantMemorySource;
  enabled: boolean;
  importance: number;
  metadata?: Record<string, unknown> | null;
  lifecycleStatus?: "active" | "historical" | "archived" | "superseded" | "deleted";
  sourceConversationId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssistantMemoryInput {
  content: string;
  category?: AssistantMemoryCategory;
  source?: AssistantMemorySource;
  enabled?: boolean;
  importance?: number;
  memoryType?: "PROFILE" | "SESSION_SUMMARY" | "RETRIEVABLE";
  sessionId?: string | null;
  sourceMessageId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface AssistantLearningContextSummary {
  userLabel?: string;
  hasSession: boolean;
  abilityBand?: string;
  currentLevel?: string;
  recentPracticeCount: number;
  recentProblemIds: string[];
  recentAttemptSummary: string;
  recentWrongBookSummary: string;
  recentReadingSummary: string;
  learningGoalSummary: string;
  codeforcesProfileSummary?: string;
  learningReportSummary?: string;
  reviewPlanSummary?: string;
  recentCodeAnalysisSummary?: string;
  recentRouteHint?: string;
}

export interface AssistantActionNavigateInternal {
  type: "navigate_internal";
  label: string;
  route: string;
  reason?: string;
}

export type AssistantAction = AssistantActionNavigateInternal;

export interface AssistantSource {
  title: string;
  source: string;
  url: string;
}

export interface AssistantToolTimelineItem {
  status:
    | "completed"
    | "empty"
    | "cancelled"
    | "timed_out"
    | "permission_denied"
    | "failed"
    | "skipped";
  toolName: string;
  startedAt: string;
  completedAt: string;
  durationMs?: number;
  dataSource: string;
  usedCache: boolean;
  safetySummary: string;
  retryable?: boolean;
}

export type AssistantMultiAgentTaskStatus =
  | "queued"
  | "running"
  | "partial_success"
  | "succeeded"
  | "failed"
  | "cancel_requested"
  | "cancelled"
  | "timed_out";

export type AssistantAgentRunStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "timed_out"
  | "skipped";

export type AssistantAgentName =
  | "Orchestrator"
  | "LearnerProfile"
  | "CandidateRecommendation"
  | "UpcomingContest"
  | "ResultAggregator";

export type AssistantAgentAuditEventType =
  | "task_created"
  | "task_started"
  | "task_cancel_requested"
  | "task_cancelled"
  | "task_timed_out"
  | "task_completed"
  | "task_partial_success"
  | "task_failed"
  | "agent_queued"
  | "agent_started"
  | "agent_succeeded"
  | "agent_failed"
  | "agent_timed_out"
  | "agent_cancelled"
  | "agent_retry_requested"
  | "agent_retry_started"
  | "agent_retry_succeeded"
  | "tool_started"
  | "tool_succeeded"
  | "tool_empty"
  | "tool_timed_out"
  | "tool_permission_denied"
  | "tool_failed"
  | "tool_cancelled"
  | "evidence_attached"
  | "final_answer_created"
  | "final_answer_rebuilt"
  | "duplicate_request_reused"
  | "budget_warning"
  | "budget_blocked"
  | "agent_loop_started"
  | "memory_context_loaded"
  | "model_request_started"
  | "model_tool_calls_received"
  | "tool_call_validation_failed"
  | "tool_call_queued"
  | "tool_call_started"
  | "tool_call_completed"
  | "tool_result_budget_applied"
  | "tool_result_artifact_stored"
  | "tool_result_appended"
  | "tool_result_microcompacted"
  | "context_budget_warning"
  | "context_compressed"
  | "context_compression_failed"
  | "context_compression_paused"
  | "context_blocked"
  | "model_continuation_started"
  | "model_final_answer_received"
  | "agent_loop_limit_reached"
  | "agent_loop_cancelled"
  | "agent_loop_timed_out"
  | "agent_loop_failed"
  | "agent_loop_completed";

export type AssistantEvidenceType =
  | "learning_report"
  | "codeforces_account_snapshot"
  | "local_curated_problem_pool"
  | "codeforces_contest_list"
  | "cached_contest_list"
  | "code_analysis_record"
  | "review_plan"
  | "user_long_term_memory"
  | "assistant_task";

export type AssistantTaskFinalAnswerStatus =
  | "pending"
  | "available"
  | "partial"
  | "cancelled"
  | "failed";

export type AssistantStabilityInjectionMode =
  | "normal"
  | "fail_upcoming_once"
  | "timeout_candidate_once"
  | "delay_task_for_cancel"
  | "tool_empty_once"
  | "tool_internal_error_once"
  | "tool_timeout_once"
  | "tool_cancel_once"
  | "tool_permission_denied_once"
  | "tool_large_result_once"
  | "tool_unknown_once"
  | "tool_duplicate_once"
  | "agent_loop_max_turns"
  | "agent_loop_max_tool_calls"
  | "tool_calling_unsupported"
  | "context_compression_failure";

export interface AssistantTaskLimitsView {
  taskTimeoutMs: number;
  agentTimeoutMs: Record<AssistantAgentName, number>;
  maxAgents: number;
  maxToolCalls: number;
  maxAgentRetries: number;
  maxTaskRetries: number;
  maxEvidence: number;
  maxCandidateProblems: number;
  maxEstimatedTokens: number;
  maxProviderCalls: number;
}

export interface AssistantEvidenceReference {
  id: string;
  type: AssistantEvidenceType;
  label: string;
  source: string;
  recordId?: string;
  officialUrl?: string;
  fetchedAt?: string;
  cached: boolean;
  realtime: boolean;
  safeSummary: string;
  usedByAgentNames: AssistantAgentName[];
}

export interface AssistantArtifactSourceRef {
  title: string;
  source: string;
  url?: string;
  recordId?: string;
  cached?: boolean;
  safeSummary?: string;
}

export interface AssistantToolResultArtifactView {
  artifactId: string;
  conversationId: string;
  runId: string;
  toolCallId: string;
  toolName: string;
  contentType: "application/json";
  safePreview: string;
  sourceRefs: AssistantArtifactSourceRef[];
  size: number;
  createdAt: string;
  expiresAt: string | null;
  sensitiveResultNotPersisted?: boolean;
}

export interface AssistantAgentRunView {
  id: string;
  taskId: string;
  agentName: AssistantAgentName;
  role: string;
  status: AssistantAgentRunStatus;
  attempt: number;
  startedAt: string | null;
  completedAt: string | null;
  timeoutMs: number;
  usedTools: string[];
  sourceRefs: string[];
  safeInputSummary: string;
  safeOutputSummary: string;
  errorCode?: string;
  retryable: boolean;
  developmentInjection?: string;
}

export interface AssistantAgentAuditEventView {
  id: string;
  taskId: string;
  agentRunId?: string;
  eventType: AssistantAgentAuditEventType;
  status: string;
  timestamp: string;
  safeMessage: string;
  toolName?: string;
  sourceRefs?: string[];
  attempt?: number;
}

export interface AssistantMultiAgentTaskView {
  id: string;
  conversationId: string;
  requestId: string;
  intent: "TRAINING_AND_CONTEST_PLAN";
  userVisibleRequest: string;
  status: AssistantMultiAgentTaskStatus;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  currentAttempt: number;
  limits: AssistantTaskLimitsView;
  finalAnswer: string | null;
  finalAnswerStatus: AssistantTaskFinalAnswerStatus;
  errorCode?: string;
  agentRuns: AssistantAgentRunView[];
  auditEvents: AssistantAgentAuditEventView[];
  evidence: AssistantEvidenceReference[];
  toolResultArtifacts: AssistantToolResultArtifactView[];
  completedAgentCount: number;
  failedAgentCount: number;
  partial: boolean;
  canCancel: boolean;
  canRetryTask: boolean;
  canRetryAgentNames: AssistantAgentName[];
  stabilityInjectionMode: AssistantStabilityInjectionMode;
}

export interface AssistantUsedContextFlags {
  page: boolean;
  learning: boolean;
  memory: boolean;
}

export type AssistantResponseState =
  | "ok"
  | "blocked"
  | "unavailable"
  | "error";

export interface AssistantResponse {
  state: AssistantResponseState;
  message: string;
  actions: AssistantAction[];
  sources: AssistantSource[];
  usedTools: string[];
  toolTimeline?: AssistantToolTimelineItem[];
  usedContext: AssistantUsedContextFlags;
  providerMode: "real" | "blocked" | "unavailable" | "error";
  safeToExposeToClient: {
    currentRoute: string;
    pageType: AssistantPageType;
    pageContextUsed: boolean;
    learningContextUsed: boolean;
    memoryContextUsed: boolean;
    rawPromptStored: false;
    rawResponseStored: false;
    devOnly: true;
    productionReady: false;
  };
  blockedReasons: string[];
  warnings: string[];
  conversation?: AssistantConversationSnapshot;
  tasks?: AssistantMultiAgentTaskView[];
  contextCompression?: AssistantContextCompressionView;
  compressionEvent?: AssistantCompressionRecordView | null;
}

export interface AssistantRequestInput {
  question: string;
  pageContext: SafeAssistantPageContext;
  learningContext?: AssistantLearningContextSummary | null;
  memoryContext?: readonly AssistantMemoryRecord[] | null;
  conversation?: AssistantConversationSnapshot | null;
  userId?: string | null;
  requestId?: string | null;
  stabilityInjectionMode?: AssistantStabilityInjectionMode;
}
