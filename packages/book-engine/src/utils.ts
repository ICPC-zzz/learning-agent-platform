import type { ImportWarning } from "./types.js";

let nextId = 0;

export function createBookEngineId(prefix: string): string {
  nextId += 1;

  const normalizedPrefix = prefix
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const safePrefix = normalizedPrefix.length > 0 ? normalizedPrefix : "book-engine";

  return `${safePrefix}_${nextId.toString().padStart(6, "0")}`;
}

export function createBookId(): string {
  return createBookEngineId("book");
}

export function createChapterId(): string {
  return createBookEngineId("chapter");
}

export function createChunkId(): string {
  return createBookEngineId("chunk");
}

export function clampNumber(
  value: number | undefined,
  defaultValue: number,
  min: number,
  max?: number,
): number {
  const candidate = value ?? defaultValue;
  const finiteValue = Number.isFinite(candidate) ? candidate : defaultValue;
  const lowerBounded = Math.max(min, Math.floor(finiteValue));

  if (max === undefined) {
    return lowerBounded;
  }

  return Math.min(lowerBounded, max);
}

export function createImportWarning(code: string, message: string): ImportWarning {
  return { code, message };
}
