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
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  actions?: AssistantAction[];
  sources?: AssistantSource[];
  usedTools?: string[];
  state?: AssistantResponse["state"];
  providerMode?: AssistantResponse["providerMode"];
}

export interface AssistantConversationSnapshot {
  conversationId: string;
  messages: readonly AssistantChatMessage[];
  draftQuestion?: string;
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
}

export interface AssistantRequestInput {
  question: string;
  pageContext: SafeAssistantPageContext;
  learningContext?: AssistantLearningContextSummary | null;
  memoryContext?: readonly AssistantMemoryRecord[] | null;
  conversation?: AssistantConversationSnapshot | null;
  userId?: string | null;
}
