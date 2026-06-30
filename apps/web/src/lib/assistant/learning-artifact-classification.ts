import type { AssistantMemoryRecord } from "./assistant-types.ts";

export const LEARNING_ARTIFACT_KIND_LEARNING_REPORT = "cf_learning_report";
export const LEARNING_ARTIFACT_KIND_REVIEW_PLAN = "cf_review_plan";
export const LEARNING_ARTIFACT_KIND_CODE_ANALYSIS = "code_analysis_history";

const READONLY_ARTIFACT_KINDS = new Set([
  LEARNING_ARTIFACT_KIND_LEARNING_REPORT,
  LEARNING_ARTIFACT_KIND_REVIEW_PLAN,
  LEARNING_ARTIFACT_KIND_CODE_ANALYSIS,
]);

export function isReadonlyLearningArtifactKind(value: unknown): value is string {
  return typeof value === "string" && READONLY_ARTIFACT_KINDS.has(value);
}

export function artifactKindOfMemory(memory: Pick<AssistantMemoryRecord, "metadata">): string {
  const metadata = memory.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return "";
  }
  const value = (metadata as Record<string, unknown>).artifactKind;
  return typeof value === "string" ? value : "";
}

export function isReadonlyLearningArtifactMemory(memory: AssistantMemoryRecord): boolean {
  const artifactKind = artifactKindOfMemory(memory);
  if (isReadonlyLearningArtifactKind(artifactKind)) {
    return true;
  }

  const metadata = memory.metadata;
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    const record = metadata as Record<string, unknown>;
    if (
      record.readonlyContext === true
      || record.memoryKind === "readonly_context"
      || record.contextKind === "learning_artifact"
    ) {
      return true;
    }
  }

  const content = memory.content.replace(/\s+/g, " ").trim().toLowerCase();
  const hasNoConversationSource = !memory.sourceConversationId && !memory.sourceMessageId && !memory.sessionId;
  return hasNoConversationSource
    && memory.category === "learning"
    && (
      content.startsWith("codeforces learning report")
      || content.startsWith("codeforces review plan")
      || content.startsWith("recent code analysis")
    );
}

export function isUserManagedLongTermMemory(memory: AssistantMemoryRecord): boolean {
  return memory.memoryType === "RETRIEVABLE"
    && !isReadonlyLearningArtifactMemory(memory);
}
