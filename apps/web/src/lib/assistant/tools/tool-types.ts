import type { AssistantLearningContextSummary, AssistantSource, SafeAssistantPageContext } from "../assistant-types.ts";

export type AssistantToolName =
  | "search_technical_articles"
  | "get_hot_technical_articles"
  | "search_codeforces_problems"
  | "recommend_codeforces_problems"
  | "resolveLearnerTrainingProfile"
  | "getPersonalizedCodeforcesCandidates"
  | "getUpcomingCodeforcesContests";

export interface AssistantToolSchema {
  type: "object";
  title: string;
  description: string;
  properties: Record<string, AssistantToolSchemaProperty>;
  required?: string[];
  additionalProperties?: false;
}

export interface AssistantToolSchemaProperty {
  type: "string" | "number" | "array" | "boolean";
  description: string;
  items?: AssistantToolSchemaProperty;
}

export interface AssistantToolExecutionContext {
  userId: string | null;
  question: string;
  pageContext: SafeAssistantPageContext;
  learningContext: AssistantLearningContextSummary;
  guardEnv?: Record<string, string | undefined>;
  customFetch?: typeof fetch;
  signal?: AbortSignal;
  forcePermissionDenied?: boolean;
}

export interface AssistantToolExecutionResult<TItem = unknown> {
  name: AssistantToolName;
  ok: boolean;
  summary: string;
  items: TItem[];
  sources: AssistantSource[];
  warnings: string[];
  errorCode?: string;
  errorMessage?: string;
  timedOut: boolean;
  rawResponseStored: false;
}

export interface AssistantToolDefinition<I = unknown, O = unknown> {
  name: AssistantToolName;
  description: string;
  inputSchema: AssistantToolSchema;
  outputSchema: AssistantToolSchema;
  timeoutMs: number;
  maxResults: number;
  maxSummaryChars: number;
  sourceLabel: string;
  validateInput: (input: unknown) => input is I;
  execute: (
    input: I,
    context: AssistantToolExecutionContext,
  ) => Promise<AssistantToolExecutionResult<O>>;
}

export interface AnyAssistantToolDefinition {
  name: AssistantToolName;
  description: string;
  inputSchema: AssistantToolSchema;
  outputSchema: AssistantToolSchema;
  timeoutMs: number;
  maxResults: number;
  maxSummaryChars: number;
  sourceLabel: string;
  validateInput: (input: unknown) => boolean;
  execute: (
    input: unknown,
    context: AssistantToolExecutionContext,
  ) => Promise<AssistantToolExecutionResult<unknown>>;
}

export function eraseAssistantToolDefinition<I, O>(
  definition: AssistantToolDefinition<I, O>,
): AnyAssistantToolDefinition {
  return {
    ...definition,
    validateInput: (input: unknown): boolean => definition.validateInput(input),
    execute: async (
      input: unknown,
      context: AssistantToolExecutionContext,
    ): Promise<AssistantToolExecutionResult<unknown>> => {
      if (!definition.validateInput(input)) {
        return createEmptyToolResult(definition.name, "工具输入校验失败。", [
          "工具输入无效",
        ]);
      }
      return definition.execute(input, context);
    },
  };
}

export function createEmptyToolResult<TItem>(
  name: AssistantToolName,
  summary: string,
  warnings: string[] = [],
): AssistantToolExecutionResult<TItem> {
  return {
    name,
    ok: false,
    summary,
    items: [],
    sources: [],
    warnings,
    errorCode: "unavailable",
    errorMessage: summary,
    timedOut: false,
    rawResponseStored: false,
  };
}
