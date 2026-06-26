export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | { readonly [key: string]: JsonValue }
  | readonly JsonValue[];

export type MemoryMetadata = { readonly [key: string]: JsonValue };
export type MemoryImportanceScore = number;

export const MemoryLayer = {
  Profile: "profile",
  Session: "session",
  Retrievable: "retrievable",
} as const;

export type MemoryLayer = (typeof MemoryLayer)[keyof typeof MemoryLayer];

export interface MemoryItem {
  id: string;
  userId?: string;
  sessionId?: string;
  layer: MemoryLayer;
  content: string;
  importance: MemoryImportanceScore;
  metadata?: MemoryMetadata;
  createdAt: string;
}

export interface MemoryAddInput {
  id?: string;
  userId?: string;
  sessionId?: string;
  layer: MemoryLayer;
  content: string;
  importance?: MemoryImportanceScore;
  metadata?: MemoryMetadata;
  createdAt?: string;
}

export interface MemorySearchFilters {
  userId?: string;
  sessionId?: string;
  layer?: MemoryLayer;
  layers?: readonly MemoryLayer[];
  metadata?: MemoryMetadata;
}

export interface MemorySearchQuery extends MemorySearchFilters {
  text?: string;
  query?: string;
  limit?: number;
}

export interface MemorySearchResult {
  item: MemoryItem;
  score: number;
  reason: string;
  metadata?: MemoryMetadata;
}

export interface MemorySessionSummaryInput {
  sessionId: string;
  userId?: string;
  text?: string;
  messages?: readonly string[];
  sourceItemIds?: readonly string[];
  maxLength?: number;
  metadata?: MemoryMetadata;
}

export type MemorySessionSummaryRequest = MemorySessionSummaryInput;

export interface MemoryStore {
  add(item: MemoryAddInput): Promise<MemoryItem>;
  search(query: MemorySearchQuery): Promise<MemorySearchResult[]>;
  summarizeSession?(
    request: MemorySessionSummaryInput,
  ): Promise<MemoryItem>;
}

export type WorkingMemoryRole = "system" | "user" | "assistant" | "tool";

export interface WorkingMemoryMessage {
  id: string;
  sessionId: string;
  role: WorkingMemoryRole;
  content: string;
  attachments?: readonly string[];
  createdAt: string;
}

export type CompactionTrigger = "auto" | "manual" | "budget_exceeded";

export interface CompactionBoundary {
  id: string;
  sessionId: string;
  trigger: CompactionTrigger;
  sourceMessageIds: readonly string[];
  sourceMessageRange: readonly [number, number];
  preTokenEstimate: number;
  postTokenEstimate: number;
  preservedTailMessageIds: readonly string[];
  summaryId?: string;
  createdAt: string;
}

export interface MemoryContextBundle {
  workingMemoryText: string;
  sessionSummaryText: string;
  retrievedMemoryText: string;
  promptText: string;
}

export type MemoryExtractionKind =
  | "preference"
  | "goal"
  | "learning"
  | "project"
  | "reference";

export interface MemoryExtractionCandidate {
  kind: MemoryExtractionKind;
  content: string;
  confidence: number;
  sourceMessageIds: readonly string[];
  sourceExcerpt: string;
}

export type MemoryAuditEventType =
  | "memory_added"
  | "memory_updated"
  | "memory_deleted"
  | "memory_retrieved"
  | "memory_compacted";

export interface MemoryAuditEvent {
  id: string;
  sessionId?: string;
  userId?: string;
  eventType: MemoryAuditEventType;
  message: string;
  details?: MemoryMetadata;
  createdAt: string;
}
