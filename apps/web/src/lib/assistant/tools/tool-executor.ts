import type {
  AnyAssistantToolDefinition,
  AssistantToolExecutionContext,
  AssistantToolExecutionResult,
  AssistantToolName,
} from "./tool-types.ts";

export async function executeAssistantTool(
  definition: AnyAssistantToolDefinition,
  input: unknown,
  context: AssistantToolExecutionContext,
): Promise<AssistantToolExecutionResult<unknown>> {
  if (!definition.validateInput(input)) {
    return {
      name: definition.name,
      ok: false,
      summary: "Tool input validation failed.",
      items: [],
      sources: [],
      warnings: ["invalid tool input"],
      errorCode: "invalid_input",
      errorMessage: "Tool input does not match schema.",
      timedOut: false,
      rawResponseStored: false,
    };
  }

  try {
    return await withTimeout(
      definition.execute(input, context),
      definition.timeoutMs,
      definition.name,
    );
  } catch (error) {
    return {
      name: definition.name,
      ok: false,
      summary: "Tool execution failed.",
      items: [],
      sources: [],
      warnings: [],
      errorCode: "tool_error",
      errorMessage: error instanceof Error ? sanitizeErrorMessage(error.message) : "Unknown tool error",
      timedOut: false,
      rawResponseStored: false,
    };
  }
}

export function findAssistantToolDefinition(
  definitions: readonly AnyAssistantToolDefinition[],
  name: AssistantToolName,
): AnyAssistantToolDefinition | null {
  return definitions.find((definition) => definition.name === name) ?? null;
}

async function withTimeout<O>(
  promise: Promise<AssistantToolExecutionResult<O>>,
  timeoutMs: number,
  name: AssistantToolName,
): Promise<AssistantToolExecutionResult<O>> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    const timeoutPromise = new Promise<AssistantToolExecutionResult<O>>((resolve) => {
      timer = setTimeout(() => {
        resolve({
          name,
          ok: false,
          summary: "Tool execution timed out.",
          items: [],
          sources: [],
          warnings: ["tool timeout"],
          errorCode: "timeout",
          errorMessage: `Tool timed out after ${timeoutMs}ms.`,
          timedOut: false,
          rawResponseStored: false,
        });
      }, timeoutMs);
    });

    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer !== null) {
      clearTimeout(timer);
    }
  }
}

function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/https?:\/\/[^\s]+/g, "[redacted url]")
    .replace(/\b(api[_-]?key|token|secret|password)\b\s*[:=]\s*\S+/gi, "$1=[redacted]")
    .slice(0, 240);
}
