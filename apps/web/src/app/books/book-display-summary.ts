/**
 * Book display summary computation.
 *
 * Pure functions that compute display-oriented summaries for books,
 * including chapter counts, code block detection, reading time estimates,
 * and first-chapter navigation info.
 *
 * All functions are synchronous, deterministic, no I/O, no network.
 *
 * @module book-display-summary
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BookDisplaySummary {
  /** Total number of chapters */
  chapterCount: number;
  /** Number of chapters containing at least one fenced code block */
  codeBlockChapterCount: number;
  /** Estimated total reading time in minutes */
  estimatedReadingMinutes: number;
  /** Whether any chapter has code blocks */
  hasCodeBlocks: boolean;
}

export interface FirstChapterInfo {
  chapterId: string;
  title: string;
  orderIndex: number;
  estimatedReadingMinutes: number;
  readerHref: string;
  hasCodeBlock: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Approximate words-per-minute for Chinese/English mixed text */
const CHARS_PER_MINUTE = 300;

/** Minimum reading time in minutes */
const MIN_READING_MINUTES = 1;

/** Regex to detect fenced code blocks (``` or ~~~) */
const FENCED_CODE_BLOCK_RE = /```[\s\S]*?```|~~~[\s\S]*?~~~/;

// ---------------------------------------------------------------------------
// Code block detection
// ---------------------------------------------------------------------------

/**
 * Check whether a text contains at least one fenced code block.
 * Simple regex detection — no parser needed.
 */
export function hasFencedCodeBlock(text: string): boolean {
  return FENCED_CODE_BLOCK_RE.test(text);
}

/**
 * Count how many chapters have at least one fenced code block.
 */
export function countCodeBlockChapters(
  chapters: readonly { plainText: string }[],
): number {
  let count = 0;
  for (const chapter of chapters) {
    if (hasFencedCodeBlock(chapter.plainText ?? "")) {
      count++;
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Reading time
// ---------------------------------------------------------------------------

/**
 * Estimate reading minutes from character count.
 */
export function estimateReadingMinutes(charCount: number): number {
  return Math.max(MIN_READING_MINUTES, Math.ceil(charCount / CHARS_PER_MINUTE));
}

/**
 * Estimate total reading minutes for a set of chapters.
 */
export function estimateTotalReadingMinutes(
  chapters: readonly { plainText: string }[],
): number {
  const totalChars = chapters.reduce(
    (sum, ch) => sum + (ch.plainText?.length ?? 0),
    0,
  );
  return estimateReadingMinutes(totalChars);
}

// ---------------------------------------------------------------------------
// Book-level summary
// ---------------------------------------------------------------------------

/**
 * Compute a display summary for a book given its chapters.
 */
export function computeBookDisplaySummary(params: {
  chapters: readonly { plainText: string }[];
}): BookDisplaySummary {
  const { chapters } = params;
  const chapterCount = chapters.length;
  const codeBlockChapterCount = countCodeBlockChapters(chapters);
  const totalChars = chapters.reduce(
    (sum, ch) => sum + (ch.plainText?.length ?? 0),
    0,
  );
  const estimatedReadingMinutes = estimateReadingMinutes(totalChars);

  return {
    chapterCount,
    codeBlockChapterCount,
    estimatedReadingMinutes,
    hasCodeBlocks: codeBlockChapterCount > 0,
  };
}

// ---------------------------------------------------------------------------
// First chapter info
// ---------------------------------------------------------------------------

/**
 * Build first-chapter navigation info.
 *
 * Returns null if the book has no chapters.
 */
export function getFirstChapterInfo(params: {
  bookId: string;
  chapters: readonly {
    id: string;
    title: string;
    orderIndex: number;
    plainText: string;
  }[];
}): FirstChapterInfo | null {
  const { bookId, chapters } = params;

  if (chapters.length === 0) return null;

  const first = chapters[0];
  const charCount = first.plainText?.length ?? 0;
  const estimatedReadingMinutes = estimateReadingMinutes(charCount);
  const hasCodeBlock = hasFencedCodeBlock(first.plainText ?? "");

  return {
    chapterId: first.id,
    title: first.title,
    orderIndex: first.orderIndex,
    estimatedReadingMinutes,
    readerHref: buildReaderHref(bookId, first.id),
    hasCodeBlock,
  };
}

// ---------------------------------------------------------------------------
// Reader URL builder
// ---------------------------------------------------------------------------

/**
 * Build a reader URL for a book+chapter pair.
 */
export function buildReaderHref(bookId: string, chapterId?: string): string {
  if (chapterId === undefined) {
    return `/reader?bookId=${encodeURIComponent(bookId)}`;
  }
  return `/reader?bookId=${encodeURIComponent(bookId)}&chapterId=${encodeURIComponent(chapterId)}`;
}

// ---------------------------------------------------------------------------
// Safety check
// ---------------------------------------------------------------------------

const SENSITIVE_PATTERNS: RegExp[] = [
  /\bDATABASE_URL\b/i,
  /\bapi[_\s-]*key\b/i,
  /\btoken\b/i,
  /\bsecret\b/i,
  /\bpassword\b/i,
  /\bcookie\b/i,
  /\bsk-[A-Za-z0-9]{8,}\b/,
];

/**
 * Check that a summary object contains no sensitive fields.
 */
export function hasSensitiveFields(obj: unknown): boolean {
  const json = JSON.stringify(obj);
  return SENSITIVE_PATTERNS.some((p) => p.test(json));
}
