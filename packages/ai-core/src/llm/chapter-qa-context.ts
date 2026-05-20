export type ChapterQaContextSource = "current_reader_context";

export interface ChapterQaQuestion {
  text: string;
}

export interface ChapterQaContextChunk {
  id?: string;
  orderIndex: number;
  text: string;
  truncated: boolean;
}

export interface ChapterQaContext {
  userQuestion: string;
  bookTitle: string;
  chapterTitle: string;
  currentChunkText: string;
  visibleTextExcerpt: string;
  nearbyChunks: readonly ChapterQaContextChunk[];
  currentChunkIndex: number;
  totalChunks: number;
  readingProgressPercent: number;
  readingProgressSummary: string;
  abilityProfileSummary: string;
  contextSource: ChapterQaContextSource;
}

export interface ChapterQaContextBuilderChunk {
  id?: string;
  orderIndex: number;
  text: string;
}

export interface ChapterQaContextTextLimits {
  currentChunkTextChars: number;
  nearbyChunkTextChars: number;
  visibleTextExcerptChars: number;
  nearbyChunkRadius: number;
}

export interface BuildChapterQaContextInput {
  userQuestion: string;
  bookTitle: string;
  chapterTitle: string;
  chunks: readonly ChapterQaContextBuilderChunk[];
  currentChunkIndex: number;
  readingProgressPercent: number;
  readingProgressSummary: string;
  abilityProfileSummary: string;
  textLimits?: Partial<ChapterQaContextTextLimits>;
}

export const defaultChapterQaContextTextLimits: ChapterQaContextTextLimits = {
  currentChunkTextChars: 900,
  nearbyChunkTextChars: 420,
  visibleTextExcerptChars: 1200,
  nearbyChunkRadius: 1,
};

export function buildChapterQaContext(
  input: BuildChapterQaContextInput,
): ChapterQaContext {
  const limits = {
    ...defaultChapterQaContextTextLimits,
    ...input.textLimits,
  };
  const normalizedChunks = input.chunks.map((chunk) => ({
    ...chunk,
    text: normalizeWhitespace(chunk.text),
  }));
  const totalChunks = normalizedChunks.length;
  const currentChunkIndex = clampChunkIndex(input.currentChunkIndex, totalChunks);
  const currentChunk = normalizedChunks[currentChunkIndex];
  const nearbyChunks = selectNearbyChunks(
    normalizedChunks,
    currentChunkIndex,
    limits,
  );
  const visibleTextExcerpt = truncateText(
    nearbyChunks.map((chunk) => chunk.text).join("\n\n"),
    limits.visibleTextExcerptChars,
  );

  return {
    userQuestion: input.userQuestion,
    bookTitle: input.bookTitle,
    chapterTitle: input.chapterTitle,
    currentChunkText: truncateText(
      currentChunk?.text ?? "",
      limits.currentChunkTextChars,
    ),
    visibleTextExcerpt,
    nearbyChunks,
    currentChunkIndex,
    totalChunks,
    readingProgressPercent: clampPercent(input.readingProgressPercent),
    readingProgressSummary: input.readingProgressSummary,
    abilityProfileSummary: input.abilityProfileSummary,
    contextSource: "current_reader_context",
  };
}

function selectNearbyChunks(
  chunks: readonly ChapterQaContextBuilderChunk[],
  currentChunkIndex: number,
  limits: ChapterQaContextTextLimits,
): readonly ChapterQaContextChunk[] {
  if (chunks.length === 0) {
    return [];
  }

  const radius = Math.max(0, Math.trunc(limits.nearbyChunkRadius));
  const startIndex = Math.max(0, currentChunkIndex - radius);
  const endIndex = Math.min(chunks.length - 1, currentChunkIndex + radius);

  return chunks.slice(startIndex, endIndex + 1).map((chunk) => {
    const text = truncateText(chunk.text, limits.nearbyChunkTextChars);

    return {
      id: chunk.id,
      orderIndex: chunk.orderIndex,
      text,
      truncated: text.length < chunk.text.length,
    };
  });
}

function truncateText(text: string, maxChars: number): string {
  const normalized = normalizeWhitespace(text);
  const safeMaxChars = Math.max(0, Math.trunc(maxChars));

  if (normalized.length <= safeMaxChars) {
    return normalized;
  }

  if (safeMaxChars <= 3) {
    return normalized.slice(0, safeMaxChars);
  }

  return `${normalized.slice(0, safeMaxChars - 3)}...`;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function clampChunkIndex(index: number, totalChunks: number): number {
  if (totalChunks <= 0 || !Number.isFinite(index)) {
    return 0;
  }

  return Math.min(Math.max(Math.trunc(index), 0), totalChunks - 1);
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(Math.round(value), 0), 100);
}
