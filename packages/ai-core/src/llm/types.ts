type JsonPrimitive = string | number | boolean | null;
type JsonValue =
  | JsonPrimitive
  | { readonly [key: string]: JsonValue }
  | readonly JsonValue[];

export type LlmMetadata = { readonly [key: string]: JsonValue };

export const LlmMessageRole = {
  System: "system",
  User: "user",
  Assistant: "assistant",
  Tool: "tool",
} as const;

export type LlmMessageRole =
  (typeof LlmMessageRole)[keyof typeof LlmMessageRole];

export const LlmFinishReason = {
  Stop: "stop",
  Length: "length",
  ToolCall: "tool_call",
  ContentFilter: "content_filter",
  Unknown: "unknown",
} as const;

export type LlmFinishReason =
  (typeof LlmFinishReason)[keyof typeof LlmFinishReason];

export interface LlmMessage {
  role: LlmMessageRole;
  content: string;
  metadata?: LlmMetadata;
}

export interface LlmGenerateOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stop?: readonly string[];
  metadata?: LlmMetadata;
}

export interface LlmGenerateRequest {
  messages: readonly LlmMessage[];
  options?: LlmGenerateOptions;
}

export interface LlmUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface LlmGenerateResponse {
  content: string;
  usage?: LlmUsage;
  finishReason?: LlmFinishReason;
  metadata?: LlmMetadata;
}

export interface LlmProvider {
  generate(request: LlmGenerateRequest): Promise<LlmGenerateResponse>;
}
