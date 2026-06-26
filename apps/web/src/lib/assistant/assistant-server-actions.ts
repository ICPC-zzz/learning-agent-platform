"use server";

import { readAssistantSession } from "./assistant-session.ts";
import { runAssistantOrchestrator } from "./assistant-orchestrator.ts";
import {
  addAssistantMemory,
  deleteAssistantMemory,
  listAssistantMemories,
  persistAssistantMemoryTurn,
  toggleAssistantMemoryEnabled,
} from "./memory-service.ts";
import {
  buildAssistantLearningContext,
  createEmptyAssistantLearningContext,
  mergeAssistantLearningContext,
} from "./user-learning-context.ts";
import type {
  AssistantMemoryInput,
  AssistantMemoryRecord,
  AssistantRequestInput,
  AssistantResponse,
} from "./assistant-types.ts";

export async function runAssistantAction(
  input: AssistantRequestInput,
  options?: {
    guardEnv?: Record<string, string | undefined>;
    customFetch?: typeof fetch;
  },
): Promise<AssistantResponse> {
  const session = await readAssistantSession();
  const userId = session.userId ?? null;
  const serverLearningContext = userId
    ? await buildAssistantLearningContext({
        userId,
        displayName: session.displayName ?? undefined,
      })
    : createEmptyAssistantLearningContext(session.displayName ?? null, session.hasSession);

  const response = await runAssistantOrchestrator(
    {
      ...input,
      userId,
      learningContext: mergeAssistantLearningContext(serverLearningContext, input.learningContext ?? null),
    },
    options,
  );

  await persistAssistantMemoryTurn({
    userId,
    conversation: input.conversation ?? null,
    question: input.question,
    answer: response.message,
    pageContext: input.pageContext,
  });

  return response;
}

export async function listAssistantMemoriesAction(): Promise<AssistantMemoryRecord[]> {
  const session = await readAssistantSession();
  if (!session.userId) {
    return [];
  }
  return listAssistantMemories(session.userId);
}

export async function listAssistantMemoryOverviewAction(): Promise<AssistantMemoryRecord[]> {
  const session = await readAssistantSession();
  if (!session.userId) {
    return [];
  }

  return listAssistantMemories(session.userId, { includeInternal: true });
}

export async function addAssistantMemoryAction(
  input: AssistantMemoryInput,
): Promise<AssistantMemoryRecord> {
  const session = await readAssistantSession();
  if (!session.userId) {
    throw new Error("Session is required.");
  }
  return addAssistantMemory(session.userId, input);
}

export async function toggleAssistantMemoryEnabledAction(
  memoryId: string,
  enabled: boolean,
): Promise<AssistantMemoryRecord | null> {
  const session = await readAssistantSession();
  if (!session.userId) {
    return null;
  }
  return toggleAssistantMemoryEnabled(session.userId, memoryId, enabled);
}

export async function deleteAssistantMemoryAction(
  memoryId: string,
): Promise<boolean> {
  const session = await readAssistantSession();
  if (!session.userId) {
    return false;
  }
  return deleteAssistantMemory(session.userId, memoryId);
}
