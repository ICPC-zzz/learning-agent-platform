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
