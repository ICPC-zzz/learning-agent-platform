import type { AutonomyPolicy } from "../autonomy/types";
import type { EmbeddingProvider } from "../embeddings/types";
import type { LlmProvider } from "../llm/types";
import type { MemoryItem, MemoryStore } from "../memory/types";
import type { SkillRuntime } from "../skills/types";
import type { ToolCallResult, ToolRuntime } from "../tools/types";

type JsonPrimitive = string | number | boolean | null;
type JsonValue =
  | JsonPrimitive
  | { readonly [key: string]: JsonValue }
  | readonly JsonValue[];

export type AgentMetadata = { readonly [key: string]: JsonValue };

export interface AgentContext {
  userId?: string;
  sessionId?: string;
  source?: string;
  metadata?: AgentMetadata;
}

export interface AgentInput {
  message: string;
  context: AgentContext;
}

export interface AgentOutput {
  message: string;
  toolCalls?: readonly ToolCallResult[];
  memoryWrites?: readonly MemoryItem[];
  metadata?: AgentMetadata;
}

export interface AgentRuntimeDependencies {
  llm?: LlmProvider;
  embeddings?: EmbeddingProvider;
  memory?: MemoryStore;
  tools?: ToolRuntime;
  skills?: SkillRuntime;
  autonomy?: AutonomyPolicy;
}

export interface AgentRuntime {
  respond(input: AgentInput): Promise<AgentOutput>;
}
