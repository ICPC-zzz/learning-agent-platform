import type { ChunkingOptions, ImportedBookChapter, ImportedContentChunk } from "../types.js";
import { clampNumber, createChunkId } from "../utils.js";

export interface ChunkChapterByCharactersInput {
  chapter: ImportedBookChapter;
  options?: ChunkingOptions;
  initialOrderIndex?: number;
}

export interface ChunkChaptersByCharactersInput {
  chapters: ImportedBookChapter[];
  options?: ChunkingOptions;
}

interface ResolvedChunkingOptions {
  maxChunkChars: number;
  overlapChars: number;
  minChunkChars: number;
}

interface TrimmedSlice {
  plainText: string;
  startOffset: number;
  endOffset: number;
}

const DEFAULT_MAX_CHUNK_CHARS = 2000;
const DEFAULT_OVERLAP_CHARS = 200;
const DEFAULT_MIN_CHUNK_CHARS = 200;

export function chunkChapterByCharacters(
  input: ChunkChapterByCharactersInput,
): ImportedContentChunk[] {
  const text = input.chapter.plainText;

  if (text.length === 0) {
    return [];
  }

  const options = resolveChunkingOptions(input.options);
  const chunks: ImportedContentChunk[] = [];
  let startOffset = 0;
  let orderIndex = input.initialOrderIndex ?? 0;

  while (startOffset < text.length) {
    const endOffset = findChunkEnd(text, startOffset, options);
    const slice = createTrimmedSlice(text, startOffset, endOffset);

    if (slice !== undefined) {
      chunks.push({
        id: createChunkId(),
        bookId: input.chapter.bookId,
        chapterId: input.chapter.id,
        orderIndex,
        plainText: slice.plainText,
        charCount: slice.plainText.length,
        startOffset: slice.startOffset,
        endOffset: slice.endOffset,
      });
      orderIndex += 1;
    }

    if (endOffset >= text.length) {
      break;
    }

    startOffset = Math.max(endOffset - options.overlapChars, startOffset + 1);
  }

  return chunks;
}

export function chunkChaptersByCharacters(
  input: ChunkChaptersByCharactersInput,
): ImportedContentChunk[] {
  const chunks: ImportedContentChunk[] = [];
  let nextOrderIndex = 0;

  for (const chapter of input.chapters) {
    const chapterChunks = chunkChapterByCharacters({
      chapter,
      options: input.options,
      initialOrderIndex: nextOrderIndex,
    });

    chunks.push(...chapterChunks);
    nextOrderIndex += chapterChunks.length;
  }

  return chunks;
}

function resolveChunkingOptions(options: ChunkingOptions | undefined): ResolvedChunkingOptions {
  const maxChunkChars = clampNumber(options?.maxChunkChars, DEFAULT_MAX_CHUNK_CHARS, 1);
  const overlapUpperBound = Math.max(0, maxChunkChars - 1);
  const overlapChars = clampNumber(
    options?.overlapChars,
    Math.min(DEFAULT_OVERLAP_CHARS, overlapUpperBound),
    0,
    overlapUpperBound,
  );
  const minChunkChars = clampNumber(
    options?.minChunkChars,
    Math.min(DEFAULT_MIN_CHUNK_CHARS, maxChunkChars),
    0,
    maxChunkChars,
  );

  return {
    maxChunkChars,
    overlapChars,
    minChunkChars,
  };
}

function findChunkEnd(text: string, startOffset: number, options: ResolvedChunkingOptions): number {
  const hardEndOffset = Math.min(startOffset + options.maxChunkChars, text.length);

  if (hardEndOffset >= text.length) {
    return text.length;
  }

  const minimumPreferredEnd = startOffset + Math.min(
    options.maxChunkChars,
    Math.max(options.minChunkChars, Math.floor(options.maxChunkChars / 2)),
  );

  const paragraphBreakOffset = text.lastIndexOf("\n\n", hardEndOffset);
  if (paragraphBreakOffset >= minimumPreferredEnd) {
    return paragraphBreakOffset;
  }

  const lineBreakOffset = text.lastIndexOf("\n", hardEndOffset);
  if (lineBreakOffset >= minimumPreferredEnd) {
    return lineBreakOffset;
  }

  const wordBreakOffset = text.lastIndexOf(" ", hardEndOffset);
  if (wordBreakOffset >= minimumPreferredEnd) {
    return wordBreakOffset;
  }

  return hardEndOffset;
}

function createTrimmedSlice(
  text: string,
  startOffset: number,
  endOffset: number,
): TrimmedSlice | undefined {
  let adjustedStartOffset = startOffset;
  let adjustedEndOffset = endOffset;

  while (adjustedStartOffset < adjustedEndOffset && isWhitespace(text[adjustedStartOffset])) {
    adjustedStartOffset += 1;
  }

  while (
    adjustedEndOffset > adjustedStartOffset &&
    isWhitespace(text[adjustedEndOffset - 1])
  ) {
    adjustedEndOffset -= 1;
  }

  if (adjustedStartOffset >= adjustedEndOffset) {
    return undefined;
  }

  return {
    plainText: text.slice(adjustedStartOffset, adjustedEndOffset),
    startOffset: adjustedStartOffset,
    endOffset: adjustedEndOffset,
  };
}

function isWhitespace(character: string | undefined): boolean {
  return character !== undefined && /\s/.test(character);
}
