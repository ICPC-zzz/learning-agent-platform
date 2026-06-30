import type {
  JsonValue,
  MemoryAddInput,
  MemoryImportanceScore,
  MemoryItem,
  MemoryMetadata,
} from "./types.ts";

export const DEFAULT_MEMORY_IMPORTANCE: MemoryImportanceScore = 0.5;

export function normalizeMemoryText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export function createMemoryId(sequence: number, prefix = "mem"): string {
  const normalizedSequence = Math.max(0, Math.floor(sequence));
  return `${prefix}_${normalizedSequence.toString(36).padStart(6, "0")}`;
}

export function normalizeMemoryLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return 5;
  }

  if (!Number.isFinite(limit)) {
    return 5;
  }

  return Math.max(0, Math.floor(limit));
}

export function normalizeMemoryImportance(
  importance: MemoryImportanceScore | undefined,
): MemoryImportanceScore {
  if (importance === undefined || !Number.isFinite(importance)) {
    return DEFAULT_MEMORY_IMPORTANCE;
  }

  return Math.min(1, Math.max(0, importance));
}

export function normalizeMemoryCreatedAt(createdAt: string | undefined): string {
  if (createdAt === undefined) {
    return new Date().toISOString();
  }

  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }

  return parsed.toISOString();
}

export function cloneJsonValue(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map((item) => cloneJsonValue(item));
  }

  if (value !== null && typeof value === "object") {
    const cloned: Record<string, JsonValue> = {};
    for (const [key, childValue] of Object.entries(value)) {
      cloned[key] = cloneJsonValue(childValue);
    }
    return cloned;
  }

  return value;
}

export function cloneMemoryMetadata(
  metadata: MemoryMetadata | undefined,
): MemoryMetadata | undefined {
  if (metadata === undefined) {
    return undefined;
  }

  const cloned: Record<string, JsonValue> = {};
  for (const [key, value] of Object.entries(metadata)) {
    cloned[key] = cloneJsonValue(value);
  }
  return cloned;
}

export function cloneMemoryItem(item: MemoryItem): MemoryItem {
  return {
    id: item.id,
    ...(item.userId === undefined ? {} : { userId: item.userId }),
    ...(item.sessionId === undefined ? {} : { sessionId: item.sessionId }),
    layer: item.layer,
    content: item.content,
    importance: item.importance,
    ...(item.metadata === undefined
      ? {}
      : { metadata: cloneMemoryMetadata(item.metadata) }),
    createdAt: item.createdAt,
  };
}

export function completeMemoryItem(
  input: MemoryAddInput,
  id: string,
): MemoryItem {
  return {
    id,
    ...(input.userId === undefined ? {} : { userId: input.userId }),
    ...(input.sessionId === undefined ? {} : { sessionId: input.sessionId }),
    layer: input.layer,
    content: input.content,
    importance: normalizeMemoryImportance(input.importance),
    ...(input.metadata === undefined
      ? {}
      : { metadata: cloneMemoryMetadata(input.metadata) }),
    createdAt: normalizeMemoryCreatedAt(input.createdAt),
  };
}

export function jsonValueEquals(
  left: JsonValue | undefined,
  right: JsonValue | undefined,
): boolean {
  if (left === undefined || right === undefined) {
    return left === right;
  }

  if (Object.is(left, right)) {
    return true;
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) {
      return false;
    }

    if (left.length !== right.length) {
      return false;
    }

    return left.every((value, index) => jsonValueEquals(value, right[index]));
  }

  if (isJsonObject(left) && isJsonObject(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);

    if (leftKeys.length !== rightKeys.length) {
      return false;
    }

    return leftKeys.every((key) => jsonValueEquals(left[key], right[key]));
  }

  return false;
}

function isJsonObject(
  value: JsonValue | undefined,
): value is { readonly [key: string]: JsonValue } {
  return value !== undefined && value !== null && typeof value === "object";
}

export function memoryMetadataMatches(
  itemMetadata: MemoryMetadata | undefined,
  filterMetadata: MemoryMetadata | undefined,
): boolean {
  if (filterMetadata === undefined) {
    return true;
  }

  if (itemMetadata === undefined) {
    return false;
  }

  return Object.entries(filterMetadata).every(([key, value]) =>
    jsonValueEquals(itemMetadata[key], value),
  );
}
